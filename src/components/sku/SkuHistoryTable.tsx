import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Download, RefreshCw, Search, FileSpreadsheet } from 'lucide-react';
import { STATUS_COLORS, STATUS_LABELS } from '@/utils/skuCodes';
import { printSkuLabels } from '@/utils/skuLabelPdf';
import { exportToExcel, exportToPDF } from '@/utils/reportExport';
import type { SkuRegistryRow } from '@/hooks/useSkuRegistry';
import { format } from 'date-fns';

interface Props {
  rows: SkuRegistryRow[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function SkuHistoryTable({ rows, isLoading, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!s) return true;
      return (
        r.sku.toLowerCase().includes(s) ||
        (r.vendor_name || '').toLowerCase().includes(s) ||
        (r.category_name || '').toLowerCase().includes(s) ||
        (r.type_of_work_name || '').toLowerCase().includes(s) ||
        r.prefix.toLowerCase().includes(s)
      );
    });
  }, [rows, search, status]);

  const selectedRows = useMemo(() => filtered.filter((r) => selected.has(r.sku)), [filtered, selected]);
  const targetRows = selectedRows.length ? selectedRows : filtered;

  const toggle = (sku: string) => {
    const next = new Set(selected);
    next.has(sku) ? next.delete(sku) : next.add(sku);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.sku)));
  };

  const exportExcel = () => {
    const data = targetRows.map((r) => ({
      SKU: r.sku,
      Vendor: r.vendor_name || '',
      Category: r.category_name || '',
      'Type of Work': r.type_of_work_name || '',
      Status: STATUS_LABELS[r.status] || r.status,
      'Created At': format(new Date(r.created_at), 'dd MMM yyyy HH:mm'),
    }));
    exportToExcel(data, `SKUs_${Date.now()}`);
  };

  const exportPDF = () => {
    exportToPDF('SKU Registry', [
      { header: 'SKU', key: 'SKU' },
      { header: 'Vendor', key: 'Vendor' },
      { header: 'Category', key: 'Category' },
      { header: 'Type of Work', key: 'Work' },
      { header: 'Status', key: 'Status' },
      { header: 'Created', key: 'Created' },
    ], targetRows.map((r) => ({
      SKU: r.sku,
      Vendor: r.vendor_name || '-',
      Category: r.category_name || '-',
      Work: r.type_of_work_name || '-',
      Status: STATUS_LABELS[r.status] || r.status,
      Created: format(new Date(r.created_at), 'dd MMM yyyy'),
    })), `SKUs_${Date.now()}`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search SKU, vendor, category…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onRefresh}><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={() => printSkuLabels(targetRows)} disabled={!targetRows.length}>
            <Printer className="w-4 h-4 mr-1" /> Labels ({targetRows.length})
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={!targetRows.length}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" onClick={exportPDF} disabled={!targetRows.length}>
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type of Work</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No SKUs found.</TableCell></TableRow>
            ) : (
              filtered.slice(0, 500).map((r) => (
                <TableRow key={r.sku}>
                  <TableCell><Checkbox checked={selected.has(r.sku)} onCheckedChange={() => toggle(r.sku)} /></TableCell>
                  <TableCell className="font-mono font-semibold">{r.sku}</TableCell>
                  <TableCell>{r.vendor_name || '—'}</TableCell>
                  <TableCell>{r.category_name || '—'}</TableCell>
                  <TableCell>{r.type_of_work_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[r.status]}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filtered.length > 500 && (
          <div className="p-3 text-xs text-muted-foreground text-center border-t">
            Showing first 500 of {filtered.length}. Use search/filter to narrow.
          </div>
        )}
      </Card>
    </div>
  );
}
