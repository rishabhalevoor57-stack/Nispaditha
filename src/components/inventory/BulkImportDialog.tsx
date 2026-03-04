import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import type { ProductFormData } from '@/types/inventory';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (products: Partial<ProductFormData>[], onProgress?: (current: number, total: number) => void) => Promise<boolean>;
}

export function BulkImportDialog({ open, onOpenChange, onImport }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Partial<ProductFormData>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importComplete, setImportComplete] = useState(false);
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
      'pricing_mode',
    ];
    
    const sampleRow = [
      'SKU001',
      'Silver Ring 925',
      'Beautiful handmade silver ring',
      'Silver',
      '925',
      '5.5',
      '10',
      '285',
      '150',
      '5000',
      '4500',
      '3500',
      'Handmade',
      'in_stock',
      '',
      '5',
      '3',
      'weight_based',
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
    
    // Validate required columns
    if (!headers.includes('sku') || !headers.includes('name')) {
      throw new Error('CSV must have "sku" and "name" columns');
    }
    
    const products: Partial<ProductFormData>[] = [];
    const numericFields = [
      'weight_grams', 'quantity', 'price_per_gram', 'making_charges', 'mrp',
      'selling_price', 'purchase_price', 'low_stock_alert', 'gst_percentage',
      'purchase_price_per_gram', 'purchase_making_charges'
    ];
    
    for (let i = 1; i < lines.length; i++) {
      // Handle CSV values that might contain commas in quotes
      const values = parseCSVLine(lines[i]);
      const product: Record<string, unknown> = {};
      
      headers.forEach((header, index) => {
        const value = (values[index] || '').trim();
        
        if (numericFields.includes(header)) {
          product[header] = parseFloat(value) || 0;
        } else {
          product[header] = value;
        }
      });
      
      if (product.sku && product.name) {
        products.push(product as Partial<ProductFormData>);
      }
    }
    
    if (products.length === 0) {
      throw new Error('No valid products found. Each row must have at least "sku" and "name".');
    }
    
    return products;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview([]);
    setImportComplete(false);
    setProgress({ current: 0, total: 0 });
    
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
    setImportComplete(false);
    setProgress({ current: 0, total: preview.length });
    
    const success = await onImport(preview, (current, total) => {
      setProgress({ current, total });
    });
    
    setIsImporting(false);
    
    if (success) {
      setImportComplete(true);
      setTimeout(() => {
        onOpenChange(false);
        setFile(null);
        setPreview([]);
        setImportComplete(false);
        setProgress({ current: 0, total: 0 });
      }, 1500);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isImporting) {
      onOpenChange(open);
      if (!open) {
        setFile(null);
        setPreview([]);
        setError(null);
        setImportComplete(false);
        setProgress({ current: 0, total: 0 });
      }
    }
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple products at once. Download the template first to see the required format.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <Button variant="outline" onClick={downloadTemplate} className="w-full" disabled={isImporting}>
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
          
          <div 
            onClick={() => !isImporting && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isImporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'
            }`}
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
              disabled={isImporting}
            />
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {importComplete && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                Successfully imported {progress.current} products!
              </AlertDescription>
            </Alert>
          )}

          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Importing products...</span>
                <span>{progress.current} / {progress.total} ({progressPercent}%)</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}
          
          {preview.length > 0 && !isImporting && !importComplete && (
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
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={preview.length === 0 || isImporting || importComplete}
              className="btn-gold"
            >
              {isImporting ? `Importing... ${progressPercent}%` : `Import ${preview.length} Products`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
