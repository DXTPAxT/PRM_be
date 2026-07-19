# Prompt theo session — Catalog Backend

Chia plan `2026-07-19-catalog-be.md` thành **5 session**. Mỗi session là một đoạn chat mới với agent.

**Cách dùng:** mở session mới → copy nguyên khối prompt (phần trong khung) → dán vào → để agent chạy tới khi xong → kiểm tra mục "Nghiệm thu" → sang session tiếp theo.

**Thứ tự bắt buộc.** Session sau phụ thuộc kết quả session trước.

| Session | Task | Nội dung | Ước lượng |
|---|---|---|---|
| 1 | 1-2 | Categories + mapper + query DTO | ~30 phút |
| 2 | 3 | `GET /products` với lọc, sắp xếp, phân trang | ~40 phút |
| 3 | 4-5 | Chi tiết sản phẩm + tạo đánh giá | ~40 phút |
| 4 | 6 | Sửa/xóa đánh giá + `GET /products/:id/reviews` | ~30 phút |
| 5 | 7-8 | Admin CRUD + Swagger + nghiệm thu | ~40 phút |

---

## Session 1 — Categories, mapper, query DTO

```
Bạn đang làm backend NestJS + Prisma cho đồ án app bán quần áo. Tôi là Member 2, phụ trách Product + Search + Review.

Hãy đọc file docs/superpowers/plans/2026-07-19-catalog-be.md và thực hiện ĐÚNG Task 1 và Task 2, theo từng step một, không bỏ step nào.

Bối cảnh:
- 3 module products/categories/reviews hiện là stub, chỉ có endpoint /ping
- Member 1 đã làm xong auth/users/addresses — KHÔNG được đụng vào
- Bảng DB đã có đủ, KHÔNG sửa prisma/schema.prisma, KHÔNG tạo migration

Ràng buộc quan trọng:
- Test viết theo đúng pattern của src/addresses/addresses.service.spec.ts (mock object thuần cast sang PrismaService, khởi tạo new Service(prisma) trực tiếp, KHÔNG dùng Test.createTestingModule)
- Prisma trả kiểu Decimal cho basePrice — phải ép về number, nếu không JSON sẽ ra string và app Flutter sẽ crash
- Mọi message trả về client viết bằng tiếng Việt có dấu

Làm theo TDD: viết test trước, chạy cho nó FAIL, rồi mới viết code cho PASS. Commit sau mỗi task.

Xong thì báo cáo: đã tạo file nào, bao nhiêu test pass.
```

**Nghiệm thu session 1:**
- `npm run test -- categories` → 3 passed
- `npm run test -- product.mapper` → 6 passed
- `npm run build` không lỗi
- Có 2 commit mới

---

## Session 2 — `GET /products`

```
Tiếp tục backend NestJS cho đồ án app bán quần áo. Tôi là Member 2.

Session trước đã xong Task 1 (module categories) và Task 2 (product.mapper.ts + dto/query-products.dto.ts).

Hãy đọc docs/superpowers/plans/2026-07-19-catalog-be.md và thực hiện ĐÚNG Task 3, theo từng step một.

Task 3 làm endpoint GET /products với: lọc theo danh mục (gồm cả danh mục con), tìm kiếm trong tên và mô tả, lọc khoảng giá, lọc theo size/màu của biến thể, 4 kiểu sắp xếp, và phân trang.

Ràng buộc:
- KHÔNG sửa prisma/schema.prisma
- KHÔNG đụng src/auth, src/users, src/addresses, src/common, src/prisma
- Endpoint public phải gắn decorator @Public() vì JwtAuthGuard là global
- Dùng lại PRODUCT_LIST_SELECT và toProductListItem đã có sẵn từ Task 2, đừng viết lại

Làm theo TDD: viết test trước, chạy FAIL, rồi mới code.

Ở Step 6 có phần kiểm tra thủ công bằng curl — hãy chạy thật và cho tôi xem output, đặc biệt xác nhận basePrice trả về là số KHÔNG có dấu nháy.
```

**Nghiệm thu session 2:**
- `npm run test -- products.service` → 9 passed
- `curl "http://localhost:3000/api/products?limit=1"` trả `"basePrice":250000` (không có nháy)
- Thử `?search=áo`, `?sort=price_asc`, `?minPrice=200000` đều cho kết quả khác nhau

---

## Session 3 — Chi tiết sản phẩm + tạo đánh giá

