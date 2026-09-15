-- Partezettel Archiv – Trauungsbuch-Link
-- Die bestehenden Taufbuch-/Sterbebuch-Links liegen direkt in public.personen.
-- Daher wird auch der Trauungsbuch-Link als Person-Feld ergänzt.
-- Sicher mehrfach ausführbar.

ALTER TABLE public.personen
ADD COLUMN IF NOT EXISTS trauungsbuch_link text;
