import type { InventoryCountSource } from '../types/storeInventory';

// How an Inventory Counts entry was made, shown beside the name in "Updated by".
const SOURCE_LABELS: Record<InventoryCountSource, string> = {
  START_OF_DAY: 'Start of day',
  END_OF_DAY: 'End of day',
  STOCK_RECEIVED: 'Stock received',
};

export function countSourceLabel(source: InventoryCountSource | null | undefined): string | null {
  return source ? SOURCE_LABELS[source] : null;
}
