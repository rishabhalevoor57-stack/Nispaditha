
-- Backfill: every current admin also becomes super_admin (non-destructive, both held)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.app_role
FROM public.user_roles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- Branches: enforce status enum-ish values via check constraint (additive)
ALTER TABLE public.branches
  DROP CONSTRAINT IF EXISTS branches_status_check;
ALTER TABLE public.branches
  ADD CONSTRAINT branches_status_check
  CHECK (status IN ('active','inactive','archived'));

-- Protect the default (Main) branch from being archived/inactivated at DB level
CREATE OR REPLACE FUNCTION public.protect_default_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_default THEN
    RAISE EXCEPTION 'The default (Main) branch cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_default AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'The default (Main) branch must remain active';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_default_branch ON public.branches;
CREATE TRIGGER trg_protect_default_branch
  BEFORE UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.protect_default_branch();

-- Helper: branches current user can access
CREATE OR REPLACE FUNCTION public.current_branch_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.branches b
  WHERE public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'super_admin')
     OR EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND (p.assigned_branch_id IS NULL OR p.assigned_branch_id = b.id)
     )
$$;

-- Branch transfers scaffolding (no UI yet)
CREATE TABLE IF NOT EXISTS public.branch_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('inventory','customer','repair','invoice')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  from_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  to_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS branch_transfers_from_idx ON public.branch_transfers (from_branch_id);
CREATE INDEX IF NOT EXISTS branch_transfers_to_idx   ON public.branch_transfers (to_branch_id);
CREATE INDEX IF NOT EXISTS branch_transfers_entity_idx ON public.branch_transfers (entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_transfers TO authenticated;
GRANT ALL ON public.branch_transfers TO service_role;

ALTER TABLE public.branch_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage branch transfers"
  ON public.branch_transfers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Branch users view own transfers"
  ON public.branch_transfers FOR SELECT
  TO authenticated
  USING (
    public.user_can_access_branch(from_branch_id)
    OR public.user_can_access_branch(to_branch_id)
  );

CREATE TRIGGER trg_branch_transfers_updated
  BEFORE UPDATE ON public.branch_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