```
Tiếp tục backend NestJS cho đồ án app bán quần áo. Tôi là Member 2.

Đã xong: Task 1 (categories), Task 2 (mapper + query DTO), Task 3 (GET /products).

Hãy đọc docs/superpowers/plans/2026-07-19-catalog-be.md và thực hiện ĐÚNG Task 4 và Task 5, theo từng step một.

Task 4: GET /products/:id — chi tiết kèm images và variants.
Task 5: module reviews — POST /reviews và service đọc đánh giá theo sản phẩm.

Ràng buộc:
- KHÔNG sửa prisma/schema.prisma
- KHÔNG đụng code của Member 1 (src/auth, src/users, src/addresses) hay code chung (src/common, src/prisma)
- Bảng Review có ràng buộc @@unique([userId, productId]) — user đánh giá lần 2 sẽ bị Prisma ném lỗi P2002, phải bắt và chuyển thành ConflictException (409)
- ReviewsModule BẮT BUỘC phải export ReviewsService — session sau cần dùng
- Endpoint POST /reviews cần JWT, lấy user hiện tại bằng decorator @CurrentUser() có sẵn ở src/common/decorators/

Làm theo TDD. Commit sau mỗi task.
```

**Nghiệm thu session 3:**
- `npm run test -- products.service` → 11 passed
- `npm run test -- reviews` → 4 passed
- `src/reviews/reviews.module.ts` có dòng `exports: [ReviewsService]`

---

## Session 4 — Sửa/xóa đánh giá + `GET /products/:id/reviews`

```
Tiếp tục backend NestJS cho đồ án app bán quần áo. Tôi là Member 2.

Đã xong Task 1 đến Task 5. Module reviews đã có POST /reviews và đã export ReviewsService.

Hãy đọc docs/superpowers/plans/2026-07-19-catalog-be.md và thực hiện ĐÚNG Task 6, theo từng step một.

Task 6 gồm 2 phần:
1. PATCH /reviews/:id và DELETE /reviews/:id — chỉ cho sửa/xóa đánh giá của chính mình, người khác thì ném ForbiddenException
2. Nối GET /products/:id/reviews — ProductsModule import ReviewsModule, ProductsController inject ReviewsService

CỰC KỲ QUAN TRỌNG ở Step 7: route @Get(':id/reviews') phải khai báo NGAY TRƯỚC route @Get(':id'). NestJS khớp route theo thứ tự khai báo — đặt sau thì ':id' sẽ nuốt mất và endpoint reviews không bao giờ chạy được.

Ràng buộc:
- KHÔNG sửa prisma/schema.prisma
- KHÔNG đụng code của Member 1 hay code chung
- Không tạo vòng lặp phụ thuộc: ReviewsService chỉ cần PrismaService, KHÔNG được inject ProductsService

Làm theo TDD. Ở Step 8 hãy chạy curl thật và cho tôi xem kết quả.
```

**Nghiệm thu session 4:**
- `npm run test -- reviews` → 7 passed
- `curl "http://localhost:3000/api/products/<ID>/reviews"` trả `{"success":true,"data":[],...}` — **không** phải lỗi 400 uuid
- Server khởi động không báo lỗi circular dependency

---

## Session 5 — Admin CRUD + Swagger + nghiệm thu

```
Tiếp tục backend NestJS cho đồ án app bán quần áo. Tôi là Member 2. Đây là session cuối.

Đã xong Task 1 đến Task 6 — toàn bộ endpoint public và endpoint review đều chạy.

Hãy đọc docs/superpowers/plans/2026-07-19-catalog-be.md và thực hiện ĐÚNG Task 7 và Task 8, theo từng step một.

Task 7: admin CRUD sản phẩm — POST /products, PUT /products/:id, DELETE /products/:id
Task 8: sửa mô tả Swagger và chạy toàn bộ nghiệm thu

HAI ĐIỂM DỄ SAI NHẤT, đọc kỹ:

1. DELETE phải là SOFT DELETE — chỉ đổi status thành 'inactive'. TUYỆT ĐỐI không gọi prisma.product.delete(). Bảng OrderItem tham chiếu ProductVariant không có cascade, xóa cứng sẽ vỡ khóa ngoại.

2. PUT cập nhật variants phải dùng UPSERT theo ràng buộc @@unique([productId, size, color]). TUYỆT ĐỐI không xóa hết variant cũ rồi tạo lại — CartItem và OrderItem đang tham chiếu chúng, xóa sẽ lỗi khóa ngoại ngay khi có người đã bỏ hàng vào giỏ. Muốn ngừng bán một variant thì set stockQty = 0, không xóa.

Ràng buộc:
- KHÔNG sửa prisma/schema.prisma
- src/main.ts chỉ được sửa đúng 3 dòng .addTag() ở Task 8
- Route admin gắn @Roles('admin')

Làm theo TDD.

Cuối cùng chạy hết checklist "Nghiệm thu cuối" ở cuối file plan và báo cáo từng mục đạt hay không đạt. Nếu có mục nào không đạt thì nói rõ, đừng bỏ qua.
```

