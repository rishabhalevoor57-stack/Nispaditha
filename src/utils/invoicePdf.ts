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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export function generateInvoicePdf(data: InvoicePdfData, showMakingCharges = false): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.businessSettings.business_name, pageWidth / 2, 20, { align: 'center' });
  
  // Business Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.businessSettings.address) {
    doc.text(data.businessSettings.address, pageWidth / 2, 28, { align: 'center' });
  }
  if (data.businessSettings.phone) {
    doc.text(`Phone: ${data.businessSettings.phone}`, pageWidth / 2, 34, { align: 'center' });
  }
  if (data.businessSettings.gst_number) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${data.businessSettings.gst_number}`, pageWidth / 2, 40, { align: 'center' });
  }
  
  // Divider
  doc.setLineWidth(0.5);
  doc.line(14, 45, pageWidth - 14, 45);
  
  // Invoice Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, 55, { align: 'center' });
  
  // Invoice Details - Left Side
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let yPos = 65;
  doc.text(`Invoice No: ${data.invoiceNumber}`, 14, yPos);
  doc.text(`Date: ${new Date(data.invoiceDate).toLocaleDateString('en-IN')}`, 14, yPos + 6);
  doc.text(`Payment Mode: ${data.paymentMode.toUpperCase()}`, 14, yPos + 12);
  
  // Customer Details - Right Side
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', pageWidth - 80, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName || 'Walk-in Customer', pageWidth - 80, yPos + 6);
  if (data.clientPhone) {
    doc.text(`Phone: ${data.clientPhone}`, pageWidth - 80, yPos + 12);
  }
  
  // Product Table
  const tableStartY = yPos + 25;
  
  // Table columns based on whether showing making charges (admin view)
  const columns = showMakingCharges
    ? ['SKU', 'Description', 'Weight (g)', 'Qty', 'Rate/g', 'Base Price', 'Making', 'Discount', 'Total']
    : ['SKU', 'Description', 'Weight (g)', 'Qty', 'Rate/g', 'Amount'];
  
  const rows = data.items.map(item => {
    if (showMakingCharges) {
      return [
        item.sku,
        item.product_name,
        item.weight_grams.toFixed(2),
        item.quantity.toString(),
        formatCurrency(item.rate_per_gram),
        formatCurrency(item.base_price),
        formatCurrency(item.making_charges),
        formatCurrency(item.discount),
        formatCurrency(item.line_total),
      ];
    }
    return [
      item.sku,
      item.product_name,
      item.weight_grams.toFixed(2),
      item.quantity.toString(),
      formatCurrency(item.rate_per_gram),
      formatCurrency(item.line_total),
    ];
  });
  
  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: tableStartY,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: showMakingCharges
      ? {
          0: { cellWidth: 20 },
          1: { cellWidth: 35 },
          2: { cellWidth: 18, halign: 'right' },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 20, halign: 'right' },
          7: { cellWidth: 18, halign: 'right' },
          8: { cellWidth: 22, halign: 'right' },
        }
      : {
          0: { cellWidth: 25 },
          1: { cellWidth: 60 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 30, halign: 'right' },
          5: { cellWidth: 30, halign: 'right' },
        },
  });
  
  // Get the final Y position after the table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  // Totals Section
  const totalsX = pageWidth - 80;
  let totalsY = finalY;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, totalsY);
  doc.text(formatCurrency(data.totals.subtotal), pageWidth - 14, totalsY, { align: 'right' });
  
  if (data.totals.discountAmount > 0) {
    totalsY += 7;
    doc.setTextColor(220, 38, 38); // red-600
    doc.text('Total Discount:', totalsX, totalsY);
    doc.text(`-${formatCurrency(data.totals.discountAmount)}`, pageWidth - 14, totalsY, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
  
  totalsY += 7;
  doc.text('GST (3%):', totalsX, totalsY);
  doc.text(formatCurrency(data.totals.gstAmount), pageWidth - 14, totalsY, { align: 'right' });
  
  totalsY += 2;
  doc.setLineWidth(0.3);
  doc.line(totalsX, totalsY, pageWidth - 14, totalsY);
  
  totalsY += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', totalsX, totalsY);
  doc.text(formatCurrency(data.totals.grandTotal), pageWidth - 14, totalsY, { align: 'right' });
  
  // Notes
  if (data.notes) {
    totalsY += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Note: ${data.notes}`, 14, totalsY);
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 40;
  
  // Signature line
  doc.setLineWidth(0.3);
  doc.line(pageWidth - 70, footerY, pageWidth - 14, footerY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signature', pageWidth - 42, footerY + 5, { align: 'center' });
  
  // Thank you note
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you for your business!', pageWidth / 2, footerY + 20, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated invoice.', pageWidth / 2, footerY + 26, { align: 'center' });
  
  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData, showMakingCharges = false) {
  const doc = generateInvoicePdf(data, showMakingCharges);
  doc.save(`${data.invoiceNumber}.pdf`);
}

export function printInvoice(data: InvoicePdfData, showMakingCharges = false) {
  const doc = generateInvoicePdf(data, showMakingCharges);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}
