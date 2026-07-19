import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../../users/user.types';
import { AccessTokenPayload } from '../types/jwt-payload';

/**
 * Strategy xác thực Access Token.
 * Chỉ inject các trường user an toàn vào request.user để guard/decorator dùng.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Loại token không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: SAFE_USER_SELECT,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Token không hợp lệ hoặc tài khoản bị khoá',
      );
    }

    return user; // gắn vào request.user
  }
}
