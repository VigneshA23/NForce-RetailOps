import type ExcelJS from 'exceljs';
import { categoryLabel } from '../types/storeInventory';
import { formatDateLabel, formatTimeLabel } from './checklistHistoryOptions';
import type { StockCheckHistoryRowView } from './stockCheckHistoryStatus';

// Same 3-color report palette as the daily checklist's own export
// (operationsReportExport.ts) -- reused here so this reads as the same
// "RetailOps export" rather than a one-off CSV, even though the data and
// table shape are entirely different.
const COLOR_NAVY = 'FF1F3864';
const COLOR_SUBTITLE_TEXT = 'FF44546A';
const COLOR_HEADER_BG = 'FFDCE6F1';
const COLOR_STRIPE_BG = 'FFF2F6FB';
const COLOR_BORDER = 'FFE4E4E7';
const COLOR_GREEN_BG = 'FFE1F8EC';
const COLOR_GREEN_TEXT = 'FF1A9C5C';
const COLOR_RED_BG = 'FFFCE7E9';
const COLOR_RED_TEXT = 'FFE0384A';
const COLOR_GRAY_BG = 'FFF1F1F3';
const COLOR_GRAY_TEXT = 'FF6B7280';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLOR_BORDER } },
  left: { style: 'thin', color: { argb: COLOR_BORDER } },
  bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
  right: { style: 'thin', color: { argb: COLOR_BORDER } },
};

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
const STRIPE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_STRIPE_BG } };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatLongDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}


// Mirrors StockCheckHistory.tsx's own row derivation exactly, so the export
// can never drift from what the table shows again -- see RTS-303.
function recordedByName(row: StockCheckHistoryRowView): string | null {
  return row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? null;
}

function recordedAt(row: StockCheckHistoryRowView): string | null {
  return row.endOfDay?.lastUpdatedAt ?? row.startOfDay?.lastUpdatedAt ?? null;
}

function countEntered(row: StockCheckHistoryRowView): number | null {
  return row.endOfDay?.usable ?? row.startOfDay?.usable ?? null;
}

function itemAndCategoryLabel(row: StockCheckHistoryRowView): string {
  return row.category ? `${row.itemName} (${categoryLabel(row.category)})` : row.itemName;
}

function dateAndTimestampLabel(row: StockCheckHistoryRowView): string {
  const at = recordedAt(row);
  return at ? `${formatDateLabel(row.checkDate)} ${formatTimeLabel(at)}` : formatDateLabel(row.checkDate);
}

function countEnteredLabel(row: StockCheckHistoryRowView): string {
  const counted = countEntered(row);
  return counted != null ? `${counted} ${row.unitOfMeasurement}` : '—';
}

// Plain-string port of StockCheckHistory.tsx's QtyNeededBadge JSX branches.
function qtyNeededLabel(row: StockCheckHistoryRowView): string {
  if (row.status === 'shortage') return `+${row.deficit} ${row.unitOfMeasurement} needed`;
  if (row.status === 'pending') return '— (Not Counted)';
  return row.buffer && row.buffer > 0 ? '— (Optimal)' : '0 (Sufficient)';
}

function applyStatusStyle(cell: ExcelJS.Cell, status: StockCheckHistoryRowView['status']): void {
  const [textColor, bgColor] = status === 'optimal'
    ? [COLOR_GREEN_TEXT, COLOR_GREEN_BG]
    : status === 'pending'
      ? [COLOR_GRAY_TEXT, COLOR_GRAY_BG]
      : [COLOR_RED_TEXT, COLOR_RED_BG];
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: textColor } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
}

const HEADERS = ['Item & Category', 'Date & Timestamp', 'Count Entered', 'Qty Needed (Par Reconciled)', 'Recorded By'];
const COLUMN_WIDTHS = [30, 20, 16, 24, 20];

