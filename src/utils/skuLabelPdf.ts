import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { SkuRegistryRow } from '@/hooks/useSkuRegistry';

function barcodeDataUrl(value: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    height: 40,
    width: 1.4,
  });
  return canvas.toDataURL('image/png');
}

async function qrDataUrl(payload: unknown): Promise<string> {
  return QRCode.toDataURL(JSON.stringify(payload), { margin: 0, width: 120 });
}

// 50mm x 25mm jewellery tag layout, 4 per row on A4 portrait
export async function printSkuLabels(rows: SkuRegistryRow[]): Promise<void> {
  if (!rows.length) return;
  const labelW = 50;
  const labelH = 25;
  const marginX = 5;
  const marginY = 10;
  const gapX = 3;
  const gapY = 3;
  const cols = Math.floor((210 - marginX * 2 + gapX) / (labelW + gapX));
  const rowsPerPage = Math.floor((297 - marginY * 2 + gapY) / (labelH + gapY));
  const perPage = cols * rowsPerPage;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && i % perPage === 0) doc.addPage();
    const idxOnPage = i % perPage;
    const col = idxOnPage % cols;
    const row = Math.floor(idxOnPage / cols);
    const x = marginX + col * (labelW + gapX);
    const y = marginY + row * (labelH + gapY);

    doc.setDrawColor(180);
    doc.rect(x, y, labelW, labelH);

    const r = rows[i];
    const bar = barcodeDataUrl(r.sku);
    const qr = await qrDataUrl(r.qr_payload);

    // SKU at top
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(r.sku, x + 2, y + 4);

    // Vendor / category line
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const meta = [r.vendor_name, r.category_name].filter(Boolean).join(' · ');
    if (meta) doc.text(meta.slice(0, 40), x + 2, y + 7.5);

    // Barcode
    doc.addImage(bar, 'PNG', x + 2, y + 9, 30, 8);
    // QR
    doc.addImage(qr, 'PNG', x + labelW - 16, y + 6, 14, 14);

    // Footer: type of work
    if (r.type_of_work_name) {
      doc.setFontSize(5.5);
      doc.text(r.type_of_work_name.slice(0, 30), x + 2, y + labelH - 1.5);
    }
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (w) {
    w.onload = () => w.print();
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `sku-labels-${Date.now()}.pdf`;
    a.click();
  }
}

export async function downloadSkuLabels(rows: SkuRegistryRow[]): Promise<void> {
  if (!rows.length) return;
  await printSkuLabels(rows); // same generator, prompts download via print fallback
}
