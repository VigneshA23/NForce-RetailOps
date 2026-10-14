import { describe, expect, it } from 'vitest';
import { buildStockCheckHistoryWorkbook } from './stockCheckHistoryExport';
import type { StockCheckHistoryRowView } from './stockCheckHistoryStatus';

function row(overrides: Partial<StockCheckHistoryRowView & { storeName: string }> = {}) {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Paper Towels',
    category: 'SUPPLIES',
    unitOfMeasurement: 'EA',
    checkDate: '2026-09-20',
    status: 'optimal',
    buffer: 0,
    deficit: 0,
    startOfDay: null,
    endOfDay: null,
    ...overrides,
  } as StockCheckHistoryRowView & { storeName?: string };
}

// RTS-375: exporting across "All Stores" needs a Store column so rows stay
// attributable; a single-store export (Owner/Admin, or Super Admin with one
// store picked) must keep its original column shape unchanged.
describe('buildStockCheckHistoryWorkbook', () => {
  it('omits the Store column by default', async () => {
    const workbook = await buildStockCheckHistoryWorkbook([row()], '2026-09-20', '2026-09-20');
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(4).values as unknown[];
    expect(headerRow).not.toContain('Store');
    expect(headerRow).toContain('Item & Category');
  });

  it('adds a leading Store column when includeStore is set', async () => {
    const workbook = await buildStockCheckHistoryWorkbook(
      [row({ storeName: 'Downtown' })], '2026-09-20', '2026-09-20', { includeStore: true },
    );
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(4).values as unknown[];
    expect(headerRow[1]).toBe('Store');
    const dataRow = sheet.getRow(5).values as unknown[];
    expect(dataRow[1]).toBe('Downtown');
  });

  it('falls back to a dash when a row has no store name', async () => {
    const workbook = await buildStockCheckHistoryWorkbook([row()], '2026-09-20', '2026-09-20', { includeStore: true });
    const sheet = workbook.worksheets[0];
    const dataRow = sheet.getRow(5).values as unknown[];
    expect(dataRow[1]).toBe('—');
  });

  // Regression for a mismatch the UI never shows: a non-shortage, non-pending
  // row always reads "Sufficient" on screen (QtyNeededBadge), but the export
  // used to split it into "0 (Sufficient)" or "— (Optimal)" based on `buffer`.
  it('labels every non-shortage, non-pending row "Sufficient", matching the on-screen badge', async () => {
    const workbook = await buildStockCheckHistoryWorkbook(
      [row({ status: 'optimal', buffer: 0 }), row({ id: 2, status: 'optimal', buffer: 5 })],
      '2026-09-20', '2026-09-20',
    );
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(5).getCell(4).value).toBe('Sufficient');
    expect(sheet.getRow(6).getCell(4).value).toBe('Sufficient');
  });
});
