-- =============================================================================
-- Migration 001 : V10.6 Step 1 — Fondation persistante
-- Non destructive : aucune table/colonne legacy n'est supprimée ou modifiée.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table schema_migrations — suivi des versions appliquées
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version   TEXT        NOT NULL,
  filename  TEXT        NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schema_migrations_pkey    PRIMARY KEY (version),
  CONSTRAINT schema_migrations_filename UNIQUE (filename)
);

-- ---------------------------------------------------------------------------
-- 2. Table v106_runtime_state — singleton persistant de phase
--
-- leader_count est calculé dynamiquement via is_leader (colonne réelle).
-- La valeur initiale est insérée ci-dessous via INSERT ... ON CONFLICT.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v106_runtime_state (
  singleton_id     INTEGER         NOT NULL DEFAULT 1,
  phase            TEXT            NOT NULL DEFAULT 'LEADER_LAUNCH',
  leader_count     INTEGER         NOT NULL DEFAULT 0,
  leader_threshold INTEGER         NOT NULL DEFAULT 50,
  root_user_id     UUID,
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT v106_runtime_state_pkey      PRIMARY KEY (singleton_id),
  CONSTRAINT v106_runtime_state_singleton CHECK (singleton_id = 1),
  CONSTRAINT v106_runtime_state_phase     CHECK (phase IN ('LEADER_LAUNCH','NORMAL_OPERATION')),
  CONSTRAINT v106_runtime_state_lcount    CHECK (leader_count >= 0),
  CONSTRAINT v106_runtime_state_lthresh   CHECK (leader_threshold > 0),
  CONSTRAINT v106_runtime_state_root_fk   FOREIGN KEY (root_user_id) REFERENCES users(id)
);

-- Initialiser le singleton (idempotent)
INSERT INTO v106_runtime_state (singleton_id, phase, leader_count, leader_threshold, root_user_id, updated_at)
SELECT
  1,
  'LEADER_LAUNCH',
  COUNT(*) FILTER (WHERE is_leader = TRUE),
  50,
  NULL,
  NOW()
FROM users
ON CONFLICT (singleton_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Table v106_global_sponsorships — parrainage global V10.6
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v106_global_sponsorships (
  sponsor_user_id UUID NOT NULL,
  child_user_id   UUID NOT NULL,
  slot_no         INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT v106_gs_pkey         PRIMARY KEY (sponsor_user_id, child_user_id),
  CONSTRAINT v106_gs_sponsor_fk   FOREIGN KEY (sponsor_user_id) REFERENCES users(id),
  CONSTRAINT v106_gs_child_fk     FOREIGN KEY (child_user_id)   REFERENCES users(id),
  CONSTRAINT v106_gs_no_self      CHECK (sponsor_user_id <> child_user_id),
  CONSTRAINT v106_gs_slot_range   CHECK (slot_no IN (1, 2)),
  CONSTRAINT v106_gs_uniq_slot    UNIQUE (sponsor_user_id, slot_no),
  CONSTRAINT v106_gs_uniq_child   UNIQUE (child_user_id)
);

-- Index supplémentaire sur child_user_id pour les lookups inverses
CREATE INDEX IF NOT EXISTS idx_v106_gs_child  ON v106_global_sponsorships (child_user_id);
CREATE INDEX IF NOT EXISTS idx_v106_gs_sponsor ON v106_global_sponsorships (sponsor_user_id);

-- ---------------------------------------------------------------------------
-- 4. Table v106_phase_transition_events — journal d'audit des transitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS v106_phase_transition_events (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  from_phase       TEXT        NOT NULL,
  to_phase         TEXT        NOT NULL,
  leader_count     INTEGER     NOT NULL,
  leader_threshold INTEGER     NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT v106_pte_pkey    PRIMARY KEY (id),
  CONSTRAINT v106_pte_uniq    UNIQUE (to_phase)
);

-- ---------------------------------------------------------------------------
-- 5. Fonction v106_assign_global_sponsor(sponsor_uuid, child_uuid)
--    Atomique, sûre sous concurrence (SELECT ... FOR UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION v106_assign_global_sponsor(
  p_sponsor_id UUID,
  p_child_id   UUID
)
RETURNS TABLE (slot_no INTEGER) AS $$
DECLARE
  v_slot INTEGER;
BEGIN
  -- Vérification : pas d'auto-parrainage (fail-fast avant tout verrouillage)
  IF p_sponsor_id = p_child_id THEN
    RAISE EXCEPTION 'sponsor_id et child_id doivent être différents';
  END IF;

  -- Verrouiller le sponsor pour éviter les races sur ses slots
  PERFORM id FROM users WHERE id = p_sponsor_id FOR UPDATE;
  -- Verrouiller l'enfant pour éviter une double attribution
  PERFORM id FROM users WHERE id = p_child_id   FOR UPDATE;

  -- Rechercher le premier slot libre (1 puis 2)
  SELECT s INTO v_slot
  FROM   (VALUES (1),(2)) AS slots(s)
  WHERE  NOT EXISTS (
    SELECT 1 FROM v106_global_sponsorships
    WHERE  sponsor_user_id = p_sponsor_id
    AND    slot_no = slots.s
  )
  ORDER BY s
  LIMIT 1;

  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'sponsor_full: le sponsor % a déjà 2 directs', p_sponsor_id;
  END IF;

  -- Insérer l'attribution
  INSERT INTO v106_global_sponsorships (sponsor_user_id, child_user_id, slot_no)
  VALUES (p_sponsor_id, p_child_id, v_slot);

  RETURN QUERY SELECT v_slot;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 6. Fonction v106_transition_phase_to_normal_operation()
--    Idempotente, atomique, journalisée
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION v106_transition_phase_to_normal_operation()
RETURNS TEXT AS $$
DECLARE
  v_row      v106_runtime_state%ROWTYPE;
  v_lcount   INTEGER;
BEGIN
  -- Verrouiller le singleton
  SELECT * INTO v_row FROM v106_runtime_state WHERE singleton_id = 1 FOR UPDATE;

  -- Déjà en NORMAL_OPERATION : idempotent
  IF v_row.phase = 'NORMAL_OPERATION' THEN
    RETURN 'already_normal_operation';
  END IF;

  -- Recalculer le nombre de leaders depuis la colonne réelle is_leader
  SELECT COUNT(*) INTO v_lcount FROM users WHERE is_leader = TRUE;

  -- Mettre à jour le compteur dans le singleton
  UPDATE v106_runtime_state
  SET    leader_count = v_lcount,
         updated_at   = NOW()
  WHERE  singleton_id = 1;

  -- Vérifier le seuil
  IF v_lcount < v_row.leader_threshold THEN
    RETURN 'threshold_not_reached';
  END IF;

  -- Basculer vers NORMAL_OPERATION
  UPDATE v106_runtime_state
  SET    phase      = 'NORMAL_OPERATION',
         updated_at = NOW()
  WHERE  singleton_id = 1;

  -- Journaliser (UNIQUE(to_phase) empêche les doublons)
  INSERT INTO v106_phase_transition_events
    (from_phase, to_phase, leader_count, leader_threshold)
  VALUES
    ('LEADER_LAUNCH', 'NORMAL_OPERATION', v_lcount, v_row.leader_threshold)
  ON CONFLICT (to_phase) DO NOTHING;

  RETURN 'transitioned';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 7. Enregistrer cette migration
-- ---------------------------------------------------------------------------
INSERT INTO schema_migrations (version, filename)
VALUES ('001', '001_v10_6_step_1_foundation.sql')
ON CONFLICT DO NOTHING;
