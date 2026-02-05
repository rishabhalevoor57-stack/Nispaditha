import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, BarChart3, ChevronRight, IndianRupee } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useStockValuation, CategoryStockData, ProductForValuation } from '@/hooks/useStockValuation';
import { cn } from '@/lib/utils';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(30, 70%, 50%)',
  'hsl(160, 70%, 50%)',
];

export const CategoryStockValuation = () => {
  const { categoryData, totals, silverRate, isLoading, getProductsByCategory } = useStockValuation();
  const [selectedCategory, setSelectedCategory] = useState<CategoryStockData | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<ProductForValuation[]>([]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatWeight = (weight: number) => {
    return weight.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + 'g';
  };

  const handleCategoryClick = (category: CategoryStockData) => {
    const products = getProductsByCategory(category.categoryId);
    setCategoryProducts(products);
    setSelectedCategory(category);
  };

  // Prepare chart data
  const pieData = categoryData.map((cat, index) => ({
    name: cat.categoryName,
    value: cat.stockValue,
    color: COLORS[index % COLORS.length],
  }));

  const barData = categoryData.slice(0, 8).map((cat) => ({
    name: cat.categoryName.length > 10 ? cat.categoryName.slice(0, 10) + '...' : cat.categoryName,
    fullName: cat.categoryName,
    value: cat.stockValue,
    weight: cat.totalWeight,
    quantity: cat.totalQuantity,
  }));

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-primary" />
            Category-wise Stock Valuation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="col-span-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4 text-primary" />
              Category-wise Stock Valuation
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Rate: ₹{silverRate}/g
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Categories</p>
              <p className="text-lg font-bold">{categoryData.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Items</p>
              <p className="text-lg font-bold">{totals.totalItems}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Weight</p>
              <p className="text-lg font-bold">{formatWeight(totals.totalWeight)}</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
              <p className="text-xs text-muted-foreground">Total Stock Value</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totals.totalStockValue)}</p>
            </div>
          </div>

          <Tabs defaultValue="table" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="pie">Pie Chart</TabsTrigger>
              <TabsTrigger value="bar">Bar Chart</TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <ScrollArea className="h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Weight (g)</TableHead>
                      <TableHead className="text-right">Stock Value (₹)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.map((category, index) => (
                      <TableRow
                        key={category.categoryId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleCategoryClick(category)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{category.categoryName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{category.totalItems}</TableCell>
                        <TableCell className="text-right">{category.totalQuantity}</TableCell>
                        <TableCell className="text-right">{formatWeight(category.totalWeight)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(category.stockValue)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {categoryData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No inventory items found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pie">
              <div className="h-64 flex items-center justify-center">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Category: ${label}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground">No data to display</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="bar">
              <div className="h-64">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical">
                      <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={80} fontSize={12} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'value') return [formatCurrency(value), 'Stock Value'];
                          return [value, name];
                        }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data to display
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Category Detail Dialog */}
      <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {selectedCategory?.categoryName} - Stock Details
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Items</p>
              <p className="text-lg font-bold">{selectedCategory?.totalItems}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Quantity</p>
              <p className="text-lg font-bold">{selectedCategory?.totalQuantity}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Weight</p>
              <p className="text-lg font-bold">{selectedCategory ? formatWeight(selectedCategory.totalWeight) : '-'}</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
              <p className="text-xs text-muted-foreground">Stock Value</p>
              <p className="text-lg font-bold text-primary">
                {selectedCategory ? formatCurrency(selectedCategory.stockValue) : '-'}
              </p>
            </div>
          </div>

          <ScrollArea className="h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Weight (g)</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total Weight</TableHead>
                  <TableHead className="text-right">Value (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryProducts.map((product) => {
                  const totalWeight = product.weight_grams * product.quantity;
                  const value = totalWeight * silverRate;
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="text-right">{product.weight_grams.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right">{formatWeight(totalWeight)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(value)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
