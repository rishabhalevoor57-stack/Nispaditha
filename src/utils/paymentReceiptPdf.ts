import jsPDF from 'jspdf';
import type { BusinessSettings } from '@/types/invoice';
import { ensureNotoLoaded, registerNotoFont } from './pdfFont';

const PURPLE: [number, number, number] = [74, 32, 96];
const PURPLE_LIGHT: [number, number, number] = [245, 238, 255];
const GREEN_PAID: [number, number, number] = [39, 174, 96];
const RUPEE = '\u20B9';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const money = (n: number) => `${RUPEE} ${fmt(n)}`;

const formatMode = (m: string) => {
  const map: Record<string, string> = {
    cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank Transfer',
  };
  return map[m] || m.toUpperCase();
};

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/images/nispaditha-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function whitenLogo(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 0) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
      }
      ctx.putImageData(data, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export interface ReceiptPdfData {
  receiptNumber: string;
  invoiceNumber: string;
  paymentDate: string; // ISO or yyyy-mm-dd
  amount: number;
  paymentMode: string;
  customerName: string;
  customerPhone?: string;
  grandTotal: number;
  totalPaid: number;
  notes?: string;
  businessSettings: BusinessSettings;
}

export async function downloadPaymentReceipt(data: ReceiptPdfData) {
  await ensureNotoLoaded();
  // A5 portrait
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const ok = registerNotoFont(doc);
  const FONT = ok ? 'NotoSans' : 'helvetica';
  doc.setFont(FONT, 'normal');

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Header
  const headerH = 22;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageW, headerH, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(10);
  doc.text(data.businessSettings.business_name || 'Nispaditha Ventures LLP', margin, 8);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.text(data.businessSettings.address || '', margin, 12, { maxWidth: pageW * 0.45 });

  try {
    const raw = await loadLogoDataUrl();
    if (raw) {
      const white = await whitenLogo(raw);
      doc.addImage(white, 'PNG', pageW / 2 - 11, 3, 22, 14);
    }
  } catch { /* optional */ }

  doc.setFontSize(7);
  doc.text(`GSTIN: ${data.businessSettings.gst_number || '29AAQFN9742E1ZO'}`, pageW - margin, 9, { align: 'right' });
  doc.text(`Phone: ${data.businessSettings.phone || ''}`, pageW - margin, 13, { align: 'right' });

  // Title band
  let y = headerH;
  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(0, y, pageW, 8, 'F');
  doc.setTextColor(...PURPLE);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('PAYMENT RECEIPT', pageW / 2, y + 5.5, { align: 'center' });
  y += 10;

  // Meta
  doc.setTextColor(0, 0, 0);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  const dateStr = new Date(data.paymentDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const labelGap = 5;
  const meta = [
    ['Receipt No', data.receiptNumber],
    ['Invoice Ref', data.invoiceNumber],
    ['Payment Date', dateStr],
    ['Customer', data.customerName],
    ['Phone', data.customerPhone || '-'],
    ['Payment Mode', formatMode(data.paymentMode)],
  ];
  meta.forEach(([k, v]) => {
    doc.setTextColor(110, 110, 110);
    doc.text(k, margin, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont(FONT, 'bold');
    doc.text(String(v), margin + 32, y);
    doc.setFont(FONT, 'normal');
    y += labelGap;
  });
  y += 3;

  // Amount band
  const bandH = 14;
  doc.setFillColor(...PURPLE);
  doc.rect(margin, y, pageW - margin * 2, bandH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(10);
  doc.text('AMOUNT RECEIVED', margin + 3, y + 9);
  doc.setFontSize(14);
  doc.text(money(data.amount), pageW - margin - 3, y + 9, { align: 'right' });
  y += bandH + 5;

  // Running balance summary
  doc.setTextColor(0, 0, 0);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  const balance = Math.max(0, data.grandTotal - data.totalPaid);

  const summary = [
    ['Total Bill', money(data.grandTotal)],
    ['Total Paid (incl. this receipt)', money(data.totalPaid)],
    ['Balance Due', money(balance)],
  ];
  summary.forEach(([k, v], i) => {
    if (i === 2 && balance === 0) doc.setTextColor(...GREEN_PAID);
    doc.text(k, margin, y);
    doc.text(v, pageW - margin, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 5;
  });

  if (balance === 0) {
    y += 2;
    doc.setFillColor(234, 250, 241);
    doc.setDrawColor(...GREEN_PAID);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, pageW - margin * 2, 9, 1.5, 1.5, 'FD');
    doc.setTextColor(...GREEN_PAID);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(10);
    doc.text('PAID IN FULL', pageW / 2, y + 6, { align: 'center' });
    y += 12;
    doc.setLineWidth(0.1);
  }

  if (data.notes) {
    y += 3;
    doc.setTextColor(90, 90, 90);
    doc.setFont(FONT, 'italic');
    doc.setFontSize(8);
    doc.text(`Note: ${data.notes}`, margin, y, { maxWidth: pageW - margin * 2 });
  }

  // Footer
  const footerH = 10;
  doc.setFillColor(...PURPLE);
  doc.rect(0, pageH - footerH, pageW, footerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.text('Thank you for your payment!', margin, pageH - 4);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.text('Computer-generated receipt', pageW - margin, pageH - 4, { align: 'right' });

  doc.save(`${data.receiptNumber}.pdf`);
}
