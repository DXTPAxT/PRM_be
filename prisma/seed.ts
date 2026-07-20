/**
 * prisma/seed.ts — Dữ liệu test cho cả nhóm
 * Chạy: npx prisma db seed
 *
 * Tạo:
 *   - 1 admin  (admin@clothing.dev / Admin@123456)
 *   - 2 customer (customer1@clothing.dev, customer2@clothing.dev)
 *   - Categories: Áo (parent) → Áo Thun, Áo Sơ Mi; Quần (parent) → Quần Jeans, Quần Short
 *   - 4 sản phẩm mẫu với variants (size S/M/L × 2 màu) và images
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * UUID cố định cho dữ liệu seed.
 *
 * Bắt buộc phải là UUID hợp lệ: các endpoint chi tiết dùng `ParseUUIDPipe`
 * (vd `GET /products/:id`), nên id dạng slug ("prod-ao-thun-basic") sẽ bị
 * chặn ở tầng validation với lỗi "Validation failed (uuid is expected)".
 *
 * Hardcode thay vì random để seed idempotent — chạy lại không tạo bản ghi trùng.
 */
const ID = {
  catAo: '11111111-1111-4111-8111-000000000001',
  catQuan: '11111111-1111-4111-8111-000000000002',
  catAoThun: '11111111-1111-4111-8111-000000000003',
  catAoSoMi: '11111111-1111-4111-8111-000000000004',
  catQuanJeans: '11111111-1111-4111-8111-000000000005',
  catQuanShort: '11111111-1111-4111-8111-000000000006',
  prodAoThun: '22222222-2222-4222-8222-000000000001',
  prodAoSoMi: '22222222-2222-4222-8222-000000000002',
  prodQuanJeans: '22222222-2222-4222-8222-000000000003',
  prodQuanShort: '22222222-2222-4222-8222-000000000004',
} as const;

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────
  const adminPw = await bcrypt.hash('Admin@123456', 12);
  const customerPw = await bcrypt.hash('Customer@123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@clothing.dev' },
    update: {},
    create: {
      fullName: 'Admin',
      email: 'admin@clothing.dev',
      passwordHash: adminPw,
      role: 'admin',
    },
  });

  const customer1 = await prisma.user.upsert({
    where: { email: 'customer1@clothing.dev' },
    update: {},
    create: {
      fullName: 'Nguyễn Văn A',
      email: 'customer1@clothing.dev',
      passwordHash: customerPw,
      role: 'customer',
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'customer2@clothing.dev' },
    update: {},
    create: {
      fullName: 'Trần Thị B',
      email: 'customer2@clothing.dev',
      passwordHash: customerPw,
      role: 'customer',
    },
  });

  console.log(`✅ Users: admin(${admin.id}), c1(${customer1.id}), c2(${customer2.id})`);

  // ── Categories ─────────────────────────────────────────────────────────
  const catAo = await prisma.category.upsert({
    where: { id: ID.catAo },
    update: { name: 'Áo' },
    create: { id: ID.catAo, name: 'Áo' },
  });

  const catQuan = await prisma.category.upsert({
    where: { id: ID.catQuan },
    update: { name: 'Quần' },
    create: { id: ID.catQuan, name: 'Quần' },
  });

  const catAoThun = await prisma.category.upsert({
    where: { id: ID.catAoThun },
    update: { name: 'Áo Thun' },
    create: { id: ID.catAoThun, name: 'Áo Thun', parentId: catAo.id },
  });

  const catAoSoMi = await prisma.category.upsert({
    where: { id: ID.catAoSoMi },
    update: { name: 'Áo Sơ Mi' },
    create: { id: ID.catAoSoMi, name: 'Áo Sơ Mi', parentId: catAo.id },
  });

  const catQuanJeans = await prisma.category.upsert({
    where: { id: ID.catQuanJeans },
    update: { name: 'Quần Jeans' },
    create: { id: ID.catQuanJeans, name: 'Quần Jeans', parentId: catQuan.id },
  });

  const catQuanShort = await prisma.category.upsert({
    where: { id: ID.catQuanShort },
    update: { name: 'Quần Short' },
    create: { id: ID.catQuanShort, name: 'Quần Short', parentId: catQuan.id },
  });

  console.log(`✅ Categories: Áo, Quần và 4 danh mục con`);

  // ── Products + Variants ────────────────────────────────────────────────

  async function seedProduct(opts: {
    id: string;
    name: string;
    description: string;
    basePrice: number;
    categoryId: string;
    imageUrl: string;
    variants: { size: string; color: string; price: number; sku: string; stock: number }[];
  }) {
    const product = await prisma.product.upsert({
      where: { id: opts.id },
      update: { name: opts.name, basePrice: opts.basePrice },
      create: {
        id: opts.id,
        name: opts.name,
        description: opts.description,
        basePrice: opts.basePrice,
        categoryId: opts.categoryId,
        images: {
          create: [{ url: opts.imageUrl, sortOrder: 0 }],
        },
      },
    });

    for (const v of opts.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: { price: v.price, stockQty: v.stock },
        create: {
          productId: product.id,
          size: v.size,
          color: v.color,
          price: v.price,
          stockQty: v.stock,
          sku: v.sku,
        },
      });
    }

    return product;
  }

  await seedProduct({
    id: ID.prodAoThun,
    name: 'Áo Thun Basic Unisex',
    description: 'Áo thun cotton 100%, form regular fit, phù hợp mọi dịp',
    basePrice: 199000,
    categoryId: catAoThun.id,
    imageUrl: 'https://placehold.co/600x800?text=Ao+Thun+Basic',
    variants: [
      { size: 'S', color: 'Trắng', price: 199000, sku: 'AT-BASIC-S-TRANG', stock: 50 },
      { size: 'M', color: 'Trắng', price: 199000, sku: 'AT-BASIC-M-TRANG', stock: 80 },
      { size: 'L', color: 'Trắng', price: 199000, sku: 'AT-BASIC-L-TRANG', stock: 60 },
      { size: 'S', color: 'Đen', price: 199000, sku: 'AT-BASIC-S-DEN', stock: 45 },
      { size: 'M', color: 'Đen', price: 199000, sku: 'AT-BASIC-M-DEN', stock: 75 },
      { size: 'L', color: 'Đen', price: 199000, sku: 'AT-BASIC-L-DEN', stock: 55 },
    ],
  });

  await seedProduct({
    id: ID.prodAoSoMi,
    name: 'Áo Sơ Mi Oxford Slim Fit',
    description: 'Vải Oxford cao cấp, form slim fit, phù hợp đi làm và dạo phố',
    basePrice: 450000,
    categoryId: catAoSoMi.id,
    imageUrl: 'https://placehold.co/600x800?text=Ao+So+Mi+Oxford',
    variants: [
      { size: 'S', color: 'Xanh Dương', price: 450000, sku: 'ASM-OXF-S-XDUONG', stock: 30 },
      { size: 'M', color: 'Xanh Dương', price: 450000, sku: 'ASM-OXF-M-XDUONG', stock: 50 },
      { size: 'L', color: 'Xanh Dương', price: 450000, sku: 'ASM-OXF-L-XDUONG', stock: 40 },
      { size: 'S', color: 'Trắng', price: 450000, sku: 'ASM-OXF-S-TRANG', stock: 35 },
      { size: 'M', color: 'Trắng', price: 450000, sku: 'ASM-OXF-M-TRANG', stock: 55 },
      { size: 'L', color: 'Trắng', price: 450000, sku: 'ASM-OXF-L-TRANG', stock: 45 },
    ],
  });

  await seedProduct({
    id: ID.prodQuanJeans,
    name: 'Quần Jeans Slim Fit Nam',
    description: 'Denim co giãn 4 chiều, form slim fit tôn dáng',
    basePrice: 650000,
    categoryId: catQuanJeans.id,
    imageUrl: 'https://placehold.co/600x800?text=Quan+Jeans+Slim',
    variants: [
      { size: '28', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-28-XDAM', stock: 25 },
      { size: '29', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-29-XDAM', stock: 30 },
      { size: '30', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-30-XDAM', stock: 40 },
      { size: '31', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-31-XDAM', stock: 35 },
      { size: '30', color: 'Xanh Nhạt', price: 650000, sku: 'QJ-SLIM-30-XNHAT', stock: 30 },
      { size: '31', color: 'Xanh Nhạt', price: 650000, sku: 'QJ-SLIM-31-XNHAT', stock: 28 },
    ],
  });

  await seedProduct({
    id: ID.prodQuanShort,
    name: 'Quần Short Kaki Nam',
    description: 'Chất liệu kaki cao cấp, mềm mại, thoáng mát mùa hè',
    basePrice: 350000,
    categoryId: catQuanShort.id,
    imageUrl: 'https://placehold.co/600x800?text=Quan+Short+Kaki',
    variants: [
      { size: 'M', color: 'Be', price: 350000, sku: 'QS-KAKI-M-BE', stock: 40 },
      { size: 'L', color: 'Be', price: 350000, sku: 'QS-KAKI-L-BE', stock: 50 },
      { size: 'XL', color: 'Be', price: 350000, sku: 'QS-KAKI-XL-BE', stock: 30 },
      { size: 'M', color: 'Xanh Rêu', price: 350000, sku: 'QS-KAKI-M-XREU', stock: 35 },
      { size: 'L', color: 'Xanh Rêu', price: 350000, sku: 'QS-KAKI-L-XREU', stock: 45 },
      { size: 'XL', color: 'Xanh Rêu', price: 350000, sku: 'QS-KAKI-XL-XREU', stock: 25 },
    ],
  });

  console.log(`✅ Products: 4 sản phẩm với variants`);

  // ── Voucher mẫu ────────────────────────────────────────────────────────
  await prisma.voucher.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      discount: 50000,
      minOrder: 300000,
      usageLimit: 100,
      isActive: true,
    },
  });

  await prisma.voucher.upsert({
    where: { code: 'SALE20' },
    update: {},
    create: {
      code: 'SALE20',
      discount: 100000,
      minOrder: 500000,
      usageLimit: 50,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
    },
  });

  console.log(`✅ Vouchers: WELCOME10, SALE20`);

  console.log('\n🎉 Seed hoàn tất!');
  console.log('─────────────────────────────────────────');
  console.log('Tài khoản test:');
  console.log('  Admin    : admin@clothing.dev     / Admin@123456');
  console.log('  Customer1: customer1@clothing.dev / Customer@123456');
  console.log('  Customer2: customer2@clothing.dev / Customer@123456');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
