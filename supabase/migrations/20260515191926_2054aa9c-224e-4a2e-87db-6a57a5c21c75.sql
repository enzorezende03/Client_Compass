CREATE OR REPLACE FUNCTION public.auto_advance_onboarding_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_stage TEXT;
  v_next TEXT;
  v_remaining INT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'concluido' THEN
    RETURN NEW;
  END IF;

  SELECT id, name, onboarding_stage, onboarding_type, onboarding_status
    INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_client.id IS NULL THEN RETURN NEW; END IF;
  IF v_client.onboarding_type <> 'empresa_nova' THEN RETURN NEW; END IF;
  IF v_client.onboarding_status = 'completed' THEN RETURN NEW; END IF;

  v_stage := v_client.onboarding_stage;

  IF v_stage NOT IN ('etapa_1_nova','etapa_2_nova','etapa_3_nova') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_remaining
  FROM public.client_onboarding_progress p
  JOIN public.onboarding_checklist_items i ON i.id = p.checklist_item_id
  WHERE p.client_id = NEW.client_id
    AND i.stage = v_stage
    AND i.is_required = true
    AND p.status <> 'concluido';

  IF v_remaining > 0 THEN RETURN NEW; END IF;

  v_next := CASE v_stage
    WHEN 'etapa_1_nova' THEN 'etapa_2_nova'
    WHEN 'etapa_2_nova' THEN 'etapa_3_nova'
    WHEN 'etapa_3_nova' THEN 'concluido'
  END;

  IF v_next = 'concluido' THEN
    UPDATE public.clients
       SET onboarding_status = 'completed',
           onboarding_stage = 'concluido',
           onboarding_completed_at = now()
     WHERE id = NEW.client_id;
  ELSE
    UPDATE public.clients
       SET onboarding_stage = v_next
     WHERE id = NEW.client_id;

    INSERT INTO public.client_onboarding_progress (client_id, checklist_item_id, status)
    SELECT NEW.client_id, i.id, 'pendente'
    FROM public.onboarding_checklist_items i
    WHERE i.stage = v_next
    ON CONFLICT (client_id, checklist_item_id) DO NOTHING;
  END IF;

  INSERT INTO public.timeline_entries
    (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, relevant_event_type)
  VALUES
    (NEW.client_id, 'service',
     '[Onboarding] Etapa ' || v_stage || ' concluída — avançou automaticamente para ' || v_next,
     'Sistema', 'commercial', 'internal',
     CASE WHEN v_next = 'concluido' THEN 'resolved' ELSE 'in_progress' END,
     true, 'onboarding');

  RETURN NEW;
END;
$function$;