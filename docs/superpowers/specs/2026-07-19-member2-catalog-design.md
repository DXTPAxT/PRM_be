# Member 2 — Product + Search + Review — Design Spec

**Ngày:** 2026-07-19
**Phạm vi:** 2 repo — `PRM_be` (NestJS + Prisma) và `PRM_fe` (Flutter + Riverpod)
**Nguồn:** `CONTRIBUTING.md` mục 1, `spec-backend-app-ban-quan-ao.docx` mục 3, `FE/lib/features/catalog/README.md`

---

## 1. Bối cảnh

Member 1 đã hoàn thành Auth/Account (OTP, forgot/reset password, profile, address) và push lên `main` của cả hai repo. Toàn bộ phần của Member 2 hiện là stub: 3 module BE chỉ có endpoint `/ping` (~17 dòng mỗi module), FE chỉ có `catalog_screen.dart` hiển thị "Coming Soon".

### Hạ tầng đã có sẵn — không cần dựng lại

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| `JwtAuthGuard` global | `src/app.module.ts:99` | Bypass bằng `@Public()` |
| `RolesGuard` global | `src/app.module.ts:102` | Bật bằng `@Roles('admin')` |
| `ResponseInterceptor` | `src/common/interceptors/` | Bọc `{success, data, message, meta}` |
| `HttpExceptionFilter` | `src/common/filters/` | Xử lý lỗi tập trung |
| `ValidationPipe` | `src/main.ts:20` | `whitelist` + `forbidNonWhitelisted` + `transform` |
| Swagger | `/api/docs` | Đã có sẵn 3 tag `products`/`categories`/`reviews` |
| Seed data | `prisma/seed.ts` | 6 category (2 cấp) + 4 product + variants + images |
| `HiveCache` box | `FE/lib/core/storage/hive_cache.dart` | `categories_cache` đã mở sẵn |
| `ApiResponse` / `PagedResponse` | `FE/lib/core/network/api_response.dart` | Đã hỗ trợ `meta` |

### Quyết định đã chốt

1. **Scope:** public read + user viết review + admin CRUD product
2. **Điều kiện review:** chỉ cần đăng nhập (không kiểm tra đã mua hàng — tránh phụ thuộc bảng `Order` của M3)
3. **Màn Home:** không đụng tới; chỉ làm trong `features/catalog/`
4. **Test:** có ở BE (service layer), không ở FE
5. **Thứ tự:** BE xong hết → FE xong hết

---

## 2. Backend

### 2.1. Data layer — KHÔNG cần migration

Cả 5 bảng `Category`, `Product`, `ProductImage`, `ProductVariant`, `Review` đã đủ field trong `prisma/schema.prisma`.

**Ràng buộc quan trọng:**
- `ProductStatus` chỉ có `active | inactive` → **DELETE product = soft delete** (`status='inactive'`). Xóa cứng sẽ vỡ FK vì `ProductVariant` bị `OrderItem` tham chiếu không cascade.
- `Review` có `@@unique([userId, productId])` → mỗi user review một sản phẩm đúng một lần.
- `ProductVariant` có `@@unique([productId, size, color])` (BR-02) và `sku` unique toàn cục.

### 2.2. Quy ước response

Mọi response đi qua `ResponseInterceptor` → `{ success, data, message, meta? }`.

**Bẫy lớn nhất:** Prisma trả kiểu `Decimal` cho `basePrice` và `variant.price`. `JSON.stringify` biến nó thành **string** `"250000"`, khiến FE parse `double` crash. Bắt buộc `.toNumber()` trước khi trả — xử lý tập trung tại `product.mapper.ts`.

List luôn kèm `meta: { page, limit, total, totalPages }`.

### 2.3. Endpoints

#### Public (`@Public()`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/categories` | Flat list `{id, name, parentId}` — FE tự dựng cây 2 cấp |
| GET | `/api/products` | Danh sách + lọc + sắp xếp + phân trang |
| GET | `/api/products/:id` | Chi tiết + images + variants + avgRating + reviewCount |
| GET | `/api/products/:id/reviews` | Review của sản phẩm, phân trang |

