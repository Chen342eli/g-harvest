DELETE FROM public.agent_candidates;
DELETE FROM public.conference_change_flags;
DELETE FROM public.agent_runs;
DELETE FROM public.conferences WHERE provenance = 'ai_added';