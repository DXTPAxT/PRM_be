import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh sách danh mục (flat list, dựng cây bằng parentId)',
  })
  async findAll() {
    return {
      data: await this.categoriesService.findAll(),
      message: 'Lấy danh mục thành công.',
    };
  }
}
