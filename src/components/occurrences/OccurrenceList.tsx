import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Eye, Plus, Search, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDocument } from '@/lib/document';
import { GenerateTaskFromEntryDialog } from '@/components/GenerateTaskFromEntryDialog';
import { OccurrenceModal } from './OccurrenceModal';
import {
  Occurrence, OccurrenceTask, mapOccurrence, formatDateTime, downloadCsv, getCurrentInternalUser,
} from '@/lib/occurrences';
import {
  INTERACTION_LABELS, SECTOR_LABELS, DEMAND_STATUS_LABELS, SEVERITY_LABELS,
  RESPONSIBILITY_ORIGIN_LABELS, RESPONSIBILITY_ORIGIN_SHORT, RESPONSIBILITY_ORIGIN_CLASSES,
  ResponsibilityOrigin, TimelineEntry,
} from '@/types/client';

const PAGE = 100;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export function ClassificationBadge({ value }: { value: ResponsibilityOrigin | null }) {
  if (!value) return <span className="inline-flex rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">Sem classificação</span>;
  return (
    <span title={RESPONSIBILITY_ORIGIN_LABELS[value]} className={cn('inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', RESPONSIBILITY_ORIGIN_CLASSES[value])}>
      {RESPONSIBILITY_ORIGIN_SHORT[value]}
    </span>
  );
}

const severityClass: Record<string, string> = {
  alta: 'text-destructive font-semibold', media: 'text-health-attention', baixa: 'text-muted-foreground',
};

function toTimelineEntry(o: Occurrence): TimelineEntry {
  return {
    id: o.id, clientId: o.clientId, date: o.occurredAt, type: o.type, description: o.description,
    responsible: o.responsible, sector: o.sector, origin: o.origin as any, demandStatus: o.demandStatus,
    isRelevantEvent: false, responsibilityOrigin: o.responsibilityOrigin,
  };
}

interface Props { clientId?: string; clientName?: string; highlightId?: string | null }

