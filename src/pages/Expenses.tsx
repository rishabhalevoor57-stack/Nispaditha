import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BlankZeroInput } from '@/components/ui/blank-zero-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Edit, Trash2, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { format } from 'date-fns';
import { exportToExcel, exportToPDF } from '@/utils/reportExport';

type ExpenseType = 'labour' | 'stock_purchase' | 'other';
type TabKey = 'all' | ExpenseType;

interface Expense {
  id: string;
  expense_date: string;
  expense_type: ExpenseType;
  category: string | null;
  description: string | null;
  amount: number;
  payment_mode: string | null;
  notes: string | null;
  attachment_url: string | null;
  paid_to_name: string | null;
  paid_to_phone: string | null;
  supplier_name: string | null;
  product_name: string | null;
  sku: string | null;
  quantity: number | null;
  weight_grams: number | null;
  invoice_number: string | null;
  created_at: string;
  edit_reason: string | null;
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
  { value: 'other', label: 'Other' },
];

const LABOUR_CATEGORIES = [
  'Polishing Labour',
  'Stone Setting Labour',
  'Packing Labour',
  'Making Labour',
  'Delivery Labour',
  'Other',
];

const OTHER_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Marketing',
  'Supplies',
  'Maintenance',
  'Transport',
  'Insurance',
  'Taxes',
  'Other',
];

const todayISO = () => new Date().toISOString().split('T')[0];

interface FormState {
  expense_date: string;
  expense_type: ExpenseType;
  category: string;
  description: string;
  amount: number;
  payment_mode: string;
  notes: string;
  paid_to_name: string;
  paid_to_phone: string;
  supplier_name: string;
  product_name: string;
  sku: string;
  quantity: number;
  weight_grams: number;
  invoice_number: string;
  attachment_url: string;
}

