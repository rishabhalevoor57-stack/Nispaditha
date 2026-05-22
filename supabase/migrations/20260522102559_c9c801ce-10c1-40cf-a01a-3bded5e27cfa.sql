-- Remove duplicate stock triggers on invoice_items (keep the trg_* versions)
DROP TRIGGER IF EXISTS on_invoice_item_created ON public.invoice_items;
DROP TRIGGER IF EXISTS restore_stock_on_invoice_item_delete ON public.invoice_items;

-- Remove duplicate rate-change trigger (keep trg_log_rate_change)
DROP TRIGGER IF EXISTS on_rate_change ON public.business_settings;

-- Remove duplicate updated_at triggers across all tables (keep set_updated_at)
DROP TRIGGER IF EXISTS update_business_settings_updated_at ON public.business_settings;
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
DROP TRIGGER IF EXISTS update_client_schemes_updated_at ON public.client_schemes;
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
DROP TRIGGER IF EXISTS update_custom_orders_updated_at ON public.custom_orders;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS update_order_notes_updated_at ON public.order_notes;
DROP TRIGGER IF EXISTS update_product_store_quantities_updated_at ON public.product_store_quantities;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS repair_items_updated_at ON public.repair_items;
DROP TRIGGER IF EXISTS update_return_exchanges_updated_at ON public.return_exchanges;
DROP TRIGGER IF EXISTS store_wallets_updated_at ON public.store_wallets;
DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
DROP TRIGGER IF EXISTS update_types_of_work_updated_at ON public.types_of_work;
DROP TRIGGER IF EXISTS update_vendor_payments_updated_at ON public.vendor_payments;