import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, MapPin, Edit, Trash2, CreditCard, Hash } from 'lucide-react';
import type { Vendor, VendorPayment } from '@/hooks/useVendors';

interface VendorProduct {
  id: string;
  sku: string;
  name: string;
  purchase_price: number;
  quantity: number;
  created_at: string;
  categories: { name: string } | null;
}

interface VendorProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Vendor | null;
  onEdit: () => void;
  onDelete: () => void;
  onAddPayment: () => void;
  fetchProducts: (vendorId: string) => Promise<VendorProduct[]>;
  fetchPayments: (vendorId: string) => Promise<VendorPayment[]>;
}

export function VendorProfileDialog({
  open,
  onOpenChange,
  vendor,
  onEdit,
  onDelete,
  onAddPayment,
  fetchProducts,
  fetchPayments,
}: VendorProfileDialogProps) {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (open && vendor) {
      setLoadingProducts(true);
      setLoadingPayments(true);
      fetchProducts(vendor.id).then((data) => {
        setProducts(data as VendorProduct[]);
        setLoadingProducts(false);
      });
      fetchPayments(vendor.id).then((data) => {
        setPayments(data);
        setLoadingPayments(false);
      });
    }
  }, [open, vendor]);

  if (!vendor) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{vendor.name}</DialogTitle>
        </DialogHeader>

        {/* Vendor Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border">
          <div className="space-y-2 text-sm">
            {vendor.vendor_code && (
              <p className="flex items-center gap-2"><Hash className="w-3.5 h-3.5 text-muted-foreground" /> {vendor.vendor_code}</p>
            )}
            {vendor.phone && (
              <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> {vendor.phone}</p>
            )}
            {vendor.address && (
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {vendor.address}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="stat-card p-3">
              <p className="text-muted-foreground text-xs">Total Purchases</p>
              <p className="text-lg font-bold">{formatCurrency(vendor.total_purchases)}</p>
            </div>
            <div className="stat-card p-3">
              <p className="text-muted-foreground text-xs">Total Paid</p>
              <p className="text-lg font-bold">{formatCurrency(vendor.total_paid)}</p>
            </div>
            <div className="stat-card p-3">
              <p className="text-muted-foreground text-xs">Outstanding</p>
              <p className={`text-lg font-bold ${vendor.outstanding_balance > 0 ? 'text-destructive' : ''}`}>
                {formatCurrency(vendor.outstanding_balance)}
              </p>
            </div>
            <div className="stat-card p-3">
              <p className="text-muted-foreground text-xs">Last Purchase</p>
              <p className="text-sm font-medium">{formatDate(vendor.last_purchase_date)}</p>
            </div>
          </div>
        </div>

        {vendor.notes && (
          <div className="text-sm p-3 rounded-lg bg-muted/20 border">
            <p className="text-muted-foreground text-xs mb-1">Notes</p>
            <p>{vendor.notes}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onAddPayment}>
            <CreditCard className="w-4 h-4 mr-1" /> Record Payment
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>

        {/* Tabs: Products & Payments */}
        <Tabs defaultValue="products" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="products" className="flex-1">Purchase History ({products.length})</TabsTrigger>
            <TabsTrigger value="payments" className="flex-1">Payments ({payments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            {loadingProducts ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : products.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No products linked to this vendor.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">SKU</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Product</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase Price</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.categories?.name || '-'}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(p.purchase_price)}</td>
                        <td className="px-3 py-2 text-center">{p.quantity}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments">
            {loadingPayments ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payments recorded yet.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mode</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.id} className="border-t">
                        <td className="px-3 py-2">{formatDate(pay.payment_date)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(pay.amount)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">{pay.payment_mode}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{pay.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
