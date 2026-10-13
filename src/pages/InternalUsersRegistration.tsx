import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Copy, Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';
import { useIsAdmin } from '@/hooks/usePermission';

const PERMISSION_GROUPS: { module: string; items: { key: string; label: string }[] }[] = [
  { module: 'Ocorrências', items: [
    { key: 'occurrences.view', label: 'Visualizar' }, { key: 'occurrences.create', label: 'Registrar' },
    { key: 'occurrences.edit', label: 'Editar' }, { key: 'occurrences.cancel', label: 'Cancelar' } ] },
  { module: 'Clientes', items: [
    { key: 'clients.view', label: 'Visualizar' }, { key: 'clients.create', label: 'Cadastrar' },
    { key: 'clients.edit', label: 'Editar' }, { key: 'clients.archive', label: 'Arquivar / excluir' } ] },
  { module: 'Tarefas / Execução', items: [
    { key: 'tasks.view', label: 'Visualizar' }, { key: 'tasks.create', label: 'Criar' }, { key: 'tasks.edit', label: 'Editar' },
    { key: 'tasks.reschedule', label: 'Remanejar' }, { key: 'tasks.delete', label: 'Remover' } ] },
  { module: 'Onboarding', items: [
    { key: 'onboarding.view', label: 'Visualizar' }, { key: 'onboarding.complete', label: 'Concluir itens' },
    { key: 'onboarding.move_stage', label: 'Mover etapa' }, { key: 'onboarding.edit_procedure', label: 'Editar procedimento' } ] },
  { module: 'Prazos', items: [ { key: 'manage_sla_catalog', label: 'Editar prazos de demandas' } ] },
];

/** Espelho do padrão do banco (profile_default_permission). */
function profileDefault(profile: string, perm: string) {
  if (profile === 'admin') return true;
  if (profile === 'cs') return !['occurrences.edit', 'occurrences.cancel', 'onboarding.edit_procedure', 'manage_sla_catalog'].includes(perm);
  if (profile === 'operacional') return ['clients.view', 'occurrences.view', 'occurrences.create', 'tasks.view', 'onboarding.view'].includes(perm);
  if (profile === 'viewer') return perm.endsWith('.view');
  return false;
}

const ACCESS_PROFILE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  cs: 'Customer Success',
  operacional: 'Operacional',
  viewer: 'Liderança (somente leitura)',
};

const ACCESS_PROFILE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Acesso total, incluindo usuários e permissões.',
  cs: 'Gerencia clientes, tarefas, onboarding e ocorrências.',
  operacional: 'Consulta clientes, registra ocorrências e atualiza as próprias tarefas.',
  viewer: 'Somente leitura do painel de clientes e das ocorrências.',
};

interface UserForm {
  name: string;
  email: string;
  access_profile: string;
  active: boolean;
}

const emptyForm: UserForm = {
  name: '', email: '', access_profile: 'cs', active: true,
};

