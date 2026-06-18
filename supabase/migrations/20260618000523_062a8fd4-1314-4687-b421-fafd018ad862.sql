ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS gst_mode text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS extra_charges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS making_charges numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_charges numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS polishing_charges numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_charges numeric NOT NULL DEFAULT 0;