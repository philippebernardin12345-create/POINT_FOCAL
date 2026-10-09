ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country_code char(2);

-- Existing records created by the former RDC-only phone form can be classified safely.
UPDATE users
SET country_code = 'CD'
WHERE country_code IS NULL
  AND regexp_replace(COALESCE(whatsapp, ''), '[^0-9]', '', 'g') LIKE '243%';