**Nghiệm thu session 5 (cũng là nghiệm thu toàn bộ BE):**
- `npm run test` xanh toàn bộ, 29 case mới đều pass (categories 3, mapper 6, products 13, reviews 7)
- `npm run build` không lỗi
- Swagger `/api/docs` hiển thị đủ **10 endpoint**
- `git diff prisma/` **rỗng** — schema không bị đụng
- `DELETE /api/products/:id` bằng token admin → sản phẩm biến mất khỏi `GET /products` nhưng vẫn còn trong `npx prisma studio`

---

## Session 6 — Sửa lỗi phát hiện sau review (chạy sau khi Session 5 "xong")

> Bổ sung sau khi review lại toàn bộ code Task 1-8: agent báo hoàn thành nhưng bỏ sót 1 lỗi hành vi thật, 25 lỗi ESLint, và 2 commit cuối của chính plan.

```
Tiếp tục backend NestJS cho đồ án app bán quần áo. Tôi là Member 2. Bạn (hoặc một agent trước) đã báo hoàn thành plan docs/superpowers/plans/2026-07-19-catalog-be.md, nhưng tôi review lại thấy còn 3 việc chưa xong. Sửa cả 3, theo đúng thứ tự.

## Việc 1 — Sửa lỗi hành vi: GET /products/:id/reviews không kiểm tra sản phẩm tồn tại

File src/reviews/reviews.service.ts, method findByProduct (khoảng dòng 87). Hàm private ensureProductExists() đã có sẵn trong class (method create() đang dùng nó) nhưng findByProduct() không gọi. Hậu quả: gọi GET /products/<uuid-hợp-lệ-nhưng-không-tồn-tại>/reviews trả về 200 với mảng rỗng, thay vì 404 như spec mục 2.5 yêu cầu và như POST /reviews đã làm đúng.

Sửa: thêm dòng đầu tiên trong findByProduct():
    await this.ensureProductExists(productId);

Thêm test case vào src/reviews/reviews.service.spec.ts, trong describe('ReviewsService', ...), viết theo đúng pattern các test case khác đã có trong file (mock productFindUnique trả null):

  it('lấy đánh giá của sản phẩm không tồn tại thì ném NotFoundException', async () => {
    productFindUnique.mockResolvedValue(null);

    await expect(service.findByProduct('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

Chạy: npm run test -- reviews
Expected: PASS, 8 case (thêm 1 so với 7 hiện tại).

## Việc 2 — Sửa 25 lỗi ESLint

Chạy: npx eslint src/products src/categories src/reviews src/main.ts

Sẽ thấy lỗi ở các file: main.ts, src/products/dto/query-products.dto.ts, src/products/product.mapper.spec.ts, src/products/products.controller.ts, src/products/products.service.ts, src/products/products.service.spec.ts, src/reviews/reviews.controller.ts, src/reviews/reviews.service.ts, src/reviews/reviews.service.spec.ts.

Bước 1: chạy npm run lint (script này tự động --fix, sẽ dọn sạch toàn bộ lỗi Prettier — dấu cách, xuống dòng, dấu phẩy cuối).

Bước 2: sau khi chạy xong, chạy lại npx eslint src/products src/categories src/reviews src/main.ts — những lỗi CÒN LẠI là lỗi thật, cần sửa tay từng chỗ, không phải lỗi format:

- no-unnecessary-type-assertion: ở các chỗ như `toProductDetail(row as never)` hay `toReviewItem(row as ReviewRow)` — nếu TypeScript báo assertion là thừa, nghĩa là kiểu dữ liệu Prisma trả về đã đủ khớp, hãy XÓA phần ép kiểu `as ...` đó. Nếu xóa xong TypeScript báo lỗi kiểu thật sự không khớp (không chỉ ESLint cảnh báo), thì giữ lại assertion nhưng đổi `as never` thành kiểu cụ thể đúng, không dùng `never`.

- no-unsafe-member-access trong src/products/products.service.spec.ts, hàm helper whereOf(): vấn đề là `productFindMany.mock.calls[0][0]` có kiểu `any` ngầm định. Sửa bằng cách khai báo kiểu rõ ràng cho biến trung gian trước khi truy cập `.where`, ví dụ:
    function whereOf(): Record<string, unknown> {
      const call = productFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
      return call.where;
    }

- require-await trong src/products/products.service.spec.ts (mock $transaction): nếu arrow function async không có await bên trong, bỏ từ khóa async đi (miễn không đổi hành vi test).

Sau khi sửa xong TOÀN BỘ, chạy lại: npx eslint src/products src/categories src/reviews src/main.ts
Expected: không còn output gì cả (0 lỗi).

Sau đó chạy lại để chắc chắn không có gì gãy:
npm run test
npm run build
Expected: cả hai đều pass/không lỗi như trước.

## Việc 3 — Commit

Việc 1 và 2 sửa vào cả file đã commit từ trước (Task 5-6) lẫn file Task 7-8 đang ở working tree chưa commit. Tách commit như sau:

    git add src/reviews
    git commit -m "fix(reviews): 404 khi lấy đánh giá của sản phẩm không tồn tại"

    git add src/main.ts src/categories src/products/dto/query-products.dto.ts src/products/product.mapper.spec.ts src/products/products.service.spec.ts src/reviews/reviews.controller.ts src/reviews/reviews.service.spec.ts src/reviews/reviews.service.ts
    git commit -m "style: fix eslint violations in catalog module"

Sau đó commit phần Task 7 (admin CRUD) và Task 8 (Swagger) — đây là code ĐÃ VIẾT XONG và test đã pass, chỉ chưa commit, đúng theo Step cuối của Task 7 và Task 8 trong file plan:

    git add src/products/products.controller.ts src/products/products.service.ts src/products/dto/create-product.dto.ts src/products/dto/update-product.dto.ts
    git commit -m "feat(products): add admin CRUD with variant upsert and soft delete"

    git add src/main.ts
    git commit -m "docs(swagger): update M2 tag descriptions"

(Nếu git add src/main.ts báo "nothing to commit" ở bước cuối vì đã commit chung ở bước style, bỏ qua bước đó, không sao.)

Cuối cùng chạy: git log --oneline -10
Báo cáo cho tôi danh sách commit mới, và xác nhận npm run test + npm run build đều xanh.
```

