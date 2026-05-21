import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InvoiceItem, InvoiceTotals, BusinessSettings } from '@/types/invoice';
import { ensureNotoLoaded, registerNotoFont } from './pdfFont';

interface PaymentBreakdownEntry {
  mode: string;
  amount: number;
}

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
  storeCreditsUsed?: number;
  paymentBreakdown?: PaymentBreakdownEntry[];
  paymentReceivedDate?: string | null;
  cancelled?: boolean;
  cancellationReason?: string | null;
}

const PURPLE: [number, number, number] = [74, 32, 96];
const PURPLE_LIGHT: [number, number, number] = [245, 238, 255];
const ROW_ALT: [number, number, number] = [253, 249, 255];
const PURPLE_BORDER: [number, number, number] = [107, 58, 138];
const GREEN_PAID: [number, number, number] = [39, 174, 96];
const GREEN_BG: [number, number, number] = [234, 250, 241];
const ORANGE: [number, number, number] = [230, 126, 34];
const ORANGE_BG: [number, number, number] = [255, 243, 224];

const RUPEE = '\u20B9';

const fmt = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const money = (n: number) => `${RUPEE} ${fmt(n)}`;

const formatPaymentMode = (mode: string): string => {
  const modes: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    store_wallet: 'Store Wallet',
    pay_later: 'Pay Later',
  };
  return modes[mode] || mode.toUpperCase();
};

