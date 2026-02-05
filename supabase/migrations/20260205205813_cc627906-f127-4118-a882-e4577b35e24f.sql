-- Add new invoice status workflow columns
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- Update existing invoices based on payment_status
UPDATE public.invoices 
SET status = CASE 
  WHEN payment_status = 'paid' THEN 'paid'
  WHEN payment_status = 'partial' THEN 'sent'
  ELSE 'draft'
END,
paid_at = CASE WHEN payment_status = 'paid' THEN created_at ELSE NULL END;