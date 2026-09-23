import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OccurrenceList, ClassificationBadge } from '@/components/occurrences/OccurrenceList';
import { Occurrence, mapOccurrence, formatDateTime } from '@/lib/occurrences';
import {
  INTERACTION_LABELS, SECTOR_LABELS, RESPONSIBILITY_ORIGIN_LABELS, ResponsibilityOrigin,
} from '@/types/client';

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function PendingTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Occurrence[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [value, setValue] = useState<ResponsibilityOrigin | ''>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data }, { data: users }] = await Promise.all([
      supabase.from('timeline_entries' as any).select('*, clients(name, document)')
        .eq('is_occurrence', true).is('responsibility_origin', null)
        .order('occurred_at', { ascending: false }).limit(500),
      supabase.from('internal_users').select('id, name'),
    ]);
    const map = Object.fromEntries(((users as any[]) || []).map(u => [u.id, u.name]));
    setRows(((data as any[]) || []).map(r => mapOccurrence(r, map)));
    setSelected(new Set());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    if (!value || !selected.size) return;
    const { error } = await supabase.from('timeline_entries').update({ responsibility_origin: value } as any).in('id', [...selected]);
    if (error) { toast({ title: 'Erro ao classificar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${selected.size} registro(s) classificados` });
    setValue(''); load();
  };

  const allSel = rows.length > 0 && selected.size === rows.length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
        <Select value={value} onValueChange={v => setValue(v as ResponsibilityOrigin)}>
          <SelectTrigger className="h-9 w-[280px] text-xs"><SelectValue placeholder="Escolha a classificação" /></SelectTrigger>
          <SelectContent>{Object.entries(RESPONSIBILITY_ORIGIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={apply} disabled={!value || !selected.size}>Classificar selecionados</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSel} onCheckedChange={v => setSelected(v ? new Set(rows.map(r => r.id)) : new Set())} /></TableHead>
              <TableHead>Data do fato</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Setor</TableHead><TableHead>Descrição</TableHead><TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              : rows.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Tudo classificado.</TableCell></TableRow>
              : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={v => setSelected(s => { const n = new Set(s); v ? n.add(r.id) : n.delete(r.id); return n; })} /></TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.occurredAt)}</TableCell>
                  <TableCell className="text-sm font-medium"><Link className="hover:underline" to={`/client/${r.clientId}?tab=ocorrencias`}>{r.clientName}</Link></TableCell>
                  <TableCell className="text-xs">{INTERACTION_LABELS[r.type] ?? r.type}</TableCell>
                  <TableCell className="text-xs">{SECTOR_LABELS[r.sector] ?? r.sector}</TableCell>
                  <TableCell className="max-w-[380px]"><p className="line-clamp-2 text-xs" title={r.description}>{r.description}</p></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.createdByName ?? 'Importado / sistema'}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface Metrics {
  total: number; escritorio: number; cliente: number; neutro: number; unclassified: number; open: number;
  avg_resolution_hours: number | null;
  monthly: { month: string; escritorio: number; cliente: number; neutro: number }[];
  by_sector: { sector: string; escritorio: number; cliente: number; neutro: number; total: number }[];
  recurrence: { client_id: string; client_name: string; total: number; escritorio: number; cliente: number; neutro: number }[];
}