const emptyForm = (type: ExpenseType = 'labour'): FormState => ({
  expense_date: todayISO(),
  expense_type: type,
  category: '',
  description: '',
  amount: 0,
  payment_mode: 'cash',
  notes: '',
  paid_to_name: '',
  paid_to_phone: '',
  supplier_name: '',
  product_name: '',
  sku: '',
  quantity: 0,
  weight_grams: 0,
  invoice_number: '',
  attachment_url: '',
});

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const expenseTypeLabel = (t: ExpenseType) =>
  t === 'labour' ? 'Labour' : t === 'stock_purchase' ? 'Stock Purchase' : 'Other';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm('labour'));
  const [editReason, setEditReason] = useState('');

  // Filters
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to load expenses', description: error.message });
    } else {
      setExpenses((data || []) as unknown as Expense[]);
    }
    setIsLoading(false);
  };

  const handleOpenCreate = (forType: ExpenseType) => {
    setEditing(null);
    setEditReason('');
    setForm(emptyForm(forType));
    setIsDialogOpen(true);
  };

  const handleEdit = (e: Expense) => {
    setEditing(e);
    setEditReason('');
    setForm({
      expense_date: e.expense_date,
      expense_type: e.expense_type,
      category: e.category || '',
      description: e.description || '',
      amount: Number(e.amount) || 0,
      payment_mode: e.payment_mode || 'cash',
      notes: e.notes || '',
      paid_to_name: e.paid_to_name || '',
      paid_to_phone: e.paid_to_phone || '',
      supplier_name: e.supplier_name || '',
      product_name: e.product_name || '',
      sku: e.sku || '',
      quantity: Number(e.quantity) || 0,
      weight_grams: Number(e.weight_grams) || 0,
      invoice_number: e.invoice_number || '',
      attachment_url: e.attachment_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.amount || form.amount <= 0) {
      toast({ variant: 'destructive', title: 'Amount required', description: 'Enter an amount greater than zero.' });
      return;
    }
    if (editing && !editReason.trim()) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Please enter a reason for editing.' });
      return;
    }

    const payload: Record<string, unknown> = {
      expense_date: form.expense_date,
      expense_type: form.expense_type,
      category: form.category || expenseTypeLabel(form.expense_type),
      description: form.description || null,
      amount: form.amount,
      payment_mode: form.payment_mode || null,
      notes: form.notes || null,
      attachment_url: form.attachment_url || null,
      paid_to_name: form.paid_to_name || null,
      paid_to_phone: form.paid_to_phone || null,
      supplier_name: form.expense_type === 'stock_purchase' ? form.supplier_name || null : null,
      product_name: form.expense_type === 'stock_purchase' ? form.product_name || null : null,
      sku: form.expense_type === 'stock_purchase' ? form.sku || null : null,
      quantity: form.expense_type === 'stock_purchase' ? form.quantity || null : null,
      weight_grams: form.expense_type === 'stock_purchase' ? form.weight_grams || null : null,
      invoice_number: form.expense_type === 'stock_purchase' ? form.invoice_number || null : null,
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from('expenses')
          .update({ ...payload, updated_by: user?.id, edit_reason: editReason.trim() })
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Expense updated' });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([{ ...payload, created_by: user?.id }]);
        if (error) throw error;
        toast({ title: 'Expense added' });
      }
      setIsDialogOpen(false);
      setEditing(null);
      setEditReason('');
      setForm(emptyForm(form.expense_type));
      fetchExpenses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save expense';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
    } else {
      toast({ title: 'Expense deleted' });
      fetchExpenses();
    }
  };

  // ---------- filtering ----------
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (tab !== 'all' && e.expense_type !== tab) return false;
      if (dateFrom && e.expense_date < dateFrom) return false;
      if (dateTo && e.expense_date > dateTo) return false;
      if (paymentFilter !== 'all' && (e.payment_mode || '') !== paymentFilter) return false;
      if (supplierFilter !== 'all' && (e.supplier_name || '') !== supplierFilter) return false;
      if (employeeFilter !== 'all' && (e.paid_to_name || '') !== employeeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [
          e.category, e.description, e.notes, e.paid_to_name, e.supplier_name,
          e.product_name, e.sku, e.invoice_number,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [expenses, tab, dateFrom, dateTo, paymentFilter, supplierFilter, employeeFilter, search]);

  // ---------- summary ----------
  const summary = useMemo(() => {
    const today = todayISO();
    const monthStart = today.slice(0, 7) + '-01';
    let todayTotal = 0, monthTotal = 0, labour = 0, stock = 0, other = 0, total = 0;
    for (const e of expenses) {
      const amt = Number(e.amount) || 0;
      total += amt;
      if (e.expense_date === today) todayTotal += amt;
      if (e.expense_date >= monthStart) monthTotal += amt;
      if (e.expense_type === 'labour') labour += amt;
      else if (e.expense_type === 'stock_purchase') stock += amt;
      else other += amt;
    }
    return { todayTotal, monthTotal, labour, stock, other, total };
  }, [expenses]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filtered],
  );

  const supplierOptions = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.supplier_name).filter(Boolean) as string[])).sort(),
    [expenses],
  );
  const employeeOptions = useMemo(
    () => Array.from(
      new Set(
        expenses
          .filter((e) => e.expense_type === 'labour')
          .map((e) => e.paid_to_name)
          .filter(Boolean) as string[],
      ),
    ).sort(),
    [expenses],
  );

  // ---------- export ----------
  const buildExportRows = () =>
    filtered.map((e) => ({
      Date: format(new Date(e.expense_date), 'dd MMM yyyy'),
      Type: expenseTypeLabel(e.expense_type),
      Category: e.category || '',
      Description: e.description || '',
      'Paid To / Employee': e.paid_to_name || '',
      Supplier: e.supplier_name || '',
      Product: e.product_name || '',
      SKU: e.sku || '',
      Qty: e.quantity ?? '',
      'Weight (g)': e.weight_grams ?? '',
      'Invoice #': e.invoice_number || '',
      'Payment Mode': e.payment_mode || '',
      Amount: Number(e.amount) || 0,
      Notes: e.notes || '',
    }));

  const handleExportCSV = () => {
    const rows = buildExportRows();
    if (!rows.length) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = String((r as Record<string, unknown>)[h] ?? '');
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expenses_${todayISO()}.csv`;
    link.click();
  };

  const handleExportExcel = () => {
    const rows = buildExportRows();
    if (!rows.length) return toast({ title: 'Nothing to export', variant: 'destructive' });
    exportToExcel(rows, `expenses_${todayISO()}`, 'Expenses');
  };

  const handleExportPDF = () => {
    const rows = buildExportRows();
    if (!rows.length) return toast({ title: 'Nothing to export', variant: 'destructive' });
    exportToPDF(
      'Expense Report',
      [
        { header: 'Date', key: 'Date' },
        { header: 'Type', key: 'Type' },
        { header: 'Category', key: 'Category' },
        { header: 'Paid To', key: 'Paid To / Employee' },
        { header: 'Supplier', key: 'Supplier' },
        { header: 'Payment', key: 'Payment Mode' },
        { header: 'Amount (Rs)', key: 'Amount' },
      ],
      rows,
      `expenses_${todayISO()}`,
    );
  };

  // ---------- columns ----------
  const columns = [
    { key: 'expense_date', header: 'Date', cell: (e: Expense) => format(new Date(e.expense_date), 'dd MMM yyyy') },
    {
      key: 'expense_type',
      header: 'Type',
      cell: (e: Expense) => (
        <Badge
          variant="outline"
          className={
            e.expense_type === 'labour'
              ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
              : e.expense_type === 'stock_purchase'
                ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                : 'bg-primary/10 text-primary border-primary/20'
          }
        >
          {expenseTypeLabel(e.expense_type)}
        </Badge>
      ),
    },
    {
      key: 'detail',
      header: 'Details',
      cell: (e: Expense) => {
        if (e.expense_type === 'stock_purchase') {
          return (
            <div className="text-sm">
              <div className="font-medium">{e.product_name || e.category || '-'}</div>
              <div className="text-xs text-muted-foreground">
                {e.supplier_name ? `Supplier: ${e.supplier_name}` : ''}
                {e.sku ? ` • SKU: ${e.sku}` : ''}
                {e.invoice_number ? ` • Inv: ${e.invoice_number}` : ''}
              </div>
            </div>
          );
        }
        return (
          <div className="text-sm">
            <div className="font-medium">{e.category || '-'}</div>
            {e.description && (
              <div className="text-xs text-muted-foreground truncate max-w-[260px]">{e.description}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'paid_to',
      header: 'Paid To',
      cell: (e: Expense) => (
        <div className="text-sm">
          <div>{e.paid_to_name || '-'}</div>
          {e.paid_to_phone && <div className="text-xs text-muted-foreground">{e.paid_to_phone}</div>}
        </div>
      ),
    },
    { key: 'payment_mode', header: 'Mode', cell: (e: Expense) => e.payment_mode || '-' },
    {
      key: 'amount',
      header: 'Amount',
      cell: (e: Expense) => <span className="font-semibold">{fmtINR(Number(e.amount))}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (e: Expense) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }}>
            <Edit className="w-4 h-4" />
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const SummaryCard = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
    <div className="bg-card rounded-xl border p-4 shadow-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ?? ''}`}>{value}</p>
    </div>
  );

  return (
    <AppLayout>
      <PageHeader
        title="Expenses"
        description="Labour, stock purchases and operating expenses"
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="btn-gold">
                  <Plus className="w-4 h-4 mr-2" /> Add Expense
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleOpenCreate('labour')}>Labour Expense</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenCreate('stock_purchase')}>Stock Purchase</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenCreate('other')}>Other Expense</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="Today" value={fmtINR(summary.todayTotal)} />
        <SummaryCard label="This Month" value={fmtINR(summary.monthTotal)} />
        <SummaryCard label="Labour" value={fmtINR(summary.labour)} accent="text-blue-600" />
        <SummaryCard label="Stock Purchases" value={fmtINR(summary.stock)} accent="text-amber-600" />
        <SummaryCard label="Other" value={fmtINR(summary.other)} accent="text-primary" />
        <SummaryCard label="Total" value={fmtINR(summary.total)} accent="text-foreground" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="stock_purchase">Stock Purchase</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search description, supplier, employee, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger><SelectValue placeholder="Payment Mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Modes</SelectItem>
            {PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {tab === 'stock_purchase' ? (
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {supplierOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger><SelectValue placeholder="Employee / Paid To" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employeeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="bg-card rounded-xl border p-4 mb-4 shadow-card flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Filtered Total</p>
          <p className="text-2xl font-bold text-primary">{fmtINR(filteredTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Records</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No expenses found. Add one to get started."
      />

      {/* ---------- Form Dialog ---------- */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(o) => {
          setIsDialogOpen(o);
          if (!o) {
            setEditing(null);
            setEditReason('');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Expense' : `Add ${expenseTypeLabel(form.expense_type)} Expense`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Type + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expense Type *</Label>
                <Select
                  value={form.expense_type}
                  onValueChange={(v) => setForm({ ...form, expense_type: v as ExpenseType, category: '' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labour">Labour</SelectItem>
                    <SelectItem value="stock_purchase">Stock Purchase</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Labour fields */}
            {form.expense_type === 'labour' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee / Worker Name *</Label>
                    <Input
                      value={form.paid_to_name}
                      onChange={(e) => setForm({ ...form, paid_to_name: e.target.value })}
                      placeholder="e.g. Ramesh"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {LABOUR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What was the labour for?"
                  />
                </div>
              </>
            )}

            {/* Stock Purchase fields */}
            {form.expense_type === 'stock_purchase' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supplier Name *</Label>
                    <Input
                      value={form.supplier_name}
                      onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                      placeholder="Supplier"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Input
                      value={form.invoice_number}
                      onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                      placeholder="Supplier invoice #"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Name</Label>
                    <Input
                      value={form.product_name}
                      onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                      placeholder="Product"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="SKU"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <BlankZeroInput
                      type="number"
                      value={form.quantity}
                      onValueChange={(v) => setForm({ ...form, quantity: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (g)</Label>
                    <BlankZeroInput
                      type="number"
                      step="0.001"
                      value={form.weight_grams}
                      onValueChange={(v) => setForm({ ...form, weight_grams: v })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Other fields */}
            {form.expense_type === 'other' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {OTHER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Paid To (Name)</Label>
                    <Input
                      value={form.paid_to_name}
                      onChange={(e) => setForm({ ...form, paid_to_name: e.target.value })}
                      placeholder="Vendor / person"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Amount + Payment Mode */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <BlankZeroInput
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onValueChange={(v) => setForm({ ...form, amount: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Optional contact phone (labour/other) */}
            {form.expense_type !== 'stock_purchase' && (
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input
                  value={form.paid_to_phone}
                  onChange={(e) => setForm({ ...form, paid_to_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Attachment URL (optional)</Label>
              <Input
                value={form.attachment_url}
                onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Edit reason */}
            {editing && (
              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                <Label className="text-amber-800 dark:text-amber-200">
                  Reason for Edit * <span className="text-xs font-normal">(required for audit log)</span>
                </Label>
                <Textarea
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Why is this being edited?"
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-gold">
                {editing ? 'Update Expense' : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
