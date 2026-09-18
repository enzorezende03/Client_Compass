CREATE TABLE public.client_terminations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  request_date date NOT NULL,
  effective_date date,
  reason_category text NOT NULL CHECK (reason_category IN ('preco','atendimento','prazo_ou_erro_operacional','encerramento_da_empresa','mudanca_de_contador','vendeu_ou_incorporou','outro')),
  reason_detail text NOT NULL DEFAULT '',
  monthly_fee_at_termination numeric,
  during_onboarding boolean NOT NULL DEFAULT false,
  registered_by uuid REFERENCES public.internal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  reverted_by uuid REFERENCES public.internal_users(id),
  revert_reason text
);

GRANT SELECT, INSERT, UPDATE ON public.client_terminations TO authenticated;
GRANT ALL ON public.client_terminations TO service_role;

ALTER TABLE public.client_terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal read terminations" ON public.client_terminations
  FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "internal insert terminations" ON public.client_terminations
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_user());
CREATE POLICY "internal update terminations" ON public.client_terminations
  FOR UPDATE TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());

CREATE UNIQUE INDEX client_terminations_one_active
  ON public.client_terminations (client_id) WHERE reverted_at IS NULL;
CREATE INDEX client_terminations_request_date_idx ON public.client_terminations (request_date);

-- BEFORE INSERT: fill registered_by, during_onboarding and monthly fee
CREATE OR REPLACE FUNCTION public.set_termination_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.registered_by := (SELECT u.id FROM public.internal_users u WHERE u.auth_user_id = auth.uid() AND u.active = true LIMIT 1);
  NEW.reverted_at := NULL; NEW.reverted_by := NULL; NEW.revert_reason := NULL;
  NEW.during_onboarding := EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.onboarding_status = 'active'
  );
  IF NEW.monthly_fee_at_termination IS NULL THEN
    SELECT h.monthly_value INTO NEW.monthly_fee_at_termination
    FROM public.commercial_handoff h WHERE h.client_id = NEW.client_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_termination_defaults() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_set_termination_defaults
BEFORE INSERT ON public.client_terminations
FOR EACH ROW EXECUTE FUNCTION public.set_termination_defaults();

-- AFTER INSERT: cancel client, timeline, audit
CREATE OR REPLACE FUNCTION public.apply_termination()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old text; v_name text; v_reason text;
BEGIN
  SELECT c.status INTO v_old FROM public.clients c WHERE c.id = NEW.client_id;
  SELECT u.name INTO v_name FROM public.internal_users u WHERE u.id = NEW.registered_by;
  v_reason := NEW.reason_category || CASE WHEN COALESCE(NEW.reason_detail,'') <> '' THEN ' — ' || NEW.reason_detail ELSE '' END;

  UPDATE public.clients SET status = 'cancelled' WHERE id = NEW.client_id;

  INSERT INTO public.timeline_entries
    (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, relevant_event_type)
  VALUES (NEW.client_id, 'service', 'Pedido de distrato registrado — ' || v_reason,
          COALESCE(v_name,'Sistema'), 'commercial', 'internal', 'resolved', true, 'churn');

  INSERT INTO public.audit_logs (client_id, field_name, old_value, new_value, changed_by)
  VALUES (NEW.client_id, 'status', COALESCE(v_old,''), 'cancelled', COALESCE(v_name,'Sistema'));

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_termination() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_apply_termination
AFTER INSERT ON public.client_terminations
FOR EACH ROW EXECUTE FUNCTION public.apply_termination();

-- Revert
CREATE OR REPLACE FUNCTION public.revert_termination(p_termination_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_name text; v_row public.client_terminations; v_old text;
BEGIN
  IF NOT public.is_internal_user() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'Justificativa da reversão é obrigatória'; END IF;

  SELECT * INTO v_row FROM public.client_terminations WHERE id = p_termination_id AND reverted_at IS NULL;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Distrato não encontrado ou já revertido'; END IF;

  SELECT u.id, u.name INTO v_user, v_name FROM public.internal_users u
   WHERE u.auth_user_id = auth.uid() AND u.active = true LIMIT 1;

  UPDATE public.client_terminations
     SET reverted_at = now(), reverted_by = v_user, revert_reason = p_reason
   WHERE id = p_termination_id;

  SELECT c.status INTO v_old FROM public.clients c WHERE c.id = v_row.client_id;
  UPDATE public.clients SET status = 'recovery' WHERE id = v_row.client_id;

  INSERT INTO public.timeline_entries
    (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, relevant_event_type)
  VALUES (v_row.client_id, 'service', 'Distrato revertido — ' || p_reason,
          COALESCE(v_name,'Sistema'), 'commercial', 'internal', 'resolved', true, 'retention');

  INSERT INTO public.audit_logs (client_id, field_name, old_value, new_value, changed_by)
  VALUES (v_row.client_id, 'status', COALESCE(v_old,''), 'recovery', COALESCE(v_name,'Sistema'));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revert_termination(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_termination(uuid, text) TO authenticated;

-- Churn metrics
CREATE OR REPLACE FUNCTION public.churn_metrics(p_start date, p_end date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH ativos_inicio AS (
    SELECT c.id FROM public.clients c
    WHERE c.contract_start_date <= p_start
      AND (c.archived = false OR c.archived_at IS NULL OR c.archived_at >= p_start)
      AND NOT EXISTS (
        SELECT 1 FROM public.client_terminations t
        WHERE t.client_id = c.id AND t.reverted_at IS NULL AND t.request_date < p_start
      )
  ),
  periodo AS (
    SELECT t.* FROM public.client_terminations t
    WHERE t.request_date BETWEEN p_start AND p_end
  ),
  vigentes AS (SELECT * FROM periodo WHERE reverted_at IS NULL)
  SELECT jsonb_build_object(
    'clientes_ativos_inicio', (SELECT count(*) FROM ativos_inicio),
    'distratos_periodo', (SELECT count(*) FROM vigentes),
    'taxa_churn', CASE WHEN (SELECT count(*) FROM ativos_inicio) = 0 THEN 0
      ELSE round((SELECT count(*) FROM vigentes)::numeric * 100 / (SELECT count(*) FROM ativos_inicio), 2) END,
    'receita_mensal_perdida', COALESCE((SELECT sum(COALESCE(monthly_fee_at_termination,0)) FROM vigentes), 0),
    'distratos_durante_onboarding', (SELECT count(*) FROM vigentes WHERE during_onboarding),
    'distratos_revertidos', (SELECT count(*) FROM periodo WHERE reverted_at IS NOT NULL)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.churn_metrics(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.churn_metrics(date, date) TO authenticated;