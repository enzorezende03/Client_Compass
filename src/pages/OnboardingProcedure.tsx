import { AppLayout } from '@/components/AppLayout';
import { ProcedureView } from '@/components/procedure/ProcedureView';

export default function OnboardingProcedure() {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Procedimento de onboarding</h1>
          <p className="text-sm text-muted-foreground">Orientações e mensagens padrão por fase do onboarding.</p>
        </div>
        <ProcedureView />
      </div>
    </AppLayout>
  );
}