**Query params của `GET /products`:**

| Param | Kiểu | Hành vi |
|---|---|---|
| `categoryId` | uuid? | Nếu là category cha → lấy cả sản phẩm của category con (2 cấp) |
| `search` | string? | `name contains` HOẶC `description contains`, `mode: 'insensitive'` |
| `minPrice` / `maxPrice` | number? | Lọc trên `basePrice` (`gte`/`lte`) |
| `size` | string? | `variants: { some: { size } }` |
| `color` | string? | `variants: { some: { color } }` |
| `sort` | enum? | `newest` = `createdAt desc` (mặc định) \| `price_asc` / `price_desc` = `basePrice` \| `name_asc` = `name asc` |
| `page` | int? | Mặc định 1, min 1 |
| `limit` | int? | Mặc định 20, max 50 |

Mặc định chỉ trả sản phẩm `status='active'`.

**Không dùng full-text search** — `contains` là đủ cho quy mô đồ án.

#### Cần JWT

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/reviews` | Body `{productId, rating: 1-5, comment?}` |
| PATCH | `/api/reviews/:id` | Sửa review của chính mình |
| DELETE | `/api/reviews/:id` | Xóa review của chính mình |

`PATCH` và `DELETE` **nằm ngoài spec docx** (spec chỉ có `POST /reviews`). Bổ sung có chủ đích: `@@unique([userId, productId])` khiến user chấm nhầm sao sẽ kẹt vĩnh viễn. Chi phí ~30 dòng, không ai khác đụng bảng `Review` nên rủi ro bằng 0.

#### Admin (`@Roles('admin')`)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/products` | Tạo product + images[] + variants[] lồng nhau, trong 1 transaction |
| PUT | `/api/products/:id` | Cập nhật product + images (replace-all) + variants (upsert, xem bên dưới) |
| DELETE | `/api/products/:id` | Soft delete → `status='inactive'` |

**Xử lý variants khi PUT — KHÔNG được replace-all.** `CartItem` và `OrderItem` tham chiếu `ProductVariant` không có `onDelete: Cascade`, nên xóa variant đang nằm trong giỏ hàng hoặc đơn hàng của ai đó sẽ lỗi khóa ngoại. Cách làm đúng:
- Upsert theo `@@unique([productId, size, color])` — có rồi thì update `price`/`stockQty`/`sku`, chưa có thì tạo mới
- **Không xóa** variant cũ không còn trong payload
- Muốn ngừng bán một variant → set `stockQty = 0`

`images` thì replace-all an toàn, vì `ProductImage` có `onDelete: Cascade` và không bảng nào tham chiếu nó.

Không làm CRUD category cho admin — spec không yêu cầu, để M4 tự quyết.

### 2.4. Shape response

```
ProductListItem {
  id, categoryId, categoryName, name, basePrice: number,
  status, thumbnailUrl: string|null, avgRating: number,
  reviewCount: number, createdAt
}

ProductDetail {
  ...ProductListItem, description: string|null,
  images: [{id, url, sortOrder}],
  variants: [{id, productId, size, color, price: number, stockQty, sku}]
}

ReviewItem {
  id, userId, userFullName, productId,
  rating: int, comment: string|null, createdAt
}

CategoryItem { id, name, parentId: string|null }
```

**Quy ước giá trị suy ra:**
- `thumbnailUrl` = `url` của ảnh có `sortOrder` nhỏ nhất; không có ảnh → `null`
- `avgRating` = trung bình `rating`, **làm tròn 1 chữ số thập phân**; chưa có review → `0`
- `reviewCount` = số review; chưa có → `0`

**FE dùng chung một class `Product` cho cả list lẫn detail.** Các field chỉ có ở detail (`description`, `images`, `variants`) để mặc định `null`/`[]` khi parse từ danh sách. Tránh phải nuôi hai model gần giống nhau.

