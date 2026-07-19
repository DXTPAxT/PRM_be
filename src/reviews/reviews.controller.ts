import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { SafeUser } from '../users/user.types';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Gửi đánh giá cho một sản phẩm' })
  @ApiResponse({ status: 201, description: 'Gửi đánh giá thành công' })
  @ApiResponse({ status: 409, description: 'Đã đánh giá sản phẩm này rồi' })
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }
}
