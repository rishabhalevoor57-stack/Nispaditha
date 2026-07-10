import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CustomOrder, CustomOrderItem, CustomOrderComponent, CustomOrderStatus } from '@/types/customOrder';
import { toast } from '@/hooks/use-toast';
import { ensureClient } from '@/utils/ensureClient';
import { syncCustomOrderInvoice } from '@/utils/customOrderToInvoice';

export const useCustomOrders = () => {
  const queryClient = useQueryClient();

  const { data: customOrders = [], isLoading } = useQuery({
    queryKey: ['custom-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as CustomOrder[];
    },
  });

  const { data: metalRates = { silver: 0, gold_22k: 0, gold_18k: 0, gold_24k: 0 } } = useQuery({
    queryKey: ['metal-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('silver_rate_per_gram, gold_rate_per_gram')
        .limit(1)
        .single();
      if (error) throw error;
      const silver = Number(data?.silver_rate_per_gram) || 0;
      const gold22 = Number(data?.gold_rate_per_gram) || 0;
      return {
        silver,
        gold_22k: gold22,
        gold_18k: Number((gold22 * (18 / 22)).toFixed(2)),
        gold_24k: Number((gold22 * (24 / 22)).toFixed(2)),
      };
    },
  });
  const silverRate = metalRates.silver;

  const generateReference = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_custom_order_reference');
    if (error) throw error;
    return data;
  };

  const getOrderWithItems = async (id: string): Promise<CustomOrder & { items: CustomOrderItem[]; components: CustomOrderComponent[] }> => {
    const [orderResult, itemsResult, componentsResult] = await Promise.all([
      supabase.from('custom_orders').select('*').eq('id', id).single(),
      supabase.from('custom_order_items').select('*').eq('custom_order_id', id).order('created_at', { ascending: true }),
      (supabase.from('custom_order_components' as any).select('*').eq('custom_order_id', id).order('created_at', { ascending: true }) as any),
    ]);

    if (orderResult.error) throw orderResult.error;
    if (itemsResult.error) throw itemsResult.error;

    return {
      ...orderResult.data as unknown as CustomOrder,
      items: (itemsResult.data || []).map((item: any) => ({
        ...item,
        discount: item.discount || 0,
        discount_type: item.discount_type || 'fixed',
        discount_value: item.discount_value || 0,
      })) as CustomOrderItem[],
      components: ((componentsResult as any)?.data || []) as CustomOrderComponent[],
    };
  };

  // Lock/unlock SKUs when creating/updating orders
  const lockSkus = async (items: { product_id?: string | null }[], orderId: string) => {
    const productIds = items.filter(i => i.product_id).map(i => i.product_id!);
    if (productIds.length > 0) {
      for (const pid of productIds) {
        await (supabase.from('products').update({ locked_by_custom_order_id: orderId } as any).eq('id', pid) as any);
      }
    }
  };

  const unlockSkus = async (orderId: string) => {
    await (supabase.from('products').update({ locked_by_custom_order_id: null } as any).eq('locked_by_custom_order_id', orderId) as any);
  };

  const createOrder = useMutation({
    mutationFn: async (data: {
      order: Omit<CustomOrder, 'id' | 'created_at' | 'updated_at'>;
      items: Omit<CustomOrderItem, 'id' | 'custom_order_id' | 'created_at'>[];
      components?: Omit<CustomOrderComponent, 'id' | 'custom_order_id' | 'created_at'>[];
    }) => {
      const { data: orderData, error: orderError } = await supabase
        .from('custom_orders')
        .insert(data.order as never)
        .select()
        .single();

      if (orderError) throw orderError;

      if (data.items.length > 0) {
        const itemsWithId = data.items.map(item => ({
          ...item,
          custom_order_id: orderData.id,
        }));

        const { error: itemsError } = await supabase
          .from('custom_order_items')
          .insert(itemsWithId);

        if (itemsError) throw itemsError;
      }

      if (data.components && data.components.length > 0) {
        const componentsWithId = data.components.map(c => ({
          custom_order_id: orderData.id,
          product_id: (c as any).product_id || null,
          sku: (c as any).sku || null,
          category: (c as any).category || null,
          component_name: c.component_name,
          material: c.material || null,
          unit: (c as any).unit || 'weight_based',
          weight_grams: c.weight_grams || 0,
          quantity: c.quantity || 1,
          quantity_used: (c as any).quantity_used ?? 0,
          strings_used: (c as any).strings_used ?? 0,
          unit_price: c.unit_price || 0,
          rate_per_gram: c.rate_per_gram || 0,
          total: c.total || 0,
        }));
        const { error: compErr } = await (supabase.from('custom_order_components' as any).insert(componentsWithId) as any);
        if (compErr) throw compErr;
      }

      // Lock SKUs
      if (data.order.status !== 'released') {
        await lockSkus(data.items, orderData.id);
      }

      await ensureClient(data.order.phone_number, data.order.client_name);

      return orderData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      toast({ title: 'Custom order created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating custom order', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async (data: {
      id: string;
      order: Partial<CustomOrder>;
      items: Omit<CustomOrderItem, 'custom_order_id' | 'created_at'>[];
      components?: Omit<CustomOrderComponent, 'id' | 'custom_order_id' | 'created_at'>[];
    }) => {
      const { error: orderError } = await supabase
        .from('custom_orders')
        .update(data.order as never)
        .eq('id', data.id);

      if (orderError) throw orderError;

      // Unlock old SKUs first
      await unlockSkus(data.id);

      // Delete existing items and re-insert
      await supabase.from('custom_order_items').delete().eq('custom_order_id', data.id);

      if (data.items.length > 0) {
        const itemsWithId = data.items.map(item => ({
          product_id: item.product_id || null,
          sku: item.sku || null,
          item_description: item.item_description,
          category: item.category || null,
          customization_notes: item.customization_notes,
          reference_image_url: item.reference_image_url,
          quantity: item.quantity,
          expected_weight: item.expected_weight,
          pricing_mode: item.pricing_mode,
          flat_price: item.flat_price,
          mc_per_gram: item.mc_per_gram,
          discount_on_mc: item.discount_on_mc,
          rate_per_gram: item.rate_per_gram,
          base_price: item.base_price,
          mc_amount: item.mc_amount,
          discount: item.discount,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          item_total: item.item_total,
          custom_order_id: data.id,
        }));

        const { error: itemsError } = await supabase
          .from('custom_order_items')
          .insert(itemsWithId);

        if (itemsError) throw itemsError;
      }

      // Replace components
      await (supabase.from('custom_order_components' as any).delete().eq('custom_order_id', data.id) as any);
      if (data.components && data.components.length > 0) {
        const compsWithId = data.components.map(c => ({
          custom_order_id: data.id,
          product_id: (c as any).product_id || null,
          sku: (c as any).sku || null,
          category: (c as any).category || null,
          component_name: c.component_name,
          material: c.material || null,
          unit: (c as any).unit || 'weight_based',
          weight_grams: c.weight_grams || 0,
          quantity: c.quantity || 1,
          quantity_used: (c as any).quantity_used ?? 0,
          strings_used: (c as any).strings_used ?? 0,
          unit_price: c.unit_price || 0,
          rate_per_gram: c.rate_per_gram || 0,
          total: c.total || 0,
        }));
        const { error: compErr } = await (supabase.from('custom_order_components' as any).insert(compsWithId) as any);
        if (compErr) throw compErr;
      }

      // Lock new SKUs (unless released)
      if (data.order.status !== 'released') {
        await lockSkus(data.items, data.id);
      }

      const convertedInvoiceId = (data.order as CustomOrder).converted_to_invoice_id;
      if (convertedInvoiceId) {
        const full = await getOrderWithItems(data.id);
        await syncCustomOrderInvoice(full, full.items, full.components);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Custom order updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating custom order', description: error.message, variant: 'destructive' });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      // Unlock SKUs first
      await unlockSkus(id);
      const { error } = await supabase.from('custom_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      toast({ title: 'Custom order deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting custom order', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CustomOrderStatus }) => {
      const { error } = await supabase
        .from('custom_orders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // If released, unlock all SKUs
      if (status === 'released') {
        await unlockSkus(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      toast({ title: 'Status updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    },
  });

  return {
    customOrders,
    isLoading,
    silverRate,
    generateReference,
    getOrderWithItems,
    createOrder,
    updateOrder,
    deleteOrder,
    updateStatus,
  };
};
