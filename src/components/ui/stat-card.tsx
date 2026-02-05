import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'gold' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'border-l-primary',
  gold: 'border-l-gold',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-destructive',
};

const iconVariantStyles = {
  default: 'bg-primary/10 text-primary',
  gold: 'bg-gold/10 text-gold',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

export const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'default' 
}: StatCardProps) => {
  return (
    <div className={cn(
      'bg-card rounded-xl border border-l-4 p-6 shadow-card transition-all duration-200 hover:shadow-md',
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'text-xs font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last period
            </p>
          )}
        </div>
        <div className={cn(
          'flex items-center justify-center w-12 h-12 rounded-xl',
          iconVariantStyles[variant]
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
