import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { ApplyVoucherDto } from './dto/apply-voucher.dto';

const VOUCHER_SELECT = {
  id: true,
  code: true,
  discount: true,
  minOrder: true,
  usageLimit: true,
  usedCount: true,
  expiresAt: true,
  isActive: true,
} as const;

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.voucher.findMany({
      orderBy: { code: 'asc' },
      select: VOUCHER_SELECT,
    });
    return { data: rows, message: 'Lấy danh sách voucher thành công.' };
  }

  async findOne(id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      select: VOUCHER_SELECT,
    });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');
    return { data: voucher, message: 'Lấy voucher thành công.' };
  }

  async create(dto: CreateVoucherDto) {
    const existing = await this.prisma.voucher.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException('Mã voucher đã tồn tại');
    }

    const voucher = await this.prisma.voucher.create({
      data: {
        code: dto.code,
        discount: dto.discount,
        minOrder: dto.minOrder ?? 0,
        usageLimit: dto.usageLimit ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
      select: VOUCHER_SELECT,
    });

    return { data: voucher, message: 'Tạo voucher thành công.' };
  }

  async update(id: string, dto: UpdateVoucherDto) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');

    if (dto.code && dto.code !== voucher.code) {
      const dup = await this.prisma.voucher.findUnique({
        where: { code: dto.code },
      });
      if (dup) throw new BadRequestException('Mã voucher đã tồn tại');
    }

    const updated = await this.prisma.voucher.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.discount !== undefined ? { discount: dto.discount } : {}),
        ...(dto.minOrder !== undefined ? { minOrder: dto.minOrder } : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: VOUCHER_SELECT,
    });

    return { data: updated, message: 'Cập nhật voucher thành công.' };
  }

  async remove(id: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher không tồn tại');

    // Soft delete: set isActive = false thay vì xóa cứng (FK từ Order)
    await this.prisma.voucher.update({
      where: { id },
      data: { isActive: false },
    });

    return { data: null, message: 'Đã vô hiệu hóa voucher.' };
  }

  /** Áp dụng voucher vào đơn hàng — trả về số tiền giảm giá. */
  async apply(dto: ApplyVoucherDto) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: dto.code },
      select: {
        id: true,
        isActive: true,
        discount: true,
        minOrder: true,
        usageLimit: true,
        usedCount: true,
        expiresAt: true,
      },
    });

    if (!voucher) throw new NotFoundException('Voucher không tồn tại');
    if (!voucher.isActive) throw new BadRequestException('Voucher đã bị vô hiệu hóa');
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      throw new BadRequestException('Voucher đã hết hạn');
    }
    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Voucher đã hết lượt sử dụng');
    }
    if (Number(dto.subtotal) < Number(voucher.minOrder)) {
      throw new BadRequestException(
        `Đơn tối thiểu ${voucher.minOrder}đ để dùng voucher này`,
      );
    }

    const discount = Number(voucher.discount);
    return {
      data: {
        voucherId: voucher.id,
        code: dto.code,
        discount,
        finalTotal: Math.max(0, Number(dto.subtotal) - discount),
      },
      message: 'Áp dụng voucher thành công.',
    };
  }
}