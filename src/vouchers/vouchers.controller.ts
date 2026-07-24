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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { ApplyVoucherDto } from './dto/apply-voucher.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('vouchers')
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Public()
  @Post('apply')
  @ApiOperation({ summary: 'Kiểm tra & áp dụng voucher (tính giảm giá)' })
  apply(@Body() dto: ApplyVoucherDto) {
    return this.vouchersService.apply(dto);
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Danh sách voucher' })
  findAll() {
    return this.vouchersService.findAll();
  }

  @Roles(Role.admin)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết voucher' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchersService.findOne(id);
  }

  @Roles(Role.admin)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '[Admin] Tạo voucher mới' })
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.create(dto);
  }

  @Roles(Role.admin)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: '[Admin] Cập nhật voucher' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchersService.update(id, dto);
  }

  @Roles(Role.admin)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Vô hiệu hóa voucher (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchersService.remove(id);
  }
}