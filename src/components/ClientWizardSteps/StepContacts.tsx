import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Users, Star, Mail, Phone, User as UserIcon, Briefcase, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface ContactDraft {
  id?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary?: boolean;
  isWhatsapp?: boolean;
}

interface Props {
  contacts: ContactDraft[];
  setContacts: (next: ContactDraft[]) => void;
}

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}`, a?.length === 2 ? ') ' : '', b, c && `-${c}`].filter(Boolean).join(''));
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
};

export function StepContacts({ contacts, setContacts }: Props) {
  const add = () => {
    setContacts([
      ...contacts,
      { name: '', role: '', phone: '', email: '', isPrimary: contacts.length === 0, isWhatsapp: true },
    ]);
  };

  const update = (idx: number, field: keyof ContactDraft, value: string | boolean) => {
    const next = contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c));
    setContacts(next);
  };

  const setPrimary = (idx: number) => {
    setContacts(contacts.map((c, i) => ({ ...c, isPrimary: i === idx })));
  };

  const remove = (idx: number) => {
    const next = contacts.filter((_, i) => i !== idx);
    if (next.length > 0 && !next.some(c => c.isPrimary)) next[0].isPrimary = true;
    setContacts(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Contatos do Cliente
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Cadastre quantos contatos forem necessários. Marque um como principal.
          </p>
        </div>
        <Button onClick={add} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar contato
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center bg-muted/20">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Nenhum contato cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Adicione pessoas-chave da empresa para facilitar o relacionamento.
          </p>
          <Button onClick={add} variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar primeiro contato
          </Button>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {contacts.map((c, idx) => (
            <motion.div
              key={c.id ?? `new-${idx}`}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-lg border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPrimary(idx)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors ${
                    c.isPrimary
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Star className={`h-3 w-3 ${c.isPrimary ? 'fill-amber-500 text-amber-500' : ''}`} />
                  {c.isPrimary ? 'Contato principal' : 'Marcar como principal'}
                </button>
                <Button variant="ghost" size="icon" onClick={() => remove(idx)} className="h-8 w-8">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><UserIcon className="h-3 w-3" /> Nome</Label>
                  <Input value={c.name} onChange={e => update(idx, 'name', e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Briefcase className="h-3 w-3" /> Cargo</Label>
                  <Input value={c.role} onChange={e => update(idx, 'role', e.target.value)} placeholder="Ex: Diretor financeiro" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3" /> Telefone</Label>
                  <Input value={c.phone} onChange={e => update(idx, 'phone', formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3" /> E-mail</Label>
                  <Input type="email" value={c.email} onChange={e => update(idx, 'email', e.target.value)} placeholder="contato@empresa.com" />
                </div>
                <div className="md:col-span-2 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <Label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Este telefone tem WhatsApp
                  </Label>
                  <Switch
                    checked={c.isWhatsapp ?? true}
                    onCheckedChange={(v) => update(idx, 'isWhatsapp', v)}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
