import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Health probe — M3: điền logic đơn hàng tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'orders', status: 'ok' };
  }
}