// Mirrors buildOperationsReportWorkbook's banner/header/stripe layout
// (operationsReportExport.ts), built fresh for this table's own columns
// rather than trying to force stock-check rows through that function's
// checklist-specific (Store/Category/Task Detail) section shape.
export async function buildStockCheckHistoryWorkbook(
  rows: StockCheckHistoryRowView[],
  startDate: string,
  endDate: string,
): Promise<ExcelJS.Workbook> {
  const { default: ExcelJSLib } = await import('exceljs');
  const workbook = new ExcelJSLib.Workbook();
  workbook.creator = 'NForce RetailOps';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Stock Check History', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: false, printTitlesRow: '1:4' },
  });

  worksheet.mergeCells(1, 1, 1, HEADERS.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = 'Stock Check History';
  titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: COLOR_NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(2, 1, 2, HEADERS.length);
  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = startDate === endDate
    ? formatLongDate(startDate)
    : `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
  subtitleCell.font = { name: 'Calibri', size: 12, color: { argb: COLOR_SUBTITLE_TEXT } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 18;

  worksheet.mergeCells(3, 1, 3, HEADERS.length);
  const countCell = worksheet.getCell(3, 1);
  countCell.value = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  countCell.font = { name: 'Calibri', size: 11, color: { argb: COLOR_SUBTITLE_TEXT } };
  countCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(3).height = 16;

  const headerRowNumber = 4;
  const headerRow = worksheet.getRow(headerRowNumber);
  HEADERS.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_NAVY } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
  });
  headerRow.height = 18;

  rows.forEach((row, idx) => {
    const excelRow = worksheet.getRow(headerRowNumber + 1 + idx);
    const values: Array<string | number> = [
      itemAndCategoryLabel(row),
      dateAndTimestampLabel(row),
      countEnteredLabel(row),
      qtyNeededLabel(row),
      recordedByName(row) ?? '—',
    ];
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      if (idx % 2 === 1) cell.fill = STRIPE_FILL;
    });
    applyStatusStyle(excelRow.getCell(4), row.status);
    excelRow.height = 16;
  });

  const totalRowNumber = headerRowNumber + 1 + rows.length;
  worksheet.mergeCells(totalRowNumber, 1, totalRowNumber, HEADERS.length);
  const totalCell = worksheet.getCell(totalRowNumber, 1);
  totalCell.value = `Total Records: ${rows.length}`;
  totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_NAVY } };
  totalCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(totalRowNumber).height = 18;

  worksheet.columns.forEach((column, i) => {
    column.width = COLUMN_WIDTHS[i];
  });

  return workbook;
}

// RGB equivalents of the ARGB report palette above -- jsPDF/autoTable take
// plain [r, g, b] rather than ExcelJS's ARGB hex strings, so these can't
// share the same constants.
const PDF_NAVY: [number, number, number] = [31, 56, 100];
const PDF_GREEN: [number, number, number] = [26, 156, 92];
const PDF_RED: [number, number, number] = [224, 56, 74];
const PDF_GRAY: [number, number, number] = [107, 114, 128];

// Mirrors buildAndDownloadOperationsReportPdf's layout (title, subtitle,
// autoTable body, generated-at footer) -- same libraries, same visual
// language, this table's own columns.
export async function buildAndDownloadStockCheckHistoryPdf(
  rows: StockCheckHistoryRowView[],
  startDate: string,
  endDate: string,
  storeName: string | null | undefined,
  filename: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Stock Check History', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  const dateLabel = startDate === endDate ? formatLongDate(startDate) : `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
  doc.text(storeName ? `${storeName} — ${dateLabel}` : dateLabel, margin, y);
  y += 5;

  doc.text(`${rows.length} record${rows.length === 1 ? '' : 's'}`, margin, y);
  y += 5;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  const rowStatuses = rows.map((row) => row.status);
  const body = rows.map((row) => [
    itemAndCategoryLabel(row),
    dateAndTimestampLabel(row),
    countEnteredLabel(row),
    qtyNeededLabel(row),
    recordedByName(row) ?? '—',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [HEADERS],
    body,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: PDF_NAVY, textColor: 255, fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 3) return;
      const status = rowStatuses[data.row.index];
      data.cell.styles.textColor = status === 'optimal' ? PDF_GREEN : status === 'pending' ? PDF_GRAY : PDF_RED;
      data.cell.styles.fontStyle = 'bold';
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7.5);
  doc.text(`Total Records: ${rows.length}`, margin, finalY + 6);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, finalY + 6, { align: 'right' });

  doc.save(filename);
}
