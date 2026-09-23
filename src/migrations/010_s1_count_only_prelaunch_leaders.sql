BEGIN;

/*
 * S1 — Correction du compteur de lancement.
 *
 * La racine est un leader permanent mais ne fait pas partie
 * des 50 leaders qu'elle doit recruter pendant LEADER_LAUNCH.
 *
 * Le compteur S1 doit donc compter uniquement les leaders
 * de prélancement confirmés et actifs.
 */

CREATE OR REPLACE FUNCTION public.v106_transition_phase_to_normal_operation()
RETURNS TABLE(
  phase text,
  leader_count integer,
  leader_threshold integer,
  root_user_id uuid,
  transitioned boolean
)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_state v106_runtime_state%ROWTYPE;
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

  SELECT COUNT(*)::integer
  INTO v_leader_count
  FROM users
  WHERE is_leader = true
    AND is_prelaunch_leader = true
    AND email_confirmed = true
    AND lower(coalesce(status, '')) = 'active';

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

    UPDATE users
    SET link_active = true
    WHERE is_leader = true
      AND is_prelaunch_leader = true
      AND email_confirmed = true
      AND lower(coalesce(status, '')) = 'active';

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
$fn$;

COMMIT;
