import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const reviewFindMany = jest.fn();
  const reviewCount = jest.fn();
  const reviewCreate = jest.fn();
  const productFindUnique = jest.fn();
  const prisma = {
    review: {
      findMany: reviewFindMany,
      count: reviewCount,
      create: reviewCreate,
    },
    product: { findUnique: productFindUnique },
  } as unknown as PrismaService;

  let service: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewsService(prisma);
    reviewFindMany.mockResolvedValue([]);
    reviewCount.mockResolvedValue(0);
    productFindUnique.mockResolvedValue({ id: 'p1' });
    reviewCreate.mockResolvedValue({ id: 'r1' });
  });

  it('findByProduct phân trang và kèm tên người đánh giá', async () => {
    reviewCount.mockResolvedValue(5);
    reviewFindMany.mockResolvedValue([
      {
        id: 'r1',
        userId: 'u1',
        user: { fullName: 'Nguyễn Văn A' },
        productId: 'p1',
        rating: 5,
        comment: 'Đẹp',
        createdAt: new Date('2026-01-01'),
      },
    ]);

    const result = await service.findByProduct('p1', 2, 2);

    expect(reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'p1' },
        skip: 2,
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.data[0].userFullName).toBe('Nguyễn Văn A');
    expect(result.meta).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
  });

  it('tạo review khi chưa từng đánh giá', async () => {
    await service.create('u1', {
      productId: 'p1',
      rating: 5,
      comment: '  Rất đẹp  ',
    });

    expect(reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'u1',
          productId: 'p1',
          rating: 5,
          comment: 'Rất đẹp',
        },
      }),
    );
  });

  it('sản phẩm không tồn tại thì ném NotFoundException', async () => {
    productFindUnique.mockResolvedValue(null);

    await expect(
      service.create('u1', { productId: 'missing', rating: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('đã đánh giá rồi (P2002) thì ném ConflictException', async () => {
    reviewCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.0.0',
      }),
    );

    await expect(
      service.create('u1', { productId: 'p1', rating: 4 }),
    ).rejects.toThrow(ConflictException);
  });
});
