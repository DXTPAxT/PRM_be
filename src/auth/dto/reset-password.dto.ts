import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {
  IsValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from '../../common/validators/password-policy.validator';

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
    description: 'Mã OTP nhận được qua email',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP phải gồm đúng 6 chữ số' })
  otp!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: PASSWORD_POLICY_MESSAGE,
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @IsValidPassword()
  newPassword!: string;
}
