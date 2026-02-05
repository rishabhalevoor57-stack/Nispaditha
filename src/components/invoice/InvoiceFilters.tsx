import { Button } from '@/components/ui/button';
import { CircleDot, Send, CheckCircle, ListFilter } from 'lucide-react';

export type InvoiceStatusFilter = 'all' | 'draft' | 'sent' | 'paid';

interface InvoiceFiltersProps {
  activeFilter: InvoiceStatusFilter;
  onFilterChange: (filter: InvoiceStatusFilter) => void;
  counts: {
    all: number;
    draft: number;
    sent: number;
    paid: number;
  };
}

export function InvoiceFilters({
  activeFilter,
  onFilterChange,
  counts,
}: InvoiceFiltersProps) {
  const filters: { value: InvoiceStatusFilter; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'all', label: 'All', icon: ListFilter, color: '' },
    { value: 'draft', label: 'Draft', icon: CircleDot, color: 'text-muted-foreground' },
    { value: 'sent', label: 'Sent', icon: Send, color: 'text-blue-600' },
    { value: 'paid', label: 'Paid', icon: CheckCircle, color: 'text-green-600' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {filters.map(({ value, label, icon: Icon, color }) => (
        <Button
          key={value}
          variant={activeFilter === value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(value)}
          className={activeFilter !== value ? color : ''}
        >
          <Icon className="w-4 h-4 mr-1" />
          {label}
          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs">
            {counts[value]}
          </span>
        </Button>
      ))}
    </div>
  );
}
