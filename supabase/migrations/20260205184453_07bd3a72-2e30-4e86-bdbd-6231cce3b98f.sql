-- Create rate history table to track metal rate changes
CREATE TABLE public.rate_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    gold_rate_per_gram NUMERIC NOT NULL,
    silver_rate_per_gram NUMERIC NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rate_history ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view rate history
CREATE POLICY "Authenticated users can view rate history"
ON public.rate_history
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert rate history (triggered automatically)
CREATE POLICY "System can insert rate history"
ON public.rate_history
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Create trigger function to log rate changes
CREATE OR REPLACE FUNCTION public.log_rate_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.gold_rate_per_gram IS DISTINCT FROM NEW.gold_rate_per_gram 
       OR OLD.silver_rate_per_gram IS DISTINCT FROM NEW.silver_rate_per_gram THEN
        INSERT INTO public.rate_history (gold_rate_per_gram, silver_rate_per_gram, changed_by)
        VALUES (NEW.gold_rate_per_gram, NEW.silver_rate_per_gram, auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on business_settings
CREATE TRIGGER on_rate_change
AFTER UPDATE ON public.business_settings
FOR EACH ROW
EXECUTE FUNCTION public.log_rate_change();