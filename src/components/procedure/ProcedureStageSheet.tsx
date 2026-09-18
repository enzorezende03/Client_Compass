import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { PhaseContent } from '@/components/procedure/ProcedureContent';
import { fetchProcedure, type ProcedureClientContext, type ProcedureItem, type ProcedurePhase } from '@/lib/procedures';
import type { OnboardingStage, OnboardingType } from '@/lib/onboarding';
import { STAGE_LABELS } from '@/lib/onboarding';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: OnboardingStage | string | null;
  onboardingType: OnboardingType;
  clientContext: ProcedureClientContext;
}

export function ProcedureStageSheet({ open, onOpenChange, stage, onboardingType, clientContext }: Props) {
  const [phase, setPhase] = useState<ProcedurePhase | null>(null);
  const [items, setItems] = useState<ProcedureItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !stage) return;
    setLoading(true);
    fetchProcedure().then(({ phases, items }) => {
      const match =
        phases.find(p => p.active && p.linked_stage_key === stage && p.onboarding_type === onboardingType) ||
        phases.find(p => p.active && p.linked_stage_key === stage && !p.onboarding_type) ||
        null;
      setPhase(match);
      setItems(match ? items.filter(i => i.phase_id === match.id).sort((a, b) => a.sort_order - b.sort_order) : []);
      setLoading(false);
    });
  }, [open, stage, onboardingType]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{phase?.title || 'Procedimento da etapa'}</SheetTitle>
          <SheetDescription>
            {stage ? STAGE_LABELS[stage as OnboardingStage] || String(stage) : ''}
            {clientContext.name ? ` · ${clientContext.name}` : ''}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : phase ? (
            <PhaseContent phase={phase} items={items} clientContext={clientContext} />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma fase de procedimento vinculada a esta etapa.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
