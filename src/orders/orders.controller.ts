import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { GhnWebhookDto } from './dto/ghn-webhook.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { SafeUser } from '../users/user.types';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo đơn hàng từ giỏ hàng hiện tại (checkout)' })
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách đơn hàng (của mình, hoặc tất cả nếu admin)',
  })
  findAll(@CurrentUser() user: SafeUser, @Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(user.id, user.role, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết đơn hàng' })
  findOne(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.ordersService.findOne(user.id, user.role, id);
  }

  @Patch(':id/status')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn hàng (chỉ admin)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Hủy đơn hàng' })
  cancel(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.ordersService.cancel(user.id, user.role, id);
  }

  @Public()
  @Post('ghn/webhook')
  @ApiOperation({
    summary:
      'Webhook GHN cập nhật trạng thái giao hàng (GHN gọi server-to-server)',
  })
  async ghnWebhook(@Body() dto: GhnWebhookDto) {
    await this.ordersService.handleGhnWebhook(dto.OrderCode, dto.Status);
    return { message: 'OK' };
  }
}
