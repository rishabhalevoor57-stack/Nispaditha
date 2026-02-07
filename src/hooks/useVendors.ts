import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/useActivityLog';

export interface Vendor {
  id: string;
  vendor_code: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  notes: string | null;
  total_purchases: number;
  total_paid: number;
  outstanding_balance: number;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorFormData {
  vendor_code: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
}

export interface VendorPayment {
  id: string;
  supplier_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  notes: string | null;
  created_at: string;
}

export interface VendorPaymentFormData {
  amount: number;
  payment_date: string;
  payment_mode: string;
  notes: string;
}

export const initialVendorForm: VendorFormData = {
  vendor_code: '',
  name: '',
  phone: '',
  address: '',
  notes: '',
};

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw error;
      setVendors((data || []) as Vendor[]);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({ variant: 'destructive', title: 'Error loading vendors' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVendors = useMemo(() => {
    if (!searchTerm) return vendors;
    const term = searchTerm.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(term) ||
        v.phone?.includes(term) ||
        v.vendor_code?.toLowerCase().includes(term)
    );
  }, [vendors, searchTerm]);

  const createVendor = async (formData: VendorFormData) => {
    try {
      const { data, error } = await supabase.from('suppliers').insert([{
        vendor_code: formData.vendor_code || null,
        name: formData.name,
        phone: formData.phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
      }]).select().single();
      if (error) throw error;
      logActivity({ module: 'vendor', action: 'create', recordId: data?.id, recordLabel: formData.name, newValue: { vendor_code: formData.vendor_code, name: formData.name } });
      toast({ title: 'Vendor added successfully' });
      fetchVendors();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: msg });
      return false;
    }
  };

  const updateVendor = async (id: string, formData: VendorFormData) => {
    try {
      const oldVendor = vendors.find(v => v.id === id);
      const { error } = await supabase
        .from('suppliers')
        .update({
          vendor_code: formData.vendor_code || null,
          name: formData.name,
          phone: formData.phone || null,
          address: formData.address || null,
          notes: formData.notes || null,
        })
        .eq('id', id);
      if (error) throw error;
      logActivity({ module: 'vendor', action: 'update', recordId: id, recordLabel: formData.name, oldValue: oldVendor ? { name: oldVendor.name, vendor_code: oldVendor.vendor_code } : null, newValue: { name: formData.name, vendor_code: formData.vendor_code } });
      toast({ title: 'Vendor updated successfully' });
      fetchVendors();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: msg });
      return false;
    }
  };

  const deleteVendor = async (id: string) => {
    try {
      // Check for linked products
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', id);

      if (count && count > 0) {
        toast({
          variant: 'destructive',
          title: 'Cannot delete',
          description: `This vendor has ${count} product(s) linked. Reassign them first.`,
        });
        return false;
      }

      const oldVendor = vendors.find(v => v.id === id);
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      logActivity({ module: 'vendor', action: 'delete', recordId: id, recordLabel: oldVendor?.name || id, oldValue: oldVendor ? { name: oldVendor.name, vendor_code: oldVendor.vendor_code } : null });
      toast({ title: 'Vendor deleted' });
      fetchVendors();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: msg });
      return false;
    }
  };

  // Vendor payments
  const fetchVendorPayments = async (vendorId: string) => {
    const { data, error } = await supabase
      .from('vendor_payments')
      .select('*')
      .eq('supplier_id', vendorId)
      .order('payment_date', { ascending: false });
    if (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
    return (data || []) as VendorPayment[];
  };

  const addVendorPayment = async (vendorId: string, formData: VendorPaymentFormData) => {
    try {
      const { error } = await supabase.from('vendor_payments').insert([{
        supplier_id: vendorId,
        amount: formData.amount,
        payment_date: formData.payment_date,
        payment_mode: formData.payment_mode,
        notes: formData.notes || null,
      }]);
      if (error) throw error;

      // Update vendor totals
      const vendor = vendors.find((v) => v.id === vendorId);
      if (vendor) {
        const newTotalPaid = vendor.total_paid + formData.amount;
        const newOutstanding = vendor.total_purchases - newTotalPaid;
        await supabase
          .from('suppliers')
          .update({
            total_paid: newTotalPaid,
            outstanding_balance: Math.max(0, newOutstanding),
          })
          .eq('id', vendorId);
      }

      const payVendor = vendors.find((v) => v.id === vendorId);
      logActivity({ module: 'payment', action: 'create', recordId: vendorId, recordLabel: `Payment to ${payVendor?.name || 'vendor'}`, newValue: { amount: formData.amount, payment_mode: formData.payment_mode } });
      toast({ title: 'Payment recorded successfully' });
      fetchVendors();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: msg });
      return false;
    }
  };

  // Fetch products linked to a vendor
  const fetchVendorProducts = async (vendorId: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, purchase_price, quantity, created_at, categories(name)')
      .eq('supplier_id', vendorId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching vendor products:', error);
      return [];
    }
    return data || [];
  };

  return {
    vendors: filteredVendors,
    allVendors: vendors,
    isLoading,
    searchTerm,
    setSearchTerm,
    createVendor,
    updateVendor,
    deleteVendor,
    fetchVendorPayments,
    addVendorPayment,
    fetchVendorProducts,
    refresh: fetchVendors,
  };
}
