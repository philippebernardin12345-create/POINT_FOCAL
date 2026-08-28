DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'v106_platform_phase'
  ) THEN
    CREATE TYPE v106_platform_phase AS ENUM (
      'LEADER_LAUNCH',
      'NORMAL_OPERATION'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS v106_runtime_state (
  singleton_key boolean PRIMARY KEY DEFAULT true,
  root_user_id uuid NULL,
  current_phase v106_platform_phase NOT NULL DEFAULT 'LEADER_LAUNCH',
  leader_threshold integer NOT NULL DEFAULT 50,
  transitioned_to_normal_operation_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT v106_runtime_state_singleton_check
    CHECK (singleton_key = true),
  CONSTRAINT v106_runtime_state_leader_threshold_check
    CHECK (leader_threshold > 0)
);

INSERT INTO v106_runtime_state (singleton_key)
VALUES (true)
ON CONFLICT (singleton_key) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'v106_runtime_state_root_user_fk'
     ) THEN
    ALTER TABLE v106_runtime_state
      ADD CONSTRAINT v106_runtime_state_root_user_fk
      FOREIGN KEY (root_user_id)
      REFERENCES users (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS v106_global_sponsorships (
  sponsor_user_id uuid NOT NULL,
  child_user_id uuid NOT NULL,
  slot_no smallint NOT NULL,
  assignment_source text NOT NULL DEFAULT 'V10_6',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT v106_global_sponsorships_pkey
    PRIMARY KEY (child_user_id),
  CONSTRAINT v106_global_sponsorships_slot_check
    CHECK (slot_no IN (1, 2)),
  CONSTRAINT v106_global_sponsorships_distinct_users_check
    CHECK (sponsor_user_id <> child_user_id),
  CONSTRAINT v106_global_sponsorships_sponsor_slot_key
    UNIQUE (sponsor_user_id, slot_no)
);

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'v106_global_sponsorships_sponsor_user_fk'
     ) THEN
    ALTER TABLE v106_global_sponsorships
      ADD CONSTRAINT v106_global_sponsorships_sponsor_user_fk
      FOREIGN KEY (sponsor_user_id)
      REFERENCES users (id)
      ON DELETE RESTRICT;
  END IF;

  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'v106_global_sponsorships_child_user_fk'
     ) THEN
    ALTER TABLE v106_global_sponsorships
      ADD CONSTRAINT v106_global_sponsorships_child_user_fk
      FOREIGN KEY (child_user_id)
      REFERENCES users (id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS v106_phase_transition_events (
  id bigserial PRIMARY KEY,
  phase_from v106_platform_phase NOT NULL,
  phase_to v106_platform_phase NOT NULL,
  trigger_reason text NOT NULL,
  leader_count_snapshot integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS v106_global_sponsorships_sponsor_idx
  ON v106_global_sponsorships (sponsor_user_id, created_at);

CREATE INDEX IF NOT EXISTS v106_phase_transition_events_phase_idx
  ON v106_phase_transition_events (phase_to, created_at);

CREATE OR REPLACE VIEW v106_prelaunch_leader_candidates AS
SELECT
  users.id,
  users.email,
  users.sponsor_id,
  users.created_at
FROM users
JOIN v106_runtime_state runtime
  ON runtime.singleton_key = true
WHERE runtime.root_user_id IS NOT NULL
  AND users.is_leader = true
  AND users.is_prelaunch_leader = true
  AND users.email_confirmed = true
  AND users.status = 'active'
  AND users.sponsor_id = runtime.root_user_id;

CREATE OR REPLACE FUNCTION v106_assign_global_sponsor(
  p_sponsor_user_id uuid,
  p_child_user_id uuid,
  p_assignment_source text DEFAULT 'V10_6'
)
RETURNS TABLE (
  sponsor_user_id uuid,
  child_user_id uuid,
  slot_no smallint,
  assignment_source text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing v106_global_sponsorships%ROWTYPE;
BEGIN
  IF p_sponsor_user_id IS NULL THEN
    RAISE EXCEPTION 'sponsor_user_id is required';
  END IF;

  IF p_child_user_id IS NULL THEN
    RAISE EXCEPTION 'child_user_id is required';
  END IF;

  IF p_sponsor_user_id = p_child_user_id THEN
    RAISE EXCEPTION 'A user cannot sponsor itself';
  END IF;

  PERFORM 1
  FROM users
  WHERE id = p_sponsor_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sponsor user % does not exist', p_sponsor_user_id;
  END IF;

  PERFORM 1
  FROM users
  WHERE id = p_child_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child user % does not exist', p_child_user_id;
  END IF;

  SELECT *
  INTO v_existing
  FROM v106_global_sponsorships existing_assignment
  WHERE existing_assignment.child_user_id = p_child_user_id;

  IF FOUND THEN
    IF v_existing.sponsor_user_id <> p_sponsor_user_id THEN
      RAISE EXCEPTION
        'Child user % is already assigned to sponsor %',
        p_child_user_id,
        v_existing.sponsor_user_id;
    END IF;

    RETURN QUERY
    SELECT
      v_existing.sponsor_user_id,
      v_existing.child_user_id,
      v_existing.slot_no,
      v_existing.assignment_source,
      v_existing.created_at;
    RETURN;
  END IF;

  RETURN QUERY
  WITH available_slot AS (
    SELECT candidate.slot_no
    FROM (
      VALUES (1::smallint), (2::smallint)
    ) AS candidate(slot_no)
    WHERE NOT EXISTS (
      SELECT 1
      FROM v106_global_sponsorships existing
      WHERE existing.sponsor_user_id = p_sponsor_user_id
        AND existing.slot_no = candidate.slot_no
    )
    ORDER BY candidate.slot_no ASC
    LIMIT 1
  ), inserted AS (
    INSERT INTO v106_global_sponsorships (
      sponsor_user_id,
      child_user_id,
      slot_no,
      assignment_source
    )
    SELECT
      p_sponsor_user_id,
      p_child_user_id,
      available_slot.slot_no,
      COALESCE(
        NULLIF(BTRIM(p_assignment_source), ''),
        'V10_6'
      )
    FROM available_slot
    RETURNING
      v106_global_sponsorships.sponsor_user_id,
      v106_global_sponsorships.child_user_id,
      v106_global_sponsorships.slot_no,
      v106_global_sponsorships.assignment_source,
      v106_global_sponsorships.created_at
  )
  SELECT
    inserted.sponsor_user_id,
    inserted.child_user_id,
    inserted.slot_no,
    inserted.assignment_source,
    inserted.created_at
  FROM inserted;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Sponsor % has already reached the maximum of two directs',
      p_sponsor_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION v106_transition_phase_to_normal_operation(
  p_trigger_reason text DEFAULT 'leader_threshold_reached'
)
RETURNS TABLE (
  current_phase v106_platform_phase,
  transitioned boolean,
  leader_count integer,
  transition_event_id bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_runtime v106_runtime_state%ROWTYPE;
  v_leader_count integer;
  v_event_id bigint;
BEGIN
  INSERT INTO v106_runtime_state (singleton_key)
  VALUES (true)
  ON CONFLICT (singleton_key) DO NOTHING;

  SELECT *
  INTO v_runtime
  FROM v106_runtime_state
  WHERE singleton_key = true
  FOR UPDATE;

  SELECT COUNT(*)::int
  INTO v_leader_count
  FROM v106_prelaunch_leader_candidates;

  IF v_runtime.current_phase = 'NORMAL_OPERATION' THEN
    RETURN QUERY
    SELECT
      v_runtime.current_phase,
      false,
      v_leader_count,
      NULL::bigint;
    RETURN;
  END IF;

  IF v_leader_count < v_runtime.leader_threshold THEN
    RETURN QUERY
    SELECT
      v_runtime.current_phase,
      false,
      v_leader_count,
      NULL::bigint;
    RETURN;
  END IF;

  UPDATE v106_runtime_state
  SET
    current_phase = 'NORMAL_OPERATION',
    transitioned_to_normal_operation_at = NOW(),
    updated_at = NOW()
  WHERE singleton_key = true;

  INSERT INTO v106_phase_transition_events (
    phase_from,
    phase_to,
    trigger_reason,
    leader_count_snapshot
  )
  VALUES (
    'LEADER_LAUNCH',
    'NORMAL_OPERATION',
    COALESCE(
      NULLIF(BTRIM(p_trigger_reason), ''),
      'leader_threshold_reached'
    ),
    v_leader_count
  )
  RETURNING id
  INTO v_event_id;

  RETURN QUERY
  SELECT
    'NORMAL_OPERATION'::v106_platform_phase,
    true,
    v_leader_count,
    v_event_id;
END;
$$;
