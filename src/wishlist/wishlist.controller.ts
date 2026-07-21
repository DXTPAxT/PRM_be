import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { SafeUser } from '../users/user.types';
import { WishlistService } from './wishlist.service';
import { AddWishlistDto } from './dto/add-wishlist.dto';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm yêu thích' })
  findAll(@CurrentUser() user: SafeUser) {
    return this.wishlistService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm sản phẩm vào yêu thích' })
  @ApiResponse({ status: 201, description: 'Thêm thành công' })
  @ApiResponse({ status: 409, description: 'Đã có trong danh sách' })
  add(@CurrentUser() user: SafeUser, @Body() dto: AddWishlistDto) {
    return this.wishlistService.add(user.id, dto);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa sản phẩm khỏi yêu thích' })
  remove(
    @CurrentUser() user: SafeUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.wishlistService.remove(user.id, productId);
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'Kiểm tra sản phẩm có trong wishlist không' })
  async check(
    @CurrentUser() user: SafeUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const inWishlist = await this.wishlistService.isInWishlist(user.id, productId);
    return { data: { inWishlist }, message: 'OK' };
  }
}
