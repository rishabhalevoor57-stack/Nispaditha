
-- Create backups table
CREATE TABLE public.backups (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_type text NOT NULL DEFAULT 'manual',
    file_path text,
    file_size bigint DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    notes text,
    tables_included jsonb,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Only admins can manage backups
CREATE POLICY "Admins can manage backups"
ON public.backups
FOR ALL
USING (public.is_admin());

-- Create storage bucket for backups (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false);

-- Storage policies - admin only
CREATE POLICY "Admins can upload backups"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'backups' AND public.is_admin());

CREATE POLICY "Admins can view backups"
ON storage.objects
FOR SELECT
USING (bucket_id = 'backups' AND public.is_admin());

CREATE POLICY "Admins can delete backups"
ON storage.objects
FOR DELETE
USING (bucket_id = 'backups' AND public.is_admin());
