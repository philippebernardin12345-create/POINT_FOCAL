-- POINT FOCAL V10.6
-- Follow Me + Roll-Up foundation
--
-- Garantit une seule participation par utilisateur et opportunité.
-- Ajoute le journal nécessaire au moteur de Roll-Up.

BEGIN;

ALTER TABLE public.user_opportunities
  ADD CONSTRAINT user_opportunities_user_opportunity_unique
  UNIQUE (user_id, opportunity_id);

CREATE TABLE IF NOT EXISTS public.rollup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  original_sponsor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rollup_parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollup_logs_user_id
  ON public.rollup_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_rollup_logs_opportunity_id
  ON public.rollup_logs(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_rollup_logs_created_at
  ON public.rollup_logs(created_at);

COMMIT;
