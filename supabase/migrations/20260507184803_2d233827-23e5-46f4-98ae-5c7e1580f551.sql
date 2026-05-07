
-- ============================================================
-- Motor de Distribuição de Ofertas (Prova de Vida)
-- Adiciona parametrização de plano, times e waves de oferta.
-- ============================================================

-- 1) contract_services: plano + créditos + personalização
ALTER TABLE public.contract_services
  ADD COLUMN IF NOT EXISTS plan_level text NOT NULL DEFAULT 'plano1'
    CHECK (plan_level IN ('plano1','plano2','plano3')),
  ADD COLUMN IF NOT EXISTS credits_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS padding_days integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS personalization jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.contract_services.credits_days IS 'Janela base em dias (30/90/180). Total efetivo = credits_days + padding_days.';
COMMENT ON COLUMN public.contract_services.padding_days IS 'Dias de folga/buffer (p) somados à janela base.';
COMMENT ON COLUMN public.contract_services.personalization IS 'Overrides por contrato: prio_impar, prio_par, folguistas_ativos, blocos.';

-- 2) workers: time/equipe (Start_Impar, Start_Par, FolguistaStart_Impar, FolguistaStart_Par)
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS team text
    CHECK (team IN ('start_impar','start_par','folguista_impar','folguista_par'));

-- 3) shift_offers: wave para distribuição em ondas (1=Folguistas FDS, 2=Start)
ALTER TABLE public.shift_offers
  ADD COLUMN IF NOT EXISTS wave integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS eligible_teams text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS opens_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.shift_offers.wave IS '1=primeira onda (folguistas FDS antecipado), 2=segunda onda (Start_*).';
COMMENT ON COLUMN public.shift_offers.eligible_teams IS 'Times elegíveis nesta wave. Vazio = todos.';

-- 4) demands: bloco (para decomposição de 24h em 2x12h)
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS block_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.demands.plan_snapshot IS 'Snapshot da política aplicada (plano, paridade, slots base, folguistas, waves).';

-- 5) RPC reescrita: gera demandas + ofertas com waves e times por plano
CREATE OR REPLACE FUNCTION public.generate_shifts_for_date(_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  svc record;
  new_demand_id uuid;
  cnt int := 0;
  is_weekend boolean := EXTRACT(DOW FROM _date) IN (0,6);
  is_odd boolean := (EXTRACT(DAY FROM _date)::int % 2) = 1;
  parity_label text := CASE WHEN is_odd THEN 'impar' ELSE 'par' END;
  -- política
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
  fds_open_ts timestamptz; -- ofertas FDS abrem com antecedência
BEGIN
  FOR svc IN
    SELECT cs.id, cs.service_type, cs.hours_per_day, cs.min_workers, cs.rules,
           cs.plan_level, cs.credits_days, cs.padding_days, cs.personalization
    FROM public.contract_services cs
    JOIN public.contracts ct ON ct.id = cs.contract_id
    WHERE ct.status = 'active'
      AND _date BETWEEN ct.start_date AND ct.end_date
  LOOP
    -- regra de fim de semana
    IF is_weekend AND COALESCE((svc.rules->>'weekend')::boolean, true) = false THEN CONTINUE; END IF;

    -- skip se já existe
    IF EXISTS (SELECT 1 FROM public.demands WHERE contract_service_id = svc.id AND date = _date) THEN CONTINUE; END IF;

    -- política por plano (defaults; personalization sobrescreve)
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
    ELSE -- plano3
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
        svc.id, _date, start_ts, end_ts, svc.service_type::job_type,
        block_hours, total_slots, is_weekend,
        CASE WHEN block_hours >= 12 THEN 'night'::shift_type ELSE 'day'::shift_type END,
        i, snapshot
      ) RETURNING id INTO new_demand_id;

      -- WAVE 1: folguistas (abrem antes, sobretudo FDS)
      INSERT INTO public.shift_offers (demand_id, slots_total, wave, eligible_teams, opens_at)
      VALUES (
        new_demand_id, folguista_slots, 1,
        ARRAY[folguista_team],
        CASE WHEN is_weekend THEN fds_open_ts ELSE now() END
      );

      -- WAVE 2: Start (prioritário da paridade) — abre após folguista
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
END $$;

-- 6) Visibilidade de ofertas para workers passa a respeitar team + opens_at
DROP POLICY IF EXISTS "offers workers read" ON public.shift_offers;
CREATE POLICY "offers workers read" ON public.shift_offers
FOR SELECT TO authenticated
USING (
  status = 'open'::offer_status
  AND has_role(auth.uid(), 'worker'::app_role)
  AND opens_at <= now()
  AND (
    cardinality(eligible_teams) = 0
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.user_id = auth.uid() AND w.team = ANY(eligible_teams)
    )
  )
);
