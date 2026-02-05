-- Add tracking fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS last_invoice_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS total_purchases numeric NOT NULL DEFAULT 0;

-- Create calendar_events table
CREATE TABLE public.calendar_events (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    event_date date NOT NULL,
    event_type text NOT NULL CHECK (event_type IN ('order_start', 'delivery', 'milestone')),
    order_note_id uuid REFERENCES public.order_notes(id) ON DELETE CASCADE,
    customer_name text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_events (Admin only)
CREATE POLICY "Admins can manage calendar events" 
ON public.calendar_events 
FOR ALL 
USING (is_admin());

-- Create index for faster date queries
CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_events_order_note ON public.calendar_events(order_note_id);

-- Create trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to upsert client on invoice creation
CREATE OR REPLACE FUNCTION public.upsert_client_on_invoice(
    p_phone text,
    p_name text,
    p_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    client_id uuid;
BEGIN
    -- Check if client exists by phone
    SELECT id INTO client_id FROM public.clients WHERE phone = p_phone;
    
    IF client_id IS NULL THEN
        -- Create new client
        INSERT INTO public.clients (name, phone, last_invoice_date, total_purchases)
        VALUES (p_name, p_phone, now(), p_amount)
        RETURNING id INTO client_id;
    ELSE
        -- Update existing client
        UPDATE public.clients 
        SET last_invoice_date = now(),
            total_purchases = total_purchases + p_amount,
            updated_at = now()
        WHERE id = client_id;
    END IF;
    
    RETURN client_id;
END;
$$;