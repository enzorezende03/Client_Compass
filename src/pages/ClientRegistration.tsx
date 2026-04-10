import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';
import {
  STATUS_LABELS, COMPLEXITY_LABELS, PROFILE_LABELS, FINANCIAL_LABELS, HEALTH_LABELS, RISK_TYPE_LABELS, TAXATION_LABELS,
  ClientStatus, ComplexityLevel, ClientProfile, FinancialStatus, HealthScore, RiskType, TaxationType
} from '@/types/client';

interface ClientForm {
  id?: string;
  name: string;
  document: string;
  segment: string;
  contract_start_date: string;
  cs_responsible: string;
  complexity: string;
  status: string;
  profile: string;
  financial_status: string;
  health_score: string;
  pain_points: string;
  expectations: string;
  attention_points: string;
  recurring_issues: string;
  behavioral_profile: string;
  strategic_notes: string;
  risk_reason: string;
  risk_type: string;
  risk_identified_date: string;
  action_plan: string;
  taxation: string;
}

const emptyForm: ClientForm = {
  name: '', document: '', segment: '', contract_start_date: new Date().toISOString().split('T')[0],
  cs_responsible: '', complexity: 'C', status: 'active', profile: 'standard',
  financial_status: 'active_financial', health_score: 'healthy',
  pain_points: '', expectations: '', attention_points: '', recurring_issues: '',
  behavioral_profile: '', strategic_notes: '',
  risk_reason: '', risk_type: '', risk_identified_date: '', action_plan: '',
  taxation: '',
};

export default function ClientRegistration() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const { toast } = useToast();

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const lookupCnpj = useCallback(async (rawDoc: string) => {
    const digits = rawDoc.replace(/\D/g, '');
    if (digits.length !== 14) return;

    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        toast({ title: 'CNPJ não encontrado', description: 'Verifique o número digitado.', variant: 'destructive' });
        return;
      }
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        segment: data.cnae_fiscal_descricao || prev.segment,
      }));
      toast({ title: 'Dados carregados', description: `Empresa: ${data.razao_social}` });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível consultar o CNPJ.', variant: 'destructive' });
    } finally {
      setCnpjLoading(false);
    }
  }, [toast]);

  const handleDocumentChange = (value: string) => {
    const formatted = formatCnpj(value);
    updateField('document', formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 14) {
      lookupCnpj(digits);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (!error && data) setClients(data);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.document.includes(search)
  );

  const openNew = () => { setForm(emptyForm); setSelectedId(null); setDialogOpen(true); };
  const openEdit = (client: any) => {
    setForm({
      name: client.name, document: client.document, segment: client.segment,
      contract_start_date: client.contract_start_date, cs_responsible: client.cs_responsible,
      complexity: client.complexity, status: client.status, profile: client.profile,
      financial_status: client.financial_status, health_score: client.health_score,
      pain_points: client.pain_points, expectations: client.expectations,
      attention_points: client.attention_points, recurring_issues: client.recurring_issues,
      behavioral_profile: client.behavioral_profile, strategic_notes: client.strategic_notes,
      risk_reason: client.risk_reason || '', risk_type: client.risk_type || '',
      risk_identified_date: client.risk_identified_date || '', action_plan: client.action_plan || '',
      taxation: client.taxation || '',
    });
    setSelectedId(client.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    const payload = {
      ...form,
      risk_reason: form.risk_reason || null,
      risk_type: form.risk_type || null,
      risk_identified_date: form.risk_identified_date || null,
      action_plan: form.action_plan || null,
      taxation: form.taxation || '',
    };

    if (selectedId) {
      const { error } = await supabase.from('clients').update(payload).eq('id', selectedId);
      if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Cliente atualizado!' });
    } else {
      const { error } = await supabase.from('clients').insert(payload);
      if (error) { toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Cliente criado!' });
    }
    setDialogOpen(false);
    fetchClients();
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

  const updateField = (field: keyof ClientForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

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
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
              ) : (
                filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.document}</TableCell>
                    <TableCell>{c.segment}</TableCell>
                    <TableCell>{STATUS_LABELS[c.status as ClientStatus] || c.status}</TableCell>
                    <TableCell>{c.cs_responsible}</TableCell>
                    <TableCell>{COMPLEXITY_LABELS[c.complexity as ComplexityLevel] || c.complexity}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedId(c.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedId ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            <DialogDescription>Preencha os dados do cliente.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => updateField('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <div className="relative">
                <Input
                  value={form.document}
                  onChange={e => handleDocumentChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
                {cnpjLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Input value={form.segment} onChange={e => updateField('segment', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Início Contrato</Label>
              <Input type="date" value={form.contract_start_date} onChange={e => updateField('contract_start_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CS Responsável</Label>
              <Input value={form.cs_responsible} onChange={e => updateField('cs_responsible', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Complexidade</Label>
              <Select value={form.complexity} onValueChange={v => updateField('complexity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => updateField('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={form.profile} onValueChange={v => updateField('profile', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROFILE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Financeiro</Label>
              <Select value={form.financial_status} onValueChange={v => updateField('financial_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FINANCIAL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Health Score</Label>
              <Select value={form.health_score} onValueChange={v => updateField('health_score', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(HEALTH_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tributação</Label>
              <Select value={form.taxation || 'none'} onValueChange={v => updateField('taxation', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definida</SelectItem>
                  {Object.entries(TAXATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Visão Estratégica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Principais Dores</Label><Textarea value={form.pain_points} onChange={e => updateField('pain_points', e.target.value)} rows={2} /></div>
            <div className="space-y-2"><Label>Expectativas</Label><Textarea value={form.expectations} onChange={e => updateField('expectations', e.target.value)} rows={2} /></div>
            <div className="space-y-2"><Label>Pontos de Atenção</Label><Textarea value={form.attention_points} onChange={e => updateField('attention_points', e.target.value)} rows={2} /></div>
            <div className="space-y-2"><Label>Problemas Recorrentes</Label><Textarea value={form.recurring_issues} onChange={e => updateField('recurring_issues', e.target.value)} rows={2} /></div>
            <div className="space-y-2"><Label>Perfil Comportamental</Label><Textarea value={form.behavioral_profile} onChange={e => updateField('behavioral_profile', e.target.value)} rows={2} /></div>
            <div className="space-y-2"><Label>Notas Estratégicas</Label><Textarea value={form.strategic_notes} onChange={e => updateField('strategic_notes', e.target.value)} rows={2} /></div>
          </div>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Gestão de Risco</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Motivo do Risco</Label><Input value={form.risk_reason} onChange={e => updateField('risk_reason', e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Tipo de Risco</Label>
              <Select value={form.risk_type || 'none'} onValueChange={v => updateField('risk_type', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {Object.entries(RISK_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Data Identificação</Label><Input type="date" value={form.risk_identified_date} onChange={e => updateField('risk_identified_date', e.target.value)} /></div>
            <div className="space-y-2"><Label>Plano de Ação</Label><Textarea value={form.action_plan} onChange={e => updateField('action_plan', e.target.value)} rows={2} /></div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{selectedId ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
