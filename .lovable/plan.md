## Objetivo
Separar visualmente as tarefas de onboarding das tarefas de acompanhamento diário, evitando poluir a Central de Tarefas atual.

## Mudanças

### 1. Banco de dados
Adicionar à tabela `tasks`:
- `category` (text, default `'regular'`) — valores: `'regular'` | `'onboarding'`
- `onboarding_stage` (text, nullable) — etapa associada (ex: `etapa_1_nova`)

Backfill: marcar como `'onboarding'` todas as tarefas existentes cujo `title` começa com `[Onboarding]`.

### 2. Seed de tarefas de onboarding (`src/lib/onboarding.ts`)
Em `seedStage`, ao inserir em `tasks`, incluir:
- `category: 'onboarding'`
- `onboarding_stage: stage`

### 3. Central de Tarefas (`src/pages/TaskCenter.tsx`)
Adicionar **abas no topo** logo abaixo do título:
- **Tarefas do dia a dia** (default) — filtra `category = 'regular'`
- **Tarefas de Onboarding** — filtra `category = 'onboarding'`

Na aba Onboarding:
- Mantém o mesmo Kanban (Atrasadas / Hoje / Próximas / Concluídas)
- Adiciona filtro extra por **Cliente** e badge da etapa (`onboarding_stage`) em cada card
- Botão "Nova Tarefa" fica oculto (essas tarefas são criadas automaticamente pelo fluxo de onboarding)

Tarefas criadas manualmente pelo modal "Nova Tarefa" continuam como `regular`.

### 4. Painel lateral do Onboarding (`src/pages/Onboarding.tsx`)
Sem mudanças funcionais — já mostra checklist por etapa. Apenas garante que ao concluir um item lá, a tarefa correspondente em `tasks` (categoria onboarding) também é marcada como concluída (já existe via trigger/lógica atual).

## Arquivos afetados
- `supabase/migrations/<novo>.sql` (migration)
- `src/integrations/supabase/types.ts` (auto)
- `src/lib/onboarding.ts` (seed com category/stage)
- `src/pages/TaskCenter.tsx` (abas + filtro + badge de etapa)

## Fora do escopo
- Não criar página nova `/onboarding/tarefas` separada (abas dentro da Central já resolvem e mantêm UX consistente). Se preferir página dedicada, me avise.
