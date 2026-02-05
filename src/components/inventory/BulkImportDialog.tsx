import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ProductFormData } from '@/types/inventory';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: Partial<ProductFormData>[]) => Promise<boolean>;
}

export function BulkImportDialog({ open, onOpenChange, onImport }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Partial<ProductFormData>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'sku',
      'name',
      'description',
      'metal_type',
      'purity',
      'weight_grams',
      'quantity',
      'price_per_gram',
      'making_charges',
      'mrp',
      'selling_price',
      'purchase_price',
      'type_of_work',
      'status',
      'bangle_size',
      'low_stock_alert',
      'gst_percentage',
    ];
    
    const sampleRow = [
      'SKU001',
      'Gold Ring 22K',
      'Beautiful handmade gold ring',
      'Gold',
      '22K',
      '5.5',
      '10',
      '6500',
      '1500',
      '45000',
      '42000',
      '35000',
      'Handmade',
      'in_stock',
      '',
      '5',
      '3',
    ];
    
    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Partial<ProductFormData>[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('File must have at least a header and one data row');
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const products: Partial<ProductFormData>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const product: Record<string, unknown> = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        // Parse numeric fields
        if (['weight_grams', 'quantity', 'price_per_gram', 'making_charges', 'mrp', 
             'selling_price', 'purchase_price', 'low_stock_alert', 'gst_percentage'].includes(header)) {
          product[header] = parseFloat(value) || 0;
        } else {
          product[header] = value;
        }
      });
      
      if (product.sku && product.name) {
        products.push(product as Partial<ProductFormData>);
      }
    }
    
    return products;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview([]);
    
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }
    
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const products = parseCSV(text);
        setPreview(products);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    
    setIsImporting(true);
    const success = await onImport(preview);
    setIsImporting(false);
    
    if (success) {
      onOpenChange(false);
      setFile(null);
      setPreview([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple products at once.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {file ? file.name : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {preview.length > 0 && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium mb-2">
                Preview: {preview.length} products to import
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.slice(0, 5).map((p, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {p.sku} - {p.name}
                  </p>
                ))}
                {preview.length > 5 && (
                  <p className="text-sm text-muted-foreground">
                    ...and {preview.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={preview.length === 0 || isImporting}
              className="btn-gold"
            >
              {isImporting ? 'Importing...' : `Import ${preview.length} Products`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
