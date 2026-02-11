import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data: any[], filename: string, sheetName = 'Report') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportToPDF = (
  title: string,
  columns: { header: string; key: string }[],
  data: any[],
  filename: string,
) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 28);

  const headers = columns.map(c => c.header);
  const rows = data.map(row => columns.map(c => String(row[c.key] ?? '')));

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 34,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [180, 145, 60] },
  });

  doc.save(`${filename}.pdf`);
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};
