import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Health probe — M4: điền logic thông báo tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'notifications', status: 'ok' };
  }
}
