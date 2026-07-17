import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Health probe — M3: điền logic thanh toán tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'payments', status: 'ok' };
  }
}
