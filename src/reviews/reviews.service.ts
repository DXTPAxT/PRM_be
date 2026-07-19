import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const REVIEW_SELECT = {
  id: true,
  userId: true,
  user: { select: { fullName: true } },
  productId: true,
  rating: true,
  comment: true,
  createdAt: true,
} as const;

type ReviewRow = {
  id: string;
  userId: string;
  user: { fullName: string } | null;
  productId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
};

export interface ReviewItem {
  id: string;
  userId: string;
  userFullName: string;
  productId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

function toReviewItem(row: ReviewRow): ReviewItem {
  return {
    id: row.id,
    userId: row.userId,
    userFullName: row.user?.fullName ?? 'Người dùng',
    productId: row.productId,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }
  }

  /** Trả về review nếu tồn tại VÀ thuộc về userId. */
  private async ensureOwnedBy(userId: string, id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá.');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('Bạn không thể sửa đánh giá của người khác.');
    }

    return review;
  }

  async findByProduct(productId: string, page = 1, limit = 10) {
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: REVIEW_SELECT,
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return {
      data: rows.map((row) => toReviewItem(row as ReviewRow)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      message: 'Lấy đánh giá thành công.',
    };
  }

  async create(userId: string, dto: CreateReviewDto) {
    await this.ensureProductExists(dto.productId);

    try {
      const row = await this.prisma.review.create({
        data: {
          userId,
          productId: dto.productId,
          rating: dto.rating,
          comment: dto.comment?.trim() ?? null,
        },
        select: REVIEW_SELECT,
      });

      return {
        data: toReviewItem(row as ReviewRow),
        message: 'Gửi đánh giá thành công.',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bạn đã đánh giá sản phẩm này rồi.');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateReviewDto) {
    await this.ensureOwnedBy(userId, id);

    const row = await this.prisma.review.update({
      where: { id },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.comment !== undefined
          ? { comment: dto.comment.trim() || null }
          : {}),
      },
      select: REVIEW_SELECT,
    });

    return {
      data: toReviewItem(row as ReviewRow),
      message: 'Cập nhật đánh giá thành công.',
    };
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnedBy(userId, id);

    await this.prisma.review.delete({ where: { id } });

    return { data: null, message: 'Xóa đánh giá thành công.' };
  }
}
