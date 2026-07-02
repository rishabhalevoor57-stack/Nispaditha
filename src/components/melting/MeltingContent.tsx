import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InventoryPagination } from '@/components/inventory/InventoryPagination';
import { Plus, Search, Flame, ArrowRightCircle, Trash2, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { useMelting, type MeltingEntry } from '@/hooks/useMelting';
import { MeltingFormDialog } from '@/components/melting/MeltingFormDialog';
import { SendToInventoryDialog } from '@/components/melting/SendToInventoryDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const STATUSES = ['pending', 'sent_to_refiner', 'received', 'added_to_inventory', 'completed'];

export function MeltingContent({ showNewButton = true, consumeRouteState = true }: { showNewButton?: boolean; consumeRouteState?: boolean }) {
  const { entries, loading, create, updateStatus, remove, sendToInventory } = useMelting();
  const [open, setOpen] = useState(false);
  const [sendDlg, setSendDlg] = useState<MeltingEntry | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'entry_date' | 'melting_number' | 'gross_weight' | 'recovered_weight'>('entry_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const prefill = (location.state as { prefill?: Partial<MeltingEntry> } | null)?.prefill;
  const [autoPrefill, setAutoPrefill] = useState<Partial<MeltingEntry> | undefined>();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (consumeRouteState && prefill) {
      setAutoPrefill(prefill);
      setOpen(true);
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isTransitioning) return;
    const t = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(t);
  }, [isTransitioning]);

  const stats = useMemo(() => {
    const totalGross = entries.reduce((s, e) => s + Number(e.gross_weight || 0), 0);
    const totalFine = entries.reduce((s, e) => s + Number(e.fine_weight || 0), 0);
    const totalRecovered = entries.reduce((s, e) => s + Number(e.recovered_weight || 0), 0);
    const totalLoss = totalFine - totalRecovered;
    return { totalGross, totalFine, totalRecovered, totalLoss, count: entries.length };
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = entries.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return [e.melting_number, e.vendor_name, e.customer_name, e.description, e.inventory_sku]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
    const sorted = [...list].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'entry_date') { av = new Date(a.entry_date).getTime(); bv = new Date(b.entry_date).getTime(); }
      else if (sortKey === 'gross_weight') { av = Number(a.gross_weight || 0); bv = Number(b.gross_weight || 0); }
      else if (sortKey === 'recovered_weight') { av = Number(a.recovered_weight || 0); bv = Number(b.recovered_weight || 0); }
      else { av = a.melting_number || ''; bv = b.melting_number || ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [entries, search, statusFilter, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);




  const columns = [
    { key: 'melting_number', header: 'ID', cell: (e: MeltingEntry) => <span className="font-mono text-xs">{e.melting_number}</span> },
    { key: 'entry_date', header: 'Date', cell: (e: MeltingEntry) => format(new Date(e.entry_date), 'dd MMM yyyy') },
    { key: 'source_type', header: 'Source', cell: (e: MeltingEntry) => <Badge variant="outline" className="capitalize">{e.source_type.replace('_', ' ')}</Badge> },
    { key: 'metal_type', header: 'Metal', cell: (e: MeltingEntry) => <span className="capitalize">{e.metal_type}</span> },
    { key: 'vendor_name', header: 'Vendor', cell: (e: MeltingEntry) => e.vendor_name || '-' },
    { key: 'customer_name', header: 'Customer', cell: (e: MeltingEntry) => e.customer_name || '-' },
    { key: 'gross_weight', header: 'Gross (g)', cell: (e: MeltingEntry) => Number(e.gross_weight).toFixed(2) },
    { key: 'avg_purity', header: 'Purity %', cell: (e: MeltingEntry) => Number(e.avg_purity).toFixed(2) },
    { key: 'recovered_weight', header: 'Recovered (g)', cell: (e: MeltingEntry) => <span className="font-semibold">{Number(e.recovered_weight).toFixed(2)}</span> },
    { key: 'inventory_sku', header: 'SKU', cell: (e: MeltingEntry) => e.inventory_sku ? <span className="font-mono text-xs text-primary">{e.inventory_sku}</span> : '-' },
    {
      key: 'status', header: 'Status', cell: (e: MeltingEntry) => (
        <Select value={e.status} onValueChange={(v) => updateStatus(e.id, v)}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'actions', header: 'Actions', cell: (e: MeltingEntry) => (
        <div className="flex gap-1">
          {!e.inventory_product_id && e.recovered_weight > 0 && (
            <Button size="sm" variant="outline" onClick={() => setSendDlg(e)}>
              <ArrowRightCircle className="w-3 h-3 mr-1" /> To Inventory
            </Button>
          )}
          {isAdmin && (
            <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => { if (confirm('Delete entry?')) remove(e.id); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {showNewButton && (
        <div className="flex justify-end mb-3">
          <Button onClick={() => { setAutoPrefill(undefined); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Melting Entry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard label="Total Entries" value={stats.count.toString()} />
            <StatCard label="Gross Sent" value={`${stats.totalGross.toFixed(2)} g`} />
            <StatCard label="Fine Metal" value={`${stats.totalFine.toFixed(2)} g`} />
            <StatCard label="Loss" value={`${stats.totalLoss.toFixed(2)} g`} />
            <StatCard label="Recovered" value={`${stats.totalRecovered.toFixed(2)} g`} highlight />
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search ID, vendor, customer, SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={`${sortKey}:${sortDir}`} onValueChange={(v) => { setIsTransitioning(true); const [k, d] = v.split(':') as [typeof sortKey, 'asc' | 'desc']; setSortKey(k); setSortDir(d); }}>
          <SelectTrigger className="w-56"><ArrowUpDown className="w-3 h-3 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="entry_date:desc">Date (Newest first)</SelectItem>
            <SelectItem value="entry_date:asc">Date (Oldest first)</SelectItem>
            <SelectItem value="melting_number:desc">ID (Z → A)</SelectItem>
            <SelectItem value="melting_number:asc">ID (A → Z)</SelectItem>
            <SelectItem value="gross_weight:desc">Gross weight (High → Low)</SelectItem>
            <SelectItem value="gross_weight:asc">Gross weight (Low → High)</SelectItem>
            <SelectItem value="recovered_weight:desc">Recovered (High → Low)</SelectItem>
            <SelectItem value="recovered_weight:asc">Recovered (Low → High)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center shadow-card">
          <Flame className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium">No melting entries yet</div>
          <div className="text-sm text-muted-foreground mb-4">
            {entries.length === 0 ? 'Create your first melting entry to track refining and recovery.' : 'No entries match your filters.'}
          </div>
          {showNewButton && entries.length === 0 && (
            <Button onClick={() => { setAutoPrefill(undefined); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> New Melting Entry
            </Button>
          )}
        </div>
      ) : (
        <>
          {isTransitioning && !loading ? (
            <SkeletonTable columns={columns} />
          ) : (
            <DataTable data={paginated} columns={columns} isLoading={loading} emptyMessage="No melting entries yet." />
          )}
          <InventoryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={pageSize}
            onPageChange={(p) => { setIsTransitioning(true); setPage(p); }}
            disabled={loading || isTransitioning}
          />
        </>
      )}

      <MeltingFormDialog
        open={open}
        onOpenChange={setOpen}
        prefill={autoPrefill}
        onSubmit={async (entry, items) => { await create(entry, items); }}
      />

      {sendDlg && (
        <SendToInventoryDialog
          open={!!sendDlg}
          onOpenChange={(o) => !o && setSendDlg(null)}
          defaultName={`Refined ${sendDlg.metal_type.charAt(0).toUpperCase() + sendDlg.metal_type.slice(1)}`}
          recoveredWeight={Number(sendDlg.recovered_weight)}
          onSubmit={async (name, ppg, mc) => { await sendToInventory(sendDlg.id, name, ppg, mc); setSendDlg(null); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {highlight && <Flame className="w-3 h-3 text-primary" />} {label}
        </div>
        <div className={`text-xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
