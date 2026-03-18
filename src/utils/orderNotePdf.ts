import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { OrderNote, OrderNoteItem, ORDER_NOTE_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/types/orderNote';

const getServiceLabels = (serviceType?: string): string => {
  if (!serviceType) return 'New Order';
  return serviceType.split(',').map(s => SERVICE_TYPE_LABELS[s.trim()] || s.trim()).join(', ');
};

export const generateOrderNotePdf = async (
  orderNote: OrderNote,
  items: OrderNoteItem[],
  handlerName: string
): Promise<jsPDF> => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER NOTE', 105, 20, { align: 'center' });

  // Order Reference
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reference: ${orderNote.order_reference}`, 14, 35);
  doc.text(`Date: ${format(new Date(orderNote.order_date), 'dd/MM/yyyy')}`, 14, 42);
  doc.text(`Status: ${ORDER_NOTE_STATUS_LABELS[orderNote.status]}`, 14, 49);
  doc.text(`Handled By: ${handlerName}`, 120, 35);

  // Customer Details Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER DETAILS', 14, 62);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${orderNote.customer_name}`, 14, 70);
  doc.text(`Phone: ${orderNote.phone_number || '-'}`, 14, 77);
  doc.text(`Address: ${orderNote.address || '-'}`, 14, 84);

  // Order Items Table
  let yPos = 95;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER ITEMS', 14, yPos);

  autoTable(doc, {
    startY: yPos + 5,
    head: [['#', 'Item / Description', 'Services', 'Notes', 'Qty', 'Price', 'Total']],
    body: items.map((item, index) => [
      (index + 1).toString(),
      item.item_description,
      getServiceLabels(item.service_type),
      item.customization_notes || '-',
      item.quantity.toString(),
      `₹${item.expected_price.toLocaleString('en-IN')}`,
      `₹${(item.expected_price * item.quantity).toLocaleString('en-IN')}`,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 35 },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Total Expected
  const totalExpected = items.reduce((sum, item) => sum + (item.expected_price * item.quantity), 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Expected: ₹${totalExpected.toLocaleString('en-IN')}`, 180, yPos, { align: 'right' });

  yPos += 15;

  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Payment Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT DETAILS', 14, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Quoted Estimate: ₹${orderNote.quoted_estimate?.toLocaleString('en-IN') || '0'}`, 14, yPos);
  doc.text(`Advance Received: ₹${orderNote.advance_received?.toLocaleString('en-IN') || '0'}`, 80, yPos);
  doc.text(`Balance: ₹${orderNote.balance?.toLocaleString('en-IN') || '0'}`, 150, yPos);
  yPos += 7;
  doc.text(`Payment Mode: ${orderNote.payment_mode || '-'}`, 14, yPos);

  yPos += 15;

  // Delivery Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY DETAILS', 14, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Type: ${orderNote.delivery_type === 'home_delivery' ? 'Home Delivery' : 'Pickup'}`, 14, yPos);
  doc.text(
    `Expected Date: ${orderNote.expected_delivery_date ? format(new Date(orderNote.expected_delivery_date), 'dd/MM/yyyy') : '-'}`,
    80, yPos
  );
  doc.text(`Time Slot: ${orderNote.time_slot || '-'}`, 150, yPos);

  // Special Instructions
  if (orderNote.special_instructions) {
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SPECIAL INSTRUCTIONS', 14, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const splitText = doc.splitTextToSize(orderNote.special_instructions, 180);
    doc.text(splitText, 14, yPos);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text('This is an internal order note. It does not affect inventory or generate an invoice.', 105, pageHeight - 15, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, pageHeight - 10, { align: 'center' });

  return doc;
};

export const printOrderNote = async (orderNote: OrderNote, items: OrderNoteItem[], handlerName: string) => {
  const doc = await generateOrderNotePdf(orderNote, items, handlerName);

  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.src = pdfUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (error) {
      window.open(pdfUrl, '_blank');
    }

    const cleanup = () => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(pdfUrl);
    };

    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60000);
  };
};

export const downloadOrderNotePdf = async (orderNote: OrderNote, items: OrderNoteItem[], handlerName: string) => {
  const doc = await generateOrderNotePdf(orderNote, items, handlerName);
  doc.save(`OrderNote-${orderNote.order_reference}.pdf`);
};
