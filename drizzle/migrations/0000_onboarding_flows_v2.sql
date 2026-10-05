ALTER TABLE public.onboarding_checklist_items
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS applies_to_types text[],
  ADD COLUMN IF NOT EXISTS completion_rule text,
  ADD COLUMN IF NOT EXISTS report_month integer;
ALTER TABLE public.onboarding_checklist_items ADD CONSTRAINT onboarding_items_completion_rule_chk
  CHECK (completion_rule IS NULL OR completion_rule IN ('handoff_form','feedback_survey','monthly_report'));

ALTER TABLE public.onboarding_handoff_forms
  ADD COLUMN IF NOT EXISTS legal_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnpj text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS financial_contact text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS worker_risk_programs boolean,
  ADD COLUMN IF NOT EXISTS rented_hq text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profit_distribution_minutes boolean,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- existing forms were already treated as sent
UPDATE public.onboarding_handoff_forms SET sent_at = created_at WHERE sent_at IS NULL;

CREATE TABLE public.client_feedback_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  applied_by uuid REFERENCES public.internal_users(id),
  applied_at timestamptz NOT NULL DEFAULT now(),
  nps smallint NOT NULL CHECK (nps BETWEEN 0 AND 10),
  clarity smallint NOT NULL CHECK (clarity BETWEEN 1 AND 5),
  improvement_point text NOT NULL DEFAULT '',
  security text NOT NULL CHECK (security IN ('sim','parcialmente','nao')),
  suggestion text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_feedback_surveys TO authenticated;
GRANT ALL ON public.client_feedback_surveys TO service_role;
ALTER TABLE public.client_feedback_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal read surveys" ON public.client_feedback_surveys FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Writers insert surveys" ON public.client_feedback_surveys FOR INSERT TO authenticated WITH CHECK (public.can_write_clients());
CREATE POLICY "Writers update surveys" ON public.client_feedback_surveys FOR UPDATE TO authenticated USING (public.can_write_clients());

-- item applies to client type?
CREATE OR REPLACE FUNCTION public.onboarding_item_applies(p_item_id uuid, p_type text)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT active AND (applies_to_types IS NULL OR COALESCE(p_type,'empresa_existente') = ANY(applies_to_types))
    FROM onboarding_checklist_items WHERE id = p_item_id), false) $$;

CREATE OR REPLACE FUNCTION public.onboarding_stage_sequence(p_type text)
 RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE p_type
    WHEN 'empresa_nova'    THEN ARRAY['constituicao','etapa_1_nova','etapa_2_nova','etapa_3_nova','concluido']
    WHEN 'em_constituicao' THEN ARRAY['constituicao','etapa_1_nova','etapa_2_nova','etapa_3_nova','concluido']
    WHEN 'vmk_parceria'    THEN ARRAY['constituicao','etapa_1_nova','etapa_2_nova','etapa_3_nova','concluido']
    ELSE ARRAY['etapa_1','etapa_2','etapa_3','etapa_4','concluido']
  END; $$;

CREATE OR REPLACE FUNCTION public.onboarding_next_stage(p_stage text, p_type text)
 RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE seq text[]; idx int;
BEGIN
  IF p_stage = 'vmk_ativacao' THEN RETURN 'concluido'; END IF; -- legacy VMk stage
  seq := public.onboarding_stage_sequence(p_type);
  idx := array_position(seq, p_stage);
  IF idx IS NULL OR idx >= array_length(seq,1) THEN RETURN NULL; END IF;
  RETURN seq[idx+1];
END; $$;

