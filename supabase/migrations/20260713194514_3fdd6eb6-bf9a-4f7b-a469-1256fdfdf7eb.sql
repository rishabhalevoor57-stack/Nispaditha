
-- Phase A: Multi-metal foundation
-- Add metal_type to tables that don't already have it. Default 'silver' preserves current behavior.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'silver';

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'silver';

ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'silver';

ALTER TABLE public.service_forms
  ADD COLUMN IF NOT EXISTS metal_type text DEFAULT 'silver';

-- Backfill existing rows to silver
UPDATE public.invoices        SET metal_type = 'silver' WHERE metal_type IS NULL;
UPDATE public.invoice_items   SET metal_type = 'silver' WHERE metal_type IS NULL;
UPDATE public.custom_orders   SET metal_type = 'silver' WHERE metal_type IS NULL;
UPDATE public.service_forms   SET metal_type = 'silver' WHERE metal_type IS NULL;
