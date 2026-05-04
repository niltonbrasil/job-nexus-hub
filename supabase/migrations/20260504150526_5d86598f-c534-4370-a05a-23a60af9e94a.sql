
REVOKE EXECUTE ON FUNCTION public.generate_shifts_for_date(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_monthly_billing(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_worker_metrics_on_accept() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_worker_metrics_on_exec() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- keep checkin/checkout for authenticated workers
GRANT EXECUTE ON FUNCTION public.worker_checkin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.worker_checkout(uuid, numeric, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.worker_checkin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.worker_checkout(uuid, numeric, jsonb) FROM anon, PUBLIC;
