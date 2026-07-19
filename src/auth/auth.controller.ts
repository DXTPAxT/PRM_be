import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
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
    const result = await this.authService.register(dto);
    return {
      data: result.challenge,
      message: 'Mã OTP đã được gửi. Vui lòng xác thực để kích hoạt tài khoản.',
    };
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
  @Post('otp/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Xác thực OTP đăng ký và tự động đăng nhập' })
  @ApiResponse({ status: 200, description: 'Kích hoạt tài khoản và trả token' })
  async otpVerify(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyRegistrationOtp(dto);
  }

  @Post('otp/resend')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Gửi lại OTP đăng ký' })
  @ApiResponse({ status: 200, description: 'OTP mới đã được gửi' })
  async otpResend(@Body() dto: ResendOtpDto) {
    const challenge = await this.authService.resendRegistrationOtp(dto);
    return {
      data: challenge,
      message: 'OTP mới đã được gửi.',
    };
  }

  // ── POST /api/auth/forgot-password ──────────────────────────────────────
  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Gửi OTP khôi phục mật khẩu' })
  @ApiResponse({
    status: 200,
    description:
      'Luôn trả cùng một thông báo để không tiết lộ email/số điện thoại có tồn tại',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return {
      data: null,
      message:
        'Nếu thông tin tồn tại, mã OTP khôi phục sẽ được gửi qua email hoặc SMS.',
    };
  }

  // ── POST /api/auth/reset-password ───────────────────────────────────────
  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Xác thực OTP và đặt mật khẩu mới' })
  @ApiResponse({ status: 200, description: 'Đặt lại mật khẩu thành công' })
  @ApiResponse({ status: 400, description: 'OTP không hợp lệ hoặc đã hết hạn' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { data: null, message: 'Đặt lại mật khẩu thành công.' };
  }
}
