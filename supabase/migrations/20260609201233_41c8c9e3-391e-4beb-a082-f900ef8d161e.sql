ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS gst_mode text NOT NULL DEFAULT 'exclusive'
CHECK (gst_mode IN ('exclusive','inclusive'));