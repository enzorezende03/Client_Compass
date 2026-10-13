ALTER TABLE public.client_terminations DROP CONSTRAINT client_terminations_initiated_by_check;
ALTER TABLE public.client_terminations ADD CONSTRAINT client_terminations_initiated_by_check CHECK (initiated_by IN ('cliente','escritorio','baixa'));

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
  vigentes AS (SELECT * FROM periodo WHERE reverted_at IS NULL AND initiated_by = 'cliente')
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