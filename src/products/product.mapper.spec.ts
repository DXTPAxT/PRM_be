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
