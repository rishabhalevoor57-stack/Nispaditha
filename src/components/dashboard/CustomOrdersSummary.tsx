import { useCustomOrders } from '@/hooks/useCustomOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hammer, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CUSTOM_ORDER_STATUS_LABELS, CUSTOM_ORDER_STATUS_COLORS, CustomOrderStatus } from '@/types/customOrder';

const TRACKED_STATUSES: CustomOrderStatus[] = ['order_noted', 'design_approved', 'in_production', 'ready'];

export const CustomOrdersSummary = () => {
  const { customOrders, isLoading } = useCustomOrders();
  const navigate = useNavigate();

  const counts = TRACKED_STATUSES.reduce((acc, status) => {
    acc[status] = customOrders.filter(o => o.status === status).length;
    return acc;
  }, {} as Record<CustomOrderStatus, number>);

  const total = TRACKED_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hammer className="w-5 h-5 text-primary" />
            Custom Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Hammer className="w-5 h-5 text-primary" />
            Custom Orders
            <Badge variant="secondary" className="ml-1">{total} active</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/custom-orders')} className="text-xs gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {TRACKED_STATUSES.map(status => (
            <div key={status} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
              <Badge className={CUSTOM_ORDER_STATUS_COLORS[status]} variant="secondary">
                {CUSTOM_ORDER_STATUS_LABELS[status]}
              </Badge>
              <span className="text-lg font-semibold">{counts[status]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
