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
}

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

export function generateInvoicePdf(data: InvoicePdfData, showMakingCharges = false): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  
  let yPos = margin;

  // ================== LOGO SECTION ==================
  // Add the Nispaditha logo at the top center
  try {
    const logoWidth = 50;
    const logoHeight = 25;
    const logoX = (pageWidth - logoWidth) / 2;
    doc.addImage('/images/nispaditha-logo.png', 'PNG', logoX, yPos, logoWidth, logoHeight);
    yPos += logoHeight + 5;
  } catch (error) {
    console.warn('Could not load logo image:', error);
  }

  // ================== HEADER SECTION ==================
  // Shop Name - Centered & Bold
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.businessSettings.business_name, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;

  // Address - Centered
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (data.businessSettings.address) {
    doc.text(data.businessSettings.address, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }

  // Phone - Centered
  if (data.businessSettings.phone) {
    doc.text(`Phone: ${data.businessSettings.phone}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }

  // GSTIN - Centered
  if (data.businessSettings.gst_number) {
    doc.text(`GSTIN: ${data.businessSettings.gst_number}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }

  yPos += 3;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // TAX INVOICE - Centered & Bold
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // ================== INVOICE INFO ROW (3 columns) ==================
  const colWidth = contentWidth / 3;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Left column - Invoice No
  doc.text(`Invoice No: ${data.invoiceNumber}`, margin, yPos);
  
  // Center column - Date
  const dateStr = new Date(data.invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(`Date: ${dateStr}`, margin + colWidth, yPos);
  
  // Right column - Payment Mode
  doc.text(`Payment: ${formatPaymentMode(data.paymentMode)}`, margin + colWidth * 2, yPos);
  yPos += 8;

  // Divider line
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ================== BILL TO SECTION ==================
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', margin, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName || 'Walk-in Customer', margin, yPos);
  yPos += 5;

  if (data.clientPhone) {
    doc.text(`Phone: ${data.clientPhone}`, margin, yPos);
    yPos += 5;
  }
  yPos += 5;

  // ================== PRODUCT TABLE ==================
  // Column widths as percentages of content width
  const tableColumns = showMakingCharges
    ? [
        { header: 'Sr', dataKey: 'sr' },
        { header: 'Description', dataKey: 'description' },
        { header: 'SKU', dataKey: 'sku' },
        { header: 'Weight(g)', dataKey: 'weight' },
        { header: 'Qty', dataKey: 'qty' },
        { header: 'Rate/g', dataKey: 'rate' },
        { header: 'MC', dataKey: 'mc' },
        { header: 'MC/g', dataKey: 'mcpg' },
        { header: 'Disc', dataKey: 'discount' },
        { header: 'Total', dataKey: 'total' },
      ]
    : [
        { header: 'Sr', dataKey: 'sr' },
        { header: 'Description', dataKey: 'description' },
        { header: 'SKU', dataKey: 'sku' },
        { header: 'Weight(g)', dataKey: 'weight' },
        { header: 'Qty', dataKey: 'qty' },
        { header: 'Rate/g', dataKey: 'rate' },
        { header: 'Total', dataKey: 'total' },
      ];

  const tableRows = data.items.map((item, index) => {
    const mcPerGram = item.weight_grams > 0 ? item.making_charges / item.weight_grams : 0;
    const baseRow = {
      sr: (index + 1).toString(),
      description: item.product_name,
      sku: item.sku,
      weight: item.weight_grams.toFixed(2),
      qty: item.quantity.toString(),
      rate: formatCurrency(item.rate_per_gram),
      total: formatCurrency(item.line_total),
    };

    if (showMakingCharges) {
      return {
        ...baseRow,
        mc: formatCurrency(item.making_charges),
        mcpg: formatCurrency(mcPerGram),
        discount: item.discount > 0 ? formatCurrency(item.discount) : '-',
      };
    }
    return baseRow;
  });

  // Column styles with fixed widths
  const adminColumnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: contentWidth * 0.04, halign: 'center' },  // Sr No
    1: { cellWidth: contentWidth * 0.19, halign: 'left' },     // Description
    2: { cellWidth: contentWidth * 0.09, halign: 'left' },     // SKU
    3: { cellWidth: contentWidth * 0.09, halign: 'right' },    // Weight
    4: { cellWidth: contentWidth * 0.05, halign: 'center' },   // Qty
    5: { cellWidth: contentWidth * 0.11, halign: 'right' },    // Rate
    6: { cellWidth: contentWidth * 0.10, halign: 'right' },    // MC
    7: { cellWidth: contentWidth * 0.09, halign: 'right' },    // MC/g
    8: { cellWidth: contentWidth * 0.07, halign: 'right' },    // Discount
    9: { cellWidth: contentWidth * 0.17, halign: 'right' },    // Total
  };

  const customerColumnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: contentWidth * 0.06, halign: 'center' },   // Sr No
    1: { cellWidth: contentWidth * 0.32, halign: 'left' },     // Description
    2: { cellWidth: contentWidth * 0.12, halign: 'left' },     // SKU
    3: { cellWidth: contentWidth * 0.12, halign: 'right' },    // Weight
    4: { cellWidth: contentWidth * 0.08, halign: 'center' },   // Qty
    5: { cellWidth: contentWidth * 0.14, halign: 'right' },    // Rate
    6: { cellWidth: contentWidth * 0.16, halign: 'right' },    // Total
  };

  autoTable(doc, {
    columns: tableColumns,
    body: tableRows,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
      overflow: 'ellipsize',
    },
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 4,
    },
    bodyStyles: {
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: showMakingCharges ? adminColumnStyles : customerColumnStyles,
    tableWidth: contentWidth,
  });

  // Get final Y position after table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  yPos = finalY;

  // ================== TOTALS SECTION (Right Aligned) ==================
  const totalsWidth = 80;
  const totalsX = pageWidth - margin - totalsWidth;
  const valueX = pageWidth - margin;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Subtotal
  doc.text('Subtotal:', totalsX, yPos);
  doc.text(formatCurrency(data.totals.subtotal), valueX, yPos, { align: 'right' });
  yPos += 6;

  // Discount (if any)
  if (data.totals.discountAmount > 0) {
    doc.setTextColor(180, 0, 0);
    doc.text('Total Discount:', totalsX, yPos);
    doc.text(`-${formatCurrency(data.totals.discountAmount)}`, valueX, yPos, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPos += 6;
  }

  // GST
  doc.text('GST (3%):', totalsX, yPos);
  doc.text(formatCurrency(data.totals.gstAmount), valueX, yPos, { align: 'right' });
  yPos += 3;

  // Divider line
  doc.setLineWidth(0.3);
  doc.line(totalsX, yPos, valueX, yPos);
  yPos += 6;

  // Grand Total - Bold & Larger
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', totalsX, yPos);
  doc.text(formatCurrency(data.totals.grandTotal), valueX, yPos, { align: 'right' });

  // ================== NOTES (if any) ==================
  if (data.notes) {
    yPos += 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Note: ${data.notes}`, margin, yPos, { maxWidth: contentWidth });
  }

  // ================== FOOTER SECTION ==================
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 35;

  // Left side - Authorized Signature
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, margin + 60, footerY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signature', margin, footerY + 5);

  // Right side - Thank you message
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you for your business!', pageWidth - margin, footerY, { align: 'right' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated invoice.', pageWidth - margin, footerY + 6, { align: 'right' });

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData, showMakingCharges = false) {
  const doc = generateInvoicePdf(data, showMakingCharges);
  doc.save(`${data.invoiceNumber}.pdf`);
}

export function printInvoice(data: InvoicePdfData, showMakingCharges = false) {
  const doc = generateInvoicePdf(data, showMakingCharges);

  // Create blob and open in new window for print preview
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  // Create an iframe to handle the print preview
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

  // Clean up after printing
  window.addEventListener(
    'afterprint',
    () => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(pdfUrl);
    },
    { once: true }
  );

  // Fallback: Also open in new tab for browsers that block iframe printing
  const newWindow = window.open(pdfUrl, '_blank');
  if (!newWindow) {
    // If popup is blocked, just download the PDF
    doc.save(`${data.invoiceNumber}-preview.pdf`);
  }
}
