import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { SafeUser } from '../users/user.types';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy sổ địa chỉ của người dùng hiện tại' })
  findAll(@CurrentUser() user: SafeUser) {
    return this.addressesService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm địa chỉ giao hàng' })
  @ApiResponse({ status: 201, description: 'Tạo địa chỉ thành công' })
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(user.id, dto);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Đặt địa chỉ mặc định' })
  setDefault(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.addressesService.setDefault(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật địa chỉ giao hàng' })
  update(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa địa chỉ giao hàng' })
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.addressesService.remove(user.id, id).then(() => ({
      data: null,
      message: 'Xóa địa chỉ thành công.',
    }));
  }
}
