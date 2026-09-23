import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Plus, Pencil, Ban, History, Upload, Search, Undo2 } from 'lucide-react';
import {
  SLA_SECTORS, SLA_UNITS, SLA_UNIT_LABELS, formatSla, validateImportRow,
  type SlaCatalogRow, type SlaHistoryRow, type SlaSector, type SlaUnit, type ImportRow,
} from '@/lib/slaCatalog';
import { SlaPlaybook } from '@/components/SlaPlaybook';

const db = supabase as any;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface FormState {
  id?: string;
  sector: SlaSector;
  demand_name: string;
  sla_value: string;
  sla_unit: SlaUnit;
  notes: string;
}

const emptyForm: FormState = { sector: 'Geral', demand_name: '', sla_value: '', sla_unit: 'dias_uteis', notes: '' };

export function SlaCatalogPanel({ compact = false }: { compact?: boolean }) {
  const { allowed } = usePermission('manage_sla_catalog');
  const [rows, setRows] = useState<SlaCatalogRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState<SlaSector | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SlaHistoryRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, users] = await Promise.all([
      db.from('demand_sla_catalog').select('*').order('sector').order('sort_order').order('demand_name'),
      db.from('internal_users').select('id, name'),
    ]);
    if (error) toast.error('Não foi possível carregar os prazos');
    setRows((data as SlaCatalogRow[]) || []);
    const map: Record<string, string> = {};
    (users.data || []).forEach((u: any) => { map[u.id] = u.name; });
    setAuthors(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(r =>
      (showInactive || r.active) &&
      (sectorFilter === 'all' || r.sector === sectorFilter) &&
      (!term || r.demand_name.toLowerCase().includes(term) || r.notes.toLowerCase().includes(term)),
    );
  }, [rows, search, sectorFilter, showInactive]);

  const grouped = useMemo(() => {
    const map = new Map<string, SlaCatalogRow[]>();
    visible.forEach(r => {
      const list = map.get(r.sector) || [];
      list.push(r);
      map.set(r.sector, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [visible]);

  const lastUpdate = useMemo(() => {
    if (!rows.length) return null;
    return rows.reduce((acc, r) => (new Date(r.updated_at) > new Date(acc.updated_at) ? r : acc), rows[0]);
  }, [rows]);

  const openHistory = async () => {
    setHistoryOpen(true);
    const { data } = await db
      .from('demand_sla_catalog_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setHistory((data as SlaHistoryRow[]) || []);
  };

  const save = async () => {
    if (!form) return;
    const value = Number(form.sla_value.replace(',', '.'));
    if (!form.demand_name.trim()) return toast.error('Informe o nome da demanda');
    if (!value || value <= 0) return toast.error('Informe um prazo válido');
    setSaving(true);
    const payload = {
      sector: form.sector,
      demand_name: form.demand_name.trim(),
      sla_value: value,
      sla_unit: form.sla_unit,
      notes: form.notes.trim(),
    };
    const { error } = form.id
      ? await db.from('demand_sla_catalog').update(payload).eq('id', form.id)
      : await db.from('demand_sla_catalog').insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message.includes('row-level security') ? 'Você não tem permissão para alterar os prazos' : error.message);
    toast.success(form.id ? 'Prazo atualizado' : 'Demanda cadastrada');
    setForm(null);
    load();
  };

  const toggleActive = async (row: SlaCatalogRow) => {
    const { error } = await db.from('demand_sla_catalog').update({ active: !row.active }).eq('id', row.id);
    if (error) return toast.error('Você não tem permissão para alterar os prazos');
    toast.success(row.active ? 'Demanda desativada' : 'Demanda reativada');
    load();
  };

  const handleFile = async (file: File) => {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const parsed = json.map((raw, i) => validateImportRow(raw, i + 2));
    if (!parsed.length) return toast.error('A planilha está vazia');
    setImportRows(parsed);
    setImportOpen(true);
  };

  const confirmImport = async () => {
    const valid = importRows.filter(r => !r.errors.length);
    if (!valid.length) return toast.error('Nenhuma linha válida para importar');
    setImporting(true);
    const { error } = await db.from('demand_sla_catalog').upsert(
      valid.map(r => ({
        sector: r.sector, demand_name: r.demand_name, sla_value: r.sla_value, sla_unit: r.sla_unit, notes: r.notes, active: true,
      })),
      { onConflict: 'sector,demand_name' },
    );
    setImporting(false);
    if (error) return toast.error(error.message.includes('row-level security') ? 'Você não tem permissão para importar prazos' : error.message);
    toast.success(`${valid.length} prazo(s) importado(s)`);
    setImportOpen(false);
    setImportRows([]);
    load();
  };

  const invalidCount = importRows.filter(r => r.errors.length).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="space-y-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar demanda..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={sectorFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSectorFilter('all')}
          >
            Todos
          </Badge>
          {SLA_SECTORS.map(s => (
            <Badge
              key={s}
              variant={sectorFilter === s ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSectorFilter(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
        {allowed && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setForm({ ...emptyForm })}>
              <Plus className="h-4 w-4 mr-1" /> Nova demanda
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Importar planilha
            </Button>
            <Button size="sm" variant="ghost" onClick={openHistory}>
              <History className="h-4 w-4 mr-1" /> Histórico de alterações
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowInactive(v => !v)}>
              {showInactive ? 'Ocultar inativas' : 'Mostrar inativas'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto pr-1 ${compact ? '' : 'max-h-none'}`}>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : !rows.length ? (
          <div className="py-12 text-center space-y-3">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum prazo cadastrado</p>
            {allowed && (
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Importar planilha
              </Button>
            )}
          </div>
        ) : !visible.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma demanda encontrada para esta busca.</p>
        ) : (
          <div className="space-y-5">
            {grouped.map(([sector, items]) => (
              <div key={sector}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{sector}</h3>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className={`rounded-md border p-3 ${item.active ? 'bg-card' : 'bg-muted/40'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground flex items-center gap-2">
                            {item.demand_name}
                            {!item.active && <Badge variant="outline" className="text-xs">Inativa</Badge>}
                          </p>
                          <p className="text-sm text-primary font-semibold">{formatSla(item.sla_value, item.sla_unit)}</p>
                          {item.notes && <SlaPlaybook notes={item.notes} />}
                        </div>
                        {allowed && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Editar"
                              onClick={() => setForm({
                                id: item.id, sector: item.sector, demand_name: item.demand_name,
                                sla_value: String(item.sla_value), sla_unit: item.sla_unit, notes: item.notes,
                              })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title={item.active ? 'Desativar' : 'Reativar'}
                              onClick={() => toggleActive(item)}
                            >
                              {item.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lastUpdate && (
        <p className="pt-3 mt-3 border-t text-xs text-muted-foreground">
          Atualizado em {formatDateTime(lastUpdate.updated_at)}
          {lastUpdate.updated_by && authors[lastUpdate.updated_by] ? ` por ${authors[lastUpdate.updated_by]}` : ''}
        </p>
      )}

      {/* Nova / editar demanda */}
      <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar demanda' : 'Nova demanda'}</DialogTitle>
            <DialogDescription>Defina o prazo acordado para esta demanda.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label>Setor</Label>
                <Select value={form.sector} onValueChange={v => setForm({ ...form, sector: v as SlaSector })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SLA_SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Demanda</Label>
                <Input value={form.demand_name} onChange={e => setForm({ ...form, demand_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prazo</Label>
                  <Input value={form.sla_value} onChange={e => setForm({ ...form, sla_value: e.target.value })} inputMode="decimal" />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.sla_unit} onValueChange={v => setForm({ ...form, sla_unit: v as SlaUnit })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SLA_UNITS.map(u => <SelectItem key={u} value={u}>{SLA_UNIT_LABELS[u].plural}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de alterações</DialogTitle>
            <DialogDescription>Últimas alterações do catálogo de prazos.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {!history.length && <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
            {history.map(h => (
              <div key={h.id} className="rounded-md border p-2.5 text-sm">
                <p className="font-medium">{h.sector} — {h.demand_name}</p>
                <p className="text-muted-foreground">
                  {h.action === 'insert'
                    ? `Cadastrada (${h.new_value})`
                    : `${h.field_name}: "${h.old_value}" → "${h.new_value}"`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(h.created_at)}{h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Importação */}
      <Dialog open={importOpen} onOpenChange={o => { setImportOpen(o); if (!o) setImportRows([]); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da importação</DialogTitle>
            <DialogDescription>
              Colunas esperadas: setor, demanda, prazo, unidade, observação. Demandas já existentes no mesmo setor são atualizadas.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-2">
            {importRows.map(r => (
              <div key={r.line} className={`rounded-md border p-2.5 text-sm ${r.errors.length ? 'border-destructive bg-destructive/5' : ''}`}>
                <p className="font-medium">
                  Linha {r.line}: {r.sector || '—'} — {r.demand_name || '(sem demanda)'}
                  {r.sla_value && r.sla_unit ? ` · ${formatSla(r.sla_value, r.sla_unit)}` : ''}
                </p>
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                {r.errors.map(err => (
                  <p key={err} className="text-xs text-destructive">{err}</p>
                ))}
              </div>
            ))}
          </div>
          <DialogFooter className="items-center">
            <p className="text-xs text-muted-foreground mr-auto">
              {importRows.length - invalidCount} válida(s){invalidCount ? ` · ${invalidCount} com erro (não serão importadas)` : ''}
            </p>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={confirmImport} disabled={importing || importRows.length === invalidCount}>
              {importing ? 'Importando...' : 'Confirmar importação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
