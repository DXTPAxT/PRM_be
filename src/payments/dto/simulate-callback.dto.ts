import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * DTO nội bộ dùng để giả lập callback/webhook từ cổng thanh toán (VNPay/MoMo/ZaloPay)
 * trong lúc chưa tích hợp cổng thật. Payload thật sẽ khác tùy cổng và sẽ thay thế endpoint này.
 */
export class SimulateCallbackDto {
  @ApiProperty({ enum: ['paid', 'failed'] })
  @IsIn(['paid', 'failed'])
  result!: 'paid' | 'failed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  txnRef?: string;
}
