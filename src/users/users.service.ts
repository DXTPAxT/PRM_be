import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SAFE_USER_SELECT } from './user.types';

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
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        updatedAt: true,
      },
    });
  }
}
