import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReturnPdfItem {
  direction: 'returned' | 'new';
  product_name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  weight_grams: number;
  total: number;
}

interface ReturnPdfData {
  referenceNumber: string;
  type: 'return' | 'exchange';
  date: string;
  originalInvoiceNumber: string;
  clientName: string;
  clientPhone: string;
  items: ReturnPdfItem[];
  refundAmount: number;
  additionalCharge: number;
  paymentMode: string;
  notes: string;
  businessSettings: {
    business_name: string;
    address: string | null;
    phone: string | null;
    gst_number: string | null;
  };
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatPaymentMode = (mode: string): string => {
  const modes: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    wallet: 'Store Wallet',
  };
  return modes[mode] || mode.toUpperCase();
};

export function generateReturnPdf(data: ReturnPdfData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let yPos = margin;

  // Logo
  try {
    const logoWidth = 50;
    const logoHeight = 25;
    const logoX = (pageWidth - logoWidth) / 2;
    doc.addImage('/images/nispaditha-logo.png', 'PNG', logoX, yPos, logoWidth, logoHeight);
    yPos += logoHeight + 5;
  } catch {
    // logo not available
  }

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.businessSettings.business_name, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (data.businessSettings.address) {
    doc.text(data.businessSettings.address, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  if (data.businessSettings.phone) {
    doc.text(`Phone: ${data.businessSettings.phone}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  if (data.businessSettings.gst_number) {
    doc.text(`GSTIN: ${data.businessSettings.gst_number}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  yPos += 3;

  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // Title
  const title = data.type === 'return' ? 'RETURN RECEIPT' : 'EXCHANGE INVOICE';
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Info row
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const colWidth = contentWidth / 3;
  doc.text(`Ref: ${data.referenceNumber}`, margin, yPos);
  const dateStr = new Date(data.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(`Date: ${dateStr}`, margin + colWidth, yPos);
  doc.text(`Orig. Invoice: ${data.originalInvoiceNumber}`, margin + colWidth * 2, yPos);
  yPos += 8;

  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // Bill To
  doc.setFont('helvetica', 'bold');
  doc.text('Customer:', margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName || 'Walk-in Customer', margin, yPos);
  yPos += 5;
  if (data.clientPhone) {
    doc.text(`Phone: ${data.clientPhone}`, margin, yPos);
    yPos += 5;
  }
  yPos += 5;

  // Items table
  const returnedItems = data.items.filter((i) => i.direction === 'returned');
  const newItems = data.items.filter((i) => i.direction === 'new');

  if (returnedItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Returned Items', margin, yPos);
    yPos += 4;

    autoTable(doc, {
      columns: [
        { header: 'Sr', dataKey: 'sr' },
        { header: 'Description', dataKey: 'description' },
        { header: 'SKU', dataKey: 'sku' },
        { header: 'Qty', dataKey: 'qty' },
        { header: 'Value', dataKey: 'value' },
      ],
      body: returnedItems.map((item, i) => ({
        sr: (i + 1).toString(),
        description: item.product_name,
        sku: item.sku || '-',
        qty: item.quantity.toString(),
        value: formatCurrency(item.total),
      })),
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [180, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
      tableWidth: contentWidth,
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (newItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('New Items', margin, yPos);
    yPos += 4;

    autoTable(doc, {
      columns: [
        { header: 'Sr', dataKey: 'sr' },
        { header: 'Description', dataKey: 'description' },
        { header: 'SKU', dataKey: 'sku' },
        { header: 'Qty', dataKey: 'qty' },
        { header: 'Value', dataKey: 'value' },
      ],
      body: newItems.map((item, i) => ({
        sr: (i + 1).toString(),
        description: item.product_name,
        sku: item.sku || '-',
        qty: item.quantity.toString(),
        value: formatCurrency(item.total),
      })),
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [51, 120, 51], textColor: [255, 255, 255], fontStyle: 'bold' },
      tableWidth: contentWidth,
    });

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Totals
  const totalsX = pageWidth - margin - 80;
  const valueX = pageWidth - margin;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  if (data.type === 'exchange') {
    const oldTotal = returnedItems.reduce((s, i) => s + i.total, 0);
    const newTotal = newItems.reduce((s, i) => s + i.total, 0);

    doc.text('Old Item Value:', totalsX, yPos);
    doc.text(formatCurrency(oldTotal), valueX, yPos, { align: 'right' });
    yPos += 6;
    doc.text('New Item Value:', totalsX, yPos);
    doc.text(formatCurrency(newTotal), valueX, yPos, { align: 'right' });
    yPos += 3;
    doc.setLineWidth(0.3);
    doc.line(totalsX, yPos, valueX, yPos);
    yPos += 6;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  if (data.refundAmount > 0) {
    doc.text('Refund Amount:', totalsX, yPos);
    doc.text(formatCurrency(data.refundAmount), valueX, yPos, { align: 'right' });
  } else if (data.additionalCharge > 0) {
    doc.text('Amount Payable:', totalsX, yPos);
    doc.text(formatCurrency(data.additionalCharge), valueX, yPos, { align: 'right' });
  } else {
    doc.text('No Balance:', totalsX, yPos);
    doc.text('₹0.00', valueX, yPos, { align: 'right' });
  }
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payment Mode: ${formatPaymentMode(data.paymentMode)}`, margin, yPos);

  if (data.notes) {
    yPos += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Note: ${data.notes}`, margin, yPos, { maxWidth: contentWidth });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 35;
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, margin + 60, footerY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signature', margin, footerY + 5);
  doc.setFontSize(7);
  doc.text('This is a computer generated document.', pageWidth - margin, footerY + 6, {
    align: 'right',
  });

  doc.save(`${data.referenceNumber}.pdf`);
}
