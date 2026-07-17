import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/jwt-auth.guard';

/**
 * Đánh dấu endpoint là public (bỏ qua JwtAuthGuard).
 * Dùng cho: /auth/register, /auth/login, /auth/refresh, v.v.
 * @example @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
