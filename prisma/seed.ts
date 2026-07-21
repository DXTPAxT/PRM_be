/**
 * prisma/seed.ts — Dữ liệu test cho cả nhóm
 * Chạy: npx prisma db seed
 *
 * Tạo:
 *   - 1 admin  (admin@clothing.dev / Admin@123456)
 *   - 2 customer (customer1@clothing.dev, customer2@clothing.dev)
 *   - Categories: Áo (parent) → Áo Thun, Áo Sơ Mi; Quần (parent) → Quần Jeans, Quần Short
 *   - 6 sản phẩm với hình ảnh Unsplash chuẩn xác cho từng mặt hàng & variants UUID chuẩn
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * UUID cố định cho dữ liệu seed.
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
  prodAoPolo: '22222222-2222-4222-8222-000000000005',
  prodAoKhoac: '22222222-2222-4222-8222-000000000006',
} as const;

async function main() {
  console.log('🌱 Seeding database với ảnh thời trang chuẩn xác & dọn dẹp ID rác...');

  // ── 0. Dọn dẹp dữ liệu rác cũ có ID dạng slug không phải UUID ─────────────
  console.log('🧹 Đang dọn dẹp các sản phẩm rác cũ trong Database...');
  await prisma.review.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const adminPw = await bcrypt.hash('Admin@123456', 12);
  const customerPw = await bcrypt.hash('Customer@123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@clothing.dev' },
    update: {
      passwordHash: adminPw,
      role: 'admin',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      fullName: 'Admin',
      email: 'admin@clothing.dev',
      passwordHash: adminPw,
      role: 'admin',
      isActive: true,
    },
  });

  const customer1 = await prisma.user.upsert({
    where: { email: 'customer1@clothing.dev' },
    update: {
      passwordHash: customerPw,
      role: 'customer',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      fullName: 'Nguyễn Văn A',
      email: 'customer1@clothing.dev',
      passwordHash: customerPw,
      role: 'customer',
      isActive: true,
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'customer2@clothing.dev' },
    update: {
      passwordHash: customerPw,
      role: 'customer',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      fullName: 'Trần Thị B',
      email: 'customer2@clothing.dev',
      passwordHash: customerPw,
      role: 'customer',
      isActive: true,
    },
  });

  console.log(`✅ Users: admin(${admin.id}), c1(${customer1.id}), c2(${customer2.id})`);

  // ── 2. Categories ─────────────────────────────────────────────────────────
  const catAo = await prisma.category.create({
    data: { id: ID.catAo, name: 'Áo' },
  });

  const catQuan = await prisma.category.create({
    data: { id: ID.catQuan, name: 'Quần' },
  });

  const catAoThun = await prisma.category.create({
    data: { id: ID.catAoThun, name: 'Áo Thun', parentId: catAo.id },
  });

  const catAoSoMi = await prisma.category.create({
    data: { id: ID.catAoSoMi, name: 'Áo Sơ Mi', parentId: catAo.id },
  });

  const catQuanJeans = await prisma.category.create({
    data: { id: ID.catQuanJeans, name: 'Quần Jeans', parentId: catQuan.id },
  });

  const catQuanShort = await prisma.category.create({
    data: { id: ID.catQuanShort, name: 'Quần Short', parentId: catQuan.id },
  });

  console.log(`✅ Categories: Áo, Quần và 4 danh mục con`);

  // ── Helper Seed Product ─────────────────────────────────────────────────

  async function seedProduct(opts: {
    id: string;
    name: string;
    description: string;
    basePrice: number;
    categoryId: string;
    images: string[];
    variants: { size: string; color: string; price: number; sku: string; stock: number }[];
  }) {
    const product = await prisma.product.create({
      data: {
        id: opts.id,
        name: opts.name,
        description: opts.description,
        basePrice: opts.basePrice,
        categoryId: opts.categoryId,
      },
    });

    for (let i = 0; i < opts.images.length; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: opts.images[i],
          sortOrder: i,
        },
      });
    }

    for (const v of opts.variants) {
      await prisma.productVariant.create({
        data: {
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

  // ── 3. Seed Products ───────────────────────────────────────────────────────

  // 1. Áo Thun Basic Unisex
  await seedProduct({
    id: ID.prodAoThun,
    name: 'Áo Thun Basic Unisex Cotton 100%',
    description: 'Áo thun cotton 100% thoáng mát, form regular fit chuẩn Hàn Quốc, phù hợp mọi dịp đi chơi, đi học.',
    basePrice: 199000,
    categoryId: catAoThun.id,
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [
      { size: 'S', color: 'Trắng', price: 199000, sku: 'AT-BASIC-S-TRANG', stock: 50 },
      { size: 'M', color: 'Trắng', price: 199000, sku: 'AT-BASIC-M-TRANG', stock: 80 },
      { size: 'L', color: 'Trắng', price: 199000, sku: 'AT-BASIC-L-TRANG', stock: 60 },
      { size: 'S', color: 'Đen', price: 199000, sku: 'AT-BASIC-S-DEN', stock: 45 },
      { size: 'M', color: 'Đen', price: 199000, sku: 'AT-BASIC-M-DEN', stock: 75 },
      { size: 'L', color: 'Đen', price: 199000, sku: 'AT-BASIC-L-DEN', stock: 55 },
    ],
  });

  // 2. Áo Sơ Mi Oxford
  await seedProduct({
    id: ID.prodAoSoMi,
    name: 'Áo Sơ Mi Oxford Slim Fit Premium',
    description: 'Vải Oxford dệt dày dặn, đứng dáng, thiết kế cổ bẻ cổ điển phù hợp phong cách công sở lẫn casual.',
    basePrice: 450000,
    categoryId: catAoSoMi.id,
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [
      { size: 'S', color: 'Xanh Dương', price: 450000, sku: 'ASM-OXF-S-XDUONG', stock: 30 },
      { size: 'M', color: 'Xanh Dương', price: 450000, sku: 'ASM-OXF-M-XDUONG', stock: 50 },
      { size: 'L', color: 'Xanh Dương', price: 450000, sku: 'ASM-OXF-L-XDUONG', stock: 40 },
      { size: 'S', color: 'Trắng', price: 450000, sku: 'ASM-OXF-S-TRANG', stock: 35 },
      { size: 'M', color: 'Trắng', price: 450000, sku: 'ASM-OXF-M-TRANG', stock: 55 },
      { size: 'L', color: 'Trắng', price: 450000, sku: 'ASM-OXF-L-TRANG', stock: 45 },
    ],
  });

  // 3. Quần Jeans Slim Fit
  await seedProduct({
    id: ID.prodQuanJeans,
    name: 'Quần Jeans Slim Fit Nam Co Giãn',
    description: 'Chất liệu Denim cotton co giãn 4 chiều mềm mại, bền màu, đường may chắc chắn tôn dáng nam tính.',
    basePrice: 650000,
    categoryId: catQuanJeans.id,
    images: [
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [
      { size: '28', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-28-XDAM', stock: 25 },
      { size: '29', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-29-XDAM', stock: 30 },
      { size: '30', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-30-XDAM', stock: 40 },
      { size: '31', color: 'Xanh Đậm', price: 650000, sku: 'QJ-SLIM-31-XDAM', stock: 35 },
      { size: '30', color: 'Xanh Nhạt', price: 650000, sku: 'QJ-SLIM-30-XNHAT', stock: 30 },
      { size: '31', color: 'Xanh Nhạt', price: 650000, sku: 'QJ-SLIM-31-XNHAT', stock: 28 },
    ],
  });

  // 4. Quần Short Kaki
  await seedProduct({
    id: ID.prodQuanShort,
    name: 'Quần Short Kaki Nam Thời Trang Mùa Hè',
    description: 'Chất liệu kaki cao cấp thoáng mát, thấm hút mồ hôi tốt, độ dài ngang gối năng động.',
    basePrice: 350000,
    categoryId: catQuanShort.id,
    images: [
      'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [
      { size: 'M', color: 'Be', price: 350000, sku: 'QS-KAKI-M-BE', stock: 40 },
      { size: 'L', color: 'Be', price: 350000, sku: 'QS-KAKI-L-BE', stock: 50 },
      { size: 'XL', color: 'Be', price: 350000, sku: 'QS-KAKI-XL-BE', stock: 30 },
      { size: 'M', color: 'Xanh Rêu', price: 350000, sku: 'QS-KAKI-M-XREU', stock: 35 },
      { size: 'L', color: 'Xanh Rêu', price: 350000, sku: 'QS-KAKI-L-XREU', stock: 45 },
      { size: 'XL', color: 'Xanh Rêu', price: 350000, sku: 'QS-KAKI-XL-XREU', stock: 25 },
    ],
  });

  // 5. Áo Polo Nam
  await seedProduct({
    id: ID.prodAoPolo,
    name: 'Áo Polo Nam Cotton Pique Thể Thao',
    description: 'Vải dệt mắt chim (pique) thấm hút vượt trội, bo cổ dệt sang trọng, thích hợp đi làm lẫn chơi thể thao.',
    basePrice: 299000,
    categoryId: catAoThun.id,
    images: [
      'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [
      { size: 'M', color: 'Xanh Nho', price: 299000, sku: 'AP-PIQUE-M-XNHO', stock: 40 },
      { size: 'L', color: 'Xanh Nho', price: 299000, sku: 'AP-PIQUE-L-XNHO', stock: 60 },
      { size: 'XL', color: 'Xanh Nho', price: 299000, sku: 'AP-PIQUE-XL-XNHO', stock: 35 },
      { size: 'M', color: 'Trắng', price: 299000, sku: 'AP-PIQUE-M-TRANG', stock: 50 },
      { size: 'L', color: 'Trắng', price: 299000, sku: 'AP-PIQUE-L-TRANG', stock: 70 },
    ],
  });

  // 6. Áo Khoác Denim Jacket
  await seedProduct({
    id: ID.prodAoKhoac,
    name: 'Áo Khoác Denim Jacket Vintage',
    description: 'Phong cách khoác Jean chất đường phố bụi bặm, chất vải bò dày dặn dệt chéo cao cấp.',
    basePrice: 790000,
    categoryId: catAo.id,
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&auto=format&fit=crop&q=80',
    ],
    variants: [
      { size: 'M', color: 'Xanh Indigo', price: 790000, sku: 'AK-DENIM-M-INDIGO', stock: 20 },
      { size: 'L', color: 'Xanh Indigo', price: 790000, sku: 'AK-DENIM-L-INDIGO', stock: 30 },
      { size: 'XL', color: 'Xanh Indigo', price: 790000, sku: 'AK-DENIM-XL-INDIGO', stock: 15 },
    ],
  });

  console.log(`✅ Products: 6 sản phẩm đã sạch dữ liệu rác & chuẩn UUID 100%`);

  // ── 4. Voucher mẫu ────────────────────────────────────────────────────────
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

  // ── 5. Notifications mẫu ─────────────────────────────────────────────────
  await prisma.notification.deleteMany({});
  await prisma.notification.createMany({
    data: [
      {
        userId: customer1.id,
        title: 'Chào mừng bạn đến PRM Shop!',
        body: 'Cảm ơn bạn đã đăng ký tài khoản. Khám phá ngay các sản phẩm thời trang mới nhất!',
      },
      {
        userId: customer1.id,
        title: 'Ưu đãi đặc biệt',
        body: 'Sử dụng mã WELCOME10 để được giảm 50.000đ cho đơn hàng đầu tiên!',
        data: { voucherCode: 'WELCOME10' },
      },
      {
        userId: customer2.id,
        title: 'Chào mừng bạn đến PRM Shop!',
        body: 'Cảm ơn bạn đã đăng ký tài khoản. Hãy bắt đầu mua sắm ngay!',
      },
    ],
  });
  console.log(`✅ Notifications: 3 thông báo mẫu`);

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
