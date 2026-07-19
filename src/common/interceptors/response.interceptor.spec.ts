import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const context = {} as ExecutionContext;
  const interceptor = new ResponseInterceptor();

  it('bọc payload thường theo response contract', async () => {
    const next = { handle: () => of({ id: 'user-1' }) } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({
      success: true,
      data: { id: 'user-1' },
      message: 'OK',
    });
  });

  it('giữ message và data null của custom response', async () => {
    const next = {
      handle: () => of({ data: null, message: 'Đăng xuất thành công' }),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({
      success: true,
      data: null,
      message: 'Đăng xuất thành công',
    });
  });
});
