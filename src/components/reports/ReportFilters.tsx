import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DatePreset, ReportFilters as Filters } from '@/hooks/useReports';

interface ReportFiltersProps {
  filters: Filters;
  stores: { id: string; store_name: string }[];
  onPresetChange: (preset: DatePreset) => void;
  onCustomDates: (from: Date, to: Date) => void;
  onStoreChange: (storeId: string) => void;
}

export const ReportFiltersBar = ({ filters, stores, onPresetChange, onCustomDates, onStoreChange }: ReportFiltersProps) => {
  const presets: { value: DatePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'this_month', label: 'This Month' },
    { value: 'this_year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-xl border shadow-sm">
      <div className="flex items-center gap-2">
        {presets.map(p => (
          <Button
            key={p.value}
            size="sm"
            variant={filters.datePreset === p.value ? 'default' : 'outline'}
            onClick={() => p.value !== 'custom' && onPresetChange(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('gap-2', filters.datePreset === 'custom' && 'border-primary')}>
              <CalendarIcon className="w-4 h-4" />
              {format(filters.dateFrom, 'dd MMM yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => date && onCustomDates(date, filters.dateTo)}
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground text-sm">to</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('gap-2', filters.datePreset === 'custom' && 'border-primary')}>
              <CalendarIcon className="w-4 h-4" />
              {format(filters.dateTo, 'dd MMM yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => date && onCustomDates(filters.dateFrom, date)}
            />
          </PopoverContent>
        </Popover>
      </div>

      {stores.length > 1 && (
        <Select value={filters.storeId} onValueChange={onStoreChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