**Nghiệm thu session 6:**
- `npm run test -- reviews` → 8 case (thêm 1)
- `npx eslint src/products src/categories src/reviews src/main.ts` → không output gì
- `npm run test` toàn bộ vẫn xanh, `npm run build` không lỗi
- `git log --oneline` có đủ commit mới cho: fix reviews, style eslint, admin CRUD, swagger tags

---

## Session 7 — Khôi phục 2 test case bị mất khi sửa lint ở Session 6

> Phát hiện khi verify lại sau Session 6: tổng số test giảm từ 66 xuống 65, đáng lẽ phải tăng lên 67 (thêm 1 case mới của Session 6). Commit `666d05b style: fix eslint violations in catalog module` đã sửa lint dựa trên một phiên bản CŨ của `products.service.spec.ts` (dừng ngay sau describe `findOne`), làm mất nguyên khối `describe('ProductsService — admin CRUD', ...)` — 2 test canh giữ đúng 2 quy tắc an toàn quan trọng nhất: xóa sản phẩm phải là soft-delete, sửa variant phải upsert chứ không xóa. Code service.ts vẫn đúng, chỉ có test biến mất.

```
Backend NestJS cho đồ án app bán quần áo. Tôi là Member 2. Phát hiện một lỗi nghiêm trọng: khi bạn (agent trước) sửa lỗi ESLint ở commit "style: fix eslint violations in catalog module", file src/products/products.service.spec.ts đã bị mất 2 test case — cả 2 đều nằm trong describe('ProductsService — admin CRUD', ...) mà đáng lẽ phải có ở CUỐI file, sau describe('ProductsService.findOne', ...).

Đây là 2 test quan trọng nhất trong cả module: chúng đảm bảo xóa sản phẩm không xóa cứng (tránh vỡ khóa ngoại với OrderItem) và sửa sản phẩm không xóa variant cũ (tránh vỡ khóa ngoại với CartItem/OrderItem đang tham chiếu).

Code trong src/products/products.service.ts (method remove và update) vẫn đúng, không cần sửa. Chỉ cần thêm lại đúng khối test đã mất vào CUỐI file src/products/products.service.spec.ts (sau dòng cuối cùng, ngoài describe findOne, KHÔNG sửa gì bên trong 2 describe hiện có):

describe('ProductsService — admin CRUD', () => {
  const productUpdate = jest.fn();
  const productFindUnique = jest.fn();
  const imageDeleteMany = jest.fn();
  const imageCreateMany = jest.fn();
  const variantUpsert = jest.fn();
  const variantDeleteMany = jest.fn();

  const tx = {
    product: { update: productUpdate, findUnique: productFindUnique },
    productImage: { deleteMany: imageDeleteMany, createMany: imageCreateMany },
    productVariant: { upsert: variantUpsert, deleteMany: variantDeleteMany },
  };

  const prisma = {
    product: { update: productUpdate, findUnique: productFindUnique },
    $transaction: jest.fn(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    ),
  } as unknown as PrismaService;

  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(prisma);
    productFindUnique.mockResolvedValue({
      id: 'p1',
      categoryId: 'c1',
      category: { name: 'Áo' },
      name: 'Áo',
      description: null,
      basePrice: { toString: () => '250000' },
      status: 'active',
      createdAt: new Date('2026-01-01'),
      images: [],
      reviews: [],
      variants: [],
    });
    productUpdate.mockResolvedValue({ id: 'p1' });
  });

  it('remove chỉ đổi status thành inactive, không xóa cứng', async () => {
    await service.remove('p1');

    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { status: 'inactive' },
      }),
    );
  });

  it('update upsert variant và KHÔNG xóa variant cũ', async () => {
    await service.update('p1', {
      variants: [
        { size: 'M', color: 'Đen', price: 260000, stockQty: 5, sku: 'A-M-D' },
      ],
    });

    expect(variantUpsert).toHaveBeenCalledWith({
      where: {
        productId_size_color: { productId: 'p1', size: 'M', color: 'Đen' },
      },
      create: {
        productId: 'p1',
        size: 'M',
        color: 'Đen',
        price: 260000,
        stockQty: 5,
        sku: 'A-M-D',
      },
      update: { price: 260000, stockQty: 5, sku: 'A-M-D' },
    });
    expect(variantDeleteMany).not.toHaveBeenCalled();
  });
});

Lưu ý: dòng $transaction ở trên cố ý KHÔNG dùng async (callback đã tự trả Promise), để không tái tạo lại lỗi ESLint require-await đã sửa trước đó.

Sau khi thêm xong, chạy CHÍNH XÁC các lệnh sau và cho tôi xem output đầy đủ, không tóm tắt:

npm run test -- products.service
npm run test
npx eslint src/products src/categories src/reviews src/main.ts
npm run build

Yêu cầu bắt buộc phải đạt, tự kiểm tra trước khi báo cáo xong:
1. npm run test -- products.service phải hiện đúng 15 test pass (13 cũ + 2 vừa thêm lại)
2. npm run test (toàn bộ project) phải hiện đúng 67 test pass — KHÔNG phải 65, KHÔNG phải 66
3. npx eslint phải không có output gì
4. npm run build không lỗi

Nếu con số không khớp CHÍNH XÁC như trên, đừng commit — tìm và sửa cho đúng trước.

Commit:
git add src/products/products.service.spec.ts
git commit -m "test(products): restore admin CRUD test cases dropped during lint fix"

git log --oneline -5 để xác nhận, rồi báo cáo lại toàn bộ 4 con số ở trên cho tôi.
```

