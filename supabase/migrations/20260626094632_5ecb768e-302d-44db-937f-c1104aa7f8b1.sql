
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Products
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm        ON public.products USING gin (lower(sku) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm       ON public.products USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON public.products USING gin (lower(coalesce(description,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at      ON public.products (deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_category_id     ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id     ON public.products (supplier_id);

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm  ON public.clients USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm ON public.clients USING gin (coalesce(phone,'') gin_trgm_ops);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_number_trgm     ON public.invoices USING gin (lower(invoice_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_invoices_notes_trgm      ON public.invoices USING gin (lower(coalesce(notes,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id       ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date    ON public.invoices (invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status  ON public.invoices (payment_status);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items (product_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments (invoice_id);

-- Custom orders
CREATE INDEX IF NOT EXISTS idx_custom_orders_ref_trgm   ON public.custom_orders USING gin (lower(reference_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_custom_orders_name_trgm  ON public.custom_orders USING gin (lower(coalesce(client_name,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_custom_orders_phone_trgm ON public.custom_orders USING gin (coalesce(phone_number,'') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_custom_orders_notes_trgm ON public.custom_orders USING gin (lower(coalesce(notes,'')) gin_trgm_ops);

-- Service forms
CREATE INDEX IF NOT EXISTS idx_service_forms_receipt_trgm ON public.service_forms USING gin (lower(receipt_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_forms_name_trgm    ON public.service_forms USING gin (lower(coalesce(client_name,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_forms_phone_trgm   ON public.service_forms USING gin (coalesce(client_phone,'') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_forms_client_id    ON public.service_forms (client_id);

-- Stock history
CREATE INDEX IF NOT EXISTS idx_stock_history_product_id  ON public.stock_history (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at  ON public.stock_history (created_at DESC);
