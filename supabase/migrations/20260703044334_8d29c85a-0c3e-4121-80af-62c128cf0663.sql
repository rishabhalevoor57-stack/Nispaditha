
-- Phase A: Multi-Branch Foundation

-- 1. branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  gst_number text,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone authenticated can view branches"
  ON public.branches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert branches"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update branches"
  ON public.branches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branches"
  ON public.branches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed default Main Branch
INSERT INTO public.branches (code, name, address, gst_number, is_default, status)
VALUES ('BLR-MAIN', 'Main Branch - Nispaditha Ventures LLP', NULL, '29AAQFN9742E1ZO', true, 'active')
ON CONFLICT (code) DO NOTHING;

-- 3. Add branch_id to core modules (nullable, defaults handled at app layer / backfill below)
DO $$
DECLARE
  v_main uuid;
  tbl text;
  tables text[] := ARRAY['products','invoices','repair_items','service_forms','clients','custom_orders','buybacks','return_exchanges','melting_entries','expenses','order_notes'];
BEGIN
  SELECT id INTO v_main FROM public.branches WHERE code = 'BLR-MAIN' LIMIT 1;

  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL', tbl);
    EXECUTE format('UPDATE public.%I SET branch_id = %L WHERE branch_id IS NULL', tbl, v_main);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (branch_id)', 'idx_' || tbl || '_branch_id', tbl);
  END LOOP;
END $$;

-- 4. profiles.assigned_branch_id for scoping (nullable = access all for admins)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 5. Helper function for future branch scoping (non-breaking; not yet enforced)
CREATE OR REPLACE FUNCTION public.user_can_access_branch(_branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _branch_id IS NULL
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND (assigned_branch_id IS NULL OR assigned_branch_id = _branch_id)
    )
$$;
