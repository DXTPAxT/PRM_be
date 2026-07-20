import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVoucherDto {
  @ApiProperty({ example: 'SUMMER2026' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 50000, description: 'Số tiền giảm (VND)' })
  @IsNumber()
  @Min(0)
  discount!: number;

  @ApiPropertyOptional({ default: 0, description: 'Giá trị đơn tối thiểu' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @ApiPropertyOptional({ description: 'Giới hạn số lần sử dụng' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'Ngày hết hạn (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}