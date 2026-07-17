import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Health probe — M2: điền logic review tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'reviews', status: 'ok' };
  }
}