CREATE OR REPLACE FUNCTION public.seed_onboarding_stage(p_client_id uuid, p_stage text, p_locked boolean DEFAULT false)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_type text;
BEGIN
  SELECT COALESCE(onboarding_type,'empresa_existente') INTO v_type FROM clients WHERE id = p_client_id;
  INSERT INTO public.client_onboarding_progress (client_id, checklist_item_id, status, locked, unlocked_at)
  SELECT p_client_id, i.id, 'pendente', p_locked, CASE WHEN p_locked THEN NULL ELSE now() END
  FROM public.onboarding_checklist_items i
  WHERE i.stage = p_stage AND i.active AND (i.applies_to_types IS NULL OR v_type = ANY(i.applies_to_types))
  ON CONFLICT (client_id, checklist_item_id) DO NOTHING;

  INSERT INTO public.tasks (client_id, title, description, responsible, due_date, internal_due_date,
     status, category, onboarding_stage, checklist_item_id, locked, unlocked_at)
  SELECT p_client_id, '[Onboarding] ' || i.title,
         'Item de onboarding (' || p_stage || ')' || COALESCE(' — ' || i.trigger_note, ''),
         'Sistema',
         (CURRENT_DATE + GREATEST(1, CEIL(COALESCE(i.sla_hours,48)/24.0))::int),
         (CURRENT_DATE + GREATEST(1, CEIL(COALESCE(i.sla_hours,48)/24.0))::int),
         'pending', 'onboarding', p_stage, i.id, p_locked, CASE WHEN p_locked THEN NULL ELSE now() END
  FROM public.onboarding_checklist_items i
  WHERE i.stage = p_stage AND i.active AND (i.applies_to_types IS NULL OR v_type = ANY(i.applies_to_types))
    AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.client_id = p_client_id AND t.checklist_item_id = i.id);
END; $$;

CREATE OR REPLACE FUNCTION public.advance_onboarding_on_progress()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client RECORD; v_stage text; v_type text; v_remaining int; v_next text;
BEGIN
  IF NEW.status <> 'concluido' THEN RETURN NEW; END IF;
  SELECT id, onboarding_stage, onboarding_type, onboarding_status INTO v_client FROM public.clients WHERE id = NEW.client_id;
  IF v_client.id IS NULL OR v_client.onboarding_status = 'completed' THEN RETURN NEW; END IF;
  v_stage := v_client.onboarding_stage;
  v_type  := COALESCE(v_client.onboarding_type, 'empresa_existente');
  IF v_stage IS NULL OR v_stage = 'concluido' OR v_stage = 'constituicao' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_checklist_items i WHERE i.id = NEW.checklist_item_id AND i.stage = v_stage) THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_remaining
  FROM public.client_onboarding_progress p
  JOIN public.onboarding_checklist_items i ON i.id = p.checklist_item_id
  WHERE p.client_id = NEW.client_id AND i.stage = v_stage
    AND i.is_required AND i.active AND (i.applies_to_types IS NULL OR v_type = ANY(i.applies_to_types))
    AND p.status <> 'concluido';
  IF v_remaining > 0 THEN RETURN NEW; END IF;

  v_next := public.onboarding_next_stage(v_stage, v_type);
  IF v_next IS NULL THEN RETURN NEW; END IF;
  IF v_next = 'concluido' THEN
    UPDATE public.clients SET onboarding_status = 'completed', onboarding_stage = 'concluido', onboarding_completed_at = now() WHERE id = NEW.client_id;
  ELSE
    UPDATE public.clients SET onboarding_stage = v_next WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END; $$;

