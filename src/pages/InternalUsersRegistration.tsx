import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
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
import { SECTOR_LABELS } from '@/types/client';

const ACCESS_PROFILE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  cs: 'Customer Success',
  comercial: 'Comercial',
  diretoria: 'Diretoria',
};

interface UserForm {
  name: string;
  email: string;
  sector: string;
  role: string;
  access_profile: string;
  active: boolean;
}

const emptyForm: UserForm = {
  name: '', email: '', sector: 'fiscal', role: '', access_profile: 'cs', active: true,
};

export default function InternalUsersRegistration() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('internal_users' as any).select('*').order('name');
    if (!error && data) setUsers(data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(emptyForm); setSelectedId(null); setDialogOpen(true); };
  const openEdit = (user: any) => {
    setForm({
      name: user.name, email: user.email, sector: user.sector,
      role: user.role, access_profile: user.access_profile, active: user.active,
    });
    setSelectedId(user.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    if (selectedId) {
      const { error } = await supabase.from('internal_users' as any).update(form as any).eq('id', selectedId);
      if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Usuário atualizado!' });
    } else {
      const { error } = await supabase.from('internal_users' as any).insert(form as any);
      if (error) { toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Usuário criado!' });
    }
    setDialogOpen(false);
    fetchUsers();
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
                <TableHead>Setor</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Perfil de Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
              ) : (
                filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>{SECTOR_LABELS[u.sector as keyof typeof SECTOR_LABELS] || u.sector}</TableCell>
                    <TableCell>{u.role}</TableCell>
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
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={form.sector} onValueChange={v => updateField('sector', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SECTOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={form.role} onChange={e => updateField('role', e.target.value)} placeholder="Ex: Analista de CS" />
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={form.access_profile} onValueChange={v => updateField('access_profile', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCESS_PROFILE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={v => updateField('active', v)} />
              <Label>Ativo</Label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{selectedId ? 'Salvar' : 'Criar'}</Button>
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
