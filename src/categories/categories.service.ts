import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  parentId: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Flat list — FE tự dựng cây 2 cấp từ parentId. */
  async findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
      select: CATEGORY_SELECT,
    });
  }
}
