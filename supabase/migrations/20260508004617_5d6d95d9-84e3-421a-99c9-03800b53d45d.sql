ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS shift_preference text NOT NULL DEFAULT 'any'
  CHECK (shift_preference IN ('any','day','night'));

CREATE OR REPLACE FUNCTION public.worker_can_see_offer(_user_id uuid, _offer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND (w2.shift_preference = 'any' OR w2.shift_preference::text = d.shift_type::text)
  )
$function$;

CREATE OR REPLACE FUNCTION public.worker_can_see_demand(_user_id uuid, _demand_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND (w.shift_preference = 'any' OR w.shift_preference::text = d.shift_type::text)
  )
$function$;