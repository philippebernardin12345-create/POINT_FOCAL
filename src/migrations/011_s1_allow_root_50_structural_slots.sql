BEGIN;

/*
 * S1 — capacité structurelle.
 *
 * La table doit pouvoir représenter les 50 leaders directement
 * sous la racine pendant LEADER_LAUNCH.
 *
 * La limite métier reste :
 * - racine + LEADER_LAUNCH : 50
 * - tous les autres cas : 2
 *
 * Cette limite est appliquée par v106_assign_global_sponsor().
 */

ALTER TABLE public.v106_global_sponsorships
DROP CONSTRAINT IF EXISTS v106_global_sponsorships_slot_no_check;

ALTER TABLE public.v106_global_sponsorships
ADD CONSTRAINT v106_global_sponsorships_slot_no_check
CHECK (slot_no BETWEEN 1 AND 50);

/*
 * Réparation S1 des préleaders existants.
 *
 * users.sponsor_id n'est PAS modifié.
 * Seule la structure v106_global_sponsorships est réalignée :
 * chaque préleader actif, confirmé et personnellement parrainé
 * par la racine devient enfant structurel direct de la racine.
 */

DELETE FROM public.v106_global_sponsorships gs
USING public.users u,
      public.v106_runtime_state rs
WHERE rs.singleton_id = true
  AND rs.phase = 'LEADER_LAUNCH'
  AND u.id = gs.child_user_id
  AND u.is_leader = true
  AND u.is_prelaunch_leader = true
  AND u.email_confirmed = true
  AND lower(coalesce(u.status, '')) = 'active'
  AND u.sponsor_id = rs.root_user_id;

INSERT INTO public.v106_global_sponsorships (
  sponsor_user_id,
  child_user_id,
  slot_no
)
SELECT
  rs.root_user_id,
  u.id,
  ROW_NUMBER() OVER (
    ORDER BY u.created_at ASC, u.id ASC
  )::smallint
FROM public.users u
CROSS JOIN public.v106_runtime_state rs
WHERE rs.singleton_id = true
  AND rs.phase = 'LEADER_LAUNCH'
  AND u.is_leader = true
  AND u.is_prelaunch_leader = true
  AND u.email_confirmed = true
  AND lower(coalesce(u.status, '')) = 'active'
  AND u.sponsor_id = rs.root_user_id
ON CONFLICT (child_user_id) DO NOTHING;

COMMIT;
