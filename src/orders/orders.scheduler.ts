import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);

  constructor(private readonly ordersService: OrdersService) {}

  /** BR-06: hủy đơn pending_payment quá 15 phút chưa thanh toán. */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoCancel() {
    const count = await this.ordersService.autoCancelExpiredOrders();
    if (count > 0) {
      this.logger.log(`Auto-hủy ${count} đơn hàng quá hạn thanh toán`);
    }
  }
}
