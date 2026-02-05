-- Add metal rates to business_settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS gold_rate_per_gram numeric NOT NULL DEFAULT 7500,
ADD COLUMN IF NOT EXISTS silver_rate_per_gram numeric NOT NULL DEFAULT 95;