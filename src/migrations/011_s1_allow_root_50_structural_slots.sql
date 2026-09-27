BEGIN;

/*
 * S2 — capacité structurelle de lancement.
 *
 * Invariants :
 * - racine + LEADER_LAUNCH : jusqu'à 50 enfants structurels ;
 * - autres parrains : limite métier de 2 via
 *   v106_assign_global_sponsor() ;
 * - une relation structurelle existante et correcte n'est jamais
 *   supprimée ni renumérotée ;
 * - users.sponsor_id n'est jamais modifié.
 */

ALTER TABLE public.v106_global_sponsorships
DROP CONSTRAINT IF EXISTS v106_global_sponsorships_slot_no_check;

ALTER TABLE public.v106_global_sponsorships
ADD CONSTRAINT v106_global_sponsorships_slot_no_check
CHECK (slot_no BETWEEN 1 AND 50);

/*
 * Réparation uniquement des préleaders valides personnellement
 * parrainés par la racine mais dépourvus de relation structurelle.
 *
 * Le premier slot libre entre 1 et 50 est utilisé.
 */

DO $$
DECLARE
  v_root_user_id uuid;
  v_phase text;
  v_user record;
  v_slot smallint;
BEGIN
  SELECT phase, root_user_id
  INTO v_phase, v_root_user_id
  FROM public.v106_runtime_state
  WHERE singleton_id = true;

  IF v_phase = 'LEADER_LAUNCH'
     AND v_root_user_id IS NOT NULL THEN

    FOR v_user IN
      SELECT u.id
      FROM public.users u
      WHERE u.is_leader = true
        AND u.is_prelaunch_leader = true
        AND u.email_confirmed = true
        AND lower(coalesce(u.status, '')) = 'active'
        AND u.sponsor_id = v_root_user_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.v106_global_sponsorships gs
          WHERE gs.child_user_id = u.id
        )
      ORDER BY u.created_at ASC, u.id ASC
    LOOP

      SELECT s.slot_no::smallint
      INTO v_slot
      FROM generate_series(1, 50) AS s(slot_no)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.v106_global_sponsorships gs
        WHERE gs.sponsor_user_id = v_root_user_id
          AND gs.slot_no = s.slot_no
      )
      ORDER BY s.slot_no
      LIMIT 1;

      IF v_slot IS NULL THEN
        RAISE EXCEPTION 'S2_ROOT_STRUCTURAL_SLOTS_EXHAUSTED';
      END IF;

      INSERT INTO public.v106_global_sponsorships (
        sponsor_user_id,
        child_user_id,
        slot_no
      )
      VALUES (
        v_root_user_id,
        v_user.id,
        v_slot
      );

    END LOOP;
  END IF;
END $$;

COMMIT;
