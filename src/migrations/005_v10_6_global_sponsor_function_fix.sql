BEGIN;

CREATE OR REPLACE FUNCTION public.v106_assign_global_sponsor(
  p_sponsor_user_id uuid,
  p_child_user_id uuid
)
RETURNS TABLE (
  sponsor_user_id uuid,
  child_user_id uuid,
  slot_no smallint,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_existing v106_global_sponsorships%ROWTYPE;
  v_slot smallint;
  v_phase text;
  v_root_user_id uuid;
  v_max_slots smallint;
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
  FROM v106_global_sponsorships AS gs
  WHERE gs.child_user_id = p_child_user_id
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

  SELECT phase, root_user_id
  INTO v_phase, v_root_user_id
  FROM v106_runtime_state
  WHERE singleton_id = true
  FOR UPDATE;

  IF v_phase IS NULL THEN
    RAISE EXCEPTION 'V106_RUNTIME_STATE_NOT_FOUND';
  END IF;

  IF v_phase = 'LEADER_LAUNCH'
     AND p_sponsor_user_id = v_root_user_id THEN
    v_max_slots := 50;
  ELSE
    v_max_slots := 2;
  END IF;

  SELECT slot.slot_no
  INTO v_slot
  FROM generate_series(1, v_max_slots) AS slot(slot_no)
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

      IF FOUND
         AND v_existing.sponsor_user_id = p_sponsor_user_id THEN
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
$fn$;

COMMIT;
