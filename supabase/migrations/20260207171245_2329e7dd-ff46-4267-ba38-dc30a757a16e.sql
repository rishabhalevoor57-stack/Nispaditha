
-- Return & Exchange records
CREATE TABLE public.return_exchanges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('return', 'exchange')),
  original_invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  original_invoice_number TEXT NOT NULL,
  client_name TEXT,
  client_phone TEXT,
  refund_amount NUMERIC NOT NULL DEFAULT 0,
  additional_charge NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT,
  reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Items in return/exchange (direction: 'returned' for old items, 'new' for exchange items)
CREATE TABLE public.return_exchange_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_exchange_id UUID NOT NULL REFERENCES public.return_exchanges(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('returned', 'new')),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_grams NUMERIC NOT NULL DEFAULT 0,
  rate_per_gram NUMERIC NOT NULL DEFAULT 0,
  making_charges NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  gst_percentage NUMERIC NOT NULL DEFAULT 3,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.return_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_exchange_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can manage return exchanges"
  ON public.return_exchanges FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage return exchange items"
  ON public.return_exchange_items FOR ALL
  USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_return_exchanges_updated_at
  BEFORE UPDATE ON public.return_exchanges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate reference numbers
CREATE OR REPLACE FUNCTION public.generate_return_exchange_reference(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    prefix TEXT;
    next_num INTEGER;
    ref TEXT;
BEGIN
    IF p_type = 'return' THEN
        prefix := 'RET';
    ELSE
        prefix := 'EXC';
    END IF;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM LENGTH(prefix) + 2) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.return_exchanges
    WHERE reference_number LIKE prefix || '-%';
    
    ref := prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN ref;
END;
$$;
