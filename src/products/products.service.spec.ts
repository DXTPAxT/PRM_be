import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductSort } from './dto/query-products.dto';
import { ProductsService } from './products.service';

describe('ProductsService.findAll', () => {
  const productFindMany = jest.fn();
  const productCount = jest.fn();
  const categoryFindMany = jest.fn();
  const prisma = {
    product: { findMany: productFindMany, count: productCount },
    category: { findMany: categoryFindMany },
  } as unknown as PrismaService;

  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(prisma);
    productFindMany.mockResolvedValue([]);
    productCount.mockResolvedValue(0);
    categoryFindMany.mockResolvedValue([]);
  });

  function whereOf(): Record<string, unknown> {
    const calls = productFindMany.mock.calls as unknown as Array<
      [{ where: Record<string, unknown> }]
    >;
    return calls[0][0].where;
  }

  it('mặc định chỉ trả sản phẩm đang bán', async () => {
    await service.findAll({});

    expect(whereOf()).toMatchObject({ status: 'active' });
  });

  it('lọc theo categoryId gồm cả danh mục con', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'child-1' }, { id: 'child-2' }]);

    await service.findAll({ categoryId: 'parent-1' });

    expect(categoryFindMany).toHaveBeenCalledWith({
      where: { parentId: 'parent-1' },
      select: { id: true },
    });
    expect(whereOf()).toMatchObject({
      categoryId: { in: ['parent-1', 'child-1', 'child-2'] },
    });
  });

  it('search khớp cả name lẫn description, không phân biệt hoa thường', async () => {
    await service.findAll({ search: 'áo' });

    expect(whereOf()).toMatchObject({
      OR: [
        { name: { contains: 'áo', mode: 'insensitive' } },
        { description: { contains: 'áo', mode: 'insensitive' } },
      ],
    });
  });

  it('minPrice và maxPrice sinh mệnh đề gte/lte trên basePrice', async () => {
    await service.findAll({ minPrice: 100000, maxPrice: 500000 });

    expect(whereOf()).toMatchObject({
      basePrice: { gte: 100000, lte: 500000 },
    });
  });

  it('size và color lọc qua quan hệ variants', async () => {
    await service.findAll({ size: 'M', color: 'Đen' });

    expect(whereOf()).toMatchObject({
      variants: { some: { size: 'M', color: 'Đen' } },
    });
  });

  it('bốn giá trị sort sinh đúng orderBy', async () => {
    const cases: [ProductSort | undefined, Record<string, string>][] = [
      [undefined, { createdAt: 'desc' }],
      [ProductSort.price_asc, { basePrice: 'asc' }],
      [ProductSort.price_desc, { basePrice: 'desc' }],
      [ProductSort.name_asc, { name: 'asc' }],
    ];

    for (const [sort, expected] of cases) {
      productFindMany.mockClear();
      await service.findAll(sort ? { sort } : {});
      const calls = productFindMany.mock.calls as unknown as Array<
        [{ orderBy: unknown }]
      >;
      expect(calls[0][0].orderBy).toEqual(expected);
    }
  });

  it('phân trang: tính skip/take và totalPages khi chia hết', async () => {
    productCount.mockResolvedValue(40);

    const result = await service.findAll({ page: 2, limit: 20 });

    const calls = productFindMany.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    expect(calls[0][0]).toMatchObject({
      skip: 20,
      take: 20,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 40,
      totalPages: 2,
    });
  });

  it('totalPages làm tròn lên khi không chia hết', async () => {
    productCount.mockResolvedValue(41);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.meta.totalPages).toBe(3);
  });

  it('không có sản phẩm nào thì totalPages vẫn là 1', async () => {
    productCount.mockResolvedValue(0);

    const result = await service.findAll({});

    expect(result.meta.totalPages).toBe(1);
    expect(result.data).toEqual([]);
  });
});

describe('ProductsService.findOne', () => {
  const productFindUnique = jest.fn();
  const prisma = {
    product: { findUnique: productFindUnique },
  } as unknown as PrismaService;

  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(prisma);
  });

  it('trả chi tiết kèm variants và images', async () => {
    productFindUnique.mockResolvedValue({
      id: 'p1',
      categoryId: 'c1',
      category: { name: 'Áo thun' },
      name: 'Áo thun basic',
      description: 'Cotton',
      basePrice: { toString: () => '250000' },
      status: 'active',
      createdAt: new Date('2026-01-01'),
      images: [{ id: 'i1', url: 'https://x/1.jpg', sortOrder: 0 }],
      reviews: [],
      variants: [
        {
          id: 'v1',
          productId: 'p1',
          size: 'M',
          color: 'Đen',
          price: { toString: () => '260000' },
          stockQty: 5,
          sku: 'AT-M-DEN',
        },
      ],
    });

    const result = await service.findOne('p1');

    expect(result.id).toBe('p1');
    expect(result.variants[0].price).toBe(260000);
    expect(result.basePrice).toBe(250000);
  });

  it('không tìm thấy thì ném NotFoundException', async () => {
    productFindUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
