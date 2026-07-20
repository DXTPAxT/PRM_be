import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Payload webhook GHN gửi về khi trạng thái vận đơn thay đổi.
 * GHN dùng PascalCase và gửi nhiều field; ta chỉ cần OrderCode + Status.
 * TODO: M3 — verify nguồn gọi (IP allowlist / shared secret) khi lên production.
 */
export class GhnWebhookDto {
  @ApiProperty({ description: 'Mã vận đơn GHN' })
  @IsString()
  OrderCode!: string;

  @ApiProperty({
    description: 'Trạng thái vận chuyển GHN (picked, delivering, delivered...)',
  })
  @IsString()
  Status!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  Type?: string;
}
