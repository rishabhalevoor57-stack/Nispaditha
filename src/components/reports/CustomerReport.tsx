import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, exportToExcel, exportToPDF } from '@/utils/reportExport';
import { DataTable } from '@/components/ui/data-table';

interface CustomerReportProps {
  topCustomers: { name: string; invoices: number; total: number }[];
  repeatCustomers: { name: string; count: number; total: number }[];
  pendingPayments: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    grand_total: number;
    advance_paid: number;
    payment_status: string;
    customer: string;
    phone: string | null;
    balance: number;
  }[];
}

export const CustomerReport = ({ topCustomers, repeatCustomers, pendingPayments }: CustomerReportProps) => {
  const topCols = [
    { key: 'name', header: 'Customer' },
    { key: 'invoices', header: 'Invoices' },
    { key: 'total', header: 'Total Spent', cell: (r: any) => formatCurrency(r.total) },
  ];

  const repeatCols = [
    { key: 'name', header: 'Customer' },
    { key: 'count', header: 'Visits' },
    { key: 'total', header: 'Total Spent', cell: (r: any) => formatCurrency(r.total) },
  ];

  const outstandingCols = [
    { key: 'invoice_number', header: 'Ref #' },
    { key: 'customer', header: 'Customer' },
    { key: 'phone', header: 'Phone', cell: (r: any) => r.phone || '-' },
    { key: 'invoice_date', header: 'Order Date', cell: (r: any) => new Date(r.invoice_date).toLocaleDateString('en-IN') },
    { key: 'payment_status', header: 'Status', cell: (r: any) => r.payment_status === 'partial' ? 'PARTIAL' : 'PENDING' },
    { key: 'grand_total', header: 'Total Amount', cell: (r: any) => formatCurrency(Number(r.grand_total)) },
    { key: 'advance_paid', header: 'Paid', cell: (r: any) => formatCurrency(Number(r.advance_paid)) },
    { key: 'balance', header: 'Balance Due', cell: (r: any) => <span className="text-destructive font-medium">{formatCurrency(r.balance)}</span> },
  ];

  const totalOutstanding = pendingPayments.reduce((s, c) => s + c.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Customer Reports</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportToExcel(pendingPayments, 'Outstanding_Balances')} className="gap-1">
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            exportToPDF('Outstanding Balances', [
              { header: 'Ref #', key: 'invoice_number' },
              { header: 'Customer', key: 'customer' },
              { header: 'Phone', key: 'phone' },
              { header: 'Order Date', key: 'invoice_date' },
              { header: 'Status', key: 'payment_status' },
              { header: 'Total Amount', key: 'grand_total' },
              { header: 'Paid', key: 'advance_paid' },
              { header: 'Balance Due', key: 'balance' },
            ], pendingPayments.map(payment => ({
              ...payment,
              phone: payment.phone || '-',
              invoice_date: new Date(payment.invoice_date).toLocaleDateString('en-IN'),
              grand_total: formatCurrency(Number(payment.grand_total)),
              advance_paid: formatCurrency(Number(payment.advance_paid)),
              balance: formatCurrency(payment.balance),
            })), 'Outstanding_Balances');
          }} className="gap-1">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Customers by Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCustomers.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} angle={-30} textAnchor="end" height={80} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Top Customers</CardTitle></CardHeader>
          <CardContent><DataTable data={topCustomers} columns={topCols} emptyMessage="No data" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Repeat Customers (2+ visits)</CardTitle></CardHeader>
          <CardContent><DataTable data={repeatCustomers} columns={repeatCols} emptyMessage="No data" /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Outstanding Balances
              <span className="text-destructive text-sm">{formatCurrency(totalOutstanding)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent><DataTable data={pendingPayments} columns={outstandingCols} emptyMessage="All clear!" /></CardContent>
        </Card>
      </div>
    </div>
  );
};
