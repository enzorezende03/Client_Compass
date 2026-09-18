CREATE TABLE public.onboarding_procedure_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  onboarding_type text CHECK (onboarding_type IN ('empresa_existente','empresa_nova','em_constituicao','vmk_parceria')),
  linked_stage_key text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.internal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_procedure_phases TO authenticated;
GRANT ALL ON public.onboarding_procedure_phases TO service_role;
ALTER TABLE public.onboarding_procedure_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos veem fases do procedimento" ON public.onboarding_procedure_phases
  FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Gestores criam fases do procedimento" ON public.onboarding_procedure_phases
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores alteram fases do procedimento" ON public.onboarding_procedure_phases
  FOR UPDATE TO authenticated USING (public.has_permission('manage_onboarding_procedures'))
  WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores removem fases do procedimento" ON public.onboarding_procedure_phases
  FOR DELETE TO authenticated USING (public.has_permission('manage_onboarding_procedures'));

CREATE TABLE public.onboarding_procedure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.onboarding_procedure_phases(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('orientacao','mensagem','checklist_referencia')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  channel text CHECK (channel IN ('whatsapp','email','interno')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.internal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_procedure_items_phase ON public.onboarding_procedure_items(phase_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_procedure_items TO authenticated;
GRANT ALL ON public.onboarding_procedure_items TO service_role;
ALTER TABLE public.onboarding_procedure_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos veem itens do procedimento" ON public.onboarding_procedure_items
  FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Gestores criam itens do procedimento" ON public.onboarding_procedure_items
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores alteram itens do procedimento" ON public.onboarding_procedure_items
  FOR UPDATE TO authenticated USING (public.has_permission('manage_onboarding_procedures'))
  WITH CHECK (public.has_permission('manage_onboarding_procedures'));
CREATE POLICY "Gestores removem itens do procedimento" ON public.onboarding_procedure_items
  FOR DELETE TO authenticated USING (public.has_permission('manage_onboarding_procedures'));

CREATE TABLE public.onboarding_procedure_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid REFERENCES public.internal_users(id),
  changed_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.onboarding_procedure_history TO authenticated;
GRANT ALL ON public.onboarding_procedure_history TO service_role;
ALTER TABLE public.onboarding_procedure_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos veem historico do procedimento" ON public.onboarding_procedure_history
  FOR SELECT TO authenticated USING (public.is_internal_user());

REVOKE UPDATE, DELETE ON public.onboarding_procedure_history FROM authenticated;

CREATE TRIGGER update_onboarding_procedure_phases_updated_at
  BEFORE UPDATE ON public.onboarding_procedure_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_onboarding_procedure_items_updated_at
  BEFORE UPDATE ON public.onboarding_procedure_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_onboarding_procedure_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  SELECT id INTO v_user FROM public.internal_users WHERE auth_user_id = auth.uid() LIMIT 1;
  NEW.updated_by := v_user;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_onboarding_procedure_author() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_phase_author BEFORE INSERT OR UPDATE ON public.onboarding_procedure_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_procedure_author();
CREATE TRIGGER set_item_author BEFORE INSERT OR UPDATE ON public.onboarding_procedure_items
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_procedure_author();

CREATE OR REPLACE FUNCTION public.log_onboarding_procedure_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_name text;
BEGIN
  SELECT id, name INTO v_user, v_name FROM public.internal_users WHERE auth_user_id = auth.uid() LIMIT 1;
  INSERT INTO public.onboarding_procedure_history (table_name, record_id, action, before_data, after_data, changed_by, changed_by_name)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    v_user, COALESCE(v_name, '')
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_onboarding_procedure_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_phase_change AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_procedure_phases
  FOR EACH ROW EXECUTE FUNCTION public.log_onboarding_procedure_change();
CREATE TRIGGER log_item_change AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_procedure_items
  FOR EACH ROW EXECUTE FUNCTION public.log_onboarding_procedure_change();