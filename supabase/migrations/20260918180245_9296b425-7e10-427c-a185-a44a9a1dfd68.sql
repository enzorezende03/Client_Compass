REVOKE EXECUTE ON FUNCTION public.set_timeline_created_by() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_timeline_created_by_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_timeline_on_task_complete() FROM PUBLIC, anon, authenticated;