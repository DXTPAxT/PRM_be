import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersScheduler } from './orders.scheduler';
import { GhnService } from './ghn.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersScheduler, GhnService],
  exports: [OrdersService],
})
export class OrdersModule {}
