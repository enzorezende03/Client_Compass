-- ============================================================
-- PART 1: Auto-advance trigger for empresa_nova flow
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_advance_onboarding_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_stage TEXT;
  v_next TEXT;
  v_remaining INT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'concluido' THEN
    RETURN NEW;
  END IF;

  SELECT id, name, onboarding_stage, onboarding_type, onboarding_status
    INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client.id IS NULL THEN RETURN NEW; END IF;
  IF v_client.onboarding_type <> 'empresa_nova' THEN RETURN NEW; END IF;
  IF v_client.onboarding_status = 'concluido' THEN RETURN NEW; END IF;

  v_stage := v_client.onboarding_stage;

  -- Only auto-advance the new-company stages
  IF v_stage NOT IN ('etapa_1_nova','etapa_2_nova','etapa_3_nova') THEN
    RETURN NEW;
  END IF;

  -- Count remaining required items in current stage
  SELECT COUNT(*) INTO v_remaining
  FROM public.client_onboarding_progress p
  JOIN public.onboarding_checklist_items i ON i.id = p.checklist_item_id
  WHERE p.client_id = NEW.client_id
    AND i.stage = v_stage
    AND i.is_required = true
    AND p.status <> 'concluido';

  IF v_remaining > 0 THEN RETURN NEW; END IF;

  v_next := CASE v_stage
    WHEN 'etapa_1_nova' THEN 'etapa_2_nova'
    WHEN 'etapa_2_nova' THEN 'etapa_3_nova'
    WHEN 'etapa_3_nova' THEN 'concluido'
  END;

  IF v_next = 'concluido' THEN
    UPDATE public.clients
       SET onboarding_status = 'concluido',
           onboarding_stage = 'concluido',
           onboarding_completed_at = now()
     WHERE id = NEW.client_id;
  ELSE
    UPDATE public.clients
       SET onboarding_stage = v_next
     WHERE id = NEW.client_id;

    INSERT INTO public.client_onboarding_progress (client_id, checklist_item_id, status)
    SELECT NEW.client_id, i.id, 'pendente'
    FROM public.onboarding_checklist_items i
    WHERE i.stage = v_next
    ON CONFLICT (client_id, checklist_item_id) DO NOTHING;
  END IF;

  INSERT INTO public.timeline_entries
    (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, relevant_event_type)
  VALUES
    (NEW.client_id, 'service',
     '[Onboarding] Etapa ' || v_stage || ' concluída — avançou automaticamente para ' || v_next,
     'Sistema', 'commercial', 'internal',
     CASE WHEN v_next = 'concluido' THEN 'resolved' ELSE 'in_progress' END,
     true, 'onboarding');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_advance_onboarding ON public.client_onboarding_progress;
CREATE TRIGGER trg_auto_advance_onboarding
AFTER INSERT OR UPDATE OF status ON public.client_onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_onboarding_stage();

-- Ensure unique constraint exists for ON CONFLICT seeding
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_onboarding_progress_client_item_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.client_onboarding_progress
        ADD CONSTRAINT client_onboarding_progress_client_item_unique
        UNIQUE (client_id, checklist_item_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

-- ============================================================
-- PART 2: message_templates table + seed
-- ============================================================
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_type text NOT NULL,
  stage text NOT NULL,
  moment text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onboarding_type, stage, moment)
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users read message_templates" ON public.message_templates;
CREATE POLICY "Internal users read message_templates"
  ON public.message_templates FOR SELECT
  TO authenticated
  USING (is_internal_user());

-- Seed (idempotent via UNIQUE)
INSERT INTO public.message_templates (onboarding_type, stage, moment, title, content, variables) VALUES
('em_constituicao','constituicao','boas_vindas','Boas-vindas (Constituição)',
'Olá, [NOME_CLIENTE]! Seja bem-vindo(a) à 2M [SAUDE/CONTABILIDADE]!

Recebemos sua solicitação de abertura de empresa e já iniciamos o processo junto ao nosso time Societário. Enquanto sua empresa está sendo constituída, iremos te acompanhar de perto por aqui.

Qualquer dúvida, estou à disposição!

[NOME_CS]',
'["NOME_CLIENTE","SAUDE/CONTABILIDADE","NOME_CS"]'::jsonb),

