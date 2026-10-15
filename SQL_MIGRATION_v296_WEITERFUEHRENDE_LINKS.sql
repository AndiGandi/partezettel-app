-- Partezettel Archiv v296: optionale zusätzliche Quellenlinks je Person
-- In Supabase SQL Editor ausführen, bevor die neue App-Version verwendet wird.
ALTER TABLE public.personen
ADD COLUMN IF NOT EXISTS weiterfuehrende_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.personen.weiterfuehrende_links IS
'Optionale Liste zusätzlicher Quellenlinks als JSON-Array mit titel und url';