### 2.5. Mã lỗi

| Mã | Tình huống |
|---|---|
| 400 | rating ngoài 1..5, page/limit không hợp lệ, field lạ (`forbidNonWhitelisted`) |
| 403 | Sửa/xóa review của người khác |
| 404 | Product / category / review không tồn tại |
| 409 | Review trùng (Prisma `P2002`), hoặc SKU trùng khi tạo product |

### 2.6. Cấu trúc file

```
src/products/
  dto/query-products.dto.ts
  dto/create-product.dto.ts
  dto/update-product.dto.ts
  product.mapper.ts
  products.service.ts
  products.service.spec.ts
  products.controller.ts
  products.module.ts

src/categories/
  categories.service.ts
  categories.service.spec.ts
  categories.controller.ts
  categories.module.ts

src/reviews/
  dto/create-review.dto.ts
  dto/update-review.dto.ts
  reviews.service.ts
  reviews.service.spec.ts
  reviews.controller.ts
  reviews.module.ts
```

**Hai quyết định cấu trúc:**

1. **`GET /products/:id/reviews` đặt ở `ProductsController`.** URL thuộc `products` nhưng logic thuộc `reviews`. `ReviewsModule` export `ReviewsService` → `ProductsModule` import → controller gọi `reviewsService.findByProduct()`. Không tạo vòng lặp phụ thuộc vì `ReviewsService` chỉ cần `PrismaService`, không cần `ProductsService`.

2. **`product.mapper.ts` tách riêng thành hàm thuần** (`toProductListItem`, `toProductDetail`). Đây là nơi duy nhất xử lý `Decimal` → `number`, và test được mà không cần mock DB.

### 2.7. Test — 29 case, service layer và mapper

> Con số chi tiết chốt ở plan: `categories` 3, `product.mapper` 6, `products.service` 13, `reviews.service` 7. Danh sách dưới đây là các hành vi bắt buộc phải có; plan chia nhỏ thêm một số case.

Bám đúng pattern của M1 tại `src/addresses/addresses.service.spec.ts`: mock object thuần cast sang `PrismaService`, khởi tạo trực tiếp `new Service(prisma)` (không dùng `Test.createTestingModule`), tên test bằng tiếng Việt, hằng `*_SELECT` đặt đầu file service.

**`products.service.spec.ts` (10):**
- Lọc `categoryId` gồm cả category con
- `search` khớp cả `name` lẫn `description`, không phân biệt hoa thường
- `minPrice`/`maxPrice` sinh đúng `gte`/`lte`
- `size`/`color` sinh `variants: { some: ... }`
- 4 giá trị `sort` sinh đúng `orderBy`
- Mặc định chỉ trả `status='active'`
- `meta.totalPages` đúng khi `total` chia hết và không chia hết
- `findOne` không thấy → `NotFoundException`
- `remove` set `status='inactive'`, **không** gọi `prisma.product.delete`
- `update` upsert variant theo `(productId,size,color)` và **không** gọi `variant.deleteMany` cho variant cũ vắng mặt trong payload

**`reviews.service.spec.ts` (6):**
- Tạo review khi chưa có → `create` đúng payload
- Prisma lỗi `P2002` → `ConflictException`
- Product không tồn tại → `NotFoundException`
- Sửa review người khác → `ForbiddenException`
- Xóa review người khác → `ForbiddenException`
- `findByProduct` phân trang + kèm `userFullName`

**`categories.service.spec.ts` (3):**
- Trả flat list kèm `parentId`
- Sắp xếp cha trước con
- Danh sách rỗng → trả `[]`, không lỗi

Chạy: `npm run test -- products`

### 2.8. Bước cuối

Cập nhật `src/main.ts` — 3 dòng `.addTag()` đang ghi *"M2 implement"* → đổi thành mô tả thật.

