
CREATE TYPE public.conf_provenance AS ENUM ('verified', 'ai_added');
CREATE TYPE public.conf_decision_status AS ENUM ('Considering', 'Going', 'Passed');

CREATE TABLE public.conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  vertical TEXT NOT NULL,
  estimated_audience_size INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_url TEXT NOT NULL,
  sub_vertical_fit INTEGER NOT NULL DEFAULT 50,
  sub_decision_maker_presence INTEGER NOT NULL DEFAULT 50,
  sub_audience_quality INTEGER NOT NULL DEFAULT 50,
  sub_accessibility INTEGER NOT NULL DEFAULT 50,
  sub_past_performance INTEGER NOT NULL DEFAULT 50,
  icp_score INTEGER NOT NULL DEFAULT 50,
  tier TEXT NOT NULL DEFAULT 'Tier 3',
  assigned_reps TEXT[] NOT NULL DEFAULT '{}',
  status public.conf_decision_status NOT NULL DEFAULT 'Considering',
  provenance public.conf_provenance NOT NULL DEFAULT 'ai_added',
  confidence INTEGER,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX conferences_dedup_idx
  ON public.conferences (lower(name), EXTRACT(YEAR FROM start_date), lower(city))
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conferences TO anon, authenticated;
GRANT ALL ON public.conferences TO service_role;
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read conferences" ON public.conferences FOR SELECT USING (true);
CREATE POLICY "public write conferences" ON public.conferences FOR INSERT WITH CHECK (true);
CREATE POLICY "public update conferences" ON public.conferences FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete conferences" ON public.conferences FOR DELETE USING (true);

CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  found_count INTEGER NOT NULL DEFAULT 0,
  added_count INTEGER NOT NULL DEFAULT 0,
  flagged_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  trigger TEXT NOT NULL DEFAULT 'manual'
);
GRANT SELECT, INSERT, UPDATE ON public.agent_runs TO anon, authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read agent_runs" ON public.agent_runs FOR SELECT USING (true);
CREATE POLICY "public write agent_runs" ON public.agent_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "public update agent_runs" ON public.agent_runs FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.conference_change_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conference_change_flags TO anon, authenticated;
GRANT ALL ON public.conference_change_flags TO service_role;
ALTER TABLE public.conference_change_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read flags" ON public.conference_change_flags FOR SELECT USING (true);
CREATE POLICY "public write flags" ON public.conference_change_flags FOR INSERT WITH CHECK (true);
CREATE POLICY "public update flags" ON public.conference_change_flags FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete flags" ON public.conference_change_flags FOR DELETE USING (true);

CREATE TABLE public.do_not_resurrect (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_lower TEXT NOT NULL,
  year INTEGER NOT NULL,
  city_lower TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name_lower, year, city_lower)
);
GRANT SELECT, INSERT, DELETE ON public.do_not_resurrect TO anon, authenticated;
GRANT ALL ON public.do_not_resurrect TO service_role;
ALTER TABLE public.do_not_resurrect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read dnr" ON public.do_not_resurrect FOR SELECT USING (true);
CREATE POLICY "public write dnr" ON public.do_not_resurrect FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete dnr" ON public.do_not_resurrect FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER conferences_touch BEFORE UPDATE ON public.conferences
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.conferences
(name, start_date, end_date, city, country, region, vertical, estimated_audience_size, tags, source_url,
 sub_vertical_fit, sub_decision_maker_presence, sub_audience_quality, sub_accessibility, sub_past_performance,
 icp_score, tier, provenance)
VALUES
('Money20/20 USA','2026-10-18','2026-10-21','Las Vegas','USA','North America','Payments',11000,
 ARRAY['payments','fintech','C-suite'],'https://us.money2020.com/',
 90,85,90,70,50,83,'Tier 1','verified'),
('Money20/20 Europe','2026-06-02','2026-06-04','Amsterdam','Netherlands','Europe','Payments',8000,
 ARRAY['payments','fintech','banking'],'https://europe.money2020.com/',
 90,85,85,85,50,84,'Tier 1','verified'),
('Money20/20 Asia','2026-04-21','2026-04-23','Bangkok','Thailand','APAC','Fintech',3000,
 ARRAY['fintech','payments','APAC'],'https://asia.money2020.com/',
 85,75,70,55,50,74,'Tier 1','verified'),
('EuroFinance International Treasury Management','2026-09-16','2026-09-18','Barcelona','Spain','Europe','Treasury',2600,
 ARRAY['treasury','cash management','CFO'],'https://www.eurofinance.com/international-treasury-event/',
 95,95,80,85,50,87,'Tier 1','verified'),
('Sibos','2026-09-28','2026-10-01','Miami','USA','North America','Payments',10000,
 ARRAY['banking','payments','SWIFT'],'https://www.sibos.com/',
 85,85,85,70,50,80,'Tier 1','verified');
