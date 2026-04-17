

## Cadastro de Clientes — Versão Interativa e Completa

Vou transformar o modal atual de cadastro em uma experiência **muito mais dinâmica e visual**, mantendo o foco no que você pediu: **modal de cadastro**, **contatos múltiplos** e **barra de progresso de completude**.

### 1. Wizard em etapas (multi-step) com navegação interativa

O modal será dividido em 4 etapas visuais com indicador no topo (steps clicáveis):

```text
[1 Identificação] → [2 Contatos] → [3 Visão Estratégica] → [4 Risco & Plano]
   ●─────────────●─────────────○─────────────○
   ████████████░░░░░░░░░░░░░░░░░░░░  62% completo
```

- Header com **progress bar animada** mostrando % de campos preenchidos em tempo real
- Steps clicáveis (pode ir e voltar livremente)
- Validação leve por etapa (campos obrigatórios destacados)
- Animações suaves entre etapas (framer-motion já está no projeto)
- Botões **Anterior / Próximo / Salvar**

### 2. Etapa 1 — Identificação (interativa)

- CNPJ com auto-preenchimento via BrasilAPI (já existe) + **feedback visual mais claro** (ícone ✓ verde quando preenchido)
- Campos agrupados em cards visuais por contexto
- Selects com **ícones e cores** (ex: Health Score 🟢🟡🔴, Tier com emoji, Status com badge colorido)
- Tooltip explicativo em cada select estratégico (Complexidade, Perfil, Health Score)

### 3. Etapa 2 — Contatos múltiplos (NOVO)

Lista dinâmica de contatos do cliente, salvos na tabela `client_contacts` (já existe):

- Botão **"+ Adicionar contato"** que adiciona uma linha animada
- Cada contato: Nome, Cargo, Telefone (com máscara), E-mail, marcador "Principal"
- Botão de remover por contato
- Empty state amigável quando não há contatos
- Salvos junto com o cliente (sincroniza inserções/edições/remoções)

### 4. Etapa 3 — Visão Estratégica

Os 6 campos atuais (Dores, Expectativas, Atenção, Recorrentes, Comportamental, Notas) reorganizados em **cards com ícones e placeholders ricos** (ex: "Ex: cliente sensível a prazos, prefere contato por WhatsApp...").

Contador de caracteres e cor do card mudando conforme preenchimento.

### 5. Etapa 4 — Risco & Plano

Mantém os campos atuais (Motivo, Tipo, Data, Plano de Ação) mas com layout condicional: só expande se houver risco selecionado.

### 6. Indicador de completude

- **Barra de progresso no header do wizard** (% calculado em tempo real sobre todos os campos relevantes)
- **Badge "Cadastro X% completo"** na linha do cliente na tabela principal (`/cadastro/clientes`), com cores: <60% âmbar, 60–89% azul, 90%+ verde
- Cálculo: razão entre campos preenchidos / total de campos considerados estratégicos (excluindo opcionais como risco)

### 7. Mudanças técnicas

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientRegistration.tsx` | Refatoração do modal: extrair para `ClientWizardDialog` |
| `src/components/ClientWizardDialog.tsx` | **Novo** — wizard com 4 steps, progress bar, navegação |
| `src/components/ClientWizardSteps/StepIdentification.tsx` | **Novo** — etapa 1 |
| `src/components/ClientWizardSteps/StepContacts.tsx` | **Novo** — etapa 2 (CRUD de contatos) |
| `src/components/ClientWizardSteps/StepStrategic.tsx` | **Novo** — etapa 3 |
| `src/components/ClientWizardSteps/StepRisk.tsx` | **Novo** — etapa 4 |
| `src/lib/clientCompleteness.ts` | **Novo** — função utilitária para calcular % completude |
| `src/pages/ClientRegistration.tsx` | Adicionar coluna "Completude" na tabela com badge |

Sem mudanças no banco — `client_contacts` já existe com a estrutura necessária.

### 8. Resultado esperado

O time de CS abrirá o modal e verá uma experiência guiada, com feedback visual a cada interação, podendo cadastrar quantos contatos forem necessários e enxergando claramente o quanto falta para o cadastro estar completo — tanto no momento do cadastro quanto na lista geral.