// Draws a diagonal CANCELLED watermark across the page
const drawCancelledWatermark = (doc: jsPDF, reason?: string | null) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  (doc as unknown as { setGState: (g: unknown) => void; GState: new (o: { opacity: number }) => unknown }).setGState(
    new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.18 })
  );
  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(96);
  doc.text('CANCELLED', w / 2, h / 2, { align: 'center', angle: 30 });
  doc.restoreGraphicsState();
  if (reason) {
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cancellation reason: ${reason}`, 10, h - 6);
  }
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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  const storeCreditsUsed = data.storeCreditsUsed ?? 0;

  // ================== HEADER (white with bold purple bottom border) ==================
  const headerHeight = 22;
  // bold purple bottom border
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(1.4);
  doc.line(0, headerHeight, pageWidth, headerHeight);

  doc.setTextColor(...PURPLE);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(11);
  doc.text(data.businessSettings.business_name || 'Nispaditha Ventures LLP', margin, 8);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const addr =
    data.businessSettings.address ||
    '60 Feet Rd, AECS Layout - C Block, Kundalahalli, Brookefield, Bengaluru, Karnataka 560037';
  const logoSlotW = 30;
  const addrMaxW = pageWidth / 2 - margin - logoSlotW / 2 - 3;
  const wrapped = doc.splitTextToSize(addr, addrMaxW);
  doc.text(wrapped, margin, 12);

  // CENTER logo (original colors, no white tint, no background)
  try {
    const raw = await loadLogoDataUrl();
    if (raw) {
      const logoH = 16;
      const logoW = 26;
      doc.addImage(raw, 'PNG', pageWidth / 2 - logoW / 2, 3, logoW, logoH);
    }
  } catch {
    /* logo optional */
  }

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PURPLE);
  doc.text(
    `Phone: ${data.businessSettings.phone || '99868 64152'}`,
    pageWidth - margin,
    9,
    { align: 'right' },
  );
  const gstText = `GSTIN: ${data.businessSettings.gst_number || '29AAAQFN9742E1ZO'}`;
  doc.setFontSize(7.5);
  const gstWidth = doc.getTextWidth(gstText) + 5;
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - margin - gstWidth, 12, gstWidth, 5, 1, 1);
  doc.text(gstText, pageWidth - margin - 2.5, 15.5, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);

  // ================== TAX INVOICE BAND ==================
  let yPos = headerHeight;
  const bandHeight = 7;
  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(0, yPos, pageWidth, bandHeight, 'F');
  doc.setDrawColor(...PURPLE_BORDER);
  doc.setLineWidth(0.6);
  doc.line(0, yPos, pageWidth, yPos);
  doc.setLineWidth(0.1);

  doc.setTextColor(...PURPLE);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(10);
  doc.text('TAX  INVOICE', pageWidth / 2, yPos + 4.8, { align: 'center' });
  yPos += bandHeight;

  // ================== META ROW ==================
  doc.setTextColor(0, 0, 0);
  const metaHeight = 11;
  const colWidth = contentWidth / 3;

  doc.setDrawColor(220, 215, 230);
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

  yPos += metaHeight + 3;

  // ================== BILL TO ROW (no payment mode pill) ==================
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
      mc: isFlat || !item.making_charges ? '-' : fmt(item.making_charges),
      disc: item.discount > 0 ? fmt(item.discount) : '-',
      mrp: item.mrp > 0 ? fmt(item.mrp) : '-',
      total: fmt(item.line_total),
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
      fontSize: 8,
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
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.5,
      overflow: 'visible',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.04, halign: 'center' },
      1: { cellWidth: contentWidth * 0.27, halign: 'left', overflow: 'ellipsize' },
      2: { cellWidth: contentWidth * 0.13, halign: 'left', overflow: 'ellipsize' },
      3: { cellWidth: contentWidth * 0.07, halign: 'right' },
      4: { cellWidth: contentWidth * 0.05, halign: 'center' },
      5: { cellWidth: contentWidth * 0.10, halign: 'right' },
      6: { cellWidth: contentWidth * 0.08, halign: 'right' },
      7: { cellWidth: contentWidth * 0.13, halign: 'right' },
      8: { cellWidth: contentWidth * 0.13, halign: 'right' },
    },
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  yPos = finalY;

  // ================== TOTALS BLOCK (right aligned) ==================
  const totalsX = pageWidth - margin - 75;
  const valueX = pageWidth - margin - 1;

  const cgst = (data.totals.gstAmount || 0) / 2;
  const sgst = (data.totals.gstAmount || 0) / 2;
  const grandTotalWithRound = (data.totals.grandTotal || 0) + roundOff;
  const balanceDue = grandTotalWithRound - advancePaid - storeCreditsUsed;

  doc.setFontSize(9);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(60, 60, 60);

  const rowGap = 5;
  doc.text('Subtotal', totalsX, yPos);
  doc.text(money(data.totals.subtotal), valueX, yPos, { align: 'right' });
  yPos += rowGap;

  if (data.totals.discountAmount > 0) {
    doc.setTextColor(180, 30, 30);
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
  yPos += rowGap;

  if (storeCreditsUsed > 0) {
    doc.setTextColor(39, 120, 60);
    doc.text('Store Credits Redeemed', totalsX, yPos);
    doc.text(`- ${money(storeCreditsUsed)}`, valueX, yPos, { align: 'right' });
    doc.setTextColor(60, 60, 60);
    yPos += rowGap;
  }
  yPos += 2;

  // ================== GRAND TOTAL BAND ==================
  const bandH = 10;
  doc.setFillColor(...PURPLE);
  doc.rect(margin, yPos, contentWidth, bandH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('GRAND TOTAL', margin + 4, yPos + 6.7);
  doc.setFontSize(14);
  doc.text(money(grandTotalWithRound), pageWidth - margin - 4, yPos + 6.8, { align: 'right' });
  yPos += bandH + 5;
  doc.setTextColor(0, 0, 0);

  // ================== STATUS DETERMINATION ==================
  const paidTotal = advancePaid + storeCreditsUsed;
  const isPaidFull = paidTotal >= grandTotalWithRound - 0.001 && grandTotalWithRound > 0;
  const isOverpaid = paidTotal > grandTotalWithRound + 0.001 && grandTotalWithRound > 0;
  const isPartial = paidTotal > 0 && !isPaidFull;

  // Reserve space for footer + signature + status section
  const footerH = 11;
  const sigReserve = 14;

  // ================== STATUS STAMP / PAYMENT SUMMARY ==================
  const rightX = margin + contentWidth / 2 + 3;
  const rightW = contentWidth / 2 - 3;
  const leftW = contentWidth / 2 - 3;

  // Compute terms box height first (needs to align with right side)
  const termsRaw = [
    '1. No return or refund will be accepted except in cases of manufacturing defects.',
    '2. Under the exchange & buyback policy, only the metal value will be considered. Making charges, designing charges, wastage, stones, taxes, and other additional charges are non-refundable.',
    '3. Warranty period is 6 months from the date of purchase. Repairs after the warranty period will be chargeable.',
    '4. Products that are altered, repaired, resized, damaged, broken, mishandled, or tampered with by third parties will not be eligible for exchange, buyback, repair, or warranty claims.',
    '5. One-time polishing service will be provided free of charge. Subsequent polishing services will be chargeable.',
    '6. Original invoice must be presented for all exchange, buyback, repair, polishing, or warranty claims.',
    '7. Tarnishing or oxidation of silver over time is normal and shall not be considered a manufacturing defect.',
    '8. The company reserves the right to modify exchange, buyback, repair, and warranty policies without prior notice.',
  ];

  const bottomY = yPos;
  let rightInnerY = bottomY;
  const boxH = 9;

  if (isPaidFull && !isOverpaid) {
    // Compact green PAID stamp (one line, sits beside Grand Total band)
    const stampH = 8;
    const stampW = 42;
    const stampX = rightX + rightW - stampW;
    doc.setFillColor(...GREEN_BG);
    doc.setDrawColor(...GREEN_PAID);
    doc.setLineWidth(0.4);
    doc.roundedRect(stampX, rightInnerY, stampW, stampH, 1.5, 1.5, 'FD');
    // checkmark
    doc.setTextColor(...GREEN_PAID);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9);
    doc.text('\u2713', stampX + 3, rightInnerY + stampH / 2 + 1.3);
    doc.setFontSize(8.5);
    doc.text('PAID IN FULL', stampX + 7, rightInnerY + stampH / 2 + 1.3);
    rightInnerY += stampH + 3;

    // Payment received date stamp
    if (data.paymentReceivedDate) {
      const recvStr = new Date(data.paymentReceivedDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
      doc.setTextColor(60, 60, 60);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(9);
      doc.text(`Payment Received On: ${recvStr}`, rightX, rightInnerY + 4);
      rightInnerY += 7;
    }
    doc.setLineWidth(0.1);
  } else {
    // Advance Paid box
    doc.setDrawColor(...PURPLE_BORDER);
    doc.setLineWidth(0.3);
    doc.rect(rightX, rightInnerY, rightW, boxH);
    doc.setTextColor(80, 80, 80);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.text('Advance Paid', rightX + 3, rightInnerY + 5.7);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...GREEN_PAID);
    doc.text(money(advancePaid), rightX + rightW - 3, rightInnerY + 5.7, { align: 'right' });
    rightInnerY += boxH + 1.5;

    // Balance Due box (purple)
    doc.setFillColor(...PURPLE);
    doc.rect(rightX, rightInnerY, rightW, boxH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9);
    doc.text('Balance Due', rightX + 3, rightInnerY + 5.7);
    doc.setFontSize(11);
    doc.text(money(Math.max(0, balanceDue)), rightX + rightW - 3, rightInnerY + 5.7, { align: 'right' });
    rightInnerY += boxH + 1.5;

    if (isPartial) {
      doc.setFillColor(...ORANGE_BG);
      doc.setDrawColor(...ORANGE);
      doc.setLineWidth(0.3);
      doc.roundedRect(rightX, rightInnerY, rightW, 6, 1, 1, 'FD');
      doc.setTextColor(...ORANGE);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      doc.text('PARTIAL PAYMENT', rightX + rightW / 2, rightInnerY + 4, { align: 'center' });
      rightInnerY += 7;
      doc.setLineWidth(0.1);
    }
    if (isOverpaid) {
      doc.setTextColor(...ORANGE);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(8);
      doc.text(
        `Excess: ${money(advancePaid - grandTotalWithRound)} (to be adjusted)`,
        rightX + 3,
        rightInnerY + 3,
      );
      rightInnerY += 5;
    }
  }

  // Pre-measure terms height for proper box sizing
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7.5);
  const lineH = 4.2; // 7.5pt * 1.6 line-height
  let measuredH = 8; // top padding (header band)
  const wrappedParas = termsRaw.map((p) => doc.splitTextToSize(p, leftW - 6) as string[]);
  wrappedParas.forEach((lines) => {
    measuredH += lines.length * lineH + 0.6;
  });
  measuredH += 3; // bottom padding

  // Terms box on left — auto height to fit all terms
  const termsBoxH = measuredH;
  doc.setDrawColor(...PURPLE_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, bottomY, leftW, termsBoxH);

  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(margin, bottomY, leftW, 6, 'F');
  doc.setTextColor(...PURPLE);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(8);
  doc.text('TERMS & CONDITIONS', margin + 3, bottomY + 4);

  doc.setTextColor(60, 60, 60);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7.5);
  let tY = bottomY + 10;
  wrappedParas.forEach((lines) => {
    lines.forEach((wl) => {
      doc.text(wl, margin + 3, tY);
      tY += lineH;
    });
    tY += 0.6;
  });

  yPos = bottomY + termsBoxH + 6;
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.1);

  if (data.notes) {
    doc.setFont(FONT, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Note: ${data.notes}`, margin, yPos, { maxWidth: contentWidth });
    yPos += 6;
  }

  // ================== SIGNATURE (sits right after content, no forced bottom) ==================
  const sigY = Math.min(yPos + 10, pageHeight - footerH - 6);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 60, sigY, pageWidth - margin, sigY);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('Authorized Signature', pageWidth - margin, sigY + 4, { align: 'right' });

  // ================== FOOTER (white with bold purple top border) ==================
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(1.4);
  doc.line(0, pageHeight - footerH, pageWidth, pageHeight - footerH);
  doc.setTextColor(...PURPLE);
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

  if (data.cancelled) {
    drawCancelledWatermark(doc, data.cancellationReason);
  }

  return doc;
}

export async function downloadInvoicePdf(data: InvoicePdfData, _showMakingCharges = true) {
  const doc = await generateInvoicePdf(data);
  doc.save(`${data.invoiceNumber}.pdf`);
}

export async function printInvoice(data: InvoicePdfData, _showMakingCharges = true) {
  const doc = await generateInvoicePdf(data);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
    }, 200);
  };
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(iframe);
  }, 60000);
}
