import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const ADDRESS_SELECT = {
  id: true,
  userId: true,
  fullName: true,
  phone: true,
  detail: true,
  isDefault: true,
  createdAt: true,
} as const;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: ADDRESS_SELECT,
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    const hasExistingAddress = await this.prisma.address.findFirst({
      where: { userId },
      select: { id: true },
    });
    const shouldBeDefault = dto.isDefault === true || !hasExistingAddress;

    if (shouldBeDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        detail: dto.detail.trim(),
        isDefault: shouldBeDefault,
      },
      select: ADDRESS_SELECT,
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.assertOwnership(userId, id);
    const data: { fullName?: string; phone?: string; detail?: string } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
    if (dto.detail !== undefined) data.detail = dto.detail.trim();

    return this.prisma.address.update({
      where: { id },
      data,
      select: ADDRESS_SELECT,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.assertOwnership(userId, id);
    await this.prisma.address.delete({ where: { id } });

    if (address.isDefault) {
      const nextAddress = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (nextAddress) {
        await this.prisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async setDefault(userId: string, id: string) {
    await this.assertOwnership(userId, id);
    await this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
      select: ADDRESS_SELECT,
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
      select: { id: true, isDefault: true },
    });
    if (!address) throw new NotFoundException('Địa chỉ không tồn tại');
    return address;
  }
}
