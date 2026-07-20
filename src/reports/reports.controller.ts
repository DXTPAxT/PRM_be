import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: '[Admin] Báo cáo doanh thu' })
  salesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.salesReport(startDate, endDate);
  }

  @Get('inventory')
  @ApiOperation({ summary: '[Admin] Báo cáo tồn kho' })
  inventoryReport() {
    return this.reportsService.inventoryReport();
  }
}