import { Prisma } from '@prisma/client';

/**
 * Các trường user an toàn để trả qua API hoặc gắn vào request.user.
 * Tuyệt đối không đưa passwordHash hay refresh token ra khỏi service layer.
 */
export const SAFE_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{
  select: typeof SAFE_USER_SELECT;
}>;
