import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_SELECT = {
  id: true,
  userId: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          price: true,
          stockQty: true,
          sku: true,
          product: {
            select: {
              id: true,
              name: true,
              status: true,
              images: {
                select: { url: true },
                take: 1,
                orderBy: { sortOrder: 'asc' as const },
              },
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) return cart;
    return this.prisma.cart.create({ data: { userId } });
  }

  private toResponse(cart: {
    id: string;
    userId: string;
    updatedAt: Date;
    items: Array<{
      id: string;
      quantity: number;
      variant: {
        id: string;
        size: string;
        color: string;
        price: unknown;
        stockQty: number;
        sku: string;
        product: {
          id: string;
          name: string;
          status: string;
          images: { url: string }[];
        };
      };
    }>;
  }) {
    const items = cart.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      variant: {
        id: item.variant.id,
        size: item.variant.size,
        color: item.variant.color,
        price: item.variant.price,
        stockQty: item.variant.stockQty,
        sku: item.variant.sku,
      },
      product: {
        id: item.variant.product.id,
        name: item.variant.product.name,
        status: item.variant.product.status,
        image: item.variant.product.images[0]?.url ?? null,
      },
      lineTotal: Number(item.variant.price) * item.quantity,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      id: cart.id,
      updatedAt: cart.updatedAt,
      items,
      subtotal,
    };
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    const full = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      select: CART_SELECT,
    });
    return this.toResponse(full);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      select: {
        id: true,
        stockQty: true,
        product: { select: { status: true } },
      },
    });
    if (!variant)
      throw new NotFoundException('Biến thể sản phẩm không tồn tại');
    if (variant.product.status !== 'active') {
      throw new BadRequestException('Sản phẩm hiện không còn kinh doanh');
    }
    if (variant.stockQty <= 0) {
      throw new BadRequestException('Sản phẩm đã hết hàng');
    }

    const cart = await this.getOrCreateCart(userId);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
      },
    });

    const nextQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (nextQuantity > variant.stockQty) {
      throw new BadRequestException(
        `Chỉ còn ${variant.stockQty} sản phẩm trong kho`,
      );
    }

    await this.prisma.cartItem.upsert({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
      },
      create: {
        cartId: cart.id,
        variantId: dto.variantId,
        quantity: dto.quantity,
      },
      update: { quantity: nextQuantity },
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.assertOwnership(userId, itemId);

    if (dto.quantity > item.variant.stockQty) {
      throw new BadRequestException(
        `Chỉ còn ${item.variant.stockQty} sản phẩm trong kho`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    await this.assertOwnership(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }

  private async assertOwnership(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        cart: { select: { userId: true } },
        variant: { select: { stockQty: true } },
      },
    });
    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Sản phẩm trong giỏ hàng không tồn tại');
    }
    return item;
  }
}
