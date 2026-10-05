import type ExcelJS from 'exceljs';

export interface StockCheckHistoryExportRow {
  itemName: string;
  checkDate: string;
  counted: number | null;
  requiredPar: number | null;
  unitOfMeasurement: string;
  status: 'shortage' | 'optimal' | 'pending';
  deficit: number | null;
  buffer: number | null;
}

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

function formatDDMMYYYY(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

const STATUS_LABELS: Record<StockCheckHistoryExportRow['status'], string> = {
  shortage: 'Shortage',
  optimal: 'Optimal',
  pending: 'Not Counted',
};

function varianceLabel(row: StockCheckHistoryExportRow): string {
  if (row.status === 'shortage') return `-${row.deficit} ${row.unitOfMeasurement}`;
  if (row.status === 'optimal') return `+${row.buffer} ${row.unitOfMeasurement}`;
  return '—';
}

function applyStatusStyle(cell: ExcelJS.Cell, status: StockCheckHistoryExportRow['status']): void {
  const [textColor, bgColor] = status === 'optimal'
    ? [COLOR_GREEN_TEXT, COLOR_GREEN_BG]
    : status === 'pending'
      ? [COLOR_GRAY_TEXT, COLOR_GRAY_BG]
      : [COLOR_RED_TEXT, COLOR_RED_BG];
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: textColor } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
}

const HEADERS = ['Item', 'Date', 'Counted', 'Required Par', 'Unit', 'Status', 'Variance'];
const COLUMN_WIDTHS = [28, 14, 12, 14, 10, 14, 14];

// Mirrors buildOperationsReportWorkbook's banner/header/stripe layout
// (operationsReportExport.ts), built fresh for this table's own columns
// rather than trying to force stock-check rows through that function's
// checklist-specific (Store/Category/Task Detail) section shape.
export async function buildStockCheckHistoryWorkbook(
  rows: StockCheckHistoryExportRow[],
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
      row.itemName,
      formatDDMMYYYY(row.checkDate),
      row.counted ?? '—',
      row.requiredPar ?? '—',
      row.unitOfMeasurement,
      STATUS_LABELS[row.status],
      varianceLabel(row),
    ];
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      if (idx % 2 === 1) cell.fill = STRIPE_FILL;
    });
    applyStatusStyle(excelRow.getCell(6), row.status);
    excelRow.height = 16;
  });

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
  rows: StockCheckHistoryExportRow[],
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

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  const rowStatuses = rows.map((row) => row.status);
  const body = rows.map((row) => [
    row.itemName,
    formatDDMMYYYY(row.checkDate),
    row.counted ?? '—',
    row.requiredPar ?? '—',
    row.unitOfMeasurement,
    STATUS_LABELS[row.status],
    varianceLabel(row),
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
      if (data.section !== 'body' || data.column.index !== 5) return;
      const status = rowStatuses[data.row.index];
      data.cell.styles.textColor = status === 'optimal' ? PDF_GREEN : status === 'pending' ? PDF_GRAY : PDF_RED;
      data.cell.styles.fontStyle = 'bold';
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, finalY + 6);

  doc.save(filename);
}
