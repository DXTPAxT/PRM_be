# Catalog Backend (Product + Category + Review) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực 10 REST endpoint cho Product, Category và Review của Member 2, thay thế 3 module stub hiện chỉ có `/ping`.

**Architecture:** Ba NestJS module độc lập dùng chung `PrismaService`. `ReviewsModule` export `ReviewsService` để `ProductsController` phục vụ được route `GET /products/:id/reviews` mà không tạo vòng lặp phụ thuộc. Toàn bộ việc chuyển `Decimal` → `number` và tính `avgRating`/`thumbnailUrl` gom vào một file mapper thuần hàm, test được không cần mock DB.

**Tech Stack:** NestJS 11, Prisma 6 (PostgreSQL), class-validator, Jest, Swagger.

**Spec:** `docs/superpowers/specs/2026-07-19-member2-catalog-design.md`

## Global Constraints

- **KHÔNG sửa `prisma/schema.prisma`, KHÔNG tạo migration.** Cả 5 bảng đã đủ field.
- **KHÔNG sửa** `src/auth/`, `src/users/`, `src/addresses/`, `src/common/`, `src/prisma/` — của Member 1 và code chung.
- `src/main.ts` chỉ được sửa đúng 3 dòng `.addTag()` ở Task 8.
- Mọi giá tiền (`basePrice`, `variant.price`) phải qua `Number()` trước khi trả về. Prisma trả `Decimal`, JSON hóa thành **string** → FE crash.
- `JwtAuthGuard` là global. Endpoint public **bắt buộc** gắn `@Public()`. Endpoint admin gắn `@Roles('admin')`.
- Xóa sản phẩm = soft delete (`status='inactive'`). Không bao giờ gọi `prisma.product.delete()`.
- Cập nhật variant = upsert. Không bao giờ gọi `prisma.productVariant.deleteMany()`.
- Tất cả `message` trả về cho client viết bằng tiếng Việt có dấu.
- Test viết theo pattern `src/addresses/addresses.service.spec.ts`: mock object thuần cast sang `PrismaService`, khởi tạo `new Service(prisma)` trực tiếp, **không** dùng `Test.createTestingModule`.

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/categories/categories.service.ts` | Truy vấn flat list category |
| `src/categories/categories.controller.ts` | `GET /categories` |
| `src/products/dto/query-products.dto.ts` | Validate + ép kiểu query param của `GET /products` |
| `src/products/dto/create-product.dto.ts` | Body admin tạo sản phẩm (nested images/variants) |
| `src/products/dto/update-product.dto.ts` | Body admin sửa sản phẩm |
| `src/products/product.mapper.ts` | Decimal→number, thumbnailUrl, avgRating. Hàm thuần. |
| `src/products/products.service.ts` | findAll/findOne/create/update/remove |
| `src/products/products.controller.ts` | 5 route products |
| `src/reviews/dto/create-review.dto.ts` | Body `POST /reviews` |
| `src/reviews/dto/update-review.dto.ts` | Body `PATCH /reviews/:id` |
| `src/reviews/reviews.service.ts` | findByProduct/create/update/remove |
| `src/reviews/reviews.controller.ts` | 3 route reviews |

---

### Task 1: Categories module

**Files:**
- Modify: `src/categories/categories.service.ts`
- Modify: `src/categories/categories.controller.ts`
- Modify: `src/categories/categories.module.ts`
- Test: `src/categories/categories.service.spec.ts` (tạo mới)

**Interfaces:**
- Consumes: `PrismaService` từ `src/prisma/prisma.service.ts`
- Produces: `CategoriesService.findAll(): Promise<{id, name, parentId}[]>`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/categories/categories.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm run test -- categories`
Expected: FAIL — `service.findAll is not a function`

- [ ] **Step 3: Viết service**

Ghi đè `src/categories/categories.service.ts`:

```ts
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
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm run test -- categories`
Expected: PASS — 3 passed

- [ ] **Step 5: Viết controller**

Ghi đè `src/categories/categories.controller.ts`:

```ts
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
```

- [ ] **Step 6: Kiểm tra module đã khai báo đúng**

Đọc `src/categories/categories.module.ts`. Phải có dạng:

