import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SafeUser } from '../../users/user.types';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user?: SafeUser;
}

/**
 * Decorator lấy user hiện tại từ request (đã được JwtStrategy inject).
 * Dùng trong controller sau khi bảo vệ bằng JwtAuthGuard.
 * @example @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: keyof SafeUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