export function OccurrenceList({ clientId, clientName, highlightId }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Occurrence[]>([]);
  const [tasks, setTasks] = useState<Record<string, OccurrenceTask>>({});
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [hasMore, setHasMore] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [start, setStart] = useState(daysAgo(90));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [clientQ, setClientQ] = useState('');
  const [text, setText] = useState('');
  const [fClass, setFClass] = useState('all');
  const [fType, setFType] = useState('all');
  const [fSector, setFSector] = useState('all');
  const [fSeverity, setFSeverity] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [chip, setChip] = useState<'all' | 'escritorio' | 'cliente' | 'open' | 'mine'>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Occurrence | null>(null);
  const [editText, setEditText] = useState('');
  const [genTask, setGenTask] = useState<Occurrence | null>(null);

  useEffect(() => { getCurrentInternalUser().then(u => setMe(u?.id ?? null)); }, []);

  const load = useCallback(async () => {
    let q = supabase.from('timeline_entries' as any)
      .select('*, clients(name, document)')
      .eq('is_occurrence', true)
      .gte('occurred_at', `${start}T00:00:00-03:00`)
      .lte('occurred_at', `${end}T23:59:59-03:00`)
      .order('occurred_at', { ascending: false })
      .limit(limit + 1);
    if (clientId) q = q.eq('client_id', clientId);
    const [{ data }, { data: users }] = await Promise.all([q, supabase.from('internal_users').select('id, name')]);
    const map = Object.fromEntries(((users as any[]) || []).map(u => [u.id, u.name]));
    const list = ((data as any[]) || []);
    setHasMore(list.length > limit);
    const mapped = list.slice(0, limit).map(r => mapOccurrence(r, map));
    setRows(mapped);
    const ids = mapped.map(r => r.id);
    if (ids.length) {
      const { data: ts } = await supabase.from('tasks').select('id, title, status, responsible_id, source_timeline_entry_id').in('source_timeline_entry_id', ids);
      const tm: Record<string, OccurrenceTask> = {};
      ((ts as any[]) || []).forEach(t => { tm[t.source_timeline_entry_id] = { id: t.id, title: t.title, status: t.status, responsibleId: t.responsible_id }; });
      setTasks(tm);
    } else setTasks({});
    setLoading(false);
  }, [start, end, clientId, limit]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`occ-${clientId ?? 'all'}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_entries', ...(clientId ? { filter: `client_id=eq.${clientId}` } : {}) }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, clientId]);

  const visible = useMemo(() => {
    const cq = clientQ.trim().toLowerCase(); const cd = cq.replace(/\D/g, '');
    const tq = text.trim().toLowerCase();
    return rows.filter(r => {
      if (cq && !(r.clientName.toLowerCase().includes(cq) || (cd.length >= 3 && r.clientDocument.replace(/\D/g, '').includes(cd)))) return false;
      if (tq && !r.description.toLowerCase().includes(tq)) return false;
      if (fClass !== 'all' && (fClass === 'none' ? r.responsibilityOrigin : r.responsibilityOrigin !== fClass)) return false;
      if (fType !== 'all' && r.type !== fType) return false;
      if (fSector !== 'all' && r.sector !== fSector) return false;
      if (fSeverity !== 'all' && r.severity !== fSeverity) return false;
      if (fStatus !== 'all' && r.demandStatus !== fStatus) return false;
      if (chip === 'escritorio' && r.responsibilityOrigin !== 'escritorio') return false;
      if (chip === 'cliente' && r.responsibilityOrigin !== 'cliente') return false;
      if (chip === 'open' && r.demandStatus === 'resolved') return false;
      if (chip === 'mine' && !(r.createdBy === me || (me && tasks[r.id]?.responsibleId === me))) return false;
      return true;
    });
  }, [rows, clientQ, text, fClass, fType, fSector, fSeverity, fStatus, chip, me, tasks]);

  const summary = useMemo(() => {
    const lim = Date.now() - 90 * 864e5;
    const recent = rows.filter(r => new Date(r.occurredAt).getTime() >= lim);
    return {
      esc: recent.filter(r => r.responsibilityOrigin === 'escritorio').length,
      cli: recent.filter(r => r.responsibilityOrigin === 'cliente').length,
      open: recent.filter(r => r.demandStatus !== 'resolved').length,
    };
  }, [rows]);

  const classify = async (o: Occurrence, v: ResponsibilityOrigin) => {
    const { error } = await supabase.from('timeline_entries').update({ responsibility_origin: v } as any).eq('id', o.id);
    if (error) toast({ title: 'Erro ao classificar', description: error.message, variant: 'destructive' });
    else load();
  };

  const saveEdit = async () => {
    if (!detail || !editText.trim() || editText === detail.description) { setDetail(null); return; }
    const { error } = await supabase.from('timeline_entries').update({ description: editText.trim() }).eq('id', detail.id);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Descrição atualizada', description: 'A alteração ficou registrada na auditoria.' });
    setDetail(null); load();
  };

  const exportCsv = () => downloadCsv(`ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`, visible.map(r => ({
    'Data do fato': formatDateTime(r.occurredAt), Cliente: r.clientName, CNPJ: formatDocument(r.clientDocument),
    Tipo: INTERACTION_LABELS[r.type], Classificação: r.responsibilityOrigin ? RESPONSIBILITY_ORIGIN_LABELS[r.responsibilityOrigin] : '',
    Setor: SECTOR_LABELS[r.sector] ?? r.sector, Gravidade: r.severity ? SEVERITY_LABELS[r.severity] : '',
    Descrição: r.description, 'Registrado por': r.createdByName ?? 'Sistema', 'Registrado em': formatDateTime(r.createdAt),
    Status: DEMAND_STATUS_LABELS[r.demandStatus] ?? r.demandStatus, Tarefa: tasks[r.id] ? (tasks[r.id].status === 'completed' ? 'Concluída' : 'Pendente') : '',
  })));

  const chips: Array<[typeof chip, string]> = [['all', 'Todas'], ['escritorio', 'Do escritório'], ['cliente', 'Do cliente'], ['open', 'Em aberto'], ['mine', 'Minhas']];
  const sel = (value: string, set: (v: string) => void, placeholder: string, opts: Record<string, string>, extra?: [string, string]) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {extra && <SelectItem value={extra[0]}>{extra[1]}</SelectItem>}
        {Object.entries(opts).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      {clientId && (
        <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          Últimos 90 dias: <strong className="text-rework-office">{summary.esc}</strong> problemas do escritório ·{' '}
          <strong className="text-rework-client">{summary.cli}</strong> ocorrências do cliente ·{' '}
          <strong className="text-foreground">{summary.open}</strong> em aberto
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {chips.map(([k, l]) => (
            <button key={k} onClick={() => setChip(k)}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', chip === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={!visible.length}><Download className="h-4 w-4" /> Exportar CSV</Button>
          <Button size="sm" className="gap-2" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nova ocorrência</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        {!clientId && <Input className="h-9 w-[200px] text-xs" placeholder="Cliente (nome ou CNPJ)" value={clientQ} onChange={e => setClientQ(e.target.value)} />}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 w-[200px] pl-8 text-xs" placeholder="Buscar na descrição" value={text} onChange={e => setText(e.target.value)} />
        </div>
        {sel(fClass, setFClass, 'Classificação', RESPONSIBILITY_ORIGIN_SHORT, ['none', 'Sem classificação'])}
        {sel(fType, setFType, 'Tipo', INTERACTION_LABELS)}
        {sel(fSector, setFSector, 'Setor', SECTOR_LABELS)}
        {sel(fSeverity, setFSeverity, 'Gravidade', SEVERITY_LABELS)}
        {sel(fStatus, setFStatus, 'Status', DEMAND_STATUS_LABELS)}
        <Input type="date" className="h-9 w-[140px] text-xs" value={start} onChange={e => setStart(e.target.value)} />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="date" className="h-9 w-[140px] text-xs" value={end} onChange={e => setEnd(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Data do fato</TableHead>
              {!clientId && <TableHead>Cliente</TableHead>}
              <TableHead>Tipo</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Gravidade</TableHead>
              <TableHead className="min-w-[220px]">Descrição</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead className="w-[1%]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Nenhuma ocorrência para estes filtros.</TableCell></TableRow>
            ) : visible.map(r => {
              const t = tasks[r.id];
              return (
                <TableRow key={r.id} className={cn(highlightId === r.id && 'bg-primary/5')}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.occurredAt)}</TableCell>
                  {!clientId && <TableCell className="text-sm font-medium"><Link className="hover:underline" to={`/client/${r.clientId}?tab=ocorrencias`}>{r.clientName}</Link></TableCell>}
                  <TableCell className="text-xs">{INTERACTION_LABELS[r.type] ?? r.type}</TableCell>
                  <TableCell>
                    {r.responsibilityOrigin ? <ClassificationBadge value={r.responsibilityOrigin} /> : (
                      <Select onValueChange={v => classify(r, v as ResponsibilityOrigin)}>
                        <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue placeholder="Classificar" /></SelectTrigger>
                        <SelectContent>{Object.entries(RESPONSIBILITY_ORIGIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{SECTOR_LABELS[r.sector] ?? r.sector}</TableCell>
                  <TableCell className={cn('text-xs', r.severity && severityClass[r.severity])}>{r.severity ? SEVERITY_LABELS[r.severity] : '—'}</TableCell>
                  <TableCell className="max-w-[320px]"><p className="line-clamp-2 text-xs text-foreground" title={r.description}>{r.description}</p></TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.createdByName ?? 'Sistema'}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{DEMAND_STATUS_LABELS[r.demandStatus] ?? r.demandStatus}</TableCell>
                  <TableCell>
                    {t ? (
                      <button onClick={() => navigate('/tarefas')} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium hover:underline', t.status === 'completed' ? 'bg-health-healthy/10 text-health-healthy' : 'bg-primary/10 text-primary')}>
                        <CheckSquare className="h-3 w-3" /> {t.status === 'completed' ? 'Concluída' : 'Pendente'}
                      </button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setGenTask(r)}><Plus className="h-3 w-3" /> Gerar</Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir detalhe" onClick={() => { setDetail(r); setEditText(r.description); }}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {hasMore && <div className="text-center"><Button variant="outline" size="sm" onClick={() => setLimit(l => l + PAGE)}>Carregar mais</Button></div>}

      <OccurrenceModal open={newOpen} onOpenChange={setNewOpen} clientId={clientId} clientName={clientName} showClientLink={!clientId} onSaved={load} />
      <GenerateTaskFromEntryDialog entry={genTask ? toTimelineEntry(genTask) : null} clientName={genTask?.clientName || clientName}
        onOpenChange={v => { if (!v) setGenTask(null); }} onCreated={load} />

      <Dialog open={!!detail} onOpenChange={v => { if (!v) setDetail(null); }}>
        <DialogContent className="sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{INTERACTION_LABELS[detail.type]} — {detail.clientName}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <ClassificationBadge value={detail.responsibilityOrigin} />
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{SECTOR_LABELS[detail.sector] ?? detail.sector}</span>
                  {detail.severity && <span className={cn('rounded-full bg-secondary px-2 py-0.5 text-xs', severityClass[detail.severity])}>Gravidade {SEVERITY_LABELS[detail.severity]}</span>}
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{DEMAND_STATUS_LABELS[detail.demandStatus]}</span>
                </div>
                <Textarea rows={5} value={editText} onChange={e => setEditText(e.target.value)} />
                <p className="text-xs text-muted-foreground">Registrado por {detail.createdByName ?? 'Sistema'} em {formatDateTime(detail.createdAt)}</p>
                {Math.abs(new Date(detail.occurredAt).getTime() - new Date(detail.createdAt).getTime()) > 60000 && (
                  <p className="text-xs text-muted-foreground">Data do fato: {formatDateTime(detail.occurredAt)}</p>
                )}
                {tasks[detail.id] && <p className="text-xs">Tarefa vinculada: <strong>{tasks[detail.id].title}</strong> ({tasks[detail.id].status === 'completed' ? 'Concluída' : 'Pendente'})</p>}
              </div>
              <DialogFooter>
                {!clientId && <Button variant="outline" onClick={() => navigate(`/client/${detail.clientId}?tab=ocorrencias`)}>Abrir ficha</Button>}
                <Button onClick={saveEdit}>Salvar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
