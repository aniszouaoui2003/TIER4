/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Generic .xlsx read/write mechanics shared by every KPI import/export entry point.
// exceljs is dynamically imported so its ~1MB bundle only loads when a user actually
// clicks Import/Export, not as part of the main app bundle.

export interface SheetSpec {
  sheetName: string;
  // Freeform rows shown above the header row (e.g. which view was exported, export date).
  metaRows: string[][];
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

export async function downloadWorkbook(spec: SheetSpec): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(spec.sheetName);

  spec.metaRows.forEach(r => sheet.addRow(r));
  if (spec.metaRows.length > 0) sheet.addRow([]);

  const headerRow = sheet.addRow(spec.headers);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  spec.rows.forEach(r => sheet.addRow(r));

  spec.headers.forEach((header, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = header === 'Indicateur' ? 42 : Math.max(12, header.length + 4);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = spec.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

// Locates the header row by its first cell ("ID KPI") so metadata rows above it can be
// anything, then reads every non-blank row below as string cells (the caller parses numbers).
export async function readWorkbook(file: File): Promise<ParsedSheet> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Le fichier ne contient aucune feuille.');
  }

  let headerRowIndex = -1;
  sheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1) return;
    const firstCell = String(row.getCell(1).value ?? '').trim();
    if (firstCell === 'ID KPI') headerRowIndex = rowNumber;
  });
  if (headerRowIndex === -1) {
    throw new Error('Format de fichier non reconnu (colonne "ID KPI" introuvable). Utilisez un fichier exporté depuis cette application.');
  }

  const headerRow = sheet.getRow(headerRowIndex);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, cell => headers.push(String(cell.value ?? '').trim()));

  const rows: string[][] = [];
  for (let i = headerRowIndex + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (row.cellCount === 0) continue;
    const vals: string[] = [];
    for (let c = 1; c <= headers.length; c++) {
      vals.push(String(row.getCell(c).value ?? ''));
    }
    if (vals.every(v => v.trim() === '')) continue;
    rows.push(vals);
  }

  return { headers, rows };
}
