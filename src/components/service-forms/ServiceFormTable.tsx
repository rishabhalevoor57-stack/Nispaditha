import { format } from 'date-fns';
import { MoreHorizontal, Printer, CheckCircle2, Edit, Trash2, Play, PackageCheck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ServiceForm, SERVICE_FORM_STATUS_LABELS, SERVICE_FORM_STATUS_COLORS, ServiceFormStatus } from '@/types/serviceForm';

interface Props {
  serviceForms: ServiceForm[];
  onEdit: (sf: ServiceForm) => void;
  onDelete: (sf: ServiceForm) => void;
  onPrint: (sf: ServiceForm) => void;
  onComplete: (sf: ServiceForm) => void;
  onStatusChange: (id: string, status: ServiceFormStatus) => void;
}

export const ServiceFormTable = ({ serviceForms, onEdit, onDelete, onPrint, onComplete, onStatusChange }: Props) => {
  if (serviceForms.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No service forms yet</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Receipt #</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Services</TableHead>
          <TableHead>Date In</TableHead>
          <TableHead>Est. Delivery</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {serviceForms.map(sf => (
          <TableRow key={sf.id}>
            <TableCell className="font-mono text-xs">{sf.receipt_number}</TableCell>
            <TableCell>{sf.client_name}</TableCell>
            <TableCell>{sf.client_phone || '-'}</TableCell>
            <TableCell className="max-w-[180px] truncate">{sf.item_description}</TableCell>
            <TableCell className="max-w-[180px] truncate text-xs">{(sf.service_types || []).join(', ')}</TableCell>
            <TableCell className="text-xs">{format(new Date(sf.created_at), 'dd MMM yyyy')}</TableCell>
            <TableCell className="text-xs">{sf.estimated_delivery_date ? format(new Date(sf.estimated_delivery_date), 'dd MMM yyyy') : '-'}</TableCell>
            <TableCell><Badge className={SERVICE_FORM_STATUS_COLORS[sf.status]}>{SERVICE_FORM_STATUS_LABELS[sf.status]}</Badge></TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(sf)}><Edit className="h-4 w-4 mr-2" />View / Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPrint(sf)}><Printer className="h-4 w-4 mr-2" />Print Receipt</DropdownMenuItem>
                  {sf.status === 'received' && (
                    <DropdownMenuItem onClick={() => onStatusChange(sf.id, 'in_progress')}><Play className="h-4 w-4 mr-2" />Mark In Progress</DropdownMenuItem>
                  )}
                  {sf.status === 'in_progress' && (
                    <DropdownMenuItem onClick={() => onStatusChange(sf.id, 'ready')}><PackageCheck className="h-4 w-4 mr-2" />Mark Ready</DropdownMenuItem>
                  )}
                  {sf.status !== 'completed' && (
                    <DropdownMenuItem onClick={() => onComplete(sf)}><CheckCircle2 className="h-4 w-4 mr-2" />Complete & Bill</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onDelete(sf)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
