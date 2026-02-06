-- Add comments column to clients table
ALTER TABLE public.clients 
ADD COLUMN comments text DEFAULT NULL;