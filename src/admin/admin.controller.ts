import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, OrderStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateOrderStatusDto } from '../orders/dto/update-order-status.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ───────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: '[Admin] Dashboard overview' })
  dashboard() {
    return this.adminService.dashboard();
  }

  // ── Users ───────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: '[Admin] Danh sách người dùng' })
  findAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.findAllUsers(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: '[Admin] Chi tiết người dùng' })
  findOneUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.findOneUser(id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: '[Admin] Cập nhật role người dùng' })
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Patch('users/:id/toggle-active')
  @ApiOperation({ summary: '[Admin] Kích hoạt / vô hiệu hóa người dùng' })
  toggleUserActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleUserActive(id);
  }

  // ── Orders ──────────────────────────────────────────────────────────

  @Get('orders')
  @ApiOperation({ summary: '[Admin] Danh sách đơn hàng' })
  findAllOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: OrderStatus,
  ) {
    return this.adminService.findAllOrders(
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '[Admin] Chi tiết đơn hàng' })
  findOneOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.findOneOrder(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: '[Admin] Cập nhật trạng thái đơn hàng' })
  updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(id, dto.status);
  }
}