```ts
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

Nếu khác thì sửa cho khớp.

- [ ] **Step 7: Build và commit**

```bash
npm run build
git add src/categories
git commit -m "feat(categories): implement GET /categories flat list"
```

---

### Task 2: Product mapper + query DTO

**Files:**
- Create: `src/products/product.mapper.ts`
- Create: `src/products/product.mapper.spec.ts`
- Create: `src/products/dto/query-products.dto.ts`

**Interfaces:**
- Produces:
  - `toProductListItem(row: ProductListRow): ProductListItem`
  - `toProductDetail(row: ProductDetailRow): ProductDetail`
  - `PRODUCT_LIST_SELECT`, `PRODUCT_DETAIL_SELECT` — hằng `select` của Prisma
  - `QueryProductsDto` — `{ categoryId?, search?, minPrice?, maxPrice?, size?, color?, sort?, page?, limit? }`
  - `ProductSort` — enum `newest | price_asc | price_desc | name_asc`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/products/product.mapper.spec.ts`:

```ts
import { toProductDetail, toProductListItem } from './product.mapper';

const baseRow = {
  id: 'p1',
  categoryId: 'c1',
  category: { name: 'Áo thun' },
  name: 'Áo thun basic',
  description: 'Cotton 100%',
  basePrice: { toString: () => '250000' },
  status: 'active',
  createdAt: new Date('2026-01-01'),
  images: [
    { id: 'i2', url: 'https://x/2.jpg', sortOrder: 1 },
    { id: 'i1', url: 'https://x/1.jpg', sortOrder: 0 },
  ],
  reviews: [{ rating: 4 }, { rating: 5 }],
};

describe('product.mapper', () => {
  it('đổi basePrice từ Decimal sang number', () => {
    const result = toProductListItem(baseRow as never);

    expect(result.basePrice).toBe(250000);
    expect(typeof result.basePrice).toBe('number');
  });

  it('lấy thumbnailUrl từ ảnh có sortOrder nhỏ nhất', () => {
    const result = toProductListItem(baseRow as never);

    expect(result.thumbnailUrl).toBe('https://x/1.jpg');
  });

  it('không có ảnh thì thumbnailUrl là null', () => {
    const result = toProductListItem({ ...baseRow, images: [] } as never);

    expect(result.thumbnailUrl).toBeNull();
  });

  it('tính avgRating làm tròn 1 chữ số thập phân', () => {
    const result = toProductListItem({
      ...baseRow,
      reviews: [{ rating: 4 }, { rating: 5 }, { rating: 5 }],
    } as never);

    expect(result.avgRating).toBe(4.7);
    expect(result.reviewCount).toBe(3);
  });

  it('chưa có review thì avgRating và reviewCount đều là 0', () => {
    const result = toProductListItem({ ...baseRow, reviews: [] } as never);

    expect(result.avgRating).toBe(0);
    expect(result.reviewCount).toBe(0);
  });

  it('toProductDetail đổi cả giá của variant sang number', () => {
    const result = toProductDetail({
      ...baseRow,
      variants: [
        {
          id: 'v1',
          productId: 'p1',
          size: 'M',
          color: 'Đen',
          price: { toString: () => '260000' },
          stockQty: 10,
          sku: 'AT-M-DEN',
        },
      ],
    } as never);

    expect(result.variants[0].price).toBe(260000);
    expect(result.description).toBe('Cotton 100%');
    expect(result.images).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm run test -- product.mapper`
Expected: FAIL — `Cannot find module './product.mapper'`

- [ ] **Step 3: Viết mapper**

Tạo `src/products/product.mapper.ts`:

