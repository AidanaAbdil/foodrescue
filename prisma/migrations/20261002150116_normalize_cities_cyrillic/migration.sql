-- Follow-up to normalize_cities: SQLite's lower() only handles Latin
-- letters, so match the Cyrillic spellings exactly.
UPDATE "Store" SET "city" = 'ALMATY'
WHERE trim("city") IN ('Алматы', 'АЛМАТЫ', 'алматы', 'Алма-Ата', 'г. Алматы', 'Алматы қаласы');

UPDATE "Store" SET "city" = 'ASTANA'
WHERE trim("city") IN ('Астана', 'АСТАНА', 'астана', 'Нур-Султан', 'г. Астана', 'Астана қаласы');
