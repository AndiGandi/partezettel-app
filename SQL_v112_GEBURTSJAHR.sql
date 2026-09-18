-- Partezettel Archiv v112
-- Nur für das neue Feld "Geburtsjahr (nur Jahr bekannt)".
-- Die drei Matricula-Zeilen-Spalten aus v111 sind bereits vorhanden.
ALTER TABLE public.personen
ADD COLUMN IF NOT EXISTS geburtsjahr integer;
