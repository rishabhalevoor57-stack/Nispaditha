
-- Custom Orders table
CREATE TABLE public.custom_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_number TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    phone_number TEXT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    status TEXT NOT NULL DEFAULT 'order_noted',
    design_charges NUMERIC NOT NULL DEFAULT 0,
    additional_charge NUMERIC NOT NULL DEFAULT 0,
    additional_charge_label TEXT DEFAULT 'Additional Charge',
    total_amount NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    converted_to_invoice_id UUID REFERENCES public.invoices(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Custom Order Items table
CREATE TABLE public.custom_order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    custom_order_id UUID NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    customization_notes TEXT,
    reference_image_url TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    expected_weight NUMERIC DEFAULT 0,
    pricing_mode TEXT NOT NULL DEFAULT 'weight_based',
    flat_price NUMERIC DEFAULT 0,
    mc_per_gram NUMERIC DEFAULT 0,
    discount_on_mc NUMERIC DEFAULT 0,
    rate_per_gram NUMERIC DEFAULT 0,
    base_price NUMERIC NOT NULL DEFAULT 0,
    mc_amount NUMERIC NOT NULL DEFAULT 0,
    item_total NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view custom orders"
    ON public.custom_orders FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert custom orders"
    ON public.custom_orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update custom orders"
    ON public.custom_orders FOR UPDATE USING (true);

CREATE POLICY "Admins can delete custom orders"
    ON public.custom_orders FOR DELETE USING (is_admin());

CREATE POLICY "Authenticated users can manage custom order items"
    ON public.custom_order_items FOR ALL USING (true) WITH CHECK (true);

-- Auto-generate reference number
CREATE OR REPLACE FUNCTION public.generate_custom_order_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    next_num INTEGER;
    order_ref TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM 4) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.custom_orders
    WHERE reference_number LIKE 'CO-%';
    
    order_ref := 'CO-' || LPAD(next_num::TEXT, 6, '0');
    RETURN order_ref;
END;
$$;

-- Updated at trigger
CREATE TRIGGER update_custom_orders_updated_at
    BEFORE UPDATE ON public.custom_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
