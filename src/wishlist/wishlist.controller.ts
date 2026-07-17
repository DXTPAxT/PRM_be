import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('wishlist')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /** Health probe — M2: điền logic wishlist tại đây */
  @Public()
  @Get('ping')
  ping() {
    return { module: 'wishlist', status: 'ok' };
  }
}
