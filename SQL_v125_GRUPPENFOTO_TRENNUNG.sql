-- Partezettel Archiv – v125 Gruppenfoto-Trennung
-- Normale Personenfotos bleiben normale Personenfotos.
-- Nur ausdrücklich als Gruppenfoto markierte Fotos erscheinen im Gruppenfoto-Bereich.

ALTER TABLE public.fotos
ADD COLUMN IF NOT EXISTS gruppenfoto boolean NOT NULL DEFAULT false;

-- Bereits in foto_personen verwendete Fotos nachträglich als Gruppenfoto kennzeichnen.
UPDATE public.fotos f
SET gruppenfoto = true
WHERE EXISTS (
    SELECT 1
    FROM public.foto_personen fp
    WHERE fp.foto_id = f.id
);
