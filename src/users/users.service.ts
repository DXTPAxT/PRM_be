import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SAFE_USER_SELECT, SafeUser } from './user.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...SAFE_USER_SELECT,
        addresses: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            detail: true,
            isDefault: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, phone: true },
    });
    if (!existing) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị xoá');
    }

    const email =
      dto.email === undefined
        ? existing.email
        : (dto.email?.trim().toLowerCase() ?? null);
    const phone =
      dto.phone === undefined ? existing.phone : (dto.phone?.trim() ?? null);
    if (!email && !phone) {
      throw new BadRequestException(
        'Tài khoản phải có email hoặc số điện thoại',
      );
    }

    if (email && email !== existing.email) {
      const duplicate = await this.prisma.user.findUnique({ where: { email } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Email đã được sử dụng');
      }
    }
    if (phone && phone !== existing.phone) {
      const duplicate = await this.prisma.user.findUnique({ where: { phone } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Số điện thoại đã được sử dụng');
      }
    }

    const data: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
    } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.email !== undefined) data.email = email;
    if (dto.phone !== undefined) data.phone = phone;

    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_USER_SELECT,
    });
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...SAFE_USER_SELECT, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị xoá');
    }

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: SAFE_USER_SELECT,
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true },
    });

    return updatedUser;
  }
}
