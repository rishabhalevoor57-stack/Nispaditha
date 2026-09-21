import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { CustomOrder, CustomOrderItem, CustomOrderComponent } from '@/types/customOrder';
import type { CustomOrderPayment } from '@/hooks/useCustomOrderPayments';

interface DeliveryBillContext {
  order: CustomOrder;
  items: CustomOrderItem[];
  components: CustomOrderComponent[];
  advancePayments?: CustomOrderPayment[];
  advancePaid?: number;
  paymentMode?: string;
}


const money = (n: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

export const generateCustomOrderDeliveryPdf = (ctx: DeliveryBillContext): jsPDF => {
  const { order, items, components, advancePayments = [] } = ctx;
  const totalAdvance = advancePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const advancePaid = totalAdvance > 0 ? totalAdvance : (ctx.advancePaid || 0);
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
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOM ORDER — DELIVERY BILL', 105, 40, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('(This is not a GST Tax Invoice)', 105, 46, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reference: ${order.reference_number}`, 14, 56);
  doc.text(`Order Date: ${format(new Date(order.order_date), 'dd/MM/yyyy')}`, 80, 56);
  doc.text(
    `Delivery: ${order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy') : '-'}`,
    150, 56,
  );

  // Customer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CUSTOMER', 14, 68);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${order.client_name || '-'}`, 14, 75);
  doc.text(`Phone: ${order.phone_number || '-'}`, 105, 75);

  let y = 84;

  // One unified details table with compact category rows.
  const itemRows = items
    .filter((it) => (it.item_description || '').trim())
    .map((it, index) => [
      String(index + 1),
      it.item_description,
      it.sku || '-',
      Number(it.expected_weight) > 0 ? String(it.expected_weight) : '-',
      String(it.quantity || 1),
      Number(it.mc_per_gram) > 0 ? money(it.mc_per_gram) : '-',
      money((Number(it.flat_price) || 0) * (Number(it.quantity) || 1)),
      Number(it.discount) > 0 ? money(it.discount) : '-',
      money(it.item_total),
    ]);
  const cm = (order.customer_materials || []).filter((m) => (m?.name || '').trim());
  const compRows = components
    .filter((c) => (c.component_name || '').trim())
    .map((c) => [
      '',
      c.component_name + (c.material ? ` (${c.material})` : ''),
      c.sku || '-',
      c.weight_grams ? String(c.weight_grams) : '-',
      String(c.unit === 'strings' ? (c.strings_used || c.quantity || 1) : (c.quantity_used || c.quantity || 1)),
      '-',
      money((Number(c.total) || 0) + (Number(c.discount) || 0)),
      Number(c.discount) > 0 ? money(Number(c.discount)) : '-',
      money(c.total || 0),
    ]);
  const sectionRow = (title: string) => [{
    content: title,
    colSpan: 9,
    styles: {
      fillColor: [245, 238, 255] as [number, number, number],
      textColor: [74, 32, 96] as [number, number, number],
      fontStyle: 'bold' as const,
      halign: 'left' as const,
    },
  }];
  const detailRows: any[] = [];
  if (itemRows.length) detailRows.push(sectionRow('CUSTOM ORDER ITEMS'), ...itemRows);
  if (cm.length) detailRows.push(
    sectionRow('CUSTOMER SUPPLIED ITEMS'),
    ...cm.map((m) => ['', m.name + (m.description ? ` — ${m.description}` : ''), '-', m.weight_grams ? String(m.weight_grams) : '-', String(m.quantity ?? '-'), '-', '-', '-', '-']),
  );
  if (compRows.length) detailRows.push(sectionRow('COMPONENTS USED'), ...compRows);

  if (detailRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Sr', 'Product Name', 'SKU', 'Wt(G)', 'Qty', 'MC (Rs.)', 'MRP (Rs.)', 'Discount (Rs.)', 'Total (Rs.)']],
      body: detailRows,
      headStyles: { fillColor: [126, 58, 242], textColor: 255 },
      styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 42 }, 2: { cellWidth: 22 },
        3: { cellWidth: 15, halign: 'center' }, 4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' }, 8: { cellWidth: 25, halign: 'right' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Charges
  const charges: Array<[string, number]> = [];
  charges.push(['Making Charges', Number(order.making_charges) || 0]);
  charges.push(['Design Charges', Number(order.design_charges) || 0]);
  charges.push(['Labour Charges', Number(order.labour_charges) || 0]);
  charges.push(['Polishing Charges', Number(order.polishing_charges) || 0]);
  charges.push(['Repair Charges', Number(order.repair_charges) || 0]);
  charges.push([order.additional_charge_label || 'Additional Charge', Number(order.additional_charge) || 0]);
  (order.extra_charges || []).forEach((c) => {
    charges.push([c.label, Number(c.amount) || 0]);
  });
  const activeCharges = charges.filter((c) => c[1] > 0);

  const flatDiscount = Number(order.flat_discount) || 0;
  const grandTotal = Number(order.total_amount) || 0;
  const balance = Math.max(0, grandTotal - (Number(advancePaid) || 0));

  const summaryRows: Array<[string, string]> = [];
  activeCharges.forEach(([label, amt]) => summaryRows.push([label, money(amt)]));

  if (flatDiscount > 0) summaryRows.push(['Flat Discount', '- ' + money(flatDiscount)]);
  if (Number(order.gst_percentage) > 0) {
    summaryRows.push([
      `GST ${order.gst_mode === 'inclusive' ? '(inclusive)' : '(exclusive)'} ${order.gst_percentage}%`,
      order.gst_mode === 'inclusive' ? 'incl.' : 'added',
    ]);
  }
  summaryRows.push(['Grand Total', money(grandTotal)]);
  if (advancePayments.length > 0) {
    advancePayments.forEach((p) => {
      const modeLabel = p.payment_mode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      summaryRows.push([`Advance Paid via ${modeLabel} (${p.reference_number})`, money(Number(p.amount) || 0)]);
    });
    summaryRows.push(['Total Advance Paid', money(advancePaid)]);
  } else {
    summaryRows.push(['Advance Paid', money(advancePaid)]);
  }
  summaryRows.push(['Balance Remaining', money(balance)]);


  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 110 },
      1: { halign: 'right' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (y > 250) { doc.addPage(); y = 20; }

  // Terms
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Terms & Conditions', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const terms = [
    '1. This is a delivery / acknowledgement bill. The final GST Tax Invoice will be issued separately.',
    '2. Any modifications requested after delivery may attract additional charges.',
    '3. Balance amount, if any, is payable on delivery.',
    '4. Once delivered, custom-made pieces are non-returnable.',
  ];
  terms.forEach((t) => { doc.text(t, 14, y); y += 5; });

  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.text('Received by: ____________________________', 14, y);
  doc.text('Authorized Signature: ____________________', 130, y);

  y += 15;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for choosing Nispaditha Jewellery.', 105, y, { align: 'center' });

  return doc;
};

export const printCustomOrderDeliveryBill = (ctx: DeliveryBillContext) => {
  const doc = generateCustomOrderDeliveryPdf(ctx);
  doc.autoPrint();
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
};

export const downloadCustomOrderDeliveryBill = (ctx: DeliveryBillContext) => {
  const doc = generateCustomOrderDeliveryPdf(ctx);
  doc.save(`${ctx.order.reference_number}-delivery.pdf`);
};
