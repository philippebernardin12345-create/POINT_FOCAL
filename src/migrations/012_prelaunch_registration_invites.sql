BEGIN;

CREATE TABLE IF NOT EXISTS public.prelaunch_registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  claimed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  claimed_at timestamptz
);

CREATE INDEX IF NOT EXISTS prelaunch_registration_invites_available_idx
  ON public.prelaunch_registration_invites (created_at)
  WHERE claimed_at IS NULL;

COMMIT;
