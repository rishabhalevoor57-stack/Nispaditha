
-- Activity Logs table for audit trail
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT,
  record_label TEXT,
  old_value JSONB,
  new_value JSONB,
  user_id UUID,
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Read-only: authenticated users can view
CREATE POLICY "Authenticated users can view activity logs"
ON public.activity_logs
FOR SELECT
USING (true);

-- Any authenticated user can insert logs
CREATE POLICY "Authenticated users can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (true);

-- No UPDATE or DELETE policies = logs are immutable

-- Indexes for performance
CREATE INDEX idx_activity_logs_module ON public.activity_logs(module);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
