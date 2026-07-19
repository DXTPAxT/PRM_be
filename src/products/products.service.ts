import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductSort, QueryProductsDto } from './dto/query-products.dto';
import { PRODUCT_LIST_SELECT, toProductListItem } from './product.mapper';

const SORT_MAP: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> = {
  [ProductSort.newest]: { createdAt: 'desc' },
  [ProductSort.price_asc]: { basePrice: 'asc' },
  [ProductSort.price_desc]: { basePrice: 'desc' },
  [ProductSort.name_asc]: { name: 'asc' },
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh mục cha kéo theo sản phẩm của danh mục con (cây 2 cấp). */
  private async resolveCategoryIds(
    categoryId?: string,
  ): Promise<string[] | undefined> {
    if (!categoryId) return undefined;

    const children = await this.prisma.category.findMany({
      where: { parentId: categoryId },
      select: { id: true },
    });

    return [categoryId, ...children.map((child) => child.id)];
  }

  private buildWhere(
    query: QueryProductsDto,
    categoryIds?: string[],
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { status: ProductStatus.active };

    if (categoryIds) {
      where.categoryId = { in: categoryIds };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    if (query.size || query.color) {
      where.variants = {
        some: {
          ...(query.size ? { size: query.size } : {}),
          ...(query.color ? { color: query.color } : {}),
        },
      };
    }

    return where;
  }

  async findAll(query: QueryProductsDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const categoryIds = await this.resolveCategoryIds(query.categoryId);
    const where = this.buildWhere(query, categoryIds);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: SORT_MAP[query.sort ?? ProductSort.newest],
        skip: (page - 1) * limit,
        take: limit,
        select: PRODUCT_LIST_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: rows.map((row) => toProductListItem(row as never)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      message: 'Lấy danh sách sản phẩm thành công.',
    };
  }
}
