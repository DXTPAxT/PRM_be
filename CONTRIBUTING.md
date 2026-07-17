# App Bán Quần Áo — Hướng dẫn nhóm (CONTRIBUTING)

Tài liệu chung cho cả nhóm: ai làm gì, làm theo thứ tự nào, và làm sao để "kéo project về là chạy được". Commit file này ở gốc repo.

- **Stack:** BE = NestJS + Prisma + PostgreSQL · FE = Flutter (Riverpod, Clean Architecture)
- **2 repo:** `app-quanao-be`, `app-quanao-fe`
- **Nguồn chân lý:** schema DB = `schema.prisma` (một file duy nhất) · API contract = Swagger `/api/docs`

---

## 1. Phân chia công việc

> Cột "Database" nghĩa là *ai chịu trách nhiệm logic bảng đó*, KHÔNG phải mỗi người tự tạo bảng riêng. Toàn bộ bảng nằm trong **một** `schema.prisma` do leader quản. Mỗi bảng chỉ có **một người sở hữu quyền ghi**.

| Thành viên | Feature | Backend (module) | Flutter (màn hình) | Sở hữu bảng DB |
|---|---|---|---|---|
| **Member 1** | Auth + Account + Notification + Wishlist | auth, users, notifications, wishlist | Login, Register, Profile, Address, Notifications, Wishlist | User, Address, WishlistItem |
| **Member 2** | Product + Search + Review | products, categories, reviews | Home, Product Detail, Search/Filter, Review UI | Product, Category, ProductVariant, ProductImage, Review |
| **Member 3** | Cart + Checkout + Order + Payment + Shipping | cart, orders, payments | Cart, Checkout, Order History, Order Detail | Cart, CartItem, Order, OrderItem, Payment |
| **Member 4** | Admin + Voucher + Report | admin, vouchers, reports | Admin Screens, Dashboard | Voucher (+ đọc mọi bảng qua quyền admin) |

**Ghi chú phân công:**
- Wishlist (FR-05) + Notification/FCM (FR-10) giao **Member 1** vì Auth ổn định sớm, dư thời gian; hai feature này self-contained không đụng ai.
- Shipping GHN/GHTK giao **Member 3** (external integration của luồng đơn).
- **Member 3 là slice nặng nhất** (cart + order lifecycle + payment + webhook + shipping + tồn kho BR-02 + auto-hủy 15 phút BR-06) → không nhận thêm feature; đổi lại được sắp lịch để không nghẽn.
- **Member 4 ghép sớm với Member 2** ở Product CRUD (admin dùng lại logic product) để không ngồi không giai đoạn đầu; Report/Dashboard làm cuối vì cần data.
- Order: **M3 sở hữu ghi** (create/status/cancel/stock); **M1 chỉ đọc** để hiển thị lịch sử, không tự đổi status.

---

## 2. Lịch theo tuần & critical path

```
Tuần 1  ─ Member 1: Auth + JWT guard  ◄── CHẶN TẤT CẢ, phải xong trước
        │ Member 2: Product + Category + Variant API
        │ Member 3: Order state machine + tích hợp sandbox cổng thanh toán (phần KHÔNG phụ thuộc)
        │ Member 4: ghép M2 làm Product CRUD (admin)

Tuần 2  ─ Member 1: Profile, Address, Wishlist
        │ Member 2: Search/Filter, Product Detail, Review
        │ Member 3: Cart (cần Product/Variant của M2), Checkout (cần Address của M1)
        │ Member 4: Voucher, Admin order management

Tuần 3  ─ Member 1: Notification FCM (bắn khi đổi trạng thái đơn — cần M3)
        │ Member 3: Payment webhook + hoàn tất luồng đặt hàng + Shipping
        │ Member 4: Report/Dashboard (cần data order/product — làm cuối)

Tuần 4  ─ Tích hợp end-to-end, sửa bug, seed data demo, chuẩn bị bảo vệ
```

**Điểm nghẽn cần canh:**
- **Auth (M1) là critical path** — trễ là cả nhóm không test được. Ưu tiên số 1.
- **M3 phụ thuộc M2 (product/variant) và M1 (address)** → lúc chờ, làm state machine + payment sandbox trước.
- **M4 dễ crunch cuối kỳ** → bắt đầu sớm bằng cách ghép M2.

---

## 3. Chuẩn bị của Leader (làm XONG trước khi mời member vào)