**Nghiệm thu session 7:**
- `npm run test -- products.service` → **15 passed** (đúng con số, không phải 13)
- `npm run test` toàn bộ → **67 passed** (đúng con số tuyệt đối, không chỉ "xanh")
- `npx eslint src/products src/categories src/reviews src/main.ts` → không output
- Có commit mới `test(products): restore admin CRUD...`

> **Bài học áp dụng cho các session sau:** đừng chỉ hỏi agent "test có pass không" — luôn yêu cầu **con số tuyệt đối** và tự đối chiếu với con số kỳ vọng đã biết trước. "PASS" có thể đúng ngay cả khi test đã bị xóa mất, miễn là những test còn lại vẫn xanh.

---

## Khi agent làm sai

| Triệu chứng | Nguyên nhân thường gặp | Cách sửa |
|---|---|---|
| `basePrice` trả về là string `"250000"` | Quên `Number()` trong mapper | Kiểm tra `toNumber()` trong `product.mapper.ts` |
| `GET /products/:id/reviews` báo lỗi uuid không hợp lệ | Route `:id/reviews` khai báo SAU `:id` | Đổi thứ tự trong `products.controller.ts` |
| Server không khởi động, báo circular dependency | `ReviewsService` inject `ProductsService` | Bỏ đi, chỉ dùng `PrismaService` |
| Endpoint public trả 401 | Thiếu `@Public()` | Thêm decorator |
| Test fail vì `Test.createTestingModule` | Agent tự ý đổi pattern | Bắt viết lại theo `addresses.service.spec.ts` |
| `prisma migrate` bị gọi | Agent tưởng cần đổi schema | Hoàn tác, nhắc lại là schema đã đủ field |
