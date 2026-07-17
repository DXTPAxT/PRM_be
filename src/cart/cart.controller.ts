import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /** Health probe — M3: điền logic giỏ hàng tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'cart', status: 'ok' };
  }
}
