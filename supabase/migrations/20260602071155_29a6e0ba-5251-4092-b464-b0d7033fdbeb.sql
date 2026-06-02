-- 1. Planning status enum
CREATE TYPE public.plan_item_status AS ENUM (
  'must_go',
  'shortlist',
  'considering',
  'approved',
  'dropped'
);

CREATE TYPE public.cost_confidence AS ENUM (
  'estimated',
  'quoted',
  'actual'
);

-- 2. Cost fields on conferences
ALTER TABLE public.conferences
  ADD COLUMN estimated_cost_usd numeric(10, 2),
  ADD COLUMN cost_confidence public.cost_confidence,
  ADD COLUMN cost_notes text;

-- 3. plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  annual_budget_usd numeric(12, 2) NOT NULL DEFAULT 0,
  planned_reps_per_conference integer NOT NULL DEFAULT 1 CHECK (planned_reps_per_conference >= 1),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- Only one active plan at a time
CREATE UNIQUE INDEX plans_one_active_idx ON public.plans (is_active) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "public write plans" ON public.plans FOR INSERT WITH CHECK (true);
CREATE POLICY "public update plans" ON public.plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete plans" ON public.plans FOR DELETE USING (true);

CREATE TRIGGER plans_touch_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. plan_items table
CREATE TABLE public.plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  conference_id uuid NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  plan_status public.plan_item_status NOT NULL DEFAULT 'shortlist',
  planned_reps_override integer CHECK (planned_reps_override IS NULL OR planned_reps_override >= 1),
  estimated_cost_override numeric(10, 2),
  must_go_locked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, conference_id)
);

CREATE INDEX plan_items_plan_idx ON public.plan_items (plan_id);
CREATE INDEX plan_items_conference_idx ON public.plan_items (conference_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_items TO anon, authenticated;
GRANT ALL ON public.plan_items TO service_role;

ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read plan_items" ON public.plan_items FOR SELECT USING (true);
CREATE POLICY "public write plan_items" ON public.plan_items FOR INSERT WITH CHECK (true);
CREATE POLICY "public update plan_items" ON public.plan_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete plan_items" ON public.plan_items FOR DELETE USING (true);

CREATE TRIGGER plan_items_touch_updated_at
  BEFORE UPDATE ON public.plan_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger: when plan_status flips to/from must_go, stamp must_go_locked_at
CREATE OR REPLACE FUNCTION public.plan_items_must_go_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_status = 'must_go' AND (OLD.plan_status IS NULL OR OLD.plan_status <> 'must_go') THEN
    NEW.must_go_locked_at := now();
  ELSIF NEW.plan_status <> 'must_go' THEN
    NEW.must_go_locked_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER plan_items_must_go_stamp_trg
  BEFORE INSERT OR UPDATE OF plan_status ON public.plan_items
  FOR EACH ROW EXECUTE FUNCTION public.plan_items_must_go_stamp();

-- 5. Seed Plan 2026 + items from existing conferences
DO $$
DECLARE
  v_plan_id uuid;
BEGIN
  INSERT INTO public.plans (name, year, annual_budget_usd, planned_reps_per_conference, is_active)
  VALUES ('Plan 2026', 2026, 0, 1, true)
  RETURNING id INTO v_plan_id;

  INSERT INTO public.plan_items (plan_id, conference_id, plan_status)
  SELECT
    v_plan_id,
    c.id,
    CASE c.status::text
      WHEN 'Going' THEN 'approved'::public.plan_item_status
      WHEN 'Considering' THEN 'considering'::public.plan_item_status
      WHEN 'Passed' THEN 'dropped'::public.plan_item_status
      ELSE 'shortlist'::public.plan_item_status
    END
  FROM public.conferences c
  WHERE c.deleted_at IS NULL
    AND c.status::text <> 'Needs Review';
END $$;