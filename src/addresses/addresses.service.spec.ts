import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddressesService } from './addresses.service';

describe('AddressesService', () => {
  const addressFindMany = jest.fn();
  const addressFindFirst = jest.fn();
  const addressCreate = jest.fn();
  const addressUpdate = jest.fn();
  const addressUpdateMany = jest.fn();
  const addressDelete = jest.fn();
  const prisma = {
    address: {
      findMany: addressFindMany,
      findFirst: addressFindFirst,
      create: addressCreate,
      update: addressUpdate,
      updateMany: addressUpdateMany,
      delete: addressDelete,
    },
  } as unknown as PrismaService;

  let service: AddressesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AddressesService(prisma);
    addressUpdateMany.mockResolvedValue({ count: 1 });
    addressUpdate.mockResolvedValue({ id: 'address-1', isDefault: true });
    addressCreate.mockResolvedValue({ id: 'address-1' });
    addressDelete.mockResolvedValue({ id: 'address-1' });
  });

  it('chỉ lấy địa chỉ của user hiện tại', async () => {
    addressFindMany.mockResolvedValue([]);

    await service.findAll('user-1');

    expect(addressFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('tự đặt địa chỉ đầu tiên làm mặc định', async () => {
    addressFindFirst.mockResolvedValue(null);

    await service.create('user-1', {
      fullName: '  Nguyễn Văn A ',
      phone: ' 0901234567 ',
      detail: '  123 Nguyễn Trãi  ',
    });

    expect(addressUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isDefault: true },
      data: { isDefault: false },
    });
    expect(addressCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'user-1',
          fullName: 'Nguyễn Văn A',
          phone: '0901234567',
          detail: '123 Nguyễn Trãi',
          isDefault: true,
        },
      }),
    );
  });

  it('không cho sửa địa chỉ của user khác', async () => {
    addressFindFirst.mockResolvedValue(null);

    await expect(
      service.update('user-1', 'other-address', { detail: 'Địa chỉ mới' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(addressUpdate).not.toHaveBeenCalled();
  });

  it('đặt mặc định và bỏ mặc định cũ trong cùng user', async () => {
    addressFindFirst.mockResolvedValue({ id: 'address-2', isDefault: false });

    await service.setDefault('user-1', 'address-2');

    expect(addressUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isDefault: true },
      data: { isDefault: false },
    });
    expect(addressUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'address-2' },
        data: { isDefault: true },
      }),
    );
  });

  it('xóa địa chỉ mặc định và chuyển mặc định cho địa chỉ kế tiếp', async () => {
    addressFindFirst
      .mockResolvedValueOnce({ id: 'address-1', isDefault: true })
      .mockResolvedValueOnce({ id: 'address-2' });

    await service.remove('user-1', 'address-1');

    expect(addressDelete).toHaveBeenCalledWith({ where: { id: 'address-1' } });
    expect(addressUpdate).toHaveBeenCalledWith({
      where: { id: 'address-2' },
      data: { isDefault: true },
    });
  });
});
