import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';
import { computeCompleteness, completenessTone } from '@/lib/clientCompleteness';
import { cn } from '@/lib/utils';
import {
  STATUS_LABELS, COMPLEXITY_LABELS, ClientStatus, ComplexityLevel,
} from '@/types/client';

export default function ClientRegistration() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.document.includes(search)
  );

  const openNew = () => navigate('/cadastro/clientes/novo');
  const openEdit = (client: any) => navigate(`/cadastro/clientes/${client.id}/editar`);

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
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>CS Responsável</TableHead>
                <TableHead>Complexidade</TableHead>
                <TableHead className="w-[160px]">Completude</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
              ) : (
                filtered.map(c => {
                  const pct = computeCompleteness(c, contactCounts[c.id] || 0);
                  const tone = completenessTone(pct);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.document}</TableCell>
                      <TableCell>{c.segment}</TableCell>
                      <TableCell>{STATUS_LABELS[c.status as ClientStatus] || c.status}</TableCell>
                      <TableCell>{c.cs_responsible}</TableCell>
                      <TableCell>{COMPLEXITY_LABELS[c.complexity as ComplexityLevel] || c.complexity}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[60px]">
                            <div className={cn('h-full transition-all', tone.barClass)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={cn('text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded border', tone.badgeClass)}>
                            {pct}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedId(c.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
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
    </AppLayout>
  );
}
