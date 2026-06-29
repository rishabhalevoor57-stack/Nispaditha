
ALTER TABLE public.repair_items
  ADD COLUMN IF NOT EXISTS repair_outcome text NOT NULL DEFAULT 'repaired_successfully',
  ADD COLUMN IF NOT EXISTS melting_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS melting_entry_id uuid REFERENCES public.melting_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS melting_purity numeric,
  ADD COLUMN IF NOT EXISTS melting_loss_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovered_weight numeric,
  ADD COLUMN IF NOT EXISTS melting_description text,
  ADD COLUMN IF NOT EXISTS melting_remarks text,
  ADD COLUMN IF NOT EXISTS add_to_inventory boolean NOT NULL DEFAULT false;
