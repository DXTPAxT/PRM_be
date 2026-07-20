import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class ApplyVoucherDto {
  @ApiProperty({ example: 'SUMMER2026' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 250000, description: 'Tổng tiền đơn trước giảm' })
  @IsNumber()
  @Min(0)
  subtotal!: number;
}