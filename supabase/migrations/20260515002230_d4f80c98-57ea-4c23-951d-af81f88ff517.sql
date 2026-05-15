
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_after_credits NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_via_mode NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_mode_for_remaining TEXT;

ALTER TABLE public.return_exchanges
  ADD COLUMN IF NOT EXISTS metal_type TEXT,
  ADD COLUMN IF NOT EXISTS buyback_kind TEXT;

ALTER TABLE public.repair_items
  ADD COLUMN IF NOT EXISTS metal_type TEXT,
  ADD COLUMN IF NOT EXISTS rate_used NUMERIC,
  ADD COLUMN IF NOT EXISTS amount_credited NUMERIC;
