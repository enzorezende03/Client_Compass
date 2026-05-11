import { useState } from 'react';
import { Loader2, ArrowRightCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { convertConstitutionToNewCompany } from '@/lib/onboarding';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  clientName: string;
  onConverted?: () => void;
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

export function ConvertToNewCompanyDialog({ open, onOpenChange, clientId, clientName, onConverted }: Props) {
  const { toast } = useToast();
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);

  const valid = CNPJ_REGEX.test(cnpj);

  const handleConvert = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      await convertConstitutionToNewCompany(clientId, clientName, cnpj);
      toast({
        title: 'Cliente convertido!',
        description: `${clientName} entrou no onboarding de Empresa Nova — Etapa 1.`,
      });
      onConverted?.();
      onOpenChange(false);
      setCnpj('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightCircle className="h-5 w-5 text-emerald-600" />
            Converter para Empresa Nova
          </DialogTitle>
          <DialogDescription>
            Informe o CNPJ definitivo de <span className="font-medium text-foreground">{clientName}</span>.
            O cliente passará automaticamente para o onboarding de <strong>Empresa Nova — Etapa 1</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="new-cnpj">CNPJ definitivo</Label>
          <Input
            id="new-cnpj"
            value={cnpj}
            onChange={e => setCnpj(maskCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            maxLength={18}
            autoFocus
          />
          {cnpj && !valid && (
            <p className="text-xs text-destructive">Formato inválido. Use XX.XXX.XXX/XXXX-XX.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConvert} disabled={!valid || loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar e Iniciar Onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