-- Completion rules: item cannot be concluded without its form/survey/report
CREATE OR REPLACE FUNCTION public.enforce_onboarding_completion_rule()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rule text; v_month int; v_n int;
BEGIN
  IF NEW.status <> 'concluido' OR OLD.status = 'concluido' THEN RETURN NEW; END IF;
  SELECT completion_rule, report_month INTO v_rule, v_month FROM onboarding_checklist_items WHERE id = NEW.checklist_item_id;
  IF v_rule = 'handoff_form' AND NOT EXISTS (SELECT 1 FROM onboarding_handoff_forms WHERE client_id = NEW.client_id AND sent_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Envie o Formulário de Repasse antes de concluir este item';
  ELSIF v_rule = 'feedback_survey' AND NOT EXISTS (SELECT 1 FROM client_feedback_surveys WHERE client_id = NEW.client_id) THEN
    RAISE EXCEPTION 'Registre as respostas da pesquisa antes de concluir este item';
  ELSIF v_rule = 'monthly_report' THEN
    SELECT count(DISTINCT reference_month) INTO v_n FROM operational_monthly_reports WHERE client_id = NEW.client_id;
    IF v_n < COALESCE(v_month,1) THEN
      RAISE EXCEPTION 'Este item é concluído quando o relatório mensal do mês % for recebido', COALESCE(v_month,1);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_enforce_onboarding_completion_rule BEFORE UPDATE ON public.client_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.enforce_onboarding_completion_rule();

CREATE OR REPLACE FUNCTION public.complete_items_by_rule(p_client_id uuid, p_rule text, p_max_month int DEFAULT NULL)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE client_onboarding_progress p SET status = 'concluido', completed_at = now()
  FROM onboarding_checklist_items i
  WHERE i.id = p.checklist_item_id AND p.client_id = p_client_id AND i.completion_rule = p_rule
    AND p.status <> 'concluido' AND NOT p.locked
    AND (p_max_month IS NULL OR COALESCE(i.report_month,1) <= p_max_month) $$;

CREATE OR REPLACE FUNCTION public.on_handoff_form_sent()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_client text;
BEGIN
  IF NEW.sent_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.sent_at IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT name INTO v_name FROM internal_users WHERE auth_user_id = auth.uid() LIMIT 1;
  SELECT name INTO v_client FROM clients WHERE id = NEW.client_id;
  INSERT INTO timeline_entries (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, relevant_event_type)
  VALUES (NEW.client_id, 'service', '[Onboarding] Formulário de Repasse CS → Operacional enviado', COALESCE(v_name,'CS'), 'commercial', 'internal', 'resolved', true, 'onboarding');
  INSERT INTO notifications (user_id, title, message, type)
  SELECT u.id, 'Novo repasse de cliente', 'Formulário de Repasse de ' || COALESCE(v_client,'cliente') || ' enviado pelo CS.', 'onboarding'
  FROM internal_users u WHERE u.active AND (u.access_profile = 'operacional' OR u.sector ILIKE 'operac%');
  PERFORM public.complete_items_by_rule(NEW.client_id, 'handoff_form');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_handoff_form_sent AFTER INSERT OR UPDATE ON public.onboarding_handoff_forms
  FOR EACH ROW EXECUTE FUNCTION public.on_handoff_form_sent();

CREATE OR REPLACE FUNCTION public.on_feedback_survey()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cs text; v_client text;
BEGIN
  SELECT name, cs_responsible INTO v_client, v_cs FROM clients WHERE id = NEW.client_id;
  INSERT INTO timeline_entries (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, relevant_event_type)
  VALUES (NEW.client_id, 'service', '[Onboarding] Pesquisa de feedback — NPS ' || NEW.nps || ', clareza ' || NEW.clarity || '/5, segurança: ' || NEW.security,
          COALESCE(v_cs,'CS'), 'commercial', 'internal', 'resolved', NEW.nps <= 6 OR NEW.security = 'nao', 'onboarding');
  IF NEW.nps <= 6 OR NEW.security = 'nao' THEN
    INSERT INTO notifications (user_id, title, message, type)
    SELECT u.id, 'Alerta na pesquisa de feedback',
           COALESCE(v_client,'Cliente') || ': NPS ' || NEW.nps || CASE WHEN NEW.security = 'nao' THEN ' e não se sente seguro(a)' ELSE '' END || '. Avalie criar um plano de ação.', 'alert'
    FROM internal_users u WHERE u.active AND (u.name = v_cs OR u.access_profile = 'admin');
  END IF;
  PERFORM public.complete_items_by_rule(NEW.client_id, 'feedback_survey');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_feedback_survey AFTER INSERT ON public.client_feedback_surveys
  FOR EACH ROW EXECUTE FUNCTION public.on_feedback_survey();

CREATE OR REPLACE FUNCTION public.on_monthly_report_received()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n int;
BEGIN
  SELECT count(DISTINCT reference_month) INTO v_n FROM operational_monthly_reports WHERE client_id = NEW.client_id;
  PERFORM public.complete_items_by_rule(NEW.client_id, 'monthly_report', v_n);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_monthly_report_received AFTER INSERT ON public.operational_monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.on_monthly_report_received();

CREATE OR REPLACE FUNCTION public.onboarding_feedback_metrics(p_days int DEFAULT 90)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'count', count(*),
    'nps_avg', round(avg(nps)::numeric, 1),
    'nps_score', CASE WHEN count(*) = 0 THEN NULL ELSE round((count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6))::numeric * 100 / count(*)) END,
    'clarity_avg', round(avg(clarity)::numeric, 1))
  FROM client_feedback_surveys WHERE applied_at >= now() - make_interval(days => p_days) $$;