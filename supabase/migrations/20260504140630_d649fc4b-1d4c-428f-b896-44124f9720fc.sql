
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'company', 'worker');
CREATE TYPE public.service_type AS ENUM ('chat', 'voice', 'visit');
CREATE TYPE public.contract_status AS ENUM ('active', 'paused', 'cancelled');
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'weekly');
CREATE TYPE public.demand_status AS ENUM ('open', 'partially_filled', 'filled', 'completed', 'cancelled');
CREATE TYPE public.priority_level AS ENUM ('low', 'normal', 'high');
CREATE TYPE public.parity_type AS ENUM ('odd', 'even', 'none');
CREATE TYPE public.shift_type AS ENUM ('day', 'night');
CREATE TYPE public.offer_status AS ENUM ('open', 'closed');
CREATE TYPE public.acceptance_status AS ENUM ('accepted', 'cancelled', 'no_show');
CREATE TYPE public.acceptance_source AS ENUM ('manual', 'auto');
CREATE TYPE public.proof_type AS ENUM ('photo', 'gps', 'system', 'none');
CREATE TYPE public.worker_type AS ENUM ('freelancer', 'internal');
CREATE TYPE public.worker_status AS ENUM ('active', 'inactive', 'blocked');
CREATE TYPE public.billing_status AS ENUM ('open', 'closed', 'paid');

-- ========== PROFILES & ROLES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer function (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');

  -- Optional default role from metadata (company or worker)
  IF NEW.raw_user_meta_data->>'role' IN ('company','worker') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== CLIENTS (EMPRESAS) ==========
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== WORKERS ==========
CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  type worker_type NOT NULL DEFAULT 'freelancer',
  status worker_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.worker_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  max_hours_per_day INT NOT NULL DEFAULT 8,
  UNIQUE (worker_id, date)
);

CREATE TABLE public.worker_metrics (
  worker_id UUID PRIMARY KEY REFERENCES public.workers(id) ON DELETE CASCADE,
  total_accepted INT NOT NULL DEFAULT 0,
  total_worked INT NOT NULL DEFAULT 0,
  total_no_show INT NOT NULL DEFAULT 0,
  reliability_score NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== CONTRACTS ==========
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  status contract_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER contracts_touch BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.contract_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  service_type service_type NOT NULL,
  hours_per_day INT NOT NULL DEFAULT 8,
  min_workers INT NOT NULL DEFAULT 1,
  price_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== DEMANDS ==========
CREATE TABLE public.demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_service_id UUID NOT NULL REFERENCES public.contract_services(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  job_type service_type NOT NULL,
  hours_required INT NOT NULL DEFAULT 1,
  slots_required INT NOT NULL DEFAULT 1,
  parity_type parity_type NOT NULL DEFAULT 'none',
  weekend BOOLEAN NOT NULL DEFAULT false,
  shift_type shift_type NOT NULL DEFAULT 'day',
  status demand_status NOT NULL DEFAULT 'open',
  priority priority_level NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_demands_status ON public.demands(status);
CREATE INDEX idx_demands_date ON public.demands(date);

CREATE TABLE public.demand_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== OFFERS / ACCEPTANCES / EXECUTIONS ==========
CREATE TABLE public.shift_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  slots_total INT NOT NULL DEFAULT 1,
  slots_filled INT NOT NULL DEFAULT 0,
  status offer_status NOT NULL DEFAULT 'open',
  visibility_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shift_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.shift_offers(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status acceptance_status NOT NULL DEFAULT 'accepted',
  source acceptance_source NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shift_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id UUID NOT NULL REFERENCES public.shift_acceptances(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  checkin_time TIMESTAMPTZ,
  checkout_time TIMESTAMPTZ,
  worked BOOLEAN NOT NULL DEFAULT false,
  hours_worked NUMERIC(6,2) NOT NULL DEFAULT 0,
  proof_type proof_type NOT NULL DEFAULT 'none',
  proof_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.shift_executions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ========== BILLING ==========
CREATE TABLE public.billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status billing_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES public.billings(id) ON DELETE CASCADE,
  demand_id UUID NOT NULL REFERENCES public.demands(id),
  execution_id UUID NOT NULL REFERENCES public.shift_executions(id),
  hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== RLS ==========
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles (read own)
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- clients (owned)
CREATE POLICY "clients owner all" ON public.clients FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- workers
CREATE POLICY "workers self read" ON public.workers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "workers self upsert" ON public.workers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "workers self update" ON public.workers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "workers visible to companies" ON public.workers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'company'));

CREATE POLICY "worker_capacity self all" ON public.worker_capacity FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()));

