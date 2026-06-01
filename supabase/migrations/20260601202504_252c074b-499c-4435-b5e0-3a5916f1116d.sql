
-- Per-candidate decisions log (one row per URL the agent considered)
CREATE TABLE public.agent_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  description text,
  decision text NOT NULL CHECK (decision IN ('added','flagged','skipped','error')),
  reason text NOT NULL,
  extracted jsonb,
  conference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_candidates_run_id_idx ON public.agent_candidates(run_id);

GRANT SELECT, INSERT ON public.agent_candidates TO authenticated;
GRANT SELECT, INSERT ON public.agent_candidates TO anon;
GRANT ALL ON public.agent_candidates TO service_role;

ALTER TABLE public.agent_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read agent_candidates" ON public.agent_candidates
  FOR SELECT USING (true);
CREATE POLICY "public write agent_candidates" ON public.agent_candidates
  FOR INSERT WITH CHECK (true);

-- Run metrics: duration + token usage
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS prompt_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tokens integer DEFAULT 0;
