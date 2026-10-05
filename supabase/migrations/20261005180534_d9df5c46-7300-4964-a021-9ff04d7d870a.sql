ALTER TABLE public.onboarding_checklist_items
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS channel text CHECK (channel IN ('whatsapp','email','interno','cs_hub','videoconferencia','orgao')),
  ADD COLUMN IF NOT EXISTS sla_value numeric,
  ADD COLUMN IF NOT EXISTS sla_unit text CHECK (sla_unit IN ('horas','dias_uteis','dias_corridos')),
  ADD COLUMN IF NOT EXISTS trigger_type text CHECK (trigger_type IN ('inicio_etapa','item_anterior','evento','dia_fixo_mes')),
  ADD COLUMN IF NOT EXISTS trigger_note text,
  ADD COLUMN IF NOT EXISTS guidance_md text,
  ADD COLUMN IF NOT EXISTS execution_notes_md text,
  ADD COLUMN IF NOT EXISTS internal_standards_md text,
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.client_onboarding_progress
  ADD COLUMN IF NOT EXISTS notes_updated_by uuid,
  ADD COLUMN IF NOT EXISTS notes_updated_at timestamptz;

-- Holidays
CREATE TABLE public.holidays (
  day date PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'nacional' CHECK (kind IN ('nacional','manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.holidays TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internos leem feriados" ON public.holidays FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Gestores criam feriados" ON public.holidays FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores alteram feriados" ON public.holidays FOR UPDATE TO authenticated USING (public.has_permission('manage_onboarding_procedures')) WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores removem feriados" ON public.holidays FOR DELETE TO authenticated USING (public.has_permission('manage_onboarding_procedures'));

INSERT INTO public.holidays (day, name) SELECT d::date, n FROM (VALUES
 ('2026-01-01','Confraternização Universal'),('2026-02-16','Carnaval'),('2026-02-17','Carnaval'),('2026-04-03','Sexta-feira Santa'),
 ('2026-04-21','Tiradentes'),('2026-05-01','Dia do Trabalho'),('2026-06-04','Corpus Christi'),('2026-09-07','Independência'),
 ('2026-10-12','Nossa Senhora Aparecida'),('2026-11-02','Finados'),('2026-11-15','Proclamação da República'),('2026-11-20','Consciência Negra'),('2026-12-25','Natal'),
 ('2027-01-01','Confraternização Universal'),('2027-02-08','Carnaval'),('2027-02-09','Carnaval'),('2027-03-26','Sexta-feira Santa'),
 ('2027-04-21','Tiradentes'),('2027-05-01','Dia do Trabalho'),('2027-05-27','Corpus Christi'),('2027-09-07','Independência'),
 ('2027-10-12','Nossa Senhora Aparecida'),('2027-11-02','Finados'),('2027-11-15','Proclamação da República'),('2027-11-20','Consciência Negra'),('2027-12-25','Natal')
) v(d,n) ON CONFLICT DO NOTHING;

-- Business-hours / business-days SLA
CREATE OR REPLACE FUNCTION public.add_business_hours(p_start timestamptz, p_hours numeric)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  t timestamp := p_start AT TIME ZONE 'America/Sao_Paulo';
  remaining numeric := COALESCE(p_hours,0) * 60; -- minutes
  day_end timestamp; avail numeric; i int := 0;
BEGIN
  LOOP
    i := i + 1; EXIT WHEN i > 2000;
    IF extract(isodow FROM t) IN (6,7) OR EXISTS (SELECT 1 FROM holidays WHERE day = t::date) OR t::time >= time '18:00' THEN
      t := (t::date + 1) + time '08:00'; CONTINUE;
    END IF;
    IF t::time < time '08:00' THEN t := t::date + time '08:00'; END IF;
    day_end := t::date + time '18:00';
    avail := extract(epoch FROM day_end - t) / 60;
    IF remaining <= avail THEN
      t := t + make_interval(mins => remaining::int); EXIT;
    END IF;
    remaining := remaining - avail;
    t := (t::date + 1) + time '08:00';
  END LOOP;
  RETURN t AT TIME ZONE 'America/Sao_Paulo';
END $$;

CREATE OR REPLACE FUNCTION public.add_business_days(p_start timestamptz, p_days numeric)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE t timestamp := p_start AT TIME ZONE 'America/Sao_Paulo'; n int := 0; target int := ceil(COALESCE(p_days,0));
BEGIN
  WHILE n < target LOOP
    t := t + interval '1 day';
    IF extract(isodow FROM t) NOT IN (6,7) AND NOT EXISTS (SELECT 1 FROM holidays WHERE day = t::date) THEN n := n + 1; END IF;
  END LOOP;
  RETURN t AT TIME ZONE 'America/Sao_Paulo';
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_sla_due(p_start timestamptz, p_value numeric, p_unit text, p_fallback_hours numeric)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_start IS NULL THEN NULL
    WHEN p_value IS NULL OR p_unit IS NULL THEN p_start + make_interval(hours => COALESCE(p_fallback_hours,48)::int)
    WHEN p_unit = 'horas' THEN public.add_business_hours(p_start, p_value)
    WHEN p_unit = 'dias_uteis' THEN public.add_business_days(p_start, p_value)
    ELSE p_start + make_interval(days => ceil(p_value)::int)
  END $$;

CREATE OR REPLACE FUNCTION public.onboarding_item_due_at(p_progress_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.onboarding_sla_due(p.unlocked_at, i.sla_value, i.sla_unit, i.sla_hours)
  FROM client_onboarding_progress p JOIN onboarding_checklist_items i ON i.id = p.checklist_item_id
  WHERE p.id = p_progress_id AND NOT p.locked $$;

-- Message templates
CREATE TABLE public.onboarding_item_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id uuid NOT NULL REFERENCES public.onboarding_checklist_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email')),
  subject text,
  body_md text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_item_templates TO authenticated;
GRANT ALL ON public.onboarding_item_templates TO service_role;
ALTER TABLE public.onboarding_item_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internos leem modelos do item" ON public.onboarding_item_templates FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Gestores criam modelos do item" ON public.onboarding_item_templates FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores alteram modelos do item" ON public.onboarding_item_templates FOR UPDATE TO authenticated USING (public.has_permission('manage_onboarding_procedures')) WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores removem modelos do item" ON public.onboarding_item_templates FOR DELETE TO authenticated USING (public.has_permission('manage_onboarding_procedures'));

-- Attachments
CREATE TABLE public.onboarding_item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_onboarding_item_id uuid NOT NULL REFERENCES public.client_onboarding_progress(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  uploaded_by uuid DEFAULT public.current_internal_user_id(),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.onboarding_item_attachments TO authenticated;
GRANT ALL ON public.onboarding_item_attachments TO service_role;
ALTER TABLE public.onboarding_item_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internos leem anexos" ON public.onboarding_item_attachments FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Escritores anexam" ON public.onboarding_item_attachments FOR INSERT TO authenticated WITH CHECK (public.can_write_clients());
CREATE POLICY "Escritores removem anexos" ON public.onboarding_item_attachments FOR DELETE TO authenticated USING (public.can_write_clients());

-- Definition edits: only procedure managers + history
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='onboarding_checklist_items' AND cmd IN ('UPDATE') LOOP
    EXECUTE format('DROP POLICY %I ON public.onboarding_checklist_items', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Gestores alteram definição do item" ON public.onboarding_checklist_items FOR UPDATE TO authenticated
  USING (public.has_permission('manage_onboarding_procedures')) WITH CHECK (public.has_permission('manage_onboarding_procedures'));
GRANT UPDATE ON public.onboarding_checklist_items TO authenticated;

CREATE OR REPLACE FUNCTION public.log_checklist_definition_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_by := public.current_internal_user_id();
  NEW.updated_at := now();
  INSERT INTO audit_logs (client_id, field, old_value, new_value, changed_by)
  SELECT NULL, 'onboarding_checklist_items:' || NEW.id, to_jsonb(OLD)::text, to_jsonb(NEW)::text,
         COALESCE((SELECT name FROM internal_users WHERE id = NEW.updated_by), 'Sistema')
  WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='field');
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
CREATE TRIGGER trg_checklist_definition_change BEFORE UPDATE ON public.onboarding_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.log_checklist_definition_change();

REVOKE EXECUTE ON FUNCTION public.log_checklist_definition_change() FROM PUBLIC, anon, authenticated;