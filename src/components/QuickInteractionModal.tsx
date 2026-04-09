import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  InteractionType, Sector, DemandOrigin, DemandStatus,
  INTERACTION_LABELS, SECTOR_LABELS, ORIGIN_LABELS, DEMAND_STATUS_LABELS, TimelineEntry
} from '@/types/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSubmit: (entry: Omit<TimelineEntry, 'id'>) => void;
}

export function QuickInteractionModal({ open, onOpenChange, clientId, onSubmit }: Props) {
  const [type, setType] = useState<InteractionType>('service');
  const [sector, setSector] = useState<Sector>('fiscal');
  const [origin, setOrigin] = useState<DemandOrigin>('client');
  const [demandStatus, setDemandStatus] = useState<DemandStatus>('open');
  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState('');
  const [isRelevant, setIsRelevant] = useState(false);
  const [relevantType, setRelevantType] = useState('');

  const handleSubmit = () => {
    if (!description.trim() || !responsible.trim()) return;
    onSubmit({
      clientId,
      date: new Date().toISOString(),
      type, sector, origin, demandStatus, description, responsible,
      isRelevantEvent: isRelevant,
      relevantEventType: isRelevant ? relevantType : undefined,
    });
    setDescription('');
    setResponsible('');
    setIsRelevant(false);
    setRelevantType('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Nova Interação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INTERACTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Setor</Label>
              <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Origem</Label>
              <Select value={origin} onValueChange={(v) => setOrigin(v as DemandOrigin)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={demandStatus} onValueChange={(v) => setDemandStatus(v as DemandStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEMAND_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
            <Input placeholder="Nome do responsável" value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Descrição</Label>
            <Textarea placeholder="Descreva a interação..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isRelevant} onCheckedChange={setIsRelevant} />
            <Label className="text-sm">Evento relevante</Label>
            {isRelevant && (
              <Input placeholder="Tipo (ex: Quase cancelamento)" value={relevantType} onChange={(e) => setRelevantType(e.target.value)} className="flex-1" />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!description.trim() || !responsible.trim()}>Registrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
