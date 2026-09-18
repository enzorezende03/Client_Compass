import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BookOpen, Plus, Pencil, Ban, Undo2, History, GripVertical, Eye } from 'lucide-react';
import { ONBOARDING_TYPE_LABELS, STAGE_LABELS, type OnboardingStage, type OnboardingType } from '@/lib/onboarding';
import {
  fetchProcedure, ITEM_KIND_LABELS, CHANNEL_LABELS, PROCEDURE_PLACEHOLDERS,
  type ProcedureHistoryRow, type ProcedureItem, type ProcedureItemKind, type ProcedurePhase, type ProcedureChannel,
} from '@/lib/procedures';
import { Markdown, PhaseContent } from '@/components/procedure/ProcedureContent';

const db = supabase as any;
const TYPES: OnboardingType[] = ['empresa_existente', 'empresa_nova', 'em_constituicao', 'vmk_parceria'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

interface PhaseForm {
  id?: string;
  title: string;
  description: string;
  onboarding_type: OnboardingType | 'all';
  linked_stage_key: string | 'none';
}

interface ItemForm {
  id?: string;
  phase_id: string;
  kind: ProcedureItemKind;
  title: string;
  content: string;
  channel: ProcedureChannel | 'none';
}

export function ProcedureView() {
  const { allowed } = usePermission('manage_onboarding_procedures');
  const [phases, setPhases] = useState<ProcedurePhase[]>([]);
  const [items, setItems] = useState<ProcedureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<OnboardingType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [authors, setAuthors] = useState<Record<string, string>>({});

  const [phaseForm, setPhaseForm] = useState<PhaseForm | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ProcedureHistoryRow[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [data, users] = await Promise.all([fetchProcedure(), db.from('internal_users').select('id, name')]);
    setPhases(data.phases);
    setItems(data.items);
    const map: Record<string, string> = {};
    (users.data || []).forEach((u: any) => { map[u.id] = u.name; });
    setAuthors(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visiblePhases = useMemo(
    () => phases
      .filter(p => (editMode || p.active) && (typeFilter === 'all' || !p.onboarding_type || p.onboarding_type === typeFilter))
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'pt-BR')),
    [phases, typeFilter, editMode],
  );

  useEffect(() => {
    if (!visiblePhases.length) { setSelectedId(null); return; }
    if (!selectedId || !visiblePhases.some(p => p.id === selectedId)) setSelectedId(visiblePhases[0].id);
  }, [visiblePhases, selectedId]);

  const selected = visiblePhases.find(p => p.id === selectedId) || null;
  const selectedItems = useMemo(
    () => items.filter(i => i.phase_id === selectedId).sort((a, b) => a.sort_order - b.sort_order),
    [items, selectedId],
  );

  const lastUpdate = useMemo(() => {
    const all = [...phases, ...items];
    if (!all.length) return null;
    return all.reduce((acc, r) => (new Date(r.updated_at) > new Date(acc.updated_at) ? r : acc), all[0]);
  }, [phases, items]);

  const openHistory = async () => {
    setHistoryOpen(true);
    const { data } = await db.from('onboarding_procedure_history').select('*').order('created_at', { ascending: false }).limit(150);
    setHistory((data as ProcedureHistoryRow[]) || []);
  };

  const rlsMessage = (error: { message: string }) =>
    error.message.includes('row-level security')
      ? 'Você não tem permissão para editar o procedimento'
      : error.message;

  const savePhase = async () => {
    if (!phaseForm) return;
    if (!phaseForm.title.trim()) return toast.error('Informe o título da fase');
    setSaving(true);
    const payload = {
      title: phaseForm.title.trim(),
      description: phaseForm.description,
      onboarding_type: phaseForm.onboarding_type === 'all' ? null : phaseForm.onboarding_type,
      linked_stage_key: phaseForm.linked_stage_key === 'none' ? null : phaseForm.linked_stage_key,
    };
    const { error } = phaseForm.id
      ? await db.from('onboarding_procedure_phases').update(payload).eq('id', phaseForm.id)
      : await db.from('onboarding_procedure_phases').insert({ ...payload, sort_order: phases.length + 1 });
    setSaving(false);
    if (error) return toast.error(rlsMessage(error));
    toast.success('Fase salva');
    setPhaseForm(null);
    load();
  };

  const saveItem = async () => {
    if (!itemForm) return;
    if (!itemForm.title.trim()) return toast.error('Informe o título do item');
    setSaving(true);
    const payload = {
      phase_id: itemForm.phase_id,
      kind: itemForm.kind,
      title: itemForm.title.trim(),
      content: itemForm.content,
      channel: itemForm.channel === 'none' ? null : itemForm.channel,
    };
    const { error } = itemForm.id
      ? await db.from('onboarding_procedure_items').update(payload).eq('id', itemForm.id)
      : await db.from('onboarding_procedure_items').insert({ ...payload, sort_order: selectedItems.length + 1 });
    setSaving(false);
    if (error) return toast.error(rlsMessage(error));
    toast.success('Item salvo');
    setItemForm(null);
    load();
  };

  const toggleActive = async (table: 'phases' | 'items', row: { id: string; active: boolean }) => {
    const { error } = await db.from(`onboarding_procedure_${table}`).update({ active: !row.active }).eq('id', row.id);
    if (error) return toast.error(rlsMessage(error));
    load();
  };

  const reorder = async (table: 'phases' | 'items', ordered: { id: string }[]) => {
    await Promise.all(ordered.map((r, i) =>
      db.from(`onboarding_procedure_${table}`).update({ sort_order: i + 1 }).eq('id', r.id),
    ));
    load();
  };

  const dropPhase = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const list = [...visiblePhases];
    const from = list.findIndex(p => p.id === dragId);
    const to = list.findIndex(p => p.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setDragId(null);
    reorder('phases', list);
  };

  const dropItem = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const list = [...selectedItems];
    const from = list.findIndex(i => i.id === dragId);
    const to = list.findIndex(i => i.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setDragId(null);
    reorder('items', list);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {lastUpdate
              ? `Versão vigente — atualizada em ${formatDate(lastUpdate.updated_at)}${lastUpdate.updated_by && authors[lastUpdate.updated_by] ? ` por ${authors[lastUpdate.updated_by]}` : ''}`
              : 'Nenhuma versão cadastrada ainda'}
          </p>
        </div>
        {allowed && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="proc-edit" checked={editMode} onCheckedChange={setEditMode} />
              <Label htmlFor="proc-edit" className="text-sm">Modo edição</Label>
            </div>
            <Button size="sm" variant="ghost" onClick={openHistory}>
              <History className="h-4 w-4 mr-1" /> Histórico
            </Button>
          </div>
        )}
      </div>

      <Tabs value={typeFilter} onValueChange={v => setTypeFilter(v as OnboardingType | 'all')}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {TYPES.map(t => <TabsTrigger key={t} value={t}>{ONBOARDING_TYPE_LABELS[t]}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : !phases.length ? (
        <div className="py-12 text-center space-y-3">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma fase de procedimento cadastrada</p>
          {allowed && (
            <Button size="sm" onClick={() => { setEditMode(true); setPhaseForm({ title: '', description: '', onboarding_type: 'all', linked_stage_key: 'none' }); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova fase
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
          <aside className="space-y-2">
            {visiblePhases.map(phase => (
              <div
                key={phase.id}
                draggable={editMode}
                onDragStart={() => setDragId(phase.id)}
                onDragOver={e => editMode && e.preventDefault()}
                onDrop={() => editMode && dropPhase(phase.id)}
                onClick={() => setSelectedId(phase.id)}
                className={`rounded-md border p-3 cursor-pointer transition-colors ${
                  selectedId === phase.id ? 'bg-accent border-primary/40' : 'bg-card hover:bg-accent/50'
                } ${phase.active ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-2">
                  {editMode && <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{phase.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {phase.onboarding_type ? ONBOARDING_TYPE_LABELS[phase.onboarding_type] : 'Todos os tipos'}
                      {!phase.active && ' · inativa'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {editMode && allowed && (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setPhaseForm({ title: '', description: '', onboarding_type: 'all', linked_stage_key: 'none' })}>
                <Plus className="h-4 w-4 mr-1" /> Nova fase
              </Button>
            )}
          </aside>

          <div className="min-w-0">
            {selected && (
              <>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{selected.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selected.linked_stage_key
                        ? `Etapa vinculada: ${STAGE_LABELS[selected.linked_stage_key as OnboardingStage] || selected.linked_stage_key}`
                        : 'Sem etapa vinculada'}
                    </p>
                  </div>
                  {editMode && allowed && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setPhaseForm({
                        id: selected.id, title: selected.title, description: selected.description,
                        onboarding_type: selected.onboarding_type || 'all',
                        linked_stage_key: selected.linked_stage_key || 'none',
                      })}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar fase
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive('phases', selected)}>
                        {selected.active ? <><Ban className="h-4 w-4 mr-1" /> Desativar</> : <><Undo2 className="h-4 w-4 mr-1" /> Reativar</>}
                      </Button>
                    </div>
                  )}
                </div>

                {editMode && allowed ? (
                  <div className="space-y-3">
                    {selected.description && (
                      <div className="rounded-md border bg-card p-4">
                        <Markdown>{selected.description}</Markdown>
                      </div>
                    )}
                    {selectedItems.map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDragId(item.id)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => dropItem(item.id)}
                        className={`rounded-md border bg-card p-3 ${item.active ? '' : 'opacity-60'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {ITEM_KIND_LABELS[item.kind]}
                                {item.channel ? ` · ${CHANNEL_LABELS[item.channel]}` : ''}
                                {!item.active ? ' · inativo' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => setItemForm({
                              id: item.id, phase_id: item.phase_id, kind: item.kind, title: item.title,
                              content: item.content, channel: item.channel || 'none',
                            })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title={item.active ? 'Desativar' : 'Reativar'} onClick={() => toggleActive('items', item)}>
                              {item.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setItemForm({
                      phase_id: selected.id, kind: 'orientacao', title: '', content: '', channel: 'none',
                    })}>
                      <Plus className="h-4 w-4 mr-1" /> Novo item
                    </Button>
                  </div>
                ) : (
                  <PhaseContent phase={selected} items={selectedItems} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Fase */}
      <Dialog open={!!phaseForm} onOpenChange={o => !o && setPhaseForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{phaseForm?.id ? 'Editar fase' : 'Nova fase'}</DialogTitle>
            <DialogDescription>A descrição aceita formatação markdown.</DialogDescription>
          </DialogHeader>
          {phaseForm && (
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={phaseForm.title} onChange={e => setPhaseForm({ ...phaseForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de onboarding</Label>
                  <Select value={phaseForm.onboarding_type} onValueChange={v => setPhaseForm({ ...phaseForm, onboarding_type: v as OnboardingType | 'all' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {TYPES.map(t => <SelectItem key={t} value={t}>{ONBOARDING_TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Etapa vinculada</Label>
                  <Select value={phaseForm.linked_stage_key} onValueChange={v => setPhaseForm({ ...phaseForm, linked_stage_key: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {(Object.keys(STAGE_LABELS) as OnboardingStage[]).map(s => (
                        <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Descrição (markdown)</Label>
                  <Button size="sm" variant="ghost" onClick={() => setPreview(v => !v)}>
                    <Eye className="h-4 w-4 mr-1" /> {preview ? 'Editar' : 'Pré-visualizar'}
                  </Button>
                </div>
                {preview
                  ? <div className="rounded-md border p-3 min-h-[160px]"><Markdown>{phaseForm.description}</Markdown></div>
                  : <Textarea rows={8} value={phaseForm.description} onChange={e => setPhaseForm({ ...phaseForm, description: e.target.value })} />}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseForm(null)}>Cancelar</Button>
            <Button onClick={savePhase} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item */}
      <Dialog open={!!itemForm} onOpenChange={o => !o && setItemForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{itemForm?.id ? 'Editar item' : 'Novo item'}</DialogTitle>
            <DialogDescription>
              Placeholders disponíveis: {PROCEDURE_PLACEHOLDERS.join(', ')}
            </DialogDescription>
          </DialogHeader>
          {itemForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={itemForm.kind} onValueChange={v => setItemForm({ ...itemForm, kind: v as ProcedureItemKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ITEM_KIND_LABELS) as ProcedureItemKind[]).map(k => (
                        <SelectItem key={k} value={k}>{ITEM_KIND_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Canal</Label>
                  <Select value={itemForm.channel} onValueChange={v => setItemForm({ ...itemForm, channel: v as ProcedureChannel | 'none' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem canal</SelectItem>
                      {(Object.keys(CHANNEL_LABELS) as ProcedureChannel[]).map(c => (
                        <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Título</Label>
                <Input value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Conteúdo (markdown)</Label>
                  <Button size="sm" variant="ghost" onClick={() => setPreview(v => !v)}>
                    <Eye className="h-4 w-4 mr-1" /> {preview ? 'Editar' : 'Pré-visualizar'}
                  </Button>
                </div>
                {preview
                  ? <div className="rounded-md border p-3 min-h-[200px]"><Markdown>{itemForm.content}</Markdown></div>
                  : <Textarea rows={10} value={itemForm.content} onChange={e => setItemForm({ ...itemForm, content: e.target.value })} />}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemForm(null)}>Cancelar</Button>
            <Button onClick={saveItem} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de alterações</DialogTitle>
            <DialogDescription>Registro imutável das mudanças no procedimento.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {!history.length && <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
            {history.map(h => {
              const after = (h.after_data || {}) as any;
              const before = (h.before_data || {}) as any;
              const label = after.title || before.title || '—';
              const action = h.action === 'insert' ? 'Criado' : h.action === 'update' ? 'Alterado' : 'Removido';
              return (
                <div key={h.id} className="rounded-md border p-2.5 text-sm">
                  <p className="font-medium">{label}</p>
                  <p className="text-muted-foreground">
                    {action} · {h.table_name === 'onboarding_procedure_phases' ? 'fase' : 'item'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(h.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
