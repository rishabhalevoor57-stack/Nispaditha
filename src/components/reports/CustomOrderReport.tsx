import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Download, Hammer, Clock, CheckCircle, Truck } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency, exportToExcel } from '@/utils/reportExport';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { CUSTOM_ORDER_STATUS_LABELS, CUSTOM_ORDER_STATUS_COLORS, CustomOrderStatus } from '@/types/customOrder';

const COLORS = [
  'hsl(215, 60%, 55%)', 'hsl(280, 60%, 55%)', 'hsl(38, 92%, 50%)',
  'hsl(142, 76%, 36%)', 'hsl(215, 14%, 60%)',
];

interface CustomOrderReportProps {
  customOrderStats: { inProduction: number; delivered: number; pending: number; ready: number; total: number; totalValue: number };
  customOrdersByStatus: { status: string; count: number }[];
  customOrders: any[];
}

export const CustomOrderReport = ({ customOrderStats, customOrdersByStatus, customOrders }: CustomOrderReportProps) => {
  const pieData = customOrdersByStatus.map(d => ({
    name: CUSTOM_ORDER_STATUS_LABELS[d.status as CustomOrderStatus] || d.status,
    value: d.count,
  }));

  const columns = [
    { key: 'reference_number', header: 'Ref #' },
    { key: 'client_name', header: 'Client' },
    { key: 'status', header: 'Status', cell: (r: any) => (
      <Badge className={CUSTOM_ORDER_STATUS_COLORS[r.status as CustomOrderStatus]} variant="secondary">
        {CUSTOM_ORDER_STATUS_LABELS[r.status as CustomOrderStatus] || r.status}
      </Badge>
    )},
    { key: 'total_amount', header: 'Amount', cell: (r: any) => formatCurrency(Number(r.total_amount)) },
    { key: 'order_date', header: 'Date', cell: (r: any) => new Date(r.order_date).toLocaleDateString('en-IN') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Custom Order Reports</h3>
        <Button size="sm" variant="outline" onClick={() => {
          const data = customOrders.map((o: any) => ({
            'Ref #': o.reference_number, Client: o.client_name, Status: o.status,
            Amount: Number(o.total_amount), Date: o.order_date,
          }));
          exportToExcel(data, 'Custom_Orders_Report');
        }} className="gap-1">
          <Download className="w-4 h-4" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending" value={customOrderStats.pending} icon={Clock} variant="warning" />
        <StatCard title="In Production" value={customOrderStats.inProduction} icon={Hammer} variant="default" />
        <StatCard title="Ready" value={customOrderStats.ready} icon={CheckCircle} variant="success" />
        <StatCard title="Delivered" value={customOrderStats.delivered} icon={Truck} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">All Custom Orders</CardTitle></CardHeader>
          <CardContent><DataTable data={customOrders} columns={columns} emptyMessage="No custom orders" /></CardContent>
        </Card>
      </div>
    </div>
  );
};
