import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /api/auth/register ──────────────────────────────────────────────

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 lần / phút
  @ApiOperation({ summary: 'Đăng ký tài khoản mới (role=customer)' })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công, trả về thông tin user',
  })
  @ApiResponse({ status: 409, description: 'Email hoặc phone đã tồn tại' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ── POST /api/auth/login ─────────────────────────────────────────────────

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 lần / phút
  @ApiOperation({ summary: 'Đăng nhập, nhận accessToken + refreshToken' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả token và user an toàn',
  })
  @ApiResponse({ status: 401, description: 'Sai thông tin đăng nhập' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ── POST /api/auth/refresh ───────────────────────────────────────────────

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token bằng refresh token' })
  @ApiResponse({ status: 200, description: 'Cấp access token mới' })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // ── POST /api/auth/logout ────────────────────────────────────────────────

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất, thu hồi refresh token hiện tại' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { data: null, message: 'Đăng xuất thành công' };
  }

  // ── POST /api/auth/otp/verify ────────────────────────────────────────────
  // TODO: [OTP] M1 implement — gửi OTP qua SMS, verify trước khi kích hoạt account

  @Post('otp/verify')
  @Public()
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: '[TODO] Xác thực OTP — chưa implement, M1 sẽ làm' })
  @ApiResponse({ status: 501, description: 'Chưa implement' })
  otpVerify() {
    throw new NotImplementedException(
      'OTP verify chưa được implement. M1 sẽ làm sau khi tích hợp SMS provider.',
    );
  }

  // ── POST /api/auth/forgot-password ──────────────────────────────────────
  // TODO: [ForgotPw] M1 implement — gửi OTP reset mật khẩu + revokeAllSessions

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: '[TODO] Quên mật khẩu — chưa implement, M1 sẽ làm' })
  @ApiResponse({ status: 501, description: 'Chưa implement' })
  forgotPassword() {
    throw new NotImplementedException(
      'Forgot-password chưa implement. M1 dùng authService.revokeAllSessions() khi reset xong.',
    );
  }
}
