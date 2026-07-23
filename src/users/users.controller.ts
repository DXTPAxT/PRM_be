import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { SafeUser } from './user.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

import { Public } from '../common/decorators/public.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Health probe — không cần auth, dùng để kiểm tra stub còn sống.
   */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'users', status: 'ok' };
  }

  /**
   * GET /api/users/me — lấy profile user hiện tại.
   * Demo endpoint cho JwtAuthGuard + @CurrentUser().
   * Protected bởi global JwtAuthGuard (đã đặt trong AppModule).
   */
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin profile người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Thông tin user' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async getMe(@CurrentUser() user: SafeUser) {
    return this.usersService.findById(user.id);
  }

  /**
   * PATCH /api/users/me — cập nhật profile cơ bản.
   */
  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật profile (họ tên, phone)' })
  async updateMe(@CurrentUser() user: SafeUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  /**
   * PATCH /api/users/me/password — đổi mật khẩu khi đã đăng nhập.
   */
  @Patch('me/password')
  @ApiOperation({ summary: 'Đổi mật khẩu, yêu cầu mật khẩu hiện tại' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({
    status: 400,
    description: 'Mật khẩu hiện tại không chính xác',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async changePassword(
    @CurrentUser() user: SafeUser,
    @Body() dto: ChangePasswordDto,
  ) {
    const updatedUser = await this.usersService.changePassword(user.id, dto);
    return {
      data: updatedUser,
      message: 'Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị thu hồi.',
    };
  }
}
