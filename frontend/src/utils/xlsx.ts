import type ExcelJS from 'exceljs';

// Same createObjectURL/anchor-click/revokeObjectURL pattern as downloadCsv used
// to follow -- just with the .xlsx MIME type and an async buffer instead of a
// plain string.
export async function downloadWorkbook(filename: string, workbook: ExcelJS.Workbook): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
