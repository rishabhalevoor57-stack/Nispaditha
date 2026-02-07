
-- Create types_of_work master table
CREATE TABLE public.types_of_work (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.types_of_work ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view types of work"
ON public.types_of_work FOR SELECT USING (true);

CREATE POLICY "Admins can manage types of work"
ON public.types_of_work FOR ALL USING (is_admin());

-- Seed default values
INSERT INTO public.types_of_work (name) VALUES
  ('Kundan'),
  ('Nakash'),
  ('Stone Work'),
  ('Normal Antique'),
  ('Nakash 3D'),
  ('Moissanite'),
  ('Polki'),
  ('Beaded Necklaces'),
  ('Anti Tarnish'),
  ('Oxidised'),
  ('Fancy Beads'),
  ('Italian'),
  ('Beads'),
  ('Pearls'),
  ('Findings');

-- Add vendor_code to suppliers
ALTER TABLE public.suppliers ADD COLUMN vendor_code TEXT UNIQUE;

-- Auto-generate vendor codes for existing vendors
DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 1;
BEGIN
  FOR rec IN SELECT id FROM public.suppliers ORDER BY created_at LOOP
    UPDATE public.suppliers SET vendor_code = 'V-' || LPAD(counter::TEXT, 4, '0') WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Create trigger for updated_at on types_of_work
CREATE TRIGGER update_types_of_work_updated_at
BEFORE UPDATE ON public.types_of_work
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