```ts
import { Prisma } from '@prisma/client';

// ── Hằng select dùng chung cho service ────────────────────────────────────
export const PRODUCT_LIST_SELECT = {
  id: true,
  categoryId: true,
  category: { select: { name: true } },
  name: true,
  basePrice: true,
  status: true,
  createdAt: true,
  images: { select: { id: true, url: true, sortOrder: true } },
  reviews: { select: { rating: true } },
} satisfies Prisma.ProductSelect;

export const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_LIST_SELECT,
  description: true,
  variants: {
    select: {
      id: true,
      productId: true,
      size: true,
      color: true,
      price: true,
      stockQty: true,
      sku: true,
    },
    orderBy: [{ size: 'asc' }, { color: 'asc' }],
  },
} satisfies Prisma.ProductSelect;

// ── Shape trả về client ───────────────────────────────────────────────────
export interface ProductImageItem {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ProductVariantItem {
  id: string;
  productId: string;
  size: string;
  color: string;
  price: number;
  stockQty: number;
  sku: string;
}

export interface ProductListItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  basePrice: number;
  status: string;
  thumbnailUrl: string | null;
  avgRating: number;
  reviewCount: number;
  createdAt: Date;
}

export interface ProductDetail extends ProductListItem {
  description: string | null;
  images: ProductImageItem[];
  variants: ProductVariantItem[];
}

// ── Helper ────────────────────────────────────────────────────────────────
/** Prisma trả Decimal — JSON.stringify sẽ ra string nếu không ép kiểu. */
function toNumber(value: unknown): number {
  return Number(String(value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

type MapperRow = {
  id: string;
  categoryId: string;
  category: { name: string } | null;
  name: string;
  basePrice: unknown;
  status: string;
  createdAt: Date;
  images: ProductImageItem[];
  reviews: { rating: number }[];
  description?: string | null;
  variants?: {
    id: string;
    productId: string;
    size: string;
    color: string;
    price: unknown;
    stockQty: number;
    sku: string;
  }[];
};

export function toProductListItem(row: MapperRow): ProductListItem {
  const images = row.images ?? [];
  const reviews = row.reviews ?? [];
  const thumbnail = [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);

  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? '',
    name: row.name,
    basePrice: toNumber(row.basePrice),
    status: row.status,
    thumbnailUrl: thumbnail?.url ?? null,
    avgRating: reviews.length === 0 ? 0 : round1(total / reviews.length),
    reviewCount: reviews.length,
    createdAt: row.createdAt,
  };
}

export function toProductDetail(row: MapperRow): ProductDetail {
  return {
    ...toProductListItem(row),
    description: row.description ?? null,
    images: [...(row.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    variants: (row.variants ?? []).map((v) => ({
      id: v.id,
      productId: v.productId,
      size: v.size,
      color: v.color,
      price: toNumber(v.price),
      stockQty: v.stockQty,
      sku: v.sku,
    })),
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm run test -- product.mapper`
Expected: PASS — 6 passed

- [ ] **Step 5: Viết query DTO**

Tạo `src/products/dto/query-products.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum ProductSort {
  newest = 'newest',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
  name_asc = 'name_asc',
}

export class QueryProductsDto {
  @ApiPropertyOptional({ description: 'Lọc theo danh mục (gồm cả danh mục con)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Tìm trong tên và mô tả sản phẩm' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Giá tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Giá tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Lọc theo size của biến thể' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ description: 'Lọc theo màu của biến thể' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.newest })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
```

- [ ] **Step 6: Build và commit**

```bash
npm run build
git add src/products/product.mapper.ts src/products/product.mapper.spec.ts src/products/dto
git commit -m "feat(products): add product mapper and query DTO"
```

---

### Task 3: `GET /products` — danh sách, lọc, sắp xếp, phân trang

**Files:**
- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.controller.ts`
- Test: `src/products/products.service.spec.ts` (tạo mới)

**Interfaces:**
- Consumes: `PRODUCT_LIST_SELECT`, `toProductListItem`, `QueryProductsDto`, `ProductSort` từ Task 2
- Produces: `ProductsService.findAll(query): Promise<{ data: ProductListItem[]; meta: {...}; message: string }>`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/products/products.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm run test -- products.service`
Expected: FAIL — `service.findAll is not a function`

- [ ] **Step 3: Viết service**

Ghi đè `src/products/products.service.ts`:

```ts
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
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm run test -- products.service`
Expected: PASS — 9 passed

- [ ] **Step 5: Nối controller**

Ghi đè `src/products/products.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { QueryProductsDto } from './dto/query-products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh sách sản phẩm — lọc, tìm kiếm, sắp xếp, phân trang',
  })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }
}
```

- [ ] **Step 6: Kiểm tra thủ công bằng server thật**

```bash
docker compose up -d
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Ở terminal khác:

```bash
curl "http://localhost:3000/api/products?limit=2"
```

Expected: JSON có `"success":true`, `data` là mảng 2 phần tử, và **`basePrice` là số không có dấu nháy** (ví dụ `"basePrice":250000` chứ không phải `"basePrice":"250000"`).

- [ ] **Step 7: Commit**

```bash
git add src/products
git commit -m "feat(products): implement GET /products with filter, sort, pagination"
```

---

### Task 4: `GET /products/:id` — chi tiết sản phẩm

**Files:**
- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.controller.ts`
- Modify: `src/products/products.service.spec.ts`

