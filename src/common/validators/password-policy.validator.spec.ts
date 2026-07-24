import { validate } from 'class-validator';
import { LoginDto } from '../../auth/dto/login.dto';
import { RegisterDto } from '../../auth/dto/register.dto';
import { ResetPasswordDto } from '../../auth/dto/reset-password.dto';
import { ChangePasswordDto } from '../../users/dto/change-password.dto';

const VALID_PASSWORDS = [
  ['đủ các thành phần bắt buộc', 'Password1@'],
  ['không có chữ thường', 'PASSWORD1@'],
] as const;

const INVALID_PASSWORDS = [
  ['ít hơn 8 ký tự', 'Ab1!'],
  ['không có chữ hoa ASCII', 'password1!'],
  ['không có chữ số ASCII', 'Password!'],
  ['không có ký tự đặc biệt', 'Password1'],
  ['chỉ có khoảng trắng thay cho ký tự đặc biệt', 'Password1 '],
  ['chỉ có chữ Unicode thay cho ký tự đặc biệt', 'Password1Đ'],
  ['chỉ có ký hiệu ngoài danh sách ASCII', 'Password1🙂'],
] as const;

function createRegisterDto(password: string): RegisterDto {
  return Object.assign(new RegisterDto(), {
    fullName: 'Nguyễn Văn A',
    email: 'user@example.com',
    password,
  });
}

function createResetPasswordDto(newPassword: string): ResetPasswordDto {
  return Object.assign(new ResetPasswordDto(), {
    identifier: 'user@example.com',
    otp: '123456',
    newPassword,
  });
}

function createChangePasswordDto(newPassword: string): ChangePasswordDto {
  return Object.assign(new ChangePasswordDto(), {
    currentPassword: 'legacy-password',
    newPassword,
  });
}

async function hasValidationError(
  dto: object,
  property: string,
): Promise<boolean> {
  const errors = await validate(dto);
  return errors.some((error) => error.property === property);
}

describe('Password policy DTO validation', () => {
  it.each(INVALID_PASSWORDS)(
    'từ chối mật khẩu mới khi %s',
    async (_description, password) => {
      await expect(
        hasValidationError(createRegisterDto(password), 'password'),
      ).resolves.toBe(true);
      await expect(
        hasValidationError(createResetPasswordDto(password), 'newPassword'),
      ).resolves.toBe(true);
      await expect(
        hasValidationError(createChangePasswordDto(password), 'newPassword'),
      ).resolves.toBe(true);
    },
  );

  it.each(VALID_PASSWORDS)(
    'chấp nhận mật khẩu %s',
    async (_description, password) => {
      const validationResults = await Promise.all([
        validate(createRegisterDto(password)),
        validate(createResetPasswordDto(password)),
        validate(createChangePasswordDto(password)),
      ]);

      expect(validationResults).toEqual([[], [], []]);
    },
  );

  it('không áp dụng độ phức tạp cho mật khẩu đăng nhập hiện tại', async () => {
    const loginDto = Object.assign(new LoginDto(), {
      identifier: 'user@example.com',
      password: 'legacy',
    });

    await expect(validate(loginDto)).resolves.toEqual([]);
    await expect(
      validate(createChangePasswordDto('Password1@')),
    ).resolves.toEqual([]);
  });
});
