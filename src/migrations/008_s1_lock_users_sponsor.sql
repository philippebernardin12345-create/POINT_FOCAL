BEGIN;

CREATE OR REPLACE FUNCTION public.s1_prevent_users_sponsor_change()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  /*
   * S1 — Invariant généalogique Point Focal
   *
   * users.sponsor_id représente le parrain personnel réel.
   * Il est fixé lors de la création du compte.
   *
   * Follow Me, Roll-Up, FIFO 2 / Relais FIFO V1
   * et Rotation V2 ne doivent jamais le modifier.
   *
   * Toute modification après INSERT est interdite,
   * y compris NULL -> valeur, valeur -> NULL
   * ou valeur -> autre valeur.
   *
   * Les données historiques existantes ne sont pas modifiées.
   */

  IF NEW.sponsor_id IS DISTINCT FROM OLD.sponsor_id
  THEN
    RAISE EXCEPTION
      'S1_SPONSOR_IMMUTABLE: users.sponsor_id cannot be changed once assigned';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_s1_prevent_users_sponsor_change
ON public.users;

CREATE TRIGGER trg_s1_prevent_users_sponsor_change
BEFORE UPDATE OF sponsor_id
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.s1_prevent_users_sponsor_change();

COMMIT;
