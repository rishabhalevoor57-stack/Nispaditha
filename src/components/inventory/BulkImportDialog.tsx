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
      'SKU',
      'Product Name',
      'Description',
      'Type of Work',
      'Category',
      'Weight',
      'Qty',
      'Mode',
      'Vendor',
      'Selling Price per gram',
      'Selling MC',
      'Purchase Price per gram',
      'Purchase MC',
      'Date of Purchase',
      'GST',
      'Purity',
    ];
    
    const sampleRow = [
      'SKU001',
      'Silver Ring 925',
      'Beautiful handmade silver ring',
      'Handmade',
      'Ring',
      '5.5',
      '10',
      'weight_based',
      'Vendor Name',
      '285',
      '150',
      '200',
      '100',
      '2026-04-01',
      '3',
      '925',
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

  const normalizeHeader = (header: string): string => {
    return header
      .trim()
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s-]+/g, ' ');
  };

  const detectDelimiter = (text: string): string => {
    const sample = text
      .split('\n')
      .slice(0, 5)
      .join('\n');

    const delimiters = [',', ';', '\t', '|'];
    let best = ',';
    let max = -1;

    delimiters.forEach((delimiter) => {
      const count = sample.split(delimiter).length - 1;
      if (count > max) {
        max = count;
        best = delimiter;
      }
    });

    return best;
  };

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current);
    return result;
  };

  const findColumnIndex = (headers: string[], aliases: readonly string[]): number => {
    const normalizedHeaders = headers.map(normalizeHeader);
    const normalizedAliases = aliases.map(normalizeHeader);

    for (const alias of normalizedAliases) {
      const exact = normalizedHeaders.indexOf(alias);
      if (exact !== -1) return exact;
    }

    for (const alias of normalizedAliases) {
      const startsWith = normalizedHeaders.findIndex((h) => h.startsWith(alias));
      if (startsWith !== -1) return startsWith;
    }

    for (const alias of normalizedAliases) {
      const contains = normalizedHeaders.findIndex((h) => h.includes(alias));
      if (contains !== -1) return contains;
    }

    return -1;
  };

  const parseLocalizedNumber = (value: string): number => {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    let normalized = trimmed.replace(/[₹$€£¥\s]/g, '');
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '');
      normalized = normalized.replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseCSV = (text: string): Partial<ProductFormData>[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error('File must have at least a header and one data row');

    const delimiter = detectDelimiter(lines.slice(0, 5).join('\n'));
    const headers = parseCSVLine(lines[0], delimiter).map((h) => h.trim());

    const columnMap = {
      sku: ['sku', 'product sku', 'item code', 'code'],
      name: ['name', 'product name', 'item name'],
      description: ['description', 'details'],
      metal_type: ['metal_type', 'metal type', 'metal'],
      purity: ['purity', 'karat'],
      weight_grams: ['weight_grams', 'weight grams', 'weight', 'gross weight'],
      quantity: ['quantity', 'qty', 'stock'],
      price_per_gram: ['price_per_gram', 'price per gram', 'rate per gram'],
      making_charges: ['making_charges', 'making charges', 'making charge', 'mc'],
      mrp: ['mrp', 'max retail price'],
      selling_price: ['selling_price', 'selling price', 'sale price'],
      purchase_price: ['purchase_price', 'purchase price', 'cost price'],
      type_of_work: ['type_of_work', 'type of work', 'work type'],
      status: ['status', 'stock status'],
      bangle_size: ['bangle_size', 'bangle size', 'size'],
      low_stock_alert: ['low_stock_alert', 'low stock alert', 'reorder level'],
      gst_percentage: ['gst_percentage', 'gst percentage', 'gst'],
      pricing_mode: ['pricing_mode', 'pricing mode', 'price mode'],
      purchase_price_per_gram: ['purchase_price_per_gram', 'purchase price per gram'],
      purchase_making_charges: ['purchase_making_charges', 'purchase making charges'],
    } as const;

    const indexes = Object.fromEntries(
      Object.entries(columnMap).map(([key, aliases]) => [key, findColumnIndex(headers, aliases)])
    ) as Record<keyof typeof columnMap, number>;

    if (indexes.sku === -1 || indexes.name === -1) {
      throw new Error('CSV must include SKU and Name columns (any common naming variation is supported).');
    }

    const getValue = (values: string[], index: number): string => {
      if (index < 0) return '';
      return (values[index] || '').trim();
    };

    const products: Partial<ProductFormData>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      const sku = getValue(values, indexes.sku);
      const name = getValue(values, indexes.name);

      if (!sku || !name) continue;

      const rawStatus = getValue(values, indexes.status).toLowerCase().replace(/\s+/g, '_');
      const rawPricingMode = getValue(values, indexes.pricing_mode).toLowerCase().replace(/\s+/g, '_');

      const product: Partial<ProductFormData> = {
        sku,
        name,
        description: getValue(values, indexes.description),
        metal_type: getValue(values, indexes.metal_type),
        purity: getValue(values, indexes.purity),
        weight_grams: parseLocalizedNumber(getValue(values, indexes.weight_grams)),
        quantity: Math.round(parseLocalizedNumber(getValue(values, indexes.quantity))),
        price_per_gram: parseLocalizedNumber(getValue(values, indexes.price_per_gram)),
        making_charges: parseLocalizedNumber(getValue(values, indexes.making_charges)),
        mrp: parseLocalizedNumber(getValue(values, indexes.mrp)),
        selling_price: parseLocalizedNumber(getValue(values, indexes.selling_price)),
        purchase_price: parseLocalizedNumber(getValue(values, indexes.purchase_price)),
        type_of_work: getValue(values, indexes.type_of_work),
        status: rawStatus === 'sold' || rawStatus === 'for_repair' ? rawStatus : 'in_stock',
        bangle_size: getValue(values, indexes.bangle_size),
        low_stock_alert: Math.round(parseLocalizedNumber(getValue(values, indexes.low_stock_alert))),
        gst_percentage: parseLocalizedNumber(getValue(values, indexes.gst_percentage)),
        pricing_mode: rawPricingMode === 'flat_price' || rawPricingMode === 'flat' ? 'flat_price' : 'weight_based',
        purchase_price_per_gram: parseLocalizedNumber(getValue(values, indexes.purchase_price_per_gram)),
        purchase_making_charges: parseLocalizedNumber(getValue(values, indexes.purchase_making_charges)),
      };

      products.push(product);
    }

    if (products.length === 0) {
      throw new Error('No valid products found. Each row must include SKU and Name.');
    }

    return products;
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
