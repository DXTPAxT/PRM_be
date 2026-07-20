import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Xử lý ký & verify chữ ký VNPay (HMAC-SHA512).
 *
 * Luồng VNPay (không phải "gọi API trừ tiền" mà là redirect + verify):
 *  1. buildPaymentUrl() → tạo URL có chữ ký, FE redirect user sang VNPay.
 *  2. VNPay gọi IPN (server-to-server) và redirect user về Return URL.
 *  3. verifyChecksum() kiểm tra chữ ký của cả IPN lẫn Return để chống giả mạo.
 *
 * Quy tắc ký của VNPay: sort tham số theo alphabet, nối thành query string
 * (KHÔNG gồm vnp_SecureHash), ký HMAC-SHA512 bằng HashSecret.
 */
@Injectable()
export class VnpayService {
  constructor(private readonly config: ConfigService) {}

  private get tmnCode(): string {
    return this.config.get<string>('VNPAY_TMN_CODE') ?? '';
  }

  private get hashSecret(): string {
    return this.config.get<string>('VNPAY_HASH_SECRET') ?? '';
  }

  private get payUrl(): string {
    return (
      this.config.get<string>('VNPAY_URL') ??
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
    );
  }

  private get returnUrl(): string {
    return this.config.get<string>('VNPAY_RETURN_URL') ?? '';
  }

  /**
   * Sort key theo alphabet rồi encode giống chuẩn VNPay.
   * VNPay encode space thành '+' (dùng querystring.stringify style), nên ta
   * encodeURIComponent rồi thay %20 → '+' cho khớp tuyệt đối với phía VNPay.
   */
  private buildSignData(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    return sortedKeys
      .map((key) => {
        const value = encodeURIComponent(params[key]).replace(/%20/g, '+');
        return `${key}=${value}`;
      })
      .join('&');
  }

  private sign(signData: string): string {
    return crypto
      .createHmac('sha512', this.hashSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');
  }

  /**
   * Tạo URL thanh toán VNPay cho một đơn hàng.
   * @param orderId    dùng làm vnp_TxnRef (mã tham chiếu giao dịch)
   * @param amount     số tiền (VND, chưa nhân 100 — VNPay yêu cầu ×100)
   * @param ipAddr     IP của client
   * @param orderInfo  mô tả đơn
   */
  buildPaymentUrl(params: {
    orderId: string;
    amount: number;
    ipAddr: string;
    orderInfo: string;
  }): string {
    const createDate = this.formatDate(new Date());

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: String(Math.round(params.amount) * 100),
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
    };

    const signData = this.buildSignData(vnpParams);
    const secureHash = this.sign(signData);

    return `${this.payUrl}?${signData}&vnp_SecureHash=${secureHash}`;
  }

  /**
   * Verify chữ ký của params trả về từ VNPay (IPN hoặc Return).
   * Tách vnp_SecureHash ra, ký lại phần còn lại, so sánh.
   */
  verifyChecksum(query: Record<string, string>): boolean {
    const received = query['vnp_SecureHash'];
    if (!received) return false;

    // Loại bỏ các field không tham gia ký
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
        params[key] = value;
      }
    }

    const signData = this.buildSignData(params);
    const expected = this.sign(signData);

    // So sánh an toàn theo thời gian (chống timing attack)
    const a = Buffer.from(expected, 'utf-8');
    const b = Buffer.from(received, 'utf-8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /** VNPay yêu cầu định dạng yyyyMMddHHmmss theo giờ VN (GMT+7). */
  private formatDate(date: Date): string {
    const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${vnTime.getUTCFullYear()}` +
      `${pad(vnTime.getUTCMonth() + 1)}` +
      `${pad(vnTime.getUTCDate())}` +
      `${pad(vnTime.getUTCHours())}` +
      `${pad(vnTime.getUTCMinutes())}` +
      `${pad(vnTime.getUTCSeconds())}`
    );
  }
}
