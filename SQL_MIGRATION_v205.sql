-- Partezettel Archiv v205
-- Vor dem Einsatz der neuen ehebezogenen Trauungsbuch-Quellen einmal in Supabase SQL Editor ausführen.
-- Fügt eine Quellenliste je Datensatz in public.familien hinzu; bestehende Daten bleiben erhalten.
ALTER TABLE public.familien
  ADD COLUMN IF NOT EXISTS trauungsbuch_quellen jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Übernimmt vorhandene Trauungsbuch-Links nur dann automatisch,
-- wenn eine Person genau einer Familien-/Partnerschaftsverbindung zugeordnet ist.
-- Bei mehreren Ehen wird NICHT geraten; solche Links bleiben im alten Personendatensatz erhalten,
-- damit keine Quelle versehentlich der falschen Ehe zugeordnet wird.
WITH person_familien AS (
  SELECT p.id AS person_id, p.trauungsbuch_link, p.trauungsbuch_zeile,
         COUNT(f.id) AS anzahl_familien, MIN(f.id::text)::uuid AS familie_id
  FROM public.personen p
  JOIN public.familien f ON f.partner_a_id = p.id OR f.partner_b_id = p.id
  WHERE NULLIF(BTRIM(p.trauungsbuch_link), '') IS NOT NULL
  GROUP BY p.id, p.trauungsbuch_link, p.trauungsbuch_zeile
), eindeutig AS (
  SELECT pf.familie_id, pf.trauungsbuch_link, pf.trauungsbuch_zeile
  FROM person_familien pf
  WHERE pf.anzahl_familien = 1
)
UPDATE public.familien f
SET trauungsbuch_quellen = COALESCE(f.trauungsbuch_quellen, '[]'::jsonb) ||
  jsonb_build_array(jsonb_build_object('url', e.trauungsbuch_link, 'zeile', e.trauungsbuch_zeile))
FROM eindeutig e
WHERE f.id = e.familie_id
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(f.trauungsbuch_quellen, '[]'::jsonb)) q
    WHERE q->>'url' = e.trauungsbuch_link
  );
