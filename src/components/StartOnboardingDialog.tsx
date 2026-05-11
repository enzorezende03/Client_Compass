import { useState } from 'react';
import { Building2, Sparkles, FileBadge2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { startOnboarding, OnboardingType, ONBOARDING_TYPE_LABELS } from '@/lib/onboarding';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  clientName: string;
  /** Lock the type selector to a single option (used by the orange button on /onboarding). */
  forcedType?: OnboardingType;
  onStarted?: () => void;
}

const TYPES: { type: OnboardingType; icon: any; description: string; color: string }[] = [
  {
    type: 'empresa_existente',
    icon: Building2,
    description: 'Cliente já constituído migrando para a 2M.',
    color: 'border-sky-500/40 hover:bg-sky-500/5 data-[selected=true]:bg-sky-500/10 data-[selected=true]:border-sky-500',
  },
  {
    type: 'empresa_nova',
    icon: Sparkles,
    description: 'CNPJ recém-emitido, primeira contabilidade.',
    color: 'border-emerald-500/40 hover:bg-emerald-500/5 data-[selected=true]:bg-emerald-500/10 data-[selected=true]:border-emerald-500',
  },
  {
    type: 'em_constituicao',
    icon: FileBadge2,
    description: 'Empresa ainda sendo aberta — acompanhamento da constituição.',
    color: 'border-amber-500/40 hover:bg-amber-500/5 data-[selected=true]:bg-amber-500/10 data-[selected=true]:border-amber-500',
  },
];

export function StartOnboardingDialog({ open, onOpenChange, clientId, clientName, forcedType, onStarted }: Props) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<OnboardingType>(forcedType || 'empresa_existente');
  const [loading, setLoading] = useState(false);

  const options = forcedType ? TYPES.filter(t => t.type === forcedType) : TYPES;

  const handleStart = async () => {
    setLoading(true);
    try {
      await startOnboarding(clientId, clientName, selected);
      toast({
        title: 'Onboarding iniciado!',
        description: `${clientName} entrou no fluxo de ${ONBOARDING_TYPE_LABELS[selected]}.`,
      });
      onStarted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Iniciar Onboarding</DialogTitle>
          <DialogDescription>
            Selecione o tipo de onboarding para <span className="font-medium text-foreground">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5 py-2">
          {options.map(({ type, icon: Icon, description, color }) => (
            <button
              key={type}
              type="button"
              data-selected={selected === type}
              onClick={() => setSelected(type)}
              className={cn(
                'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all',
                color,
                selected === type ? 'shadow-sm' : 'border-border'
              )}
            >
              <Icon className="h-5 w-5 mt-0.5 text-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{ONBOARDING_TYPE_LABELS[type]}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
              </div>
            </button>
          ))}
        </div>

        {selected === 'em_constituicao' && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            ⚠️ Este cliente está sendo cadastrado com <strong>CPF provisório</strong> até receber o CNPJ.
            Após a emissão, você poderá converter para o fluxo de Empresa Nova.
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleStart} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar Onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
