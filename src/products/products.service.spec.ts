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
    return productFindMany.mock.calls[0][0].where as Record<string, unknown>;
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
      expect(productFindMany.mock.calls[0][0].orderBy).toEqual(expected);
    }
  });

  it('phân trang: tính skip/take và totalPages khi chia hết', async () => {
    productCount.mockResolvedValue(40);

    const result = await service.findAll({ page: 2, limit: 20 });

    expect(productFindMany.mock.calls[0][0]).toMatchObject({
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