CREATE POLICY "worker_metrics self read" ON public.worker_metrics FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()));
CREATE POLICY "worker_metrics company read" ON public.worker_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'company'));

-- contracts (via client owner)
CREATE POLICY "contracts owner all" ON public.contracts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.owner_id = auth.uid()));

CREATE POLICY "contract_services owner all" ON public.contract_services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts ct JOIN public.clients c ON c.id = ct.client_id
    WHERE ct.id = contract_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts ct JOIN public.clients c ON c.id = ct.client_id
    WHERE ct.id = contract_id AND c.owner_id = auth.uid()));

-- demands: owner full / workers read open
CREATE POLICY "demands owner all" ON public.demands FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contract_services cs
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE cs.id = contract_service_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contract_services cs
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE cs.id = contract_service_id AND c.owner_id = auth.uid()));

CREATE POLICY "demands workers read open" ON public.demands FOR SELECT TO authenticated
  USING (status IN ('open','partially_filled') AND public.has_role(auth.uid(), 'worker'));

CREATE POLICY "demand_logs owner read" ON public.demand_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.demands d
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE d.id = demand_id AND c.owner_id = auth.uid()));

-- offers: workers read open, owners full
CREATE POLICY "offers workers read" ON public.shift_offers FOR SELECT TO authenticated
  USING (status = 'open' AND public.has_role(auth.uid(), 'worker'));
CREATE POLICY "offers owner all" ON public.shift_offers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.demands d
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE d.id = demand_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.demands d
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE d.id = demand_id AND c.owner_id = auth.uid()));

-- acceptances: worker self
CREATE POLICY "acceptances worker self" ON public.shift_acceptances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()));
CREATE POLICY "acceptances owner read" ON public.shift_acceptances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shift_offers o
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE o.id = offer_id AND c.owner_id = auth.uid()));

-- executions: worker self
CREATE POLICY "executions worker self" ON public.shift_executions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()));
CREATE POLICY "executions owner read" ON public.shift_executions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shift_acceptances a
    JOIN public.shift_offers o ON o.id = a.offer_id
    JOIN public.demands d ON d.id = o.demand_id
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE a.id = acceptance_id AND c.owner_id = auth.uid()));

CREATE POLICY "execution_events worker self" ON public.execution_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shift_executions e
    JOIN public.workers w ON w.id = e.worker_id
    WHERE e.id = execution_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shift_executions e
    JOIN public.workers w ON w.id = e.worker_id
    WHERE e.id = execution_id AND w.user_id = auth.uid()));

-- billings: owner only
CREATE POLICY "billings owner all" ON public.billings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts ct JOIN public.clients c ON c.id = ct.client_id
    WHERE ct.id = contract_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts ct JOIN public.clients c ON c.id = ct.client_id
    WHERE ct.id = contract_id AND c.owner_id = auth.uid()));

CREATE POLICY "billing_items owner all" ON public.billing_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.billings b
    JOIN public.contracts ct ON ct.id = b.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE b.id = billing_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.billings b
    JOIN public.contracts ct ON ct.id = b.contract_id
    JOIN public.clients c ON c.id = ct.client_id
    WHERE b.id = billing_id AND c.owner_id = auth.uid()));
