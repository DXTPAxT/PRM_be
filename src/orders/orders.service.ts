import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { canTransition, isCancellable } from './order-status.util';
import { GhnService } from './ghn.service';

/** Khối lượng mặc định mỗi sản phẩm (gram) khi biến thể chưa khai báo cân nặng. */
const DEFAULT_ITEM_WEIGHT_G = 300;

const ORDER_DETAIL_SELECT = {
  id: true,
  userId: true,
  addressId: true,
  voucherId: true,
  subtotal: true,
  discount: true,
  shippingFee: true,
  total: true,
  status: true,
  shippingCode: true,
  createdAt: true,
  updatedAt: true,
  address: {
    select: { id: true, fullName: true, phone: true, detail: true },
  },
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          sku: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  },
  payment: {
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      paidAt: true,
    },
  },
} as const;

/** Đơn quá hạn 15 phút mà vẫn chưa thanh toán sẽ bị auto-hủy (BR-06). */
const AUTO_CANCEL_MINUTES = 15;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ghn: GhnService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: { id: true },
    });
    if (!address)
      throw new NotFoundException('Địa chỉ giao hàng không tồn tại');

    if (dto.voucherId) {
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: dto.voucherId },
        select: { id: true, isActive: true },
      });
      if (!voucher || !voucher.isActive) {
        throw new BadRequestException('Voucher không hợp lệ hoặc đã hết hạn');
      }
    }

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            variant: {
              select: {
                id: true,
                price: true,
                stockQty: true,
                product: { select: { status: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Giỏ hàng đang trống');
    }

    for (const item of cart.items) {
      if (item.variant.product.status !== 'active') {
        throw new BadRequestException(
          `Sản phẩm "${item.variant.product.name}" hiện không còn kinh doanh`,
        );
      }
      if (item.quantity > item.variant.stockQty) {
        throw new BadRequestException(
          `Sản phẩm "${item.variant.product.name}" không đủ tồn kho`,
        );
      }
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.variant.price) * item.quantity,
      0,
    );

    // Phí ship GHN: chỉ tính khi FE gửi đủ mã quận/phường và GHN đã cấu hình.
    // Thiếu thông tin hoặc GHN lỗi → fallback về 0 để không chặn luồng đặt hàng.
    let shippingFee = 0;
    if (dto.toDistrictId && dto.toWardCode && this.ghn.isConfigured()) {
      const totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      shippingFee = await this.ghn.calculateFee({
        toDistrictId: dto.toDistrictId,
        toWardCode: dto.toWardCode,
        weight: totalQty * DEFAULT_ITEM_WEIGHT_G,
      });
    }

    let discount = 0;
    if (dto.voucherId) {
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: dto.voucherId },
        select: {
          id: true,
          isActive: true,
          discount: true,
          minOrder: true,
          usageLimit: true,
          usedCount: true,
          expiresAt: true,
        },
      });
      if (!voucher || !voucher.isActive) {
        throw new BadRequestException('Voucher không hợp lệ hoặc đã bị vô hiệu hóa');
      }
      if (voucher.expiresAt && voucher.expiresAt < new Date()) {
        throw new BadRequestException('Voucher đã hết hạn sử dụng');
      }
      if (
        voucher.usageLimit !== null &&
        voucher.usedCount >= voucher.usageLimit
      ) {
        throw new BadRequestException('Voucher đã hết lượt sử dụng');
      }
      if (subtotal < Number(voucher.minOrder)) {
        throw new BadRequestException(
          `Đơn hàng tối thiểu ${voucher.minOrder}đ để dùng voucher này`,
        );
      }
      discount = Number(voucher.discount);
    }

    const total = Math.max(0, subtotal - discount + shippingFee);

    const order = await this.prisma.$transaction(async (tx) => {
      // Trừ tồn kho có điều kiện — updateMany trả count=0 nếu hết hàng giữa chừng (race condition).
      for (const item of cart.items) {
        const result = await tx.productVariant.updateMany({
          where: { id: item.variant.id, stockQty: { gte: item.quantity } },
          data: { stockQty: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new BadRequestException(
            'Một số sản phẩm vừa hết hàng, vui lòng thử lại',
          );
        }
      }

      if (dto.voucherId) {
        await tx.voucher.update({
          where: { id: dto.voucherId },
          data: { usedCount: { increment: 1 } },
        });
      }

      const created = await tx.order.create({
        data: {
          userId,
          addressId: dto.addressId,
          voucherId: dto.voucherId,
          subtotal,
          discount,
          shippingFee,
          total,
          status: OrderStatus.pending_payment,
          toDistrictId: dto.toDistrictId,
          toWardCode: dto.toWardCode,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variant.id,
              quantity: item.quantity,
              unitPrice: item.variant.price,
            })),
          },
          payment: {
            create: {
              method: dto.paymentMethod,
              status: 'pending',
              amount: total,
            },
          },
        },
        select: ORDER_DETAIL_SELECT,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    return order;
  }

  async findAll(userId: string, role: Role, query: QueryOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {
      ...(role === Role.admin ? {} : { userId }),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: ORDER_DETAIL_SELECT,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(userId: string, role: Role, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: ORDER_DETAIL_SELECT,
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (role !== Role.admin && order.userId !== userId) {
      throw new ForbiddenException('Không có quyền xem đơn hàng này');
    }
    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, shippingCode: true },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    if (!canTransition(order.status, status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ "${order.status}" sang "${status}"`,
      );
    }

    // Khi admin chuyển sang "packed": tạo vận đơn GHN (nếu đủ thông tin & chưa có).
    let shippingCode = order.shippingCode;
    if (status === OrderStatus.packed && !shippingCode) {
      shippingCode = await this.createGhnShipment(id);
    }

    return this.prisma.order.update({
      where: { id },
      data: { status, ...(shippingCode ? { shippingCode } : {}) },
      select: ORDER_DETAIL_SELECT,
    });
  }

  /**
   * Tạo vận đơn GHN cho đơn đã sẵn sàng giao. Trả về mã vận đơn, hoặc null nếu
   * thiếu thông tin địa chỉ GHN / GHN chưa cấu hình (không chặn luồng đóng gói).
   */
  private async createGhnShipment(orderId: string): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        total: true,
        toDistrictId: true,
        toWardCode: true,
        address: { select: { fullName: true, phone: true, detail: true } },
        payment: { select: { method: true } },
        items: {
          select: {
            quantity: true,
            variant: { select: { product: { select: { name: true } } } },
          },
        },
      },
    });
    if (
      !order ||
      !order.toDistrictId ||
      !order.toWardCode ||
      !this.ghn.isConfigured()
    ) {
      return null;
    }

    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    // COD thì thu hộ = tổng đơn; thanh toán online rồi thì cod_amount = 0.
    const codAmount = order.payment?.method === 'cod' ? Number(order.total) : 0;

    return this.ghn.createShippingOrder({
      toName: order.address.fullName,
      toPhone: order.address.phone,
      toAddress: order.address.detail,
      toDistrictId: order.toDistrictId,
      toWardCode: order.toWardCode,
      weight: totalQty * DEFAULT_ITEM_WEIGHT_G,
      codAmount,
      items: order.items.map((item) => ({
        name: item.variant.product.name,
        quantity: item.quantity,
      })),
    });
  }

  async cancel(userId: string, role: Role, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        items: { select: { variantId: true, quantity: true } },
      },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (role !== Role.admin && order.userId !== userId) {
      throw new ForbiddenException('Không có quyền hủy đơn hàng này');
    }
    if (!isCancellable(order.status)) {
      throw new BadRequestException('Đơn hàng ở trạng thái này không thể hủy');
    }

    return this.prisma.$transaction(async (tx) => {
      // Guard chống race: chỉ chuyển sang cancelled nếu đơn VẪN còn ở trạng thái
      // hủy được. Nếu một request hủy khác vừa commit trước, updateMany trả count=0
      // và ta dừng lại — không hoàn kho lần thứ hai (tránh tồn kho ảo).
      const claimed = await tx.order.updateMany({
        where: {
          id,
          status: { in: [OrderStatus.pending_payment, OrderStatus.confirmed] },
        },
        data: { status: OrderStatus.cancelled },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          'Đơn hàng ở trạng thái này không thể hủy',
        );
      }

      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { increment: item.quantity } },
        });
      }

      const payment = await tx.payment.findUnique({ where: { orderId: id } });
      if (payment && payment.status === 'paid') {
        await tx.payment.update({
          where: { orderId: id },
          data: { status: 'refunded' },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id },
        select: ORDER_DETAIL_SELECT,
      });
    });
  }

  /** Cron gọi mỗi phút — hủy đơn pending_payment quá hạn (BR-06). */
  async autoCancelExpiredOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - AUTO_CANCEL_MINUTES * 60 * 1000);

    const expired = await this.prisma.order.findMany({
      where: { status: OrderStatus.pending_payment, createdAt: { lt: cutoff } },
      select: {
        id: true,
        items: { select: { variantId: true, quantity: true } },
      },
    });

    let cancelledCount = 0;
    for (const order of expired) {
      await this.prisma.$transaction(async (tx) => {
        // Guard chống race với user-cancel: chỉ hoàn kho nếu chính transaction này
        // là bên chuyển đơn sang cancelled (count=1). Nếu user vừa hủy trước đó,
        // count=0 và ta bỏ qua, không hoàn kho trùng.
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.pending_payment },
          data: { status: OrderStatus.cancelled },
        });
        if (claimed.count === 0) return;

        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
        cancelledCount += 1;
      });
    }

    return cancelledCount;
  }

  /**
   * Webhook GHN gọi về khi trạng thái vận chuyển đổi. Map status của GHN sang
   * OrderStatus nội bộ.
   *
   * Khác với updateStatus (admin) vốn chặn nhảy cóc, webhook phản ánh sự kiện
   * CÓ THẬT từ đơn vị vận chuyển — nếu GHN gửi thiếu bước trung gian (vd chỉ nhận
   * 'delivered' mà miss 'picked'), ta vẫn tiến thẳng tới đích. Chỉ chặn LÙI trạng
   * thái (webhook đến trễ/lặp) bằng cách so thứ hạng.
   */
  async handleGhnWebhook(shippingCode: string, ghnStatus: string) {
    const order = await this.prisma.order.findFirst({
      where: { shippingCode },
      select: { id: true, status: true },
    });
    if (!order) return; // không tìm thấy đơn tương ứng — bỏ qua

    // Map trạng thái GHN → OrderStatus. Chỉ những status GHN có ý nghĩa với luồng.
    const mapping: Record<string, OrderStatus> = {
      picked: OrderStatus.shipping,
      storing: OrderStatus.shipping,
      transporting: OrderStatus.shipping,
      delivering: OrderStatus.shipping,
      delivered: OrderStatus.delivered,
    };
    const target = mapping[ghnStatus];
    if (!target) return;

    // Thứ hạng để so tiến/lùi. Webhook chỉ cập nhật khi target > trạng thái hiện tại.
    const RANK: Record<OrderStatus, number> = {
      pending_payment: 0,
      confirmed: 1,
      packed: 2,
      shipping: 3,
      delivered: 4,
      completed: 5,
      cancelled: -1,
    };
    // Không đụng đơn đã hủy; chỉ tiến, không lùi/không lặp.
    if (order.status === OrderStatus.cancelled) return;
    if (RANK[target] <= RANK[order.status]) return;

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: target },
    });
  }
}
