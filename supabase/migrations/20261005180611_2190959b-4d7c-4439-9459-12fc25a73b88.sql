CREATE OR REPLACE FUNCTION public.log_checklist_definition_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := public.current_internal_user_id();
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.updated_by := v_uid; NEW.updated_at := now(); END IF;
  INSERT INTO onboarding_procedure_history (table_name, record_id, action, before_data, after_data, changed_by, changed_by_name)
  VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), lower(TG_OP),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          v_uid, COALESCE((SELECT name FROM internal_users WHERE id = v_uid), 'Sistema'));
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_item_templates_history AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_item_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_checklist_definition_change();