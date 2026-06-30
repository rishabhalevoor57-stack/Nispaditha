import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { MeltingContent } from '@/components/melting/MeltingContent';

export default function Melting() {
  return (
    <AppLayout>
      <PageHeader
        title="Melting"
        description="Track jewellery, scrap, buyback & exchange items sent for melting → refine → back to inventory."
      />
      <MeltingContent />
    </AppLayout>
  );
}
