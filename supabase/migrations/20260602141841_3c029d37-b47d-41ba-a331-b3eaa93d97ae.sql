ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_status_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_status_check CHECK (status IN ('draft','approved'));

UPDATE public.plans SET status = 'draft' WHERE status IS NULL;