CREATE OR REPLACE FUNCTION public.generate_shifts_for_date(_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  start_hour int;
  svc_parity text;
  svc_shift text;
  block_start_hour int;
  block_shift_label public.shift_type;
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

    -- Paridade aplicada ao dia base D (mesmo para noturno que atravessa para D+1).
    -- Aceita 'odd'|'impar' e 'even'|'par'; qualquer outro valor (inclui null/'any'/'all') gera todo dia.
    svc_parity := lower(COALESCE(svc.personalization->>'parity', svc.rules->>'parity', 'any'));
    IF svc_parity IN ('odd','impar','impares','ímpar','ímpares') AND NOT is_odd THEN CONTINUE; END IF;
    IF svc_parity IN ('even','par','pares') AND is_odd THEN CONTINUE; END IF;

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

    -- Turno fixo do serviço: 'day' (08-20), 'night' (20-08+1) ou 'any' (default 'day' p/ blocos únicos).
    svc_shift := lower(COALESCE(svc.personalization->>'shift_type', svc.rules->>'shift_type', 'day'));
    IF svc_shift NOT IN ('day','night','diurno','noturno') THEN svc_shift := 'day'; END IF;
    IF svc_shift = 'diurno' THEN svc_shift := 'day'; END IF;
    IF svc_shift = 'noturno' THEN svc_shift := 'night'; END IF;

    IF svc.plan_level = 'plano2' THEN
      blocks := COALESCE((svc.personalization->>'blocks')::int, 2);
      block_hours := COALESCE(svc.hours_per_day, 24) / GREATEST(blocks,1);
      start_hour := 8; -- plano2 começa diurno e encadeia 2x12 = 08→20→08+1
    ELSE
      blocks := 1;
      block_hours := COALESCE(svc.hours_per_day, 12);
      -- Plano1 12h: respeita svc_shift; Plano3 4h: começa às 08.
      IF svc.plan_level = 'plano1' AND svc_shift = 'night' THEN
        start_hour := 20;
      ELSE
        start_hour := 8;
      END IF;
    END IF;

    crew := GREATEST(svc.min_workers, COALESCE((svc.personalization->>'crew_size')::int, 4));

    snapshot := jsonb_build_object(
      'plan_level', svc.plan_level,
      'parity', parity_label,
      'parity_rule', svc_parity,
      'shift_type', svc_shift,
      'is_weekend', is_weekend,
      'crew_size', crew,
      'blocks', blocks,
      'block_hours', block_hours,
      'credits_days', svc.credits_days,
      'padding_days', svc.padding_days,
      'patient_id', svc.patient_id
    );

    FOR i IN 0..(blocks-1) LOOP
      block_start_hour := start_hour + (i * block_hours);
      -- Constrói start/end no fuso America/Sao_Paulo de forma explícita.
      start_ts := (_date::timestamp + (block_start_hour || ' hour')::interval) AT TIME ZONE 'America/Sao_Paulo';
      end_ts   := start_ts + (block_hours || ' hour')::interval;

      -- Rótulo do turno: 08 → diurno (day); 20 → noturno (night).
      block_shift_label := CASE
        WHEN (block_start_hour % 24) >= 18 OR (block_start_hour % 24) < 6 THEN 'night'::public.shift_type
        ELSE 'day'::public.shift_type
      END;

      INSERT INTO public.demands (
        contract_service_id, date, start_time, end_time, job_type,
        hours_required, slots_required, weekend, shift_type,
        block_index, plan_snapshot, patient_id, crew_size
      ) VALUES (
        svc.id, _date, start_ts, end_ts, svc.service_type,
        block_hours, crew, is_weekend,
        block_shift_label,
        i, snapshot, svc.patient_id, crew
      ) RETURNING id INTO new_demand_id;

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
END $function$;