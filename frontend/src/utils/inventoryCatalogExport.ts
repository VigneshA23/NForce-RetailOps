import { INVENTORY_ITEM_CATEGORY_OPTIONS, type StoreInventoryItem } from '../types/storeInventory';
import { STOCK_STATUS_META, getStockStatus } from './storeInventoryStatus';

const CATEGORY_LABELS = Object.fromEntries(INVENTORY_ITEM_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

const CSV_COLUMNS = ['Name', 'Category', 'Supplier', 'Unit', 'Wkday Qty', 'Wkend Qty', 'On Hand', 'Status'];

function csvRow(item: StoreInventoryItem): string[] {
  return [
    item.name,
    item.category ? CATEGORY_LABELS[item.category] : '',
    item.preferredSupplierName ?? '',
    item.unitOfMeasurement,
    item.minWeekday != null ? String(item.minWeekday) : '',
    item.minWeekend != null ? String(item.minWeekend) : '',
    item.currentAvailable != null ? String(item.currentAvailable) : '',
    STOCK_STATUS_META[getStockStatus(item)].label,
  ];
}

// Escapes a field for CSV: wraps in quotes (doubling any embedded quotes)
// whenever it contains a comma, quote or newline.
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Same createObjectURL/anchor-click/revokeObjectURL pattern as
// utils/xlsx.ts's downloadWorkbook.
function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportInventoryCatalogCsv(items: StoreInventoryItem[], filename = 'inventory-catalog.csv'): void {
  const lines = [CSV_COLUMNS, ...items.map(csvRow)].map((row) => row.map(escapeCsvField).join(','));
  downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
}

export async function exportInventoryCatalogPdf(items: StoreInventoryItem[], filename = 'inventory-catalog.pdf'): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const margin = 14;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Inventory Catalog', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [CSV_COLUMNS],
    body: items.map(csvRow),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: 'bold' },
  });

  doc.save(filename);
}
