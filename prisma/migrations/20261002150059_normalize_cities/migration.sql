-- Store.city used to be free text ("Almaty", "Алматы", …). From now on it
-- holds a city code from src/lib/cities.ts. Convert the known spellings.
UPDATE "Store" SET "city" = 'ALMATY'
WHERE lower(trim("city")) IN ('almaty', 'алматы', 'алма-ата', 'alma-ata', 'almaty city', 'г. алматы');

UPDATE "Store" SET "city" = 'ASTANA'
WHERE lower(trim("city")) IN ('astana', 'астана', 'нур-султан', 'nur-sultan', 'г. астана');
