-- Partezettel Archiv v111
-- Einmal in Supabase SQL Editor ausführen. Bestehende Daten werden nicht verändert.

ALTER TABLE public.personen
ADD COLUMN IF NOT EXISTS taufbuch_zeile integer,
ADD COLUMN IF NOT EXISTS trauungsbuch_zeile integer,
ADD COLUMN IF NOT EXISTS sterbebuch_zeile integer;
