CREATE TABLE public.demand_sla_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL CHECK (sector IN ('Fiscal','Contábil','DP','Societário','Comercial','Financeiro','CS','Geral')),
  demand_name text NOT NULL,
  sla_value numeric NOT NULL,
  sla_unit text NOT NULL CHECK (sla_unit IN ('horas','dias_uteis','dias_corridos')),
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES public.internal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector, demand_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_sla_catalog TO authenticated;
GRANT ALL ON public.demand_sla_catalog TO service_role;

ALTER TABLE public.demand_sla_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos podem ver o catálogo de prazos"
  ON public.demand_sla_catalog FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "Gestores do catálogo podem criar prazos"
  ON public.demand_sla_catalog FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('manage_sla_catalog'));

CREATE POLICY "Gestores do catálogo podem alterar prazos"
  ON public.demand_sla_catalog FOR UPDATE TO authenticated
  USING (public.has_permission('manage_sla_catalog'))
  WITH CHECK (public.has_permission('manage_sla_catalog'));

CREATE POLICY "Gestores do catálogo podem remover prazos"
  ON public.demand_sla_catalog FOR DELETE TO authenticated
  USING (public.has_permission('manage_sla_catalog'));

CREATE TABLE public.demand_sla_catalog_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES public.demand_sla_catalog(id) ON DELETE SET NULL,
  sector text NOT NULL,
  demand_name text NOT NULL,
  action text NOT NULL,
  field_name text NOT NULL,
  old_value text NOT NULL DEFAULT '',
  new_value text NOT NULL DEFAULT '',
  changed_by uuid REFERENCES public.internal_users(id),
  changed_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.demand_sla_catalog_history TO authenticated;
GRANT ALL ON public.demand_sla_catalog_history TO service_role;

ALTER TABLE public.demand_sla_catalog_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos podem ver o histórico do catálogo"
  ON public.demand_sla_catalog_history FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE TRIGGER update_demand_sla_catalog_updated_at
  BEFORE UPDATE ON public.demand_sla_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_demand_sla_catalog_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid;
BEGIN
  SELECT id INTO v_user FROM public.internal_users WHERE auth_user_id = auth.uid() LIMIT 1;
  NEW.updated_by := v_user;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_demand_sla_catalog_author() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_demand_sla_catalog_author_trg
  BEFORE INSERT OR UPDATE ON public.demand_sla_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_demand_sla_catalog_author();

CREATE OR REPLACE FUNCTION public.log_demand_sla_catalog_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_name text;
BEGIN
  SELECT id, name INTO v_user, v_name FROM public.internal_users WHERE auth_user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.demand_sla_catalog_history (catalog_id, sector, demand_name, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.sector, NEW.demand_name, 'insert', 'registro', '', NEW.sla_value || ' ' || NEW.sla_unit, v_user, COALESCE(v_name, ''));
    RETURN NEW;
  END IF;

  IF NEW.demand_name IS DISTINCT FROM OLD.demand_name THEN
    INSERT INTO public.demand_sla_catalog_history (catalog_id, sector, demand_name, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.sector, NEW.demand_name, 'update', 'demanda', OLD.demand_name, NEW.demand_name, v_user, COALESCE(v_name, ''));
  END IF;
  IF NEW.sector IS DISTINCT FROM OLD.sector THEN
    INSERT INTO public.demand_sla_catalog_history (catalog_id, sector, demand_name, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.sector, NEW.demand_name, 'update', 'setor', OLD.sector, NEW.sector, v_user, COALESCE(v_name, ''));
  END IF;
  IF NEW.sla_value IS DISTINCT FROM OLD.sla_value THEN
    INSERT INTO public.demand_sla_catalog_history (catalog_id, sector, demand_name, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.sector, NEW.demand_name, 'update', 'prazo', OLD.sla_value::text, NEW.sla_value::text, v_user, COALESCE(v_name, ''));
  END IF;
  IF NEW.sla_unit IS DISTINCT FROM OLD.sla_unit THEN
    INSERT INTO public.demand_sla_catalog_history (catalog_id, sector, demand_name, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.sector, NEW.demand_name, 'update', 'unidade', OLD.sla_unit, NEW.sla_unit, v_user, COALESCE(v_name, ''));
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.demand_sla_catalog_history (catalog_id, sector, demand_name, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.sector, NEW.demand_name, 'update', 'observação', COALESCE(OLD.notes, ''), COALESCE(NEW.notes, ''), v_user, COALESCE(v_name, ''));
  END IF;
  IF NEW.active IS DISTINCT FROM OLD.active THEN
    INSERT INTO public.demand_sla_catalog_history (catalog_id, sector, demand_name, action, field_name, old_value, new_value, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.sector, NEW.demand_name, 'update', 'situação', CASE WHEN OLD.active THEN 'ativo' ELSE 'inativo' END, CASE WHEN NEW.active THEN 'ativo' ELSE 'inativo' END, v_user, COALESCE(v_name, ''));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_demand_sla_catalog_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_demand_sla_catalog_change_trg
  AFTER INSERT OR UPDATE ON public.demand_sla_catalog
  FOR EACH ROW EXECUTE FUNCTION public.log_demand_sla_catalog_change();

-- Histórico imutável: nenhuma política de UPDATE/DELETE e INSERT apenas pelo gatilho (SECURITY DEFINER).
REVOKE UPDATE, DELETE ON public.demand_sla_catalog_history FROM authenticated;