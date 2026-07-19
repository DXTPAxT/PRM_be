import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IS_PUBLIC_KEY } from './common/guards/jwt-auth.guard';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('should be public for health checks', () => {
      // Nest gắn metadata của method decorator trực tiếp lên handler function.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, appController.getHello)).toBe(
        true,
      );
    });
  });
});
