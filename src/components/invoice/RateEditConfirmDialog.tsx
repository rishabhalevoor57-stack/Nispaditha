import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RateEditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalRate: number;
  newRate: number;
  productName: string;
  onConfirm: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export function RateEditConfirmDialog({
  open,
  onOpenChange,
  originalRate,
  newRate,
  productName,
  onConfirm,
}: RateEditConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Rate Change</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              You are about to change the rate for <strong>{productName}</strong>
            </span>
            <span className="block">
              <span className="text-muted-foreground">Current Rate: </span>
              <span className="font-medium">{formatCurrency(originalRate)}/gram</span>
            </span>
            <span className="block">
              <span className="text-muted-foreground">New Rate: </span>
              <span className="font-medium text-primary">{formatCurrency(newRate)}/gram</span>
            </span>
            <span className="block mt-2 text-warning">
              This overrides the live metal rate. Are you sure?
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="btn-gold">
            Confirm Change
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
