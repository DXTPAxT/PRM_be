import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * Mọi field đều optional.
 * Lưu ý: variants được UPSERT chứ không replace-all —
 * CartItem/OrderItem tham chiếu ProductVariant không cascade,
 * xóa variant đang nằm trong giỏ/đơn sẽ lỗi khóa ngoại.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
