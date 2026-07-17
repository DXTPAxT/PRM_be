import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VouchersService } from './vouchers.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('vouchers')
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  /** Health probe — M3: điền logic voucher tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'vouchers', status: 'ok' };
  }
}
