import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

interface ClientLite {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  total_purchases?: number;
  outstanding_balance?: number;
}

const PURPLE: [number, number, number] = [74, 32, 96];
const PURPLE_LIGHT: [number, number, number] = [245, 238, 255];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const money = (n: number) => `Rs ${fmt(n)}`;

export async function downloadClientReportPdf(client: ClientLite) {
  const [invRes, retRes, walletBalRes, walletTxRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('invoice_number, invoice_date, grand_total, status, payment_status')
      .eq('client_id', client.id)
      .order('invoice_date', { ascending: false }),
    supabase
      .from('return_exchanges')
      .select('reference_number, type, refund_amount, additional_charge, created_at, original_invoice_number')
      .or(`client_id.eq.${client.id},client_phone.eq.${client.phone || '__none__'}`)
      .order('created_at', { ascending: false }),
    supabase.from('store_wallets').select('balance').eq('client_id', client.id).maybeSingle(),
    supabase
      .from('wallet_transactions')
      .select('created_at, type, amount, source, reference_label, balance_after')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const invoices = invRes.data || [];
  const returns = retRes.data || [];
  const walletBalance = Number(walletBalRes.data?.balance) || 0;
  const walletTxs = walletTxRes.data || [];
  const lifetime = invoices.reduce((s, i) => s + (Number(i.grand_total) || 0), 0);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Nispaditha Ventures LLP', margin, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Client Report', margin, 16);
  doc.setFontSize(8);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    pageWidth - margin, 10, { align: 'right' },
  );
  doc.text('GSTIN: 29AAQFN9742E1ZO', pageWidth - margin, 16, { align: 'right' });

  let y = 34;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(client.name, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (client.phone) { doc.text(`Phone: ${client.phone}`, margin, y); y += 4; }
  if (client.email) { doc.text(`Email: ${client.email}`, margin, y); y += 4; }

  // Stats band
  y += 3;
  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(margin, y, pageWidth - margin * 2, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PURPLE);
  doc.text('LIFETIME SPEND', margin + 4, y + 5);
  doc.text('STORE WALLET', margin + 70, y + 5);
  doc.text('OUTSTANDING', margin + 130, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(money(lifetime), margin + 4, y + 13);
  doc.text(money(walletBalance), margin + 70, y + 13);
  doc.text(money(client.outstanding_balance || 0), margin + 130, y + 13);
  y += 24;

  // Purchase History
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Purchase History', margin, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    head: [['Date', 'Invoice #', 'Status', 'Amount']],
    body: invoices.map((i) => [
      new Date(i.invoice_date).toLocaleDateString('en-IN'),
      i.invoice_number,
      String(i.payment_status || i.status || '-').toUpperCase(),
      money(Number(i.grand_total) || 0),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: PURPLE, textColor: 255 },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 6;

  if (y > pageHeight - 60) { doc.addPage(); y = 20; }

  // Returns / Exchanges / Buyback
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Returns / Exchanges / Buyback', margin, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['Date', 'Ref #', 'Type', 'Original Invoice', 'Amount']],
    body: returns.length === 0 ? [['—', '—', '—', '—', '—']] : returns.map((r) => [
      new Date(r.created_at).toLocaleDateString('en-IN'),
      r.reference_number,
      r.type,
      r.original_invoice_number || '-',
      money(Number(r.refund_amount) || 0),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: PURPLE, textColor: 255 },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 6;

  if (y > pageHeight - 60) { doc.addPage(); y = 20; }

  // Wallet Transactions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Store Wallet Transactions', margin, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['Date', 'Source', 'Type', 'Amount', 'Balance']],
    body: walletTxs.length === 0 ? [['—', '—', '—', '—', '—']] : walletTxs.map((t) => [
      new Date(t.created_at).toLocaleDateString('en-IN'),
      `${t.source}${t.reference_label ? ' · ' + t.reference_label : ''}`,
      t.type.toUpperCase(),
      `${t.type === 'credit' ? '+' : '-'} ${money(Number(t.amount) || 0)}`,
      money(Number(t.balance_after) || 0),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: PURPLE, textColor: 255 },
    margin: { left: margin, right: margin },
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...PURPLE);
    doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Thank you for being a valued customer of Nispaditha Jewellery.', pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  doc.save(`Client_${client.name.replace(/\s+/g, '_')}_Report.pdf`);
}
