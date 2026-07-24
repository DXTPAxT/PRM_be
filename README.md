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
> 📌 **Giải thích**: Tải mã nguồn Backend về máy và cài đặt toàn bộ các thư viện/phụ thuộc khai báo trong `package.json` (NestJS framework, Prisma ORM, JWT, Bcrypt, Class Validator...).

### 2. Cấu hình môi trường

```bash
cp .env.example .env
# Mở .env và điền các giá trị (đặc biệt là JWT_SECRET và JWT_REFRESH_SECRET — min 32 chars)
```
> 📌 **Giải thích**:
> - Tạo file môi trường `.env` chứa các bí mật bảo mật và cấu hình kết nối ứng dụng.
> - Dòng `DATABASE_URL` trong `.env` chỉ định chuỗi kết nối đến PostgreSQL (`postgresql://postgres:postgres@localhost:5432/clothing_store?schema=public`).

### 3. Khởi động DB + Redis (Bằng Docker)

```bash
docker compose up -d
# Postgres chạy tại localhost:5432
# Redis chạy tại localhost:6379
```
> 📌 **Giải thích**:
> - Đọc file `docker-compose.yml` để khởi chạy 2 container ngầm: **PostgreSQL 16** (CSDL chính tại Cổng 5432) và **Redis** (Bộ nhớ đệm/Session tại Cổng 6379).
> - Nhờ Docker, toàn bộ team không cần phải tự cài thủ công PostgreSQL hay Redis vào hệ điều hành.

### 4. Migrate database (Tạo bảng từ Schema)

```bash
npx prisma migrate dev --name init
# Prisma generate tự động chạy sau migrate
```
> 📌 **Giải thích**:
> - Prisma ORM sẽ đọc file định nghĩa `prisma/schema.prisma` (Single Source of Truth).
> - Biên dịch thành mã SQL DDL và tạo trực tiếp toàn bộ 15 bảng, khóa chính (PK), khóa ngoại (FK), ràng buộc dữ liệu trong CSDL PostgreSQL.
> - Tự động chạy `prisma generate` để sinh ra `PrismaClient` giúp code TypeScript truy vấn CSDL an toàn.

### 5. Seed dữ liệu test (Nạp dữ liệu mẫu)

```bash
npx prisma db seed
```
> 📌 **Giải thích**: Chạy script `prisma/seed.ts` để nạp sẵn dữ liệu ban đầu vào CSDL (tài khoản Admin/Customer, danh mục quần áo, sản phẩm, biến thể size/màu, và mã giảm giá Voucher) phục vụ test ứng dụng.

Tài khoản được tạo sẵn:

| Role     | Email                      | Password        | Chức năng |
|----------|----------------------------|-----------------|-----------|
| admin    | admin@clothing.dev         | Admin@123456    | Quản trị viên (Admin Portal) |
| customer | customer1@clothing.dev     | Customer@123456 | Khách hàng mua sắm |
| customer | customer2@clothing.dev     | Customer@123456 | Khách hàng mua sắm |

### 6. Chạy server NestJS

```bash
npm run start:dev
```
> 📌 **Giải thích**:
> - Khởi động Backend NestJS ở chế độ phát triển (watch mode). Server tự động biên dịch lại mỗi khi sửa code.
> - Khi khởi chạy, `PrismaService` sẽ tự động mở kết nối (Connect) tới PostgreSQL và lắng nghe yêu cầu API từ ứng dụng Flutter FE.

- API Base URL: `http://localhost:3000/api`
- Tài liệu API (Swagger UI): **`http://localhost:3000/api/docs`**

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
├── wishlist/               # 🚧 STUB — M1 implement
├── cart/                   # 🚧 STUB — M3 implement
├── orders/                 # 🚧 STUB — M3 implement
├── payments/               # 🚧 STUB — M3 implement
├── vouchers/               # 🚧 STUB — M4 implement
├── notifications/          # 🚧 STUB — M1 implement
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
