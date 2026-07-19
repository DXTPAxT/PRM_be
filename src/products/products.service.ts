import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductSort, QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  PRODUCT_DETAIL_SELECT,
  PRODUCT_LIST_SELECT,
  toProductDetail,
  toProductListItem,
} from './product.mapper';

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

  async findOne(id: string) {
    const row = await this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_DETAIL_SELECT,
    });

    if (!row) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }

    return toProductDetail(row);
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        basePrice: dto.basePrice,
        status: dto.status ?? ProductStatus.active,
        images: dto.images?.length
          ? {
              createMany: {
                data: dto.images.map((img, index) => ({
                  url: img.url,
                  sortOrder: img.sortOrder ?? index,
                })),
              },
            }
          : undefined,
        variants: { createMany: { data: dto.variants } },
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    return {
      data: toProductDetail(product),
      message: 'Tạo sản phẩm thành công.',
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id); // ném NotFoundException nếu không tồn tại

    const detail = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId }
            : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      // Ảnh replace-all được: ProductImage có onDelete Cascade, không bảng nào tham chiếu.
      if (dto.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (dto.images.length > 0) {
          await tx.productImage.createMany({
            data: dto.images.map((img, index) => ({
              productId: id,
              url: img.url,
              sortOrder: img.sortOrder ?? index,
            })),
          });
        }
      }

      // Variant PHẢI upsert. Xóa variant đang nằm trong CartItem/OrderItem sẽ lỗi FK.
      if (dto.variants) {
        for (const variant of dto.variants) {
          await tx.productVariant.upsert({
            where: {
              productId_size_color: {
                productId: id,
                size: variant.size,
                color: variant.color,
              },
            },
            create: { productId: id, ...variant },
            update: {
              price: variant.price,
              stockQty: variant.stockQty,
              sku: variant.sku,
            },
          });
        }
      }

      return tx.product.findUnique({
        where: { id },
        select: PRODUCT_DETAIL_SELECT,
      });
    });

    return {
      data: toProductDetail(detail as never),
      message: 'Cập nhật sản phẩm thành công.',
    };
  }

  /** Soft delete — xóa cứng sẽ vỡ FK từ OrderItem qua ProductVariant. */
  async remove(id: string) {
    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.inactive },
    });

    return { data: null, message: 'Đã ngừng bán sản phẩm.' };
  }
}
