import { format } from 'date-fns';
import { Edit, Eye, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  OrderNote,
  OrderNoteStatus,
  ORDER_NOTE_STATUS_LABELS,
  ORDER_NOTE_STATUS_COLORS,
} from '@/types/orderNote';
import { useAuth } from '@/contexts/AuthContext';

interface OrderNoteTableProps {
  orderNotes: OrderNote[];
  onView: (orderNote: OrderNote) => void;
  onEdit: (orderNote: OrderNote) => void;
  onDelete: (orderNote: OrderNote) => void;
  onPrint: (orderNote: OrderNote) => void;
  onStatusChange: (id: string, status: OrderNoteStatus) => void;
}

export const OrderNoteTable = ({
  orderNotes,
  onView,
  onEdit,
  onDelete,
  onPrint,
  onStatusChange,
}: OrderNoteTableProps) => {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  if (orderNotes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No order notes found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Estimate</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderNotes.map((note) => (
            <TableRow key={note.id}>
              <TableCell className="font-medium">{note.order_reference}</TableCell>
              <TableCell>{format(new Date(note.order_date), 'dd/MM/yyyy')}</TableCell>
              <TableCell>{note.customer_name}</TableCell>
              <TableCell>{note.phone_number || '-'}</TableCell>
              <TableCell>₹{note.quoted_estimate?.toLocaleString('en-IN') || '0'}</TableCell>
              <TableCell className={note.balance > 0 ? 'text-amber-600 font-medium' : ''}>
                ₹{note.balance?.toLocaleString('en-IN') || '0'}
              </TableCell>
              <TableCell>
                {note.expected_delivery_date
                  ? format(new Date(note.expected_delivery_date), 'dd/MM/yyyy')
                  : '-'}
              </TableCell>
              <TableCell>
                <Select
                  value={note.status}
                  onValueChange={(value) => onStatusChange(note.id, value as OrderNoteStatus)}
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <Badge className={ORDER_NOTE_STATUS_COLORS[note.status]}>
                      {ORDER_NOTE_STATUS_LABELS[note.status]}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORDER_NOTE_STATUS_LABELS) as OrderNoteStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        <Badge className={ORDER_NOTE_STATUS_COLORS[status]}>
                          {ORDER_NOTE_STATUS_LABELS[status]}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onView(note)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(note)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onPrint(note)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => onDelete(note)}>
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
