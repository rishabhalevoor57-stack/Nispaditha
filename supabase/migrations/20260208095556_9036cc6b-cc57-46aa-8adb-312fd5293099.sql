
-- =============================================
-- 1. STORES TABLE
-- =============================================
CREATE TABLE public.stores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stores"
    ON public.stores FOR SELECT USING (true);

CREATE POLICY "Admins can manage stores"
    ON public.stores FOR ALL USING (is_admin());

CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON public.stores
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. PRODUCT STORE QUANTITIES (junction table)
-- =============================================
CREATE TABLE public.product_store_quantities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(product_id, store_id)
);

ALTER TABLE public.product_store_quantities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product store quantities"
    ON public.product_store_quantities FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_product_store_quantities_updated_at
    BEFORE UPDATE ON public.product_store_quantities
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. STOCK TRANSFERS TABLE
-- =============================================
CREATE TABLE public.stock_transfers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    from_store_id UUID NOT NULL REFERENCES public.stores(id),
    to_store_id UUID NOT NULL REFERENCES public.stores(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT,
    transferred_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock transfers"
    ON public.stock_transfers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create stock transfers"
    ON public.stock_transfers FOR INSERT WITH CHECK (true);

-- =============================================
-- 4. ADD store_id TO INVOICES
-- =============================================
ALTER TABLE public.invoices
    ADD COLUMN store_id UUID REFERENCES public.stores(id);

-- =============================================
-- 5. ADD store_id TO RETURN_EXCHANGES
-- =============================================
ALTER TABLE public.return_exchanges
    ADD COLUMN store_id UUID REFERENCES public.stores(id);

-- =============================================
-- 6. SEED DEFAULT STORE FROM BUSINESS SETTINGS
-- =============================================
INSERT INTO public.stores (store_name, address, phone, email, gst_number, invoice_prefix, is_default)
SELECT
    business_name,
    address,
    phone,
    email,
    gst_number,
    invoice_prefix,
    true
FROM public.business_settings
LIMIT 1;

-- Assign existing products to default store
INSERT INTO public.product_store_quantities (product_id, store_id, quantity)
SELECT p.id, s.id, p.quantity
FROM public.products p
CROSS JOIN public.stores s
WHERE s.is_default = true;

-- Assign existing invoices to default store
UPDATE public.invoices
SET store_id = (SELECT id FROM public.stores WHERE is_default = true LIMIT 1)
WHERE store_id IS NULL;

-- Assign existing return_exchanges to default store
UPDATE public.return_exchanges
SET store_id = (SELECT id FROM public.stores WHERE is_default = true LIMIT 1)
WHERE store_id IS NULL;

-- =============================================
-- 7. STORE-SPECIFIC INVOICE NUMBER GENERATOR
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_store_invoice_number(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    prefix TEXT;
    next_num INTEGER;
    invoice_num TEXT;
BEGIN
    SELECT invoice_prefix INTO prefix FROM public.stores WHERE id = p_store_id;
    prefix := COALESCE(prefix, 'INV');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM LENGTH(prefix) + 2) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.invoices
    WHERE invoice_number LIKE prefix || '-%'
    AND store_id = p_store_id;
    
    invoice_num := prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN invoice_num;
END;
$$;

-- =============================================
-- 8. STOCK TRANSFER FUNCTION (handles qty moves)
-- =============================================
CREATE OR REPLACE FUNCTION public.transfer_stock(
    p_product_id UUID,
    p_from_store_id UUID,
    p_to_store_id UUID,
    p_quantity INTEGER,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    available_qty INTEGER;
    transfer_id UUID;
BEGIN
    -- Check available quantity at source store
    SELECT COALESCE(quantity, 0) INTO available_qty
    FROM public.product_store_quantities
    WHERE product_id = p_product_id AND store_id = p_from_store_id;

    IF available_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock at source store. Available: %, Requested: %', available_qty, p_quantity;
    END IF;

    -- Reduce from source store
    UPDATE public.product_store_quantities
    SET quantity = quantity - p_quantity, updated_at = now()
    WHERE product_id = p_product_id AND store_id = p_from_store_id;

    -- Add to destination store (upsert)
    INSERT INTO public.product_store_quantities (product_id, store_id, quantity)
    VALUES (p_product_id, p_to_store_id, p_quantity)
    ON CONFLICT (product_id, store_id)
    DO UPDATE SET quantity = product_store_quantities.quantity + p_quantity, updated_at = now();

    -- Create transfer record
    INSERT INTO public.stock_transfers (product_id, from_store_id, to_store_id, quantity, reason, transferred_by)
    VALUES (p_product_id, p_from_store_id, p_to_store_id, p_quantity, p_reason, auth.uid())
    RETURNING id INTO transfer_id;

    -- Log stock history - out from source
    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (p_product_id, -p_quantity, 'transfer_out', 
            'Transfer to store: ' || (SELECT store_name FROM public.stores WHERE id = p_to_store_id),
            transfer_id, auth.uid());

    -- Log stock history - in to destination
    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (p_product_id, p_quantity, 'transfer_in', 
            'Transfer from store: ' || (SELECT store_name FROM public.stores WHERE id = p_from_store_id),
            transfer_id, auth.uid());

    RETURN transfer_id;
END;
$$;
