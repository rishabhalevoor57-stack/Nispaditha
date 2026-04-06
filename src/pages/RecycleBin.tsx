import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface DeletedProduct {
  id: string;
  sku: string;
  name: string;
  metal_type: string | null;
  weight_grams: number;
  selling_price: number;
  quantity: number;
  deleted_at: string;
  categories: { name: string } | null;
  suppliers: { name: string } | null;
}

export default function RecycleBin() {
  const [deletedProducts, setDeletedProducts] = useState<DeletedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { userRole, loading: authLoading } = useAuth();
  const isAdmin = userRole === 'admin';
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return; // Wait for role to load
    if (!isAdmin) {
      navigate('/inventory');
      return;
    }
    fetchDeleted();
  }, [isAdmin, authLoading]);

  const fetchDeleted = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, name, metal_type, weight_grams, selling_price, quantity, deleted_at, categories(name), suppliers(name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error loading deleted products' });
    } else {
      setDeletedProducts((data as any) || []);
    }
    setIsLoading(false);
  };

  const handleRestore = async (id: string) => {
    const { error } = await supabase.from('products').update({ deleted_at: null }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error restoring product' });
    } else {
      toast({ title: 'Product restored successfully' });
      setDeletedProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handlePermanentDelete = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error deleting product' });
    } else {
      toast({ title: 'Product permanently deleted' });
      setDeletedProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEmptyBin = async () => {
    const ids = deletedProducts.map(p => p.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) {
      toast({ variant: 'destructive', title: 'Error emptying recycle bin' });
    } else {
      toast({ title: 'Recycle bin emptied' });
      setDeletedProducts([]);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Recycle Bin"
        description="Recover or permanently delete removed products"
        actions={
          deletedProducts.length > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Empty Bin ({deletedProducts.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Empty Recycle Bin?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {deletedProducts.length} products. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEmptyBin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : undefined
        }
      />

      {deletedProducts.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Trash2 className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Recycle bin is empty</p>
          <p className="text-sm">Deleted products will appear here for recovery</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Weight (g)</TableHead>
                <TableHead>Price (₹)</TableHead>
                <TableHead>Deleted On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : (
                deletedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.categories?.name || '-'}</Badge>
                    </TableCell>
                    <TableCell>{Number(product.weight_grams).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(product.selling_price).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {product.deleted_at ? format(new Date(product.deleted_at), 'dd MMM yyyy, hh:mm a') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRestore(product.id)}>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{product.name}" ({product.sku}) will be permanently deleted. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePermanentDelete(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete Forever
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppLayout>
  );
}
