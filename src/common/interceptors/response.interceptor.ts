import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Shape chuẩn của mọi response thành công.
 * Controller có thể trả về:
 *   - Object/primitive thông thường  → bọc vào data
 *   - { data, message, meta }         → unwrap để giữ message/meta
 *   - { data, message, meta, success } → pass-through trực tiếp
 *
 * Ví dụ controller trả list có phân trang:
 *   return { data: items, meta: { page, totalPages, total }, message: 'OK' };
 */
export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface StandardResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
  meta?: PaginationMeta;
}

interface CustomResponsePayload {
  data?: unknown;
  message?: string;
  meta?: PaginationMeta;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((payload: unknown) => {
        // Nếu controller trả { data, message?, meta? } → giữ nguyên cấu trúc
        if (payload && typeof payload === 'object' && 'data' in payload) {
          const customPayload = payload as CustomResponsePayload;
          return {
            success: true,
            data: customPayload.data as T,
            message: customPayload.message ?? 'OK',
            ...(customPayload.meta ? { meta: customPayload.meta } : {}),
          };
        }

        // Mặc định: bọc toàn bộ vào data
        return {
          success: true,
          data: (payload ?? null) as T,
          message: 'OK',
        };
      }),
    );
  }
}
