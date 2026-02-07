import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { InvoiceSearchStep } from './InvoiceSearchStep';
import { ItemSelectionStep } from './ItemSelectionStep';
import { ReturnDetailsStep } from './ReturnDetailsStep';
import { ExchangeDetailsStep } from './ExchangeDetailsStep';
import type { ReturnItemSelection, ReturnExchangeType } from '@/types/returnExchange';

interface ReturnExchangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  preselectedInvoiceId?: string | null;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_name: string;
  client_phone: string;
}

type Step = 'search' | 'select_items' | 'details';

export function ReturnExchangeDialog({
  open,
  onOpenChange,
  onComplete,
  preselectedInvoiceId,
}: ReturnExchangeDialogProps) {
  const [step, setStep] = useState<Step>('search');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [items, setItems] = useState<ReturnItemSelection[]>([]);
  const [flowType, setFlowType] = useState<ReturnExchangeType>('return');

  const resetDialog = () => {
    setStep('search');
    setInvoiceData(null);
    setItems([]);
    setFlowType('return');
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) resetDialog();
  };

  const handleInvoiceLoaded = (
    data: InvoiceData,
    loadedItems: ReturnItemSelection[]
  ) => {
    setInvoiceData(data);
    setItems(loadedItems);
    setStep('select_items');
  };

  const handleItemsConfirmed = (
    selectedItems: ReturnItemSelection[],
    type: ReturnExchangeType
  ) => {
    setItems(selectedItems);
    setFlowType(type);
    setStep('details');
  };

  const handleComplete = () => {
    handleOpenChange(false);
    onComplete();
  };

  const handleBack = () => {
    if (step === 'details') setStep('select_items');
    else if (step === 'select_items') setStep('search');
  };

  const stepTitle = {
    search: 'Step 1: Find Invoice',
    select_items: 'Step 2: Select Items',
    details: `Step 3: ${flowType === 'return' ? 'Return' : 'Exchange'} Details`,
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            Return / Exchange — {stepTitle[step]}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {['search', 'select_items', 'details'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : i < ['search', 'select_items', 'details'].indexOf(step)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div className="w-12 h-0.5 bg-muted" />
              )}
            </div>
          ))}
        </div>

        {step === 'search' && (
          <InvoiceSearchStep
            onInvoiceLoaded={handleInvoiceLoaded}
            preselectedInvoiceId={preselectedInvoiceId}
          />
        )}

        {step === 'select_items' && invoiceData && (
          <ItemSelectionStep
            invoiceData={invoiceData}
            items={items}
            onBack={handleBack}
            onConfirm={handleItemsConfirmed}
          />
        )}

        {step === 'details' && invoiceData && flowType === 'return' && (
          <ReturnDetailsStep
            invoiceData={invoiceData}
            selectedItems={items.filter((i) => i.selected)}
            onBack={handleBack}
            onComplete={handleComplete}
          />
        )}

        {step === 'details' && invoiceData && flowType === 'exchange' && (
          <ExchangeDetailsStep
            invoiceData={invoiceData}
            returnedItems={items.filter((i) => i.selected)}
            onBack={handleBack}
            onComplete={handleComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
