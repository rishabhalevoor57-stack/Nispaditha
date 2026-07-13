import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { METAL_TYPE_OPTIONS, MetalType, normalizeMetalType } from '@/lib/metalTypes';
import { cn } from '@/lib/utils';

interface Props {
  value: string | null | undefined;
  onChange: (v: MetalType) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Standard 4-option metal type dropdown used across Invoices, Custom Orders,
 * Service Forms, Repair, Melting, Buyback, Inventory. Defaults to Silver.
 */
export function MetalTypeSelect({ value, onChange, label = 'Metal Type', className, disabled, compact }: Props) {
  const normalized = normalizeMetalType(value);
  return (
    <div className={cn('space-y-1', className)}>
      {label && <Label className={compact ? 'text-xs' : ''}>{label}</Label>}
      <Select value={normalized} onValueChange={(v) => onChange(v as MetalType)} disabled={disabled}>
        <SelectTrigger className={compact ? 'h-8 text-xs' : ''}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METAL_TYPE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
