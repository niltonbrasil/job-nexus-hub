
-- Add status to shift_executions
DO $$ BEGIN
  CREATE TYPE execution_status AS ENUM ('scheduled','in_progress','completed','no_show','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shift_executions
  ADD COLUMN IF NOT EXISTS status execution_status NOT NULL DEFAULT 'scheduled';

-- ====== Reputation: bump metrics on acceptance ======
CREATE OR REPLACE FUNCTION public.bump_worker_metrics_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.worker_metrics (worker_id, total_accepted, total_worked, total_no_show, reliability_score)
  VALUES (NEW.worker_id, 1, 0, 0, 1.000)
  ON CONFLICT (worker_id) DO UPDATE
    SET total_accepted = public.worker_metrics.total_accepted + 1,
        reliability_score = CASE
          WHEN public.worker_metrics.total_accepted + 1 = 0 THEN 1.000
          ELSE ROUND(public.worker_metrics.total_worked::numeric / (public.worker_metrics.total_accepted + 1), 3)
        END,
        last_updated = now();

  -- create scheduled execution row
  INSERT INTO public.shift_executions (worker_id, acceptance_id, status)
  VALUES (NEW.worker_id, NEW.id, 'scheduled');

  -- update offer counters
  UPDATE public.shift_offers
  SET slots_filled = slots_filled + 1,
      status = CASE WHEN slots_filled + 1 >= slots_total THEN 'filled'::offer_status ELSE 'open'::offer_status END
  WHERE id = NEW.offer_id;

  -- reflect demand status
  UPDATE public.demands d
  SET status = CASE
    WHEN o.slots_filled >= o.slots_total THEN 'filled'::demand_status
    ELSE 'partially_filled'::demand_status
  END
  FROM public.shift_offers o
  WHERE o.id = NEW.offer_id AND d.id = o.demand_id;

  RETURN NEW;
END $$;

ALTER TABLE public.worker_metrics ADD CONSTRAINT worker_metrics_worker_unique UNIQUE (worker_id);

DROP TRIGGER IF EXISTS trg_bump_metrics_accept ON public.shift_acceptances;
CREATE TRIGGER trg_bump_metrics_accept
AFTER INSERT ON public.shift_acceptances
FOR EACH ROW EXECUTE FUNCTION public.bump_worker_metrics_on_accept();

-- ====== Reputation: recompute on execution completion ======
CREATE OR REPLACE FUNCTION public.update_worker_metrics_on_exec()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.worker_metrics
    SET total_worked = total_worked + 1,
        reliability_score = ROUND((total_worked + 1)::numeric / GREATEST(total_accepted,1), 3),
        last_updated = now()
    WHERE worker_id = NEW.worker_id;
  ELSIF NEW.status = 'no_show' AND (OLD.status IS DISTINCT FROM 'no_show') THEN
    UPDATE public.worker_metrics
    SET total_no_show = total_no_show + 1,
        reliability_score = ROUND(total_worked::numeric / GREATEST(total_accepted,1), 3),
        last_updated = now()
    WHERE worker_id = NEW.worker_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_update_metrics_exec ON public.shift_executions;
CREATE TRIGGER trg_update_metrics_exec
AFTER UPDATE ON public.shift_executions
FOR EACH ROW EXECUTE FUNCTION public.update_worker_metrics_on_exec();

-- ====== Worker check-in / check-out RPCs ======
CREATE OR REPLACE FUNCTION public.worker_checkin(_execution_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shift_executions
  SET checkin_time = now(), status = 'in_progress'
  WHERE id = _execution_id
    AND EXISTS (SELECT 1 FROM public.workers w WHERE w.id = shift_executions.worker_id AND w.user_id = auth.uid());

  INSERT INTO public.execution_events (execution_id, type, metadata)
  VALUES (_execution_id, 'checkin', jsonb_build_object('at', now()));
END $$;

CREATE OR REPLACE FUNCTION public.worker_checkout(_execution_id uuid, _hours numeric DEFAULT NULL, _proof jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _h numeric;
BEGIN
  SELECT COALESCE(_hours, EXTRACT(EPOCH FROM (now() - checkin_time))/3600)
  INTO _h FROM public.shift_executions WHERE id = _execution_id;

  UPDATE public.shift_executions
  SET checkout_time = now(),
      worked = true,
      hours_worked = COALESCE(_h, 0),
      proof_data = _proof,
      status = 'completed'
  WHERE id = _execution_id
    AND EXISTS (SELECT 1 FROM public.workers w WHERE w.id = shift_executions.worker_id AND w.user_id = auth.uid());

  INSERT INTO public.execution_events (execution_id, type, metadata)
  VALUES (_execution_id, 'checkout', jsonb_build_object('at', now(), 'hours', _h));
END $$;

-- ====== Generate shifts for a date (used by cron) ======
CREATE OR REPLACE FUNCTION public.generate_shifts_for_date(_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  svc record; new_demand_id uuid; cnt int := 0;
  is_weekend boolean := EXTRACT(DOW FROM _date) IN (0,6);
BEGIN
  FOR svc IN
    SELECT cs.id, cs.service_type, cs.hours_per_day, cs.min_workers, cs.rules
    FROM public.contract_services cs
    JOIN public.contracts ct ON ct.id = cs.contract_id
    WHERE ct.status = 'active' AND _date BETWEEN ct.start_date AND ct.end_date
  LOOP
    IF is_weekend AND COALESCE((svc.rules->>'weekend')::boolean, true) = false THEN CONTINUE; END IF;
    -- skip if already exists
    IF EXISTS (SELECT 1 FROM public.demands WHERE contract_service_id = svc.id AND date = _date) THEN CONTINUE; END IF;

    INSERT INTO public.demands (
      contract_service_id, date, start_time, end_time, job_type,
      hours_required, slots_required, weekend, shift_type
    ) VALUES (
      svc.id, _date,
      (_date::timestamp + interval '8 hour') AT TIME ZONE 'America/Sao_Paulo',
      (_date::timestamp + (svc.hours_per_day || ' hour')::interval + interval '8 hour') AT TIME ZONE 'America/Sao_Paulo',
      svc.service_type::job_type,
      svc.hours_per_day, svc.min_workers, is_weekend,
      CASE WHEN svc.hours_per_day >= 12 THEN 'night'::shift_type ELSE 'day'::shift_type END
    ) RETURNING id INTO new_demand_id;

    INSERT INTO public.shift_offers (demand_id, slots_total)
    VALUES (new_demand_id, svc.min_workers);

    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;

-- ====== Monthly billing consolidation ======
CREATE OR REPLACE FUNCTION public.generate_monthly_billing(_period_start date DEFAULT date_trunc('month', now() - interval '1 month')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ct record; new_billing_id uuid; total_h numeric; total_a numeric; cnt int := 0;
  _period_end date := (date_trunc('month', _period_start) + interval '1 month - 1 day')::date;
BEGIN
  FOR ct IN
    SELECT DISTINCT contracts.id AS contract_id
    FROM public.contracts
    JOIN public.contract_services cs ON cs.contract_id = contracts.id
    JOIN public.demands d ON d.contract_service_id = cs.id
    JOIN public.shift_offers o ON o.demand_id = d.id
    JOIN public.shift_acceptances a ON a.offer_id = o.id
    JOIN public.shift_executions e ON e.acceptance_id = a.id
    WHERE e.status = 'completed' AND d.date BETWEEN _period_start AND _period_end
  LOOP
    -- skip if billing already exists
    IF EXISTS (SELECT 1 FROM public.billings b WHERE b.contract_id = ct.contract_id AND b.period_start = _period_start) THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(e.hours_worked),0), COALESCE(SUM(e.hours_worked * cs.price_per_hour),0)
    INTO total_h, total_a
    FROM public.shift_executions e
    JOIN public.shift_acceptances a ON a.id = e.acceptance_id
    JOIN public.shift_offers o ON o.id = a.offer_id
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    WHERE cs.contract_id = ct.contract_id
      AND e.status = 'completed'
      AND d.date BETWEEN _period_start AND _period_end;

    INSERT INTO public.billings (contract_id, period_start, period_end, total_hours, total_amount, status)
    VALUES (ct.contract_id, _period_start, _period_end, total_h, total_a, 'open')
    RETURNING id INTO new_billing_id;

    INSERT INTO public.billing_items (billing_id, demand_id, execution_id, hours, amount)
    SELECT new_billing_id, d.id, e.id, e.hours_worked, e.hours_worked * cs.price_per_hour
    FROM public.shift_executions e
    JOIN public.shift_acceptances a ON a.id = e.acceptance_id
    JOIN public.shift_offers o ON o.id = a.offer_id
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    WHERE cs.contract_id = ct.contract_id
      AND e.status = 'completed'
      AND d.date BETWEEN _period_start AND _period_end;

    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;
