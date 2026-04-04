import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CustomOrder, CustomOrderItem, CustomOrderStatus } from '@/types/customOrder';
import { toast } from '@/hooks/use-toast';

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

  const { data: silverRate = 0 } = useQuery({
    queryKey: ['silver-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('silver_rate_per_gram')
        .limit(1)
        .single();

      if (error) throw error;
      return data?.silver_rate_per_gram || 0;
    },
  });

  const generateReference = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_custom_order_reference');
    if (error) throw error;
    return data;
  };

  const getOrderWithItems = async (id: string): Promise<CustomOrder & { items: CustomOrderItem[] }> => {
    const [orderResult, itemsResult] = await Promise.all([
      supabase.from('custom_orders').select('*').eq('id', id).single(),
      supabase.from('custom_order_items').select('*').eq('custom_order_id', id).order('created_at', { ascending: true }),
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
    }) => {
      const { data: orderData, error: orderError } = await supabase
        .from('custom_orders')
        .insert(data.order)
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

      // Lock SKUs
      if (data.order.status !== 'released') {
        await lockSkus(data.items, orderData.id);
      }

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
    }) => {
      const { error: orderError } = await supabase
        .from('custom_orders')
        .update(data.order)
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

      // Lock new SKUs (unless released)
      if (data.order.status !== 'released') {
        await lockSkus(data.items, data.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
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
