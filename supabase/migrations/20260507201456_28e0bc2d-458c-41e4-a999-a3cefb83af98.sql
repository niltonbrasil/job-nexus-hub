
-- Snapshot de preço/horas no momento do checkout
ALTER TABLE public.shift_executions
  ADD COLUMN IF NOT EXISTS applied_rate_per_hour numeric(10,2),
  ADD COLUMN IF NOT EXISTS applied_hours numeric(6,2),
  ADD COLUMN IF NOT EXISTS applied_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';

-- Atualizar worker_checkout para gravar snapshot de forma idempotente
CREATE OR REPLACE FUNCTION public.worker_checkout(_execution_id uuid, _hours numeric DEFAULT NULL::numeric, _proof jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _h numeric;
  _rate numeric;
BEGIN
  SELECT COALESCE(_hours, EXTRACT(EPOCH FROM (now() - checkin_time))/3600)
  INTO _h FROM public.shift_executions WHERE id = _execution_id;

  -- Buscar a taxa vigente via join acceptance -> offer -> demand -> contract_service
  SELECT cs.price_per_hour
  INTO _rate
  FROM public.shift_executions e
  JOIN public.shift_acceptances a ON a.id = e.acceptance_id
  JOIN public.shift_offers o ON o.id = a.offer_id
  JOIN public.demands d ON d.id = o.demand_id
  JOIN public.contract_services cs ON cs.id = d.contract_service_id
  WHERE e.id = _execution_id;

  UPDATE public.shift_executions
  SET checkout_time = now(),
      worked = true,
      hours_worked = COALESCE(_h, 0),
      proof_data = _proof,
      status = 'completed',
      -- snapshot idempotente: só preenche se ainda não houver
      applied_hours = COALESCE(applied_hours, COALESCE(_h, 0)),
      applied_rate_per_hour = COALESCE(applied_rate_per_hour, _rate),
      applied_amount = COALESCE(applied_amount, ROUND(COALESCE(_h, 0) * COALESCE(_rate, 0), 2))
  WHERE id = _execution_id
    AND EXISTS (SELECT 1 FROM public.workers w WHERE w.id = shift_executions.worker_id AND w.user_id = auth.uid());

  INSERT INTO public.execution_events (execution_id, type, metadata)
  VALUES (_execution_id, 'checkout', jsonb_build_object('at', now(), 'hours', _h, 'rate', _rate));
END $function$;
