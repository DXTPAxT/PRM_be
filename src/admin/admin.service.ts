import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, OrderStatus, ProductStatus } from '@prisma/client';

const USER_ADMIN_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard overview ──────────────────────────────────────────────

  async dashboard() {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      ordersByStatus,
      recentOrders,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count({ where: { status: ProductStatus.active } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { in: [OrderStatus.delivered, OrderStatus.completed] },
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          total: true,
          status: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      data: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue._sum.total ?? 0,
        ordersByStatus: ordersByStatus.map((row) => ({
          status: row.status,
          count: row._count.id,
        })),
        recentOrders,
      },
      message: 'Lấy dashboard thành công.',
    };
  }

  // ── User management ─────────────────────────────────────────────────

  async findAllUsers(page = 1, limit = 20) {
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: USER_ADMIN_SELECT,
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      message: 'Lấy danh sách người dùng thành công.',
    };
  }

  async findOneUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_ADMIN_SELECT,
        addresses: {
          select: { id: true, fullName: true, phone: true, detail: true, isDefault: true },
        },
        _count: { select: { orders: true, reviews: true } },
      },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    return { data: user, message: 'Lấy thông tin người dùng thành công.' };
  }

  async updateUserRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: USER_ADMIN_SELECT,
    });

    return { data: updated, message: 'Cập nhật role thành công.' };
  }

  async toggleUserActive(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: USER_ADMIN_SELECT,
    });

    return {
      data: updated,
      message: updated.isActive
        ? 'Đã kích hoạt người dùng.'
        : 'Đã vô hiệu hóa người dùng.',
    };
  }

  // ── Order management (admin view) ───────────────────────────────────

  async findAllOrders(page = 1, limit = 20, status?: OrderStatus) {
    const where = status ? { status } : {};

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          total: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          payment: { select: { method: true, status: true } },
        },
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
      message: 'Lấy danh sách đơn hàng thành công.',
    };
  }

  async findOneOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        subtotal: true,
        discount: true,
        shippingFee: true,
        total: true,
        status: true,
        shippingCode: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        address: { select: { fullName: true, phone: true, detail: true } },
        voucher: { select: { id: true, code: true, discount: true } },
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
          select: { id: true, method: true, status: true, amount: true, paidAt: true, txnRef: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    return { data: order, message: 'Lấy chi tiết đơn hàng thành công.' };
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // Validate transition
    const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
      pending_payment: [OrderStatus.confirmed, OrderStatus.cancelled],
      confirmed: [OrderStatus.packed, OrderStatus.cancelled],
      packed: [OrderStatus.shipping],
      shipping: [OrderStatus.delivered],
      delivered: [OrderStatus.completed],
      completed: [],
      cancelled: [],
    };

    if (!ALLOWED[order.status].includes(status)) {
      throw new BadRequestException(
        `Không thể chuyển từ "${order.status}" sang "${status}"`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
        total: true,
        updatedAt: true,
      },
    });

    return { data: updated, message: 'Cập nhật trạng thái đơn hàng thành công.' };
  }
}