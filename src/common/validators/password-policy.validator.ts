import { ValidateBy, type ValidationOptions } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_MESSAGE =
  'Mật khẩu phải có ít nhất 8 ký tự, gồm ít nhất 1 chữ hoa (A-Z), 1 số (0-9) và 1 ký tự đặc biệt';

const ASCII_UPPERCASE_PATTERN = /[A-Z]/;
const ASCII_DIGIT_PATTERN = /[0-9]/;
const ASCII_SPECIAL_CHARACTER_PATTERN =
  /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/;

export function isValidPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= PASSWORD_MIN_LENGTH &&
    ASCII_UPPERCASE_PATTERN.test(value) &&
    ASCII_DIGIT_PATTERN.test(value) &&
    ASCII_SPECIAL_CHARACTER_PATTERN.test(value)
  );
}

export function IsValidPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isValidPassword',
      validator: {
        validate: (value: unknown): boolean => isValidPassword(value),
        defaultMessage: (): string => PASSWORD_POLICY_MESSAGE,
      },
    },
    validationOptions,
  );
}
