-- Security definer helpers to break RLS recursion between clients/contracts/contract_services
CREATE OR REPLACE FUNCTION public.worker_has_accepted_for_client(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shift_acceptances a
    JOIN public.workers w ON w.id = a.worker_id
    JOIN public.shift_offers o ON o.id = a.offer_id
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    WHERE w.user_id = _user_id AND ct.client_id = _client_id
  )
$$;

CREATE OR REPLACE FUNCTION public.worker_has_accepted_for_contract(_user_id uuid, _contract_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shift_acceptances a
    JOIN public.workers w ON w.id = a.worker_id
    JOIN public.shift_offers o ON o.id = a.offer_id
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    WHERE w.user_id = _user_id AND cs.contract_id = _contract_id
  )
$$;

CREATE OR REPLACE FUNCTION public.worker_has_accepted_for_contract_service(_user_id uuid, _cs_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shift_acceptances a
    JOIN public.workers w ON w.id = a.worker_id
    JOIN public.shift_offers o ON o.id = a.offer_id
    JOIN public.demands d ON d.id = o.demand_id
    WHERE w.user_id = _user_id AND d.contract_service_id = _cs_id
  )
$$;

-- Replace recursive policies
DROP POLICY IF EXISTS "clients worker accepted read" ON public.clients;
CREATE POLICY "clients worker accepted read" ON public.clients
  FOR SELECT TO authenticated
  USING (public.worker_has_accepted_for_client(auth.uid(), id));

DROP POLICY IF EXISTS "contracts worker accepted read" ON public.contracts;
CREATE POLICY "contracts worker accepted read" ON public.contracts
  FOR SELECT TO authenticated
  USING (public.worker_has_accepted_for_contract(auth.uid(), id));

DROP POLICY IF EXISTS "contract_services worker accepted read" ON public.contract_services;
CREATE POLICY "contract_services worker accepted read" ON public.contract_services
  FOR SELECT TO authenticated
  USING (public.worker_has_accepted_for_contract_service(auth.uid(), id));