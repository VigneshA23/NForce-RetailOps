import type ExcelJS from 'exceljs';

// Same report palette as the other RetailOps exports (stockCheckHistoryExport.ts,
// operationsReportExport.ts) -- duplicated here rather than shared, matching
// this codebase's existing convention of one small constant block per export
// util rather than a cross-cutting theme module.
const COLOR_NAVY = 'FF1F3864';
const COLOR_SUBTITLE_TEXT = 'FF44546A';
const COLOR_HEADER_BG = 'FFDCE6F1';
const COLOR_STRIPE_BG = 'FFF2F6FB';
const COLOR_BORDER = 'FFE4E4E7';

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

// Flattened, one row per store+supplier -- Excel/PDF have no notion of the
// report's own collapsible store accordion, so the store name is simply
// repeated down the column instead.
export interface SupplierPurchaseExportRow {
  storeName: string;
  supplierName: string;
  orderEntryCount: number;
  totalQuantity: number;
}

const HEADERS = ['Store', 'Supplier', 'Order Entries', 'Total Quantity'];
const COLUMN_WIDTHS = [26, 28, 16, 16];

export async function buildSupplierPurchaseReportWorkbook(
  rows: SupplierPurchaseExportRow[],
  startDate: string,
  endDate: string,
): Promise<ExcelJS.Workbook> {
  const { default: ExcelJSLib } = await import('exceljs');
  const workbook = new ExcelJSLib.Workbook();
  workbook.creator = 'NForce RetailOps';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Supplier Purchasing Report', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: false, printTitlesRow: '1:4' },
  });

  worksheet.mergeCells(1, 1, 1, HEADERS.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = 'Supplier Purchasing Report';
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
    const values: Array<string | number> = [row.storeName, row.supplierName, row.orderEntryCount, row.totalQuantity];
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      if (idx % 2 === 1) cell.fill = STRIPE_FILL;
    });
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

const PDF_NAVY: [number, number, number] = [31, 56, 100];

export async function buildAndDownloadSupplierPurchaseReportPdf(
  rows: SupplierPurchaseExportRow[],
  startDate: string,
  endDate: string,
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
  doc.text('Supplier Purchasing Report', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  const dateLabel = startDate === endDate ? formatLongDate(startDate) : `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
  doc.text(dateLabel, margin, y);
  y += 5;

  doc.text(`${rows.length} record${rows.length === 1 ? '' : 's'}`, margin, y);
  y += 5;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  const body = rows.map((row) => [row.storeName, row.supplierName, row.orderEntryCount, row.totalQuantity]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [HEADERS],
    body,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: PDF_NAVY, textColor: 255, fontStyle: 'bold' },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7.5);
  doc.text(`Total Records: ${rows.length}`, margin, finalY + 6);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, finalY + 6, { align: 'right' });

  doc.save(filename);
}
