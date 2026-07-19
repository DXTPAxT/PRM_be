import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SAFE_USER_SELECT, SafeUser } from '../../users/user.types';
import { AccessTokenPayload } from '../types/jwt-payload';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const userFindUnique = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique },
  } as unknown as PrismaService;
  const configService = {
    getOrThrow: jest.fn(() => 'access-secret-at-least-32-characters'),
  } as unknown as ConfigService;

  const payload: AccessTokenPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: Role.customer,
    tokenType: 'access',
    jti: 'access-jti',
  };
  const now = new Date('2026-07-19T00:00:00.000Z');
  const safeUser: SafeUser = {
    id: 'user-1',
    fullName: 'Nguyễn Văn A',
    email: 'user@example.com',
    phone: null,
    role: Role.customer,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(configService, prisma);
  });

  it('chỉ gắn safe user vào request', async () => {
    userFindUnique.mockResolvedValue(safeUser);

    await expect(strategy.validate(payload)).resolves.toEqual(safeUser);
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: payload.sub },
      select: SAFE_USER_SELECT,
    });
  });

  it('từ chối payload không phải access token', async () => {
    await expect(
      strategy.validate({
        ...payload,
        tokenType: 'refresh',
      } as unknown as AccessTokenPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('từ chối tài khoản đã bị khóa', async () => {
    userFindUnique.mockResolvedValue({ ...safeUser, isActive: false });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
