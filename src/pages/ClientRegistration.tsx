import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Download, ArchiveRestore, UserX } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { formatDocument } from '@/lib/document';
import { RegisterTerminationDialog } from '@/components/TerminationDialog';
import { TERMINATION_REASON_LABELS } from '@/lib/churn';
import {
  STATUS_LABELS, STATUS_EMOJIS, ClientStatus,
  PROFILE_LABELS, PROFILE_ICONS, PROFILE_COLORS, ClientProfile,
} from '@/types/client';

export default function ClientRegistration() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'ativos' | 'arquivados' | 'distratos'>('ativos');
  const [terminateTarget, setTerminateTarget] = useState<any | null>(null);
  const [terms, setTerms] = useState<any[]>([]);
  const [unarchiveTarget, setUnarchiveTarget] = useState<any | null>(null);
  const { toast } = useToast();

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (!error && data) {
      setClients(data);
      const ids = data.map(c => c.id);
      if (ids.length) {
        const { data: contacts } = await supabase.from('client_contacts').select('client_id').in('client_id', ids);
        if (contacts) {
          const counts: Record<string, number> = {};
          contacts.forEach((c: any) => { counts[c.client_id] = (counts[c.client_id] || 0) + 1; });
          setContactCounts(counts);
        }
      }
    }
    const { data: t } = await supabase.from('client_terminations' as any)
      .select('*, clients(name, document)').order('request_date', { ascending: false });
    setTerms((t as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const searchDigits = search.replace(/\D/g, '');
  const archivedCount = clients.filter(c => c.archived).length;
  const filtered = clients.filter(c =>
    (tab === 'arquivados' ? !!c.archived : !c.archived) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
    (searchDigits.length > 0 && c.document.replace(/\D/g, '').includes(searchDigits)))
  );

  const handleUnarchive = async () => {
    if (!unarchiveTarget) return;
    const { error } = await supabase.from('clients').update({
      archived: false, archived_at: null, archived_reason: '', archived_by: '',
    }).eq('id', unarchiveTarget.id);
    if (error) { toast({ title: 'Erro ao desarquivar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Cliente desarquivado', description: `${unarchiveTarget.name} voltou para a carteira ativa.` });
    setUnarchiveTarget(null);
    fetchClients();
  };

  const openNew = () => navigate('/cadastro/clientes/novo');
  const openEdit = (client: any) => navigate(`/cadastro/clientes/${client.id}/editar`);

  const exportClientsReport = () => {
    const rows = filtered.map(c => {
      return {
        Nome: c.name,
        Documento: formatDocument(c.document),
        Segmento: c.segment,
        Status: `${STATUS_EMOJIS[c.status as ClientStatus] ?? ''} ${STATUS_LABELS[c.status as ClientStatus] || c.status}`.trim(),
        Tier: `${PROFILE_ICONS[c.profile as ClientProfile] ?? ''} ${PROFILE_LABELS[c.profile as ClientProfile] || c.profile || ''}`.trim(),
        'Contatos cadastrados': contactCounts[c.id] || 0,
        'Início do contrato': c.contract_start_date,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 34 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 24 },
      { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    XLSX.writeFile(workbook, `relatorio-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Relatório baixado!', description: `${rows.length} cliente(s) exportado(s) para Excel.` });
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const { error } = await supabase.from('clients').delete().eq('id', selectedId);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Cliente excluído!' });
    setDeleteDialogOpen(false);
    setSelectedId(null);
    fetchClients();
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Clientes</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportClientsReport} className="gap-2" disabled={loading || filtered.length === 0}>
              <Download className="h-4 w-4" /> Baixar Excel
            </Button>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Cliente
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setTab('ativos')}
              className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', tab === 'ativos' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => setTab('arquivados')}
              className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', tab === 'arquivados' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              Arquivados ({archivedCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('distratos')}
              className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', tab === 'distratos' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              Distratos ({terms.length})
            </button>
          </div>
          <div className="relative max-w-sm flex-1 sm:flex-none sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {tab === 'distratos' ? <TerminationsReport terms={terms} search={search} /> : (
        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[180px] whitespace-nowrap">Documento</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]">Tier</TableHead>
                {tab === 'arquivados' && <TableHead>Motivo do arquivamento</TableHead>}
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={tab === 'arquivados' ? 7 : 6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={tab === 'arquivados' ? 7 : 6} className="text-center py-8 text-muted-foreground">{tab === 'arquivados' ? 'Nenhum cliente arquivado.' : 'Nenhum cliente encontrado.'}</TableCell></TableRow>
              ) : (
                filtered.map(c => {
                  const profile = c.profile as ClientProfile;
                  const profileTone = PROFILE_COLORS[profile];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{formatDocument(c.document)}</TableCell>
                      <TableCell>{c.segment}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden>{STATUS_EMOJIS[c.status as ClientStatus] ?? ''}</span>
                          {STATUS_LABELS[c.status as ClientStatus] || c.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {profileTone ? (
                          <span className={cn('inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold', profileTone.bg, profileTone.text, profileTone.border)}>
                            <span aria-hidden>{PROFILE_ICONS[profile]}</span>
                            {PROFILE_LABELS[profile]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {tab === 'arquivados' && (
                        <TableCell className="max-w-[260px]">
                          <p className="truncate text-xs text-muted-foreground" title={c.archived_reason || ''}>{c.archived_reason || '—'}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.archived_at ? new Date(c.archived_at).toLocaleDateString('pt-BR') : ''}{c.archived_by ? ` · ${c.archived_by}` : ''}
                          </p>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-1">
                          {tab === 'arquivados' ? (
                            <Button variant="ghost" size="icon" title="Desarquivar" onClick={() => setUnarchiveTarget(c)}><ArchiveRestore className="h-4 w-4" /></Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" title="Desativar por distrato" onClick={() => setTerminateTarget(c)}><UserX className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setSelectedId(c.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unarchiveTarget} onOpenChange={open => { if (!open) setUnarchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desarquivar cliente?</DialogTitle>
            <DialogDescription>{unarchiveTarget?.name} voltará para a carteira ativa.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnarchiveTarget(null)}>Cancelar</Button>
            <Button onClick={handleUnarchive}>Desarquivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {terminateTarget && (
        <RegisterTerminationDialog
          open={!!terminateTarget}
          onOpenChange={o => { if (!o) setTerminateTarget(null); }}
          clientId={terminateTarget.id}
          defaultArchive
          onDone={() => { setTerminateTarget(null); fetchClients(); }}
        />
      )}
    </AppLayout>
  );
}

function TerminationsReport({ terms, search }: { terms: any[]; search: string }) {
  const q = search.toLowerCase();
  const rows = terms.filter(t => !q || (t.clients?.name || '').toLowerCase().includes(q));
  const active = rows.filter(t => !t.reverted_at);
  const byClient = active.filter(t => t.initiated_by === 'cliente').length;
  const byOffice = active.filter(t => t.initiated_by === 'escritorio').length;
  const errors = active.filter(t => t.was_error);
  const sectors: Record<string, number> = {};
  errors.forEach(t => { if (t.error_sector) sectors[t.error_sector] = (sectors[t.error_sector] || 0) + 1; });
  const reasons: Record<string, number> = {};
  active.forEach(t => { reasons[t.reason_category] = (reasons[t.reason_category] || 0) + 1; });
  const label = (k: string) => (TERMINATION_REASON_LABELS as any)[k] || k;

  const exportXlsx = () => {
    const data = rows.map(t => ({
      Cliente: t.clients?.name, Documento: formatDocument(t.clients?.document || ''),
      'Data do pedido': t.request_date, Motivo: label(t.reason_category), Detalhe: t.reason_detail,
      Origem: t.initiated_by === 'escritorio' ? 'Contabilidade' : 'Cliente',
      'Erro nosso': t.was_error ? 'Sim' : 'Não', 'Área do erro': t.error_sector || '',
      Melhoria: t.improvement_notes, Mensalidade: t.monthly_fee_at_termination ?? '',
      Situação: t.reverted_at ? 'Revertido' : 'Ativo',
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Distratos');
    XLSX.writeFile(wb, `distratos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const Stat = ({ title, value, sub }: { title: string; value: string | number; sub?: string }) => (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="font-heading text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat title="Distratos ativos" value={active.length} sub={`${rows.length - active.length} revertidos`} />
        <Stat title="Originados pelo cliente" value={byClient} />
        <Stat title="Originados pela contabilidade" value={byOffice} />
        <Stat title="Com erro nosso" value={errors.length}
          sub={Object.entries(sectors).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}: ${n}`).join(' · ') || undefined} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <span key={k} className="rounded-full border bg-muted/40 px-3 py-1 text-xs">{label(k)}: <b>{n}</b></span>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportXlsx} disabled={!rows.length}>
          <Download className="h-4 w-4" /> Baixar Excel
        </Button>
      </div>
      <div className="rounded-lg border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead><TableHead>Pedido</TableHead><TableHead>Motivo</TableHead>
              <TableHead>Origem</TableHead><TableHead>Erro</TableHead><TableHead>Melhoria</TableHead><TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum distrato registrado.</TableCell></TableRow>
            ) : rows.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.clients?.name}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(t.request_date + 'T12:00').toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="max-w-[220px]"><p>{label(t.reason_category)}</p><p className="truncate text-xs text-muted-foreground" title={t.reason_detail}>{t.reason_detail}</p></TableCell>
                <TableCell>{t.initiated_by === 'escritorio' ? 'Contabilidade' : 'Cliente'}</TableCell>
                <TableCell>{t.was_error ? <span className="text-destructive">Sim{t.error_sector ? ` · ${t.error_sector}` : ''}</span> : 'Não'}</TableCell>
                <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground" title={t.improvement_notes}>{t.improvement_notes || '—'}</TableCell>
                <TableCell>{t.reverted_at ? 'Revertido' : 'Ativo'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
