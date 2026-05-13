CREATE TABLE IF NOT EXISTS public.backup_mirror_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  reachable boolean NOT NULL DEFAULT false,
  file_count integer,
  last_backup_file text,
  error_message text,
  source text NOT NULL DEFAULT 'scheduled'
);
ALTER TABLE public.backup_mirror_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view mirror status" ON public.backup_mirror_status FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins insert mirror status" ON public.backup_mirror_status FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_backup_mirror_status_checked_at ON public.backup_mirror_status (checked_at DESC);