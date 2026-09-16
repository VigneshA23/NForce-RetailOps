import type { ChecklistHistoryTaskDetailRow } from '../types/checklistHistory';
import { buildResponseHistoryLines, completionPercent, formatDDMMYYYY, formatTimestamp, TASK_DETAIL_STATUS_LABELS } from './operationsReportExport';

export interface OperationsReportPdfParams {
  title: string;
  // Pre-formatted date label for the subtitle line, e.g. "Wednesday, September 16, 2026"
  // for a single day, or "16 Sept 2026 – 20 Sept 2026" for a range -- callers format
  // this themselves since a single-day vs range subtitle reads differently.
  dateLabel: string;
  scheduled: number;
  completed: number;
  issues: number;
  details: ChecklistHistoryTaskDetailRow[];
  filename: string;
}

// Shared by both the single-day "Export as PDF" and the date-range PDF export --
// previously this whole ~120-line builder lived inline in ExportMenu.tsx's
// handleExportPdf, duplicated (or missing entirely) for the range case.
export async function buildAndDownloadOperationsReportPdf(params: OperationsReportPdfParams): Promise<void> {
  const { title, dateLabel, scheduled, completed, issues, details, filename } = params;
  const pct = completionPercent(scheduled, completed);

  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Daily Checklist — ${dateLabel}`, margin, y);
  y += 5;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // Stats row
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  const stats = [
    `Scheduled: ${scheduled}`,
    `Completed: ${completed}`,
    `Completion: ${pct}%`,
    `Issues: ${issues}`,
  ];
  const colW = (pageW - 2 * margin) / stats.length;
  stats.forEach((stat, i) => {
    doc.text(stat, margin + i * colW, y);
  });
  y += 8;

  // Body rows and a parallel status array built from the SAME map() call, so the
  // status-color hook below never has to re-derive a row's identity from a
  // positional lookup into a separately-held `details` array -- both arrays are
  // guaranteed the same length/order autoTable iterates.
  const rowStatuses = details.map((row) => row.status);
  const body = details.map((row) => {
    const { changeLines, typeLines } = buildResponseHistoryLines(row.correctionHistory, row.responseType, row.numericUnit);
    return [
      row.storeName,
      formatDDMMYYYY(row.date),
      row.categoryName,
      row.taskName,
      TASK_DETAIL_STATUS_LABELS[row.status],
      row.response ?? '',
      row.employeeFullName ?? '',
      formatTimestamp(row.completedAt),
      changeLines.join('\n'),
      typeLines.join('\n'),
    ];
  });

  // Table -- autoTable owns column widths, wrapping, row height and pagination
  // (including repeating the header on each new page), so rows with a long
  // wrapped task/category name or multi-entry history can no longer overlap the
  // row below, unlike a fixed-row-height manual layout.
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Store', 'Date', 'Category', 'Task', 'Status', 'Response', 'Employee', 'Timestamp', 'Response History', 'Change Type']],
    body,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      3: { cellWidth: 30 }, // Task
      8: { cellWidth: 32 }, // Response History -- each line is one prior value
      9: { cellWidth: 28 }, // Change Type
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 4) return;
      const status = rowStatuses[data.row.index];
      if (status === 'COMPLETED') {
        data.cell.styles.textColor = [26, 156, 92];
      } else if (status === 'ISSUE') {
        data.cell.styles.textColor = [224, 56, 74];
      } else if (status === 'INACTIVE') {
        data.cell.styles.textColor = [107, 114, 128];
      }
      data.cell.styles.fontStyle = 'bold';
    },
  });

  // Footer -- jspdf-autotable sets doc.lastAutoTable.finalY at runtime, but this
  // version's published types don't declare it on jsPDF, hence the cast.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, finalY + 6);

  doc.save(filename);
}
