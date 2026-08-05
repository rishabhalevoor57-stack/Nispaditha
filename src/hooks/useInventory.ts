import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import type { Product, ProductFormData, ProductStatus, TypeOfWork } from '@/types/inventory';


interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface Filters {
  search: string;
  category: string;
  status: string;
  typeOfWork: string;
}

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: 'all',
    status: 'all',
    typeOfWork: 'all',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const branch = useBranchFilter();

  const fetchProducts = useCallback(async () => {
    try {
      // Paginated fetch to bypass Supabase 1000-row limit
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      while (from < 50000) {
        let q = supabase
          .from('products')
          .select('*, categories(name), suppliers(name)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        q = branch.apply(q as any) as any;
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const typedProducts = all.map((item) => ({

        ...item,
        type_of_work: (item.type_of_work || 'Others') as TypeOfWork,
        status: (item.status || 'in_stock') as ProductStatus,
        pricing_mode: (item.pricing_mode || 'weight_based') as import('@/types/inventory').PricingMode,
      })) as Product[];

      setProducts(typedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({ variant: 'destructive', title: 'Error loading products' });
    } finally {
      setIsLoading(false);
    }
  }, [branch.filterId, branch.branchId]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSuppliers();
    const handler = () => fetchProducts();
    window.addEventListener('inventory:refresh', handler);
    return () => window.removeEventListener('inventory:refresh', handler);
  }, [fetchProducts]);


  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const filteredProducts = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !searchTerm ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.sku.toLowerCase().includes(searchTerm) ||
        (product.description?.toLowerCase().includes(searchTerm)) ||
        (product.metal_type?.toLowerCase().includes(searchTerm)) ||
        ((product as any).categories?.name?.toLowerCase().includes(searchTerm)) ||
        (product.suppliers?.name?.toLowerCase().includes(searchTerm));
      
      const matchesCategory = 
        filters.category === 'all' || product.category_id === filters.category;
      
      const matchesStatus = 
        filters.status === 'all' || product.status === filters.status;
      
      const matchesTypeOfWork = 
        filters.typeOfWork === 'all' || product.type_of_work === filters.typeOfWork;

      return matchesSearch && matchesCategory && matchesStatus && matchesTypeOfWork;
    });
  }, [products, filters]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Low stock = still has stock but at/below the alert level. Zero-qty items are "out of stock".
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity > 0 && p.quantity <= p.low_stock_alert && p.status === 'in_stock');
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter(p => p.quantity <= 0);
  }, [products]);

  // Single source of truth: current inventory = active SKUs with quantity > 0
  const inventoryStats = useMemo(() => {
    const inStock = products.filter(p => (p.quantity || 0) > 0);
    return {
      currentProducts: inStock.length,
      lifetimeSkus: products.length,
      outOfStockCount: products.length - inStock.length,
      totalQuantity: inStock.reduce((s, p) => s + (p.quantity || 0), 0),
      totalWeight: inStock.reduce((s, p) => s + Number(p.weight_grams || 0) * (p.quantity || 0), 0),
    };
  }, [products]);


  const isDuplicateAllowedCategory = (categoryId: string | null | undefined): boolean => {
    if (!categoryId) return false;
    const cat = categories.find(c => c.id === categoryId);
    const name = cat?.name?.toLowerCase().trim() || '';
    return name.includes('necklace set') || name.includes('pendant') || name.includes('pendent');
  };

  const isDuplicateAllowedCategoryName = (categoryName: string): boolean => {
    const name = categoryName.toLowerCase().trim();
    return name.includes('necklace set') || name.includes('pendant') || name.includes('pendent');
  };

  const checkDuplicateSku = (sku: string, categoryId: string | null | undefined, excludeId?: string): boolean => {
    if (isDuplicateAllowedCategory(categoryId)) return false;
    return products.some(p => p.sku === sku && p.id !== excludeId);
  };

  const createProduct = async (formData: ProductFormData, imageFile?: File) => {
    try {
      // Check for duplicate SKU (skip for Necklace Set)
      if (checkDuplicateSku(formData.sku, formData.category_id)) {
        toast({ variant: 'destructive', title: 'Duplicate SKU', description: `SKU "${formData.sku}" already exists. Duplicate SKUs are only allowed for Necklace Set and Pendant Set categories.` });
        return false;
      }

      let image_url = null;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        image_url = publicUrl;
      }

      const productData = {
        ...formData,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        image_url,
        branch_id: branch.branchId,
      } as any;


      const { data, error } = await supabase.from('products').insert([productData]).select().single();
      if (error) throw error;
      
      logActivity({
        module: 'inventory',
        action: 'create',
        recordId: data?.id,
        recordLabel: formData.name,
        newValue: { sku: formData.sku, name: formData.name, pricing_mode: formData.pricing_mode, weight_grams: formData.weight_grams, selling_price: formData.selling_price },
      });

      toast({ title: 'Product added successfully' });
      fetchProducts();
      return true;
    } catch (error: any) {
      const message = error?.message || 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const updateProduct = async (id: string, formData: ProductFormData, imageFile?: File) => {
    try {
      // Check for duplicate SKU (skip for Necklace Set / Pendant Set)
      if (checkDuplicateSku(formData.sku, formData.category_id, id)) {
        toast({ variant: 'destructive', title: 'Duplicate SKU', description: `SKU "${formData.sku}" already exists. Duplicate SKUs are only allowed for Necklace Set and Pendant Set categories.` });
        return false;
      }

      const oldProduct = products.find(p => p.id === id);
      let image_url = undefined;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        image_url = publicUrl;
      }

      const productData = {
        ...formData,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        ...(image_url && { image_url }),
      };

      const { data: updatedData, error } = await supabase.from('products').update(productData).eq('id', id).select('*, categories(name), suppliers(name)').single();
      if (error) throw error;
      
      // Optimistic local update instead of full refetch
      if (updatedData) {
        const typedProduct = {
          ...updatedData,
          type_of_work: (updatedData.type_of_work || 'Others') as TypeOfWork,
          status: (updatedData.status || 'in_stock') as ProductStatus,
          pricing_mode: (updatedData.pricing_mode || 'weight_based') as import('@/types/inventory').PricingMode,
        } as Product;
        setProducts(prev => prev.map(p => p.id === id ? typedProduct : p));
      }
      
      logActivity({
        module: 'inventory',
        action: 'update',
        recordId: id,
        recordLabel: formData.name,
        oldValue: oldProduct ? { sku: oldProduct.sku, name: oldProduct.name, selling_price: oldProduct.selling_price, weight_grams: oldProduct.weight_grams } : null,
        newValue: { sku: formData.sku, name: formData.name, selling_price: formData.selling_price, weight_grams: formData.weight_grams },
      });

      toast({ title: 'Product updated successfully' });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const oldProduct = products.find(p => p.id === id);
      const { error } = await supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      
      // Remove from local state
      setProducts(prev => prev.filter(p => p.id !== id));
      
      logActivity({
        module: 'inventory',
        action: 'delete',
        recordId: id,
        recordLabel: oldProduct?.name || id,
        oldValue: oldProduct ? { sku: oldProduct.sku, name: oldProduct.name, selling_price: oldProduct.selling_price } : null,
      });

      toast({ title: 'Product moved to recycle bin' });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const parseDateSafe = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    // Already valid ISO date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Try DD-MM-YYYY or DD/MM/YYYY
    const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    // Try MM/DD/YYYY
    const mdy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (mdy) return `20${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
    // Handle Mon-YY like "Sep-25" → 2025-09-01
    const monthNames: Record<string, string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const monYr = dateStr.match(/^([A-Za-z]{3})-?(\d{2,4})$/);
    if (monYr) {
      const mon = monthNames[monYr[1].toLowerCase()];
      const yr = monYr[2].length === 2 ? `20${monYr[2]}` : monYr[2];
      if (mon) return `${yr}-${mon}-01`;
    }
    // Fallback: try native Date parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  };

  const bulkImport = async (productsToImport: Partial<ProductFormData>[], onProgress?: (current: number, total: number) => void) => {
    try {
      // Build lookup maps for category and vendor names
      const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      const supplierMap = new Map(suppliers.map(s => [s.name.toLowerCase(), s.id]));

      const validProducts = productsToImport
        .filter(p => p.sku && p.name)
        .map(p => {
          const ext = p as any;
          const categoryName = (ext._category_name || '').toLowerCase();
          const vendorName = (ext._vendor_name || '').toLowerCase();

          const weight = p.weight_grams || 0;
          const pricingMode = p.pricing_mode || 'weight_based';
          const pricePerGram = p.price_per_gram || 0;
          const makingCharges = p.making_charges || 0;
          const purchasePricePerGram = p.purchase_price_per_gram || 0;
          const purchaseMC = p.purchase_making_charges || 0;

          // Auto-calculate selling/purchase price for weight_based if not explicitly provided
          let sellingPrice = p.selling_price || 0;
          let purchasePrice = p.purchase_price || 0;

          if (pricingMode === 'weight_based' && weight > 0) {
            if (!sellingPrice && pricePerGram > 0) {
              sellingPrice = (weight * pricePerGram) + (weight * makingCharges);
            }
            if (!purchasePrice && purchasePricePerGram > 0) {
              purchasePrice = (weight * purchasePricePerGram) + (weight * purchaseMC);
            }
          }

          return {
            sku: p.sku!,
            name: p.name!,
            description: p.description || null,
            metal_type: p.metal_type || null,
            purity: p.purity || null,
            weight_grams: weight,
            quantity: p.quantity || 0,
            price_per_gram: pricePerGram,
            making_charges: makingCharges,
            mrp: p.mrp || 0,
            selling_price: sellingPrice,
            purchase_price: purchasePrice,
            type_of_work: p.type_of_work || 'Others',
            status: p.status || 'in_stock',
            bangle_size: p.bangle_size || null,
            low_stock_alert: p.low_stock_alert || 5,
            gst_percentage: p.gst_percentage || 3,
            pricing_mode: pricingMode,
            purchase_price_per_gram: purchasePricePerGram,
            purchase_making_charges: purchaseMC,
            date_ordered: parseDateSafe(p.date_ordered) || new Date().toISOString().split('T')[0],
            category_id: categoryMap.get(categoryName) || null,
            supplier_id: supplierMap.get(vendorName) || null,
          };
        });

      // Existing products indexed by SKU for merge / conflict detection
      const existingBySku = new Map<string, { id: string; name: string; weight_grams: number; quantity: number }>();
      products.forEach(p => {
        if (!existingBySku.has(p.sku)) {
          existingBySku.set(p.sku, { id: p.id, name: p.name, weight_grams: Number(p.weight_grams) || 0, quantity: Number(p.quantity) || 0 });
        }
      });

      const sameItem = (a: { name: string; weight_grams: number }, b: { name: string; weight_grams: number }) =>
        a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
        Math.abs((Number(a.weight_grams) || 0) - (Number(b.weight_grams) || 0)) < 0.001;

      const mergeTargets = new Map<string, { id: string; sku: string; addQty: number; baseQty: number }>();
      const blocked: string[] = [];
      const seenInBatch = new Map<string, { name: string; weight_grams: number }>();
      const toInsert: typeof validProducts = [];

      validProducts.forEach(p => {
        const isAllowed = isDuplicateAllowedCategory(p.category_id);

        if (!isAllowed) {
          const existing = existingBySku.get(p.sku);
          if (existing) {
            if (sameItem(existing, p)) {
              // Same SKU + Name + Weight → increase quantity only
              const t = mergeTargets.get(p.sku) || { id: existing.id, sku: p.sku, addQty: 0, baseQty: existing.quantity };
              t.addQty += Number(p.quantity) || 0;
              mergeTargets.set(p.sku, t);
            } else {
              blocked.push(`${p.sku} (existing ${existing.weight_grams}g "${existing.name}" vs imported ${p.weight_grams}g "${p.name}")`);
            }
            return;
          }

          const seen = seenInBatch.get(p.sku);
          if (seen) {
            if (sameItem(seen, p)) {
              const target = toInsert.find(x => x.sku === p.sku);
              if (target) target.quantity += Number(p.quantity) || 0;
            } else {
              blocked.push(`${p.sku} (duplicate SKU with different name/weight inside the file)`);
            }
            return;
          }
          seenInBatch.set(p.sku, { name: p.name, weight_grams: p.weight_grams });
        }

        toInsert.push(p);
      });

      if (blocked.length > 0) {
        toast({
          variant: 'destructive',
          title: `${blocked.length} row(s) blocked — SKU exists with a different weight/name`,
          description: `${blocked.slice(0, 3).join('; ')}${blocked.length > 3 ? ` … and ${blocked.length - 3} more` : ''}. These must be created as separate inventory items with unique SKUs.`,
        });
      }

      if (toInsert.length === 0 && mergeTargets.size === 0) {
        toast({ variant: 'destructive', title: 'Nothing imported', description: 'All rows were blocked or missing SKU/Name.' });
        return false;
      }

      // Process inserts in batches of 50
      const BATCH_SIZE = 50;
      let imported = 0;

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('products').insert(batch);
        if (error) throw error;

        imported += batch.length;
        onProgress?.(imported, toInsert.length);

        // Yield to UI thread
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Apply quantity merges for identical SKU + Name + Weight
      let merged = 0;
      for (const t of mergeTargets.values()) {
        if (t.addQty <= 0) continue;
        const { error } = await supabase
          .from('products')
          .update({ quantity: t.baseQty + t.addQty })
          .eq('id', t.id);
        if (error) throw error;
        await supabase.from('stock_history').insert({
          product_id: t.id,
          quantity_change: t.addQty,
          type: 'in',
          reason: 'Bulk import — quantity merged into existing SKU',
        } as never);
        merged += 1;
      }

      toast({
        title: `${imported} product(s) imported${merged ? `, ${merged} SKU(s) merged` : ''}`,
        description: blocked.length ? `${blocked.length} row(s) blocked due to weight/name mismatch.` : undefined,
      });
      fetchProducts();
      return true;

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Import failed', description: message });
      return false;
    }
  };

  return {
    products: paginatedProducts,
    allProducts: filteredProducts,
    categories,
    suppliers,
    isLoading,
    filters,
    setFilters,
    currentPage,
    setCurrentPage,
    totalPages,
    itemsPerPage,
    lowStockProducts,
    outOfStockProducts,
    inventoryStats,

    createProduct,
    updateProduct,
    deleteProduct,
    bulkImport,
    refresh: fetchProducts,
  };
}
