import { OrderStatus } from '@prisma/client';

/** Cạnh hợp lệ của state machine đơn hàng. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipping'],
  shipping: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isCancellable(status: OrderStatus): boolean {
  return status === 'pending_payment' || status === 'confirmed';
}
