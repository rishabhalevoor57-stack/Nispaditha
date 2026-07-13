import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceForms } from '@/hooks/useServiceForms';
import { ClientSearchBox } from '@/components/invoice/ClientSearchBox';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_TYPE_OPTIONS, ServiceForm } from '@/types/serviceForm';
import { downloadServiceReceipt } from '@/utils/serviceReceiptPdf';
import { MetalTypeSelect } from '@/components/shared/MetalTypeSelect';
import { MetalType } from '@/lib/metalTypes';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  serviceForm?: ServiceForm | null;
}

export const ServiceFormDialog = ({ open, onOpenChange, serviceForm }: Props) => {
  const { user } = useAuth();
  const { createServiceForm, updateServiceForm } = useServiceForms();
  const isEdit = !!serviceForm;

  const [clients, setClients] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const [itemDescription, setItemDescription] = useState('');
  const [fromOurShop, setFromOurShop] = useState(false);
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState('');
  const [material, setMaterial] = useState('Silver');
  const [metalType, setMetalType] = useState<MetalType>('silver');
  const [weight, setWeight] = useState<number>(0);
  const [condition, setCondition] = useState('Good');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [otherServiceText, setOtherServiceText] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState<Date | undefined>();
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('clients').select('id, name, phone').order('name').then(({ data }) => {
      setClients((data || []) as any);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (serviceForm) {
      setClientId(serviceForm.client_id);
      setClientName(serviceForm.client_name);
      setClientPhone(serviceForm.client_phone || '');
      setItemDescription(serviceForm.item_description);
      setFromOurShop(serviceForm.from_our_shop);
      setOriginalInvoiceNo(serviceForm.original_invoice_no || '');
      setMaterial(serviceForm.material || 'Silver');
      setWeight(serviceForm.weight_grams || 0);
      setCondition(serviceForm.condition_on_receipt || 'Good');
      setServiceTypes(serviceForm.service_types || []);
      setOtherServiceText(serviceForm.other_service_text || '');
      setServiceNotes(serviceForm.service_notes || '');
      setEstimatedDelivery(serviceForm.estimated_delivery_date ? new Date(serviceForm.estimated_delivery_date) : undefined);
      setEstimatedCost(serviceForm.estimated_cost || 0);
    } else {
      setClientId(null); setClientName(''); setClientPhone('');
      setItemDescription(''); setFromOurShop(false); setOriginalInvoiceNo('');
      setMaterial('Silver'); setWeight(0); setCondition('Good'); setPhotoFile(null);
      setServiceTypes([]); setOtherServiceText(''); setServiceNotes('');
      setEstimatedDelivery(undefined); setEstimatedCost(0);
    }
  }, [open, serviceForm]);

  const toggleServiceType = (s: string) => {
    setServiceTypes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSubmit = async () => {
    if (!clientName.trim() || !clientPhone.trim() || !itemDescription.trim()) return;
    setLoading(true);
    try {
      if (isEdit && serviceForm) {
        await updateServiceForm.mutateAsync({
          id: serviceForm.id,
          patch: {
            client_id: clientId,
            client_name: clientName,
            client_phone: clientPhone,
            item_description: itemDescription,
            from_our_shop: fromOurShop,
            original_invoice_no: originalInvoiceNo || null,
            material,
            weight_grams: weight,
            condition_on_receipt: condition,
            service_types: serviceTypes,
            other_service_text: otherServiceText || null,
            service_notes: serviceNotes || null,
            estimated_delivery_date: estimatedDelivery ? format(estimatedDelivery, 'yyyy-MM-dd') : null,
            estimated_cost: estimatedCost,
          },
          photoFile,
        });
        onOpenChange(false);
      } else {
        const created = await createServiceForm.mutateAsync({
          client_id: clientId,
          client_name: clientName,
          client_phone: clientPhone,
          item_description: itemDescription,
          from_our_shop: fromOurShop,
          original_invoice_no: originalInvoiceNo || null,
          material,
          weight_grams: weight,
          condition_on_receipt: condition,
          photo_url: null,
          service_types: serviceTypes,
          other_service_text: otherServiceText || null,
          service_notes: serviceNotes || null,
          estimated_delivery_date: estimatedDelivery ? format(estimatedDelivery, 'yyyy-MM-dd') : null,
          estimated_cost: estimatedCost,
          status: 'received',
          created_by: user?.id || null,
          photoFile,
        } as any);
        // Auto download receipt
        if (created) downloadServiceReceipt(created);
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Service Form ${serviceForm?.receipt_number}` : 'New Service Form'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Client</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ClientSearchBox
                clients={clients}
                onSelect={(c) => { setClientId(c.id); setClientName(c.name); setClientPhone(c.phone || ''); }}
                onWalkIn={() => { setClientId(null); setClientName(''); setClientPhone(''); }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name *</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                <div className="space-y-1"><Label>Phone *</Label><Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Jewellery */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Jewellery Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1"><Label>Item Name / Description *</Label><Input value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="Gold Necklace, Silver Anklet..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Item Source</Label>
                  <Select value={fromOurShop ? 'nispaditha' : 'other'} onValueChange={(v) => setFromOurShop(v === 'nispaditha')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nispaditha">From Nispaditha</SelectItem>
                      <SelectItem value="other">From Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {fromOurShop && (
                  <div className="space-y-1"><Label>Original Invoice No</Label><Input value={originalInvoiceNo} onChange={(e) => setOriginalInvoiceNo(e.target.value)} /></div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Material</Label>
                  <Select value={material} onValueChange={setMaterial}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Brass">Brass</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Weight (g)</Label><Input type="number" step="0.001" value={weight || ''} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} /></div>
                <div className="space-y-1">
                  <Label>Condition</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Minor damage">Minor damage</SelectItem>
                      <SelectItem value="Heavy damage">Heavy damage</SelectItem>
                      <SelectItem value="Broken">Broken</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Photo (optional)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Service Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SERVICE_TYPE_OPTIONS.map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={serviceTypes.includes(s)} onCheckedChange={() => toggleServiceType(s)} />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label>Other (specify)</Label>
                <Input value={otherServiceText} onChange={(e) => setOtherServiceText(e.target.value)} placeholder="Other service..." />
              </div>
              <div className="space-y-1">
                <Label>Service Notes</Label>
                <Textarea value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} placeholder="Specific instructions..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Estimated Delivery Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !estimatedDelivery && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {estimatedDelivery ? format(estimatedDelivery, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={estimatedDelivery} onSelect={setEstimatedDelivery} /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1"><Label>Estimated Cost (₹)</Label><Input type="number" value={estimatedCost || ''} onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)} /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !clientName.trim() || !clientPhone.trim() || !itemDescription.trim()}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create & Print Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
