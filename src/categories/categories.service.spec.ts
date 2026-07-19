import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  const categoryFindMany = jest.fn();
  const prisma = {
    category: { findMany: categoryFindMany },
  } as unknown as PrismaService;

  let service: CategoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CategoriesService(prisma);
  });

  it('trả flat list kèm parentId', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 'c1', name: 'Áo', parentId: null },
      { id: 'c2', name: 'Áo thun', parentId: 'c1' },
    ]);

    const result = await service.findAll();

    expect(result).toEqual([
      { id: 'c1', name: 'Áo', parentId: null },
      { id: 'c2', name: 'Áo thun', parentId: 'c1' },
    ]);
  });

  it('sắp xếp category cha trước category con', async () => {
    categoryFindMany.mockResolvedValue([]);

    await service.findAll();

    expect(categoryFindMany).toHaveBeenCalledWith({
      orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
      select: { id: true, name: true, parentId: true },
    });
  });

  it('danh sách rỗng trả mảng rỗng, không lỗi', async () => {
    categoryFindMany.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);
  });
});