export default function InternalUsersRegistration() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credentialsDialog, setCredentialsDialog] = useState<{ open: boolean; email: string; password: string }>({ open: false, email: '', password: '' });
  const [copied, setCopied] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [permSaving, setPermSaving] = useState<string | null>(null);
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('internal_users' as any).select('*').order('name');
    if (!error && data) setUsers(data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchPermissions = async (userId: string) => {
    const { data } = await supabase.from('internal_user_permissions' as any).select('permission, granted').eq('internal_user_id', userId);
    const o: Record<string, boolean> = {};
    ((data as any[]) ?? []).forEach(r => { if (!r.permission.startsWith('manage_') || r.permission === 'manage_sla_catalog') o[r.permission] = r.granted; });
    setOverrides(o);
  };

  const effective = (perm: string) => overrides[perm] ?? profileDefault(form.access_profile, perm);

  const togglePermission = async (permission: string, enabled: boolean) => {
    if (!selectedId) return;
    setPermSaving(permission);
    const isDefault = profileDefault(form.access_profile, permission) === enabled;
    const t = supabase.from('internal_user_permissions' as any) as any;
    const { error } = isDefault
      ? await t.delete().eq('internal_user_id', selectedId).eq('permission', permission)
      : await t.upsert({ internal_user_id: selectedId, permission, granted: enabled }, { onConflict: 'internal_user_id,permission' });
    // aliases antigos deixam de valer quando a ocorrência/procedimento é ajustado aqui
    if (!error && (permission.startsWith('occurrences.') || permission === 'onboarding.edit_procedure')) {
      await t.delete().eq('internal_user_id', selectedId).in('permission', ['manage_occurrences', 'manage_onboarding_procedures']);
    }
    setPermSaving(null);
    if (error) { toast({ title: 'Erro ao atualizar permissão', description: error.message, variant: 'destructive' }); return; }
    setOverrides(prev => { const n = { ...prev }; if (isDefault) delete n[permission]; else n[permission] = enabled; return n; });
  };

  const resetPermissions = async () => {
    if (!selectedId) return;
    await (supabase.from('internal_user_permissions' as any) as any).delete().eq('internal_user_id', selectedId);
    setOverrides({});
    toast({ title: 'Permissões voltaram ao padrão do perfil' });
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(emptyForm); setSelectedId(null); setOverrides({}); setDialogOpen(true); };
  const openEdit = (user: any) => {
    setForm({
      name: user.name, email: user.email,
      access_profile: user.access_profile, active: user.active,
    });
    setSelectedId(user.id);
    setOverrides({});
    setDialogOpen(true);
    if (isAdmin) fetchPermissions(user.id);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (selectedId) {
      const { error } = await supabase.from('internal_users' as any).update(form as any).eq('id', selectedId);
      setSaving(false);
      if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Usuário atualizado!' });
      setDialogOpen(false);
      fetchUsers();
    } else {
      if (!form.email.trim()) {
        setSaving(false);
        toast({ title: 'Erro', description: 'Email é obrigatório para criar a conta de acesso.', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('create-internal-user', { body: form });
      setSaving(false);
      if (error || data?.error) {
        toast({ title: 'Erro ao criar', description: data?.error || error?.message || 'Falha ao criar usuário', variant: 'destructive' });
        return;
      }
      toast({ title: 'Usuário criado!', description: 'Conta de acesso gerada com sucesso.' });
      setDialogOpen(false);
      setCredentialsDialog({ open: true, email: data.email, password: data.tempPassword });
      fetchUsers();
    }
  };

  const copyCredentials = async () => {
    const text = `Email: ${credentialsDialog.email}\nSenha temporária: ${credentialsDialog.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const { error } = await supabase.from('internal_users' as any).delete().eq('id', selectedId);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Usuário excluído!' });
    setDeleteDialogOpen(false);
    setSelectedId(null);
    fetchUsers();
  };

  const updateField = (field: keyof UserForm, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Usuários Internos</h1>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil de Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
              ) : (
                filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.access_profile === 'admin' ? 'default' : 'secondary'}>
                        {ACCESS_PROFILE_LABELS[u.access_profile] || u.access_profile}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active ? 'default' : 'outline'} className={u.active ? 'bg-[hsl(var(--health-healthy))] text-white' : ''}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedId(u.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedId ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>Preencha os dados do usuário interno.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => updateField('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email {!selectedId && '*'}</Label>
              <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} disabled={!!selectedId} />
              {!selectedId && (
                <p className="text-xs text-muted-foreground">Uma senha temporária será gerada automaticamente para o primeiro acesso.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={form.access_profile} onValueChange={v => updateField('access_profile', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCESS_PROFILE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ACCESS_PROFILE_DESCRIPTIONS[form.access_profile]}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={v => updateField('active', v)} />
              <Label>Ativo</Label>
            </div>

            {isAdmin && selectedId && form.access_profile !== 'admin' && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Label className="text-sm font-semibold">Permissões</Label>
                    <p className="text-xs text-muted-foreground">Já vêm marcadas pelo perfil. Ajustes valem só para esta pessoa e são salvos na hora.</p>
                  </div>
                  {Object.keys(overrides).length > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetPermissions}>Voltar ao padrão</Button>}
                </div>
                {PERMISSION_GROUPS.map(g => (
                  <div key={g.module} className="space-y-1.5 border-t pt-2 first:border-t-0 first:pt-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.module}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {g.items.map(p => (
                        <div key={p.key} className="flex items-center justify-between gap-2">
                          <Label className="text-sm font-normal">
                            {p.label}
                            {p.key in overrides && <span className="ml-1 text-[10px] text-primary">(ajustado)</span>}
                          </Label>
                          <Switch checked={effective(p.key)} disabled={permSaving === p.key} onCheckedChange={v => togglePermission(p.key, v)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && selectedId && form.access_profile === 'admin' && (
              <p className="text-xs text-muted-foreground">Administrador tem todas as permissões.</p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : selectedId ? 'Salvar' : 'Criar e gerar senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialsDialog.open} onOpenChange={(o) => setCredentialsDialog(s => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Credenciais de acesso</DialogTitle>
            <DialogDescription>
              Compartilhe estes dados com o colaborador. Esta senha será exibida apenas <strong>uma vez</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">{credentialsDialog.email}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Senha temporária</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm tracking-wider">{credentialsDialog.password}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              Recomende ao colaborador trocar a senha no primeiro acesso, em "Esqueci minha senha".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyCredentials} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar credenciais'}
            </Button>
            <Button onClick={() => setCredentialsDialog(s => ({ ...s, open: false }))}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.</DialogDescription>
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
