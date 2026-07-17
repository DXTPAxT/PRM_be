# Clothing Store Backend API

NestJS 10 + PostgreSQL 16 + Prisma + Redis — Backend cho ứng dụng bán quần áo.

## Yêu cầu môi trường

- Node 20 LTS
- Docker Desktop (cho Postgres + Redis local)
- npm 10+

## Bắt đầu nhanh

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd BE
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Mở .env và điền các giá trị (đặc biệt là JWT_SECRET và JWT_REFRESH_SECRET — min 32 chars)
```

### 3. Khởi động DB + Redis

```bash
docker compose up -d
# Postgres chạy tại localhost:5432
# Redis chạy tại localhost:6379
```

### 4. Migrate database

```bash
npx prisma migrate dev --name init
# Prisma generate tự động chạy sau migrate
```

### 5. Seed dữ liệu test

```bash
npx prisma db seed
```

Tài khoản được tạo:

| Role     | Email                      | Password        |
|----------|----------------------------|-----------------|
| admin    | admin@clothing.dev         | Admin@123456    |
| customer | customer1@clothing.dev     | Customer@123456 |
| customer | customer2@clothing.dev     | Customer@123456 |

### 6. Chạy server

```bash
npm run start:dev
```

- API: http://localhost:3000/api
- Swagger: **http://localhost:3000/api/docs**

---

## API cơ bản (Auth)

```bash
# Đăng ký
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@example.com","password":"Test@123456"}'

# Đăng nhập
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"Test@123456"}'

# Lấy profile (thay <token> bằng accessToken từ login)
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <token>"

# Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

---

## Cấu trúc thư mục

```
src/
├── main.ts                 # Bootstrap, Swagger, global prefix /api
├── app.module.ts           # Root module, Joi env validation, global guards
├── prisma/                 # PrismaModule (global) + PrismaService
├── common/
│   ├── interceptors/       # ResponseInterceptor → {success,data,message,meta}
│   ├── filters/            # HttpExceptionFilter
│   ├── decorators/         # @Roles(), @CurrentUser(), @Public()
│   └── guards/             # JwtAuthGuard, RolesGuard
├── auth/                   # ✅ HOÀN CHỈNH — register, login, refresh, logout
├── users/                  # ✅ CƠ BẢN — GET /me, PATCH /me
├── products/               # 🚧 STUB — M2 implement
├── categories/             # 🚧 STUB — M2 implement
├── reviews/                # 🚧 STUB — M2 implement
├── wishlist/               # 🚧 STUB — M2 implement
├── cart/                   # 🚧 STUB — M3 implement
├── orders/                 # 🚧 STUB — M3 implement
├── payments/               # 🚧 STUB — M3 implement
├── vouchers/               # 🚧 STUB — M3 implement
├── notifications/          # 🚧 STUB — M4 implement
├── admin/                  # 🚧 STUB — M4 implement
└── reports/                # 🚧 STUB — M4 implement
```

---

## Hướng dẫn cho Member

### Bảo vệ endpoint bằng JWT

Endpoint mặc định đã bị bảo vệ bởi `JwtAuthGuard` (global). Để làm endpoint public:

```typescript
import { Public } from '../common/decorators/public.decorator';

@Public()
@Get('public-endpoint')
publicRoute() { ... }
```

### Giới hạn theo role

```typescript
import { Roles } from '../common/decorators/roles.decorator';

@Roles('admin')
@Get('admin-only')
adminRoute() { ... }
```

### Lấy user hiện tại

```typescript
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Get('my-data')
myRoute(@CurrentUser() user: User) {
  // user là object Prisma User đầy đủ
}
```

### Trả về response có phân trang

```typescript
// Controller trả object có dạng {data, meta} → interceptor tự bọc
return {
  data: items,
  message: 'Lấy danh sách thành công',
  meta: { page: 1, limit: 10, total: 100, totalPages: 10 },
};
```

### Thêm migration mới

```bash
# Sau khi sửa schema.prisma, tạo migration:
npx prisma migrate dev --name <tên_thay_đổi>

# Ví dụ:
npx prisma migrate dev --name add-otp-table
```

> ⚠️ **Quan trọng**: KHÔNG tự tạo bảng bằng tay. Mọi thay đổi DB = 1 migration + pull request.

---

## Staging (Supabase/Neon)

Khi deploy lên staging, cập nhật `.env`:

```env
DATABASE_URL="postgresql://user:pw@pooler.supabase.com:5432/db"   # pooled (pgbouncer)
DIRECT_URL="postgresql://user:pw@db.supabase.com:5432/db"          # direct connection
```

`DATABASE_URL` dùng cho app runtime, `DIRECT_URL` dùng riêng cho `prisma migrate`.

---

## Scripts hay dùng

| Script | Mô tả |
|--------|-------|
| `npm run start:dev` | Chạy dev server (watch mode) |
| `npm run build` | Build production |
| `npm run lint` | ESLint + auto-fix |
| `npm run format` | Prettier format |
| `npx prisma studio` | GUI quản lý DB tại localhost:5555 |
| `npx prisma migrate dev` | Apply schema changes |
| `npx prisma db seed` | Seed dữ liệu test |
