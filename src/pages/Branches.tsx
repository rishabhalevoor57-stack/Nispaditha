import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch, Branch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface BranchForm {
  id?: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  gst_number: string;
  status: string;
  is_default: boolean;
}

const empty: BranchForm = {
  code: '', name: '', address: '', phone: '', email: '', gst_number: '',
  status: 'active', is_default: false,
};

const COUNT_TABLES: { table: string; label: string }[] = [
  { table: 'products', label: 'Inventory items' },
  { table: 'invoices', label: 'Invoices' },
  { table: 'clients', label: 'Customers' },
  { table: 'repair_items', label: 'Repairs' },
  { table: 'custom_orders', label: 'Custom orders' },
  { table: 'expenses', label: 'Expenses' },
  { table: 'melting_entries', label: 'Melting entries' },
];

export default function Branches() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { branches, refresh, loading } = useBranch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BranchForm>(empty);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleteCounts, setDeleteCounts] = useState<Record<string, number> | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => { setForm(empty); setDialogOpen(true); };
  const openEdit = (b: Branch) => {
    setForm({
      id: b.id, code: b.code, name: b.name, address: b.address ?? '',
      phone: b.phone ?? '', email: b.email ?? '', gst_number: b.gst_number ?? '',
      status: b.status, is_default: b.is_default,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Branch code and name are required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        gst_number: form.gst_number || null,
        status: form.status,
        is_default: form.is_default,
      };
      if (form.is_default) {
        await supabase.from('branches').update({ is_default: false })
          .neq('id', form.id ?? '00000000-0000-0000-0000-000000000000');
      }
      if (form.id) {
        const { error } = await supabase.from('branches').update(payload).eq('id', form.id);
        if (error) throw error;
        toast.success('Branch updated');
      } else {
        const { error } = await supabase.from('branches').insert(payload);
        if (error) throw error;
        toast.success('Branch created');
      }
      setDialogOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const openDelete = async (b: Branch) => {
    if (b.is_default) {
      toast.error('Main branch cannot be deleted'); return;
    }
    setDeleteTarget(b);
    setConfirmText('');
    setDeleteCounts(null);
    const counts: Record<string, number> = {};
    await Promise.all(COUNT_TABLES.map(async ({ table, label }) => {
      const { count } = await supabase.from(table as any)
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', b.id);
      counts[label] = count ?? 0;
    }));
    setDeleteCounts(counts);
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    if (confirmText !== deleteTarget.code) {
      toast.error(`Type the branch code (${deleteTarget.code}) to confirm`); return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.from('branches').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Branch deleted. Related records reassigned to Main.');
      setDeleteTarget(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary" />
            Branches
          </h1>
          <p className="text-muted-foreground mt-1">Manage all your business locations.</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" /> New Branch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{form.id ? 'Edit Branch' : 'Create Branch'}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Branch Code *</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BLR-MAIN" />
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    value={form.status}
                    disabled={form.is_default}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive (no new records)</option>
                    <option value="archived">Archived (read-only)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label>Branch Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>GST Number</Label>
                  <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
                </div>
                <div className="col-span-2 flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <Label>Default (Main) branch</Label>
                    <p className="text-xs text-muted-foreground">Main branch cannot be deleted or archived.</p>
                  </div>
                  <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>GST</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
            )}
            {!loading && branches.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No branches yet.</TableCell></TableRow>
            )}
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.code}</TableCell>
                <TableCell className="font-medium">
                  {b.name}
                  {b.is_default && <Badge variant="secondary" className="ml-2">Main</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{b.gst_number ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{b.phone ?? '—'}</TableCell>
                <TableCell>
                  <Badge
                    variant={b.status === 'active' ? 'default' : 'outline'}
                    className="capitalize"
                  >
                    {b.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)} className="gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                  )}
                  {isSuperAdmin && !b.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => openDelete(b)} className="gap-1 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" /> Delete branch {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>This branch contains:</p>
                {deleteCounts ? (
                  <ul className="list-disc pl-5 text-foreground">
                    {Object.entries(deleteCounts).map(([label, n]) => (
                      <li key={label}>{label}: <b>{n}</b></li>
                    ))}
                  </ul>
                ) : <p className="text-muted-foreground">Counting…</p>}
                <p>
                  Records assigned to this branch will be <b>unassigned</b> (linked back to Main).
                  Nothing is permanently deleted from your data. Type <code className="px-1 py-0.5 bg-muted rounded">{deleteTarget?.code}</code> to confirm.
                </p>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={deleteTarget?.code} />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              disabled={deleting || confirmText !== deleteTarget?.code}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete branch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
