
-- Add MRP column to invoice_items to store MRP at time of invoice creation
ALTER TABLE public.invoice_items ADD COLUMN mrp numeric NOT NULL DEFAULT 0;
