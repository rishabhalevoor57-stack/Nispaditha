
-- 1. Add order-level discount column on invoices (kept separate from item discounts)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS order_discount NUMERIC NOT NULL DEFAULT 0;

-- 2. Custom order advance payments table (mirrors invoice_payments)
CREATE TABLE IF NOT EXISTS public.custom_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_order_id UUID NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  transferred_to_invoice_payment_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_order_payments TO authenticated;
GRANT ALL ON public.custom_order_payments TO service_role;

ALTER TABLE public.custom_order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view custom order payments"
  ON public.custom_order_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert custom order payments"
  ON public.custom_order_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update custom order payments"
  ON public.custom_order_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete custom order payments"
  ON public.custom_order_payments FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_custom_order_payments_order ON public.custom_order_payments(custom_order_id);

CREATE TRIGGER trg_custom_order_payments_updated_at
  BEFORE UPDATE ON public.custom_order_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Advance reference generator: ADV-000001, ADV-000002...
CREATE OR REPLACE FUNCTION public.generate_advance_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  ref TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.custom_order_payments
  WHERE reference_number LIKE 'ADV-%';
  ref := 'ADV-' || LPAD(next_num::TEXT, 6, '0');
  RETURN ref;
END;
$$;
