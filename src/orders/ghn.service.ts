import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Tích hợp Giao Hàng Nhanh (GHN) — tính phí ship và tạo vận đơn.
 * Gọi REST API của GHN bằng fetch (Node 18+ có sẵn global fetch).
 *
 * Địa chỉ giao hàng (to_district_id / to_ward_code) do FE gửi qua body checkout,
 * lấy từ dropdown tỉnh/quận/phường của GHN — KHÔNG lưu trong bảng Address (thuộc M1).
 */
@Injectable()
export class GhnService {
  private readonly logger = new Logger(GhnService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiUrl(): string {
    return (
      this.config.get<string>('GHN_API_URL') ??
      'https://dev-online-gateway.ghn.vn'
    );
  }

  private get token(): string {
    return this.config.get<string>('GHN_TOKEN') ?? '';
  }

  private get shopId(): string {
    return this.config.get<string>('GHN_SHOP_ID') ?? '';
  }

  private get fromDistrictId(): number {
    return Number(this.config.get<string>('GHN_FROM_DISTRICT_ID') ?? 0);
  }

  /** GHN đã được cấu hình đầy đủ chưa (để fallback graceful nếu thiếu env). */
  isConfigured(): boolean {
    return Boolean(this.token && this.shopId && this.fromDistrictId);
  }

  private async call<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Token: this.token,
        ShopId: this.shopId,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      code: number;
      message: string;
      data: T;
    };
    if (json.code !== 200) {
      this.logger.warn(`GHN API lỗi (${path}): ${json.message}`);
      throw new BadRequestException(`GHN: ${json.message}`);
    }
    return json.data;
  }

  /**
   * Tính phí ship từ kho (from_district cấu hình sẵn) đến địa chỉ giao hàng.
   * @param weight tổng khối lượng gram
   */
  async calculateFee(params: {
    toDistrictId: number;
    toWardCode: string;
    weight: number;
  }): Promise<number> {
    const data = await this.call<{ total: number }>(
      '/shiip/public-api/v2/shipping-order/fee',
      {
        from_district_id: this.fromDistrictId,
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        weight: params.weight,
        service_type_id: 2, // 2 = hàng nhẹ (chuẩn e-commerce)
      },
    );
    return data.total;
  }

  /**
   * Tạo vận đơn GHN (gọi khi admin xác nhận đơn). Trả về mã vận đơn.
   * TODO: M3 — map đầy đủ thông tin người nhận + danh sách item khi tích hợp thật.
   */
  async createShippingOrder(params: {
    toName: string;
    toPhone: string;
    toAddress: string;
    toDistrictId: number;
    toWardCode: string;
    weight: number;
    codAmount: number;
    items: { name: string; quantity: number }[];
  }): Promise<string> {
    const data = await this.call<{ order_code: string }>(
      '/shiip/public-api/v2/shipping-order/create',
      {
        payment_type_id: 2, // người nhận trả phí ship
        required_note: 'KHONGCHOXEMHANG',
        to_name: params.toName,
        to_phone: params.toPhone,
        to_address: params.toAddress,
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        weight: params.weight,
        cod_amount: params.codAmount,
        service_type_id: 2,
        items: params.items,
      },
    );
    return data.order_code;
  }
}
