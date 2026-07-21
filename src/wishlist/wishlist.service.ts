import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddWishlistDto } from './dto/add-wishlist.dto';

const WISHLIST_SELECT = {
  id: true,
  productId: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      name: true,
      basePrice: true,
      status: true,
      images: {
        select: { url: true },
        take: 1,
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
} as const;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: WISHLIST_SELECT,
    });

    const data = rows.map((row) => ({
      id: row.id,
      productId: row.product.id,
      productName: row.product.name,
      basePrice: row.product.basePrice,
      status: row.product.status,
      thumbnailUrl: row.product.images[0]?.url ?? null,
      createdAt: row.createdAt,
    }));

    return { data, message: 'Lấy danh sách yêu thích thành công.' };
  }

  async add(userId: string, dto: AddWishlistDto) {
    // Kiểm tra sản phẩm tồn tại
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại.');

    try {
      await this.prisma.wishlistItem.create({
        data: { userId, productId: dto.productId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Sản phẩm đã có trong danh sách yêu thích.');
      }
      throw error;
    }

    return { data: null, message: 'Đã thêm vào danh sách yêu thích.' };
  }

  async remove(userId: string, productId: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!item) throw new NotFoundException('Sản phẩm không có trong danh sách yêu thích.');

    await this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });

    return { data: null, message: 'Đã xóa khỏi danh sách yêu thích.' };
  }

  /** Kiểm tra 1 sản phẩm có trong wishlist không — dùng cho nút trái tim trên Product Detail. */
  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });
    return !!item;
  }
}