**Interfaces:**
- Consumes: `PRODUCT_DETAIL_SELECT`, `toProductDetail` từ Task 2
- Produces: `ProductsService.findOne(id): Promise<ProductDetail>` — ném `NotFoundException` nếu không thấy

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `src/products/products.service.spec.ts`:

```ts
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
```

Thêm import ở đầu file:

```ts
import { NotFoundException } from '@nestjs/common';
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm run test -- products.service`
Expected: FAIL — `service.findOne is not a function`

- [ ] **Step 3: Thêm `findOne` vào service**

Thêm import `NotFoundException` vào dòng import `@nestjs/common` của `src/products/products.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
```

Thêm import mapper:

```ts
import {
  PRODUCT_DETAIL_SELECT,
  PRODUCT_LIST_SELECT,
  toProductDetail,
  toProductListItem,
} from './product.mapper';
```

Thêm method vào cuối class `ProductsService`:

```ts
  async findOne(id: string) {
    const row = await this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_DETAIL_SELECT,
    });

    if (!row) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }

    return toProductDetail(row as never);
  }
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm run test -- products.service`
Expected: PASS — 11 passed

- [ ] **Step 5: Nối controller**

Thêm `Param` vào import `@nestjs/common` của `src/products/products.controller.ts`:

```ts
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
```

Thêm route vào cuối class:

```ts
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết sản phẩm kèm biến thể và ảnh' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }
```

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/products
git commit -m "feat(products): implement GET /products/:id detail"
```

---

### Task 5: Reviews — đọc và tạo

**Files:**
- Create: `src/reviews/dto/create-review.dto.ts`
- Modify: `src/reviews/reviews.service.ts`
- Modify: `src/reviews/reviews.controller.ts`
- Modify: `src/reviews/reviews.module.ts`
- Test: `src/reviews/reviews.service.spec.ts` (tạo mới)

**Interfaces:**
- Produces:
  - `ReviewsService.findByProduct(productId, page, limit)` → `{ data, meta }`
  - `ReviewsService.create(userId, dto)` → review vừa tạo
  - `ReviewsModule` **export** `ReviewsService` (Task 6 cần)

- [ ] **Step 1: Viết DTO**

Tạo `src/reviews/dto/create-review.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ description: 'ID sản phẩm được đánh giá' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, description: 'Số sao từ 1 đến 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
```

- [ ] **Step 2: Viết test thất bại**

Tạo `src/reviews/reviews.service.spec.ts`:

```ts
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
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npm run test -- reviews`
Expected: FAIL — `service.findByProduct is not a function`

- [ ] **Step 4: Viết service**

Ghi đè `src/reviews/reviews.service.ts`:

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

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
}
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npm run test -- reviews`
Expected: PASS — 4 passed

- [ ] **Step 6: Viết controller**

Ghi đè `src/reviews/reviews.controller.ts`:

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { SafeUser } from '../users/user.types';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Gửi đánh giá cho một sản phẩm' })
  @ApiResponse({ status: 201, description: 'Gửi đánh giá thành công' })
  @ApiResponse({ status: 409, description: 'Đã đánh giá sản phẩm này rồi' })
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }
}
```

- [ ] **Step 7: Export service khỏi module**

Ghi đè `src/reviews/reviews.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService], // ProductsModule cần cho GET /products/:id/reviews
})
export class ReviewsModule {}
```

- [ ] **Step 8: Commit**

```bash
npm run build
git add src/reviews
git commit -m "feat(reviews): implement POST /reviews and review listing service"
```

---

### Task 6: `GET /products/:id/reviews` + sửa/xóa review của chính mình

**Files:**
- Create: `src/reviews/dto/update-review.dto.ts`
- Modify: `src/reviews/reviews.service.ts`
- Modify: `src/reviews/reviews.controller.ts`
- Modify: `src/products/products.controller.ts`
- Modify: `src/products/products.module.ts`
- Modify: `src/reviews/reviews.service.spec.ts`

**Interfaces:**
- Consumes: `ReviewsService` export từ Task 5
- Produces: `ReviewsService.update(userId, id, dto)`, `ReviewsService.remove(userId, id)` — ném `ForbiddenException` nếu không phải chủ sở hữu

- [ ] **Step 1: Viết DTO**

Tạo `src/reviews/dto/update-review.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
```

- [ ] **Step 2: Viết test thất bại**

Trong `src/reviews/reviews.service.spec.ts`, bổ sung 3 mock vào object `prisma` hiện có:

```ts
  const reviewFindUnique = jest.fn();
  const reviewUpdate = jest.fn();
  const reviewDelete = jest.fn();
