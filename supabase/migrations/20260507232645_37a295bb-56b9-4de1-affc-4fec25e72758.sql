
-- 1) Trigger BEFORE INSERT em shift_acceptances: papel automático + cap de vagas
CREATE OR REPLACE FUNCTION public.assign_crew_role_and_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count int;
  total int;
  next_role public.crew_role;
BEGIN
  SELECT slots_total INTO total FROM public.shift_offers WHERE id = NEW.offer_id FOR UPDATE;
  IF total IS NULL THEN
    RAISE EXCEPTION 'Oferta inexistente' USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.shift_acceptances
  WHERE offer_id = NEW.offer_id AND status = 'accepted';

  IF current_count >= total THEN
    RAISE EXCEPTION 'Vaga lotada: % de % aceites', current_count, total
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.crew_role IS NULL THEN
    next_role := CASE current_count
      WHEN 0 THEN 'linha_impar'::public.crew_role
      WHEN 1 THEN 'linha_par'::public.crew_role
      WHEN 2 THEN 'folguista_1'::public.crew_role
      WHEN 3 THEN 'folguista_2'::public.crew_role
      ELSE 'folguista_2'::public.crew_role
    END;
    NEW.crew_role := next_role;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_crew_role_and_cap ON public.shift_acceptances;
CREATE TRIGGER trg_assign_crew_role_and_cap
BEFORE INSERT ON public.shift_acceptances
FOR EACH ROW EXECUTE FUNCTION public.assign_crew_role_and_cap();

-- Garantir que o trigger de conflito de paciente esteja anexado
DROP TRIGGER IF EXISTS trg_check_worker_patient_conflict ON public.shift_acceptances;
CREATE TRIGGER trg_check_worker_patient_conflict
BEFORE INSERT ON public.shift_acceptances
FOR EACH ROW EXECUTE FUNCTION public.check_worker_patient_conflict();

-- Triggers existentes de métricas (manter)
DROP TRIGGER IF EXISTS trg_bump_worker_metrics_on_accept ON public.shift_acceptances;
CREATE TRIGGER trg_bump_worker_metrics_on_accept
AFTER INSERT ON public.shift_acceptances
FOR EACH ROW EXECUTE FUNCTION public.bump_worker_metrics_on_accept();

DROP TRIGGER IF EXISTS trg_update_worker_metrics_on_exec ON public.shift_executions;
CREATE TRIGGER trg_update_worker_metrics_on_exec
AFTER UPDATE ON public.shift_executions
FOR EACH ROW EXECUTE FUNCTION public.update_worker_metrics_on_exec();

-- 2) generate_shifts_for_date: exigir paciente+CPF para visita; 1 offer por demand com slots = crew_size
CREATE OR REPLACE FUNCTION public.generate_shifts_for_date(_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc record;
  new_demand_id uuid;
  cnt int := 0;
  is_weekend boolean := EXTRACT(DOW FROM _date) IN (0,6);
  is_odd boolean := (EXTRACT(DAY FROM _date)::int % 2) = 1;
  parity_label text := CASE WHEN is_odd THEN 'impar' ELSE 'par' END;
  crew int;
  blocks int;
  block_hours int;
  i int;
  start_ts timestamptz;
  end_ts timestamptz;
  snapshot jsonb;
  patient_cpf text;
BEGIN
  FOR svc IN
    SELECT cs.id, cs.service_type, cs.hours_per_day, cs.min_workers, cs.rules,
           cs.plan_level, cs.credits_days, cs.padding_days, cs.personalization,
           cs.patient_id
    FROM public.contract_services cs
    JOIN public.contracts ct ON ct.id = cs.contract_id
    WHERE ct.status = 'active'
      AND _date BETWEEN ct.start_date AND ct.end_date
  LOOP
    IF is_weekend AND COALESCE((svc.rules->>'weekend')::boolean, true) = false THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.demands WHERE contract_service_id = svc.id AND date = _date) THEN CONTINUE; END IF;

    -- Visita exige paciente com CPF
    IF svc.service_type = 'visit' THEN
      IF svc.patient_id IS NULL THEN
        RAISE EXCEPTION 'Serviço de visita % sem paciente vinculado. Edite o contrato e selecione o paciente.', svc.id
          USING ERRCODE = 'check_violation';
      END IF;
      SELECT cpf INTO patient_cpf FROM public.patients WHERE id = svc.patient_id;
      IF patient_cpf IS NULL OR length(trim(patient_cpf)) = 0 THEN
        RAISE EXCEPTION 'Paciente do serviço % sem CPF cadastrado.', svc.id
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    IF svc.plan_level = 'plano2' THEN
      blocks := COALESCE((svc.personalization->>'blocks')::int, 2);
      block_hours := COALESCE(svc.hours_per_day, 24) / GREATEST(blocks,1);
    ELSE
      blocks := 1;
      block_hours := COALESCE(svc.hours_per_day, 12);
    END IF;

    crew := GREATEST(svc.min_workers, COALESCE((svc.personalization->>'crew_size')::int, 4));

    snapshot := jsonb_build_object(
      'plan_level', svc.plan_level,
      'parity', parity_label,
      'is_weekend', is_weekend,
      'crew_size', crew,
      'blocks', blocks,
      'block_hours', block_hours,
      'credits_days', svc.credits_days,
      'padding_days', svc.padding_days,
      'patient_id', svc.patient_id
    );

    FOR i IN 0..(blocks-1) LOOP
      start_ts := (_date::timestamp + interval '8 hour' + (i * block_hours || ' hour')::interval) AT TIME ZONE 'America/Sao_Paulo';
      end_ts := start_ts + (block_hours || ' hour')::interval;

      INSERT INTO public.demands (
        contract_service_id, date, start_time, end_time, job_type,
        hours_required, slots_required, weekend, shift_type,
        block_index, plan_snapshot, patient_id, crew_size
      ) VALUES (
        svc.id, _date, start_ts, end_ts, svc.service_type,
        block_hours, crew, is_weekend,
        CASE WHEN block_hours >= 12 THEN 'night'::public.shift_type ELSE 'day'::public.shift_type END,
        i, snapshot, svc.patient_id, crew
      ) RETURNING id INTO new_demand_id;

      -- 1 oferta única, todas as equipes elegíveis
      INSERT INTO public.shift_offers (demand_id, slots_total, wave, eligible_teams, opens_at)
      VALUES (
        new_demand_id, crew, 1,
        ARRAY[]::text[],
        now()
      );

      cnt := cnt + 1;
    END LOOP;
  END LOOP;
  RETURN cnt;
END $$;
