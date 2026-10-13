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
import * as XLSX from 'xlsx';
import { parseInventoryCSV } from '@/lib/inventoryImport';
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
      'List Price',
      'Purchase Price per gram',
      'Purchase MC',
      'Date of Purchase',
      'GST',
      'Purity',
      'Metal',
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
      '',
      '200',
      '100',
      '2026-04-01',
      '3',
      '925',
      'Silver',
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview([]);
    setImportComplete(false);
    setProgress({ current: 0, total: 0 });
    setFile(null);
    if (!selectedFile) return;
    if (!/\.(csv|xlsx|xls)$/i.test(selectedFile.name)) {
      setError('Please upload a CSV or Excel file');
      return;
    }
    setFile(selectedFile);
    try {
      const text = /\.csv$/i.test(selectedFile.name)
        ? await selectedFile.text()
        : await selectedFile.arrayBuffer().then(buffer => {
            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            if (!sheet) throw new Error('Excel file has no worksheet');
            return XLSX.utils.sheet_to_csv(sheet, { dateNF: 'yyyy-mm-dd' });
          });
      setPreview(parseInventoryCSV(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
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
            Upload a CSV or Excel file to import multiple products at once. Download the template first to see the required format.
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
            <p className="text-xs text-muted-foreground mt-1">CSV or Excel files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
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
