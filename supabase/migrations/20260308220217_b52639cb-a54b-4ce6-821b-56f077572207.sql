
-- Split ALL policies into SELECT+INSERT+UPDATE (all auth) and DELETE (admin only)
-- for tables that currently have a single ALL policy for authenticated users

-- PRODUCTS
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.is_admin());

-- INVOICES
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON public.invoices;
CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.is_admin());

-- INVOICE_ITEMS
DROP POLICY IF EXISTS "Authenticated users can manage invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can view invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoice items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoice items" ON public.invoice_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete invoice items" ON public.invoice_items FOR DELETE TO authenticated USING (public.is_admin());

-- EXPENSES
DROP POLICY IF EXISTS "Authenticated users can manage expenses" ON public.expenses;
CREATE POLICY "Authenticated users can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.is_admin());

-- CLIENTS
DROP POLICY IF EXISTS "Authenticated users can manage clients" ON public.clients;
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.is_admin());

-- SUPPLIERS
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.is_admin());

-- VENDOR_PAYMENTS
DROP POLICY IF EXISTS "Authenticated users can manage vendor payments" ON public.vendor_payments;
CREATE POLICY "Authenticated users can view vendor payments" ON public.vendor_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert vendor payments" ON public.vendor_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update vendor payments" ON public.vendor_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete vendor payments" ON public.vendor_payments FOR DELETE TO authenticated USING (public.is_admin());

-- CUSTOM_ORDER_ITEMS
DROP POLICY IF EXISTS "Authenticated users can manage custom order items" ON public.custom_order_items;
CREATE POLICY "Authenticated users can view custom order items" ON public.custom_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert custom order items" ON public.custom_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update custom order items" ON public.custom_order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete custom order items" ON public.custom_order_items FOR DELETE TO authenticated USING (public.is_admin());

-- ORDER_NOTE_ITEMS
DROP POLICY IF EXISTS "Authenticated users can manage order note items" ON public.order_note_items;
CREATE POLICY "Authenticated users can view order note items" ON public.order_note_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert order note items" ON public.order_note_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update order note items" ON public.order_note_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete order note items" ON public.order_note_items FOR DELETE TO authenticated USING (public.is_admin());

-- RETURN_EXCHANGES
DROP POLICY IF EXISTS "Authenticated users can manage return exchanges" ON public.return_exchanges;
CREATE POLICY "Authenticated users can view return exchanges" ON public.return_exchanges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert return exchanges" ON public.return_exchanges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update return exchanges" ON public.return_exchanges FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete return exchanges" ON public.return_exchanges FOR DELETE TO authenticated USING (public.is_admin());

-- RETURN_EXCHANGE_ITEMS
DROP POLICY IF EXISTS "Authenticated users can manage return exchange items" ON public.return_exchange_items;
CREATE POLICY "Authenticated users can view return exchange items" ON public.return_exchange_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert return exchange items" ON public.return_exchange_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update return exchange items" ON public.return_exchange_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete return exchange items" ON public.return_exchange_items FOR DELETE TO authenticated USING (public.is_admin());

-- STOCK_HISTORY
DROP POLICY IF EXISTS "Authenticated users can manage stock history" ON public.stock_history;
CREATE POLICY "Authenticated users can view stock history" ON public.stock_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock history" ON public.stock_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock history" ON public.stock_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete stock history" ON public.stock_history FOR DELETE TO authenticated USING (public.is_admin());

-- PRODUCT_STORE_QUANTITIES
DROP POLICY IF EXISTS "Authenticated users can manage product store quantities" ON public.product_store_quantities;
CREATE POLICY "Authenticated users can view product store quantities" ON public.product_store_quantities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product store quantities" ON public.product_store_quantities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product store quantities" ON public.product_store_quantities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete product store quantities" ON public.product_store_quantities FOR DELETE TO authenticated USING (public.is_admin());

-- Allow admins to view all profiles (for user management)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

-- Allow admins to view all user roles (for user management)  
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin());
