import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
  IsValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from '../../common/validators/password-policy.validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  currentPassword!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: PASSWORD_POLICY_MESSAGE,
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @IsValidPassword()
  newPassword!: string;
}
