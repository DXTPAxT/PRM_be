import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddWishlistDto {
  @ApiProperty({ description: 'ID sản phẩm muốn thêm vào yêu thích' })
  @IsUUID()
  productId!: string;
}
