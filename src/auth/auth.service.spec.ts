import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT, SafeUser } from '../users/user.types';
import { AuthService } from './auth.service';

interface UserCreateArgs {
  data: {
    fullName: string;
    email?: string;
    phone?: string;
    passwordHash: string;
  };
  select: typeof SAFE_USER_SELECT;
}

interface RefreshTokenCreateArgs {
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  };
}

interface SignedPayload {
  tokenType: string;
  jti: string;
}

describe('AuthService', () => {
  const userFindUnique = jest.fn();
  const userFindFirst = jest.fn();
  const userCreate = jest.fn((args: UserCreateArgs): Promise<SafeUser> => {
    void args;
    return Promise.resolve(safeUser);
  });
  const refreshTokenCreate = jest.fn(
    (args: RefreshTokenCreateArgs): Promise<void> => {
      void args;
      return Promise.resolve();
    },
  );
  const refreshTokenFindMany = jest.fn();
  const refreshTokenUpdate = jest.fn();
  const refreshTokenUpdateMany = jest.fn();
  const jwtSign = jest.fn((payload: SignedPayload): string => {
    void payload;
    return 'token';
  });
  const jwtVerify = jest.fn();

  const prisma = {
    user: {
      findUnique: userFindUnique,
      findFirst: userFindFirst,
      create: userCreate,
    },
    refreshToken: {
      create: refreshTokenCreate,
      findMany: refreshTokenFindMany,
      update: refreshTokenUpdate,
      updateMany: refreshTokenUpdateMany,
    },
  } as unknown as PrismaService;

  const jwtService = {
    sign: jwtSign,
    verify: jwtVerify,
  } as unknown as JwtService;

  const configValues: Record<string, string> = {
    JWT_SECRET: 'access-secret-at-least-32-characters',
    JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-characters',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
    getOrThrow: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  const now = new Date('2026-07-19T00:00:00.000Z');
  const safeUser: SafeUser = {
    id: 'user-1',
    fullName: 'Nguyễn Văn A',
    email: 'user@example.com',
    phone: '0901234567',
    role: Role.customer,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  let service: AuthService;
  let createdUserArgs: UserCreateArgs | undefined;
  let createdRefreshTokenArgs: RefreshTokenCreateArgs | undefined;
  let signedPayloads: SignedPayload[];

  beforeEach(() => {
    jest.clearAllMocks();
    createdUserArgs = undefined;
    createdRefreshTokenArgs = undefined;
    signedPayloads = [];
    jwtSign.mockImplementation((payload: SignedPayload) => {
      signedPayloads.push(payload);
      return payload.tokenType === 'access' ? 'access-token' : 'refresh-token';
    });
    refreshTokenCreate.mockImplementation((args: RefreshTokenCreateArgs) => {
      createdRefreshTokenArgs = args;
      return Promise.resolve();
    });
    service = new AuthService(prisma, jwtService, configService);
  });

  it('chuẩn hóa dữ liệu, hash password và không trả passwordHash khi register', async () => {
    userFindUnique.mockResolvedValue(null);
    userCreate.mockImplementation((args: UserCreateArgs) => {
      createdUserArgs = args;
      return Promise.resolve({
        ...safeUser,
        fullName: args.data.fullName,
        email: args.data.email ?? null,
        phone: args.data.phone ?? null,
      });
    });

    const result = await service.register({
      fullName: '  Nguyễn Văn A  ',
      email: '  USER@EXAMPLE.COM ',
      phone: ' 0901234567 ',
      password: 'Password123!',
    });

    expect(createdUserArgs?.data).toMatchObject({
      fullName: 'Nguyễn Văn A',
      email: 'user@example.com',
      phone: '0901234567',
    });
    expect(createdUserArgs?.select).toBe(SAFE_USER_SELECT);
    const createData = createdUserArgs?.data;
    expect(createData).toBeDefined();
    await expect(
      bcrypt.compare('Password123!', createData!.passwordHash),
    ).resolves.toBe(true);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('từ chối register nếu thiếu cả email và phone', async () => {
    await expect(
      service.register({
        fullName: 'Nguyễn Văn A',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trả token cùng safe user khi login và lưu refresh token dạng hash', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    userFindFirst.mockResolvedValue({ ...safeUser, passwordHash });

    const result = await service.login({
      identifier: ' USER@EXAMPLE.COM ',
      password: 'Password123!',
    });

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: safeUser,
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'user@example.com' }, { phone: 'user@example.com' }],
      },
      select: { ...SAFE_USER_SELECT, passwordHash: true },
    });

    const [accessPayload, refreshPayload] = signedPayloads;
    expect(accessPayload).toMatchObject({ tokenType: 'access' });
    expect(refreshPayload).toMatchObject({ tokenType: 'refresh' });
    expect(accessPayload.jti).not.toBe(refreshPayload.jti);

    const storedHash = createdRefreshTokenArgs?.data.tokenHash;
    expect(storedHash).toBeDefined();
    expect(storedHash).not.toBe('refresh-token');
    await expect(bcrypt.compare('refresh-token', storedHash!)).resolves.toBe(
      true,
    );
  });

  it('không chấp nhận access token tại endpoint refresh', async () => {
    jwtVerify.mockReturnValue({
      sub: safeUser.id,
      tokenType: 'access',
      jti: 'access-jti',
    });

    await expect(service.refresh('access-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokenFindMany).not.toHaveBeenCalled();
  });
});
