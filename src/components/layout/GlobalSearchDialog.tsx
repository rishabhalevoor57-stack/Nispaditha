import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  FileText,
  Users,
  Hammer,
  Wrench,
  IndianRupee,
  Truck,
  Settings,
} from 'lucide-react';

type Hit = {
  id: string;
  type: 'Inventory' | 'Invoice' | 'Customer' | 'Custom Order' | 'Service' | 'Pending Payment' | 'Vendor' | 'Repair';
  title: string;
  subtitle?: string;
  route: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ICONS: Record<Hit['type'], React.ComponentType<{ className?: string }>> = {
  Inventory: Package,
  Invoice: FileText,
  Customer: Users,
  'Custom Order': Hammer,
  Service: Wrench,
  'Pending Payment': IndianRupee,
};

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const reqIdRef = useRef(0);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setHits([]);
      return;
    }
    const myId = ++reqIdRef.current;
    setLoading(true);
    const q = debounced;
    const ilike = `%${q}%`;

    Promise.all([
      supabase
        .from('products')
        .select('id, sku, name, categories(name)')
        .is('deleted_at', null)
        .or(`sku.ilike.${ilike},name.ilike.${ilike},description.ilike.${ilike}`)
        .limit(8),
      supabase
        .from('invoices')
        .select('id, invoice_number, grand_total, clients(name, phone), payment_status')
        .or(`invoice_number.ilike.${ilike},notes.ilike.${ilike}`)
        .order('invoice_date', { ascending: false })
        .limit(8),
      supabase
        .from('clients')
        .select('id, name, phone')
        .or(`name.ilike.${ilike},phone.ilike.${ilike}`)
        .limit(8),
      supabase
        .from('custom_orders')
        .select('id, reference_number, client_name, phone_number')
        .or(`reference_number.ilike.${ilike},client_name.ilike.${ilike},phone_number.ilike.${ilike},notes.ilike.${ilike}`)
        .limit(8),
      supabase
        .from('service_forms')
        .select('id, receipt_number, client_name, client_phone')
        .or(`receipt_number.ilike.${ilike},client_name.ilike.${ilike},client_phone.ilike.${ilike}`)
        .limit(8),
    ])
      .then(([prod, inv, cli, co, sv]) => {
        if (myId !== reqIdRef.current) return;
        const next: Hit[] = [];

        (prod.data || []).forEach((p: any) => {
          next.push({
            id: `prod-${p.id}`,
            type: 'Inventory',
            title: `${p.sku || ''} — ${p.name || ''}`,
            subtitle: p.categories?.name || undefined,
            route: `/inventory?search=${encodeURIComponent(p.sku || p.name || '')}`,
          });
        });
        (inv.data || []).forEach((i: any) => {
          next.push({
            id: `inv-${i.id}`,
            type: 'Invoice',
            title: i.invoice_number,
            subtitle: `${i.clients?.name || 'Walk-in'} · ₹${Number(i.grand_total || 0).toFixed(0)}${i.payment_status !== 'paid' ? ' · ' + i.payment_status : ''}`,
            route: `/invoices?search=${encodeURIComponent(i.invoice_number)}`,
          });
          if (i.payment_status && i.payment_status !== 'paid') {
            next.push({
              id: `pay-${i.id}`,
              type: 'Pending Payment',
              title: i.invoice_number,
              subtitle: i.clients?.name || 'Walk-in',
              route: `/pending-payments?search=${encodeURIComponent(i.invoice_number)}`,
            });
          }
        });
        (cli.data || []).forEach((c: any) => {
          next.push({
            id: `cli-${c.id}`,
            type: 'Customer',
            title: c.name,
            subtitle: c.phone || undefined,
            route: `/clients?search=${encodeURIComponent(c.name || c.phone || '')}`,
          });
        });
        (co.data || []).forEach((o: any) => {
          next.push({
            id: `co-${o.id}`,
            type: 'Custom Order',
            title: o.reference_number,
            subtitle: o.client_name || o.phone_number || undefined,
            route: `/custom-orders?search=${encodeURIComponent(o.reference_number)}`,
          });
        });
        (sv.data || []).forEach((s: any) => {
          next.push({
            id: `sv-${s.id}`,
            type: 'Service',
            title: s.receipt_number,
            subtitle: s.client_name || s.client_phone || undefined,
            route: `/service-forms?search=${encodeURIComponent(s.receipt_number)}`,
          });
        });
        setHits(next);
      })
      .finally(() => {
        if (myId === reqIdRef.current) setLoading(false);
      });
  }, [debounced]);

  const grouped = useMemo(() => {
    const g = new Map<Hit['type'], Hit[]>();
    hits.forEach((h) => {
      if (!g.has(h.type)) g.set(h.type, []);
      g.get(h.type)!.push(h);
    });
    return Array.from(g.entries());
  }, [hits]);

  const goto = (h: Hit) => {
    onOpenChange(false);
    navigate(h.route);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search SKU, invoice, customer, custom order, service…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {debounced.length >= 2 && hits.length === 0 && !loading && (
          <CommandEmpty>No matching records found.</CommandEmpty>
        )}
        {debounced.length < 2 && (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            Type at least 2 characters to search across all modules.
          </div>
        )}
        {loading && (
          <div className="px-4 py-3 text-xs text-muted-foreground">Searching…</div>
        )}
        {grouped.map(([type, list], idx) => {
          const Icon = ICONS[type];
          return (
            <div key={type}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={type}>
                {list.map((h) => (
                  <CommandItem
                    key={h.id}
                    value={`${type}-${h.id}-${h.title}-${h.subtitle || ''}`}
                    onSelect={() => goto(h)}
                    className="flex items-center gap-3"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{h.title}</p>
                      {h.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{h.subtitle}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-auto text-[10px] uppercase">
                      {type}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
