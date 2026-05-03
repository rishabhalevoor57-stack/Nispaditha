import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InvoiceItem, InvoiceTotals, BusinessSettings } from '@/types/invoice';
import { ensureNotoLoaded, registerNotoFont } from './pdfFont';

interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientPhone: string;
  paymentMode: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  businessSettings: BusinessSettings;
  notes?: string;
  gstPercentage?: number;
  roundOff?: number;
  advancePaid?: number;
}

const PURPLE: [number, number, number] = [74, 32, 96];
const PURPLE_LIGHT: [number, number, number] = [245, 238, 255];
const ROW_ALT: [number, number, number] = [253, 249, 255];
const PURPLE_BORDER: [number, number, number] = [107, 58, 138];
const GREEN_PAID: [number, number, number] = [39, 174, 96];
const ORANGE: [number, number, number] = [217, 119, 6];

const RUPEE = '\u20B9';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const money = (n: number) => `${RUPEE} ${formatCurrency(n)}`;

const formatPaymentMode = (mode: string): string => {
  const modes: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    pay_later: 'Pay Later',
  };
  return modes[mode] || mode.toUpperCase();
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
  } catch {
    return null;
  }
}

// White-tint a PNG so it shows on the purple header
async function whitenLogo(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 0) {
          px[i] = 255;
          px[i + 1] = 255;
          px[i + 2] = 255;
        }
      }
      ctx.putImageData(data, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<jsPDF> {
  await ensureNotoLoaded();
  const doc = new jsPDF();
  const fontRegistered = registerNotoFont(doc);
  const FONT = fontRegistered ? 'NotoSans' : 'helvetica';
  doc.setFont(FONT, 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const gstPct = data.gstPercentage ?? 3;
  const roundOff = data.roundOff ?? 0;
  const advancePaid = data.advancePaid ?? 0;

  // ================== PURPLE HEADER ==================
  const headerHeight = 26;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text(data.businessSettings.business_name || 'Nispaditha Ventures LLP', margin, 9);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  if (data.businessSettings.address) {
    const wrapped = doc.splitTextToSize(data.businessSettings.address, pageWidth * 0.38);
    doc.text(wrapped, margin, 13);
  }

  // CENTER logo (white-tinted)
  try {
    const raw = await loadLogoDataUrl();
    if (raw) {
      const white = await whitenLogo(raw);
      const logoH = 18;
      const logoW = 30;
      doc.addImage(white, 'PNG', pageWidth / 2 - logoW / 2, 4, logoW, logoH);
    }
  } catch {
    /* logo optional */
  }

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  if (data.businessSettings.phone) {
    doc.text(`Phone: ${data.businessSettings.phone}`, pageWidth - margin, 10, { align: 'right' });
  }
  if (data.businessSettings.gst_number) {
    doc.text(`GSTIN: ${data.businessSettings.gst_number}`, pageWidth - margin, 15, { align: 'right' });
  }

  doc.setTextColor(0, 0, 0);

  // ================== TAX INVOICE BAND ==================
  let yPos = headerHeight;
  const bandHeight = 8;
  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(0, yPos, pageWidth, bandHeight, 'F');
  doc.setDrawColor(...PURPLE_BORDER);
  doc.setLineWidth(0.6);
  doc.line(0, yPos, pageWidth, yPos);
  doc.setLineWidth(0.1);

  doc.setTextColor(...PURPLE);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.text('TAX  INVOICE', pageWidth / 2, yPos + 5.5, { align: 'center' });
  yPos += bandHeight;

  // ================== META ROW ==================
  doc.setTextColor(0, 0, 0);
  const metaHeight = 12;
  const colWidth = contentWidth / 3;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(margin, yPos + metaHeight, pageWidth - margin, yPos + metaHeight);
  doc.line(margin + colWidth, yPos + 1, margin + colWidth, yPos + metaHeight - 1);
  doc.line(margin + colWidth * 2, yPos + 1, margin + colWidth * 2, yPos + metaHeight - 1);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('INVOICE NO', margin + 2, yPos + 4);
  doc.text('INVOICE DATE', margin + colWidth + 2, yPos + 4);
  doc.text('PAYMENT MODE', margin + colWidth * 2 + 2, yPos + 4);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(data.invoiceNumber, margin + 2, yPos + 9);
  const dateStr = new Date(data.invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  doc.text(dateStr, margin + colWidth + 2, yPos + 9);
  doc.text(formatPaymentMode(data.paymentMode), margin + colWidth * 2 + 2, yPos + 9);

  yPos += metaHeight + 4;

  // ================== BILL TO ROW ==================
  doc.setFont(FONT, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(data.clientName || 'Walk-in Customer', margin, yPos + 5);
  if (data.clientPhone) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(data.clientPhone, margin, yPos + 10);
  }

  const pillText = formatPaymentMode(data.paymentMode);
  doc.setFontSize(8);
  doc.setFont(FONT, 'bold');
  const pillTextWidth = doc.getTextWidth(pillText.toUpperCase());
  const pillW = pillTextWidth + 8;
  const pillH = 6;
  const pillX = pageWidth - margin - pillW;
  const pillY = yPos + 2;
  doc.setFillColor(...PURPLE);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(pillText.toUpperCase(), pillX + pillW / 2, pillY + 4.2, { align: 'center' });

  yPos += 14;
  doc.setTextColor(0, 0, 0);

  // ================== PRODUCT TABLE ==================
  const tableColumns = [
    { header: 'Sr', dataKey: 'sr' },
    { header: 'Product Name', dataKey: 'name' },
    { header: 'SKU', dataKey: 'sku' },
    { header: 'Wt(G)', dataKey: 'weight' },
    { header: 'Qty', dataKey: 'qty' },
    { header: `MC (${RUPEE})`, dataKey: 'mc' },
    { header: `Disc (${RUPEE})`, dataKey: 'disc' },
    { header: `MRP (${RUPEE})`, dataKey: 'mrp' },
    { header: `Total (${RUPEE})`, dataKey: 'total' },
  ];

  const tableRows = data.items.map((item, index) => {
    const isFlat = item.pricing_mode === 'flat_price';
    return {
      sr: (index + 1).toString(),
      name: item.product_name,
      sku: item.sku,
      weight: isFlat ? '-' : Number(item.weight_grams).toFixed(2),
      qty: item.quantity.toString(),
      mc: isFlat || !item.making_charges ? '-' : formatCurrency(item.making_charges),
      disc: item.discount > 0 ? formatCurrency(item.discount) : '-',
      mrp: item.mrp > 0 ? formatCurrency(item.mrp) : '-',
      total: formatCurrency(item.line_total),
    };
  });

  autoTable(doc, {
    columns: tableColumns,
    body: tableRows,
    startY: yPos,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      font: FONT,
      fontSize: 7.5,
      cellPadding: 2.2,
      lineWidth: 0.1,
      lineColor: [220, 215, 230],
      overflow: 'ellipsize',
      textColor: [30, 30, 30],
    },
    headStyles: {
      font: FONT,
      fillColor: PURPLE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.8,
      halign: 'center',
      cellPadding: 2.5,
      overflow: 'visible',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.04, halign: 'center' },
      1: { cellWidth: contentWidth * 0.28, halign: 'left', overflow: 'ellipsize' },
      2: { cellWidth: contentWidth * 0.14, halign: 'left', overflow: 'ellipsize' },
      3: { cellWidth: contentWidth * 0.08, halign: 'right' },
      4: { cellWidth: contentWidth * 0.05, halign: 'center' },
      5: { cellWidth: contentWidth * 0.10, halign: 'right' },
      6: { cellWidth: contentWidth * 0.08, halign: 'right' },
      7: { cellWidth: contentWidth * 0.11, halign: 'right' },
      8: { cellWidth: contentWidth * 0.12, halign: 'right' },
    },
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  yPos = finalY;

  // ================== TOTALS BLOCK ==================
  const totalsX = pageWidth - margin - 75;
  const valueX = pageWidth - margin - 1;

  const cgst = (data.totals.gstAmount || 0) / 2;
  const sgst = (data.totals.gstAmount || 0) / 2;
  const grandTotalWithRound = (data.totals.grandTotal || 0) + roundOff;
  const balanceDue = grandTotalWithRound - advancePaid;

  doc.setFontSize(9);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(60, 60, 60);

  const rowGap = 5.2;
  doc.text('Subtotal', totalsX, yPos);
  doc.text(money(data.totals.subtotal), valueX, yPos, { align: 'right' });
  yPos += rowGap;

  if (data.totals.discountAmount > 0) {
    doc.setTextColor(180, 0, 0);
    doc.text('Total Discount', totalsX, yPos);
    doc.text(`- ${money(data.totals.discountAmount)}`, valueX, yPos, { align: 'right' });
    doc.setTextColor(60, 60, 60);
    yPos += rowGap;
  }

  doc.text(`CGST @ ${(gstPct / 2).toFixed(2)}%`, totalsX, yPos);
  doc.text(money(cgst), valueX, yPos, { align: 'right' });
  yPos += rowGap;
  doc.text(`SGST @ ${(gstPct / 2).toFixed(2)}%`, totalsX, yPos);
  doc.text(money(sgst), valueX, yPos, { align: 'right' });
  yPos += rowGap;

  doc.text('Round Off', totalsX, yPos);
  const roundSign = roundOff >= 0 ? '+ ' : '- ';
  doc.text(`${roundSign}${money(Math.abs(roundOff))}`, valueX, yPos, { align: 'right' });
  yPos += rowGap + 1;

  // Grand Total band
  const bandH = 9;
  doc.setFillColor(...PURPLE);
  doc.rect(margin, yPos, contentWidth, bandH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('GRAND TOTAL', margin + 4, yPos + 6);
  doc.text(money(grandTotalWithRound), pageWidth - margin - 4, yPos + 6, { align: 'right' });
  yPos += bandH + 6;
  doc.setTextColor(0, 0, 0);

  // ================== BOTTOM SECTION ==================
  const bottomColGap = 6;
  const bottomColW = (contentWidth - bottomColGap) / 2;
  const bottomY = yPos;

  // Terms box
  const termsLines = [
    '1. Payment due within 5 days. Late payments attract 3% per month interest.',
    '2. No return or refund except manufacturing defects or transit damage.',
    '3. Exchange/repurchase: Material value only. No compensation for making',
    '   charges, designing charges, wastage, or taxes.',
  ];
  const termsBoxH = 32;
  doc.setDrawColor(...PURPLE_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, bottomY, bottomColW, termsBoxH);

  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(margin, bottomY, bottomColW, 6, 'F');
  doc.setTextColor(...PURPLE);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8.5);
  doc.text('TERMS & CONDITIONS', margin + 3, bottomY + 4.2);

  doc.setTextColor(50, 50, 50);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7.5);
  let tY = bottomY + 10;
  termsLines.forEach((l) => {
    doc.text(l, margin + 3, tY);
    tY += 4.2;
  });

  // Right side payment summary boxes with status logic
  const rightX = margin + bottomColW + bottomColGap;
  const boxH = 9.5;
  let bY = bottomY;

  const drawBox = (
    label: string,
    valueText: string,
    accent: 'none' | 'purple' | 'green',
  ) => {
    if (accent === 'purple') {
      doc.setFillColor(...PURPLE);
      doc.rect(rightX, bY, bottomColW, boxH, 'F');
      doc.setTextColor(255, 255, 255);
    } else if (accent === 'green') {
      doc.setFillColor(...GREEN_PAID);
      doc.rect(rightX, bY, bottomColW, boxH, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(...PURPLE_BORDER);
      doc.setLineWidth(0.3);
      doc.rect(rightX, bY, bottomColW, boxH);
      doc.setTextColor(70, 70, 70);
    }
    doc.setFont(FONT, accent === 'none' ? 'normal' : 'bold');
    doc.setFontSize(9);
    doc.text(label, rightX + 3, bY + 6);
    if (valueText) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(accent !== 'none' ? 11 : 10);
      doc.text(valueText, rightX + bottomColW - 3, bY + 6.5, { align: 'right' });
    }
    bY += boxH + 1.5;
  };

  drawBox('Grand Total', money(grandTotalWithRound), 'none');
  drawBox('Advance Paid', money(advancePaid), 'none');

  // Payment status logic
  const isPaidFull = advancePaid >= grandTotalWithRound && grandTotalWithRound > 0;
  const isOverpaid = advancePaid > grandTotalWithRound;
  const isPartial = advancePaid > 0 && advancePaid < grandTotalWithRound;

  if (isPaidFull && !isOverpaid) {
    // Replace Balance Due with PAID IN FULL stamp
    doc.setFillColor(...GREEN_PAID);
    doc.rect(rightX, bY, bottomColW, boxH + 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(11);
    doc.text('\u2713 PAID IN FULL', rightX + bottomColW / 2, bY + 6.5, { align: 'center' });
    bY += boxH + 1.5;
  } else {
    drawBox('Balance Due', money(Math.max(0, balanceDue)), 'purple');
    if (isPartial) {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 0, 0);
      doc.text('Partial Payment Received', rightX + 3, bY + 0.5);
      bY += 4;
    }
    if (isOverpaid) {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...ORANGE);
      doc.text(
        `Excess: ${money(advancePaid - grandTotalWithRound)} (to be adjusted)`,
        rightX + 3,
        bY + 0.5,
      );
      bY += 4;
    }
  }

  yPos = bottomY + termsBoxH + 8;
  doc.setTextColor(0, 0, 0);

  if (data.notes) {
    doc.setFont(FONT, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Note: ${data.notes}`, margin, yPos, { maxWidth: contentWidth });
    yPos += 6;
  }

  // ================== SIGNATURE ROW ==================
  const sigY = Math.max(yPos + 6, pageHeight - 28);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(margin, sigY, margin + 60, sigY);
  doc.line(pageWidth - margin - 60, sigY, pageWidth - margin, sigY);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('Customer Signature', margin, sigY + 4);
  doc.text('Authorized Signature', pageWidth - margin, sigY + 4, { align: 'right' });

  // ================== FOOTER ==================
  const footerH = 11;
  doc.setFillColor(...PURPLE);
  doc.rect(0, pageHeight - footerH, pageWidth, footerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(10);
  doc.text('Thank you for your business!', margin, pageHeight - 4);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.text(
    'Computer generated invoice \u00B7 Nispaditha Ventures LLP',
    pageWidth - margin,
    pageHeight - 4,
    { align: 'right' }
  );

  return doc;
}

export async function downloadInvoicePdf(data: InvoicePdfData, _showMakingCharges = true) {
  const doc = await generateInvoicePdf(data);
  doc.save(`${data.invoiceNumber}.pdf`);
}

export async function printInvoice(data: InvoicePdfData, _showMakingCharges = true) {
  const doc = await generateInvoicePdf(data);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.src = pdfUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
    }, 100);
  };

  window.addEventListener(
    'afterprint',
    () => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(pdfUrl);
    },
    { once: true }
  );

  const newWindow = window.open(pdfUrl, '_blank');
  if (!newWindow) {
    doc.save(`${data.invoiceNumber}-preview.pdf`);
  }
}
