import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  const itemsPerPage = 10;
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), suppliers(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast the data to our Product type with proper type handling
      const typedProducts = (data || []).map(item => ({
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
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = 
        product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.sku.toLowerCase().includes(filters.search.toLowerCase()) ||
        (product.description?.toLowerCase().includes(filters.search.toLowerCase())) ||
        (product.suppliers?.name?.toLowerCase().includes(filters.search.toLowerCase()));
      
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

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity <= p.low_stock_alert && p.status === 'in_stock');
  }, [products]);

  const createProduct = async (formData: ProductFormData, imageFile?: File) => {
    try {
      let image_url = null;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data: uploadData } = await supabase.storage
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
      };

      const { error } = await supabase.from('products').insert([productData]);
      if (error) throw error;
      
      toast({ title: 'Product added successfully' });
      fetchProducts();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const updateProduct = async (id: string, formData: ProductFormData, imageFile?: File) => {
    try {
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

      const { error } = await supabase.from('products').update(productData).eq('id', id);
      if (error) throw error;
      
      toast({ title: 'Product updated successfully' });
      fetchProducts();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Product deleted' });
      fetchProducts();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const bulkImport = async (productsToImport: Partial<ProductFormData>[]) => {
    try {
      // Filter out products without required fields and cast properly
      const validProducts = productsToImport
        .filter(p => p.sku && p.name)
        .map(p => ({
          sku: p.sku!,
          name: p.name!,
          description: p.description || null,
          metal_type: p.metal_type || null,
          purity: p.purity || null,
          weight_grams: p.weight_grams || 0,
          quantity: p.quantity || 0,
          price_per_gram: p.price_per_gram || 0,
          making_charges: p.making_charges || 0,
          mrp: p.mrp || 0,
          selling_price: p.selling_price || 0,
          purchase_price: p.purchase_price || 0,
          type_of_work: p.type_of_work || 'Others',
          status: p.status || 'in_stock',
          bangle_size: p.bangle_size || null,
          low_stock_alert: p.low_stock_alert || 5,
          gst_percentage: p.gst_percentage || 3,
        }));

      const { error } = await supabase.from('products').insert(validProducts);
      if (error) throw error;
      toast({ title: `${validProducts.length} products imported successfully` });
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
    createProduct,
    updateProduct,
    deleteProduct,
    bulkImport,
    refresh: fetchProducts,
  };
}
