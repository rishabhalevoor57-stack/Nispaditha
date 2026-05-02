import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InvoiceItem, InvoiceTotals, BusinessSettings } from '@/types/invoice';

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
  /** Editable GST % (default 3). Split equally into CGST/SGST. */
  gstPercentage?: number;
  /** Editable round off (can be negative). */
  roundOff?: number;
  /** Advance already paid by client. */
  advancePaid?: number;
}

const PURPLE: [number, number, number] = [74, 32, 96];          // #4a2060
const PURPLE_LIGHT: [number, number, number] = [245, 238, 255]; // #f5eeff
const ROW_ALT: [number, number, number] = [253, 249, 255];      // #fdf9ff
const PURPLE_BORDER: [number, number, number] = [107, 58, 138]; // #6b3a8a

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

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

export function generateInvoicePdf(data: InvoicePdfData, _showMakingCharges = true): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const gstPct = data.gstPercentage ?? 3;
  const roundOff = data.roundOff ?? 0;
  const advancePaid = data.advancePaid ?? 0;

  // ================== PURPLE HEADER BAR (compact, ~24mm tall) ==================
  const headerHeight = 24;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // LEFT: business name + address
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(data.businessSettings.business_name || 'Nispaditha Ventures LLP', margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const addr = data.businessSettings.address || '';
  if (addr) {
    const wrapped = doc.splitTextToSize(addr, pageWidth * 0.38);
    doc.text(wrapped, margin, 13);
  }

  // CENTER: logo
  try {
    const logoSize = 18;
    doc.addImage(
      '/nispaditha-logo.png',
      'PNG',
      pageWidth / 2 - logoSize / 2,
      3,
      logoSize,
      logoSize
    );
  } catch {
    // Logo optional
  }

  // RIGHT: phone + GSTIN
  doc.setFont('helvetica', 'normal');
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('T A X   I N V O I C E', pageWidth / 2, yPos + 5.5, { align: 'center' });
  yPos += bandHeight;

  // ================== META ROW (3 cols with vertical borders) ==================
  doc.setTextColor(0, 0, 0);
  const metaHeight = 12;
  const colWidth = contentWidth / 3;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  // bottom border of meta row
  doc.line(margin, yPos + metaHeight, pageWidth - margin, yPos + metaHeight);
  // verticals
  doc.line(margin + colWidth, yPos + 1, margin + colWidth, yPos + metaHeight - 1);
  doc.line(margin + colWidth * 2, yPos + 1, margin + colWidth * 2, yPos + metaHeight - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('INVOICE NO', margin + 2, yPos + 4);
  doc.text('INVOICE DATE', margin + colWidth + 2, yPos + 4);
  doc.text('PAYMENT MODE', margin + colWidth * 2 + 2, yPos + 4);

  doc.setFont('helvetica', 'bold');
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
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(data.clientName || 'Walk-in Customer', margin, yPos + 5);
  if (data.clientPhone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(data.clientPhone, margin, yPos + 10);
  }

  // Payment mode pill (right)
  const pillText = formatPaymentMode(data.paymentMode);
  doc.setFontSize(8);
  const pillTextWidth = doc.getTextWidth(pillText);
  const pillW = pillTextWidth + 8;
  const pillH = 6;
  const pillX = pageWidth - margin - pillW;
  const pillY = yPos + 2;
  doc.setFillColor(...PURPLE);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(pillText.toUpperCase(), pillX + pillW / 2, pillY + 4.2, { align: 'center' });

  yPos += 14;
  doc.setTextColor(0, 0, 0);

  // ================== PRODUCT TABLE ==================
  // Printed columns: Sr | Product Name | SKU | Wt(G) | Qty | MC | Disc | MRP | Total
  const tableColumns = [
    { header: 'Sr', dataKey: 'sr' },
    { header: 'Product Name', dataKey: 'name' },
    { header: 'SKU', dataKey: 'sku' },
    { header: 'Wt(G)', dataKey: 'weight' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'MC (\u20B9)', dataKey: 'mc' },
    { header: 'Disc (\u20B9)', dataKey: 'disc' },
    { header: 'MRP (\u20B9)', dataKey: 'mrp' },
    { header: 'Total (\u20B9)', dataKey: 'total' },
  ];

  const tableRows = data.items.map((item, index) => {
    const isFlat = item.pricing_mode === 'flat_price';
    return {
      sr: (index + 1).toString(),
      name: item.product_name,
      sku: item.sku,
      weight: isFlat ? '-' : Number(item.weight_grams).toFixed(2),
      qty: item.quantity.toString(),
      mc: isFlat ? '-' : formatCurrency(item.making_charges || 0),
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
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      lineWidth: 0.1,
      lineColor: [220, 215, 230],
      overflow: 'ellipsize',
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: PURPLE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.05, halign: 'center' },  // Sr
      1: { cellWidth: contentWidth * 0.27, halign: 'left' },    // Name
      2: { cellWidth: contentWidth * 0.12, halign: 'left' },    // SKU
      3: { cellWidth: contentWidth * 0.08, halign: 'right' },   // Wt(G)
      4: { cellWidth: contentWidth * 0.06, halign: 'center' },  // Qty
      5: { cellWidth: contentWidth * 0.10, halign: 'right' },   // MC
      6: { cellWidth: contentWidth * 0.09, halign: 'right' },   // Disc
      7: { cellWidth: contentWidth * 0.10, halign: 'right' },   // MRP
      8: { cellWidth: contentWidth * 0.13, halign: 'right' },   // Total
    },
    tableWidth: contentWidth,
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  yPos = finalY;

  // ================== TOTALS BLOCK (right aligned) ==================
  const totalsWidth = 75;
  const totalsX = pageWidth - margin - totalsWidth;
  const valueX = pageWidth - margin - 1;

  const cgst = (data.totals.gstAmount || 0) / 2;
  const sgst = (data.totals.gstAmount || 0) / 2;
  const grandTotalWithRound = (data.totals.grandTotal || 0) + roundOff;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const rowGap = 5.2;
  doc.text('Subtotal', totalsX, yPos);
  doc.text(`\u20B9 ${formatCurrency(data.totals.subtotal)}`, valueX, yPos, { align: 'right' });
  yPos += rowGap;

  if (data.totals.discountAmount > 0) {
    doc.setTextColor(180, 0, 0);
    doc.text('Total Discount', totalsX, yPos);
    doc.text(`- \u20B9 ${formatCurrency(data.totals.discountAmount)}`, valueX, yPos, { align: 'right' });
    doc.setTextColor(60, 60, 60);
    yPos += rowGap;
  }

  doc.text(`CGST @ ${(gstPct / 2).toFixed(2)}%`, totalsX, yPos);
  doc.text(`\u20B9 ${formatCurrency(cgst)}`, valueX, yPos, { align: 'right' });
  yPos += rowGap;
  doc.text(`SGST @ ${(gstPct / 2).toFixed(2)}%`, totalsX, yPos);
  doc.text(`\u20B9 ${formatCurrency(sgst)}`, valueX, yPos, { align: 'right' });
  yPos += rowGap;

  doc.text('Round Off', totalsX, yPos);
  const roundSign = roundOff >= 0 ? '+ ' : '- ';
  doc.text(`${roundSign}\u20B9 ${formatCurrency(Math.abs(roundOff))}`, valueX, yPos, { align: 'right' });
  yPos += rowGap + 1;

  // Grand Total - full-width purple band
  const bandH = 9;
  doc.setFillColor(...PURPLE);
  doc.rect(margin, yPos, contentWidth, bandH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GRAND TOTAL', margin + 4, yPos + 6);
  doc.text(`\u20B9 ${formatCurrency(grandTotalWithRound)}`, pageWidth - margin - 4, yPos + 6, { align: 'right' });
  yPos += bandH + 6;
  doc.setTextColor(0, 0, 0);

  // ================== BOTTOM SECTION (T&C left, Payment Summary right) ==================
  const bottomColGap = 6;
  const bottomColW = (contentWidth - bottomColGap) / 2;
  const bottomY = yPos;

  // LEFT: Terms & Conditions box
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TERMS & CONDITIONS', margin + 3, bottomY + 4.2);

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let tY = bottomY + 10;
  termsLines.forEach((l) => {
    doc.text(l, margin + 3, tY);
    tY += 4.2;
  });

  // RIGHT: 3 stacked boxes (Grand Total / Advance Paid / Balance Due)
  const rightX = margin + bottomColW + bottomColGap;
  const boxH = 9.5;
  const boxes = [
    { label: 'Grand Total', value: grandTotalWithRound, accent: false },
    { label: 'Advance Paid', value: advancePaid, accent: false },
    { label: 'Balance Due', value: grandTotalWithRound - advancePaid, accent: true },
  ];

  let bY = bottomY;
  boxes.forEach((b) => {
    if (b.accent) {
      doc.setFillColor(...PURPLE);
      doc.rect(rightX, bY, bottomColW, boxH, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(...PURPLE_BORDER);
      doc.setLineWidth(0.3);
      doc.rect(rightX, bY, bottomColW, boxH);
      doc.setTextColor(70, 70, 70);
    }
    doc.setFont('helvetica', b.accent ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.text(b.label, rightX + 3, bY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(b.accent ? 11 : 10);
    doc.text(`\u20B9 ${formatCurrency(b.value)}`, rightX + bottomColW - 3, bY + 6.5, { align: 'right' });
    bY += boxH + 1.5;
  });

  yPos = bottomY + termsBoxH + 8;
  doc.setTextColor(0, 0, 0);

  // Notes (if any) — small, above signature row
  if (data.notes) {
    doc.setFont('helvetica', 'italic');
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

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('Customer Signature', margin, sigY + 4);
  doc.text('Authorized Signature', pageWidth - margin, sigY + 4, { align: 'right' });

  // ================== PURPLE FOOTER BAR ==================
  const footerH = 11;
  doc.setFillColor(...PURPLE);
  doc.rect(0, pageHeight - footerH, pageWidth, footerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.text('Thank you for your business!', margin, pageHeight - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'Computer generated invoice \u00B7 Nispaditha Ventures LLP',
    pageWidth - margin,
    pageHeight - 4,
    { align: 'right' }
  );

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData, showMakingCharges = true) {
  const doc = generateInvoicePdf(data, showMakingCharges);
  doc.save(`${data.invoiceNumber}.pdf`);
}

export function printInvoice(data: InvoicePdfData, showMakingCharges = true) {
  const doc = generateInvoicePdf(data, showMakingCharges);

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
