# Partezettel Archiv – Setup-Anleitung

## 1. Zugangsdaten eintragen

Öffne `config.js` und trage ein:
- `SUPABASE_ANON_KEY` – aus Supabase: Project Settings → API → "anon public"
- Die `SUPABASE_URL` und Bucket-Namen sind schon korrekt eingetragen.

## 2. Datenbank-Berechtigungen (WICHTIG – ohne diesen Schritt schlägt jedes Speichern fehl)

Supabase blockiert standardmäßig jeden Zugriff, bis du Regeln ("Row Level Security Policies") erlaubst.
Gehe im Supabase-Dashboard zu **SQL Editor** → **New query**, füge Folgendes ein und klicke **Run**:

```sql
-- Row Level Security aktivieren (falls noch nicht aktiv)
alter table personen enable row level security;
alter table beziehungen enable row level security;
alter table fotos enable row level security;
alter table sprachnotizen enable row level security;

-- Angemeldeten Nutzern (auch anonymen) Lesen + Schreiben erlauben
create policy "authenticated read personen" on personen for select using (auth.role() = 'authenticated');
create policy "authenticated write personen" on personen for insert with check (auth.role() = 'authenticated');

create policy "authenticated read beziehungen" on beziehungen for select using (auth.role() = 'authenticated');
create policy "authenticated write beziehungen" on beziehungen for insert with check (auth.role() = 'authenticated');

create policy "authenticated read fotos" on fotos for select using (auth.role() = 'authenticated');
create policy "authenticated write fotos" on fotos for insert with check (auth.role() = 'authenticated');

create policy "authenticated read sprachnotizen" on sprachnotizen for select using (auth.role() = 'authenticated');
create policy "authenticated write sprachnotizen" on sprachnotizen for insert with check (auth.role() = 'authenticated');
```

Danach im Dashboard zu **Storage** → Bucket `partezettel-fotos` → **Policies** → **New policy** (gleiches für `sprachnotizen`):
- Erlaube `INSERT` und `SELECT` für die Rolle `authenticated`.
- Am schnellsten über die Vorlage "Give users access to a folder only to authenticated users" bzw. einfach "For full customization" und `auth.role() = 'authenticated'` als Bedingung eintragen.

(Anonyme Anmeldung zählt in Supabase als `authenticated` – nur eben ohne Name/E-Mail. Das ist der Grund, warum diese Regel für "jeden mit der App" funktioniert, ohne dass sich jemand registrieren muss.)

## 3. App online stellen (GitHub Pages, kostenlos)

1. Erstelle ein neues **privates oder öffentliches** Repository auf github.com (z. B. `partezettel-app`).
2. Lade alle Dateien aus diesem Ordner dort hoch (per Drag & Drop im Browser reicht völlig).
3. Im Repository: **Settings** → **Pages** → unter "Source" den Branch `main` und Ordner `/ (root)` auswählen → Speichern.
4. Nach ein bis zwei Minuten ist die App erreichbar unter `https://DEIN-GITHUB-NAME.github.io/partezettel-app/`.

Diesen Link schickst du dem anderen Nutzer. Er öffnet ihn in Chrome (Android) bzw. Safari (iPhone) und kann optional über "Zum Startbildschirm hinzufügen" ein App-Icon anlegen.

## 4. Kurzer Testlauf

Vor der Weitergabe: Öffne den Link selbst, lege eine Test-Person mit Foto und kurzer Sprachnotiz an, wechsle zum Tab "Personen" und prüfe, ob der Eintrag erscheint. Danach im Supabase Table Editor kontrollieren, ob Zeile + Datei tatsächlich angekommen sind.

## Hinweis zum Export

Die App speichert alles strukturiert in Supabase. Für den JSON/GEDCOM-Export (für andere Programme) baue ich dir auf Wunsch ein separates kleines Export-Tool, das direkt auf deine Supabase-Tabellen zugreift und die Daten in beide Formate umwandelt – sag einfach Bescheid, sobald die Erfassung läuft und du die ersten echten Daten drin hast.
