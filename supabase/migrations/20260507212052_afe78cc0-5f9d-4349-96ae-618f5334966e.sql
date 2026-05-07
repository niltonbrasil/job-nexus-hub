
CREATE OR REPLACE FUNCTION public.worker_can_see_demand(_user_id uuid, _demand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.demands d
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.company_worker_memberships m ON m.client_id = ct.client_id
    JOIN public.workers w ON w.id = m.worker_id
    WHERE d.id = _demand_id
      AND m.status = 'active'
      AND (m.certification_valid_until IS NULL OR m.certification_valid_until >= CURRENT_DATE)
      AND w.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "demands workers read open" ON public.demands;

CREATE POLICY "demands workers read open"
ON public.demands
FOR SELECT
TO authenticated
USING (
  status IN ('open'::demand_status, 'partially_filled'::demand_status)
  AND has_role(auth.uid(), 'worker'::app_role)
  AND public.worker_can_see_demand(auth.uid(), id)
);

-- Same fix for shift_offers worker read policy
CREATE OR REPLACE FUNCTION public.worker_can_see_offer(_user_id uuid, _offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shift_offers o
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.company_worker_memberships m ON m.client_id = ct.client_id
    JOIN public.workers w2 ON w2.id = m.worker_id
    WHERE o.id = _offer_id
      AND m.status = 'active'
      AND (m.certification_valid_until IS NULL OR m.certification_valid_until >= CURRENT_DATE)
      AND w2.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "offers workers read" ON public.shift_offers;

CREATE POLICY "offers workers read"
ON public.shift_offers
FOR SELECT
TO authenticated
USING (
  status = 'open'::offer_status
  AND has_role(auth.uid(), 'worker'::app_role)
  AND opens_at <= now()
  AND (
    cardinality(eligible_teams) = 0
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.user_id = auth.uid() AND w.team = ANY (shift_offers.eligible_teams)
    )
  )
  AND public.worker_can_see_offer(auth.uid(), id)
);