function AnalysisTab() {
  const navigate = useNavigate();
  const [start, setStart] = useState(daysAgo(90));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [sector, setSector] = useState('all');
  const [resp, setResp] = useState('all');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    supabase.from('internal_users').select('id, name').eq('active', true).order('name').then(({ data }) => setUsers((data as any) || []));
  }, []);
  useEffect(() => {
    (supabase as any).rpc('rework_metrics', {
      p_start: start, p_end: end, p_sector: sector === 'all' ? null : sector, p_responsible: resp === 'all' ? null : resp,
    }).then(({ data }: any) => setM(data));
  }, [start, end, sector, resp]);

  const pct = (n: number) => (m && m.total ? `${((n / m.total) * 100).toFixed(1).replace('.', ',')}%` : '0%');
  const monthly = useMemo(() => (m?.monthly || []).map(x => {
    const [y, mo] = x.month.split('-');
    return { ...x, label: new Date(+y, +mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) };
  }), [m]);
  const hours = m?.avg_resolution_hours;
  const avgLabel = hours == null ? '—' : hours >= 24 ? `${(hours / 24).toFixed(1).replace('.', ',')} dias` : `${hours.toFixed(1).replace('.', ',')} h`;
  const predominant = (r: Metrics['recurrence'][number]): ResponsibilityOrigin =>
    r.escritorio >= r.cliente && r.escritorio >= r.neutro ? 'escritorio' : r.cliente >= r.neutro ? 'cliente' : 'neutro';

  const Stat = ({ title, value, sub, tone }: { title: string; value: string | number; sub?: string; tone?: string }) => (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className={`font-heading text-2xl font-bold ${tone ?? 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Input type="date" className="h-9 w-[150px] text-xs" value={start} onChange={e => setStart(e.target.value)} />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="date" className="h-9 w-[150px] text-xs" value={end} onChange={e => setEnd(e.target.value)} />
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os setores</SelectItem>{Object.entries(SECTOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={resp} onValueChange={setResp}>
          <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os responsáveis</SelectItem>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat title="Total de registros" value={m?.total ?? 0} sub={m?.unclassified ? `${m.unclassified} aguardando classificação` : undefined} />
        <Stat title="Do escritório" value={pct(m?.escritorio ?? 0)} sub={`${m?.escritorio ?? 0} registros`} tone="text-rework-office" />
        <Stat title="Do cliente" value={pct(m?.cliente ?? 0)} sub={`${m?.cliente ?? 0} registros · ${m?.neutro ?? 0} informativos`} tone="text-rework-client" />
        <Stat title="Em aberto" value={m?.open ?? 0} />
        <Stat title="Tempo médio até a resolução" value={avgLabel} sub="do registro à conclusão da tarefa" />
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-card">
        <p className="mb-3 font-heading text-sm font-semibold">Registros por mês</p>
        {monthly.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Sem registros classificados no período.</p> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="escritorio" name="Escritório" stackId="a" fill="hsl(var(--rework-office))" />
              <Bar dataKey="cliente" name="Cliente" stackId="a" fill="hsl(var(--rework-client))" />
              <Bar dataKey="neutro" name="Informativo" stackId="a" fill="hsl(var(--rework-neutral))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card shadow-card">
          <p className="p-4 pb-0 font-heading text-sm font-semibold">Por setor</p>
          <Table>
            <TableHeader><TableRow><TableHead>Setor</TableHead><TableHead className="text-right">Escritório</TableHead><TableHead className="text-right">Cliente</TableHead><TableHead className="text-right">Informativo</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {(m?.by_sector || []).length === 0 ? <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">—</TableCell></TableRow>
                : m!.by_sector.map(s => (
                  <TableRow key={s.sector}>
                    <TableCell>{(SECTOR_LABELS as any)[s.sector] ?? s.sector}</TableCell>
                    <TableCell className="text-right text-rework-office">{s.escritorio}</TableCell>
                    <TableCell className="text-right text-rework-client">{s.cliente}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{s.neutro}</TableCell>
                    <TableCell className="text-right font-semibold">{s.total}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        <div className="rounded-lg border bg-card shadow-card">
          <p className="p-4 pb-0 font-heading text-sm font-semibold">Recorrência (3 ou mais registros)</p>
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Predominante</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(m?.recurrence || []).length === 0 ? <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum cliente recorrente no período.</TableCell></TableRow>
                : m!.recurrence.map(r => (
                  <TableRow key={r.client_id}>
                    <TableCell className="font-medium"><Link className="hover:underline" to={`/client/${r.client_id}?tab=ocorrencias`}>{r.client_name}</Link></TableCell>
                    <TableCell className="text-right font-semibold">{r.total}</TableCell>
                    <TableCell><ClassificationBadge value={predominant(r)} /></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/client/${r.client_id}?tab=action-plan&new=1`)}>Criar plano de ação</Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default function Occurrences() {
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5">
        <h1 className="mb-4 font-heading text-2xl font-bold text-foreground">Ocorrências</h1>
        <Tabs defaultValue="registros">
          <TabsList>
            <TabsTrigger value="registros">Registros</TabsTrigger>
            <TabsTrigger value="pendentes">Pendentes de classificação</TabsTrigger>
            <TabsTrigger value="analise">Análise do retrabalho</TabsTrigger>
          </TabsList>
          <TabsContent value="registros" className="mt-4"><OccurrenceList /></TabsContent>
          <TabsContent value="pendentes" className="mt-4"><PendingTab /></TabsContent>
          <TabsContent value="analise" className="mt-4"><AnalysisTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
