import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'node:crypto';
import type { StringValue } from 'ms';
import { OtpPurpose, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SAFE_USER_SELECT, SafeUser } from '../users/user.types';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload';
import * as bcrypt from 'bcryptjs';

/**
 * Parse duration string (e.g. "15m", "7d") to milliseconds.
 * Supported units: s, m, h, d
 */
function parseDuration(value: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match)
    throw new Error(
      `Invalid duration format: ${value} (expected e.g. 15m, 7d)`,
    );
  return parseInt(match[1]) * units[match[2]];
}

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_RESENDS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

export interface OtpChallengeResponse {
  identifier: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  remainingResends: number;
  debugOtp?: string;
}

class OtpRateLimitException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();

    if (!email && !phone) {
      throw new BadRequestException('Phải cung cấp email hoặc số điện thoại');
    }

    // Kiểm tra trùng email/phone
    if (email) {
      const exists = await this.prisma.user.findUnique({
        where: { email },
      });
      if (exists) throw new ConflictException('Email đã được sử dụng');
    }
    if (phone) {
      const exists = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (exists) throw new ConflictException('Số điện thoại đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        phone,
        passwordHash,
        role: Role.customer,
        isActive: false,
      },
      select: SAFE_USER_SELECT,
    });

    const identifier = email ?? phone!;
    const challenge = await this.createOtpChallenge(user.id, identifier);

    return { user, challenge };
  }

  async verifyRegistrationOtp(dto: VerifyOtpDto) {
    const identifier = this.normalizeIdentifier(dto.identifier);
    const user = await this.findUserByIdentifier(identifier);

    if (!user) {
      throw new BadRequestException(
        'Email/số điện thoại hoặc OTP không hợp lệ',
      );
    }
    if (user.isActive) {
      throw new BadRequestException('Tài khoản đã được xác thực');
    }

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.registration,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new BadRequestException('OTP đã hết hạn. Vui lòng gửi lại OTP');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new OtpRateLimitException(
        'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng gửi lại OTP',
      );
    }

    const isValid = await bcrypt.compare(dto.otp, challenge.codeHash);
    if (!isValid) {
      const attempts = challenge.attempts + 1;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts },
      });
      if (attempts >= challenge.maxAttempts) {
        throw new OtpRateLimitException(
          'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng gửi lại OTP',
        );
      }
      throw new BadRequestException(
        `OTP không chính xác. Bạn còn ${challenge.maxAttempts - attempts} lần thử`,
      );
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    const activatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: true },
      select: SAFE_USER_SELECT,
    });
    const tokens = await this.issueTokenPair(activatedUser);

    return { ...tokens, user: activatedUser };
  }

  async resendRegistrationOtp(
    dto: ResendOtpDto,
  ): Promise<OtpChallengeResponse> {
    const identifier = this.normalizeIdentifier(dto.identifier);
    const user = await this.findUserByIdentifier(identifier);

    if (!user || user.isActive) {
      throw new BadRequestException('Không thể gửi lại OTP cho tài khoản này');
    }

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.registration,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new BadRequestException(
        'Không tìm thấy phiên đăng ký cần xác thực',
      );
    }

    const now = Date.now();
    const nextAllowedAt =
      challenge.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS;
    if (now < nextAllowedAt) {
      const seconds = Math.ceil((nextAllowedAt - now) / 1000);
      throw new OtpRateLimitException(
        `Vui lòng chờ ${seconds} giây trước khi gửi lại OTP`,
      );
    }
    if (challenge.resendCount >= OTP_MAX_RESENDS) {
      throw new OtpRateLimitException(
        'Bạn đã vượt quá số lần gửi lại OTP cho phép',
      );
    }

    return this.rotateOtpChallenge(
      challenge.id,
      identifier,
      challenge.resendCount,
    );
  }

  /**
   * Gửi OTP khôi phục mật khẩu.
   *
   * Hàm luôn hoàn thành im lặng khi không tìm thấy tài khoản để controller có
   * thể trả cùng một thông báo cho mọi email/số điện thoại.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const identifier = this.normalizeIdentifier(dto.identifier);
    const user = await this.findUserByIdentifier(identifier);

    if (!user || !user.isActive) return;

    try {
      await this.createOtpChallenge(
        user.id,
        identifier,
        OtpPurpose.password_reset,
        user.email ?? identifier,
      );
    } catch (error: unknown) {
      const trace = error instanceof Error ? error.stack : undefined;
      this.logger.error('Không thể gửi OTP khôi phục mật khẩu', trace);
    }
  }

  /**
   * Xác thực OTP reset, đổi password và thu hồi mọi refresh session cũ.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const identifier = this.normalizeIdentifier(dto.identifier);
    const user = await this.findUserByIdentifier(identifier);
    const invalidMessage = 'OTP hoặc thông tin khôi phục không hợp lệ';

    if (!user || !user.isActive) {
      throw new BadRequestException(invalidMessage);
    }

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.password_reset,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new BadRequestException('OTP đã hết hạn hoặc không hợp lệ');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new OtpRateLimitException(
        'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu OTP mới',
      );
    }

    const isValid = await bcrypt.compare(dto.otp, challenge.codeHash);
    if (!isValid) {
      const attempts = challenge.attempts + 1;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts },
      });
      if (attempts >= challenge.maxAttempts) {
        throw new OtpRateLimitException(
          'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu OTP mới',
        );
      }
      throw new BadRequestException(
        `OTP không chính xác. Bạn còn ${challenge.maxAttempts - attempts} lần thử`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: SAFE_USER_SELECT,
    });
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    await this.prisma.otpChallenge.updateMany({
      where: {
        userId: user.id,
        purpose: OtpPurpose.password_reset,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    await this.revokeAllSessions(user.id);
  }

  private normalizeIdentifier(identifier: string): string {
    const normalized = identifier.trim();
    return normalized.includes('@') ? normalized.toLowerCase() : normalized;
  }

  private async findUserByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
      select: SAFE_USER_SELECT,
    });
  }

  private async createOtpChallenge(
    userId: string,
    identifier: string,
    purpose: OtpPurpose = OtpPurpose.registration,
    recipient: string = identifier,
  ): Promise<OtpChallengeResponse> {
    const code = this.generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.prisma.otpChallenge.create({
      data: {
        userId,
        identifier,
        purpose,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt,
        maxAttempts: OTP_MAX_ATTEMPTS,
        lastSentAt: now,
      },
    });
    await this.dispatchOtp(recipient, code, purpose);
    return this.toOtpResponse(identifier, expiresAt, OTP_MAX_RESENDS, code);
  }

  private async rotateOtpChallenge(
    challengeId: string,
    identifier: string,
    currentResendCount: number,
  ): Promise<OtpChallengeResponse> {
    const code = this.generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.prisma.otpChallenge.update({
      where: { id: challengeId },
      data: {
        codeHash: await bcrypt.hash(code, 10),
        expiresAt,
        attempts: 0,
        resendCount: currentResendCount + 1,
        lastSentAt: now,
      },
    });
    await this.dispatchOtp(identifier, code, OtpPurpose.registration);
    return this.toOtpResponse(
      identifier,
      expiresAt,
      OTP_MAX_RESENDS - currentResendCount - 1,
      code,
    );
  }

  private toOtpResponse(
    identifier: string,
    expiresAt: Date,
    remainingResends: number,
    code: string,
  ): OtpChallengeResponse {
    const response: OtpChallengeResponse = {
      identifier,
      expiresAt,
      resendAvailableAt: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS),
      remainingResends,
    };
    if (
      (this.configService.get<string>('NODE_ENV') ?? 'development') !==
      'production'
    ) {
      response.debugOtp = code;
    }
    return response;
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async dispatchOtp(
    identifier: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    if (!identifier.includes('@')) {
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(
          `Nhà cung cấp SMS chưa được cấu hình. OTP cho ${identifier}: ${code}`,
        );
        return;
      }
      this.logger.warn(`Nhà cung cấp SMS chưa được cấu hình cho ${identifier}`);
      throw new ServiceUnavailableException(
        'Hiện tại hệ thống chỉ hỗ trợ gửi OTP qua email',
      );
    }

    await this.mailService.sendOtp(identifier, code, purpose);
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();

    // Tìm user theo email hoặc phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
      select: {
        ...SAFE_USER_SELECT,
        passwordHash: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email/phone hoặc mật khẩu không đúng');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản chưa được xác thực OTP');
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 60000,
      );
      throw new UnauthorizedException(
        `Tài khoản tạm bị khóa. Vui lòng thử lại sau khoảng ${minutes} phút`,
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = failedAttempts >= LOGIN_MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock
            ? LOGIN_MAX_FAILED_ATTEMPTS
            : failedAttempts,
          lockedUntil,
        },
        select: SAFE_USER_SELECT,
      });

      if (shouldLock) {
        throw new UnauthorizedException(
          'Bạn đã nhập sai quá số lần cho phép. Tài khoản bị khóa tạm thời 15 phút',
        );
      }
      throw new UnauthorizedException('Email/phone hoặc mật khẩu không đúng');
    }

    const safeUser: SafeUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: SAFE_USER_SELECT,
    });
    const tokens = await this.issueTokenPair(safeUser);

    return { ...tokens, user: safeUser };
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    // 1. Verify chữ ký JWT
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    // 2. Tìm tất cả refresh token còn hạn và chưa revoke của user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    // 3. So khớp bcrypt hash
    let matchedToken: (typeof storedTokens)[0] | undefined;
    for (const stored of storedTokens) {
      const match = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
      if (match) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã bị thu hồi',
      );
    }

    // 4. Revoke token cũ (rotation pattern)
    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked: true },
    });

    // 5. Lấy user và cấp cặp token mới
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: SAFE_USER_SELECT,
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Tài khoản không hợp lệ');

    return this.issueTokenPair(user);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async issueTokenPair(user: SafeUser) {
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      role: user.role,
      tokenType: 'access',
      jti: randomUUID(),
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenType: 'refresh',
      jti: randomUUID(),
    };

    const accessToken = this.jwtService.sign(accessPayload);

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      algorithm: 'HS256',
      expiresIn: refreshExpiresIn as StringValue,
    });

    // Lưu hash của refresh token vào DB để có thể revoke
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + parseDuration(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  /**
   * Thu hồi một refresh token cụ thể (UC-02).
   * Gọi khi user logout trên thiết bị hiện tại.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
      });
    } catch {
      // Token hết hạn hoặc không hợp lệ → coi như đã logout
      return;
    }

    if (payload.tokenType !== 'refresh') return;

    const storedTokens = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revoked: false },
    });

    for (const stored of storedTokens) {
      const match = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
      if (match) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revoked: true },
        });
        break;
      }
    }
  }

  /**
   * Thu hồi TẤT CẢ phiên của user (dùng khi đổi mật khẩu - UC-03).
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
