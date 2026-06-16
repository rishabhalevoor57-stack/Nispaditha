import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSkuRegistry } from '@/hooks/useSkuRegistry';
import { SkuDashboard } from '@/components/sku/SkuDashboard';
import { SkuGenerateForm } from '@/components/sku/SkuGenerateForm';
import { SkuHistoryTable } from '@/components/sku/SkuHistoryTable';

export default function SkuGenerator() {
  const { rows, isLoading, refresh, generate, remove } = useSkuRegistry();
  const [tab, setTab] = useState('dashboard');
  const [lastGenerated, setLastGenerated] = useState<typeof rows>([]);

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      assigned: by('assigned') + by('in_inventory'),
      available: by('generated'),
      sold: by('sold'),
      archived: by('archived'),
      deleted: by('deleted_product'),
      recent: rows.slice(0, 10),
    };
  }, [rows]);

  return (
    <AppLayout>
      <PageHeader
        title="SKU Generator"
        description="Generate, reserve, print and track every SKU. The single source of truth — never reused."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <SkuDashboard stats={stats} />
        </TabsContent>

        <TabsContent value="generate" className="mt-6">
          <SkuGenerateForm
            onGenerate={async (args) => {
              const created = await generate(args);
              setLastGenerated(created);
              return created;
            }}
            lastGenerated={lastGenerated}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SkuHistoryTable rows={rows} isLoading={isLoading} onRefresh={refresh} onDelete={remove} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