---

## 3. Frontend

### 3.1. Bước 0 (bắt buộc, làm trước mọi thứ): sửa model trong `shared/`

4 model hiện dùng `@JsonKey` snake_case (`'category_id'`, `'base_price'`, `'stock_qty'`, `'product_id'`, `'user_id'`, `'parent_id'`) trong khi BE trả camelCase → **parse fail 100%**.

Member 1 đã sửa `user.dart` và `address.dart` sang camelCase; 4 model của Member 2 vẫn là scaffold cũ. Đã xác nhận **chưa file nào import chúng** → sửa an toàn.

| File | Thay đổi |
|---|---|
| `product.dart` | Bỏ hết `@JsonKey`; thêm `description?`, `categoryName`, `thumbnailUrl?`, `avgRating`, `reviewCount`, `images`, `createdAt` |
| `category.dart` | `parent_id` → `parentId` |
| `product_variant.dart` | Bỏ `@JsonKey` |
| `review.dart` | Bỏ `@JsonKey`; `comment` nullable; `rating` `double` → `int`; thêm `userFullName`, `createdAt` |
| `product_image.dart` | **File mới** — `{id, url, sortOrder}` |

Sau đó: `dart run build_runner build --delete-conflicting-outputs`

### 3.2. Cấu trúc file

```
lib/features/catalog/
  data/
    models/product_query.dart
    datasources/catalog_remote_data_source.dart
    repositories/catalog_repository_impl.dart
  domain/
    repositories/catalog_repository.dart
    usecases/get_categories_usecase.dart
    usecases/get_products_usecase.dart
    usecases/get_product_detail_usecase.dart
    usecases/get_product_reviews_usecase.dart
    usecases/create_review_usecase.dart
  presentation/
    providers/catalog_provider.dart
    providers/product_detail_provider.dart
    providers/review_provider.dart
    screens/catalog_screen.dart
    screens/product_detail_screen.dart
    screens/search_screen.dart
    widgets/product_card.dart
    widgets/filter_bottom_sheet.dart
    widgets/variant_selector.dart
    widgets/review_list.dart
    widgets/review_form_sheet.dart
```

### 3.3. Ba quyết định kiến trúc

1. **`ProductQuery` là object bất biến có `copyWith`.** Thay vì 8 tham số rời trong provider, đổi filter là `state.query.copyWith(color: 'Đen')` rồi load lại từ trang 1. Giữ cho filter + paging không rối.

2. **Chỉ cache `categories`, không cache danh sách sản phẩm.** README gợi ý cache cả hai, nhưng màn Home không nằm trong scope nữa, và danh sách sản phẩm phụ thuộc tổ hợp filter → cache vô nghĩa. Categories gần như không đổi.

3. **Thêm route `/products/:id` vào `core/router/app_router.dart`** ở cấp top-level (ngoài `StatefulShellRoute`) để trang chi tiết mở full màn, che bottom nav. Đây là chỗ duy nhất đụng `core/` — cần báo M1 + leader theo quy ước mục 7. Màn search mở bằng push trực tiếp, không cần route riêng.

### 3.4. Pattern bám theo M1

Tham chiếu `lib/features/profile/presentation/providers/address_provider.dart`:
- `StateNotifier<XState>` + State class tự viết có `copyWith` (**không** dùng `AsyncNotifier`, **không** codegen)
- Repository `throw Exception(message)` (**không** dùng `Either`/`dartz`)
- Notifier bắt trong `try/catch` → `state.copyWith(errorMessage: e.toString())`
- Màn hình hiện `SnackBar` + nút "Thử lại"

### 3.5. Màn hình

**`catalog_screen.dart`** (thay stub)
- AppBar: ô search giả (tap → `search_screen`) + icon phễu lọc
- Hàng chip categories cuộn ngang, có chip "Tất cả"
- `GridView` 2 cột `product_card`, infinite scroll (ScrollController tới 80% → `loadMore`)
- Pull-to-refresh; 4 trạng thái: loading / rỗng / lỗi + nút Thử lại / có data

