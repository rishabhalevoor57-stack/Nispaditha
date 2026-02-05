import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, X } from 'lucide-react';
import { 
  ProductFormData, 
  Product, 
  TYPE_OF_WORK_OPTIONS, 
  STATUS_OPTIONS, 
  initialProductForm,
  TypeOfWork,
  ProductStatus,
} from '@/types/inventory';

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  categories: Category[];
  suppliers: Supplier[];
  onSubmit: (data: ProductFormData, imageFile?: File) => Promise<boolean>;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  suppliers,
  onSubmit,
}: ProductFormDialogProps) {
  const [formData, setFormData] = useState<ProductFormData>(initialProductForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        category_id: product.category_id || '',
        metal_type: product.metal_type || '',
        purity: product.purity || '',
        weight_grams: product.weight_grams,
        quantity: product.quantity,
        purchase_price: product.purchase_price,
        selling_price: product.selling_price,
        making_charges: product.making_charges,
        gst_percentage: product.gst_percentage,
        low_stock_alert: product.low_stock_alert,
        supplier_id: product.supplier_id || '',
        type_of_work: product.type_of_work,
        bangle_size: product.bangle_size || '',
        date_ordered: product.date_ordered || new Date().toISOString().split('T')[0],
        price_per_gram: product.price_per_gram,
        status: product.status,
        mrp: product.mrp,
        purchase_price_per_gram: product.purchase_price_per_gram || 0,
        purchase_making_charges: product.purchase_making_charges || 0,
      });
      setImagePreview(product.image_url);
    } else {
      setFormData(initialProductForm);
      setImagePreview(null);
    }
    setImageFile(null);
  }, [product, open]);

  // Auto-calculate selling price from price per gram and making charges
  const calculatedSellingPrice = useMemo(() => {
    const goldValue = formData.weight_grams * formData.price_per_gram;
    return goldValue + formData.making_charges;
  }, [formData.weight_grams, formData.price_per_gram, formData.making_charges]);

  // Auto-calculate purchase price from purchase price per gram and purchase making charges
  const calculatedPurchasePrice = useMemo(() => {
    const goldValue = formData.weight_grams * formData.purchase_price_per_gram;
    return goldValue + formData.purchase_making_charges;
  }, [formData.weight_grams, formData.purchase_price_per_gram, formData.purchase_making_charges]);

  // Update selling price when components change
  useEffect(() => {
    if (calculatedSellingPrice > 0) {
      setFormData(prev => ({ ...prev, selling_price: calculatedSellingPrice }));
    }
  }, [calculatedSellingPrice]);

  // Update purchase price when components change
  useEffect(() => {
    if (calculatedPurchasePrice > 0) {
      setFormData(prev => ({ ...prev, purchase_price: calculatedPurchasePrice }));
    }
  }, [calculatedPurchasePrice]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (0.2MB - 30MB)
      const minSize = 0.2 * 1024 * 1024;
      const maxSize = 30 * 1024 * 1024;
      
      if (file.size < minSize) {
        alert('Image must be at least 0.2MB');
        return;
      }
      if (file.size > maxSize) {
        alert('Image must be less than 30MB');
        return;
      }
      
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const success = await onSubmit(formData, imageFile || undefined);
    
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const updateField = <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Product Image (0.2MB - 30MB)</Label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <div className="relative w-24 h-24">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 w-6 h-6"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                >
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Upload</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Product Code *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
            />
          </div>

          {/* Category & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(v) => updateField('category_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type of Work</Label>
              <Select
                value={formData.type_of_work}
                onValueChange={(v) => updateField('type_of_work', v as TypeOfWork)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OF_WORK_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => updateField('status', v as ProductStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metal Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metal_type">Metal Type</Label>
              <Input
                id="metal_type"
                value={formData.metal_type}
                onChange={(e) => updateField('metal_type', e.target.value)}
                placeholder="e.g., Gold, Silver"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purity">Purity</Label>
              <Input
                id="purity"
                value={formData.purity}
                onChange={(e) => updateField('purity', e.target.value)}
                placeholder="e.g., 22K, 18K"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (grams) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.001"
                value={formData.weight_grams}
                onChange={(e) => updateField('weight_grams', parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bangle_size">Bangle Size</Label>
              <Input
                id="bangle_size"
                value={formData.bangle_size}
                onChange={(e) => updateField('bangle_size', e.target.value)}
                placeholder="e.g., 2.4, 2.6"
              />
            </div>
          </div>

          {/* Quantity & Stock */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Number of Pieces *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="low_stock">Low Stock Alert Level</Label>
              <Input
                id="low_stock"
                type="number"
                value={formData.low_stock_alert}
                onChange={(e) => updateField('low_stock_alert', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_ordered">Date Ordered</Label>
              <Input
                id="date_ordered"
                type="date"
                value={formData.date_ordered}
                onChange={(e) => updateField('date_ordered', e.target.value)}
              />
            </div>
          </div>

          {/* Pricing - Selling Price Components */}
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="text-sm font-semibold mb-3">Selling Price Calculation</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_per_gram">Price Per Gram (₹) *</Label>
                  <Input
                    id="price_per_gram"
                    type="number"
                    value={formData.price_per_gram}
                    onChange={(e) => updateField('price_per_gram', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="making_charges">Making Charges (₹) *</Label>
                  <Input
                    id="making_charges"
                    type="number"
                    value={formData.making_charges}
                    onChange={(e) => updateField('making_charges', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calculated Selling Price</Label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-background flex items-center">
                    <span className="text-sm text-muted-foreground mr-1">₹</span>
                    <span className="font-semibold">{calculatedSellingPrice.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ({formData.weight_grams}g × ₹{formData.price_per_gram}) + ₹{formData.making_charges} MC
                  </p>
                </div>
              </div>
            </div>

            {/* Purchase Price Calculation */}
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="text-sm font-semibold mb-3">Purchase Price Calculation</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_price_per_gram">Purchase Price Per Gram (₹)</Label>
                  <Input
                    id="purchase_price_per_gram"
                    type="number"
                    value={formData.purchase_price_per_gram}
                    onChange={(e) => updateField('purchase_price_per_gram', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_making_charges">Purchase Making Charges (₹)</Label>
                  <Input
                    id="purchase_making_charges"
                    type="number"
                    value={formData.purchase_making_charges}
                    onChange={(e) => updateField('purchase_making_charges', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calculated Purchase Price</Label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-background flex items-center">
                    <span className="text-sm text-muted-foreground mr-1">₹</span>
                    <span className="font-semibold">{calculatedPurchasePrice.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ({formData.weight_grams}g × ₹{formData.purchase_price_per_gram}) + ₹{formData.purchase_making_charges} MC
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mrp">MRP (₹)</Label>
                <Input
                  id="mrp"
                  type="number"
                  value={formData.mrp}
                  onChange={(e) => updateField('mrp', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gst">GST %</Label>
              <Input
                id="gst"
                type="number"
                step="0.01"
                value={formData.gst_percentage}
                onChange={(e) => updateField('gst_percentage', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vendor / Supplier</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(v) => updateField('supplier_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="btn-gold" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
