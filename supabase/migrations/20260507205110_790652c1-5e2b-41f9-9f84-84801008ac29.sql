-- ENUMS
CREATE TYPE public.membership_status AS ENUM ('invited','requested','active','revoked');
CREATE TYPE public.crew_role AS ENUM ('linha_impar','linha_par','folguista_1','folguista_2');

-- PROFESSIONS
CREATE TABLE public.professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "professions read all" ON public.professions FOR SELECT TO authenticated USING (true);

INSERT INTO public.professions (code, name) VALUES
  ('enfermeiro','Enfermeiro'),
  ('tecnico_enfermagem','Técnico de Enfermagem'),
  ('auxiliar_enfermagem','Auxiliar de Enfermagem'),
  ('medico','Médico'),
  ('cuidador','Cuidador');

-- MEMBERSHIPS (criado antes de patients pois patients refere)
CREATE TABLE public.company_worker_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  profession_id uuid REFERENCES public.professions(id),
  status public.membership_status NOT NULL DEFAULT 'invited',
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  certification_valid_until date,
  certification_doc_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, worker_id)
);
CREATE INDEX idx_membership_client ON public.company_worker_memberships(client_id, status);
CREATE INDEX idx_membership_worker ON public.company_worker_memberships(worker_id, status);

ALTER TABLE public.company_worker_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership company all" ON public.company_worker_memberships FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.owner_id = auth.uid()));

CREATE POLICY "membership worker read" ON public.company_worker_memberships FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()));

CREATE POLICY "membership worker respond" ON public.company_worker_memberships FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid()));

CREATE POLICY "membership worker request" ON public.company_worker_memberships FOR INSERT TO authenticated
WITH CHECK (
  status = 'requested' AND invited_by IS NULL
  AND EXISTS (SELECT 1 FROM public.workers w WHERE w.id = worker_id AND w.user_id = auth.uid())
);

CREATE TRIGGER trg_membership_updated_at BEFORE UPDATE ON public.company_worker_memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PATIENTS
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  cpf text,
  birth_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, cpf)
);
CREATE INDEX idx_patients_client ON public.patients(client_id);
CREATE INDEX idx_patients_cpf ON public.patients(cpf) WHERE cpf IS NOT NULL;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients owner all" ON public.patients FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = patients.client_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = patients.client_id AND c.owner_id = auth.uid()));

CREATE POLICY "patients worker membership read" ON public.patients FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.company_worker_memberships m
  JOIN public.workers w ON w.id = m.worker_id
  WHERE m.client_id = patients.client_id AND m.status = 'active' AND w.user_id = auth.uid()
));

CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- DEMANDS: patient + crew_size
ALTER TABLE public.demands
  ADD COLUMN patient_id uuid REFERENCES public.patients(id),
  ADD COLUMN crew_size int NOT NULL DEFAULT 4;
CREATE INDEX idx_demands_patient ON public.demands(patient_id);

-- ACCEPTANCES: crew_role
ALTER TABLE public.shift_acceptances ADD COLUMN crew_role public.crew_role;

-- TRIGGER conflito 1 worker x 1 CPF em janela 12h
CREATE OR REPLACE FUNCTION public.check_worker_patient_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_patient uuid;
  new_start timestamptz;
  new_end timestamptz;
  conflict_count int;
BEGIN
  SELECT d.patient_id, d.start_time, d.end_time
  INTO new_patient, new_start, new_end
  FROM public.shift_offers o
  JOIN public.demands d ON d.id = o.demand_id
  WHERE o.id = NEW.offer_id;

  IF new_patient IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO conflict_count
  FROM public.shift_acceptances a
  JOIN public.shift_offers o2 ON o2.id = a.offer_id
  JOIN public.demands d2 ON d2.id = o2.demand_id
  WHERE a.worker_id = NEW.worker_id
    AND a.status = 'accepted'
    AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND d2.patient_id IS NOT NULL
    AND d2.patient_id <> new_patient
    AND tstzrange(d2.start_time - interval '12 hour', d2.end_time + interval '12 hour', '[)')
        && tstzrange(new_start, new_end, '[)');

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflito: profissional já alocado para outro paciente em janela de 12h'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_check_patient_conflict
  BEFORE INSERT ON public.shift_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.check_worker_patient_conflict();

-- GATE membership ativa para ver ofertas
DROP POLICY IF EXISTS "offers workers read" ON public.shift_offers;
CREATE POLICY "offers workers read" ON public.shift_offers FOR SELECT TO authenticated
USING (
  status = 'open'::offer_status
  AND has_role(auth.uid(), 'worker'::app_role)
  AND opens_at <= now()
  AND (cardinality(eligible_teams) = 0 OR EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.user_id = auth.uid() AND w.team = ANY (shift_offers.eligible_teams)
  ))
  AND EXISTS (
    SELECT 1
    FROM public.demands d
    JOIN public.contract_services cs ON cs.id = d.contract_service_id
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.company_worker_memberships m ON m.client_id = ct.client_id
    JOIN public.workers w2 ON w2.id = m.worker_id
    WHERE d.id = shift_offers.demand_id
      AND m.status = 'active'
      AND (m.certification_valid_until IS NULL OR m.certification_valid_until >= CURRENT_DATE)
      AND w2.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "demands workers read open" ON public.demands;
CREATE POLICY "demands workers read open" ON public.demands FOR SELECT TO authenticated
USING (
  status IN ('open'::demand_status, 'partially_filled'::demand_status)
  AND has_role(auth.uid(), 'worker'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.contract_services cs
    JOIN public.contracts ct ON ct.id = cs.contract_id
    JOIN public.company_worker_memberships m ON m.client_id = ct.client_id
    JOIN public.workers w ON w.id = m.worker_id
    WHERE cs.id = demands.contract_service_id
      AND m.status = 'active'
      AND (m.certification_valid_until IS NULL OR m.certification_valid_until >= CURRENT_DATE)
      AND w.user_id = auth.uid()
  )
);