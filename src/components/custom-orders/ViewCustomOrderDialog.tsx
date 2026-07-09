import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileText, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CustomOrder, CustomOrderItem, CustomOrderComponent, CUSTOM_ORDER_STATUS_LABELS, CUSTOM_ORDER_STATUS_COLORS } from '@/types/customOrder';
import { useCustomOrders } from '@/hooks/useCustomOrders';
import { printCustomOrderDeliveryBill, downloadCustomOrderDeliveryBill } from '@/utils/customOrderDeliveryPdf';


interface ViewCustomOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CustomOrder | null;
  onGenerateInvoice?: (order: CustomOrder, items: CustomOrderItem[], components: CustomOrderComponent[]) => void;
}

export const ViewCustomOrderDialog = ({ open, onOpenChange, order, onGenerateInvoice }: ViewCustomOrderDialogProps) => {

  const { getOrderWithItems } = useCustomOrders();
  const [items, setItems] = useState<CustomOrderItem[]>([]);
  const [components, setComponents] = useState<CustomOrderComponent[]>([]);
  const [fullOrder, setFullOrder] = useState<CustomOrder | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (open && order) {
        setLoading(true);
        try {
          const full = await getOrderWithItems(order.id);
          setItems(full.items || []);
          setComponents((full as any).components || []);
          setFullOrder(full as CustomOrder);
        } finally {
          setLoading(false);
        }
      }
    };
    load();
  }, [open, order]);

  if (!order) return null;
  const o = fullOrder || order;

  const componentsTotal = components.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const itemsTotal = items.reduce((s, i) => s + i.item_total, 0);
  const customerMaterials = ((o as any).customer_materials || []) as Array<{ name: string; quantity?: number; weight_grams?: number; description?: string }>;
  const extraCharges = ((o as any).extra_charges || []) as Array<{ label: string; amount: number }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl">{o.reference_number}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Created on {format(new Date(o.created_at), 'PPP')}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={CUSTOM_ORDER_STATUS_COLORS[o.status]}>
                {CUSTOM_ORDER_STATUS_LABELS[o.status]}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => printCustomOrderDeliveryBill({ order: o, items, components })}
              >
                <Printer className="h-4 w-4 mr-1.5" /> Print Order Bill
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCustomOrderDeliveryBill({ order: o, items, components })}
              >
                <Download className="h-4 w-4 mr-1.5" /> Download PDF
              </Button>
              {!o.converted_to_invoice_id && o.status !== 'cancelled' && (
                <>
                  {onBillNow && (
                    <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => onBillNow(o, items, components)}>
                      <Receipt className="h-4 w-4 mr-1.5" />
                      Bill Now
                    </Button>
                  )}
                  {onConvertToInvoice && (
                    <Button variant="default" size="sm" onClick={() => onConvertToInvoice(o, items, components)}>
                      <FileText className="h-4 w-4 mr-1.5" />
                      Generate Invoice
                    </Button>
                  )}
                  {onSendToInvoicePage && (
                    <Button variant="outline" size="sm" onClick={() => onSendToInvoicePage(o, items, components)}>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send to Invoice Page
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>


        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <p className="font-medium">{format(new Date(o.order_date), 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivery Date</p>
              <p className="font-medium">{o.expected_delivery_date ? format(new Date(o.expected_delivery_date), 'dd/MM/yyyy') : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{o.client_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{o.phone_number || '-'}</p>
            </div>
          </div>

          <Separator />

          {/* Order Items — finished jewellery pieces being made */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-3 text-sm">Loading...</p>
              ) : items.length === 0 ? (
                <p className="text-muted-foreground text-center py-3 text-sm">None</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between items-start border-b pb-1.5 last:border-0">
                      <div className="flex-1 pr-3">
                        <p className="font-medium">{it.item_description || 'Custom Item'}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.sku ? `${it.sku} • ` : ''}
                          {it.pricing_mode === 'flat_price'
                            ? `Flat • Qty ${it.quantity || 1}`
                            : `${it.expected_weight || 0}g × Qty ${it.quantity || 1}${it.rate_per_gram ? ` @ ₹${it.rate_per_gram}/g` : ''}${it.mc_per_gram ? ` + MC ₹${it.mc_per_gram}/g` : ''}`}
                        </p>
                        {it.customization_notes ? (
                          <p className="text-xs text-muted-foreground italic mt-0.5">{it.customization_notes}</p>
                        ) : null}
                      </div>
                      <span className="font-semibold whitespace-nowrap">₹{(Number(it.item_total) || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Supplied Materials (descriptive) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Customer Items Supplied</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-3 text-sm">Loading...</p>
              ) : customerMaterials.length === 0 ? (
                <p className="text-muted-foreground text-center py-3 text-sm">None</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {customerMaterials.filter(m => (m.name || '').trim()).map((m, i) => (
                    <li key={i} className="flex flex-wrap gap-x-3">
                      <span className="font-medium">• {m.name}</span>
                      {m.quantity ? <span className="text-muted-foreground">Qty: {m.quantity}</span> : null}
                      {m.weight_grams ? <span className="text-muted-foreground">{m.weight_grams} g</span> : null}
                      {m.description ? <span className="text-muted-foreground italic">— {m.description}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Nispaditha Components (priced) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Nispaditha Components Added</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-3 text-sm">Loading...</p>
              ) : components.length === 0 ? (
                <p className="text-muted-foreground text-center py-3 text-sm">None</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {components.map((c, i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-1.5 last:border-0">
                      <div>
                        <p className="font-medium">{c.component_name}{c.material ? ` (${c.material})` : ''}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.weight_grams > 0 ? `${c.weight_grams}g × ` : ''}
                          {`Qty ${c.quantity || 1}`}
                          {c.rate_per_gram > 0 ? ` @ ₹${c.rate_per_gram}/g` : c.unit_price > 0 ? ` @ ₹${c.unit_price}` : ''}
                        </p>
                      </div>
                      <span className="font-semibold">₹{(Number(c.total) || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charges Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Charges Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {itemsTotal > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Items Total</span><span>₹{itemsTotal.toLocaleString('en-IN')}</span></div>
              )}
              {componentsTotal > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Components Total</span><span>₹{componentsTotal.toLocaleString('en-IN')}</span></div>
              )}
              {Number((o as any).making_charges) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Making Charges</span><span>₹{Number((o as any).making_charges).toLocaleString('en-IN')}</span></div>
              )}
              {o.design_charges > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Design Charges</span><span>₹{o.design_charges.toLocaleString('en-IN')}</span></div>
              )}
              {Number((o as any).labour_charges) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Labour Charges</span><span>₹{Number((o as any).labour_charges).toLocaleString('en-IN')}</span></div>
              )}
              {Number((o as any).polishing_charges) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Polishing Charges</span><span>₹{Number((o as any).polishing_charges).toLocaleString('en-IN')}</span></div>
              )}
              {Number((o as any).repair_charges) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Repair Charges</span><span>₹{Number((o as any).repair_charges).toLocaleString('en-IN')}</span></div>
              )}
              {o.additional_charge > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">{o.additional_charge_label}</span><span>₹{o.additional_charge.toLocaleString('en-IN')}</span></div>
              )}
              {extraCharges.filter(c => Number(c.amount) > 0).map((c, i) => (
                <div key={i} className="flex justify-between"><span className="text-muted-foreground">{c.label}</span><span>₹{Number(c.amount).toLocaleString('en-IN')}</span></div>
              ))}
              {o.flat_discount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Flat Discount</span><span className="text-destructive">-₹{o.flat_discount.toLocaleString('en-IN')}</span></div>
              )}
              {Number((o as any).gst_percentage) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">GST ({Number((o as any).gst_percentage)}% {(o as any).gst_mode === 'inclusive' ? 'incl.' : 'excl.'})</span><span>—</span></div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Grand Total</span><span>₹{o.total_amount.toLocaleString('en-IN')}</span></div>
            </CardContent>
          </Card>

          {o.converted_to_invoice_id && (
            <div className="p-3 rounded-lg bg-primary/10 text-sm">
              ✅ Converted to Invoice
            </div>
          )}

          {o.notes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm">{o.notes}</p></CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
