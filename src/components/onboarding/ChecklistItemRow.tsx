import { ReactNode, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, Copy, Download, FileText, Link2, Paperclip, Pencil, Plus, Trash2, Upload, Info, ListChecks, MessageCircle, BookOpen,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Markdown } from '@/components/procedure/ProcedureContent';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDocument } from '@/lib/document';

const db = supabase as any;
const TZ = 'America/Sao_Paulo';
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

export interface ItemDefinition {
  id: string;
  title: string;
  is_required: boolean;
  sla_hours: number;
  responsible_role?: string | null;
  role?: string | null;
  channel?: string | null;
  sla_value?: number | null;
  sla_unit?: string | null;
  trigger_note?: string | null;
  guidance_md?: string | null;
  execution_notes_md?: string | null;
  internal_standards_md?: string | null;
  links?: { label: string; url: string }[] | null;
  active?: boolean;
  completion_rule?: string | null;
}

export interface ChecklistProgress {
  id: string;
  client_id: string;
  status: string;
  completed_at: string | null;
  unlocked_at: string | null;
  locked: boolean;
  notes: string | null;
  notes_updated_by?: string | null;
  notes_updated_at?: string | null;
  item: ItemDefinition;
}

export interface ChecklistClient {
  name: string;
  document?: string | null;
  cs_responsible?: string | null;
  segment?: string | null;
}

interface Template { id: string; item_definition_id: string; title: string; channel: 'whatsapp' | 'email'; subject: string | null; body_md: string; sort_order: number }
interface Attachment { id: string; file_path: string; file_name: string; mime_type: string; size_bytes: number; uploaded_by: string | null; uploaded_at: string }

