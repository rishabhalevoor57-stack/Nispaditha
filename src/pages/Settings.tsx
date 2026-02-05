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
import { useAuth } from '@/contexts/AuthContext';
import { Building, FileText, Tags, Loader2 } from 'lucide-react';

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
  const { toast } = useToast();
  const { userRole } = useAuth();

  const isAdmin = userRole === 'admin';

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
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst_number">GST Number</Label>
                    <Input
                      id="gst_number"
                      value={settings?.gst_number || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, gst_number: e.target.value } : null)}
                      disabled={!isAdmin}
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
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings?.email || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, email: e.target.value } : null)}
                      disabled={!isAdmin}
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
                    disabled={!isAdmin}
                  />
                </div>

                {isAdmin && (
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
                )}

                {!isAdmin && (
                  <p className="text-sm text-muted-foreground">
                    Only administrators can modify business settings.
                  </p>
                )}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
                    <Input
                      id="invoice_prefix"
                      value={settings?.invoice_prefix || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, invoice_prefix: e.target.value } : null)}
                      placeholder="INV"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={settings?.currency || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, currency: e.target.value } : null)}
                      placeholder="INR"
                      disabled={!isAdmin}
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
                      disabled={!isAdmin}
                    />
                  </div>
                </div>

                {isAdmin && (
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
                )}
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
              {isAdmin && (
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
              )}

              <div className="space-y-2">
                {categories.map((cat) => (
                  <div 
                    key={cat.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <span className="font-medium">{cat.name}</span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        Delete
                      </Button>
                    )}
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
      </Tabs>
    </AppLayout>
  );
}
