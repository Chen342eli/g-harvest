UPDATE public.conferences SET vertical = 'Travel Tech' WHERE vertical = 'Travel';
UPDATE public.conferences SET vertical = 'Fintech' WHERE vertical IN ('SaaS', 'General Tech');