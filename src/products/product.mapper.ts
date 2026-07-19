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
