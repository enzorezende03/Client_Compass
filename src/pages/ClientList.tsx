import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Users, AlertTriangle, TrendingUp, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { HealthScoreBadge } from '@/components/HealthScoreBadge';
import { FinancialStatusBadge } from '@/components/StatusBadges';
import { Client, STATUS_LABELS, COMPLEXITY_LABELS, COMPLEXITY_EMOJIS, HEALTH_LABELS, PROFILE_LABELS, PROFILE_ICONS, ClientStatus, ComplexityLevel, HealthScore } from '@/types/client';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function mapRow(r: any): Client {
  return {
    id: r.id,
    name: r.name,
    document: r.document,
    segment: r.segment,
    contractStartDate: r.contract_start_date,
    csResponsible: r.cs_responsible,
    complexity: r.complexity as any,
    status: r.status as any,
    profile: r.profile as any,
    financialStatus: r.financial_status as any,
    healthScore: r.health_score as any,
    painPoints: r.pain_points,
    expectations: r.expectations,
    attentionPoints: r.attention_points,
    recurringIssues: r.recurring_issues,
    behavioralProfile: r.behavioral_profile,
    strategicNotes: r.strategic_notes,
    riskReason: r.risk_reason ?? undefined,
    riskType: r.risk_type ?? undefined,
    riskIdentifiedDate: r.risk_identified_date ?? undefined,
    actionPlan: r.action_plan ?? undefined,
    taxation: r.taxation ?? undefined,
  };
}

export default function ClientList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');

  const loadClients = useCallback(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      setClients((data || []).map(mapRow));
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const responsibles = [...new Set(clients.map(c => c.csResponsible).filter(Boolean))];

  const filtered = clients.filter(c => {
    const matchSearch = search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document.includes(search);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchComplexity = complexityFilter === 'all' || c.complexity === complexityFilter;
    const matchHealth = healthFilter === 'all' || c.healthScore === healthFilter;
    const matchResp = responsibleFilter === 'all' || c.csResponsible === responsibleFilter;
    return matchSearch && matchStatus && matchComplexity && matchHealth && matchResp;
  });

  const stats = {
    total: clients.length,
    atRisk: clients.filter(c => c.status === 'at_risk' || c.status === 'recovery').length,
    critical: clients.filter(c => c.healthScore === 'critical').length,
    healthy: clients.filter(c => c.healthScore === 'healthy').length,
  };

  return (
    <AppLayout>
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">CS HUB</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestão estratégica da carteira de clientes</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="Total de Clientes" value={stats.total} />
            <StatCard icon={AlertTriangle} label="Em Risco / Recuperação" value={stats.atRisk} variant="warning" />
            <StatCard icon={TrendingUp} label="Health Crítico" value={stats.critical} variant="danger" />
            <StatCard icon={Users} label="Saudáveis" value={stats.healthy} variant="success" />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF/CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Complexidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Health Score" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(HEALTH_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Client cards */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/client/${client.id}`)}
                className="group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card cursor-pointer transition-all hover:shadow-card-hover hover:border-primary/20"
              >
                <div
                  className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0 leading-none"
                  title={`Complexidade ${COMPLEXITY_LABELS[client.complexity]}`}
                >
                  <span className="text-base" aria-hidden>{COMPLEXITY_EMOJIS[client.complexity]}</span>
                  <span className="mt-0.5">{client.complexity}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title={`Tier ${PROFILE_LABELS[client.profile]}`}
                    >
                      <span aria-hidden>{PROFILE_ICONS[client.profile]}</span>
                      <span className="hidden sm:inline">{PROFILE_LABELS[client.profile]}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{client.document}</span>
                    <span>•</span>
                    <span>{client.segment}</span>
                    <span>•</span>
                    <span>CS: {client.csResponsible}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <HealthScoreBadge score={client.healthScore} />
                  <FinancialStatusBadge status={client.financialStatus} />
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum cliente encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, variant }: {
  icon: typeof Building2; label: string; value: number; variant?: 'warning' | 'danger' | 'success';
}) {
  const colors = {
    warning: 'text-health-attention',
    danger: 'text-health-critical',
    success: 'text-health-healthy',
  };
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${variant ? colors[variant] : 'text-muted-foreground'}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${variant ? colors[variant] : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
