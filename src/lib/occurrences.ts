import { supabase } from '@/integrations/supabase/client';
import type { InteractionType, ResponsibilityOrigin, Sector, Severity, DemandStatus } from '@/types/client';

export const TZ = 'America/Sao_Paulo';

export interface Occurrence {
  id: string;
  clientId: string;
  clientName: string;
  clientDocument: string;
  type: InteractionType;
  sector: Sector;
  origin: string;
  demandStatus: DemandStatus;
  description: string;
  responsible: string;
  responsibilityOrigin: ResponsibilityOrigin | null;
  severity: Severity | null;
  occurredAt: string;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
}

export interface OccurrenceTask { id: string; title: string; status: string; responsibleId: string | null }

export const CLASSIFICATION_REQUIRED: InteractionType[] = ['complaint', 'request', 'critical_issue'];

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  return `${date} às ${time}`;
}

export function mapOccurrence(r: any, users: Record<string, string>): Occurrence {
  return {
    id: r.id, clientId: r.client_id, clientName: r.clients?.name ?? '', clientDocument: r.clients?.document ?? '',
    type: r.type, sector: r.sector, origin: r.origin, demandStatus: r.demand_status, description: r.description,
    responsible: r.responsible, responsibilityOrigin: r.responsibility_origin ?? null, severity: r.severity ?? null,
    occurredAt: r.occurred_at || r.date, createdAt: r.created_at, createdBy: r.created_by ?? null,
    createdByName: r.created_by ? users[r.created_by] ?? null : null,
  };
}

let meCache: Promise<{ id: string; name: string } | null> | null = null;
export function getCurrentInternalUser() {
  if (!meCache) {
    meCache = (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase.from('internal_users').select('id, name').eq('auth_user_id', auth.user.id).maybeSingle();
      return (data as any) || null;
    })();
  }
  return meCache;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(';'), ...rows.map(r => headers.map(h => esc(r[h])).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
