-- Add polish tracking and schemes to clients table for Client Dashboard (Part D)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS polish_total_allowed integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS polish_used integer NOT NULL DEFAULT 0;

-- Schemes table for client savings/installment schemes
CREATE TABLE IF NOT EXISTS public.client_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  monthly_amount numeric NOT NULL DEFAULT 0,
  duration_months integer NOT NULL DEFAULT 1,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client schemes"
  ON public.client_schemes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client schemes"
  ON public.client_schemes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client schemes"
  ON public.client_schemes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete client schemes"
  ON public.client_schemes FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER update_client_schemes_updated_at
  BEFORE UPDATE ON public.client_schemes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_client_schemes_client_id ON public.client_schemes(client_id);

-- Add advance_paid + round_off + gst_percentage to invoices for new totals block (Part A7, A8)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS advance_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_percentage numeric NOT NULL DEFAULT 3;

-- Add description to invoice_items for per-row notes (Part B2)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS description text;