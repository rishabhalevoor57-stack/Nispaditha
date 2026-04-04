
-- Add inventory linking fields to custom_order_items
ALTER TABLE public.custom_order_items 
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS sku text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0;

-- Add SKU locking to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS locked_by_custom_order_id uuid REFERENCES public.custom_orders(id) ON DELETE SET NULL;

-- Add flat discount to custom orders
ALTER TABLE public.custom_orders
ADD COLUMN IF NOT EXISTS flat_discount numeric NOT NULL DEFAULT 0;
