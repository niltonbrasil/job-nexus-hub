ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS accepts_weekdays boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_weekends boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekends_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parity_scope text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS crew_role text NOT NULL DEFAULT 'line',
  ADD COLUMN IF NOT EXISTS line_parity_preference text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS weekend_offer_advance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_hours_per_day integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS operations_profile_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.workers
  DROP CONSTRAINT IF EXISTS workers_parity_scope_chk,
  DROP CONSTRAINT IF EXISTS workers_crew_role_chk,
  DROP CONSTRAINT IF EXISTS workers_line_parity_chk,
  DROP CONSTRAINT IF EXISTS workers_max_hours_chk;

ALTER TABLE public.workers
  ADD CONSTRAINT workers_parity_scope_chk CHECK (parity_scope IN ('odd','even','any')),
  ADD CONSTRAINT workers_crew_role_chk CHECK (crew_role IN ('line','reserve')),
  ADD CONSTRAINT workers_line_parity_chk CHECK (line_parity_preference IN ('odd','even','any')),
  ADD CONSTRAINT workers_max_hours_chk CHECK (max_hours_per_day BETWEEN 1 AND 24);