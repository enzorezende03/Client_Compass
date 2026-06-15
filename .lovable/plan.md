## Objetivo

Desbloqueio sequencial de etapas: cada etapa só fica ativa (e só conta SLA) quando a anterior é concluída. O CS pode forçar abertura antecipada com motivo registrado. O SLA passa a ser calculado a partir do **desbloqueio**, não da criação.

## Mapeamento (importante)

O sistema não tem a tabela `onboarding_tasks` do enunciado. As "tarefas de onboarding" são:

- **`client_onboarding_progress`** — um registro por item de checklist por cliente; é onde vive o SLA do onboarding. **Será a fonte canônica do bloqueio.**
- **`tasks`** (`category='onboarding'`, ligadas por `checklist_item_id`) — exibidas no Painel de Tarefas. Recebem espelho do estado de bloqueio via trigger.

Hoje as etapas já são semeadas conforme o cliente avança. Para mostrar "tarefas futuras bloqueadas" e permitir "forçar abertura", **todas as etapas passarão a ser criadas no início**, com a 1ª desbloqueada e as demais bloqueadas.

## Passo 1 — Banco de dados (migração)

Colunas em `client_onboarding_progress`:
- `unlocked_at timestamptz`
- `locked boolean not null default false` (default false para não afetar dados existentes; o seeding define `true` nas etapas futuras)
- `force_unlocked_by uuid references internal_users(id)` (o app usa `internal_users`, não `auth.users`)
- `force_unlock_reason text`
- `force_unlocked_at timestamptz`

Espelho em `tasks`: `locked boolean not null default false`, `unlocked_at timestamptz`, `force_unlocked_by uuid`, `force_unlock_reason text`.

Tabela de auditoria:
```sql
task_force_unlocks(
  id uuid pk, progress_id uuid -> client_onboarding_progress,
  task_id uuid -> tasks (null), client_id uuid -> clients,
  stage text, unlocked_by uuid -> internal_users, reason text not null,
  created_at timestamptz default now())
```
com GRANTs (`authenticated`, `service_role`), RLS e policy para usuários internos (`is_internal_user()`), igual às demais tabelas.

Triggers:
- Espelhar `locked`/`unlocked_at`/`force_*` de `client_onboarding_progress` → `tasks` (via `checklist_item_id`).
- Estender o auto‑avanço (Prompt 15): ao concluir todos os itens obrigatórios da etapa, **desbloquear** os itens da próxima etapa (`locked=false`, `unlocked_at=now()`) em vez de só mudar de coluna.

Backfill dos clientes em onboarding ativo: semear as etapas faltantes do tipo; etapas anteriores à atual = concluídas/desbloqueadas; etapa atual = desbloqueada (`unlocked_at=now()`); futuras = bloqueadas.

## Passo 2 — Criação: só a 1ª etapa desbloqueada

`startOnboarding` passa a semear **todas** as etapas do tipo de uma vez:
- 1ª etapa: `locked=false`, `unlocked_at=now()`.
- Demais: `locked=true`, `unlocked_at=null`.

`seed_onboarding_stage` ganha parâmetro de bloqueio. Continua idempotente.

## Passo 3 — Auto‑desbloqueio ao concluir etapa

Quando a última tarefa obrigatória da etapa é marcada como concluída (já integrado ao sync do Prompt 15), o trigger desbloqueia a próxima etapa. O frontend, ao receber o evento Realtime, exibe toast: `🔓 Etapa desbloqueada — SLA iniciado agora`.

## Passo 4 — Cálculo do SLA por `unlocked_at`

`src/lib/onboarding.ts` `slaTone`/`aggregateSlaTone` passam a usar `unlocked_at`:
- `locked=true` ou `unlocked_at=null` → sem SLA, não conta atraso, exibe "Aguardando etapa anterior".
- desbloqueada → `dias_corridos = now - unlocked_at`; atraso = `max(0, dias_corridos - sla)`.

Card do Kanban: progresso/SLA consideram só itens desbloqueados da etapa atual.

## Passo 5 — Painel de Tarefas: tarefas bloqueadas

`src/pages/TaskCenter.tsx`:
- Tarefa `locked` → ícone 🔒, texto esmaecido, sem checkbox/SLA, label "Aguardando conclusão da etapa anterior", botão discreto "Forçar abertura".
- Tarefa desbloqueada → comportamento normal; se `force_unlocked_by` → badge amarelo "Abertura forçada" com tooltip (nome do CS + motivo).

## Passo 6 — Modal "Forçar abertura antecipada"

Modal com texto explicativo + textarea obrigatório (mín. 10 caracteres). Ao confirmar:
1. Atualiza o registro (`locked=false`, `unlocked_at=now()`, `force_unlocked_by`, `force_unlock_reason`, `force_unlocked_at`) — via helper `forceUnlockTask` em `onboarding.ts`.
2. Insere em `task_force_unlocks`.
3. Fecha modal; Realtime recarrega os painéis.
4. Toast: `🔓 Etapa desbloqueada manualmente. Motivo registrado.`

Disponível tanto no Painel de Tarefas quanto no checklist do painel lateral do Onboarding (itens bloqueados ganham o botão).

## Passo 7 — Dashboard: separar SLA real do ruído

No cabeçalho do Painel de Tarefas, cards de indicadores:
- 🔴 Em atraso: desbloqueadas com `dias_corridos > sla`.
- 🟡 No prazo (ativo): desbloqueadas dentro do prazo.
- 🔒 Bloqueadas: `locked=true`.
- ✅ Concluídas: `status='completed'`.

Filtro "Mostrar apenas ativas" (padrão **ligado**, oculta bloqueadas) + toggle "Exibir tarefas futuras (bloqueadas)".

## Arquivos

- **Migração**: colunas de bloqueio, `task_force_unlocks` (+GRANT/RLS), triggers de espelho e de desbloqueio, backfill.
- **`src/lib/onboarding.ts`**: `seed_onboarding_stage`/`startOnboarding` (semear tudo), `slaTone` por `unlocked_at`, `forceUnlockTask`, tipos `ProgressRow`.
- **`src/pages/TaskCenter.tsx`**: render bloqueado, modal forçar abertura, cards de indicadores, filtro/toggle.
- **`src/pages/Onboarding.tsx`**: SLA por `unlocked_at`, item bloqueado no checklist + botão forçar abertura, toast de desbloqueio via Realtime.

## Riscos

- Mudança de "semear ao avançar" para "semear tudo no início" — mantida idempotência e backfill dos clientes ativos para não duplicar nem perder dados.
- Coluna `locked` em `tasks` usa default `false` para não afetar tarefas regulares (não‑onboarding).
