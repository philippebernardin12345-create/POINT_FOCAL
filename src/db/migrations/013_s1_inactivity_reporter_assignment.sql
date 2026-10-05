-- S1 — Signalement d'inactivité : distinguer le signaleur du compte signalé.
-- Migration additive : aucune généalogie, aucun sponsor structurel et aucune racine ne sont modifiés.

ALTER TABLE public.opportunity_inactivity_confirmations
  ADD COLUMN IF NOT EXISTS reporter_user_id uuid NULL
    REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.opportunity_inactivity_confirmations
  ADD COLUMN IF NOT EXISTS assigned_referral_link text NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_inactivity_reporter
  ON public.opportunity_inactivity_confirmations (reporter_user_id, opportunity_id);

COMMENT ON COLUMN public.opportunity_inactivity_confirmations.user_id IS
  'Compte destinataire signalé comme potentiellement indisponible dans cette opportunité.';

COMMENT ON COLUMN public.opportunity_inactivity_confirmations.reporter_user_id IS
  'Utilisateur ayant reçu le placement/lien et ayant effectué le signalement.';

COMMENT ON COLUMN public.opportunity_inactivity_confirmations.assigned_referral_link IS
  'Lien public du compte destinataire effectivement vérifié par POINT FOCAL.';
