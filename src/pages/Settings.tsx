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
import { Building, FileText, Tags, Loader2, Trash2, AlertTriangle, Pencil, Check, X } from 'lucide-react';
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
  parent_id: string | null;
}

export default function Settings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isResettingOrders, setIsResettingOrders] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [categoryProductCounts, setCategoryProductCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchCategories();
    fetchCategoryProductCounts();
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

  const fetchCategoryProductCounts = async () => {
    const { data } = await supabase
      .from('products')
      .select('category_id');
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((p) => {
        if (p.category_id) {
          counts[p.category_id] = (counts[p.category_id] || 0) + 1;
        }
      });
      setCategoryProductCounts(counts);
    }
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

  const handleAddCategory = async (parentId?: string | null) => {
    const name = parentId ? newSubCategory.trim() : newCategory.trim();
    if (!name) return;

    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ name, parent_id: parentId || null }]);

      if (error) throw error;
      toast({ title: parentId ? 'Sub-category added' : 'Category added' });
      if (parentId) {
        setNewSubCategory('');
      } else {
        setNewCategory('');
      }
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
    // Check if products exist in this category
    const productCount = categoryProductCounts[id] || 0;
    // Also check child categories
    const childIds = categories.filter(c => c.parent_id === id).map(c => c.id);
    const childProductCount = childIds.reduce((sum, cid) => sum + (categoryProductCounts[cid] || 0), 0);
    const grandChildIds = childIds.flatMap(cid => categories.filter(c => c.parent_id === cid).map(c => c.id));
    const grandChildProductCount = grandChildIds.reduce((sum, cid) => sum + (categoryProductCounts[cid] || 0), 0);
    const totalProducts = productCount + childProductCount + grandChildProductCount;

    if (totalProducts > 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Cannot delete', 
        description: `This category has ${totalProducts} product(s) assigned. Remove or reassign them first.` 
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Category deleted' });
      fetchCategories();
      fetchCategoryProductCounts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleEditCategory = async (id: string) => {
    const trimmedName = editCategoryName.trim();
    if (!trimmedName) return;

    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: trimmedName })
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Category renamed' });
      setEditingCategoryId(null);
      setEditCategoryName('');
      fetchCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
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
              {/* Add top-level category */}
              <div className="flex gap-3 mb-6">
                <Input
                  placeholder="New category name..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                />
                <Button onClick={() => handleAddCategory()} className="btn-gold">
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {categories.filter(c => !c.parent_id).map((cat) => {
                  const subCats = categories.filter(c => c.parent_id === cat.id);
                  const subSubGetter = (parentId: string) => categories.filter(c => c.parent_id === parentId);
                  const catProductCount = categoryProductCounts[cat.id] || 0;
                  return (
                    <div key={cat.id} className="rounded-lg border bg-muted/30">
                      {/* Parent Category */}
                      <div className="flex items-center justify-between p-3">
                        {editingCategoryId === cat.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <Input
                              value={editCategoryName}
                              onChange={(e) => setEditCategoryName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleEditCategory(cat.id)}
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditCategory(cat.id)}>
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingCategoryId(null)}>
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cat.name}</span>
                            {catProductCount > 0 && (
                              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{catProductCount}</span>
                            )}
                          </div>
                        )}
                        {editingCategoryId !== cat.id && (
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditCategory(cat)} title="Rename">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedParentId(selectedParentId === cat.id ? null : cat.id)}
                            >
                              + Sub
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteCategory(cat.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Add sub-category input */}
                      {selectedParentId === cat.id && (
                        <div className="flex gap-2 px-3 pb-3">
                          <Input
                            placeholder="Sub-category name..."
                            value={newSubCategory}
                            onChange={(e) => setNewSubCategory(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory(cat.id))}
                            className="h-8 text-sm"
                          />
                          <Button size="sm" onClick={() => handleAddCategory(cat.id)}>Add</Button>
                        </div>
                      )}

                      {/* Sub-categories */}
                      {subCats.length > 0 && (
                        <div className="border-t">
                          {subCats.map((sub) => {
                            const subSubs = subSubGetter(sub.id);
                            const subProductCount = categoryProductCounts[sub.id] || 0;
                            return (
                              <div key={sub.id}>
                                <div className="flex items-center justify-between pl-8 pr-3 py-2 bg-muted/20">
                                  {editingCategoryId === sub.id ? (
                                    <div className="flex items-center gap-2 flex-1 mr-2">
                                      <Input
                                        value={editCategoryName}
                                        onChange={(e) => setEditCategoryName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleEditCategory(sub.id)}
                                        className="h-7 text-sm"
                                        autoFocus
                                      />
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditCategory(sub.id)}>
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCategoryId(null)}>
                                        <X className="w-3.5 h-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">↳ {sub.name}</span>
                                      {subProductCount > 0 && (
                                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{subProductCount}</span>
                                      )}
                                    </div>
                                  )}
                                  {editingCategoryId !== sub.id && (
                                    <div className="flex items-center gap-2">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditCategory(sub)} title="Rename">
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => setSelectedParentId(selectedParentId === sub.id ? null : sub.id)}
                                      >
                                        + Sub
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive h-6 text-xs"
                                        onClick={() => handleDeleteCategory(sub.id)}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* Add sub-sub-category input */}
                                {selectedParentId === sub.id && (
                                  <div className="flex gap-2 pl-8 pr-3 py-2">
                                    <Input
                                      placeholder="Sub-sub-category name..."
                                      value={newSubCategory}
                                      onChange={(e) => setNewSubCategory(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory(sub.id))}
                                      className="h-8 text-sm"
                                    />
                                    <Button size="sm" onClick={() => handleAddCategory(sub.id)}>Add</Button>
                                  </div>
                                )}

                                {/* Sub-sub-categories */}
                                {subSubs.map((subSub) => {
                                  const subSubProductCount = categoryProductCounts[subSub.id] || 0;
                                  return (
                                    <div key={subSub.id} className="flex items-center justify-between pl-14 pr-3 py-2 bg-muted/10">
                                      {editingCategoryId === subSub.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-2">
                                          <Input
                                            value={editCategoryName}
                                            onChange={(e) => setEditCategoryName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleEditCategory(subSub.id)}
                                            className="h-7 text-xs"
                                            autoFocus
                                          />
                                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEditCategory(subSub.id)}>
                                            <Check className="w-3 h-3 text-green-600" />
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingCategoryId(null)}>
                                            <X className="w-3 h-3 text-destructive" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs">↳ {subSub.name}</span>
                                          {subSubProductCount > 0 && (
                                            <span className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">{subSubProductCount}</span>
                                          )}
                                        </div>
                                      )}
                                      {editingCategoryId !== subSub.id && (
                                        <div className="flex items-center gap-1">
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditCategory(subSub)} title="Rename">
                                            <Pencil className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive h-6 text-xs"
                                            onClick={() => handleDeleteCategory(subSub.id)}
                                          >
                                            Delete
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
