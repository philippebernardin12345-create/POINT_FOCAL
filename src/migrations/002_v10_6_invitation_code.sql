BEGIN;

-- Nouveau modèle V10.6 : un seul code d'invitation par utilisateur
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS invitation_code TEXT;

-- Migration des anciens codes :
-- la série 1 devient le code canonique.
UPDATE public.users
SET invitation_code = invitation_code_series_1
WHERE invitation_code IS NULL
  AND invitation_code_series_1 IS NOT NULL;

-- Empêche deux utilisateurs de posséder le même code.
CREATE UNIQUE INDEX IF NOT EXISTS users_invitation_code_unique_idx
ON public.users (invitation_code)
WHERE invitation_code IS NOT NULL;

COMMIT;
