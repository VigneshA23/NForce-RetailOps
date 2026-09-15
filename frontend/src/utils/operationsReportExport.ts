import ExcelJS from 'exceljs';
import type { ChecklistHistorySummaryRow, ChecklistHistoryTaskDetailRow, ChecklistTaskDetailStatus } from '../types/checklistHistory';
import { formatTimeLabel } from './checklistHistoryOptions';

export interface OperationsSummaryTotals {
  storeId: number;
  storeName: string;
  scheduled: number;
  completed: number;
  issues: number;
}

// One row per store, summed across every date in the selected range -- reuses
// the exact Scheduled/Completed/Issue numbers the backend already computed
// per store-per-day; this only combines them.
export function summarizeByStore(rows: ChecklistHistorySummaryRow[]): OperationsSummaryTotals[] {
  const byStore = new Map<number, OperationsSummaryTotals>();
  for (const row of rows) {
    const existing = byStore.get(row.storeId) ?? {
      storeId: row.storeId,
      storeName: row.storeName,
      scheduled: 0,
      completed: 0,
      issues: 0,
    };
    existing.scheduled += row.totalTasks;
    existing.completed += row.completedTasks;
    existing.issues += row.issueCount;
    byStore.set(row.storeId, existing);
  }
  return Array.from(byStore.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export function completionPercent(scheduled: number, completed: number): number {
  return scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100);
}

export const TASK_DETAIL_STATUS_LABELS: Record<ChecklistTaskDetailStatus, string> = {
  COMPLETED: 'Completed',
  NOT_COMPLETED: 'Not Completed',
  ISSUE: 'Issue',
};

// ── 3-color report palette (navy / light blue-gray / green-or-red accent) ──
const COLOR_NAVY = 'FF1F3864';
const COLOR_SUBTITLE_TEXT = 'FF44546A';
const COLOR_HEADER_BG = 'FFDCE6F1';
const COLOR_STRIPE_BG = 'FFF2F6FB';
const COLOR_BORDER = 'FFE4E4E7';
const COLOR_WHITE = 'FFFFFFFF';
const COLOR_GREEN_BG = 'FFE1F8EC';
const COLOR_GREEN_TEXT = 'FF1A9C5C';
const COLOR_RED_BG = 'FFFCE7E9';
const COLOR_RED_TEXT = 'FFE0384A';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLOR_BORDER } },
  left: { style: 'thin', color: { argb: COLOR_BORDER } },
  bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
  right: { style: 'thin', color: { argb: COLOR_BORDER } },
};

const BANNER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
const STRIPE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_STRIPE_BG } };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Deterministic, locale-independent formatting -- unlike the app's own
// formatDateLabel/toLocaleDateString helpers, which vary with the viewer's
// browser locale and aren't guaranteed to match this report's fixed layout.
function formatLongDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

function formatDDMMYYYY(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  return `${formatDDMMYYYY(iso.slice(0, 10))} ${formatTimeLabel(iso)}`;
}

const TOTAL_COLUMNS = 8; // widest section (Task Detail): Store, Date, Category, Task, Status, Response, Employee, Completed At
const TASK_COLUMN_INDEX = 3; // zero-based -- Task Detail's "Task" column, needs the most width
const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 40;
const TASK_MIN_COLUMN_WIDTH = 30;
const TASK_MAX_COLUMN_WIDTH = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type Alignment = 'left' | 'center' | 'right';

// Tracks the longest value seen per physical column across all three stacked
// sections -- since they share the same columns (A-H) but hold different
// data per section, width is driven by whichever section's content is widest
// in that column.
class ColumnWidthTracker {
  private maxLen: number[] = new Array(TOTAL_COLUMNS).fill(0);

  track(colIndex: number, text: string): void {
    if (text.length > this.maxLen[colIndex]) this.maxLen[colIndex] = text.length;
  }

  applyTo(worksheet: ExcelJS.Worksheet): void {
    for (let i = 0; i < TOTAL_COLUMNS; i++) {
      const isTaskColumn = i === TASK_COLUMN_INDEX;
      const min = isTaskColumn ? TASK_MIN_COLUMN_WIDTH : MIN_COLUMN_WIDTH;
      const max = isTaskColumn ? TASK_MAX_COLUMN_WIDTH : MAX_COLUMN_WIDTH;
      worksheet.getColumn(i + 1).width = clamp(this.maxLen[i] + 2, min, max);
    }
  }
}

function writeBanner(worksheet: ExcelJS.Worksheet, rowNumber: number, title: string, columnCount: number): void {
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const row = worksheet.getRow(rowNumber);
  const cell = row.getCell(1);
  cell.value = title;
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLOR_WHITE } };
  cell.fill = BANNER_FILL;
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 20;
}

function writeHeaderRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  headers: string[],
  alignments: Alignment[],
  widths: ColumnWidthTracker,
): void {
  const row = worksheet.getRow(rowNumber);
  headers.forEach((header, i) => {
    const cell = row.getCell(i + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_NAVY } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: alignments[i] };
    widths.track(i, header);
  });
  row.height = 18;
}

function writeDataRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  values: Array<string | number>,
  displayText: string[],
  alignments: Alignment[],
  widths: ColumnWidthTracker,
  striped: boolean,
): ExcelJS.Row {
  const row = worksheet.getRow(rowNumber);
  values.forEach((value, i) => {
    const cell = row.getCell(i + 1);
    cell.value = value;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: alignments[i] };
    if (striped) cell.fill = STRIPE_FILL;
    widths.track(i, displayText[i]);
  });
  row.height = 16;
  return row;
}

function applyStatusStyle(cell: ExcelJS.Cell, status: ChecklistTaskDetailStatus): void {
  const isCompleted = status === 'COMPLETED';
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: isCompleted ? COLOR_GREEN_TEXT : COLOR_RED_TEXT } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isCompleted ? COLOR_GREEN_BG : COLOR_RED_BG } };
}

export function buildOperationsReportWorkbook(
  summary: OperationsSummaryTotals[],
  details: ChecklistHistoryTaskDetailRow[],
  startDate: string,
  endDate: string,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NForce RetailOps';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Daily Operations Report', {
    views: [{ state: 'frozen', ySplit: 2 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:2',
    },
  });

  const widths = new ColumnWidthTracker();

  // ── Title + date ──
  worksheet.mergeCells(1, 1, 1, TOTAL_COLUMNS);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = 'Daily Operations Report';
  titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: COLOR_NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(2, 1, 2, TOTAL_COLUMNS);
  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = startDate === endDate
    ? formatLongDate(startDate)
    : `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
  subtitleCell.font = { name: 'Calibri', size: 12, color: { argb: COLOR_SUBTITLE_TEXT } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 18;

  let rowCursor = 4; // row 3 left blank as a spacer

  // ── Store summary ──
  writeBanner(worksheet, rowCursor, 'STORE SUMMARY', 5);
  rowCursor += 1;
  writeHeaderRow(worksheet, rowCursor, ['Store', 'Scheduled', 'Completed', 'Completion %', 'Issues'], ['left', 'right', 'right', 'center', 'right'], widths);
  rowCursor += 1;
  summary.forEach((row, idx) => {
    const pct = completionPercent(row.scheduled, row.completed);
    const excelRow = writeDataRow(
      worksheet,
      rowCursor,
      [row.storeName, row.scheduled, row.completed, pct / 100, row.issues],
      [row.storeName, String(row.scheduled), String(row.completed), `${pct}%`, String(row.issues)],
      ['left', 'right', 'right', 'center', 'right'],
      widths,
      idx % 2 === 1,
    );
    excelRow.getCell(4).numFmt = '0%';
    rowCursor += 1;
  });

  rowCursor += 1; // spacer

  // ── Category breakdown ──
  const categoryMap = new Map<string, { completed: number; total: number }>();
  for (const row of details) {
    const cat = categoryMap.get(row.categoryName) ?? { completed: 0, total: 0 };
    cat.total += 1;
    if (row.status === 'COMPLETED') cat.completed += 1;
    categoryMap.set(row.categoryName, cat);
  }
  const categoryRows = Array.from(categoryMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  writeBanner(worksheet, rowCursor, 'CATEGORY BREAKDOWN', 4);
  rowCursor += 1;
  writeHeaderRow(worksheet, rowCursor, ['Category', 'Completed', 'Total', 'Completion %'], ['left', 'right', 'right', 'center'], widths);
  rowCursor += 1;
  categoryRows.forEach(([name, cat], idx) => {
    const pct = completionPercent(cat.total, cat.completed);
    const excelRow = writeDataRow(
      worksheet,
      rowCursor,
      [name, cat.completed, cat.total, pct / 100],
      [name, String(cat.completed), String(cat.total), `${pct}%`],
      ['left', 'right', 'right', 'center'],
      widths,
      idx % 2 === 1,
    );
    excelRow.getCell(4).numFmt = '0%';
    rowCursor += 1;
  });

  rowCursor += 1; // spacer

  // ── Task-level detail ──
  writeBanner(worksheet, rowCursor, 'TASK DETAIL', TOTAL_COLUMNS);
  rowCursor += 1;
  const detailAlignments: Alignment[] = ['left', 'center', 'left', 'left', 'center', 'center', 'left', 'center'];
  writeHeaderRow(worksheet, rowCursor, ['Store', 'Date', 'Category', 'Task', 'Status', 'Response', 'Employee', 'Completed At'], detailAlignments, widths);
  rowCursor += 1;
  details.forEach((row, idx) => {
    const dateLabel = formatDDMMYYYY(row.date);
    const statusLabel = TASK_DETAIL_STATUS_LABELS[row.status];
    const response = row.response ?? '';
    const employee = row.employeeFullName ?? '';
    const completedAt = formatTimestamp(row.completedAt);
    const values = [row.storeName, dateLabel, row.categoryName, row.taskName, statusLabel, response, employee, completedAt];
    const excelRow = writeDataRow(
      worksheet,
      rowCursor,
      values,
      values.map(String),
      detailAlignments,
      widths,
      idx % 2 === 1,
    );
    excelRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    applyStatusStyle(excelRow.getCell(5), row.status);
    rowCursor += 1;
  });

  widths.applyTo(worksheet);

  return workbook;
}
