
CREATE OR REPLACE FUNCTION public.worker_has_acceptance_for_offer(_user_id uuid, _offer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_acceptances a
    JOIN public.workers w ON w.id = a.worker_id
    WHERE a.offer_id = _offer_id AND w.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "offers worker accepted read" ON public.shift_offers;
CREATE POLICY "offers worker accepted read"
ON public.shift_offers FOR SELECT TO authenticated
USING (public.worker_has_acceptance_for_offer(auth.uid(), id));

CREATE OR REPLACE FUNCTION public.company_owns_offer(_user_id uuid, _offer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_offers o
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE o.id = _offer_id AND c.owner_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "acceptances owner read" ON public.shift_acceptances;
CREATE POLICY "acceptances owner read"
ON public.shift_acceptances FOR SELECT TO authenticated
USING (public.company_owns_offer(auth.uid(), offer_id));
