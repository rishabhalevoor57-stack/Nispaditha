import { format } from 'date-fns';
import { Edit, Eye, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomOrder, CustomOrderStatus, CUSTOM_ORDER_STATUS_LABELS, CUSTOM_ORDER_STATUS_COLORS } from '@/types/customOrder';
import { useAuth } from '@/contexts/AuthContext';

interface CustomOrderTableProps {
  orders: CustomOrder[];
  onView: (order: CustomOrder) => void;
  onEdit: (order: CustomOrder) => void;
  onDelete: (order: CustomOrder) => void;
  onStatusChange: (id: string, status: CustomOrderStatus) => void;
}

export const CustomOrderTable = ({ orders, onView, onEdit, onDelete, onStatusChange }: CustomOrderTableProps) => {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  if (orders.length === 0) {
    return <div className="text-center py-12 text-muted-foreground"><p>No custom orders found</p></div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.reference_number}</TableCell>
              <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
              <TableCell>{order.client_name}</TableCell>
              <TableCell>{order.phone_number || '-'}</TableCell>
              <TableCell className="text-right font-medium">₹{order.total_amount.toLocaleString('en-IN')}</TableCell>
              <TableCell>
                {order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy') : '-'}
              </TableCell>
              <TableCell>
                <Select value={order.status} onValueChange={(v) => onStatusChange(order.id, v as CustomOrderStatus)}>
                  <SelectTrigger className="h-8 w-[140px]">
                    <Badge className={CUSTOM_ORDER_STATUS_COLORS[order.status]}>
                      {CUSTOM_ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CUSTOM_ORDER_STATUS_LABELS) as CustomOrderStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <Badge className={CUSTOM_ORDER_STATUS_COLORS[s]}>{CUSTOM_ORDER_STATUS_LABELS[s]}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {order.converted_to_invoice_id ? (
                  <Badge variant="outline" className="text-primary">
                    <FileText className="h-3 w-3 mr-1" />
                    Converted
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onView(order)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(order)}><Edit className="h-4 w-4" /></Button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => onDelete(order)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
