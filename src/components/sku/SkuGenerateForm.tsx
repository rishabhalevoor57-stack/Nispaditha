import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { deriveCategoryCode, deriveTypeOfWorkCode, deriveVendorCode } from '@/utils/skuCodes';
import { Loader2, Printer, Sparkles } from 'lucide-react';
import { printSkuLabels } from '@/utils/skuLabelPdf';
import type { SkuRegistryRow } from '@/hooks/useSkuRegistry';

interface Lookup { id: string; name: string; code?: string | null; vendor_code?: string | null }

interface Props {
  onGenerate: (args: {
    type_of_work_id: string | null;
    vendor_id: string | null;
    category_id: string | null;
    type_of_work_code: string;
    vendor_code: string;
    category_code: string;
    quantity: number;
    start_number?: number | null;
  }) => Promise<SkuRegistryRow[]>;
  lastGenerated: SkuRegistryRow[];
}

export function SkuGenerateForm({ onGenerate, lastGenerated }: Props) {
  const { toast } = useToast();
  const [works, setWorks] = useState<Lookup[]>([]);
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [cats, setCats] = useState<Lookup[]>([]);
  const [workId, setWorkId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [catId, setCatId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [startNumber, setStartNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [nextNumber, setNextNumber] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [w, v, c] = await Promise.all([
        supabase.from('types_of_work').select('id,name,code').order('name'),
        supabase.from('suppliers').select('id,name,vendor_code').order('name'),
        supabase.from('categories').select('id,name,code').order('name'),
      ]);
      setWorks((w.data || []) as any);
      setVendors((v.data || []) as any);
      setCats((c.data || []) as any);
    })();
  }, []);

  const selectedWork = works.find((w) => w.id === workId);
  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const selectedCat = cats.find((c) => c.id === catId);

  const codes = useMemo(() => {
    const tw = selectedWork ? deriveTypeOfWorkCode(selectedWork.name, selectedWork.code) : '';
    const vc = selectedVendor ? deriveVendorCode(selectedVendor.name, selectedVendor.vendor_code) : '';
    const cc = selectedCat ? deriveCategoryCode(selectedCat.name, selectedCat.code) : '';
    return { tw, vc, cc, prefix: tw + vc + cc };
  }, [selectedWork, selectedVendor, selectedCat]);

  useEffect(() => {
    if (!codes.prefix) { setNextNumber(null); return; }
    (async () => {
      const { data } = await supabase
        .from('sku_registry' as any)
        .select('running_number')
        .eq('prefix', codes.prefix)
        .order('running_number', { ascending: false })
        .limit(1);
      const max = (data && data[0] && (data[0] as any).running_number) || 0;
      setNextNumber(max + 1);
    })();
  }, [codes.prefix]);

  const canGenerate = workId && vendorId && catId && quantity > 0 && quantity <= 1000;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setSubmitting(true);
    try {
      const created = await onGenerate({
        type_of_work_id: workId, vendor_id: vendorId, category_id: catId,
        type_of_work_code: codes.tw, vendor_code: codes.vc, category_code: codes.cc,
        quantity,
      });
      toast({ title: `Generated ${created.length} SKU${created.length === 1 ? '' : 's'}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Generation failed', description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> New SKUs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Type of Work *</Label>
              <Select value={workId} onValueChange={setWorkId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {works.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor *</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={catId} onValueChange={setCatId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Quantity to Generate *</Label>
              <Input type="number" min={1} max={1000} value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(1000, parseInt(e.target.value || '1'))))} />
              <div className="flex gap-2 mt-2 flex-wrap">
                {[1, 5, 10, 50, 100].map((q) => (
                  <Button key={q} type="button" variant="outline" size="sm" onClick={() => setQuantity(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Preview</Label>
              <div className="h-10 rounded-md border bg-muted/30 flex items-center px-3 font-mono text-sm">
                {codes.prefix ? (
                  <>
                    <span className="font-bold">{codes.prefix}</span>
                    <span className="text-muted-foreground ml-1">
                      {nextNumber ?? '…'}{quantity > 1 ? ` … ${codes.prefix}${(nextNumber || 1) + quantity - 1}` : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Pick work, vendor, category</span>
                )}
              </div>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={!canGenerate || submitting} className="w-full md:w-auto">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generate {quantity} SKU{quantity === 1 ? '' : 's'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Just generated</CardTitle>
          {lastGenerated.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => printSkuLabels(lastGenerated)}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {lastGenerated.length === 0 ? (
            <p className="text-sm text-muted-foreground">Generated SKUs will appear here.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-auto">
              {lastGenerated.map((r) => (
                <div key={r.sku} className="flex items-center justify-between text-sm font-mono">
                  <span>{r.sku}</span>
                  <Badge variant="outline" className="text-xs">new</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
