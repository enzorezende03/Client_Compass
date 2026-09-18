CREATE OR REPLACE FUNCTION public.dashboard_health_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT c.id, c.health_score, c.financial_status, c.status
    FROM public.clients c
    WHERE c.archived = false AND c.status <> 'cancelled'
  ),
  treatment AS (
    SELECT b.id
    FROM base b
    WHERE b.status = 'recovery'
       OR EXISTS (
         SELECT 1 FROM public.action_plans ap
         WHERE ap.client_id = b.id
           AND ap.status NOT IN ('completed','cancelled')
       )
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM base),
    'healthy', (SELECT count(*) FROM base WHERE health_score = 'healthy'),
    'attention', (SELECT count(*) FROM base WHERE health_score = 'attention'),
    'critical', (SELECT count(*) FROM base WHERE health_score = 'critical'),
    'unclassified', (SELECT count(*) FROM base WHERE health_score IS NULL OR health_score NOT IN ('healthy','attention','critical')),
    'suspended', (SELECT count(*) FROM base WHERE financial_status = 'suspended'),
    'treatment', (SELECT count(*) FROM treatment),
    'treatment_ids', COALESCE((SELECT jsonb_agg(id) FROM treatment), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_health_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_health_counts() TO authenticated;