```

Và thêm vào nhánh `review:` của `prisma`:

```ts
      findUnique: reviewFindUnique,
      update: reviewUpdate,
      delete: reviewDelete,
```

Thêm vào `beforeEach`:

```ts
    reviewFindUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
    reviewUpdate.mockResolvedValue({ id: 'r1' });
    reviewDelete.mockResolvedValue({ id: 'r1' });
```

Thêm import `ForbiddenException`:

```ts
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
```

Thêm 3 test case vào cuối `describe('ReviewsService', ...)`:

```ts
  it('sửa review của người khác thì ném ForbiddenException', async () => {
    reviewFindUnique.mockResolvedValue({ id: 'r1', userId: 'someone-else' });

    await expect(service.update('u1', 'r1', { rating: 3 })).rejects.toThrow(
      ForbiddenException,
    );
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it('xóa review của người khác thì ném ForbiddenException', async () => {
    reviewFindUnique.mockResolvedValue({ id: 'r1', userId: 'someone-else' });

    await expect(service.remove('u1', 'r1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(reviewDelete).not.toHaveBeenCalled();
  });

  it('sửa review không tồn tại thì ném NotFoundException', async () => {
    reviewFindUnique.mockResolvedValue(null);

    await expect(service.update('u1', 'missing', { rating: 3 })).rejects.toThrow(
      NotFoundException,
    );
  });
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npm run test -- reviews`
Expected: FAIL — `service.update is not a function`

- [ ] **Step 4: Thêm update/remove vào service**

Thêm `ForbiddenException` vào import `@nestjs/common` của `src/reviews/reviews.service.ts`:

```ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

Thêm import DTO:

```ts
import { UpdateReviewDto } from './dto/update-review.dto';
```

Thêm vào cuối class `ReviewsService`:

```ts
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
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npm run test -- reviews`
Expected: PASS — 7 passed

- [ ] **Step 6: Thêm route vào ReviewsController**

Sửa import đầu `src/reviews/reviews.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
```

Thêm import DTO:

```ts
import { UpdateReviewDto } from './dto/update-review.dto';
```

Thêm 2 route vào cuối class:

```ts
  @Patch(':id')
  @ApiOperation({ summary: 'Sửa đánh giá của chính mình' })
  @ApiResponse({ status: 403, description: 'Không phải đánh giá của bạn' })
  update(
    @CurrentUser() user: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa đánh giá của chính mình' })
  remove(@CurrentUser() user: SafeUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.remove(user.id, id);
  }
```

- [ ] **Step 7: Nối `GET /products/:id/reviews`**

Ghi đè `src/products/products.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [ReviewsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

Trong `src/products/products.controller.ts`, thêm import:

```ts
import { ReviewsService } from '../reviews/reviews.service';
```

Sửa constructor thành:

```ts
  constructor(
    private readonly productsService: ProductsService,
    private readonly reviewsService: ReviewsService,
  ) {}
```

Thêm route **NGAY TRƯỚC** route `@Get(':id')` (Nest khớp route theo thứ tự khai báo — đặt sau sẽ bị `:id` nuốt mất):

```ts
  @Public()
  @Get(':id/reviews')
  @ApiOperation({ summary: 'Danh sách đánh giá của một sản phẩm' })
  findReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.findByProduct(id, Number(page) || 1, Number(limit) || 10);
  }
```

- [ ] **Step 8: Kiểm tra thủ công**

Khởi động lại `npm run start:dev`, rồi:

```bash
curl "http://localhost:3000/api/products/<PRODUCT_ID>/reviews"
```

Lấy `<PRODUCT_ID>` từ `curl "http://localhost:3000/api/products?limit=1"`.
Expected: `{"success":true,"data":[],"message":"Lấy đánh giá thành công.","meta":{...}}`

- [ ] **Step 9: Commit**

```bash
npm run build
git add src/reviews src/products
git commit -m "feat(reviews): add PATCH/DELETE own review and GET /products/:id/reviews"
```

---

### Task 7: Admin CRUD sản phẩm

**Files:**
- Create: `src/products/dto/create-product.dto.ts`
- Create: `src/products/dto/update-product.dto.ts`
- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.controller.ts`
- Modify: `src/products/products.service.spec.ts`

**Interfaces:**
- Produces: `ProductsService.create(dto)`, `ProductsService.update(id, dto)`, `ProductsService.remove(id)`

- [ ] **Step 1: Viết DTO**

Tạo `src/products/dto/create-product.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class ProductImageDto {
  @ApiProperty()
  @IsString()
  url!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ProductVariantDto {
  @ApiProperty({ example: 'M' })
  @IsString()
  @MaxLength(20)
  size!: string;

  @ApiProperty({ example: 'Đen' })
  @IsString()
  @MaxLength(50)
  color!: string;

  @ApiProperty({ example: 260000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  stockQty!: number;

  @ApiProperty({ example: 'AT-M-DEN' })
  @IsString()
  @MaxLength(50)
  sku!: string;
}

export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.active })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @ApiProperty({ type: [ProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants!: ProductVariantDto[];
}
```

Tạo `src/products/dto/update-product.dto.ts`:

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * Mọi field đều optional.
 * Lưu ý: variants được UPSERT chứ không replace-all —
 * CartItem/OrderItem tham chiếu ProductVariant không cascade,
 * xóa variant đang nằm trong giỏ/đơn sẽ lỗi khóa ngoại.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

- [ ] **Step 2: Viết test thất bại**

Thêm vào cuối `src/products/products.service.spec.ts`:

```ts
describe('ProductsService — admin CRUD', () => {
  const productUpdate = jest.fn();
  const productFindUnique = jest.fn();
  const imageDeleteMany = jest.fn();
  const imageCreateMany = jest.fn();
  const variantUpsert = jest.fn();
  const variantDeleteMany = jest.fn();

  const tx = {
    product: { update: productUpdate, findUnique: productFindUnique },
    productImage: { deleteMany: imageDeleteMany, createMany: imageCreateMany },
    productVariant: { upsert: variantUpsert, deleteMany: variantDeleteMany },
  };

  const prisma = {
    product: { update: productUpdate, findUnique: productFindUnique },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    ),
  } as unknown as PrismaService;

  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(prisma);
    productFindUnique.mockResolvedValue({
      id: 'p1',
      categoryId: 'c1',
      category: { name: 'Áo' },
      name: 'Áo',
      description: null,
      basePrice: { toString: () => '250000' },
      status: 'active',
      createdAt: new Date('2026-01-01'),
      images: [],
      reviews: [],
      variants: [],
    });
    productUpdate.mockResolvedValue({ id: 'p1' });
  });

  it('remove chỉ đổi status thành inactive, không xóa cứng', async () => {
    await service.remove('p1');

    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { status: 'inactive' },
      }),
    );
  });

  it('update upsert variant và KHÔNG xóa variant cũ', async () => {
    await service.update('p1', {
      variants: [
        { size: 'M', color: 'Đen', price: 260000, stockQty: 5, sku: 'A-M-D' },
      ],
    });

    expect(variantUpsert).toHaveBeenCalledWith({
      where: {
        productId_size_color: { productId: 'p1', size: 'M', color: 'Đen' },
      },
      create: {
        productId: 'p1',
        size: 'M',
        color: 'Đen',
        price: 260000,
        stockQty: 5,
        sku: 'A-M-D',
      },
      update: { price: 260000, stockQty: 5, sku: 'A-M-D' },
    });
    expect(variantDeleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npm run test -- products.service`
Expected: FAIL — `service.remove is not a function`

- [ ] **Step 4: Thêm CRUD vào service**

Thêm import DTO vào `src/products/products.service.ts`:

```ts
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
```

Thêm vào cuối class `ProductsService`:

```ts
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
      data: toProductDetail(product as never),
      message: 'Tạo sản phẩm thành công.',
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id); // ném NotFoundException nếu không tồn tại

    const detail = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
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
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npm run test -- products.service`
Expected: PASS — 13 passed

- [ ] **Step 6: Thêm route admin vào controller**

Sửa import đầu `src/products/products.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
```

Thêm 3 route vào cuối class:

```ts
  @Roles('admin')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '[Admin] Tạo sản phẩm mới kèm ảnh và biến thể' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({
    summary: '[Admin] Cập nhật sản phẩm (biến thể được upsert, không xóa)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Ngừng bán sản phẩm (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
```

- [ ] **Step 7: Commit**

```bash
npm run build
git add src/products
git commit -m "feat(products): add admin CRUD with variant upsert and soft delete"
```

---

### Task 8: Swagger + kiểm tra tổng thể

**Files:**
- Modify: `src/main.ts:40-42`

- [ ] **Step 1: Sửa mô tả Swagger**

Trong `src/main.ts`, thay 3 dòng:

```ts
    .addTag('products', 'Sản phẩm — M2 implement')
    .addTag('categories', 'Danh mục — M2 implement')
    .addTag('reviews', 'Đánh giá sản phẩm — M2 implement')
```

thành:

```ts
    .addTag('products', 'Sản phẩm: danh sách, lọc, tìm kiếm, chi tiết, CRUD admin')
    .addTag('categories', 'Danh mục sản phẩm (cây 2 cấp)')
    .addTag('reviews', 'Đánh giá sản phẩm')
```

- [ ] **Step 2: Chạy toàn bộ test**

Run: `npm run test`
Expected: PASS, không có suite nào fail. **29 case mới** của Task 1-7 đều xanh, phân bổ:

| File | Số case |
|---|---|
| `categories.service.spec.ts` | 3 |
| `product.mapper.spec.ts` | 6 |
| `products.service.spec.ts` | 13 |
| `reviews.service.spec.ts` | 7 |

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: không có lỗi TypeScript.

- [ ] **Step 4: Kiểm tra bằng Swagger**

```bash
npm run start:dev
```

Mở `http://localhost:3000/api/docs`. Xác nhận đủ 10 endpoint:

| # | Endpoint |
|---|---|
| 1 | `GET /api/categories` |
| 2 | `GET /api/products` |
| 3 | `GET /api/products/{id}` |
| 4 | `GET /api/products/{id}/reviews` |
| 5 | `POST /api/products` 🔒 |
| 6 | `PUT /api/products/{id}` 🔒 |
| 7 | `DELETE /api/products/{id}` 🔒 |
| 8 | `POST /api/reviews` 🔒 |
| 9 | `PATCH /api/reviews/{id}` 🔒 |
| 10 | `DELETE /api/reviews/{id}` 🔒 |

- [ ] **Step 5: Kiểm tra 5 tiêu chí nghiệm thu**

```bash
# 1. basePrice là number, KHÔNG phải string
curl -s "http://localhost:3000/api/products?limit=1" | grep -o '"basePrice":[^,]*'
# Expected: "basePrice":250000   (KHÔNG có dấu nháy quanh số)

# 2. Lọc theo giá hoạt động
curl -s "http://localhost:3000/api/products?minPrice=200000&maxPrice=400000"

# 3. Tìm kiếm không phân biệt hoa thường
curl -s "http://localhost:3000/api/products?search=ÁO"

# 4. Sắp xếp theo giá tăng dần
curl -s "http://localhost:3000/api/products?sort=price_asc"

# 5. Chi tiết có variants
curl -s "http://localhost:3000/api/products/<PRODUCT_ID>" | grep -o '"variants"'
```

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "docs(swagger): update M2 tag descriptions"
```

---

## Nghiệm thu cuối

- [ ] `npm run test` xanh toàn bộ, 29 case mới đều pass
- [ ] `npm run build` không lỗi
- [ ] Swagger hiển thị đủ 10 endpoint
- [ ] `basePrice` và `variant.price` trả về kiểu **number**
- [ ] `DELETE /api/products/:id` bằng token admin → sản phẩm biến mất khỏi `GET /products` nhưng vẫn còn trong DB (kiểm tra bằng `npx prisma studio`)
- [ ] `prisma/schema.prisma` **không thay đổi** (`git diff prisma/` rỗng)
- [ ] Báo nhóm: API đã sẵn sàng cho M3 (Cart cần `GET /products/:id` để lấy variant) và M4 (admin CRUD)
