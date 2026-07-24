import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  IsValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from '../../common/validators/password-policy.validator';

export class RegisterDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên đầy đủ' })
  @IsString()
  @Length(2, 100, { message: 'Họ tên phải có từ 2 đến 100 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email (bắt buộc nếu không có phone)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'Số điện thoại (bắt buộc nếu không có email)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^0[35789][0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string;

  @ApiProperty({
    example: 'Password123!',
    description: PASSWORD_POLICY_MESSAGE,
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @IsValidPassword()
  password: string;
}
