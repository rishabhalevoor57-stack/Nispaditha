
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.buybacks DROP CONSTRAINT IF EXISTS buybacks_client_id_fkey;
ALTER TABLE public.buybacks ADD CONSTRAINT buybacks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.repair_items DROP CONSTRAINT IF EXISTS repair_items_client_id_fkey;
ALTER TABLE public.repair_items ADD CONSTRAINT repair_items_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
