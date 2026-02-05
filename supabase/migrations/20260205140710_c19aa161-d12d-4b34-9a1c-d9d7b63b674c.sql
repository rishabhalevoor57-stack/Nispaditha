-- Create enum for order note status
CREATE TYPE public.order_note_status AS ENUM ('order_noted', 'design_approved', 'in_production', 'ready', 'delivered');

-- Create enum for delivery type
CREATE TYPE public.delivery_type AS ENUM ('pickup', 'home_delivery');

-- Create order_notes table
CREATE TABLE public.order_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_reference TEXT NOT NULL UNIQUE,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Customer Details
    customer_name TEXT NOT NULL,
    phone_number TEXT,
    address TEXT,
    
    -- Payment Notes
    quoted_estimate NUMERIC DEFAULT 0,
    advance_received NUMERIC DEFAULT 0,
    balance NUMERIC GENERATED ALWAYS AS (quoted_estimate - advance_received) STORED,
    payment_mode TEXT,
    
    -- Delivery/Pickup
    delivery_type public.delivery_type DEFAULT 'pickup',
    expected_delivery_date DATE,
    time_slot TEXT,
    
    -- Special Instructions
    special_instructions TEXT,
    
    -- Status
    status public.order_note_status DEFAULT 'order_noted',
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_note_items table
CREATE TABLE public.order_note_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_note_id UUID NOT NULL REFERENCES public.order_notes(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    customization_notes TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    expected_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_note_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_notes
CREATE POLICY "Authenticated users can view order notes"
ON public.order_notes
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert order notes"
ON public.order_notes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update order notes"
ON public.order_notes
FOR UPDATE
USING (true);

CREATE POLICY "Admins can delete order notes"
ON public.order_notes
FOR DELETE
USING (public.is_admin());

-- RLS policies for order_note_items
CREATE POLICY "Authenticated users can manage order note items"
ON public.order_note_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to generate order reference number
CREATE OR REPLACE FUNCTION public.generate_order_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    next_num INTEGER;
    order_ref TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_reference FROM 4) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.order_notes
    WHERE order_reference LIKE 'ON-%';
    
    order_ref := 'ON-' || LPAD(next_num::TEXT, 6, '0');
    RETURN order_ref;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_order_notes_updated_at
BEFORE UPDATE ON public.order_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();