const SLA_UNIT_LABEL: Record<string, string> = { horas: 'h úteis', dias_uteis: 'dias úteis', dias_corridos: 'dias corridos' };
const CHANNEL_LABEL: Record<string, string> = { whatsapp: 'WhatsApp', email: 'E-mail', interno: 'Interno', cs_hub: 'CS HUB', videoconferencia: 'Videoconferência', orgao: 'Órgão' };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
function fmtSize(b: number) { return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }
function relative(ms: number) {
  const h = Math.abs(ms) / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)} dias`;
}

export function fillPlaceholders(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (full, k: string) => vars[k.toLowerCase()] || full);
}

function useUsersMap() {
  return useQuery({
    queryKey: ['internal-users-map'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('internal_users').select('id, name');
      return Object.fromEntries(((data as any[]) || []).map(u => [u.id, u.name])) as Record<string, string>;
    },
  });
}

export function ChecklistItemRow({
  p, client, open, onOpenChange, onToggle, canWrite, canEditContent, onDefinitionSaved, extra,
}: {
  p: ChecklistProgress;
  client: ChecklistClient;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onToggle: (checked: boolean) => void;
  canWrite: boolean;
  canEditContent: boolean;
  onDefinitionSaved: () => void;
  extra?: ReactNode;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users = {} } = useUsersMap();
  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState(p.notes ?? '');
  const [notesMeta, setNotesMeta] = useState({ by: p.notes_updated_by, at: p.notes_updated_at });
  const saveTimer = useRef<number>();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setNotes(p.notes ?? ''); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: dueAt } = useQuery({
    queryKey: ['onboarding-item-due', p.id, p.unlocked_at, p.item.sla_value, p.item.sla_unit, p.item.sla_hours],
    enabled: !p.locked && !!p.unlocked_at,
    queryFn: async () => {
      const { data } = await db.rpc('onboarding_item_due_at', { p_progress_id: p.id });
      return (data as string | null) ?? null;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['onboarding-item-templates', p.item.id],
    queryFn: async () => {
      const { data } = await db.from('onboarding_item_templates').select('*').eq('item_definition_id', p.item.id).order('sort_order');
      return (data as Template[]) || [];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['onboarding-item-attachments', p.id],
    queryFn: async () => {
      const { data } = await db.from('onboarding_item_attachments').select('*').eq('client_onboarding_item_id', p.id).order('uploaded_at', { ascending: false });
      return (data as Attachment[]) || [];
    },
  });

  const { data: contactName } = useQuery({
    queryKey: ['client-primary-contact', p.client_id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from('client_contacts').select('*').eq('client_id', p.client_id).limit(1);
      return ((data as any[])?.[0]?.name as string) || '';
    },
  });

  const done = p.status === 'concluido';
  const role = p.item.role || p.item.responsible_role || '';
  const links = Array.isArray(p.item.links) ? p.item.links.filter(l => l?.url) : [];
  const standardsAreMaterials = /^\s*(?:\*\*|#{1,3}\s*)?Materiais de apoio/i.test(p.item.internal_standards_md || '');
  const materials = standardsAreMaterials ? (p.item.internal_standards_md || '').replace(/^\s*(?:\*\*|#{1,3}\s*)?Materiais de apoio(?:\*\*)?\s*\n?/i, '') : '';

  let dueText = 'Aguardando etapa anterior';
  let dueTone = 'text-muted-foreground';
  if (done) { dueText = 'Concluído'; dueTone = 'text-health-healthy'; }
  else if (dueAt) {
    const diff = new Date(dueAt).getTime() - Date.now();
    dueText = diff >= 0 ? `vence em ${relative(diff)}` : `atrasado há ${relative(diff)}`;
    dueTone = diff >= 0 ? (diff < 8 * 36e5 ? 'text-health-attention' : 'text-muted-foreground') : 'text-destructive';
  }
  const statusLabel = done ? 'Concluído' : p.locked ? 'Bloqueado' : 'Em andamento';
  const overdue = !done && !p.locked && !!dueAt && new Date(dueAt).getTime() < Date.now();
  const badgeLabel = done || p.locked ? statusLabel : overdue ? 'Atrasado' : dueAt ? 'No prazo' : 'Em andamento';
  const slaLabel = p.item.sla_value && p.item.sla_unit ? `${p.item.sla_value} ${SLA_UNIT_LABEL[p.item.sla_unit]}` : `${p.item.sla_hours}h`;

  const vars: Record<string, string> = {
    cliente_nome: client.name || '',
    cnpj: client.document ? formatDocument(client.document) : '',
    contato_nome: contactName || '',
    responsavel_cs: client.cs_responsible || '',
    escritorio: /sa[uú]de|cl[íi]nic|m[ée]dic|odont|hospital/i.test(`${client.segment || ''} ${client.name}`) ? '2M Saúde' : '2M Contabilidade',
    prazo_estimado: dueAt ? new Date(dueAt).toLocaleDateString('pt-BR', { timeZone: TZ }) : '',
    mes_ano: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: TZ }),
  };

  const handleNotes = (value: string) => {
    setNotes(value);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const { data: me } = await db.rpc('current_internal_user_id');
      const at = new Date().toISOString();
      const { error } = await supabase.from('client_onboarding_progress')
        .update({ notes: value, notes_updated_by: me, notes_updated_at: at } as any).eq('id', p.id);
      if (error) toast({ title: 'Erro ao salvar observação', description: error.message, variant: 'destructive' });
      else setNotesMeta({ by: me, at });
    }, 800);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const f of list) {
      if (!ALLOWED[f.type]) { toast({ title: 'Formato não aceito', description: `${f.name}: envie apenas PDF, DOCX, JPG ou PNG.`, variant: 'destructive' }); return; }
      if (f.size > MAX_BYTES) { toast({ title: 'Arquivo muito grande', description: `${f.name} tem ${fmtSize(f.size)}. O limite é 20 MB.`, variant: 'destructive' }); return; }
    }
    setUploading(true);
    for (const f of list) {
      const path = `${p.client_id}/${p.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await supabase.storage.from('onboarding-anexos').upload(path, f, { contentType: f.type });
      if (up.error) { toast({ title: 'Erro no envio', description: up.error.message, variant: 'destructive' }); continue; }
      const { error } = await db.from('onboarding_item_attachments').insert({
        client_onboarding_item_id: p.id, file_path: path, file_name: f.name, mime_type: f.type, size_bytes: f.size,
      });
      if (error) {
        await supabase.storage.from('onboarding-anexos').remove([path]);
        toast({ title: 'Erro ao registrar anexo', description: error.message, variant: 'destructive' });
      }
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ['onboarding-item-attachments', p.id] });
  };

  const download = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from('onboarding-anexos').createSignedUrl(a.file_path, 60, { download: a.file_name });
    if (error || !data) { toast({ title: 'Erro ao baixar', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const removeAttachment = async (a: Attachment) => {
    const { error } = await db.from('onboarding_item_attachments').delete().eq('id', a.id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    await supabase.storage.from('onboarding-anexos').remove([a.file_path]);
    qc.invalidateQueries({ queryKey: ['onboarding-item-attachments', p.id] });
  };

  const copy = async (t: Template) => {
    const body = fillPlaceholders(t.body_md, vars);
    const text = t.channel === 'email' && t.subject ? `Assunto: ${fillPlaceholders(t.subject, vars)}\n\n${body}` : body;
    await navigator.clipboard.writeText(text);
    toast({ title: 'Mensagem copiada', description: t.title });
  };

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 px-3 py-3">
        <Checkbox checked={done} disabled={!canWrite || (!!p.item.completion_rule && !done)} title={p.item.completion_rule && !done ? 'Concluído automaticamente pelo formulário/pesquisa/relatório' : undefined} onCheckedChange={v => onToggle(!!v)} />
        <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto min-w-0 flex-1 items-start justify-start gap-2 whitespace-normal p-0 text-left hover:bg-transparent" aria-label={`${open ? 'Recolher' : 'Expandir'} ${p.item.title}`}>
          <div className="min-w-0 flex-1">
            <p className={cn('break-words text-sm font-semibold text-foreground', done && 'text-muted-foreground line-through')}>
              {p.item.title}{p.item.is_required && <span className="ml-0.5 text-destructive">*</span>}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <span>SLA: {p.item.trigger_note || slaLabel}</span>
              {role && <span className="border-l border-border pl-2">Responsável: {role}</span>}
              {p.item.channel && <span className="border-l border-border pl-2">Canal: {CHANNEL_LABEL[p.item.channel] || p.item.channel}</span>}
            </p>
          </div>
          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-muted-foreground">
            {attachments.length > 0 && <span className="flex items-center gap-0.5 text-[11px]"><Paperclip className="h-3.5 w-3.5" />{attachments.length}</span>}
            {p.item.active === false && <Badge variant="secondary" className="text-[10px]" title="Item retirado do fluxo. Mantido apenas como histórico; não trava a etapa.">Inativo</Badge>}
            <Badge variant="outline" title={dueText} className={cn('gap-1.5 whitespace-nowrap text-[10px]', done || (!p.locked && dueAt && !overdue) ? 'border-health-healthy/20 bg-health-healthy/10 text-health-healthy' : overdue ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{badgeLabel}</Badge>
            <span className="rounded-md bg-muted p-1.5"><ChevronDown className={cn('h-4 w-4 text-primary transition-transform', open && 'rotate-180')} /></span>
          </span>
        </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-2 px-3 pb-3">
        {p.item.guidance_md && <SupportSection title="Descrição" icon={<Info className="h-5 w-5" />}><Markdown>{fillPlaceholders(p.item.guidance_md, vars)}</Markdown></SupportSection>}
        {p.item.execution_notes_md && <SupportSection title="Passo a passo" icon={<ListChecks className="h-5 w-5" />}>
          <ReactMarkdown className="text-sm leading-relaxed [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:space-y-2" components={{
            ol: ({ children }) => <ol className="[counter-reset:step] [&>li]:relative [&>li]:min-h-6 [&>li]:pl-8 [&>li]:[counter-increment:step] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-0 [&>li]:before:flex [&>li]:before:h-6 [&>li]:before:w-6 [&>li]:before:items-center [&>li]:before:justify-center [&>li]:before:rounded-full [&>li]:before:bg-rework-client/70 [&>li]:before:text-primary-foreground [&>li]:before:text-xs [&>li]:before:content-[counter(step)]">{children}</ol>,
          }}>{fillPlaceholders(p.item.execution_notes_md, vars)}</ReactMarkdown>
        </SupportSection>}
        {(materials || links.length > 0) && <SupportSection title="Materiais de apoio" icon={<FileText className="h-5 w-5" />}>
          {materials && <ReactMarkdown className="text-sm [&_ul]:space-y-2 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:rounded-md [&_li]:border [&_li]:border-border [&_li]:bg-card [&_li]:px-3 [&_li]:py-2" components={{ li: ({ children }) => <li><FileText className="h-4 w-4 shrink-0 text-rework-client" /><span>{children}</span></li> }}>{fillPlaceholders(materials, vars)}</ReactMarkdown>}
          {links.length > 0 && <ul className="mt-2 space-y-2">{links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-primary hover:underline"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{l.label || l.url}</span><Link2 className="h-4 w-4 shrink-0" /></a></li>)}</ul>}
        </SupportSection>}
        {templates.length > 0 && (
          <SupportSection title="Modelo de mensagem" icon={<MessageCircle className="h-5 w-5" />}>
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="rounded-md border border-border bg-card p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{t.title} <span className="font-normal text-muted-foreground">· {t.channel === 'email' ? 'E-mail' : 'WhatsApp'}</span></span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-rework-client" title="Copiar mensagem" aria-label={`Copiar ${t.title}`} onClick={() => copy(t)}><Copy className="h-4 w-4" /></Button>
                  </div>
                  {t.channel === 'email' && t.subject && <p className="mb-1 text-xs"><strong>Assunto:</strong> {fillPlaceholders(t.subject, vars)}</p>}
                  <div className="text-xs"><Markdown>{fillPlaceholders(t.body_md, vars)}</Markdown></div>
                </div>
              ))}
            </div>
          </SupportSection>
        )}
        {p.item.internal_standards_md && !standardsAreMaterials && <SupportSection title="Padrões internos" icon={<BookOpen className="h-5 w-5" />}><Markdown>{p.item.internal_standards_md}</Markdown></SupportSection>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground"><span className={dueTone} title={dueAt ? fmtDate(dueAt) : undefined}>{dueText}{dueAt ? ` · ${fmtDate(dueAt)}` : ''}</span>{canEditContent && <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditOpen(true)}><Pencil className="h-3 w-3" />Editar conteúdo</Button>}</div>
        {extra && <Section title="Informações da tarefa e atualizações">{extra}</Section>}

        <Section title="Observações">
          <Textarea value={notes} onChange={e => handleNotes(e.target.value)} readOnly={!canWrite} placeholder="Observação livre — salva automaticamente" className="min-h-[60px] text-xs" />
          {notesMeta.at && <p className="mt-1 text-[10px] text-muted-foreground">Atualizado por {(notesMeta.by && users[notesMeta.by]) || 'usuário'} em {fmtDate(notesMeta.at)}</p>}
        </Section>

        <Section title={`Anexos (${attachments.length})`} defaultOpen={attachments.length > 0}>
          {canWrite && (
            <label
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
              className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground transition-colors', dragging && 'border-primary bg-primary/5')}
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Enviando...' : 'Arraste arquivos ou clique para escolher (PDF, DOCX, JPG, PNG · até 20 MB)'}
              <input type="file" multiple className="hidden" accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }} />
            </label>
          )}
          <ul className="mt-2 space-y-1">
            {attachments.map(a => (
              <li key={a.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtSize(a.size_bytes)} · {(a.uploaded_by && users[a.uploaded_by]) || 'usuário'} · {fmtDate(a.uploaded_at)}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => download(a)} title="Baixar"><Download className="h-3.5 w-3.5" /></Button>
                {canWrite && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeAttachment(a)} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
              </li>
            ))}
          </ul>
        </Section>
      </CollapsibleContent>

      {canEditContent && (
        <DefinitionEditor open={editOpen} onOpenChange={setEditOpen} item={p.item} templates={templates}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['onboarding-item-templates', p.item.id] }); onDefinitionSaved(); }} />
      )}
    </Collapsible>
  );
}

function SupportSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-md bg-muted/70 px-3 py-3"><div className="flex items-start gap-3"><span className="shrink-0 text-rework-client">{icon}</span><div className="min-w-0 flex-1"><h4 className="mb-2 text-sm font-semibold text-foreground">{title}</h4>{children}</div></div></section>;
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-background">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-2.5 py-2 text-xs font-semibold text-foreground">
        {title}<ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2.5 pb-2.5 text-sm">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function MdField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">{label}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[180px] font-mono text-xs" placeholder="Markdown" />
        <div className="min-h-[180px] overflow-auto rounded-md border bg-muted/30 p-2 text-sm">{value ? <Markdown>{value}</Markdown> : <p className="text-xs text-muted-foreground">Pré-visualização</p>}</div>
      </div>
    </div>
  );
}

function DefinitionEditor({ open, onOpenChange, item, templates, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; item: ItemDefinition; templates: Template[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ guidance_md: '', execution_notes_md: '', internal_standards_md: '', links: [] as { label: string; url: string }[] });
  const [tpls, setTpls] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      guidance_md: item.guidance_md || '', execution_notes_md: item.execution_notes_md || '',
      internal_standards_md: item.internal_standards_md || '', links: Array.isArray(item.links) ? item.links : [],
    });
    setTpls(templates.map(t => ({ ...t })));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    const links = form.links.filter(l => l.url.trim());
    const { error } = await db.from('onboarding_checklist_items').update({ ...form, links }).eq('id', item.id);
    if (error) { setSaving(false); toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    const keep = new Set(tpls.filter(t => !t.id.startsWith('new-')).map(t => t.id));
    const removed = templates.filter(t => !keep.has(t.id)).map(t => t.id);
    if (removed.length) await db.from('onboarding_item_templates').delete().in('id', removed);
    for (const [i, t] of tpls.entries()) {
      const row = { item_definition_id: item.id, title: t.title || 'Modelo', channel: t.channel, subject: t.channel === 'email' ? t.subject : null, body_md: t.body_md, sort_order: i };
      const res = t.id.startsWith('new-')
        ? await db.from('onboarding_item_templates').insert(row)
        : await db.from('onboarding_item_templates').update({ ...row, updated_at: new Date().toISOString() }).eq('id', t.id);
      if (res.error) { toast({ title: 'Erro ao salvar modelo', description: res.error.message, variant: 'destructive' }); }
    }
    setSaving(false);
    toast({ title: 'Conteúdo atualizado', description: 'Vale para todos os próximos onboardings.' });
    onOpenChange(false);
    onSaved();
  };

  const updTpl = (i: number, patch: Partial<Template>) => setTpls(prev => prev.map((t, j) => j === i ? { ...t, ...patch } : t));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conteúdo do item: {item.title}</DialogTitle>
          <DialogDescription className="font-medium text-health-attention">Esta alteração vale para todos os próximos onboardings.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="guidance">
          <TabsList className="flex-wrap">
            <TabsTrigger value="guidance">Orientações</TabsTrigger>
            <TabsTrigger value="exec">Informações importantes</TabsTrigger>
            <TabsTrigger value="tpl">Modelos de mensagem</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="std">Padrões internos</TabsTrigger>
          </TabsList>
          <TabsContent value="guidance"><MdField label="Orientações e procedimentos" value={form.guidance_md} onChange={v => setForm(f => ({ ...f, guidance_md: v }))} /></TabsContent>
          <TabsContent value="exec"><MdField label="Informações importantes para a execução" value={form.execution_notes_md} onChange={v => setForm(f => ({ ...f, execution_notes_md: v }))} /></TabsContent>
          <TabsContent value="std"><MdField label="Padrões internos" value={form.internal_standards_md} onChange={v => setForm(f => ({ ...f, internal_standards_md: v }))} /></TabsContent>
          <TabsContent value="links" className="space-y-2">
            {form.links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Nome" value={l.label} onChange={e => setForm(f => ({ ...f, links: f.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} />
                <Input placeholder="https://..." value={l.url} onChange={e => setForm(f => ({ ...f, links: f.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x) }))} />
                <Button size="icon" variant="ghost" onClick={() => setForm(f => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setForm(f => ({ ...f, links: [...f.links, { label: '', url: '' }] }))}><Plus className="h-3.5 w-3.5" /> Adicionar link</Button>
          </TabsContent>
          <TabsContent value="tpl" className="space-y-3">
            <p className="text-xs text-muted-foreground">Placeholders: {'{{cliente_nome}} {{cnpj}} {{contato_nome}} {{responsavel_cs}} {{escritorio}} {{prazo_estimado}} {{mes_ano}}'}</p>
            {tpls.map((t, i) => (
              <div key={t.id} className="space-y-2 rounded-md border p-3">
                <div className="flex gap-2">
                  <Input placeholder="Título do modelo" value={t.title} onChange={e => updTpl(i, { title: e.target.value })} />
                  <Select value={t.channel} onValueChange={v => updTpl(i, { channel: v as Template['channel'] })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">E-mail</SelectItem></SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => setTpls(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                {t.channel === 'email' && <Input placeholder="Assunto" value={t.subject || ''} onChange={e => updTpl(i, { subject: e.target.value })} />}
                <MdField label="Mensagem" value={t.body_md} onChange={v => updTpl(i, { body_md: v })} />
              </div>
            ))}
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setTpls(prev => [...prev, { id: `new-${crypto.randomUUID()}`, item_definition_id: item.id, title: '', channel: 'whatsapp', subject: null, body_md: '', sort_order: prev.length }])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar modelo
            </Button>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar conteúdo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