**`product_detail_screen.dart`**
- Carousel ảnh (`PageView` + dot indicator)
- Tên, giá, `avgRating` ★ + `(reviewCount) đánh giá`
- `variant_selector`: chọn Size → chọn Màu → hiện `price` + `stockQty` của đúng variant; tổ hợp không tồn tại thì disable chip
- Mô tả thu gọn/mở rộng
- Khu review: 3 review đầu + "Xem tất cả" + nút "Viết đánh giá"
- Bottom bar: nút "Thêm vào giỏ" **disabled**, tooltip *"Chức năng của Member 3"*

**`search_screen.dart`**
- TextField autofocus, **debounce 400ms**
- Tái sử dụng `product_card`, có empty state

**`filter_bottom_sheet.dart`**
- Khoảng giá, chip Size, chip Màu, dropdown Sắp xếp, nút "Áp dụng" / "Xóa lọc"
- **Size và màu hardcode hằng số trong FE** (`['S','M','L','XL']` + danh sách màu theo seed). BE không có endpoint trả danh sách size/màu đang tồn tại, và thêm `GET /products/filter-options` là scope creep không đáng cho đồ án.

**`review_form_sheet.dart`**
- Chấm 5 sao + comment
- Gặp **409** → hiện "Bạn đã đánh giá sản phẩm này rồi", tự chuyển sang chế độ sửa (`PATCH`)

### 3.6. State

```
CatalogState { categories, products, query, isLoading,
               isLoadingMore, hasMore, errorMessage }

ProductDetailState { product, selectedSize, selectedColor,
                     isLoading, errorMessage }
                   → selectedVariant là getter

ReviewState { reviews, myReview, page, hasMore,
              isLoading, isSubmitting, errorMessage }
```

`hasMore = meta.page < meta.totalPages`
`ProductDetailState` và `ReviewState` dùng `.family(productId)`.

---

## 4. Ranh giới không được vượt

Ghi rõ để agent thực thi không lấn sang phần người khác:

- ❌ Không sửa `prisma/schema.prisma`, không tạo migration
- ❌ Không gọi hay implement API `/cart`, `/wishlist`, `/orders` (M3 và M1)
- ❌ Không sửa `src/auth/`, `src/users/`, `src/addresses/` (M1)
- ❌ Không sửa `FE/lib/features/auth/`, `FE/lib/features/profile/` (M1)
- ✅ `src/main.ts`: chỉ sửa 3 dòng `.addTag()`
- ✅ `FE/lib/core/router/app_router.dart`: chỉ thêm route `/products/:id`
- ✅ `FE/lib/shared/models/`: sửa 4 model + thêm 1 file (đều thuộc sở hữu M2)

---

## 5. Tiêu chí hoàn thành

**Backend**
- [ ] `npm run test` xanh, 29 case mới đều pass
- [ ] `npm run build` không lỗi TypeScript
- [ ] Swagger `/api/docs` hiển thị đủ 10 endpoint với mô tả tiếng Việt
- [ ] Gọi thử `GET /api/products?search=áo&sort=price_asc` trả `basePrice` kiểu **number** (không phải string)
- [ ] `DELETE /api/products/:id` bằng token admin → sản phẩm biến mất khỏi `GET /products` nhưng vẫn còn trong DB

**Frontend**
- [ ] `flutter analyze` không lỗi
- [ ] Tab "Danh mục" hiện lưới 4 sản phẩm seed kèm ảnh
- [ ] Lọc theo category / khoảng giá / size / màu đều đổi kết quả
- [ ] Search "áo" trả đúng kết quả sau 400ms
- [ ] Mở chi tiết → chọn size + màu → giá và tồn kho đổi theo variant
- [ ] Gửi đánh giá thành công; gửi lần 2 hiện thông báo đã đánh giá và cho sửa
