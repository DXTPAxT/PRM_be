import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
/**
 * Decorator đánh dấu role được phép truy cập endpoint.
 * Dùng cùng với RolesGuard.
 * @example @Roles('admin')
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
