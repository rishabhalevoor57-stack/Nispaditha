import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';
import type { BusinessSettings, InvoiceItem, InvoiceTotals } from '@/types/invoice';

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientPhone: string;
  paymentMode: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  businessSettings: BusinessSettings | null;
  notes?: string;
  showMakingCharges?: boolean;
  gstPercentage?: number;
  roundOff?: number;
  advancePaid?: number;
}

const PURPLE = '#4a2060';
const PURPLE_LIGHT = '#f5eeff';
const ROW_ALT = '#fdf9ff';
const PURPLE_BORDER = '#6b3a8a';
const RUPEE = '\u20B9';

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const money = (n: number) => `${RUPEE} ${fmt(n)}`;

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

const INVOICE_FONT = "'Noto Sans', 'Roboto', Arial, sans-serif";

export function InvoicePreviewModal({
  open,
  onOpenChange,
  invoiceNumber,
  invoiceDate,
  clientName,
  clientPhone,
  paymentMode,
  items,
  totals,
  businessSettings,
  notes,
  gstPercentage = 3,
  roundOff = 0,
  advancePaid = 0,
}: InvoicePreviewModalProps) {
  if (!businessSettings) return null;

  const dateStr = new Date(invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const cgst = (totals.gstAmount || 0) / 2;
  const sgst = (totals.gstAmount || 0) / 2;
  const grandTotal = (totals.grandTotal || 0) + roundOff;
  const balanceDue = grandTotal - advancePaid;

  const isPaidFull = advancePaid >= grandTotal && grandTotal > 0;
  const isOverpaid = advancePaid > grandTotal;
  const isPartial = advancePaid > 0 && advancePaid < grandTotal;

  const numCellStyle: React.CSSProperties = {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        {/* Google Font import for Noto Sans (ensures ₹ renders correctly) */}
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');`}</style>
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Invoice Preview
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div
            className="bg-white text-black"
            id="invoice-preview"
            style={{ fontFamily: INVOICE_FONT }}
          >
            {/* PURPLE HEADER BAR (3-column grid) */}
            <div
              className="grid grid-cols-3 items-center px-6 py-3"
              style={{ background: PURPLE, color: '#fff', minHeight: 80 }}
            >
              <div>
                <div className="font-bold text-[13px] leading-tight">
                  {businessSettings.business_name || 'Nispaditha Ventures LLP'}
                </div>
                {businessSettings.address && (
                  <div className="text-[8px] leading-snug mt-0.5 opacity-95">
                    {businessSettings.address}
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <img
                  src="/images/nispaditha-logo.png"
                  alt="Nispaditha"
                  style={{
                    height: 55,
                    objectFit: 'contain',
                    filter: 'brightness(0) invert(1)',
                  }}
                />
              </div>
              <div className="text-right text-[10px] leading-snug">
                {businessSettings.phone && <div>Phone: {businessSettings.phone}</div>}
                {businessSettings.gst_number && (
                  <div className="mt-0.5">GSTIN: {businessSettings.gst_number}</div>
                )}
              </div>
            </div>

            {/* TAX INVOICE BAND */}
            <div
              className="text-center py-2 font-bold uppercase"
              style={{
                background: PURPLE_LIGHT,
                color: PURPLE,
                letterSpacing: '4px',
                borderTop: `2px solid ${PURPLE_BORDER}`,
                fontSize: 13,
              }}
            >
              Tax Invoice
            </div>

            {/* META ROW */}
            <div className="grid grid-cols-3 border-b" style={{ borderColor: '#e5e0ee' }}>
              {[
                { label: 'INVOICE NO', value: invoiceNumber },
                { label: 'INVOICE DATE', value: dateStr },
                { label: 'PAYMENT MODE', value: formatPaymentMode(paymentMode) },
              ].map((c, i) => (
                <div
                  key={c.label}
                  className="px-4 py-3"
                  style={{ borderRight: i < 2 ? `1px solid #e5e0ee` : undefined }}
                >
                  <div className="text-[9px] tracking-wider text-gray-500">{c.label}</div>
                  <div className="text-[12px] font-semibold mt-0.5">{c.value}</div>
                </div>
              ))}
            </div>

            {/* BILL TO ROW */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-[18px] font-bold">{clientName || 'Walk-in Customer'}</div>
                {clientPhone && (
                  <div className="text-[11px] text-gray-500 mt-0.5">{clientPhone}</div>
                )}
              </div>
              <div
                className="text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{ background: PURPLE }}
              >
                {formatPaymentMode(paymentMode)}
              </div>
            </div>

            {/* PRODUCT TABLE - fixed widths per spec */}
            <div className="px-6">
              <table
                className="w-full text-[11px] border-collapse"
                style={{ tableLayout: 'fixed' }}
              >
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: PURPLE, color: '#fff' }}>
                    <th className="px-1 py-2 text-center font-semibold">Sr</th>
                    <th className="px-2 py-2 text-left font-semibold">Product Name</th>
                    <th className="px-2 py-2 text-left font-semibold">SKU</th>
                    <th className="px-1 py-2 text-right font-semibold">Wt(G)</th>
                    <th className="px-1 py-2 text-center font-semibold">Qty</th>
                    <th className="px-1 py-2 text-right font-semibold" style={{ whiteSpace: 'nowrap' }}>MC ({RUPEE})</th>
                    <th className="px-1 py-2 text-right font-semibold" style={{ whiteSpace: 'nowrap' }}>Disc ({RUPEE})</th>
                    <th className="px-1 py-2 text-right font-semibold" style={{ whiteSpace: 'nowrap' }}>MRP ({RUPEE})</th>
                    <th className="px-1 py-2 text-right font-semibold" style={{ whiteSpace: 'nowrap' }}>Total ({RUPEE})</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const isFlat = item.pricing_mode === 'flat_price';
                    return (
                      <tr key={i} style={{ background: i % 2 === 1 ? ROW_ALT : '#fff' }}>
                        <td className="px-1 py-2 text-center border-t" style={{ borderColor: '#eee' }}>{i + 1}</td>
                        <td
                          className="px-2 py-2 border-t"
                          style={{ borderColor: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={item.product_name}
                        >
                          {item.product_name}
                        </td>
                        <td
                          className="px-2 py-2 border-t font-mono text-[10px]"
                          style={{ borderColor: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={item.sku}
                        >
                          {item.sku}
                        </td>
                        <td className="px-1 py-2 text-right border-t" style={{ ...numCellStyle, borderColor: '#eee' }}>
                          {isFlat ? '-' : Number(item.weight_grams).toFixed(2)}
                        </td>
                        <td className="px-1 py-2 text-center border-t" style={{ borderColor: '#eee' }}>{item.quantity}</td>
                        <td className="px-1 py-2 text-right border-t" style={{ ...numCellStyle, borderColor: '#eee' }}>
                          {isFlat || !item.making_charges ? '-' : fmt(item.making_charges)}
                        </td>
                        <td className="px-1 py-2 text-right border-t" style={{ ...numCellStyle, borderColor: '#eee' }}>
                          {item.discount > 0 ? fmt(item.discount) : '-'}
                        </td>
                        <td className="px-1 py-2 text-right border-t" style={{ ...numCellStyle, borderColor: '#eee' }}>
                          {item.mrp > 0 ? fmt(item.mrp) : '-'}
                        </td>
                        <td className="px-1 py-2 text-right border-t font-semibold" style={{ ...numCellStyle, borderColor: '#eee' }}>
                          {fmt(item.line_total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* TOTALS BLOCK */}
            <div className="px-6 mt-4 flex justify-end">
              <div className="w-80 text-[12px] space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span style={numCellStyle}>{money(totals.subtotal)}</span></div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>Total Discount</span><span style={numCellStyle}>{`\u2212 ${money(totals.discountAmount)}`}</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-gray-600">CGST @ {(gstPercentage / 2).toFixed(2)}%</span><span style={numCellStyle}>{money(cgst)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">SGST @ {(gstPercentage / 2).toFixed(2)}%</span><span style={numCellStyle}>{money(sgst)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Round Off</span><span style={numCellStyle}>{`${roundOff >= 0 ? '+' : '\u2212'} ${RUPEE} ${fmt(Math.abs(roundOff))}`}</span></div>
              </div>
            </div>

            {/* GRAND TOTAL BAND */}
            <div
              className="mx-6 mt-3 px-4 py-3 flex items-center justify-between text-white font-bold"
              style={{ background: PURPLE, fontSize: 16, width: 'auto' }}
            >
              <span className="uppercase tracking-wider text-[13px]">Grand Total</span>
              <span style={{ ...numCellStyle, overflow: 'visible' }}>{money(grandTotal)}</span>
            </div>

            {/* BOTTOM SECTION (T&C + Payment Summary) */}
            <div className="px-6 mt-5 grid grid-cols-2 gap-4">
              <div className="border rounded" style={{ borderColor: PURPLE_BORDER }}>
                <div
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: PURPLE_LIGHT, color: PURPLE }}
                >
                  Terms & Conditions
                </div>
                <ol className="px-4 py-2 text-[10px] text-gray-700 list-decimal list-inside space-y-1 leading-snug">
                  <li>Payment due within 5 days. Late payments attract 3% per month interest.</li>
                  <li>No return or refund except manufacturing defects or transit damage.</li>
                  <li>Exchange/repurchase: Material value only. No compensation for making charges, designing charges, wastage, or taxes.</li>
                </ol>
              </div>
              <div className="space-y-2">
                <div
                  className="border rounded px-3 py-2"
                  style={{ borderColor: PURPLE_BORDER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span className="text-[11px] text-gray-700">Grand Total</span>
                  <span className="font-bold" style={{ ...numCellStyle, minWidth: 90, textAlign: 'right' }}>{money(grandTotal)}</span>
                </div>
                <div
                  className="border rounded px-3 py-2"
                  style={{ borderColor: PURPLE_BORDER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span className="text-[11px] text-gray-700">Advance Paid</span>
                  <span className="font-bold" style={{ ...numCellStyle, minWidth: 90, textAlign: 'right' }}>{money(advancePaid)}</span>
                </div>
                {isPaidFull && !isOverpaid ? (
                  <div
                    className="rounded text-white font-bold uppercase tracking-wider"
                    style={{
                      background: '#27ae60',
                      padding: '8px 16px',
                      borderRadius: 4,
                      fontSize: 12,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    ✓ PAID IN FULL
                  </div>
                ) : (
                  <>
                    <div
                      className="rounded text-white font-bold"
                      style={{
                        background: PURPLE,
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span className="text-[11px] uppercase tracking-wider">Balance Due</span>
                      <span style={{ ...numCellStyle, minWidth: 90, textAlign: 'right' }}>
                        {money(Math.max(0, balanceDue))}
                      </span>
                    </div>
                    {isPartial && (
                      <div className="text-[10px] text-red-700 px-1">Partial Payment Received</div>
                    )}
                    {isOverpaid && (
                      <div className="text-[10px] px-1" style={{ color: '#d97706' }}>
                        {`Excess: ${money(advancePaid - grandTotal)} (to be adjusted)`}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {notes && (
              <div className="px-6 mt-4 text-[10px] italic text-gray-500">Note: {notes}</div>
            )}

            {/* SIGNATURE ROW */}
            <div className="px-6 mt-10 grid grid-cols-2 gap-8 pb-6">
              <div>
                <div className="border-t border-gray-400 mt-6"></div>
                <div className="text-[10px] text-gray-600 mt-1">Customer Signature</div>
              </div>
              <div className="text-right">
                <div className="border-t border-gray-400 mt-6"></div>
                <div className="text-[10px] text-gray-600 mt-1">Authorized Signature</div>
              </div>
            </div>

            {/* PURPLE FOOTER BAR */}
            <div
              className="px-6 py-2.5 flex items-center justify-between"
              style={{ background: PURPLE, color: '#fff' }}
            >
              <div className="italic text-[12px]">Thank you for your business!</div>
              <div className="text-[9px] opacity-90">
                Computer generated invoice · Nispaditha Ventures LLP
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
