import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** Health probe — M2: điền logic sản phẩm tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'products', status: 'ok' };
  }
}
