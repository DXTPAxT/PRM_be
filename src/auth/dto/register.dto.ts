import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên đầy đủ' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email (bắt buộc nếu không có phone)',
  })
  @ValidateIf((o: RegisterDto) => !o.phone)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'Số điện thoại (bắt buộc nếu không có email)',
  })
  @ValidateIf((o: RegisterDto) => !o.email)
  @IsString()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Mật khẩu tối thiểu 8 ký tự',
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  password: string;
}
