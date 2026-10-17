# Familienspuren

Private Web-App (PWA) zum Erfassen und Erforschen einer Familiengeschichte: Personen, Familien, Partezettel und Totenzettel, Fotos, Sprachnotizen, Kirchenbuch-Verweise und Stammbäume. Sie läuft im Browser auf iPad, iPhone, Mac und Android und lässt sich als App auf den Home-Bildschirm legen.

Live: https://andigandi.github.io/partezettel-app/

## Funktionen

- **Bestand:** Personenliste mit Suche (Name, Ledigenname, Jahr, Datum) und Sortierung nach Name, Alter, Geburtsjahr, Sterbejahr, zuletzt erfasst oder Familie. Die Personenansicht zeigt Lebensdaten, Eltern, Ehepartner, Kinder, Kirchenbücher, Fotos, Sprachnotizen und Notizen.
- **Ersteingabe:** Person mit Foto (Partezettel), Sprachnotiz, Lebensdaten und Verwandtschaft direkt erfassen. Pflichtfelder sind nur Vorname und Geschlecht. Ohne Netz werden Einträge in einer Warteschlange zwischengespeichert.
- **Stammbaum** in vier Ansichten:
  - **Familie:** eine Person mit Eltern, Geschwistern, Partnern und Kindern (Standard)
  - **Generationen:** Übersicht nach Generationenzeilen
  - **Ahnentafel:** Vorfahren, nummeriert nach Kekulé, 3 bis 6 Generationen
  - **Nachkommen:** einklappbare Liste mit Anzahl der Nachkommen
- **Vordefinierte Stammlinien** als Filter für alle Ansichten.
- **Auswertungen:** Verwandtschaft zwischen zwei Personen ermitteln, Cousins und Cousinen nach Onkel und Tante geordnet.
- **Gruppenfotos:** Personen auf dem Foto mit Nummern markieren, Alter zum Aufnahmedatum, Zuordnung unbekannter Personen.
- **Kirchenbücher:** Links zu Tauf-, Trauungs- und Sterbebuch (z. B. Matricula) mit Zeilennummer.
- **Export und Sicherung:** vollständiges Backup (Datenbank, Fotos, Sprachnotizen) als ZIP, Export als JSON, GEDCOM und PDF, Wiederherstellung aus dem Backup.

## Technik

- Reines HTML, CSS und JavaScript, ohne Framework und ohne Build-Schritt
- Backend: Supabase (PostgreSQL, Anmeldung, Dateispeicher)
- Hosting: GitHub Pages
- Service Worker für die Installation als App; Personen-Cache mit Änderungsabgleich (Tabelle `sync_aenderungen`) spart Datenverkehr
- Bibliotheken über CDN: `supabase-js`, `jsPDF`

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Aufbau der Seite |
| `app.js` | gesamte App-Logik |
| `style.css` | Gestaltung |
| `sw.js` | Service Worker (App-Cache) |
| `manifest.json` | App-Beschreibung für den Home-Bildschirm |
| `config.js` | Supabase-Adresse und öffentlicher Schlüssel |
| `icon-192.png`, `icon-512.png` | App-Symbole |

Der Service Worker legt `index.html`, `style.css`, `app.js`, `config.js` und `manifest.json` im Cache ab. Diese Dateien dürfen nicht fehlen.

## Einrichtung

1. **Supabase-Projekt** anlegen. Tabellen: `personen`, `familien`, `familien_kinder`, `beziehung`, `fotos`, `foto_personen`, `sprachnotizen`, `sync_aenderungen`, `familien_trauungsbuch_quellen`. Die Struktur wird im Supabase-Dashboard gepflegt, Änderungen werden dort per SQL ausgeführt.
2. **Storage-Buckets** `partezettel-fotos` und `sprachnotizen` anlegen.
3. **Anmeldung:** E-Mail und Passwort. Neue Registrierungen ausschalten (Authentication, Sign In / Providers) und das eigene Konto einmalig anlegen.
4. **Zugriffsregeln (Row Level Security):** auf allen Tabellen und Buckets aktivieren und so einschränken, dass nur das eigene Konto lesen und schreiben darf.
5. **`config.js`:** `SUPABASE_URL` und `SUPABASE_ANON_KEY` eintragen (Supabase, Project Settings, API).
6. **GitHub Pages:** Repository, Settings, Pages, Branch `main`, Ordner `/ (root)`.

## Sicherheit

- Das Repository ist öffentlich. Adresse und `anon`-Schlüssel in `config.js` sind es damit auch. Das ist bei Supabase so vorgesehen, der Schutz kommt ausschließlich aus den Zugriffsregeln und der Anmeldung (Schritte 3 und 4).
- Den `service_role`-Schlüssel niemals in dieses Repository legen.
- Personendaten gehören nicht ins Repository, nur in die Datenbank.

## Neue Version veröffentlichen

Bei jeder neuen Version die Versionsnummer an allen Stellen gleich hochzählen, sonst zeigen Geräte unter Umständen alte Dateien:

1. Kommentar `<!-- Version N -->` in `index.html`
2. `style.css?v=N` und `app.js?v=N` in `index.html`
3. Anzeige „Version N“ im Kopf von `index.html`
4. Cache-Name `partezettel-shell-vN` in `sw.js`
5. Kopfzeile von `app.js`

Danach die geänderten Dateien hochladen und die App auf dem Gerät einmal schließen und neu öffnen. Oben rechts muss die neue Versionsnummer stehen.

## Arbeitsregeln

- Genealogische Daten werden nie automatisch geändert oder gelöscht.
- Vor größeren Änderungen: Release auf GitHub (Code) und Backup in der App (Daten).
- Aufräumen und Datenänderungen in Supabase erst nach einem Backup.
