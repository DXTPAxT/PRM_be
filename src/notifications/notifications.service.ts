import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  body: true,
  data: true,
  isRead: true,
  createdAt: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: NOTIFICATION_SELECT,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        unreadCount,
      },
      message: 'Lấy danh sách thông báo thành công.',
    };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Thông báo không tồn tại.');

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return { data: null, message: 'Đã đánh dấu đã đọc.' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { data: null, message: 'Đã đánh dấu tất cả đã đọc.' };
  }

  /** Helper: tạo notification cho user (gọi từ OrdersService khi đổi status). */
  async create(userId: string, title: string, body: string, data?: object) {
    return this.prisma.notification.create({
      data: { userId, title, body, data: data ?? undefined },
      select: NOTIFICATION_SELECT,
    });
  }
}
