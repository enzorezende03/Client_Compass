CREATE OR REPLACE VIEW public.onboarding_sla_status
WITH (security_invoker = true) AS
SELECT
  p.id                                   AS progress_id,
  p.client_id,
  c.name                                 AS client_name,
  COALESCE(c.onboarding_type, 'empresa_existente') AS onboarding_type,
  c.onboarding_status,
  c.onboarding_stage                     AS current_stage,
  c.cs_responsible,
  i.id                                   AS checklist_item_id,
  i.stage                                AS stage,
  i.order_index,
  i.title                                AS item_title,
  i.responsible_role                     AS responsible,
  i.is_required,
  p.locked,
  p.unlocked_at,
  (p.force_unlocked_by IS NOT NULL)      AS force_unlocked,
  CASE
    WHEN p.locked OR p.unlocked_at IS NULL THEN NULL
    ELSE p.unlocked_at + make_interval(hours => COALESCE(i.sla_hours, COALESCE(i.sla_days, 2) * 24))
  END                                    AS due_at,
  p.completed_at                         AS concluded_at,
  (
    p.completed_at IS NULL
    AND p.locked = false
    AND p.unlocked_at IS NOT NULL
    AND (p.unlocked_at + make_interval(hours => COALESCE(i.sla_hours, COALESCE(i.sla_days, 2) * 24))) < now()
  )                                      AS is_overdue,
  CASE
    WHEN p.completed_at IS NULL
     AND p.locked = false
     AND p.unlocked_at IS NOT NULL
     AND (p.unlocked_at + make_interval(hours => COALESCE(i.sla_hours, COALESCE(i.sla_days, 2) * 24))) < now()
    THEN GREATEST(
      0,
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date
        - ((p.unlocked_at + make_interval(hours => COALESCE(i.sla_hours, COALESCE(i.sla_days, 2) * 24))) AT TIME ZONE 'America/Sao_Paulo')::date)
    )
    ELSE 0
  END::int                               AS days_overdue
FROM public.client_onboarding_progress p
JOIN public.onboarding_checklist_items i ON i.id = p.checklist_item_id
JOIN public.clients c ON c.id = p.client_id;

GRANT SELECT ON public.onboarding_sla_status TO authenticated;
GRANT SELECT ON public.onboarding_sla_status TO service_role;