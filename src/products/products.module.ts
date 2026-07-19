import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [ReviewsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
