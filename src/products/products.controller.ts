import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ReviewsService } from '../reviews/reviews.service';
import { QueryProductsDto } from './dto/query-products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh sách sản phẩm — lọc, tìm kiếm, sắp xếp, phân trang',
  })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(':id/reviews')
  @ApiOperation({ summary: 'Danh sách đánh giá của một sản phẩm' })
  findReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.findByProduct(
      id,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết sản phẩm kèm biến thể và ảnh' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }
}
