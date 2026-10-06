import type { OrderStatus } from '../types/orderList';

// Shared between the Owner/Admin Order Dashboard (OrderList.tsx) and the Super
// Admin cross-store order-list view -- one definition of the lifecycle's
// labels/colors/order so the two surfaces can't drift from each other.
export const STATUS_META: Record<OrderStatus, { label: string; fg: string; bg: string }> = {
  NEEDS_ORDERING: { label: 'Needs ordering', fg: '#b3162a', bg: '#fde8ea' },
  ORDERED: { label: 'Ordered', fg: '#1d5fb8', bg: '#e5f1fd' },
  RECEIVED: { label: 'Received', fg: '#137a47', bg: '#e1f8ec' },
};

export const STATUS_ORDER: OrderStatus[] = ['NEEDS_ORDERING', 'ORDERED', 'RECEIVED'];
