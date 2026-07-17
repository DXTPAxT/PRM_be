import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Phải cung cấp email hoặc số điện thoại');
    }

    // Kiểm tra trùng email/phone
    if (dto.email) {
      const exists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (exists) throw new ConflictException('Email đã được sử dụng');
    }
    if (dto.phone) {
      const exists = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (exists) throw new ConflictException('Số điện thoại đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        // role mặc định = customer (theo schema)
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    // TODO: [OTP] UC-01 yêu cầu gửi OTP xác thực trước khi kích hoạt account.
    // Khi M1 implement: lưu OTP + TTL vào Redis, gửi SMS, và đặt isActive=false cho đến khi verify.

    return { user };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    // Tìm user theo email hoặc phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
      },
    });

    if (!user)
      throw new UnauthorizedException('Email/phone hoặc mật khẩu không đúng');
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị khoá');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch)
      throw new UnauthorizedException('Email/phone hoặc mật khẩu không đúng');

    return this.issueTokenPair(
      user.id,
      user.email ?? undefined,
      user.phone ?? undefined,
      user.role,
    );
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    // 1. Verify chữ ký JWT
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
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
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Tài khoản không hợp lệ');

    return this.issueTokenPair(
      user.id,
      user.email ?? undefined,
      user.phone ?? undefined,
      user.role,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async issueTokenPair(
    userId: string,
    email: string | undefined,
    phone: string | undefined,
    role: string,
  ) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const payload = { sub: userId, email, phone, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn as '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn as '7d',
    });

    // Lưu hash của refresh token vào DB để có thể revoke
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + parseDuration(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        userId,
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
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      // Token hết hạn hoặc không hợp lệ → coi như đã logout
      return;
    }

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
