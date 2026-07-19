import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // ── Config + Env Validation (Joi) ─────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        DIRECT_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string()
          .pattern(/^\d+[smhd]$/)
          .default('15m'),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string()
          .pattern(/^\d+[smhd]$/)
          .default('7d'),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        THROTTLE_TTL: Joi.number().default(60000),
        THROTTLE_LIMIT: Joi.number().default(100),
      }),
      validationOptions: { allowUnknown: true },
    }),

    // ── Rate Limiting ─────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000'),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100'),
      },
    ]),

    // ── Infrastructure ────────────────────────────────────────────────────
    PrismaModule,

    // ── Feature Modules ───────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    AddressesModule,
    ProductsModule,
    CategoriesModule,
    ReviewsModule,
    WishlistModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    NotificationsModule,
    VouchersModule,
    AdminModule,
    ReportsModule,
  ],
  providers: [
    // Global rate limiting (để @Throttle() trên auth thực sự có hiệu lực)
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global response envelope
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },

    // Global error handler
    { provide: APP_FILTER, useClass: HttpExceptionFilter },

    // Global JWT guard (dùng @Public() để bypass)
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global role guard (dùng @Roles() để bật)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
