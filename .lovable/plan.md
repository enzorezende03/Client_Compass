## Objetivo

Fazer o **Painel Onboarding (Kanban)** e o **Painel Tarefas** refletirem sempre o mesmo estado, em tempo real, sem recarregar a página.

## Diagnóstico (causa raiz)

Hoje existem **duas representações desconectadas** do mesmo dado:

- **Checklist** → tabela `client_onboarding_progress` (status `concluido`/`pendente`), marcada no painel lateral do Onboarding.
- **Tarefas** → tabela `tasks` (status `pending`/`completed`, `category='onboarding'`, `onboarding_stage`), exibidas no Painel Tarefas. São criadas a partir do checklist, mas **sem vínculo de volta**.

A coluna do Kanban já é derivada de `clients.onboarding_stage` (não há campo separado de posição) — então o Passo 1 já está essencialmente correto; só vamos garantir o vínculo `tasks ↔ checklist`.

O trigger atual `auto_advance_onboarding_stage` dispara em `tasks.status='concluido'` (valor que nunca ocorre — tasks usam `completed`) e só trata `empresa_nova`. Será substituído.

```text
ANTES                              DEPOIS
[Checklist] --x--> [Kanban]        [Checklist] <==> [tasks] (trigger DB)
[tasks]     --x--> [Kanban]               \           /
                                           v         v
                                      clients.onboarding_stage (fonte única)
                                           ^
                                     Realtime -> Kanban + Tarefas
```

## Passo 1 — Fonte de verdade única

- Confirmar/garantir que a coluna do Kanban deriva 100% de `clients.onboarding_stage`. Nenhum campo de posição separado será criado.
- Adicionar `checklist_item_id` (uuid, nullable) na tabela `tasks` para vincular cada tarefa de onboarding ao item de checklist correspondente. `seedStage` passa a gravar esse vínculo.

## Passo 2 — Vínculo bidirecional checklist ↔ tarefas (trigger DB)

Triggers `SECURITY DEFINER` no banco (funcionam para qualquer usuário e alimentam o Realtime):

- Ao marcar `tasks.status` → `completed`/`pending`: atualizar a `client_onboarding_progress` vinculada (`concluido`/`pendente`).
- Ao marcar `client_onboarding_progress.status` → `concluido`/`pendente`: atualizar a `task` vinculada.
- Guarda contra loop (só atualiza se o estado destino diferir).

## Passo 3 — Auto-avanço ao concluir a etapa

Novo trigger em `client_onboarding_progress` (AFTER UPDATE): quando **todos os itens obrigatórios da etapa atual** ficarem `concluido`:

1. Avança `clients.onboarding_stage` para a próxima etapa conforme o tipo:
   - `empresa_existente`: etapa_1 → etapa_2 → etapa_3 → etapa_4 → concluido
   - `empresa_nova`: constituicao → etapa_1_nova → etapa_2_nova → etapa_3_nova → concluido
   - `em_constituicao`: igual empresa_nova (constituicao aguarda CNPJ)
   - `vmk_parceria`: constituicao → vmk_ativacao → concluido
2. Faz `seed` dos itens/tarefas da próxima etapa.
3. Ao chegar em `concluido`: marca `onboarding_status='completed'`.
4. Registra `timeline_entries`.

O toast `"✅ Etapa N concluída — avançou para Etapa N+1"` é disparado no frontend ao receber o evento Realtime.

## Passo 4 — Sincronização ao mover card manualmente (Kanban)

Adicionar **drag-and-drop** (HTML5 nativo, mesmo padrão do TaskCenter) às colunas do Onboarding:

1. Soltar o card → `update clients.onboarding_stage` para o estágio da nova coluna.
2. Itens de etapas anteriores → marcados como `concluido` automaticamente (trigger).
3. Itens da nova etapa → criados se faltarem, status atual preservado (não reseta marcados).
4. Toast: `"Card movido para [Etapa]. Tarefas atualizadas."`

## Passo 5 — Realtime nos dois painéis

- `Onboarding.tsx`: canal assinando `clients` e `client_onboarding_progress` → re-`fetchAll()` + toast de avanço quando `onboarding_stage` muda.
- `TaskCenter.tsx`: canal assinando `tasks` (e `client_onboarding_progress`) → recarrega a lista.
- Migração: `ALTER PUBLICATION supabase_realtime ADD TABLE` para `clients`, `client_onboarding_progress`, `tasks` (com `REPLICA IDENTITY FULL`).
- Subscriptions dentro de `useEffect` com cleanup (sem vazamento).

## Passo 6 — Indicador de progresso no card

O card já mostra `Progress` + "X de Y itens". Ajustes:
- 100% → borda verde + ícone de check.
- 0% → barra cinza.
- Parcial → barra azul proporcional.

## Passo 7 — Consistência visual

- Reutilizar `STAGE_LABELS`, `STAGE_SHORT` e as cores/badges de `src/lib/onboarding.ts` nos dois painéis (TaskCenter passa a importar os mesmos rótulos).
- Ao abrir o painel lateral, destacar/scroll até a etapa atual.
- Cliente `completed` → todos os itens exibidos como concluídos e card na coluna "Concluído".

## Detalhes técnicos / arquivos

- **Migração (schema)**: coluna `tasks.checklist_item_id`; substituir `auto_advance_onboarding_stage`; novas funções/triggers de sync; `REPLICA IDENTITY FULL` + publication realtime.
- **`src/lib/onboarding.ts`**: `seedStage` grava `checklist_item_id`; helper `moveClientToStage(clientId, stage)` para o drag-and-drop.
- **`src/pages/Onboarding.tsx`**: drag-and-drop nas colunas, Realtime, estilo do card (passos 4/5/6).
- **`src/pages/TaskCenter.tsx`**: Realtime + rótulos unificados (passos 5/7).

## Riscos / observações

- Drag-and-drop no Onboarding é novo (hoje os cards só abrem o painel). Será adicionado sem remover o clique para abrir.
- Os triggers têm proteção contra loop de atualização recíproca entre `tasks` e `client_onboarding_progress`.
