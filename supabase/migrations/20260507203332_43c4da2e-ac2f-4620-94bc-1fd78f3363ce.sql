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
  prio_team text;
  folguista_team text;
  base_slots int;
  folguista_slots int;
  total_slots int;
  blocks int;
  block_hours int;
  i int;
  start_ts timestamptz;
  end_ts timestamptz;
  snapshot jsonb;
  fds_open_ts timestamptz;
BEGIN
  FOR svc IN
    SELECT cs.id, cs.service_type, cs.hours_per_day, cs.min_workers, cs.rules,
           cs.plan_level, cs.credits_days, cs.padding_days, cs.personalization
    FROM public.contract_services cs
    JOIN public.contracts ct ON ct.id = cs.contract_id
    WHERE ct.status = 'active'
      AND _date BETWEEN ct.start_date AND ct.end_date
  LOOP
    IF is_weekend AND COALESCE((svc.rules->>'weekend')::boolean, true) = false THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.demands WHERE contract_service_id = svc.id AND date = _date) THEN CONTINUE; END IF;

    prio_team := 'start_' || parity_label;
    folguista_team := 'folguista_' || parity_label;

    IF svc.plan_level = 'plano1' THEN
      base_slots := COALESCE((svc.personalization->>'prio_per_parity')::int, 1);
      folguista_slots := COALESCE((svc.personalization->>'folguistas_ativos')::int, 2);
      blocks := 1;
      block_hours := COALESCE(svc.hours_per_day, 12);
    ELSIF svc.plan_level = 'plano2' THEN
      base_slots := COALESCE((svc.personalization->>'prio_per_parity')::int, 2);
      folguista_slots := COALESCE((svc.personalization->>'folguistas_ativos')::int, 4);
      blocks := COALESCE((svc.personalization->>'blocks')::int, 2);
      block_hours := COALESCE(svc.hours_per_day, 24) / GREATEST(blocks,1);
    ELSE
      base_slots := COALESCE((svc.personalization->>'prio_per_parity')::int, 1);
      folguista_slots := COALESCE((svc.personalization->>'folguistas_ativos')::int, 2);
      blocks := 1;
      block_hours := COALESCE(svc.hours_per_day, 4);
    END IF;

    total_slots := GREATEST(svc.min_workers, base_slots + folguista_slots);
    fds_open_ts := (_date::timestamp - interval '7 days') AT TIME ZONE 'America/Sao_Paulo';

    snapshot := jsonb_build_object(
      'plan_level', svc.plan_level,
      'parity', parity_label,
      'is_weekend', is_weekend,
      'prio_team', prio_team,
      'folguista_team', folguista_team,
      'base_slots', base_slots,
      'folguista_slots', folguista_slots,
      'total_slots', total_slots,
      'blocks', blocks,
      'block_hours', block_hours,
      'credits_days', svc.credits_days,
      'padding_days', svc.padding_days
    );

    FOR i IN 0..(blocks-1) LOOP
      start_ts := (_date::timestamp + interval '8 hour' + (i * block_hours || ' hour')::interval) AT TIME ZONE 'America/Sao_Paulo';
      end_ts := start_ts + (block_hours || ' hour')::interval;

      INSERT INTO public.demands (
        contract_service_id, date, start_time, end_time, job_type,
        hours_required, slots_required, weekend, shift_type,
        block_index, plan_snapshot
      ) VALUES (
        svc.id, _date, start_ts, end_ts, svc.service_type,
        block_hours, total_slots, is_weekend,
        CASE WHEN block_hours >= 12 THEN 'night'::public.shift_type ELSE 'day'::public.shift_type END,
        i, snapshot
      ) RETURNING id INTO new_demand_id;

      INSERT INTO public.shift_offers (demand_id, slots_total, wave, eligible_teams, opens_at)
      VALUES (
        new_demand_id, folguista_slots, 1,
        ARRAY[folguista_team],
        CASE WHEN is_weekend THEN fds_open_ts ELSE now() END
      );

      INSERT INTO public.shift_offers (demand_id, slots_total, wave, eligible_teams, opens_at)
      VALUES (
        new_demand_id, base_slots, 2,
        ARRAY[prio_team],
        now() + interval '1 hour'
      );

      cnt := cnt + 1;
    END LOOP;
  END LOOP;
  RETURN cnt;
END $function$;

-- Seed
DO $$
DECLARE
  _owner uuid;
  _client uuid;
  _contract uuid;
  _today date := CURRENT_DATE;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'test-plans@umbrella.local', crypt('test12345', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"company"}'::jsonb,
    false, false
  ) RETURNING id INTO _owner;

  INSERT INTO public.clients (owner_id, name) VALUES (_owner, 'TEST CLIENT P-PLANS') RETURNING id INTO _client;
  INSERT INTO public.contracts (client_id, name, start_date, end_date, status)
    VALUES (_client, 'TEST CONTRACT', _today - 1, _today + 30, 'active') RETURNING id INTO _contract;

  INSERT INTO public.contract_services (contract_id, service_type, hours_per_day, min_workers, price_per_hour, plan_level)
    VALUES (_contract, 'chat',  12, 4, 35, 'plano1'),
           (_contract, 'voice', 24, 8, 40, 'plano2'),
           (_contract, 'visit',  4, 4, 50, 'plano3');
END $$;

SELECT public.generate_shifts_for_date(CURRENT_DATE) AS demands_created;