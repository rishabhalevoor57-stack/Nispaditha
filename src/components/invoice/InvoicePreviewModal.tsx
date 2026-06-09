import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';
import type { BusinessSettings, InvoiceItem, InvoiceTotals } from '@/types/invoice';

interface PaymentBreakdownEntry {
  mode: string;
  amount: number;
}

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
  storeCreditsUsed?: number;
  paymentBreakdown?: PaymentBreakdownEntry[];
  metalRateLabel?: string;
  gstMode?: 'exclusive' | 'inclusive';
}

const PURPLE = '#4a2060';
const PURPLE_LIGHT = '#f5eeff';
const ROW_ALT = '#fdf9ff';
const PURPLE_BORDER = '#6b3a8a';
const GREEN = '#27ae60';
const GREEN_BG = '#eafaf1';
const ORANGE = '#e67e22';
const ORANGE_BG = '#fff3e0';
const RUPEE = '\u20B9';
const INVOICE_FONT =
  "'Noto Sans', 'Roboto', Arial, sans-serif";

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
  storeCreditsUsed = 0,
  paymentBreakdown = [],
  metalRateLabel,
  gstMode = 'exclusive',
}: InvoicePreviewModalProps) {
  if (!businessSettings) return null;

  const isInclusive = gstMode === 'inclusive';

  const dateStr = new Date(invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const cgst = (totals.gstAmount || 0) / 2;
  const sgst = (totals.gstAmount || 0) / 2;
  // In inclusive mode the line-totals already contain GST, so grandTotal == subtotal + roundOff.
  // In exclusive mode GST is added on top.
  const grandTotal = isInclusive
    ? (totals.subtotal || 0) + roundOff
    : (totals.grandTotal || 0) + roundOff;
  const breakdownTotal = paymentBreakdown.reduce((s, p) => s + (p.amount || 0), 0);
  const cashOrUpiPaid = breakdownTotal > 0 ? breakdownTotal : advancePaid;
  const paidTotal = cashOrUpiPaid + storeCreditsUsed;
  let balanceDue = Math.round((grandTotal - paidTotal) * 100) / 100;
  if (balanceDue <= 0.05 && balanceDue >= -0.05) balanceDue = 0;

  const isPaidFull = grandTotal > 0 && balanceDue === 0 && paidTotal > 0;
  const isOverpaid = paidTotal > grandTotal + 0.05 && grandTotal > 0;
  const isPartial = paidTotal > 0 && !isPaidFull && balanceDue > 0;

  const num: React.CSSProperties = {
    whiteSpace: 'nowrap',
    overflow: 'visible',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');
          @media print {
            @page { size: A4 portrait; margin: 10mm 12mm; }
            body { margin: 0; padding: 0; }
            #invoice-preview { width: 210mm; min-height: 297mm; }
            #invoice-preview * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
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
            {/* HEADER (white with bold purple bottom border) */}
            <div
              className="grid items-center px-5 py-2"
              style={{
                background: '#fff',
                color: PURPLE,
                gridTemplateColumns: '1fr 90px 1fr',
                minHeight: 64,
                gap: 8,
                borderBottom: `4px solid ${PURPLE}`,
              }}
            >
              <div>
                <div className="font-bold text-[13px] leading-tight" style={{ color: PURPLE }}>
                  {businessSettings.business_name || 'Nispaditha Ventures LLP'}
                </div>
                <div className="text-[8px] leading-snug mt-0.5" style={{ color: '#555' }}>
                  {businessSettings.address ||
                    '60 Feet Rd, AECS Layout - C Block, Kundalahalli, Brookefield, Bengaluru, Karnataka 560037'}
                </div>
              </div>
              <div className="flex justify-center">
                <img
                  src="/images/nispaditha-logo.png"
                  alt="Nispaditha"
                  style={{ height: 50, objectFit: 'contain' }}
                />
              </div>
              <div className="text-right text-[10px] leading-snug" style={{ color: PURPLE }}>
                <div>Phone: {businessSettings.phone || '99868 64152'}</div>
                <div
                  className="inline-block mt-1 px-2 py-0.5 text-[8px] tracking-wide"
                  style={{
                    border: `1px solid ${PURPLE}`,
                    borderRadius: 3,
                    color: PURPLE,
                  }}
                >
                  GSTIN: {businessSettings.gst_number || '29AAAQFN9742E1ZO'}
                </div>
              </div>
            </div>

            {/* TAX INVOICE BAND */}
            <div
              className="text-center py-1.5 font-bold uppercase"
              style={{
                background: PURPLE_LIGHT,
                color: PURPLE,
                letterSpacing: '4px',
                borderTop: `2px solid ${PURPLE_BORDER}`,
                fontSize: 11,
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
                  className="px-4 py-2.5"
                  style={{ borderRight: i < 2 ? `1px solid #e5e0ee` : undefined }}
                >
                  <div className="text-[9px] tracking-wider text-gray-500">{c.label}</div>
                  <div className="text-[12px] font-semibold mt-0.5">{c.value}</div>
                </div>
              ))}
            </div>

            {/* BILL TO ROW (no duplicate payment pill) */}
            <div className="px-6 py-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-[18px] font-bold leading-tight">
                  {clientName || 'Walk-in Customer'}
                </div>
                {clientPhone && (
                  <div className="text-[11px] text-gray-500 mt-0.5">{clientPhone}</div>
                )}
              </div>
              {metalRateLabel && (
                <div
                  className="text-[10.5px] font-semibold px-3 py-1.5 rounded"
                  style={{ background: PURPLE_LIGHT, color: PURPLE, border: `1px solid ${PURPLE_BORDER}`, whiteSpace: 'nowrap' }}
                >
                  {metalRateLabel}
                </div>
              )}
            </div>

            {/* PRODUCT TABLE */}
            <div className="px-6">
              <table
                className="w-full text-[10.5px] border-collapse"
                style={{ tableLayout: 'fixed' }}
              >
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
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
                    <th className="px-1 py-2 text-right font-semibold" style={{ whiteSpace: 'nowrap' }}>MRP ({RUPEE})</th>
                    <th className="px-1 py-2 text-right font-semibold" style={{ whiteSpace: 'nowrap' }}>Discount ({RUPEE})</th>
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
                          className="px-2 py-2 border-t font-semibold"
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
                        <td className="px-1 py-2 text-right border-t" style={{ ...num, borderColor: '#eee' }}>
                          {isFlat ? '-' : Number(item.weight_grams).toFixed(2)}
                        </td>
                        <td className="px-1 py-2 text-center border-t" style={{ borderColor: '#eee' }}>{item.quantity}</td>
                        <td className="px-1 py-2 text-right border-t" style={{ ...num, borderColor: '#eee' }}>
                          {isFlat || !item.making_charges ? '-' : fmt(item.making_charges)}
                        </td>
                        <td className="px-1 py-2 text-right border-t" style={{ ...num, borderColor: '#eee' }}>
                          {fmt(item.mrp)}
                        </td>
                        <td className="px-1 py-2 text-right border-t" style={{ ...num, borderColor: '#eee' }}>
                          {item.discount > 0 ? fmt(item.discount) : '-'}
                        </td>
                        <td className="px-1 py-2 text-right border-t font-semibold" style={{ ...num, borderColor: '#eee' }}>
                          {fmt(item.line_total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* TOTALS BLOCK — MRP-based (discount applied once) */}
            <div className="px-6 mt-4 flex justify-end">
              <div className="w-80 text-[11.5px] space-y-1">
                <div className="flex justify-between text-[13px] font-bold">
                  <span>MRP (Total)</span>
                  <span style={num}>{money(totals.subtotal + totals.discountAmount)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between" style={{ color: '#b91c1c' }}>
                    <span>{'\u2212 Discount'}</span><span style={num}>{`\u2212 ${money(totals.discountAmount)}`}</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-gray-600">CGST @ {(gstPercentage / 2).toFixed(2)}%</span><span style={num}>{money(cgst)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">SGST @ {(gstPercentage / 2).toFixed(2)}%</span><span style={num}>{money(sgst)}</span></div>
                {roundOff !== 0 && (
                  <div className="flex justify-between text-gray-500 italic">
                    <span>{roundOff >= 0 ? 'Round Off' : '\u2212 Round Off'}</span>
                    <span style={num}>{`${RUPEE} ${fmt(Math.abs(roundOff))}`}</span>
                  </div>
                )}
                {storeCreditsUsed > 0 && (
                  <div className="flex justify-between" style={{ color: GREEN }}><span>Store Credits Redeemed</span><span style={num}>{`\u2212 ${money(storeCreditsUsed)}`}</span></div>
                )}
              </div>
            </div>

            {/* GRAND TOTAL BAND (the only place Grand Total appears) */}
            <div
              className="mx-6 mt-3 px-4 py-2.5 flex items-center justify-between text-white"
              style={{ background: PURPLE, borderRadius: 3 }}
            >
              <span className="uppercase tracking-wider text-[12px] font-bold">Grand Total</span>
              <span className="font-bold" style={{ ...num, fontSize: 18 }}>{money(grandTotal)}</span>
            </div>

            {/* BOTTOM SECTION (T&C + Payment Summary) */}
            <div className="px-6 mt-4 grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="border rounded overflow-hidden" style={{ borderColor: PURPLE_BORDER }}>
                <div
                  className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: PURPLE_LIGHT, color: PURPLE }}
                >
                  Terms & Conditions
                </div>
                <ol
                  className="px-4 py-2 text-gray-700 list-decimal list-outside space-y-1"
                  style={{ fontSize: '7.5px', lineHeight: 1.6, wordWrap: 'normal', height: 'auto' }}
                >
                  <li>No return or refund will be accepted except in cases of manufacturing defects.</li>
                  <li>Under the exchange &amp; buyback policy, only the metal value will be considered. Making charges, designing charges, wastage, stones, taxes, and other additional charges are non-refundable.</li>
                  <li>Warranty period is 6 months from the date of purchase. Repairs after the warranty period will be chargeable.</li>
                  <li>Products that are altered, repaired, resized, damaged, broken, mishandled, or tampered with by third parties will not be eligible for exchange, buyback, repair, or warranty claims.</li>
                  <li>One-time polishing service will be provided free of charge. Subsequent polishing services will be chargeable.</li>
                  <li>Original invoice must be presented for all exchange, buyback, repair, polishing, or warranty claims.</li>
                  <li>Tarnishing or oxidation of silver over time is normal and shall not be considered a manufacturing defect.</li>
                  <li>The company reserves the right to modify exchange, buyback, repair, and warranty policies without prior notice.</li>
                </ol>
              </div>

              <div className="space-y-2">
                {storeCreditsUsed > 0 && (
                  <div
                    className="rounded px-3 py-2 flex items-center justify-between"
                    style={{ border: `1px solid ${PURPLE_BORDER}` }}
                  >
                    <span className="text-[10.5px] text-gray-700">Store Credits Redeemed</span>
                    <span className="font-bold" style={{ ...num, color: GREEN, minWidth: 90, textAlign: 'right' }}>
                      {`\u2212 ${money(storeCreditsUsed)}`}
                    </span>
                  </div>
                )}
                {paymentBreakdown.length > 0
                  ? paymentBreakdown.filter((p) => p.amount > 0).map((p, idx) => (
                      <div
                        key={idx}
                        className="rounded px-3 py-2 flex items-center justify-between"
                        style={{ border: `1px solid ${PURPLE_BORDER}` }}
                      >
                        <span className="text-[10.5px] text-gray-700 capitalize">
                          {`Paid via ${p.mode.replace(/_/g, ' ')}`}
                        </span>
                        <span className="font-bold" style={{ ...num, color: GREEN, minWidth: 90, textAlign: 'right' }}>
                          {`\u2212 ${money(p.amount)}`}
                        </span>
                      </div>
                    ))
                  : advancePaid > 0 && (
                      <div
                        className="rounded px-3 py-2 flex items-center justify-between"
                        style={{ border: `1px solid ${PURPLE_BORDER}` }}
                      >
                        <span className="text-[10.5px] text-gray-700">Advance Paid</span>
                        <span className="font-bold" style={{ ...num, color: GREEN, minWidth: 90, textAlign: 'right' }}>
                          {`\u2212 ${money(advancePaid)}`}
                        </span>
                      </div>
                    )}
                {!isPaidFull && (
                  <div
                    className="rounded px-3 py-2 flex items-center justify-between text-white"
                    style={{ background: PURPLE }}
                  >
                    <span className="text-[10.5px] uppercase tracking-wider font-semibold">Balance Due</span>
                    <span className="font-bold" style={{ ...num, fontSize: 13, minWidth: 90, textAlign: 'right' }}>
                      {money(Math.max(0, balanceDue))}
                    </span>
                  </div>
                )}
                {isPaidFull && !isOverpaid ? (
                  <div
                    className="rounded flex items-center justify-center gap-2 py-2"
                    style={{
                      background: GREEN_BG,
                      border: `2px solid ${GREEN}`,
                      borderRadius: 5,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        background: GREEN,
                        color: '#fff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </div>
                    <div
                      className="font-bold uppercase"
                      style={{ color: GREEN, letterSpacing: 1.5, fontSize: 13 }}
                    >
                      Paid in Full
                    </div>
                  </div>
                ) : isPartial ? (
                  <div
                    className="text-center text-[8.5px] font-bold uppercase tracking-widest py-1 rounded"
                    style={{
                      background: ORANGE_BG,
                      border: `1px solid ${ORANGE}`,
                      color: ORANGE,
                    }}
                  >
                    Partial Payment
                  </div>
                ) : null}
                {isOverpaid && (
                  <div className="text-[10px] px-1" style={{ color: ORANGE }}>
                    {`Excess: ${money(paidTotal - grandTotal)} (to be adjusted)`}
                  </div>
                )}
              </div>
            </div>


            {notes && (
              <div className="px-6 mt-4 text-[10px] italic text-gray-500">Note: {notes}</div>
            )}

            {/* SIGNATURE — Authorized only (right) */}
            <div className="px-6 mt-10 pb-6 flex justify-end">
              <div style={{ width: 180 }}>
                <div className="border-t border-gray-400"></div>
                <div className="text-[10px] text-gray-600 mt-1 text-center">
                  Authorized Signature
                </div>
              </div>
            </div>

            {/* FOOTER (white with bold purple top border) */}
            <div
              className="px-6 py-2.5 flex items-center justify-between"
              style={{
                background: '#fff',
                color: PURPLE,
                borderTop: `4px solid ${PURPLE}`,
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
                pageBreakInside: 'avoid',
              }}
            >
              <div className="italic text-[12px] font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: PURPLE }}>
                Thank you for your business!
              </div>
              <div className="text-[8.5px]" style={{ color: PURPLE, opacity: 0.75 }}>
                Computer generated invoice · Nispaditha Ventures LLP
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
