import type { ReceiptOutcome } from '../types/orderList';
import { formatQty } from './quantity';

// Toast wording for the result of marking an order received -- shared by the
// Owner/Admin and Super Admin order pages so they can't drift.
export function describeReceipt(
  itemName: string,
  quantityReceived: number | null,
  unit: string,
  receipt: ReceiptOutcome | null | undefined,
): { tone: 'success' | 'info'; message: string } {
  const received = quantityReceived == null ? '' : ` ${formatQty(quantityReceived)} ${unit}`;
  const base = `"${itemName}" received${received}.`;

  if (!receipt || !receipt.stockUpdated || receipt.currentStock == null) {
    return {
      tone: 'info',
      message: `${base} No stock count for today yet, so current stock was not updated.`,
    };
  }

  const stock = `${formatQty(receipt.currentStock)} ${unit}`;
  if (receipt.requiredToday == null) {
    return { tone: 'success', message: `${base} Stock is now ${stock}.` };
  }
  const required = `${formatQty(receipt.requiredToday)} ${unit}`;
  if (receipt.shortfall != null && receipt.shortfall > 0) {
    return {
      tone: 'info',
      message: `${base} Stock is now ${stock}, still ${formatQty(receipt.shortfall)} ${unit} below today's minimum of ${required}.`,
    };
  }
  return { tone: 'success', message: `${base} Stock is now ${stock}, meeting today's minimum of ${required}.` };
}
