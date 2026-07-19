import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Global prefix ──────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── CORS ───────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Validation Pipe ────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // throw on unknown fields
      transform: true, // auto-transform to DTO types
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Swagger (/api/docs) ───────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Clothing Store API')
    .setDescription(
      'Backend API cho ứng dụng bán quần áo. ' +
        'Dùng Bearer token từ /api/auth/login để test các endpoint protected.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Đăng ký, đăng nhập, refresh token')
    .addTag('users', 'Profile và địa chỉ người dùng')
    .addTag(
      'products',
      'Sản phẩm: danh sách, lọc, tìm kiếm, chi tiết, CRUD admin',
    )
    .addTag('categories', 'Danh mục sản phẩm (cây 2 cấp)')
    .addTag('reviews', 'Đánh giá sản phẩm')
    .addTag('wishlist', 'Danh sách yêu thích — M1 implement')
    .addTag('cart', 'Giỏ hàng — M3 implement')
    .addTag('orders', 'Đơn hàng — M3 implement')
    .addTag('payments', 'Thanh toán — M3 implement')
    .addTag('vouchers', 'Mã giảm giá — M4 implement')
    .addTag('notifications', 'Thông báo — M1 implement')
    .addTag('admin', 'Quản trị (admin only) — M4 implement')
    .addTag('reports', 'Báo cáo (admin only) — M4 implement')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Đặt tại /api/docs để khớp với global prefix /api
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n🚀 Server running at: http://localhost:${port}/api`);
  console.log(`📖 Swagger docs  at: http://localhost:${port}/api/docs\n`);
}

bootstrap().catch((err) => {
  console.error('Error bootstrapping NestJS application:', err);
});
