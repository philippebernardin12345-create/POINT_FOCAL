/*
 * POINT FOCAL S1 — Inactivité confirmée par opportunité
 *
 * Invariant : une inactivité métier appartient à un utilisateur DANS un
 * business/opportunité. Elle ne modifie ni users.status ni la racine
 * structurelle globale.
 */

CREATE TABLE IF NOT EXISTS opportunity_inactivity_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'reported'
    CHECK (state IN ('reported', 'confirmed', 'rejected', 'restored')),
  reported_at timestamptz NOT NULL DEFAULT NOW(),
  checked_at timestamptz NULL,
  confirmed_at timestamptz NULL,
  restored_at timestamptz NULL,
  verification_method text NULL,
  verification_detail text NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_inactivity_confirmed
  ON opportunity_inactivity_confirmations (opportunity_id, user_id)
  WHERE state = 'confirmed';

COMMENT ON TABLE opportunity_inactivity_confirmations IS
  'Signalement et confirmation d inactivité d un compte dans une opportunité; ne change jamais la racine structurelle POINT FOCAL.';
