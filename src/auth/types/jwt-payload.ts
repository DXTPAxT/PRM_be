import type { Role } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  email?: string;
  phone?: string;
  role: Role;
  tokenType: 'access';
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenType: 'refresh';
  jti: string;
}
