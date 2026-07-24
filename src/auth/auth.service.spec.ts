import {
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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
  const otpChallengeUpdateMany = jest.fn();
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
  const mailSendOtp = jest.fn<Promise<void>, [string, string, OtpPurpose]>();

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
      updateMany: otpChallengeUpdateMany,
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

  const mailService = {
    sendOtp: mailSendOtp,
  } as unknown as MailService;

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
    userFindUnique.mockResolvedValue(null);
    userUpdate.mockResolvedValue(safeUser);
    mailSendOtp.mockResolvedValue(undefined);
    service = new AuthService(prisma, jwtService, configService, mailService);
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
    expect(result.challenge).not.toHaveProperty('debugOtp');
    expect(otpChallengeCreate).toHaveBeenCalled();
    expect(mailSendOtp).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringMatching(/^\d{6}$/),
      OtpPurpose.registration,
    );
  });

  it('từ chối register nếu thiếu cả email và phone', async () => {
    await expect(
      service.register({
        fullName: 'Nguyễn Văn A',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cho phép đăng ký lại email chưa xác thực và phát hành OTP mới', async () => {
    const pendingUser: SafeUser = { ...safeUser, isActive: false };
    userFindUnique
      .mockResolvedValueOnce(pendingUser)
      .mockResolvedValueOnce(null);
    userUpdate.mockResolvedValue({
      ...pendingUser,
      fullName: 'Tên mới',
      phone: '0987654321',
    });

    const result = await service.register({
      fullName: '  Tên mới  ',
      email: '  USER@EXAMPLE.COM ',
      phone: ' 0987654321 ',
      password: 'NewPassword123!',
    });

    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: pendingUser.id },
      data: expect.objectContaining({
        fullName: 'Tên mới',
        email: 'user@example.com',
        phone: '0987654321',
        isActive: false,
      }),
      select: SAFE_USER_SELECT,
    });
    expect(otpChallengeUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: pendingUser.id,
        purpose: OtpPurpose.registration,
        consumedAt: null,
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(otpChallengeCreate).toHaveBeenCalled();
    expect(mailSendOtp).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringMatching(/^\d{6}$/),
      OtpPurpose.registration,
    );
    expect(result.user.isActive).toBe(false);
  });

  it('vẫn từ chối đăng ký khi email đã được xác thực', async () => {
    userFindUnique.mockResolvedValueOnce(safeUser);

    await expect(
      service.register({
        fullName: 'Nguyễn Văn A',
        email: 'user@example.com',
        phone: '0901234567',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(otpChallengeCreate).not.toHaveBeenCalled();
  });

  it('trả token cùng safe user khi login và lưu refresh token dạng hash', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    userFindFirst.mockResolvedValue({
      ...safeUser,
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

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
      select: {
        ...SAFE_USER_SELECT,
        passwordHash: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: safeUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: SAFE_USER_SELECT,
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

  it('increments failed login attempts', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    userFindFirst.mockResolvedValue({
      ...safeUser,
      passwordHash,
      failedLoginAttempts: 2,
      lockedUntil: null,
    });

    await expect(
      service.login({ identifier: safeUser.email!, password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: safeUser.id },
      data: { failedLoginAttempts: 3, lockedUntil: null },
      select: SAFE_USER_SELECT,
    });
  });

  it('locks an account for 15 minutes after five failures', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    userFindFirst.mockResolvedValue({
      ...safeUser,
      passwordHash,
      failedLoginAttempts: 4,
      lockedUntil: null,
    });

    await expect(
      service.login({ identifier: safeUser.email!, password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: safeUser.id },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date) as unknown,
      },
      select: SAFE_USER_SELECT,
    });
  });

  it('rejects an account while it is temporarily locked', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    userFindFirst.mockResolvedValue({
      ...safeUser,
      passwordHash,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    await expect(
      service.login({ identifier: safeUser.email!, password: 'Password123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).not.toHaveBeenCalled();
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

  it('gửi OTP password reset nhưng không tiết lộ tài khoản không tồn tại', async () => {
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ identifier: 'unknown@example.com' }),
    ).resolves.toBeUndefined();
    expect(otpChallengeCreate).not.toHaveBeenCalled();
  });

  it('tạo challenge password reset cho tài khoản đang hoạt động', async () => {
    userFindFirst.mockResolvedValue(safeUser);

    await service.forgotPassword({ identifier: ' USER@EXAMPLE.COM ' });

    const createCall = otpChallengeCreate.mock.calls[0] as unknown as [
      {
        data: { userId: string; identifier: string; purpose: string };
      },
    ];
    expect(createCall[0].data).toMatchObject({
      userId: safeUser.id,
      identifier: 'user@example.com',
      purpose: 'password_reset',
    });
    expect(mailSendOtp).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringMatching(/^\d{6}$/),
      OtpPurpose.password_reset,
    );
  });

  it('không tiết lộ tài khoản khi dịch vụ email password reset bị lỗi', async () => {
    userFindFirst.mockResolvedValue(safeUser);
    mailSendOtp.mockRejectedValueOnce(new Error('SMTP unavailable'));

    await expect(
      service.forgotPassword({ identifier: safeUser.email! }),
    ).resolves.toBeUndefined();
    expect(otpChallengeCreate).toHaveBeenCalled();
  });

  it('đổi mật khẩu bằng OTP và thu hồi toàn bộ phiên cũ', async () => {
    const codeHash = await bcrypt.hash('123456', 4);
    userFindFirst.mockResolvedValue(safeUser);
    otpChallengeFindFirst.mockResolvedValue({
      id: 'reset-otp-1',
      userId: safeUser.id,
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      maxAttempts: 5,
    });

    await service.resetPassword({
      identifier: safeUser.email!,
      otp: '123456',
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
    expect(otpChallengeUpdate).toHaveBeenCalledWith({
      where: { id: 'reset-otp-1' },
      data: { consumedAt: expect.any(Date) as unknown },
    });
    expect(otpChallengeUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: safeUser.id,
        purpose: 'password_reset',
        consumedAt: null,
      },
      data: { consumedAt: expect.any(Date) as unknown },
    });
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: safeUser.id, revoked: false },
      data: { revoked: true },
    });
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
