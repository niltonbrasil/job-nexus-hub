-- Allow workers to read offers and demands they have already accepted,
-- even after the offer/demand status moves away from 'open'.

CREATE POLICY "offers worker accepted read"
ON public.shift_offers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shift_acceptances a
    JOIN public.workers w ON w.id = a.worker_id
    WHERE a.offer_id = shift_offers.id
      AND w.user_id = auth.uid()
  )
);

CREATE POLICY "demands worker accepted read"
ON public.demands
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shift_offers o
    JOIN public.shift_acceptances a ON a.offer_id = o.id
    JOIN public.workers w ON w.id = a.worker_id
    WHERE o.demand_id = demands.id
      AND w.user_id = auth.uid()
  )
);

-- Allow workers to read the contract_services / contracts / clients
-- of demands they accepted (needed for the execution screen header).
CREATE POLICY "contract_services worker accepted read"
ON public.contract_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.demands d
    JOIN public.shift_offers o ON o.demand_id = d.id
    JOIN public.shift_acceptances a ON a.offer_id = o.id
    JOIN public.workers w ON w.id = a.worker_id
    WHERE d.contract_service_id = contract_services.id
      AND w.user_id = auth.uid()
  )
);

CREATE POLICY "contracts worker accepted read"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contract_services cs
    JOIN public.demands d ON d.contract_service_id = cs.id
    JOIN public.shift_offers o ON o.demand_id = d.id
    JOIN public.shift_acceptances a ON a.offer_id = o.id
    JOIN public.workers w ON w.id = a.worker_id
    WHERE cs.contract_id = contracts.id
      AND w.user_id = auth.uid()
  )
);

CREATE POLICY "clients worker accepted read"
ON public.clients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contracts ct
    JOIN public.contract_services cs ON cs.contract_id = ct.id
    JOIN public.demands d ON d.contract_service_id = cs.id
    JOIN public.shift_offers o ON o.demand_id = d.id
    JOIN public.shift_acceptances a ON a.offer_id = o.id
    JOIN public.workers w ON w.id = a.worker_id
    WHERE ct.client_id = clients.id
      AND w.user_id = auth.uid()
  )
);