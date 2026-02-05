import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building, FileText, Tags, Loader2, Trash2, AlertTriangle } from 'lucide-react';
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

interface BusinessSettings {
  id: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  logo_url: string | null;
  invoice_prefix: string;
  currency: string;
  default_gst: number;
  gold_rate_per_gram: number;
  silver_rate_per_gram: number;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
}

export default function Settings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isResettingOrders, setIsResettingOrders] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchCategories();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('business_settings')
        .update(settings)
        .eq('id', settings.id);

      if (error) throw error;
      toast({ title: 'Settings saved successfully!' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ name: newCategory.trim() }]);

      if (error) throw error;
      toast({ title: 'Category added' });
      setNewCategory('');
      fetchCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleResetAllOrders = async () => {
    if (confirmText !== 'DELETE ALL ORDERS') {
      toast({ variant: 'destructive', title: 'Error', description: 'Please type the confirmation text correctly' });
      return;
    }

    setIsResettingOrders(true);
    try {
      // First delete all invoice items
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (itemsError) throw itemsError;

      // Then delete all invoices
      const { error: invoicesError } = await supabase
        .from('invoices')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (invoicesError) throw invoicesError;

      toast({ title: 'All orders have been deleted successfully!' });
      setConfirmText('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsResettingOrders(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure? Products in this category will lose their category.')) return;

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Category deleted' });
      fetchCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader 
        title="Settings" 
        description="Manage your business settings and preferences"
      />

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Business Profile
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Invoice Settings
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tags className="w-4 h-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Data Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>
                Update your business information. This will appear on invoices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business Name</Label>
                    <Input
                      id="business_name"
                      value={settings?.business_name || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, business_name: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst_number">GST Number</Label>
                    <Input
                      id="gst_number"
                      value={settings?.gst_number || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, gst_number: e.target.value } : null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={settings?.phone || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, phone: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings?.email || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, email: e.target.value } : null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={settings?.address || ''}
                    onChange={(e) => setSettings(s => s ? { ...s, address: e.target.value } : null)}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="btn-gold" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
              <CardDescription>
                Configure invoice generation preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                {/* Metal Rates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="gold_rate_per_gram">Gold Rate (₹/gram)</Label>
                    <Input
                      id="gold_rate_per_gram"
                      type="number"
                      step="0.01"
                      value={settings?.gold_rate_per_gram || 7500}
                      onChange={(e) => setSettings(s => s ? { ...s, gold_rate_per_gram: parseFloat(e.target.value) || 7500 } : null)}
                    />
                    <p className="text-xs text-muted-foreground">Live rate per gram for gold items</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="silver_rate_per_gram">Silver Rate (₹/gram)</Label>
                    <Input
                      id="silver_rate_per_gram"
                      type="number"
                      step="0.01"
                      value={settings?.silver_rate_per_gram || 95}
                      onChange={(e) => setSettings(s => s ? { ...s, silver_rate_per_gram: parseFloat(e.target.value) || 95 } : null)}
                    />
                    <p className="text-xs text-muted-foreground">Live rate per gram for silver items</p>
                  </div>
                </div>

                {/* Invoice Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
                    <Input
                      id="invoice_prefix"
                      value={settings?.invoice_prefix || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, invoice_prefix: e.target.value } : null)}
                      placeholder="INV"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={settings?.currency || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, currency: e.target.value } : null)}
                      placeholder="INR"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_gst">Default GST %</Label>
                    <Input
                      id="default_gst"
                      type="number"
                      step="0.01"
                      value={settings?.default_gst || 3}
                      onChange={(e) => setSettings(s => s ? { ...s, default_gst: parseFloat(e.target.value) || 3 } : null)}
                    />
                  </div>
                </div>

                <Button type="submit" className="btn-gold mt-4" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Product Categories</CardTitle>
              <CardDescription>
                Manage categories for your inventory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-6">
                <Input
                  placeholder="New category name..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                />
                <Button onClick={handleAddCategory} className="btn-gold">
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {categories.map((cat) => (
                  <div 
                    key={cat.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <span className="font-medium">{cat.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCategory(cat.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>

              {categories.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No categories found. Add your first category above.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card className="shadow-card border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions that affect your data. Please be careful.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reset All Orders */}
              <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-foreground">Reset All Orders</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently delete all invoices and invoice items. This action cannot be undone.
                      Stock quantities will NOT be restored.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="shrink-0">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Reset Orders
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <span className="block">
                            This will permanently delete <strong>ALL invoices</strong> and their items from your database.
                          </span>
                          <span className="block text-destructive font-medium">
                            This action cannot be undone. Stock quantities will NOT be restored.
                          </span>
                          <span className="block mt-4">
                            Type <strong className="font-mono bg-muted px-1 py-0.5 rounded">DELETE ALL ORDERS</strong> to confirm:
                          </span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Type DELETE ALL ORDERS"
                        className="font-mono"
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleResetAllOrders}
                          disabled={confirmText !== 'DELETE ALL ORDERS' || isResettingOrders}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isResettingOrders ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete All Orders'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
