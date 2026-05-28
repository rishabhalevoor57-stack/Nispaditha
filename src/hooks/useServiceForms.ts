import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceForm, ServiceFormStatus } from '@/types/serviceForm';
import { toast } from '@/hooks/use-toast';
import { ensureClient } from '@/utils/ensureClient';

const db = () => supabase.from('service_forms' as any) as any;

export const useServiceForms = () => {
  const queryClient = useQueryClient();

  const { data: serviceForms = [], isLoading } = useQuery({
    queryKey: ['service-forms'],
    queryFn: async () => {
      const { data, error } = await db().select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ServiceForm[];
    },
  });

  const generateReceiptNumber = async (): Promise<string> => {
    const { data, error } = await (supabase.rpc as any)('generate_service_receipt_number');
    if (error) throw error;
    return data as string;
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('service-form-images').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('service-form-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getById = async (id: string): Promise<ServiceForm> => {
    const { data, error } = await db().select('*').eq('id', id).single();
    if (error) throw error;
    return data as ServiceForm;
  };

  const createServiceForm = useMutation({
    mutationFn: async (payload: Omit<ServiceForm, 'id' | 'created_at' | 'updated_at' | 'receipt_number' | 'final_cost' | 'completed_invoice_id' | 'completed_at'> & { photoFile?: File | null }) => {
      const receipt_number = await generateReceiptNumber();
      let photo_url = payload.photo_url || null;
      if (payload.photoFile) {
        photo_url = await uploadPhoto(payload.photoFile);
      }
      const { photoFile, ...rest } = payload as any;
      const row = { ...rest, receipt_number, photo_url };
      const { data, error } = await db().insert(row).select().single();
      if (error) throw error;

      // Ensure client exists
      if (payload.client_phone) {
        await ensureClient(payload.client_phone, payload.client_name);
      }
      return data as ServiceForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-forms'] });
      toast({ title: 'Service receipt created' });
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to create service receipt', description: e.message, variant: 'destructive' });
    },
  });

  const updateServiceForm = useMutation({
    mutationFn: async ({ id, patch, photoFile }: { id: string; patch: Partial<ServiceForm>; photoFile?: File | null }) => {
      const update: any = { ...patch };
      if (photoFile) {
        update.photo_url = await uploadPhoto(photoFile);
      }
      const { error } = await db().update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-forms'] });
      toast({ title: 'Service form updated' });
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to update service form', description: e.message, variant: 'destructive' });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ServiceFormStatus }) => {
      const { error } = await db().update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-forms'] });
      toast({ title: 'Status updated' });
    },
  });

  const deleteServiceForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-forms'] });
      toast({ title: 'Service form deleted' });
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    },
  });

  return {
    serviceForms,
    isLoading,
    generateReceiptNumber,
    getById,
    createServiceForm,
    updateServiceForm,
    updateStatus,
    deleteServiceForm,
  };
};
