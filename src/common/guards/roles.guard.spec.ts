import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { SafeUser } from '../../users/user.types';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const user = {
    id: 'user-1',
    role: Role.customer,
  } as SafeUser;

  const contextFor = (requestUser?: SafeUser) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: requestUser }) }),
    }) as unknown as ExecutionContext;

  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector);
  });

  it('cho qua endpoint không khai báo role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(contextFor())).toBe(true);
  });

  it('cho phép user có role phù hợp', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.customer]);

    expect(guard.canActivate(contextFor(user))).toBe(true);
  });

  it('từ chối user không có role yêu cầu', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.admin]);

    expect(() => guard.canActivate(contextFor(user))).toThrow(
      ForbiddenException,
    );
  });
});
