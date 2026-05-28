import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ServiceForm } from '@/types/serviceForm';

export const generateServiceReceiptPdf = (sf: ServiceForm): jsPDF => {
  const doc = new jsPDF();

  // Purple header band
  doc.setFillColor(126, 58, 242);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Nispaditha Ventures LLP', 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('GSTIN: 29AAQFN9742E1ZO', 14, 20);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SERVICE RECEIPT', 105, 42, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt No: ${sf.receipt_number}`, 14, 54);
  doc.text(`Date: ${format(new Date(sf.created_at), 'dd/MM/yyyy')}`, 150, 54);

  // Client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CLIENT', 14, 66);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${sf.client_name}`, 14, 73);
  doc.text(`Phone: ${sf.client_phone || '-'}`, 14, 80);

  // Item
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ITEM DETAILS', 14, 92);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Description: ${sf.item_description}`, 14, 99);
  doc.text(`Material: ${sf.material || '-'}`, 14, 106);
  doc.text(`Weight: ${sf.weight_grams || 0} g`, 80, 106);
  doc.text(`From our shop: ${sf.from_our_shop ? 'Yes' : 'No'}`, 130, 106);
  if (sf.original_invoice_no) {
    doc.text(`Original Invoice: ${sf.original_invoice_no}`, 14, 113);
  }
  doc.text(`Condition on Receipt: ${sf.condition_on_receipt || '-'}`, 14, 120);

  // Services
  const services = [...(sf.service_types || [])];
  if (sf.other_service_text) services.push(`Other: ${sf.other_service_text}`);

  autoTable(doc, {
    startY: 128,
    head: [['Services Requested']],
    body: [[services.join(', ') || '-']],
    headStyles: { fillColor: [126, 58, 242], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 4 },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;

  if (sf.service_notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 14, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(sf.service_notes, 180);
    doc.text(lines, 14, y + 6);
    y += 6 + lines.length * 5;
  }

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`Estimated Delivery: ${sf.estimated_delivery_date ? format(new Date(sf.estimated_delivery_date), 'dd/MM/yyyy') : '-'}`, 14, y);
  doc.text(`Estimated Cost: ₹${Number(sf.estimated_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 130, y);

  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.text('Item received by: ____________________________', 14, y);
  doc.text('Signature: ____________________', 130, y);

  y += 20;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for choosing Nispaditha Jewellery.', 105, y, { align: 'center' });
  doc.text('This is a service receipt, not a tax invoice. GST invoice will be issued on completion.', 105, y + 5, { align: 'center' });

  return doc;
};

export const printServiceReceipt = (sf: ServiceForm) => {
  const doc = generateServiceReceiptPdf(sf);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
    }, 250);
  };
};

export const downloadServiceReceipt = (sf: ServiceForm) => {
  const doc = generateServiceReceiptPdf(sf);
  doc.save(`${sf.receipt_number}.pdf`);
};
