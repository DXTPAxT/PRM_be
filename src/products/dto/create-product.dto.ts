import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class ProductImageDto {
  @ApiProperty()
  @IsString()
  url!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ProductVariantDto {
  @ApiProperty({ example: 'M' })
  @IsString()
  @MaxLength(20)
  size!: string;

  @ApiProperty({ example: 'Đen' })
  @IsString()
  @MaxLength(50)
  color!: string;

  @ApiProperty({ example: 260000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  stockQty!: number;

  @ApiProperty({ example: 'AT-M-DEN' })
  @IsString()
  @MaxLength(50)
  sku!: string;
}

export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.active })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @ApiProperty({ type: [ProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants!: ProductVariantDto[];
}
