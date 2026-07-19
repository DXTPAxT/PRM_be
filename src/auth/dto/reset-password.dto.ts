import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email hoặc số điện thoại đã yêu cầu khôi phục',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email/số điện thoại không được để trống' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  identifier!: string;

  @ApiProperty({
    example: '123456',
    description: 'Mã OTP nhận được qua email/SMS',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP phải gồm đúng 6 chữ số' })
  otp!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  newPassword!: string;
}
