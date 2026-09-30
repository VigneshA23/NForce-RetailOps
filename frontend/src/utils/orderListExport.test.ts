import { describe, expect, it } from 'vitest';
import { buildOrderListText, buildReorderListText } from './orderListExport';
import type { OrderListEntry } from '../types/orderList';

const GENERATED_AT = new Date(2026, 8, 30); // September 30, 2026

function entry(overrides: Partial<OrderListEntry>): OrderListEntry {
  return {
    id: 1,
    storeInventoryItemId: 100,
    itemName: 'Milk',
    unitOfMeasurement: 'gallons',
    quantityNeeded: 12,
    supplierId: 1,
    supplierName: 'Acme Supplies',
    note: null,
    status: 'NEEDS_ORDERING',
    adHoc: false,
    raisedByName: null,
    createdAt: '2026-09-24T15:30:00Z',
    updatedAt: '2026-09-24T15:30:00Z',
    ...overrides,
  };
}

describe('buildReorderListText', () => {
  it('returns null for an empty entry list', () => {
    expect(buildReorderListText([], 'Downtown', GENERATED_AT)).toBeNull();
  });

  it('returns null when nothing needs ordering', () => {
    const entries = [
      entry({ status: 'ORDERED' }),
      entry({ id: 2, status: 'RECEIVED' }),
    ];
    expect(buildReorderListText(entries, 'Downtown', GENERATED_AT)).toBeNull();
  });

  it('excludes zero-quantity items even if flagged NEEDS_ORDERING', () => {
    const entries = [entry({ quantityNeeded: 0 })];
    expect(buildReorderListText(entries, 'Downtown', GENERATED_AT)).toBeNull();
  });

  it('excludes items already ordered or received, keeping only what still needs ordering', () => {
    const entries = [
      entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' }),
      entry({ id: 2, itemName: 'Bread', status: 'ORDERED' }),
      entry({ id: 3, itemName: 'Eggs', status: 'RECEIVED' }),
    ];
    const text = buildReorderListText(entries, 'Downtown', GENERATED_AT)!;
    expect(text).toContain('Milk');
    expect(text).not.toContain('Bread');
    expect(text).not.toContain('Eggs');
  });

  it('formats each line as "Item Name — Quantity Unit"', () => {
    const entries = [entry({ itemName: 'Milk', quantityNeeded: 12, unitOfMeasurement: 'gallons' })];
    const text = buildReorderListText(entries, 'Downtown', GENERATED_AT)!;
    expect(text).toContain('* Milk — 12 gallons');
  });

  it('groups multiple items under the same supplier together', () => {
    const entries = [
      entry({ id: 1, itemName: 'Milk', supplierId: 1, supplierName: 'Acme Supplies' }),
      entry({ id: 2, itemName: 'Eggs', supplierId: 1, supplierName: 'Acme Supplies' }),
      entry({ id: 3, itemName: 'Bread', supplierId: 1, supplierName: 'Acme Supplies' }),
    ];
    const text = buildReorderListText(entries, 'Downtown', GENERATED_AT)!;
    const lines = text.split('\n');
    const supplierIndex = lines.indexOf('Acme Supplies');
    expect(supplierIndex).toBeGreaterThanOrEqual(0);
    expect(lines[supplierIndex + 1]).toContain('Milk');
    expect(lines[supplierIndex + 2]).toContain('Eggs');
    expect(lines[supplierIndex + 3]).toContain('Bread');
  });

  it('sorts supplier groups alphabetically, case-insensitively', () => {
    const entries = [
      entry({ id: 1, itemName: 'Item A', supplierId: 2, supplierName: 'fresh foods' }),
      entry({ id: 2, itemName: 'Item B', supplierId: 3, supplierName: 'Global Wholesale' }),
      entry({ id: 3, itemName: 'Item C', supplierId: 1, supplierName: 'Acme Supplies' }),
    ];
    const text = buildReorderListText(entries, 'Downtown', GENERATED_AT)!;
    const order = ['Acme Supplies', 'fresh foods', 'Global Wholesale'].map((name) => text.indexOf(name));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('groups supplier-less entries into a dedicated Unassigned Supplier group placed last', () => {
    const entries = [
      entry({ id: 1, itemName: 'Zebra Item', supplierId: 5, supplierName: 'Zylo Supplies' }),
      entry({ id: 2, itemName: 'Cleaning Spray', supplierId: null, supplierName: null }),
    ];
    const text = buildReorderListText(entries, 'Downtown', GENERATED_AT)!;
    const lines = text.split('\n').filter((l) => l.length > 0);
    expect(lines[lines.length - 2]).toBe('Unassigned Supplier');
    expect(lines[lines.length - 1]).toContain('Cleaning Spray');
  });

  it('treats a blank/whitespace-only supplier name the same as no supplier', () => {
    const entries = [entry({ supplierId: 1, supplierName: '   ' })];
    const text = buildReorderListText(entries, 'Downtown', GENERATED_AT)!;
    expect(text).toContain('Unassigned Supplier');
  });

  it('groups entries by supplierId rather than by the raw supplierName string', () => {
    const entries = [
      entry({ id: 1, itemName: 'Item A', supplierId: 1, supplierName: 'ABC Supplies' }),
      entry({ id: 2, itemName: 'Item B', supplierId: 1, supplierName: 'ABC Supplies' }),
    ];
    const text = buildReorderListText(entries, 'Downtown', GENERATED_AT)!;
    expect(text.match(/ABC Supplies/g)).toHaveLength(1);
  });

  it('produces the same output for the same input (deterministic)', () => {
    const entries = [
      entry({ id: 1, itemName: 'Milk', supplierId: 1, supplierName: 'Acme Supplies' }),
      entry({ id: 2, itemName: 'Cleaning Spray', supplierId: null, supplierName: null }),
    ];
    expect(buildReorderListText(entries, 'Downtown', GENERATED_AT)).toEqual(
      buildReorderListText(entries, 'Downtown', GENERATED_AT),
    );
  });

  it('leads with a REORDER LIST title, then aligned Store and Date lines', () => {
    const text = buildReorderListText([entry({})], 'Keds Ice Cream - Murphy', GENERATED_AT)!;
    const lines = text.split('\n');
    expect(lines[0]).toBe('*REORDER LIST :*');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('*Store  - Keds Ice Cream - Murphy*');
    expect(lines[3]).toBe('*Date   - September 30, 2026*');
  });

  it('falls back to a placeholder store name when none is given', () => {
    const text = buildReorderListText([entry({})], null, GENERATED_AT)!;
    expect(text).toContain('*Store  - Unknown Store*');
  });
});

describe('buildOrderListText', () => {
  it('returns a plain message when nothing is active', () => {
    expect(buildOrderListText([], 'Downtown', GENERATED_AT)).toBe('No items currently need ordering.');
  });

  it('leads with an Order List title, then aligned Store and Date lines', () => {
    const text = buildOrderListText([entry({})], 'Keds Ice Cream - Murphy', GENERATED_AT);
    const lines = text.split('\n');
    expect(lines[0]).toBe('*Order List :*');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('*Store  - Keds Ice Cream - Murphy*');
    expect(lines[3]).toBe('*Date   - September 30, 2026*');
  });

  it('formats each line with an asterisk bullet and an en dash', () => {
    const text = buildOrderListText([entry({ itemName: 'Milk', quantityNeeded: 4, unitOfMeasurement: 'bottles' })], 'Downtown', GENERATED_AT);
    expect(text).toContain('* Milk – 4 bottles');
  });

  it('groups supplier-less entries under "No Supplier Assigned"', () => {
    const text = buildOrderListText([entry({ supplierId: null, supplierName: null })], 'Downtown', GENERATED_AT);
    expect(text).toContain('No Supplier Assigned');
  });

  it('notes already-ordered entries inline', () => {
    const text = buildOrderListText([entry({ status: 'ORDERED' })], 'Downtown', GENERATED_AT);
    expect(text).toContain('(already ordered)');
  });
});
