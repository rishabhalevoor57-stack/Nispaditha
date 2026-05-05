import { cn } from '@/lib/utils';

export type MetalRateOption = 'gold_22k' | 'gold_18k' | 'silver' | 'none';

interface MetalRateToggleProps {
  value: MetalRateOption;
  onChange: (value: MetalRateOption) => void;
  goldRate: number; // gold rate per gram (22K)
  silverRate: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

const OPTIONS: { key: MetalRateOption; label: string }[] = [
  { key: 'gold_22k', label: 'Gold 22K' },
  { key: 'gold_18k', label: 'Gold 18K' },
  { key: 'silver', label: 'Silver' },
  { key: 'none', label: 'None' },
];

export function MetalRateToggle({ value, onChange, goldRate, silverRate }: MetalRateToggleProps) {
  const rateLabel = (() => {
    if (value === 'gold_22k') return `Gold 22K: ₹ ${fmt(goldRate)}/g (from software)`;
    if (value === 'gold_18k') return `Gold 18K: ₹ ${fmt(goldRate * (18 / 22))}/g (from software)`;
    if (value === 'silver') return `Silver: ₹ ${fmt(silverRate)}/g (from software)`;
    return 'No metal rate selected';
  })();

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/40 border">
        {OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                active ? 'text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              style={active ? { backgroundColor: '#4a2060' } : undefined}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">{rateLabel}</span>
    </div>
  );
}
