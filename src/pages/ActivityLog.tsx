import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, History } from 'lucide-react';
import { format } from 'date-fns';
import { useActivityLogs, type ActivityLog } from '@/hooks/useActivityLog';

const MODULE_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'client', label: 'Clients' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'order_note', label: 'Order Notes' },
  { value: 'category', label: 'Categories' },
  { value: 'type_of_work', label: 'Type of Work' },
  { value: 'settings', label: 'Settings' },
  { value: 'payment', label: 'Payments' },
];

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
];

const getActionBadge = (action: string) => {
  const variants: Record<string, string> = {
    create: 'bg-success/10 text-success border-success/20',
    update: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    delete: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return (
    <Badge variant="outline" className={variants[action] || ''}>
      {action.charAt(0).toUpperCase() + action.slice(1)}
    </Badge>
  );
};

const getModuleLabel = (module: string) => {
  const found = MODULE_OPTIONS.find(m => m.value === module);
  return found?.label || module;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function ActivityDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: ActivityLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  const oldKeys = log.old_value ? Object.keys(log.old_value) : [];
  const newKeys = log.new_value ? Object.keys(log.new_value) : [];
  const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Activity Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-4">
            {/* Meta Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 rounded-lg p-4">
              <div>
                <p className="text-muted-foreground">Date & Time</p>
                <p className="font-medium">{format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Module</p>
                <p className="font-medium">{getModuleLabel(log.module)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Action</p>
                <div className="mt-0.5">{getActionBadge(log.action)}</div>
              </div>
              <div>
                <p className="text-muted-foreground">Admin</p>
                <p className="font-medium">{log.user_name || '-'}</p>
              </div>
            </div>

            {log.record_label && (
              <div className="text-sm bg-muted/30 rounded-lg p-4">
                <p className="text-muted-foreground">Record</p>
                <p className="font-medium">{log.record_label}</p>
              </div>
            )}

            {/* Old vs New comparison */}
            {allKeys.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium w-1/4">Field</th>
                      <th className="px-4 py-3 text-left font-medium w-[37.5%]">Old Value</th>
                      <th className="px-4 py-3 text-left font-medium w-[37.5%]">New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allKeys.map((key) => {
                      const oldVal = log.old_value?.[key];
                      const newVal = log.new_value?.[key];
                      const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                      return (
                        <tr key={key} className={`border-t ${changed ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{key}</td>
                          <td className="px-4 py-2 break-all text-xs">
                            <pre className="whitespace-pre-wrap">{formatValue(oldVal)}</pre>
                          </td>
                          <td className="px-4 py-2 break-all text-xs">
                            <pre className="whitespace-pre-wrap">{formatValue(newVal)}</pre>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {allKeys.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                No detailed data available for this activity.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function ActivityLogPage() {
  const { logs, isLoading, filters, setFilters, adminNames } = useActivityLogs();
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <AppLayout>
      <PageHeader
        title="Activity Log"
        description="Audit trail of all system changes"
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Select value={filters.module} onValueChange={(v) => setFilters({ ...filters, module: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            {MODULE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          placeholder="From date"
        />

        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          placeholder="To date"
        />

        <Select value={filters.admin} onValueChange={(v) => setFilters({ ...filters, admin: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Admin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Admins</SelectItem>
            {adminNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Date & Time</th>
              <th className="px-4 py-3 text-left font-medium">Module</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Record</th>
              <th className="px-4 py-3 text-left font-medium">Admin</th>
              <th className="px-4 py-3 text-center font-medium w-24">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Loading activity logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No activity logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs">
                    {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">
                      {getModuleLabel(log.module)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                    {log.record_label || log.record_id || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs">{log.user_name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedLog(log);
                        setDetailOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ActivityDetailDialog
        log={selectedLog}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </AppLayout>
  );
}
