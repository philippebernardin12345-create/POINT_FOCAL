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
    RAISE EXCEPTION 'users.id introuvable pour la correction V10.6 runtime';
  END IF;

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
      v_predicate text := 'is_leader = true';
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
