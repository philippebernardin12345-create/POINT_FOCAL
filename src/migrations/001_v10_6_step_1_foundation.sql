DO $$
DECLARE
  user_id_type text;
BEGIN
  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
  INTO user_id_type
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = to_regclass('users')
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF user_id_type IS NULL THEN
    RAISE EXCEPTION 'users.id introuvable pour la migration V10.6';
  END IF;

  EXECUTE format(
    $sql$
    CREATE TABLE IF NOT EXISTS v106_runtime_state (
      singleton_id boolean PRIMARY KEY DEFAULT true CHECK (singleton_id = true),
      phase text NOT NULL CHECK (phase IN ('LEADER_LAUNCH', 'NORMAL_OPERATION')),
      leader_count integer NOT NULL DEFAULT 0 CHECK (leader_count >= 0),
      leader_threshold integer NOT NULL DEFAULT 50 CHECK (leader_threshold > 0),
      root_user_id %1$s REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
    $sql$,
    user_id_type
  );

  EXECUTE format(
    $sql$
    CREATE TABLE IF NOT EXISTS v106_global_sponsorships (
      sponsor_user_id %1$s NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      child_user_id %1$s NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      slot_no smallint NOT NULL CHECK (slot_no IN (1, 2)),
      created_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (sponsor_user_id, child_user_id),
      UNIQUE (sponsor_user_id, slot_no),
      UNIQUE (child_user_id),
      CHECK (sponsor_user_id <> child_user_id)
    )
    $sql$,
    user_id_type
  );

  EXECUTE format(
    $sql$
    CREATE TABLE IF NOT EXISTS v106_phase_transition_events (
      id bigserial PRIMARY KEY,
      from_phase text NOT NULL CHECK (from_phase IN ('LEADER_LAUNCH', 'NORMAL_OPERATION')),
      to_phase text NOT NULL CHECK (to_phase IN ('LEADER_LAUNCH', 'NORMAL_OPERATION')),
      leader_count integer NOT NULL CHECK (leader_count >= 0),
      leader_threshold integer NOT NULL CHECK (leader_threshold > 0),
      transition_reason text NOT NULL DEFAULT 'threshold_reached',
      created_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (to_phase)
    )
    $sql$
  );

  EXECUTE format(
    $sql$
    CREATE OR REPLACE FUNCTION v106_assign_global_sponsor(
      p_sponsor_user_id %1$s,
      p_child_user_id %1$s
    )
    RETURNS TABLE (
      sponsor_user_id %1$s,
      child_user_id %1$s,
      slot_no smallint,
      created_at timestamptz
    )
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      v_existing v106_global_sponsorships%%ROWTYPE;
      v_slot smallint;
    BEGIN
      PERFORM 1
      FROM users
      WHERE id = p_sponsor_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'V106_SPONSOR_NOT_FOUND';
      END IF;

      PERFORM 1
      FROM users
      WHERE id = p_child_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'V106_CHILD_NOT_FOUND';
      END IF;

      IF p_sponsor_user_id = p_child_user_id THEN
        RAISE EXCEPTION 'V106_SELF_SPONSORING_FORBIDDEN';
      END IF;

      SELECT *
      INTO v_existing
      FROM v106_global_sponsorships
      WHERE child_user_id = p_child_user_id
      FOR UPDATE;

      IF FOUND THEN
        IF v_existing.sponsor_user_id = p_sponsor_user_id THEN
          sponsor_user_id := v_existing.sponsor_user_id;
          child_user_id := v_existing.child_user_id;
          slot_no := v_existing.slot_no;
          created_at := v_existing.created_at;
          RETURN NEXT;
          RETURN;
        END IF;

        RAISE EXCEPTION 'V106_CHILD_ALREADY_ASSIGNED';
      END IF;

      SELECT slot.slot_no
      INTO v_slot
      FROM generate_series(1, 2) AS slot(slot_no)
      WHERE NOT EXISTS (
        SELECT 1
        FROM v106_global_sponsorships existing
        WHERE existing.sponsor_user_id = p_sponsor_user_id
          AND existing.slot_no = slot.slot_no
      )
      ORDER BY slot.slot_no
      LIMIT 1;

      IF v_slot IS NULL THEN
        RAISE EXCEPTION 'V106_SPONSOR_SLOTS_EXHAUSTED';
      END IF;

      BEGIN
        INSERT INTO v106_global_sponsorships (
          sponsor_user_id,
          child_user_id,
          slot_no
        )
        VALUES (
          p_sponsor_user_id,
          p_child_user_id,
          v_slot
        )
        RETURNING
          v106_global_sponsorships.sponsor_user_id,
          v106_global_sponsorships.child_user_id,
          v106_global_sponsorships.slot_no,
          v106_global_sponsorships.created_at
        INTO
          sponsor_user_id,
          child_user_id,
          slot_no,
          created_at;
      EXCEPTION
        WHEN unique_violation THEN
          SELECT *
          INTO v_existing
          FROM v106_global_sponsorships
          WHERE child_user_id = p_child_user_id;

          IF FOUND AND v_existing.sponsor_user_id = p_sponsor_user_id THEN
            sponsor_user_id := v_existing.sponsor_user_id;
            child_user_id := v_existing.child_user_id;
            slot_no := v_existing.slot_no;
            created_at := v_existing.created_at;
            RETURN NEXT;
            RETURN;
          END IF;

          RAISE EXCEPTION 'V106_GLOBAL_SPONSORSHIP_CONFLICT';
      END;

      RETURN NEXT;
    END;
    $fn$
    $sql$,
    user_id_type
  );

  EXECUTE format(
    $sql$
    CREATE OR REPLACE FUNCTION v106_transition_phase_to_normal_operation()
    RETURNS TABLE (
      phase text,
      leader_count integer,
      leader_threshold integer,
      root_user_id %1$s,
      transitioned boolean
    )
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      v_state v106_runtime_state%%ROWTYPE;
      v_predicate text := 'TRUE';
      v_leader_count integer;
      v_transitioned boolean := false;
    BEGIN
      SELECT *
      INTO v_state
      FROM v106_runtime_state
      WHERE singleton_id = true
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'V106_RUNTIME_STATE_MISSING';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND table_schema = ANY (current_schemas(false))
          AND column_name = 'is_leader'
      ) THEN
        v_predicate := v_predicate || ' AND is_leader = true';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND table_schema = ANY (current_schemas(false))
          AND column_name = 'is_prelaunch_leader'
      ) THEN
        v_predicate := v_predicate || ' AND is_prelaunch_leader = true';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND table_schema = ANY (current_schemas(false))
          AND column_name = 'email_confirmed'
      ) THEN
        v_predicate := v_predicate || ' AND email_confirmed = true';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND table_schema = ANY (current_schemas(false))
          AND column_name = 'status'
      ) THEN
        v_predicate := v_predicate || ' AND status = ''active''';
      END IF;

      EXECUTE 'SELECT COUNT(*)::int FROM users WHERE ' || v_predicate
      INTO v_leader_count;

      IF v_state.phase = 'LEADER_LAUNCH'
         AND v_leader_count >= v_state.leader_threshold THEN
        UPDATE v106_runtime_state
        SET
          phase = 'NORMAL_OPERATION',
          leader_count = v_leader_count,
          updated_at = NOW()
        WHERE singleton_id = true
        RETURNING *
        INTO v_state;

        INSERT INTO v106_phase_transition_events (
          from_phase,
          to_phase,
          leader_count,
          leader_threshold,
          transition_reason
        )
        VALUES (
          'LEADER_LAUNCH',
          'NORMAL_OPERATION',
          v_leader_count,
          v_state.leader_threshold,
          'threshold_reached'
        )
        ON CONFLICT (to_phase) DO NOTHING;

        v_transitioned := true;
      ELSE
        UPDATE v106_runtime_state
        SET
          leader_count = v_leader_count,
          updated_at = NOW()
        WHERE singleton_id = true
        RETURNING *
        INTO v_state;
      END IF;

      phase := v_state.phase;
      leader_count := v_state.leader_count;
      leader_threshold := v_state.leader_threshold;
      root_user_id := v_state.root_user_id;
      transitioned := v_transitioned;
      RETURN NEXT;
    END;
    $fn$
    $sql$,
    user_id_type
  );
END $$;

INSERT INTO v106_runtime_state (
  singleton_id,
  phase,
  leader_count,
  leader_threshold,
  root_user_id
)
VALUES (
  true,
  'LEADER_LAUNCH',
  0,
  50,
  NULL
)
ON CONFLICT (singleton_id) DO NOTHING;
