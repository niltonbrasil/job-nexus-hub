INSERT INTO public.shift_executions (worker_id, acceptance_id, status)
SELECT a.worker_id, a.id, 'scheduled'::execution_status
FROM public.shift_acceptances a
LEFT JOIN public.shift_executions e ON e.acceptance_id = a.id
WHERE e.id IS NULL AND a.status = 'accepted';