import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
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
    isActive?: boolean;
    role?: Role;
  };
  select: typeof SAFE_USER_SELECT;
}

interface OtpCreateArgs {
  data: {
    userId: string;
    identifier: string;
    codeHash: string;
    expiresAt: Date;
  };
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
  const userUpdate = jest.fn();
  const userCreate = jest.fn((args: UserCreateArgs): Promise<SafeUser> => {
    void args;
    return Promise.resolve(safeUser);
  });
  const otpChallengeCreate = jest.fn((args: OtpCreateArgs): Promise<void> => {
    void args;
    return Promise.resolve();
  });
  const otpChallengeFindFirst = jest.fn();
  const otpChallengeUpdate = jest.fn();
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
      update: userUpdate,
    },
    otpChallenge: {
      create: otpChallengeCreate,
      findFirst: otpChallengeFindFirst,
      update: otpChallengeUpdate,
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
    NODE_ENV: 'test',
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
        isActive: args.data.isActive ?? true,
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
      isActive: false,
    });
    expect(createdUserArgs?.select).toBe(SAFE_USER_SELECT);
    const createData = createdUserArgs?.data;
    expect(createData).toBeDefined();
    await expect(
      bcrypt.compare('Password123!', createData!.passwordHash),
    ).resolves.toBe(true);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(otpChallengeCreate).toHaveBeenCalled();
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

  it('kích hoạt tài khoản và tự đăng nhập sau khi xác thực OTP đúng', async () => {
    const pendingUser = { ...safeUser, isActive: false };
    const codeHash = await bcrypt.hash('123456', 4);
    userFindFirst.mockResolvedValue(pendingUser);
    otpChallengeFindFirst.mockResolvedValue({
      id: 'otp-1',
      userId: safeUser.id,
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      maxAttempts: 5,
    });
    otpChallengeUpdate.mockResolvedValue(undefined);
    userUpdate.mockResolvedValue(safeUser);

    const result = await service.verifyRegistrationOtp({
      identifier: ' USER@EXAMPLE.COM ',
      otp: '123456',
    });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: safeUser.id },
      data: { isActive: true },
      select: SAFE_USER_SELECT,
    });
    expect(otpChallengeUpdate).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { consumedAt: expect.any(Date) as unknown },
    });
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: safeUser,
    });
  });

  it('khóa phiên OTP sau lần nhập sai thứ 5', async () => {
    const codeHash = await bcrypt.hash('123456', 4);
    userFindFirst.mockResolvedValue({ ...safeUser, isActive: false });
    otpChallengeFindFirst.mockResolvedValue({
      id: 'otp-1',
      userId: safeUser.id,
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 4,
      maxAttempts: 5,
    });
    otpChallengeUpdate.mockResolvedValue(undefined);

    let thrown: unknown;
    try {
      await service.verifyRegistrationOtp({
        identifier: safeUser.email!,
        otp: '000000',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect(otpChallengeUpdate).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { attempts: 5 },
    });
  });

  it('giới hạn tối đa 3 lần gửi lại OTP', async () => {
    userFindFirst.mockResolvedValue({ ...safeUser, isActive: false });
    otpChallengeFindFirst.mockResolvedValue({
      id: 'otp-1',
      userId: safeUser.id,
      lastSentAt: new Date(Date.now() - 61_000),
      resendCount: 3,
    });

    let thrown: unknown;
    try {
      await service.resendRegistrationOtp({ identifier: safeUser.email! });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect(otpChallengeUpdate).not.toHaveBeenCalled();
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
