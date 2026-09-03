BEGIN;

ALTER TABLE public.v106_global_sponsorships
  DROP CONSTRAINT IF EXISTS v106_global_sponsorships_slot_no_check;

ALTER TABLE public.v106_global_sponsorships
  ADD CONSTRAINT v106_global_sponsorships_slot_no_check
  CHECK (slot_no BETWEEN 1 AND 50);

COMMIT;
