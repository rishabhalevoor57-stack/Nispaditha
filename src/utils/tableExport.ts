import { exportToExcel, exportToPDF } from './reportExport';

export interface ExportColumn {
  header: string;
  key: string;
  format?: (row: any) => string | number;
}

export function exportRowsExcel(rows: any[], columns: ExportColumn[], filename: string, sheetName = 'Data') {
  const data = rows.map(r => {
    const out: Record<string, any> = {};
    columns.forEach(c => { out[c.header] = c.format ? c.format(r) : (r[c.key] ?? ''); });
    return out;
  });
  exportToExcel(data, filename, sheetName);
}

export function exportRowsPDF(rows: any[], columns: ExportColumn[], title: string, filename: string) {
  const flat = rows.map(r => {
    const out: Record<string, any> = {};
    columns.forEach(c => { out[c.key] = c.format ? c.format(r) : (r[c.key] ?? ''); });
    return out;
  });
  exportToPDF(title, columns.map(c => ({ header: c.header, key: c.key })), flat, filename);
}
