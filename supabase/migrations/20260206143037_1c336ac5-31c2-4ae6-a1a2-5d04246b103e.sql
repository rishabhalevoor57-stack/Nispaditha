
-- Add missing columns to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS total_purchases numeric NOT NULL DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS outstanding_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS last_purchase_date timestamp with time zone;

-- Create vendor_payments table
CREATE TABLE public.vendor_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text NOT NULL DEFAULT 'cash',
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on vendor_payments
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_payments
CREATE POLICY "Authenticated users can manage vendor payments"
  ON public.vendor_payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at on vendor_payments
CREATE TRIGGER update_vendor_payments_updated_at
  BEFORE UPDATE ON public.vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
