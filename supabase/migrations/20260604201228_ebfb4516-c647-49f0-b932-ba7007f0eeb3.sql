ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_onboarding_type_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_onboarding_type_check
  CHECK (onboarding_type = ANY (ARRAY['empresa_existente'::text, 'empresa_nova'::text, 'em_constituicao'::text, 'vmk_parceria'::text]));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_onboarding_stage_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_onboarding_stage_check
  CHECK ((onboarding_stage IS NULL) OR (onboarding_stage = ANY (ARRAY['etapa_1'::text, 'etapa_2'::text, 'etapa_3'::text, 'etapa_4'::text, 'concluido'::text, 'constituicao'::text, 'etapa_1_nova'::text, 'etapa_2_nova'::text, 'etapa_3_nova'::text, 'vmk_ativacao'::text])));