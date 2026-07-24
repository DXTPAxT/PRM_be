import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT, SafeUser } from './user.types';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const userFindUnique = jest.fn();
  const userUpdate = jest.fn();
  const refreshTokenUpdateMany = jest.fn();
  const prisma = {
    user: {
      findUnique: userFindUnique,
      update: userUpdate,
    },
    refreshToken: {
      updateMany: refreshTokenUpdateMany,
    },
  } as unknown as PrismaService;

  const safeUser: SafeUser = {
    id: 'user-1',
    fullName: 'Nguyễn Văn A',
    email: 'user@example.com',
    phone: '0901234567',
    role: Role.customer,
    isActive: true,
    createdAt: new Date('2026-07-19T00:00:00.000Z'),
    updatedAt: new Date('2026-07-19T00:00:00.000Z'),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma);
    userUpdate.mockResolvedValue(safeUser);
    refreshTokenUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('cập nhật profile và chuẩn hóa email/số điện thoại', async () => {
    userFindUnique
      .mockResolvedValueOnce({ email: safeUser.email, phone: safeUser.phone })
      .mockResolvedValue(null);

    await service.updateProfile('user-1', {
      fullName: '  Nguyễn Văn B  ',
      email: ' NEW@EXAMPLE.COM ',
      phone: ' 0909999888 ',
    });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        fullName: 'Nguyễn Văn B',
        email: 'new@example.com',
        phone: '0909999888',
      },
      select: SAFE_USER_SELECT,
    });
  });

  it('từ chối email trùng với tài khoản khác', async () => {
    userFindUnique
      .mockResolvedValueOnce({ email: safeUser.email, phone: safeUser.phone })
      .mockResolvedValueOnce({ id: 'other-user' });

    await expect(
      service.updateProfile('user-1', { email: 'other@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('đổi mật khẩu khi mật khẩu cũ chính xác và thu hồi session', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    userFindUnique.mockResolvedValue({ ...safeUser, passwordHash });

    await service.changePassword('user-1', {
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
    });

    const updateCall = (
      userUpdate.mock.calls[0] as unknown as [
        {
          data: {
            passwordHash: string;
            failedLoginAttempts: number;
            lockedUntil: Date | null;
          };
        },
      ]
    )[0];
    await expect(
      bcrypt.compare('NewPassword123!', updateCall.data.passwordHash),
    ).resolves.toBe(true);
    expect(updateCall.data).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revoked: false },
      data: { revoked: true },
    });
  });

  it('từ chối đổi mật khẩu nếu mật khẩu cũ không chính xác', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    userFindUnique.mockResolvedValue({ ...safeUser, passwordHash });

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'wrong-password',
        newPassword: 'NewPassword123!',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Mật khẩu hiện tại không chính xác',
    });
    expect(userUpdate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('giữ lỗi 401 khi tài khoản xác thực không còn tồn tại', async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('missing-user', {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('không cho phép tài khoản mất cả email và số điện thoại', async () => {
    userFindUnique.mockResolvedValueOnce({ email: null, phone: '0901234567' });

    await expect(
      service.updateProfile('user-1', { phone: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
