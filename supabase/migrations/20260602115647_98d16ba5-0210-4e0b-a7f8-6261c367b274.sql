
-- Drop all permissive "public" policies and revoke grants from anon/authenticated.
-- All app access goes through server functions using the service_role key,
-- which bypasses RLS, so dropping these policies is safe.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'conferences','plans','plan_items','agent_runs',
        'agent_candidates','conference_change_flags','do_not_resurrect'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON public.conferences FROM anon, authenticated;
REVOKE ALL ON public.plans FROM anon, authenticated;
REVOKE ALL ON public.plan_items FROM anon, authenticated;
REVOKE ALL ON public.agent_runs FROM anon, authenticated;
REVOKE ALL ON public.agent_candidates FROM anon, authenticated;
REVOKE ALL ON public.conference_change_flags FROM anon, authenticated;
REVOKE ALL ON public.do_not_resurrect FROM anon, authenticated;

GRANT ALL ON public.conferences TO service_role;
GRANT ALL ON public.plans TO service_role;
GRANT ALL ON public.plan_items TO service_role;
GRANT ALL ON public.agent_runs TO service_role;
GRANT ALL ON public.agent_candidates TO service_role;
GRANT ALL ON public.conference_change_flags TO service_role;
GRANT ALL ON public.do_not_resurrect TO service_role;
