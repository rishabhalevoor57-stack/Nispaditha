-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create categories table (admin can manage)
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Insert default categories
INSERT INTO public.categories (name) VALUES 
    ('Gold Jewellery'),
    ('Silver Jewellery'),
    ('Diamond Jewellery'),
    ('Coins'),
    ('Others');

-- Create suppliers table
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create products (inventory) table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id),
    metal_type TEXT,
    purity TEXT,
    weight_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    making_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
    supplier_id UUID REFERENCES public.suppliers(id),
    gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    low_stock_alert INTEGER NOT NULL DEFAULT 5,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create stock_history table for tracking stock movements
CREATE TABLE public.stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity_change INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
    reason TEXT,
    reference_id UUID,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    gst_number TEXT,
    outstanding_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create invoices table
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    client_id UUID REFERENCES public.clients(id),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    payment_mode TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create invoice_items table
CREATE TABLE public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    category TEXT,
    weight_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    rate_per_gram DECIMAL(12,2) NOT NULL DEFAULT 0,
    gold_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    making_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discounted_making DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Create expenses table
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_mode TEXT,
    notes TEXT,
    bill_image_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create business_settings table
CREATE TABLE public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL DEFAULT 'My Jewellery Store',
    address TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    logo_url TEXT,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    currency TEXT NOT NULL DEFAULT 'INR',
    default_gst DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Insert default business settings
INSERT INTO public.business_settings (business_name) VALUES ('SmartBiz Jewellers');

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Function to auto-create profile and assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    
    -- First user gets admin role, others get staff
    IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    ELSE
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Add update triggers to tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_business_settings_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: Users can view/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles: Only admins can manage, users can view own
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.is_admin());

-- Categories: All authenticated users can view, only admins can modify
CREATE POLICY "Authenticated users can view categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.is_admin());

-- Suppliers: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock history: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage stock history" ON public.stock_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Clients: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoices: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoice items: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage invoice items" ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Business settings: All authenticated can view, only admins can modify
CREATE POLICY "Authenticated users can view settings" ON public.business_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.business_settings FOR ALL USING (public.is_admin());

-- Function to reduce stock when invoice is created
CREATE OR REPLACE FUNCTION public.reduce_stock_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Reduce product quantity
    UPDATE public.products 
    SET quantity = quantity - NEW.quantity 
    WHERE id = NEW.product_id;
    
    -- Log stock history
    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (NEW.product_id, -NEW.quantity, 'out', 'Invoice sale', NEW.invoice_id, auth.uid());
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_invoice_item_created
    AFTER INSERT ON public.invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_invoice();

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    prefix TEXT;
    next_num INTEGER;
    invoice_num TEXT;
BEGIN
    SELECT invoice_prefix INTO prefix FROM public.business_settings LIMIT 1;
    prefix := COALESCE(prefix, 'INV');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM LENGTH(prefix) + 2) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.invoices
    WHERE invoice_number LIKE prefix || '-%';
    
    invoice_num := prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN invoice_num;
END;
$$;