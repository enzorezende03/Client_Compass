import { useState } from 'react';
import { RefreshCw, Check, X, CheckSquare, Square, ArrowLeft, Users, Briefcase, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppLayout } from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface PreviewClient {
  gclick_id: string;
  nome: string;
  inscricao: string;
  segmento: string;
  status: string;
  match_type: 'new' | 'update';
  match_id?: string;
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<SyncTab>('clients');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Clients preview
  const [previewClients, setPreviewClients] = useState<PreviewClient[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState('');

  // Tasks preview
  const [previewTasks, setPreviewTasks] = useState<PreviewTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [taskSearch, setTaskSearch] = useState('');

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

  const filteredClients = previewClients.filter(c =>
    clientSearch === '' ||
    c.nome.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.inscricao.includes(clientSearch)
  );

  const filteredTasks = previewTasks.filter(t =>
    taskSearch === '' ||
    t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.client_name.toLowerCase().includes(taskSearch.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sincronização G-Click</h1>
            <p className="text-sm text-muted-foreground">Visualize e aprove os dados antes de importar</p>
          </div>
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
            <Button onClick={() => fetchPreview(tab)} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Buscando...' : 'Buscar do G-Click'}
            </Button>
          </div>

          {/* CLIENTS TAB */}
          <TabsContent value="clients">
            {previewClients.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4 gap-4">
                  <Input
                    placeholder="Filtrar por nome ou CNPJ..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="max-w-sm"
                  />
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
                        <TableHead>Nome</TableHead>
                        <TableHead>CNPJ/CPF</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.map(c => (
                        <TableRow key={c.gclick_id} className="cursor-pointer" onClick={() => toggleItem('clients', c.gclick_id)}>
                          <TableCell>
                            <Checkbox checked={selectedClients.has(c.gclick_id)} />
                          </TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="font-mono text-sm">{c.inscricao}</TableCell>
                          <TableCell>{c.segmento}</TableCell>
                          <TableCell>
                            <Badge variant={c.match_type === 'new' ? 'default' : 'secondary'}>
                              {c.match_type === 'new' ? 'Novo' : 'Atualizar'}
                            </Badge>
                          </TableCell>
                        </TableRow>
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
