import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** Health probe — M2: điền logic danh mục tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'categories', status: 'ok' };
  }
}
