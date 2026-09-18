import { AppLayout } from '@/components/AppLayout';
import { SlaCatalogPanel } from '@/components/SlaCatalogPanel';

export default function SlaCatalogPage() {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Prazos das demandas</h1>
          <p className="text-sm text-muted-foreground">Prazos acordados (SLA) por setor e tipo de demanda.</p>
        </div>
        <SlaCatalogPanel />
      </div>
    </AppLayout>
  );
}
