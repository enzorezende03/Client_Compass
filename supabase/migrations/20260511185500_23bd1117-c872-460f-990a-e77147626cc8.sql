-- 1) onboarding_type on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS onboarding_type TEXT
  CHECK (onboarding_type IN ('empresa_existente','empresa_nova','em_constituicao'))
  DEFAULT 'empresa_existente';

-- 2) onboarding_stage check constraint (recreate with new stages)
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_onboarding_stage_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_onboarding_stage_check CHECK (
  onboarding_stage IS NULL OR onboarding_stage IN (
    'etapa_1','etapa_2','etapa_3','etapa_4','concluido',
    'constituicao','etapa_1_nova','etapa_2_nova','etapa_3_nova'
  )
);

-- 3) Extend onboarding_checklist_items with new fields used by the seed
ALTER TABLE public.onboarding_checklist_items
  ADD COLUMN IF NOT EXISTS responsible_role TEXT NOT NULL DEFAULT 'cs',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sla_days INTEGER;

-- Make sla_hours optional so new-flow rows can rely on sla_days
ALTER TABLE public.onboarding_checklist_items ALTER COLUMN sla_hours DROP NOT NULL;

-- 4) Seed 24 new checklist items (idempotent: skip if stage already seeded)
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM public.onboarding_checklist_items WHERE stage = 'constituicao') THEN
  INSERT INTO public.onboarding_checklist_items (stage, order_index, responsible_role, title, description, sla_days, sla_hours) VALUES
  ('constituicao', 1, 'coordenador_geral', 'Cadastrar demanda no Gclick', 'Registrar abertura de empresa com CPF do socio principal', 1, 24),
  ('constituicao', 2, 'coordenador_geral', 'Confirmar documentos recebidos', 'Verificar lista de documentos necessarios para constituicao', 1, 24),
  ('constituicao', 3, 'cs', 'Enviar boas-vindas ao cliente', 'Mensagem de boas-vindas explicando o fluxo de constituicao', 1, 24),
  ('constituicao', 4, 'cs', 'Acompanhar andamento semanal', 'Verificar status no Gclick e atualizar cliente semanalmente', 7, 168),
  ('constituicao', 5, 'cs', 'Registrar recebimento de CNPJ', 'Quando Societario confirmar CNPJ, registrar no CS HUB', 1, 24),
  ('constituicao', 6, 'cs', 'Atualizar cadastro com CNPJ', 'Substituir CPF pelo CNPJ nos sistemas internos', 1, 24),
  ('constituicao', 7, 'cs', 'Converter para Fluxo B', 'Alterar onboarding_type para empresa_nova e iniciar Etapa 1', 1, 24),
  ('constituicao', 8, 'cs', 'Notificar equipe sobre conversao', 'Informar time que cliente recebeu CNPJ e entra no onboarding padrao nova empresa', 1, 24);
END IF;

IF NOT EXISTS (SELECT 1 FROM public.onboarding_checklist_items WHERE stage = 'etapa_1_nova') THEN
  INSERT INTO public.onboarding_checklist_items (stage, order_index, responsible_role, title, description, sla_days, sla_hours) VALUES
  ('etapa_1_nova', 1, 'coordenador_geral', 'Cadastro completo nos sistemas', 'Cadastrar empresa nova no Omie/G-Click com CNPJ definitivo', 2, 48),
  ('etapa_1_nova', 2, 'coordenador_geral', 'Gerar tarefas iniciais', 'Criar checklist de obrigacoes iniciais da empresa nova', 2, 48),
  ('etapa_1_nova', 3, 'cs', 'Enviar boas-vindas empresa nova', 'Mensagem de boas-vindas com informacoes da nova fase', 1, 24),
  ('etapa_1_nova', 4, 'cs', 'Agendar reuniao de onboarding', 'Marcar call de apresentacao dos servicos contratados', 3, 72);
END IF;

IF NOT EXISTS (SELECT 1 FROM public.onboarding_checklist_items WHERE stage = 'etapa_2_nova') THEN
  INSERT INTO public.onboarding_checklist_items (stage, order_index, responsible_role, title, description, sla_days, sla_hours) VALUES
  ('etapa_2_nova', 1, 'cs', 'Realizar reuniao de onboarding', 'Apresentar equipe, sistemas e fluxo de trabalho', 7, 168),
  ('etapa_2_nova', 2, 'cs', 'Enviar materiais de onboarding', 'Compartilhar guia do cliente e contatos da equipe', 7, 168),
  ('etapa_2_nova', 3, 'operacional', 'Configurar obrigacoes no sistema', 'Lancar todas as obrigacoes recorrentes no Gclick', 7, 168),
  ('etapa_2_nova', 4, 'cs', 'Confirmar dados bancarios', 'Validar conta bancaria para emissao de boletos', 5, 120);
END IF;

IF NOT EXISTS (SELECT 1 FROM public.onboarding_checklist_items WHERE stage = 'etapa_3_nova') THEN
  INSERT INTO public.onboarding_checklist_items (stage, order_index, responsible_role, title, description, sla_days, sla_hours) VALUES
  ('etapa_3_nova', 1, 'cs', 'Check-in 30 dias', 'Ligar/contatar cliente apos 30 dias para verificar adaptacao', 30, 720),
  ('etapa_3_nova', 2, 'cs', 'Verificar primeiras obrigacoes', 'Confirmar se primeiras guias/declaracoes foram processadas', 30, 720),
  ('etapa_3_nova', 3, 'cs', 'Resolver duvidas iniciais', 'Responder duvidas surgidas no primeiro mes de operacao', 30, 720),
  ('etapa_3_nova', 4, 'cs', 'Check-in 60 dias', 'Segundo contato de acompanhamento', 60, 1440),
  ('etapa_3_nova', 5, 'cs', 'Avaliar satisfacao', 'Enviar pesquisa NPS ou formulario de satisfacao', 60, 1440),
  ('etapa_3_nova', 6, 'operacional', 'Confirmar rotina estabelecida', 'Verificar se todas as obrigacoes estao no fluxo correto', 60, 1440),
  ('etapa_3_nova', 7, 'cs', 'Preencher formulario de repasse', 'Formalizar transicao do onboarding para relacionamento continuo', 60, 1440),
  ('etapa_3_nova', 8, 'cs', 'Marcar onboarding como concluido', 'Atualizar status para completed no CS HUB', 60, 1440);
END IF;
END $$;

-- 5) Index for type lookups
CREATE INDEX IF NOT EXISTS idx_clients_onboarding_type ON public.clients(onboarding_type);