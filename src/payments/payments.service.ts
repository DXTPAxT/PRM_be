import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateCallbackDto } from './dto/simulate-callback.dto';
import { VnpayService } from './vnpay.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnpay: VnpayService,
  ) {}

  async findByOrder(userId: string, role: Role, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (role !== Role.admin && order.userId !== userId) {
      throw new ForbiddenException(
        'Không có quyền xem thanh toán của đơn hàng này',
      );
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment)
      throw new NotFoundException('Đơn hàng chưa có thông tin thanh toán');
    return payment;
  }

  /**
   * Giả lập callback/webhook từ cổng thanh toán (VNPay/MoMo/ZaloPay).
   * TODO: M3 — thay bằng endpoint xác minh chữ ký thật của từng cổng khi tích hợp production.
   */
  async simulateCallback(
    userId: string,
    role: Role,
    orderId: string,
    dto: SimulateCallbackDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (role !== Role.admin && order.userId !== userId) {
      throw new ForbiddenException(
        'Không có quyền thao tác thanh toán của đơn hàng này',
      );
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { id: true, status: true, method: true },
    });
    if (!payment)
      throw new NotFoundException('Đơn hàng chưa có thông tin thanh toán');
    if (payment.method === 'cod') {
      throw new BadRequestException('Đơn COD không thanh toán qua cổng online');
    }
    if (payment.status !== 'pending') {
      throw new BadRequestException(
        'Thanh toán đơn hàng này đã được xử lý trước đó',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { orderId },
        data: {
          status: dto.result,
          txnRef: dto.txnRef,
          paidAt: dto.result === 'paid' ? new Date() : null,
        },
      });

      if (dto.result === 'paid') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.confirmed },
        });
      }

      return updatedPayment;
    });
  }

  // ── VNPay (cổng thanh toán thật) ────────────────────────────────────────

  /**
   * Tạo URL thanh toán VNPay cho đơn của user. FE nhận URL rồi redirect user sang.
   */
  async createVnpayUrl(
    userId: string,
    role: Role,
    orderId: string,
    ipAddr: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, total: true },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (role !== Role.admin && order.userId !== userId) {
      throw new ForbiddenException('Không có quyền thanh toán đơn hàng này');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { status: true, method: true },
    });
    if (!payment)
      throw new NotFoundException('Đơn hàng chưa có thông tin thanh toán');
    if (payment.method !== 'vnpay') {
      throw new BadRequestException(
        'Đơn hàng này không dùng phương thức VNPay',
      );
    }
    if (payment.status !== 'pending') {
      throw new BadRequestException(
        'Thanh toán đơn hàng này đã được xử lý trước đó',
      );
    }

    const paymentUrl = this.vnpay.buildPaymentUrl({
      orderId,
      amount: Number(order.total),
      ipAddr,
      orderInfo: `Thanh toan don hang ${orderId}`,
    });

    return { paymentUrl };
  }

  /**
   * Xử lý IPN từ VNPay (server-to-server). Đây là NGUỒN TIN CẬY để cập nhật đơn.
   * VNPay yêu cầu trả về đúng format { RspCode, Message } để nó biết ta đã nhận.
   */
  async handleVnpayIpn(
    query: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    if (!this.vnpay.verifyChecksum(query)) {
      return { RspCode: '97', Message: 'Invalid checksum' };
    }

    const orderId = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const amountRaw = query['vnp_Amount'];

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { total: true },
    });
    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { status: true },
    });
    if (!payment) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // Đối chiếu số tiền (VNPay gửi ×100)
    const expectedAmount = Math.round(Number(order.total)) * 100;
    if (Number(amountRaw) !== expectedAmount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    // Idempotent: đã xử lý rồi thì báo VNPay biết, không cập nhật lại
    if (payment.status !== 'pending') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    const paid = responseCode === '00';
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { orderId },
        data: {
          status: paid ? 'paid' : 'failed',
          txnRef: query['vnp_TransactionNo'] ?? null,
          paidAt: paid ? new Date() : null,
        },
      });
      if (paid) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.confirmed },
        });
      }
    });

    return { RspCode: '00', Message: 'Confirm success' };
  }

  /**
   * Xử lý Return URL (user quay lại sau thanh toán). CHỈ để hiển thị kết quả —
   * KHÔNG cập nhật đơn ở đây (user có thể tắt trình duyệt); IPN mới là nguồn tin cậy.
   */
  verifyVnpayReturn(query: Record<string, string>): {
    valid: boolean;
    success: boolean;
    orderId: string;
  } {
    const valid = this.vnpay.verifyChecksum(query);
    return {
      valid,
      success: valid && query['vnp_ResponseCode'] === '00',
      orderId: query['vnp_TxnRef'] ?? '',
    };
  }
}
