import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, CheckSquare, Square, Users, ClipboardList, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AppLayout } from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

function useSessionState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch { return initialValue; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);
  return [state, setState];
}

function useSessionSet(key: string, initialValue: string[] = []): [Set<string>, (val: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const [state, setState] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? new Set(JSON.parse(saved)) : new Set(initialValue);
    } catch { return new Set(initialValue); }
  });
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify([...state])); } catch {}
  }, [key, state]);
  return [state, setState];
}
interface PreviewContact {
  nome: string;
  telefone: string;
  email: string;
  cargo: string;
}

interface PreviewClient {
  gclick_id: string;
  nome: string;
  inscricao: string;
  segmento: string;
  status: string;
  match_type: 'new' | 'update';
  match_id?: string;
  data_inicio: string;
  tributacao: string;
  contatos: PreviewContact[];
}

interface PreviewTask {
  gclick_id: string;
  title: string;
  client_name: string;
  responsible: string;
  due_date: string;
}

type SyncTab = 'clients' | 'tasks';

async function callGclick(action: string, body?: any) {
  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/gclick-sync`;
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${baseUrl}?action=${action}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function GClickSync() {
  const { toast } = useToast();
  const [tab, setTab] = useState<SyncTab>('clients');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Clients preview
  const [previewClients, setPreviewClients] = useSessionState<PreviewClient[]>('gclick_preview_clients', []);
  const [selectedClients, setSelectedClients] = useSessionSet('gclick_selected_clients');
  const [clientSearch, setClientSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'cpf' | 'cnpj'>('all');
  const [taxationFilter, setTaxationFilter] = useState<string>('all');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Tasks preview
  const [previewTasks, setPreviewTasks] = useSessionState<PreviewTask[]>('gclick_preview_tasks', []);
  const [selectedTasks, setSelectedTasks] = useSessionSet('gclick_selected_tasks');
  const [taskSearch, setTaskSearch] = useState('');

  // Ignored clients management
  const [ignoredList, setIgnoredList] = useState<Array<{ id: string; gclick_id: string; nome: string; inscricao: string; ignored_by: string; created_at: string }>>([]);
  const [ignoredDialogOpen, setIgnoredDialogOpen] = useState(false);
  const [confirmIgnoreOpen, setConfirmIgnoreOpen] = useState(false);
  const [loadingIgnored, setLoadingIgnored] = useState(false);

  const fetchPreview = async (type: SyncTab) => {
    setLoading(true);
    try {
      const data = await callGclick(`preview-${type}`);
      if (!data.success) throw new Error(data.error);

      if (type === 'clients') {
        setPreviewClients(data.items || []);
        setSelectedClients(new Set((data.items || []).map((c: PreviewClient) => c.gclick_id)));
      } else {
        setPreviewTasks(data.items || []);
        setSelectedTasks(new Set((data.items || []).map((t: PreviewTask) => t.gclick_id)));
      }
      toast({ title: 'Preview carregado', description: `${(data.items || []).length} registros encontrados no G-Click` });
    } catch (err: any) {
      toast({ title: 'Erro ao buscar preview', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (type: SyncTab) => {
    const selected = type === 'clients' ? [...selectedClients] : [...selectedTasks];
    if (selected.length === 0) {
      toast({ title: 'Nenhum item selecionado', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      const data = await callGclick(`import-${type}`, { selected_ids: selected });
      if (!data.success) throw new Error(data.error);
      toast({ title: 'Importação concluída!', description: `${data.imported || 0} registros importados com sucesso.` });
      // Clear preview
      if (type === 'clients') { setPreviewClients([]); setSelectedClients(new Set()); }
      else { setPreviewTasks([]); setSelectedTasks(new Set()); }
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const toggleAll = (type: SyncTab) => {
    if (type === 'clients') {
      const filtered = filteredClients.map(c => c.gclick_id);
      const allSelected = filtered.every(id => selectedClients.has(id));
      const next = new Set(selectedClients);
      filtered.forEach(id => allSelected ? next.delete(id) : next.add(id));
      setSelectedClients(next);
    } else {
      const filtered = filteredTasks.map(t => t.gclick_id);
      const allSelected = filtered.every(id => selectedTasks.has(id));
      const next = new Set(selectedTasks);
      filtered.forEach(id => allSelected ? next.delete(id) : next.add(id));
      setSelectedTasks(next);
    }
  };

  const toggleItem = (type: SyncTab, id: string) => {
    if (type === 'clients') {
      const next = new Set(selectedClients);
      next.has(id) ? next.delete(id) : next.add(id);
      setSelectedClients(next);
    } else {
      const next = new Set(selectedTasks);
      next.has(id) ? next.delete(id) : next.add(id);
      setSelectedTasks(next);
    }
  };

  const taxationOptions = [...new Set(previewClients.map(c => c.tributacao).filter(Boolean))].sort();
  const hasUntaxed = previewClients.some(c => !c.tributacao);

  const filteredClients = previewClients.filter(c => {
    const docClean = (c.inscricao || '').replace(/\D/g, '');
    if (docTypeFilter === 'cpf' && docClean.length !== 11) return false;
    if (docTypeFilter === 'cnpj' && docClean.length !== 14) return false;
    if (taxationFilter === '__none__') {
      if (c.tributacao) return false;
    } else if (taxationFilter !== 'all' && (c.tributacao || '') !== taxationFilter) {
      return false;
    }
    if (clientSearch === '') return true;
    const term = clientSearch.toLowerCase().replace(/\D/g, '');
    const termRaw = clientSearch.toLowerCase();
    return c.nome.toLowerCase().includes(termRaw) || (term.length > 0 && docClean.includes(term));
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (!sortColumn) return 0;
    const fieldMap: Record<string, (c: PreviewClient) => string> = {
      nome: c => c.nome || '',
      inscricao: c => c.inscricao || '',
      segmento: c => c.segmento || '',
      data_inicio: c => c.data_inicio || '',
      tributacao: c => c.tributacao || '',
      match_type: c => c.match_type || '',
    };
    const getter = fieldMap[sortColumn];
    if (!getter) return 0;
    const valA = getter(a).toLowerCase();
    const valB = getter(b).toLowerCase();
    const cmp = valA.localeCompare(valB, 'pt-BR');
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filteredTasks = previewTasks.filter(t =>
    taskSearch === '' ||
    t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.client_name.toLowerCase().includes(taskSearch.toLowerCase())
  );

  const exportGClickReport = () => {
    const isClients = tab === 'clients';
    const rows = isClients
      ? sortedClients.map(c => ({
          Nome: c.nome,
          'CNPJ/CPF': c.inscricao,
          Segmento: c.segmento,
          'Data Início': c.data_inicio,
          Tributação: c.tributacao,
          Tipo: c.match_type === 'new' ? 'Novo' : 'Atualizar',
          'Qtd. Contatos': c.contatos?.length || 0,
          Contatos: (c.contatos || []).map(ct => [ct.nome, ct.cargo, ct.telefone, ct.email].filter(Boolean).join(' - ')).join(' | '),
        }))
      : filteredTasks.map(t => ({
          Título: t.title,
          Cliente: t.client_name,
          Responsável: t.responsible,
          Vencimento: t.due_date,
          'ID G-Click': t.gclick_id,
        }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = isClients
      ? [{ wch: 34 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 70 }]
      : [{ wch: 34 }, { wch: 34 }, { wch: 24 }, { wch: 16 }, { wch: 22 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isClients ? 'Clientes G-Click' : 'Tarefas G-Click');
    XLSX.writeFile(workbook, `gclick-${isClients ? 'clientes' : 'tarefas'}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Relatório baixado!', description: `${rows.length} registro(s) exportado(s) para Excel.` });
  };

  const loadIgnored = async () => {
    setLoadingIgnored(true);
    try {
      const data = await callGclick('list-ignored');
      if (!data.success) throw new Error(data.error);
      setIgnoredList(data.items || []);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar ignorados', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingIgnored(false);
    }
  };

  const handleIgnoreSelected = async () => {
    const items = previewClients
      .filter(c => selectedClients.has(c.gclick_id))
      .map(c => ({ gclick_id: c.gclick_id, nome: c.nome, inscricao: c.inscricao }));
    if (items.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const data = await callGclick('ignore-clients', { items, ignored_by: user?.email || '' });
      if (!data.success) throw new Error(data.error);
      toast({ title: 'Clientes desconsiderados', description: `${data.ignored} cliente(s) não aparecerão mais nas próximas sincronizações.` });
      // Remove from current preview
      setPreviewClients(previewClients.filter(c => !selectedClients.has(c.gclick_id)));
      setSelectedClients(new Set());
    } catch (err: any) {
      toast({ title: 'Erro ao desconsiderar', description: err.message, variant: 'destructive' });
    } finally {
      setConfirmIgnoreOpen(false);
    }
  };

  const handleRestoreIgnored = async (gclickId: string) => {
    try {
      const data = await callGclick('restore-ignored', { gclick_ids: [gclickId] });
      if (!data.success) throw new Error(data.error);
      toast({ title: 'Cliente restaurado', description: 'Voltará a aparecer na próxima sincronização.' });
      setIgnoredList(prev => prev.filter(i => i.gclick_id !== gclickId));
    } catch (err: any) {
      toast({ title: 'Erro ao restaurar', description: err.message, variant: 'destructive' });
    }
  };

  const openIgnoredDialog = () => {
    setIgnoredDialogOpen(true);
    loadIgnored();
  };
         <div className="mb-6">
           <h1 className="text-2xl font-bold text-foreground">Sincronização G-Click</h1>
           <p className="text-sm text-muted-foreground">Visualize e aprove os dados antes de importar</p>
         </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as SyncTab)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="clients" className="gap-2">
                <Users className="h-4 w-4" /> Clientes
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <ClipboardList className="h-4 w-4" /> Tarefas
              </TabsTrigger>
            </TabsList>
             <div className="flex items-center gap-2">
               <Button
                 variant="outline"
                 onClick={exportGClickReport}
                 disabled={loading || (tab === 'clients' ? sortedClients.length === 0 : filteredTasks.length === 0)}
                 className="gap-2"
               >
                 <Download className="h-4 w-4" /> Baixar Excel
               </Button>
               <Button onClick={() => fetchPreview(tab)} disabled={loading} className="gap-2">
                 <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                 {loading ? 'Buscando...' : 'Buscar do G-Click'}
               </Button>
             </div>
          </div>

          {/* CLIENTS TAB */}
          <TabsContent value="clients">
            {previewClients.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Filtrar por nome, CPF ou CNPJ..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={docTypeFilter} onValueChange={(v) => setDocTypeFilter(v as 'all' | 'cpf' | 'cnpj')}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Tipo doc" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={taxationFilter} onValueChange={setTaxationFilter}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Tributação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas tributações</SelectItem>
                      {hasUntaxed && (
                        <SelectItem value="__none__">⚠️ Sem tributação</SelectItem>
                      )}
                      {taxationOptions.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedClients.size} de {previewClients.length} selecionados
                    </span>
                    <Button variant="outline" size="sm" onClick={() => toggleAll('clients')}>
                      {filteredClients.every(c => selectedClients.has(c.gclick_id))
                        ? <><Square className="h-4 w-4 mr-1" /> Desmarcar todos</>
                        : <><CheckSquare className="h-4 w-4 mr-1" /> Selecionar todos</>}
                    </Button>
                    <Button onClick={() => handleImport('clients')} disabled={importing || selectedClients.size === 0} className="gap-2">
                      <Check className="h-4 w-4" />
                      {importing ? 'Importando...' : `Importar ${selectedClients.size} clientes`}
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('nome')}>
                          <span className="flex items-center">Nome<SortIcon column="nome" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('inscricao')}>
                          <span className="flex items-center">CNPJ/CPF<SortIcon column="inscricao" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('segmento')}>
                          <span className="flex items-center">Segmento<SortIcon column="segmento" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('data_inicio')}>
                          <span className="flex items-center">Data Início<SortIcon column="data_inicio" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('tributacao')}>
                          <span className="flex items-center">Tributação<SortIcon column="tributacao" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('match_type')}>
                          <span className="flex items-center">Tipo<SortIcon column="match_type" /></span>
                        </TableHead>
                        <TableHead>Contatos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedClients.map(c => (
                        <>
                        <TableRow key={c.gclick_id} className="cursor-pointer" onClick={() => toggleItem('clients', c.gclick_id)}>
                          <TableCell>
                            <Checkbox checked={selectedClients.has(c.gclick_id)} />
                          </TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="font-mono text-sm">{c.inscricao}</TableCell>
                          <TableCell>{c.segmento}</TableCell>
                          <TableCell className="text-sm">{c.data_inicio || '—'}</TableCell>
                          <TableCell className="text-sm">{c.tributacao || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={c.match_type === 'new' ? 'default' : 'secondary'}>
                              {c.match_type === 'new' ? 'Novo' : 'Atualizar'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {c.contatos && c.contatos.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedClients(prev => {
                                    const next = new Set(prev);
                                    next.has(c.gclick_id) ? next.delete(c.gclick_id) : next.add(c.gclick_id);
                                    return next;
                                  });
                                }}
                                className="gap-1 text-xs"
                              >
                                {expandedClients.has(c.gclick_id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                {c.contatos.length} contato{c.contatos.length > 1 ? 's' : ''}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedClients.has(c.gclick_id) && c.contatos && c.contatos.length > 0 && (
                          <TableRow key={`${c.gclick_id}-contacts`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="px-12 py-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Contatos</p>
                                <div className="grid gap-1">
                                  {c.contatos.map((ct, idx) => (
                                    <div key={idx} className="text-sm flex gap-4">
                                      <span className="font-medium min-w-[150px]">{ct.nome}</span>
                                      {ct.cargo && <span className="text-muted-foreground">{ct.cargo}</span>}
                                      {ct.telefone && <span className="font-mono">{ct.telefone}</span>}
                                      {ct.email && <span className="text-primary">{ct.email}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {previewClients.length === 0 && !loading && (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Clique em "Buscar do G-Click" para carregar os clientes disponíveis para importação.</p>
              </div>
            )}
          </TabsContent>

          {/* TASKS TAB */}
          <TabsContent value="tasks">
            {previewTasks.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4 gap-4">
                  <Input
                    placeholder="Filtrar por título ou cliente..."
                    value={taskSearch}
                    onChange={e => setTaskSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedTasks.size} de {previewTasks.length} selecionados
                    </span>
                    <Button variant="outline" size="sm" onClick={() => toggleAll('tasks')}>
                      {filteredTasks.every(t => selectedTasks.has(t.gclick_id))
                        ? <><Square className="h-4 w-4 mr-1" /> Desmarcar todos</>
                        : <><CheckSquare className="h-4 w-4 mr-1" /> Selecionar todos</>}
                    </Button>
                    <Button onClick={() => handleImport('tasks')} disabled={importing || selectedTasks.size === 0} className="gap-2">
                      <Check className="h-4 w-4" />
                      {importing ? 'Importando...' : `Importar ${selectedTasks.size} tarefas`}
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Vencimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map(t => (
                        <TableRow key={t.gclick_id} className="cursor-pointer" onClick={() => toggleItem('tasks', t.gclick_id)}>
                          <TableCell>
                            <Checkbox checked={selectedTasks.has(t.gclick_id)} />
                          </TableCell>
                          <TableCell className="font-medium">{t.title}</TableCell>
                          <TableCell>{t.client_name}</TableCell>
                          <TableCell>{t.responsible}</TableCell>
                          <TableCell>{t.due_date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {previewTasks.length === 0 && !loading && (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Clique em "Buscar do G-Click" para carregar as tarefas disponíveis para importação.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
