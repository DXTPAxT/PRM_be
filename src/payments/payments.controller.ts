import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { SimulateCallbackDto } from './dto/simulate-callback.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { SafeUser } from '../users/user.types';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Xem trạng thái thanh toán của đơn hàng' })
  findByOrder(
    @CurrentUser() user: SafeUser,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.findByOrder(user.id, user.role, orderId);
  }

  @Post('orders/:orderId/simulate-callback')
  @ApiOperation({
    summary:
      'Giả lập callback cổng thanh toán (nội bộ, thay VNPay/MoMo/ZaloPay thật)',
  })
  simulateCallback(
    @CurrentUser() user: SafeUser,
    @Param('orderId') orderId: string,
    @Body() dto: SimulateCallbackDto,
  ) {
    return this.paymentsService.simulateCallback(
      user.id,
      user.role,
      orderId,
      dto,
    );
  }

  // ── VNPay ────────────────────────────────────────────────────────────────

  @Post('orders/:orderId/vnpay-url')
  @ApiOperation({
    summary: 'Tạo URL thanh toán VNPay cho đơn (FE redirect user sang URL này)',
  })
  createVnpayUrl(
    @CurrentUser() user: SafeUser,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ) {
    const ipAddr =
      (req.headers['x-forwarded-for'] as string) ??
      req.socket.remoteAddress ??
      '127.0.0.1';
    return this.paymentsService.createVnpayUrl(
      user.id,
      user.role,
      orderId,
      ipAddr,
    );
  }

  @Public()
  @Get('vnpay/ipn')
  @ApiOperation({
    summary: 'IPN VNPay gọi server-to-server (nguồn tin cậy cập nhật đơn)',
  })
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.paymentsService.handleVnpayIpn(query);
  }

  @Public()
  @Get('vnpay/return')
  @ApiOperation({
    summary: 'VNPay redirect user về đây sau thanh toán (chỉ hiển thị kết quả)',
  })
  vnpayReturn(@Query() query: Record<string, string>, @Res() res: Response) {
    const result = this.paymentsService.verifyVnpayReturn(query);
    // Demo: trả JSON. Production nên redirect về trang kết quả của FE, ví dụ:
    //   res.redirect(`${FE_URL}/payment-result?success=${result.success}&order=${result.orderId}`)
    return res.json({
      success: result.success,
      valid: result.valid,
      orderId: result.orderId,
      message: !result.valid
        ? 'Chữ ký không hợp lệ'
        : result.success
          ? 'Thanh toán thành công'
          : 'Thanh toán thất bại hoặc bị hủy',
    });
  }
}
