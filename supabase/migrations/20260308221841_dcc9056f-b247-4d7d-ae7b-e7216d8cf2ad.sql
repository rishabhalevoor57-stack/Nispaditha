
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    prefix TEXT;
    next_num INTEGER;
    invoice_num TEXT;
    fy_start DATE;
    fy_end DATE;
    fy_label TEXT;
BEGIN
    SELECT invoice_prefix INTO prefix FROM public.business_settings LIMIT 1;
    prefix := COALESCE(prefix, 'INV');
    
    -- Determine current financial year (April 1 - March 31)
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
        fy_start := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 4, 1);
        fy_end := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, 3, 31);
        fy_label := SUBSTRING(EXTRACT(YEAR FROM CURRENT_DATE)::text FROM 3 FOR 2) 
                    || SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text FROM 3 FOR 2);
    ELSE
        fy_start := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, 4, 1);
        fy_end := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 3, 31);
        fy_label := SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE) - 1)::text FROM 3 FOR 2) 
                    || SUBSTRING(EXTRACT(YEAR FROM CURRENT_DATE)::text FROM 3 FOR 2);
    END IF;
    
    -- Count invoices only within current financial year
    SELECT COALESCE(MAX(CAST(
        SUBSTRING(invoice_number FROM LENGTH(prefix || '-' || fy_label || '-') + 1) AS INTEGER
    )), 0) + 1
    INTO next_num
    FROM public.invoices
    WHERE invoice_number LIKE prefix || '-' || fy_label || '-%'
    AND invoice_date >= fy_start
    AND invoice_date <= fy_end;
    
    invoice_num := prefix || '-' || fy_label || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN invoice_num;
END;
$function$;
