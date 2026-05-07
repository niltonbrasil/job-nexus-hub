
CREATE OR REPLACE FUNCTION public.worker_has_acceptance_for_demand(_user_id uuid, _demand_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_acceptances a
    JOIN public.shift_offers o ON o.id = a.offer_id
    JOIN public.workers w ON w.id = a.worker_id
    WHERE o.demand_id = _demand_id AND w.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "demands worker accepted read" ON public.demands;
CREATE POLICY "demands worker accepted read"
ON public.demands FOR SELECT TO authenticated
USING (public.worker_has_acceptance_for_demand(auth.uid(), id));
