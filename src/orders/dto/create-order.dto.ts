import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  addressId!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  voucherId?: string;

  // Địa chỉ giao hàng theo mã GHN — FE gửi từ dropdown tỉnh/quận/phường của GHN.
  // Dùng để tính phí ship. Optional: nếu thiếu → phí ship = 0 (fallback).
  @ApiPropertyOptional({
    description: 'Mã quận/huyện GHN của địa chỉ giao hàng',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  toDistrictId?: number;

  @ApiPropertyOptional({
    description: 'Mã phường/xã GHN của địa chỉ giao hàng',
  })
  @IsOptional()
  @IsString()
  toWardCode?: string;
}
