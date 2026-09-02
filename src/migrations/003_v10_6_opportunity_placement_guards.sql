DO $$
BEGIN
  IF to_regclass('user_opportunities') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT user_id, opportunity_id
        FROM user_opportunities
        GROUP BY user_id, opportunity_id
        HAVING COUNT(*) > 1
        LIMIT 1
      ) duplicates
    ) THEN
      RAISE EXCEPTION 'V106_USER_OPPORTUNITY_DUPLICATES';
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS
      user_opportunities_user_opportunity_uidx
    ON user_opportunities (user_id, opportunity_id);
  END IF;

  IF to_regclass('rollup_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS
      rollup_logs_user_opportunity_created_idx
    ON rollup_logs (user_id, opportunity_id, created_at DESC);
  END IF;
END $$;
