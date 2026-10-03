-- Lock down TAKATAK hockey membership and parent-premium tables.
-- These records are server-side only. Prisma uses the owner/BYPASSRLS path.
-- The Supabase Data API receives no direct grants or policies for them.

ALTER TABLE public.hockey_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_parent_team_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hockey_memberships FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_stripe_webhook_events FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_parent_team_preferences FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_memberships FROM anon;
    REVOKE ALL ON TABLE public.hockey_stripe_webhook_events FROM anon;
    REVOKE ALL ON TABLE public.hockey_parent_team_preferences FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_memberships FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_stripe_webhook_events FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_parent_team_preferences FROM authenticated;
  END IF;
END $$;
