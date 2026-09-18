# Documento PDF — Funcionalidades do CS HUB

Gerar um PDF completo descrevendo tudo o que o sistema faz hoje, para uso interno/apresentação.

## Conteúdo do documento

1. **Capa e visão geral** — nome, propósito (gestão de Customer Success contábil), data de geração.
2. **Acesso e segurança** — login restrito a usuários internos, redefinição de senha, sem cadastro público, controle de permissões.
3. **Clientes**
   - Painel/dashboard de clientes com filtros e indicadores
   - Cadastro em etapas (identificação, contatos, ficha de repasse comercial, visão estratégica)
   - Preenchimento automático por CNPJ
   - Ficha do cliente: visão estratégica editável, histórico de interações (timeline), risco e plano de ação, aba Repasse, histórico de alterações
   - Indicadores: Health Score, status financeiro, perfil, complexidade, regime tributário
4. **Onboarding**
   - Quadro Kanban por etapa e por tipo (Empresa Existente, Empresa Nova, Em Constituição, Parceria VMk)
   - Checklists por etapa com SLA, avanço automático e manual
   - Desbloqueio sequencial de etapas e abertura forçada com justificativa
   - Conversão de constituição para empresa nova (CNPJ)
   - Modelos de mensagem/e-mail com dados do cliente preenchidos
   - Formulário de repasse e relatório mensal operacional
   - Cancelamento/exclusão de onboarding
5. **Central de Tarefas**
   - Kanban (atrasadas, hoje, próximos), abas separadas para dia a dia e onboarding
   - Remanejamento com justificativa e histórico de remanejamentos
   - Indicadores de SLA (em atraso, no prazo, bloqueadas, concluídas)
6. **Integrações**
   - Omie G-Click: sincronização de clientes e tarefas, com pré-visualização
   - Digisac: importação de reclamações/atendimentos
7. **Notificações e alertas** — sino de notificações em tempo real, alerta de tarefas urgentes, lembretes automáticos
8. **Equipe interna** — cadastro de usuários internos e vínculo de acesso
9. **Registro e auditoria** — histórico de mudanças estratégicas

## Como será feito

- Levantamento das funcionalidades lendo as telas e funções existentes (sem inventar recursos).
- Geração do PDF com ReportLab, identidade visual do sistema (azul-marinho + tons quentes) e fonte com acentuação correta em português.
- Revisão página a página em imagem antes de entregar (texto cortado, sobreposição, espaçamento).
- Entrega do arquivo em Arquivos, pronto para download.

Nenhuma alteração no sistema será feita — é apenas um documento.