('em_constituicao','constituicao','atualizacao_semanal','Atualização semanal',
'Olá, [NOME_CLIENTE]!

Passando para dar um update sobre sua constituição.

Status atual: [STATUS_CONSTITUICAO] — [DESCRICAO_STATUS]
Previsão estimada: [PRAZO_ESTIMADO]

Qualquer novidade importante, entro em contato imediatamente. Qualquer dúvida, estou aqui!',
'["NOME_CLIENTE","STATUS_CONSTITUICAO","DESCRICAO_STATUS","PRAZO_ESTIMADO"]'::jsonb),

('em_constituicao','constituicao','cnpj_recebido','CNPJ Recebido',
'Ótima notícia, [NOME_CLIENTE]!

Sua empresa acaba de receber o CNPJ!
CNPJ: [CNPJ_EMPRESA]

A partir de agora vamos iniciar oficialmente seu onboarding na 2M [SAUDE/CONTABILIDADE]. Em breve entro em contato para agendar nossa reunião de apresentação dos serviços.

Bem-vindo(a)!',
'["NOME_CLIENTE","CNPJ_EMPRESA","SAUDE/CONTABILIDADE"]'::jsonb),

('empresa_nova','etapa_1_nova','boas_vindas','Boas-vindas Empresa Nova',
'Olá, [NOME_CLIENTE]! Seja bem-vindo(a) à 2M [SAUDE/CONTABILIDADE]!

Estamos muito felizes em ter você conosco. Sua empresa já está cadastrada em nossos sistemas. Nos próximos dias vou entrar em contato para agendarmos nossa reunião de apresentação.

Qualquer dúvida, pode me chamar aqui!',
'["NOME_CLIENTE","SAUDE/CONTABILIDADE"]'::jsonb),

('empresa_nova','etapa_2_nova','confirmacao_reuniao','Confirmação de Reunião',
'Olá, [NOME_CLIENTE]! Tudo bem?

Gostaria de agendar nossa reunião de onboarding para apresentar a equipe e os serviços contratados.

Tenho disponibilidade em:
[DATA_OPCAO_1] às [HORA_1]
[DATA_OPCAO_2] às [HORA_2]
[DATA_OPCAO_3] às [HORA_3]

Qual horário fica melhor para você?',
'["NOME_CLIENTE","DATA_OPCAO_1","HORA_1","DATA_OPCAO_2","HORA_2","DATA_OPCAO_3","HORA_3"]'::jsonb),

('empresa_nova','etapa_3_nova','checkin_30d','Check-in 30 dias',
'Olá, [NOME_CLIENTE]!

Já faz um mês desde que você se tornou cliente 2M [SAUDE/CONTABILIDADE]!

Como tem sido sua experiência conosco até aqui? Tem alguma dúvida ou algo que podemos melhorar? Estou à disposição para o que precisar!',
'["NOME_CLIENTE","SAUDE/CONTABILIDADE"]'::jsonb),

('empresa_nova','etapa_3_nova','checkin_60d','Check-in 60 dias / Encerramento',
'Olá, [NOME_CLIENTE]! Como você está?

Estamos completando 2 meses juntos e quero garantir que tudo está correndo bem com sua empresa. Vou te enviar uma pesquisa rápida de satisfação — será de grande ajuda para continuarmos melhorando nossos serviços.

Obrigado pela confiança na 2M [SAUDE/CONTABILIDADE]!',
'["NOME_CLIENTE","SAUDE/CONTABILIDADE"]'::jsonb)
ON CONFLICT (onboarding_type, stage, moment) DO UPDATE
  SET content = EXCLUDED.content,
      title = EXCLUDED.title,
      variables = EXCLUDED.variables;