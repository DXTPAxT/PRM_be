import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesReport(startDate?: string, endDate?: string) {
    const where: any = {
      status: { in: [OrderStatus.delivered, OrderStatus.completed] },
    };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        createdAt: true,
        total: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const totalItemsSold = orders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0,
    );

    // Group by date (YYYY-MM-DD)
    const byDate = orders.reduce(
      (acc, order) => {
        const date = order.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { revenue: 0, orders: 0, items: 0 };
        }
        acc[date].revenue += Number(order.total);
        acc[date].orders += 1;
        acc[date].items += order.items.reduce((s, i) => s + i.quantity, 0);
        return acc;
      },
      {} as Record<string, { revenue: number; orders: number; items: number }>,
    );

    const trend = Object.entries(byDate)
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      data: {
        summary: { totalRevenue, totalOrders, totalItemsSold },
        trend,
      },
      message: 'Lấy báo cáo doanh thu thành công.',
    };
  }

  async inventoryReport() {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        variants: {
          select: {
            size: true,
            color: true,
            sku: true,
            stockQty: true,
          },
        },
      },
    });

    const lowStockThreshold = 10;
    const lowStockItems: {
      productId: string;
      productName: string;
      sku: string;
      size: string;
      color: string;
      stockQty: number;
      status: string;
    }[] = [];
    let totalStock = 0;

    for (const product of products) {
      for (const variant of product.variants) {
        totalStock += variant.stockQty;
        if (variant.stockQty <= lowStockThreshold) {
          lowStockItems.push({
            productId: product.id,
            productName: product.name,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            stockQty: variant.stockQty,
            status: product.status,
          });
        }
      }
    }

    return {
      data: {
        totalStock,
        lowStockItems: lowStockItems.sort((a, b) => a.stockQty - b.stockQty),
      },
      message: 'Lấy báo cáo tồn kho thành công.',
    };
  }
}