1. Chạy 2 prompt scaffold (BE & FE) trên máy leader, kiểm tra chạy sạch:
   - BE: `docker compose up` + `prisma migrate dev` + `seed` + `start:dev`, `/api/auth/login` trả token.
   - FE: `flutter run` vào được màn Login, gọi được BE.
2. Push 2 repo lên Git. Đặt `main` là **protected branch**.
3. Tạo **DB staging chung** trên Supabase / Neon / Railway (free): lấy `DATABASE_URL`, chạy migrate + seed lên đó. Cất connection string ở nơi chung (không commit).
4. Commit sẵn vào repo: `.env.example`, `docker-compose.yml`, `schema.prisma` + migrations, file hướng dẫn này.
5. Bật **Swagger** `/api/docs` và share link — đây là **API contract**, nguồn chân lý để FE/BE khớp nhau.
6. Mời 4 member làm collaborator, gán mỗi người module/folder theo mục 1.

---

## 4. Mỗi member cài sẵn (prerequisites)

| Công cụ | Version | Ghi chú |
|---|---|---|
| Git | mới nhất | + cấu hình SSH key với repo |
| Node.js | 20 LTS | dùng `nvm` cho dễ đổi version |
| Docker Desktop | mới nhất | chạy Postgres/Redis local (BE) |
| Flutter SDK | stable (Dart 3) | `flutter doctor` phải xanh hết |
| Android Studio / Xcode | — | emulator/simulator |
| IDE | VS Code / Cursor / Windsurf | + ext Flutter, Dart, Prisma, ESLint |

---

## 5. Clone-and-go

### Backend
```bash
git clone <repo-be> && cd app-quanao-be
cp .env.example .env          # điền JWT_SECRET... (DATABASE_URL để mặc định trỏ Docker local)
docker compose up -d          # Postgres + Redis
npm install
npx prisma migrate dev        # tạo schema từ migrations trong git
npx prisma db seed            # data mẫu
npm run start:dev             # http://localhost:3000 · docs tại /api/docs
```

### Frontend
```bash
git clone <repo-fe> && cd app-quanao-fe
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api   # Android emulator -> BE local
```

> Xong các bước trên là mở đúng folder feature của mình (mục 1) và bắt đầu. Auth (BE module + FE màn Login) là **khuôn mẫu** để copy.

---

## 6. Quy ước bắt buộc (để 4 người không đạp nhau)

1. **Branch:** `main` (protected) → `dev` → `feature/<ten-ngan>` (vd `feature/cart-be`, `feature/product-fe`). Không push thẳng `main`/`dev`.
2. **PR:** mọi thay đổi qua Pull Request, leader review, merge vào `dev`; `dev` ổn định thì merge `main`.
3. **Commit:** theo Conventional Commits (`feat:`, `fix:`, `chore:`...).
4. **Đổi schema DB:** CHỈ sửa `schema.prisma` → `npx prisma migrate dev --name <ten>` → commit migration → báo cả nhóm. TUYỆT ĐỐI không `CREATE TABLE` tay, không sửa DB trực tiếp.
5. **API contract:** BE đổi endpoint thì cập nhật Swagger; FE bám Swagger, không đoán. Đổi shape → báo người FE liên quan.
6. **`.env` KHÔNG BAO GIỜ commit.** Chỉ commit `.env.example`.
7. **Không sửa code chung** nếu chưa thống nhất với leader: `core/` (FE), `common/` + `prisma/` (BE).
8. **Model FE** mirror API response, KHÔNG mirror DB. Mỗi người tự tạo model cho feature của mình; chỉ model dùng chung (User, ApiResponse) đặt ở `shared/`.

---

## 7. Checklist "sẵn sàng bắt đầu" (mỗi member tự tick)

- [ ] Clone được cả 2 repo, có quyền push nhánh feature
- [ ] BE chạy local được (docker + migrate + seed + start), vào `/api/docs`
- [ ] FE chạy được trên emulator, login thử tài khoản seed thành công
- [ ] Đã đọc mục 1 (biết mình sở hữu module/folder/bảng nào)
- [ ] Đã đọc README trong folder feature của mình
- [ ] Hiểu quy ước branch + migration ở mục 6

---

## 8. Nhịp làm việc

- Sync ngắn 2–3 lần/tuần: ai chặn ai, endpoint nào chưa xong.
- **Ưu tiên tuyệt đối tuần 1: Member 1 xong Auth** (critical path) — cả nhóm test bằng token của Auth.
- Bám sát lịch mục 2, đặc biệt Member 3 (nặng nhất) và Member 4 (crunch cuối).
