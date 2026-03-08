import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { IndianRupee, Receipt } from 'lucide-react';

interface PeriodData {
  totalSales: number;
  totalGST: number;
  invoiceCount: number;
}

export const GSTSalesSummary = () => {
  const [daily, setDaily] = useState<PeriodData>({ totalSales: 0, totalGST: 0, invoiceCount: 0 });
  const [monthly, setMonthly] = useState<PeriodData>({ totalSales: 0, totalGST: 0, invoiceCount: 0 });
  const [yearly, setYearly] = useState<PeriodData>({ totalSales: 0, totalGST: 0, invoiceCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

      const [todayRes, monthRes, yearRes] = await Promise.all([
        supabase.from('invoices').select('grand_total, gst_amount').gte('created_at', startOfToday),
        supabase.from('invoices').select('grand_total, gst_amount').gte('created_at', startOfMonth),
        supabase.from('invoices').select('grand_total, gst_amount').gte('created_at', startOfYear),
      ]);

      const aggregate = (data: any[] | null): PeriodData => ({
        totalSales: data?.reduce((s, i) => s + Number(i.grand_total), 0) || 0,
        totalGST: data?.reduce((s, i) => s + Number(i.gst_amount), 0) || 0,
        invoiceCount: data?.length || 0,
      });

      setDaily(aggregate(todayRes.data));
      setMonthly(aggregate(monthRes.data));
      setYearly(aggregate(yearRes.data));
    } catch (err) {
      console.error('Error fetching GST/Sales summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const PeriodCard = ({ data, label }: { data: PeriodData; label: string }) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <IndianRupee className="w-4 h-4 text-primary" />
          {label} Sales
        </div>
        <p className="text-xl font-bold">{formatCurrency(data.totalSales)}</p>
        <p className="text-xs text-muted-foreground">{data.invoiceCount} invoice{data.invoiceCount !== 1 ? 's' : ''}</p>
      </div>
      <div className="bg-warning/5 border border-warning/10 rounded-xl p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Receipt className="w-4 h-4 text-warning" />
          {label} GST
        </div>
        <p className="text-xl font-bold text-warning">{formatCurrency(data.totalGST)}</p>
        <p className="text-xs text-muted-foreground">Accumulated GST</p>
      </div>
      <div className="bg-success/5 border border-success/10 rounded-xl p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <IndianRupee className="w-4 h-4 text-success" />
          Net (excl. GST)
        </div>
        <p className="text-xl font-bold text-success">{formatCurrency(data.totalSales - data.totalGST)}</p>
        <p className="text-xs text-muted-foreground">Sales minus GST</p>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">GST & Sales Summary</CardTitle></CardHeader>
        <CardContent><div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading...</div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="w-5 h-5 text-warning" />
          GST & Sales Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="daily">Today</TabsTrigger>
            <TabsTrigger value="monthly">This Month</TabsTrigger>
            <TabsTrigger value="yearly">This Year</TabsTrigger>
          </TabsList>
          <TabsContent value="daily"><PeriodCard data={daily} label="Today's" /></TabsContent>
          <TabsContent value="monthly"><PeriodCard data={monthly} label="Monthly" /></TabsContent>
          <TabsContent value="yearly"><PeriodCard data={yearly} label="Yearly" /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
