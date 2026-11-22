// Familienspuren – Partnerschaften, Personen-Zwischenspeicher, Abgleich, Bestandsliste und Suche
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 454

// ---------- Partnerschaftslogik ----------
function datumAnzeige(datum) {
  if (!datum) return "";
  const teile = String(datum).split("-");
  return teile.length === 3 ? teile.reverse().join(".") : String(datum);
}

function personAusLookup(lookup, id) {
  if (!id) return null;
  if (lookup instanceof Map) return lookup.get(id) || null;
  return (lookup || []).find((p) => p.id === id) || null;
}

// Eine Partnerschaft gilt auch ohne gespeichertes Ende als beendet,
// wenn einer der beiden Partner bereits verstorben ist. Dabei wird nichts
// automatisch in der Datenbank überschrieben; die Information wird nur für
// Auswahl und Anzeige verwendet.
function partnerschaftTodesende(familie, lookup = personenCache, bezugsPersonId = null) {
  // Wenn der Benutzer die automatische Todesbeendigung ausdrücklich verworfen hat
  // (z. B. weil die Ehe geschieden wurde, das Scheidungsdatum aber noch unbekannt ist),
  // darf der Tod nicht erneut als Ende eingesetzt oder angezeigt werden.
  if (familie?.ende_automatik_ignorieren) return null;

  // Der Tod eines der beiden Partner beendet die Ehe/Partnerschaft.
  // bezugsPersonId wird aus Kompatibilitätsgründen weiter akzeptiert, darf
  // aber den Tod des aktuell geöffneten Partners nicht ausblenden.
  const totePartner = [familie?.partner_a_id, familie?.partner_b_id]
    .filter(Boolean)
    .map((id) => personAusLookup(lookup, id))
    .filter((p) => p && (p.sterbedatum || p.sterbejahr));
  if (!totePartner.length) return null;

  const exakt = totePartner
    .map((p) => p.sterbedatum)
    .filter(Boolean)
    .sort()[0];
  if (exakt) return { datum: exakt, jahr: exakt.slice(0, 4), exakt: true };

  const jahr = totePartner
    .map((p) => Number(p.sterbejahr))
    .filter((y) => Number.isFinite(y) && y > 0)
    .sort((a, b) => a - b)[0];
  return jahr ? { datum: null, jahr: String(jahr), exakt: false } : null;
}

function partnerschaftIstBeendet(familie, lookup = personenCache) {
  // Auch eine ausdrücklich als beendet markierte Ehe ohne bekanntes Datum
  // bleibt für eine neue Partnerschaft gesperrt.
  return !!familie?.ende || !!familie?.ende_automatik_ignorieren || !!partnerschaftTodesende(familie, lookup);
}

function ehejahreAnzeige(familie, lookup = personenCache, allePartnerschaften = []) {
  if (String(familie?.familientyp || "").trim().toLocaleLowerCase("de") !== "ehe") return "";
  const beginn = familie?.beginn ? String(familie.beginn).slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginn)) return "";

  let ende = familie?.ende ? String(familie.ende).slice(0, 10) : "";
  if (!ende) {
    const tod = partnerschaftTodesende(familie, lookup);
    if (tod?.exakt && tod.datum) {
      ende = String(tod.datum).slice(0, 10);
    } else {
      // Ist kein genaues Todesdatum bekannt, endet die frühere Ehe spätestens
      // mit Beginn einer späteren Ehe desselben Partners. Nur Anzeige; keine
      // vorhandenen Datenbankwerte werden verändert.
      const partnerIds = new Set([familie?.partner_a_id, familie?.partner_b_id].filter(Boolean));
      const zweiteEhe = (allePartnerschaften || [])
        .filter((f) => f && f.id !== familie?.id && String(f.familientyp || "").trim().toLocaleLowerCase("de") === "ehe")
        .filter((f) => [f.partner_a_id, f.partner_b_id].some((id) => partnerIds.has(id)))
        .map((f) => String(f.beginn || "").slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= beginn)
        .sort()[0];
      if (zweiteEhe) {
        ende = zweiteEhe;
      } else if (tod?.jahr) {
        const startJahr = Number(beginn.slice(0, 4));
        const endeJahr = Number(tod.jahr);
        if (Number.isFinite(startJahr) && Number.isFinite(endeJahr) && endeJahr >= startJahr) {
          const d = endeJahr - startJahr;
          return d >= 1 ? `${d} ${d === 1 ? "Jahr" : "Jahre"}` : "unter 1 Jahr";
        }
        return "";
      }
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ende)) return "";

  const start = new Date(`${beginn}T00:00:00`);
  const end = new Date(`${ende}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";

  let jahre = end.getFullYear() - start.getFullYear();
  const monatsTagEnde = end.getMonth() * 100 + end.getDate();
  const monatsTagStart = start.getMonth() * 100 + start.getDate();
  if (monatsTagEnde < monatsTagStart) jahre--;
  return jahre >= 0 ? dauerText(start, end, true) : "";
}
// ---------- Persistenter Personen-Cache (IndexedDB) ----------
// v170: Der Personen-/Auswahlcache bleibt über einen Safari-Neustart erhalten.
// Die zentrale Tabelle sync_aenderungen hält den letzten Synchronisationsstand.
const PERSONEN_DB_NAME = "partezettel-cache-v167";
const PERSONEN_DB_VERSION = 1;
const PERSONEN_STORE = "personen_bundle";
const PERSONEN_LOCAL_KEY = "partezettel-personen-cache-v167";

function oeffnePersonenCacheDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB wird von diesem Browser nicht unterstützt."));
      return;
    }
    const request = indexedDB.open(PERSONEN_DB_NAME, PERSONEN_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PERSONEN_STORE)) {
        db.createObjectStore(PERSONEN_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB konnte nicht geöffnet werden."));
  });
}

async function lesePersonenAusPersistentemCache() {
  try {
    const db = await oeffnePersonenCacheDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PERSONEN_STORE, "readonly");
      const req = tx.objectStore(PERSONEN_STORE).get("aktuell");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("Personen-Cache konnte nicht gelesen werden."));
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error("Personen-Cache konnte nicht gelesen werden."));
    });
  } catch (err) {
    debugLog(`⚠️ Persistenter Personen-Cache nicht lesbar: ${err.message || err}`);
    return null;
  }
}

async function speicherePersonenImPersistentenCache(bundle) {
  const gespeichertAm = new Date().toISOString();
  const cacheBundle = {
    id: "aktuell",
    gespeichertAm,
    seitenweise: true, // v373: vollständig geladen (nicht bei 1000 abgeschnitten)
    ...bundle
  };

  // v166: localStorage und IndexedDB sind zwei unabhängige Speicherwege.
  // Ein Fehler in IndexedDB darf NICHT verhindern, dass der Safari-Fallback
  // gespeichert wird.
  let localGespeichert = false;
  try {
    localStorage.setItem(PERSONEN_LOCAL_KEY, JSON.stringify(cacheBundle));
    localGespeichert = true;
    debugLog(`💾 Personen-Cache in localStorage gespeichert: ${bundle.personen?.length || 0} Personen.`);
  } catch (storageErr) {
    debugLog(`⚠️ localStorage-Cache nicht speicherbar: ${storageErr.message || storageErr}`);
  }

  let indexedGespeichert = false;
  try {
    const db = await oeffnePersonenCacheDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PERSONEN_STORE, "readwrite");
      tx.objectStore(PERSONEN_STORE).put(cacheBundle);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Personen-Cache konnte nicht gespeichert werden."));
      tx.onabort = () => reject(tx.error || new Error("Personen-Cache wurde abgebrochen."));
    });
    db.close();
    indexedGespeichert = true;
    debugLog(`💾 Personen-Cache in IndexedDB gespeichert: ${bundle.personen?.length || 0} Personen.`);
  } catch (err) {
    debugLog(`⚠️ IndexedDB-Cache nicht speicherbar: ${err.message || err}`);
  }

  return localGespeichert || indexedGespeichert;
}

let personenCacheSeitenweise = false;
async function ladePersonenAusPersistentemCache() {
  // v166: Safari zuerst aus localStorage bedienen. IndexedDB bleibt als
  // zusätzlicher dauerhafter Speicherweg erhalten.
  let bundle = null;
  let quelle = "";
  try {
    const raw = localStorage.getItem(PERSONEN_LOCAL_KEY);
    if (raw) {
      const fallback = JSON.parse(raw);
      if (Array.isArray(fallback?.personen) && fallback.personen.length > 0) {
        bundle = fallback;
        quelle = "localStorage";
      }
    }
  } catch (storageErr) {
    debugLog(`⚠️ localStorage-Cache nicht lesbar: ${storageErr.message || storageErr}`);
  }

  if (!bundle) {
    bundle = await lesePersonenAusPersistentemCache();
    if (bundle && Array.isArray(bundle.personen) && bundle.personen.length > 0) {
      quelle = "IndexedDB";
    }
  }

  if (!bundle || !Array.isArray(bundle.personen) || bundle.personen.length === 0) return false;

  personenCacheSeitenweise = bundle.seitenweise === true;
  personenCache = bundle.personen;
  familienAuswahlCache = Array.isArray(bundle.familien) ? bundle.familien : [];
  const familienKinder = Array.isArray(bundle.familienKinder) ? bundle.familienKinder : [];
  const beziehungen = Array.isArray(bundle.beziehungen) ? bundle.beziehungen : [];
  familienKinderAuswahlCache = familienKinder;
  beziehungenAuswahlCache = beziehungen;
  personenCacheSyncSeq = Number.isFinite(Number(bundle.syncSeq)) ? Number(bundle.syncSeq) : 0;
  personenCacheSyncInitialisiert = bundle.syncInitialisiert === true;
  syncPruefungSeitCacheLaden = false;

  partnerIdsAuswahlCache = new Set();
  for (const f of familienAuswahlCache) {
    const typ = String(f.familientyp || "").toLowerCase();
    if ((typ === "ehe" || typ === "partnerschaft") && !partnerschaftIstBeendet(f, personenCache)) {
      if (f.partner_a_id) partnerIdsAuswahlCache.add(f.partner_a_id);
      if (f.partner_b_id) partnerIdsAuswahlCache.add(f.partner_b_id);
    }
  }
  for (const b of beziehungen) {
    if (b.beziehungstyp === "Ehe" || b.beziehungstyp === "Partnerschaft") {
      if (b.personen_a_id) partnerIdsAuswahlCache.add(b.personen_a_id);
      if (b.personen_b_id) partnerIdsAuswahlCache.add(b.personen_b_id);
    }
  }

  const kinderByFamilie = new Map();
  for (const k of familienKinder) {
    if (!kinderByFamilie.has(k.familie_id)) kinderByFamilie.set(k.familie_id, []);
    kinderByFamilie.get(k.familie_id).push(k.kind_id);
  }
  for (const f of familienAuswahlCache) f._kinder = kinderByFamilie.get(f.id) || [];

  personenVerwandtschaftCache = new Map(personenCache.map((p) => [p.id, {
    eltern: new Set(),
    ehePartnerschaften: new Set(),
    kinder: new Set(),
  }]));
  for (const fk of familienKinder) {
    const familie = familienAuswahlCache.find((f) => f.id === fk.familie_id);
    if (!familie || !fk.kind_id) continue;
    const info = personenVerwandtschaftCache.get(fk.kind_id);
    if (!info) continue;
    for (const partnerId of [familie.partner_a_id, familie.partner_b_id]) {
      if (partnerId && partnerId !== fk.kind_id) info.eltern.add(partnerId);
    }
  }
  for (const familie of familienAuswahlCache) {
    const typ = String(familie.familientyp || "").trim().toLocaleLowerCase("de");
    const istEheOderPartnerschaft = typ === "ehe" || typ === "partnerschaft";
    for (const partnerId of [familie.partner_a_id, familie.partner_b_id]) {
      if (!partnerId) continue;
      const info = personenVerwandtschaftCache.get(partnerId);
      if (!info) continue;
      if (istEheOderPartnerschaft) info.ehePartnerschaften.add(familie.id);
      // v372: Kinder auch aus Familien mit nur einem Elternteil zählen
      for (const kindId of familie._kinder || []) {
        if (kindId && kindId !== partnerId) info.kinder.add(kindId);
      }
    }
  }

  try { berechneFamilienSortKeys(personenCache, familienAuswahlCache); } catch (_) {}
  personenCacheGeladen = true;
  personenCacheQuelle = quelle;
  personenCacheZeitpunkt = bundle.gespeichertAm ? Date.parse(bundle.gespeichertAm) || Date.now() : Date.now();
  aktualisierePersonenCacheStatus();
  debugLog(`📦 Personen aus dauerhaftem Cache geladen: ${personenCache.length} Personen.`);

  const banner = document.getElementById("pending-banner");
  const empty = document.getElementById("list-empty");
  if (banner) banner.hidden = true;
  await renderPersonenList(personenCache);
  if (empty) empty.hidden = personenCache.length > 0;
  const suchfeldNachLaden = document.getElementById("search-input");
  if (suchfeldNachLaden?.value) window.partezettelPersonenSuche?.(suchfeldNachLaden.value);
  return true;
}

// ---------- Delta-Synchronisation ----------
async function holeSyncMaxSeq() {
  const { data, error } = await sb
    .from("sync_aenderungen")
    .select("seq")
    .order("seq", { ascending: false })
    .limit(1);
  if (error) throw error;
  return Number(data?.[0]?.seq || 0);
}

async function holeSyncAenderungenSeit(seq) {
  const startSeq = Number(seq || 0);
  const { data, error } = await sb
    .from("sync_aenderungen")
    .select("seq, tabelle, datensatz_id, aktion")
    .gt("seq", startSeq)
    .order("seq", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function baueAuswahlCachesAusSyncDaten() {
  partnerIdsAuswahlCache = new Set();
  for (const f of familienAuswahlCache) {
    const typ = String(f.familientyp || "").toLowerCase();
    if ((typ === "ehe" || typ === "partnerschaft") && !partnerschaftIstBeendet(f, personenCache)) {
      if (f.partner_a_id) partnerIdsAuswahlCache.add(f.partner_a_id);
      if (f.partner_b_id) partnerIdsAuswahlCache.add(f.partner_b_id);
    }
  }
  for (const b of beziehungenAuswahlCache) {
    if (b.beziehungstyp === "Ehe" || b.beziehungstyp === "Partnerschaft") {
      if (b.personen_a_id) partnerIdsAuswahlCache.add(b.personen_a_id);
      if (b.personen_b_id) partnerIdsAuswahlCache.add(b.personen_b_id);
    }
  }

  const kinderByFamilie = new Map();
  for (const k of familienKinderAuswahlCache) {
    if (!kinderByFamilie.has(k.familie_id)) kinderByFamilie.set(k.familie_id, []);
    kinderByFamilie.get(k.familie_id).push(k.kind_id);
  }
  for (const f of familienAuswahlCache) f._kinder = kinderByFamilie.get(f.id) || [];

  personenVerwandtschaftCache = new Map(personenCache.map((p) => [p.id, {
    eltern: new Set(),
    ehePartnerschaften: new Set(),
    kinder: new Set(),
  }]));
  for (const fk of familienKinderAuswahlCache) {
    const familie = familienAuswahlCache.find((f) => f.id === fk.familie_id);
    if (!familie || !fk.kind_id) continue;
    const info = personenVerwandtschaftCache.get(fk.kind_id);
    if (!info) continue;
    for (const partnerId of [familie.partner_a_id, familie.partner_b_id]) {
      if (partnerId && partnerId !== fk.kind_id) info.eltern.add(partnerId);
    }
  }
  for (const familie of familienAuswahlCache) {
    const typ = String(familie.familientyp || "").trim().toLocaleLowerCase("de");
    const istEheOderPartnerschaft = typ === "ehe" || typ === "partnerschaft";
    for (const partnerId of [familie.partner_a_id, familie.partner_b_id]) {
      if (!partnerId) continue;
      const info = personenVerwandtschaftCache.get(partnerId);
      if (!info) continue;
      if (istEheOderPartnerschaft) info.ehePartnerschaften.add(familie.id);
      // v372: Kinder auch aus Familien mit nur einem Elternteil zählen
      for (const kindId of familie._kinder || []) {
        if (kindId && kindId !== partnerId) info.kinder.add(kindId);
      }
    }
  }
  try { berechneFamilienSortKeys(personenCache, familienAuswahlCache); } catch (_) {}
}

async function ladeFamilienAusSupabaseFuerSync() {
  const [{ data: familien, error: familienError }, { data: familienKinder, error: kinderError }, { data: beziehungen, error: beziehungsError }] = await Promise.all([
    alleZeilenLaden(() => sb.from("familien").select("*").order("id")),
    alleZeilenLaden(() => sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp").order("id")),
    alleZeilenLaden(() => sb.from("beziehung").select("id, personen_a_id, personen_b_id, beziehungstyp").order("id"))
  ]);
  if (familienError) throw familienError;
  if (kinderError) throw kinderError;
  if (beziehungsError) throw beziehungsError;
  familienAuswahlCache = familien || [];
  familienKinderAuswahlCache = familienKinder || [];
  beziehungenAuswahlCache = beziehungen || [];
  baueAuswahlCachesAusSyncDaten();
}

// v371: Supabase liefert pro Abfrage höchstens 1000 Zeilen. Alle Zeilen seitenweise laden.
async function alleZeilenLaden(bau, seite = 1000) {
  const alle = [];
  for (let von = 0; ; von += seite) {
    const { data, error } = await bau().range(von, von + seite - 1);
    if (error) return { data: null, error };
    alle.push(...(data || []));
    if (!data || data.length < seite) break;
  }
  return { data: alle, error: null };
}

// v365: Prüf-Kennzeichen. Personen aus einem Import tragen herkunft_quelle; geprueft_am zeigt, ob schon geprüft.
// Fehlen die Spalten (Paket 3 nicht eingespielt), wird ohne sie weitergearbeitet.
let pruefSpaltenVorhanden = true;
let todesSpaltenVorhanden = true; // v377: Todesumstand (Paket 7)
const mitPruefSpalten = (basis) => `${basis}${pruefSpaltenVorhanden ? ", herkunft_quelle, geprueft_am" : ""}${todesSpaltenVorhanden ? ", todesumstand, todesumstand_text" : ""}`;
function istPruefSpaltenFehler(error) {
  return pruefSpaltenVorhanden && /herkunft_quelle|geprueft_am/i.test(`${error?.code || ""} ${error?.message || ""}`);
}
const istTodesSpaltenFehler = (error) => todesSpaltenVorhanden && /todesumstand/i.test(`${error?.message || ""} ${error?.details || ""}`);
async function personenMitPruefSpalten(basis, bau) {
  let r = await bau(mitPruefSpalten(basis));
  for (let versuch = 0; versuch < 2 && r.error; versuch++) {
    if (istTodesSpaltenFehler(r.error)) {
      todesSpaltenVorhanden = false;
      debugLog("ℹ️ Todesumstand nicht verfügbar (Paket 7 fehlt), Personen werden ohne geladen.");
    } else if (istPruefSpaltenFehler(r.error) || (/42703/.test(String(r.error?.code)) && pruefSpaltenVorhanden)) {
      pruefSpaltenVorhanden = false;
      debugLog("ℹ️ Prüf-Kennzeichen nicht verfügbar (Spalten fehlen), Personen werden ohne geladen.");
    } else break;
    r = await bau(mitPruefSpalten(basis));
  }
  return r;
}
// v377: Todesumstand als Text, z. B. „⚔ gefallen in Galizien“, „vermisst seit 1960“
const TODESUMSTAND = { gefallen: "⚔ gefallen", vermisst: "vermisst", "verunglückt": "verunglückt", lawine: "in der Lawine umgekommen", anderes: "" };
function todesumstandText(p) {
  const art = p?.todesumstand;
  if (!art || !(art in TODESUMSTAND)) return "";
  return [TODESUMSTAND[art], String(p.todesumstand_text || "").trim()].filter(Boolean).join(" ");
}
// Kleiner Punkt: Bernstein = ungeprüft, Grün = geprüft; Personen ohne Import-Herkunft erhalten keinen Punkt.
function pruefPunkt(p) {
  if (!p || !rolleIstEigentuemer()) return null;
  if (!p.herkunft_quelle) { // v378: grauer Punkt = selbst erfasst
    if (!pruefSpaltenVorhanden) return null;
    const e = document.createElement("span");
    e.className = "pruef-punkt is-eigen"; e.title = "selbst erfasst";
    e.setAttribute("role", "img"); e.setAttribute("aria-label", e.title);
    return e;
  }
  const s = document.createElement("span");
  s.className = `pruef-punkt ${p.geprueft_am ? "is-geprueft" : "is-offen"}`;
  s.title = `${p.geprueft_am ? "geprüft" : "ungeprüft"} · aus ${p.herkunft_quelle}`;
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", s.title);
  return s;
}
// v412: Kirchenbuch-Kurzanzeige (nur Eigentümer) – oben in der Personenansicht und in der Bestandsliste
const KB_ARTEN = [
  { key: "T", name: "Taufbuch", erwartet: () => true },
  { key: "Tr", name: "Trauungsbuch", erwartet: (p, ehen) => ehen > 0 },
  { key: "S", name: "Sterbebuch", erwartet: (p) => !!(p?.sterbedatum || p?.sterbejahr) },
];
function zeigeKbKurz(person, ehenAnzahl) {
  const ziel = document.getElementById("pv-lifetime");
  if (!ziel) return;
  let box = document.getElementById("pv-kb-kurz");
  if (!box) { box = document.createElement("p"); box.id = "pv-kb-kurz"; box.className = "pv-kb-kurz"; }
  // immer direkt unter den Lebensdaten bzw. den Stammlinien
  (document.getElementById("pv-linien") || ziel).insertAdjacentElement("afterend", box);
  if (!rolleIstEigentuemer()) { box.hidden = true; return; }
  const rows = [...document.querySelectorAll("#pv-books-list .person-view-book-row")];
  const vorhanden = (name) => rows.filter((r) => (r.querySelector("a")?.textContent || "").includes(name));
  box.replaceChildren();
  const kopf = document.createElement("span"); kopf.className = "pv-kb-kurz__titel"; kopf.textContent = "📖 Kirchenbücher:"; box.appendChild(kopf);
  for (const a of KB_ARTEN) {
    const treffer = vorhanden(a.name);
    const erwartet = a.erwartet(person, ehenAnzahl);
    if (!treffer.length && !erwartet) continue;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `kb-chip ${treffer.length ? "is-da" : "is-fehlt"}`;
    chip.textContent = `${a.name}${treffer.length > 1 ? ` ×${treffer.length}` : ""} ${treffer.length ? "✓" : "–"}`;
    chip.title = treffer.length ? `${a.name} öffnen` : `${a.name} fehlt – jetzt ergänzen`;
    chip.addEventListener("click", () => {
      if (treffer.length === 1) { const href = treffer[0].querySelector("a")?.href; if (href) { window.open(href, "_blank", "noopener"); return; } }
      if (treffer.length > 1) { document.getElementById("pv-books-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      kbBearbeitenOeffnen(person.id, a.key === "T" ? "taufbuch" : a.key === "S" ? "sterbebuch" : "trauung");
    });
    box.appendChild(chip);
  }
  if (rows.length) {
    const zu = document.createElement("button"); zu.type = "button"; zu.className = "kb-chip kb-chip--zu"; zu.textContent = "↓ zu den Links";
    zu.addEventListener("click", () => document.getElementById("pv-books-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    box.appendChild(zu);
  }
  box.hidden = box.children.length <= 1;
}

// Filter „Kirchenbuch fehlt“ nur für Eigentümer (iPad-Safari blendet <option> per CSS nicht aus → entfernen/wieder einsetzen)
let kbFilterOptionenAblage = null;
function kbFilterOptionenAnpassen() {
  const sel = document.getElementById("personen-pruef-filter");
  if (!sel) return;
  if (!kbFilterOptionenAblage) kbFilterOptionenAblage = [...sel.querySelectorAll('option[value^="kb:"]')];
  const darf = rolleIstEigentuemer();
  for (const o of kbFilterOptionenAblage) {
    if (darf && !o.parentNode) sel.appendChild(o);
    if (!darf && o.parentNode) o.remove();
  }
  if (!darf && String(personenPruefFilter || "").startsWith("kb:")) { sel.value = ""; sel.dispatchEvent(new Event("change", { bubbles: true })); }
}
// Übersicht für die Bestandsliste: welche Bücher sind je Person verlinkt (Eigentümer)
let kbUebersicht = new Map();   // personId -> { T, Tr, S, ehen, tot }
let kbUebersichtLauf = null;
async function kbUebersichtLaden() {
  if (!rolleIstEigentuemer()) return;
  if (kbUebersichtLauf) return kbUebersichtLauf;
  kbUebersichtLauf = (async () => {
    try {
      const [pe, fa, tq] = await Promise.all([
        alleZeilenLaden(() => sb.from("personen").select("id, taufbuch_link, sterbebuch_link, trauungsbuch_link, sterbedatum, sterbejahr").order("id")),
        alleZeilenLaden(() => sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp").order("id")),
        alleZeilenLaden(() => sb.from("familien_trauungsbuch_quellen").select("familie_id, trauungsbuch_link").order("familie_id")),
      ]);
      if (pe.error || fa.error) return;
      const m = new Map();
      for (const p of pe.data || []) m.set(p.id, { T: !!p.taufbuch_link, Tr: !!p.trauungsbuch_link, S: !!p.sterbebuch_link, ehen: 0, tot: !!(p.sterbedatum || p.sterbejahr) });
      const mitQuelle = new Set((tq.data || []).filter((q) => q.trauungsbuch_link).map((q) => q.familie_id));
      for (const f of fa.data || []) {
        if (!f.partner_a_id || !f.partner_b_id || f.familientyp === "Eltern") continue;
        for (const id of [f.partner_a_id, f.partner_b_id]) { const e = m.get(id); if (!e) continue; e.ehen += 1; if (mitQuelle.has(f.id)) e.Tr = true; }
      }
      kbUebersicht = m;
      document.dispatchEvent(new CustomEvent("kb-uebersicht-bereit"));
    } catch (e) { debugLog(`⚠️ Kirchenbuch-Übersicht laden: ${e.message || e}`); }
    finally { setTimeout(() => { kbUebersichtLauf = null; }, 0); }
  })();
  return kbUebersichtLauf;
}
function kbChipsElement(personId) {
  if (!rolleIstEigentuemer()) return null;
  const e = kbUebersicht.get(personId);
  if (!e) return null;
  const sp = document.createElement("span"); sp.className = "kb-mini";
  const teile = [["T", "Taufbuch", true], ["Tr", "Trauungsbuch", e.ehen > 0], ["S", "Sterbebuch", e.tot]];
  sp.title = teile.filter(([, , erw]) => erw).map(([k, n]) => `${n}: ${e[k] ? "verlinkt" : "fehlt"}`).join(" · ");
  sp.innerHTML = `<span class="kb-mini__icon" aria-hidden="true">📖</span>` + teile.filter(([, , erw]) => erw).map(([k]) => `<span class="kb-mini__b ${e[k] ? "is-da" : "is-fehlt"}">${k}</span>`).join("");
  return sp;
}
document.addEventListener("kb-uebersicht-bereit", () => {
  try { for (const karte of personenKartenCache.values()) if (karte?.person) aktualisierePersonenKarte(karte, karte.person); } catch {}
});

// v410: Stift neben jedem Kirchenbuch in der Personenansicht – öffnet „Bearbeiten“ direkt an der richtigen Stelle
function kbStiftAnhaengen(row, personId, ziel) {
  if (!rolleDarfSchreiben()) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "source-edit-btn pv-book-edit"; b.textContent = "✏️";
  b.title = "Kirchenbuch-Angaben bearbeiten"; b.setAttribute("aria-label", b.title);
  b.addEventListener("click", () => kbBearbeitenOeffnen(personId, ziel));
  row.appendChild(b);
}
async function kbBearbeitenOeffnen(personId, ziel) {
  // wie „✏️ Bearbeiten“ in der Personenansicht: Ansicht schließen, nach dem Schließen der Maske zurückkehren
  const ov = document.getElementById("person-view-overlay");
  rueckkehrNachPerson = null; bearbeitenAusAnsicht = personId;
  if (ov) ov.hidden = true; document.body.classList.remove("person-view-open");
  try { await openPersonEdit(personId); } catch (e) { debugLog(`⚠️ Bearbeiten öffnen: ${e.message || e}`); return; }
  const warte = async (fn) => { for (let i = 0; i < 40; i++) { const x = fn(); if (x) return x; await new Promise((r) => setTimeout(r, 100)); } return null; };
  let feld = null;
  if (ziel === "taufbuch" || ziel === "sterbebuch") {
    feld = document.querySelector(`[data-source-edit="d-${ziel}-link"]`)?.closest(".detail-event-source");
  } else if (ziel.startsWith("trauung:")) {
    const id = ziel.slice(8);
    feld = await warte(() => document.querySelector(`#d-partner-list .familie-item[data-familie-id="${CSS.escape(id)}"] .familie-trauungsbuch`));
  } else {
    feld = await warte(() => document.querySelector("#d-partner-list .familie-trauungsbuch")) || document.getElementById("d-partner-gruppe");
  }
  if (!feld) return;
  feld.scrollIntoView({ block: "center", behavior: "smooth" });
  feld.classList.add("is-hervorgehoben"); setTimeout(() => feld.classList.remove("is-hervorgehoben"), 2200);
  feld.querySelector(".familie-source-row, input[type=number]")?.focus({ preventScroll: true });
}

// v409: Stammlinien – Nachkommen eines Gründers (auch über Töchter). „Mannesstamm“ = Weg nur über Väter.
const STAMMLINIEN = [
  { key: "schruns", name: "Schrunser Linie", kurz: "S", gruender: { vorname: "Johann Christian", nachname: "Mangeng", geb: "1736-09-14" } },
  { key: "bberg", name: "Bartholomäberg Linie", kurz: "B", gruender: { vorname: "Johann Josef", nachname: "Mangeng", geb: "1738-06-09" } },
];
let stammlinienInfo = new Map();   // personId -> [{ key, gen, mann }]
let stammlinienGruender = {};      // key -> person
let stammlinienLauf = null;
function stammlinienBerechnenAus(personen, familien, kinder) {
  const byId = new Map(personen.map((p) => [p.id, p]));
  const famMap = new Map(familien.map((f) => [f.id, f]));
  const kinderVon = new Map();   // elternteil -> [kind]
  for (const k of kinder) {
    const f = famMap.get(k.familie_id); if (!f) continue;
    for (const e of [f.partner_a_id, f.partner_b_id]) if (e) { if (!kinderVon.has(e)) kinderVon.set(e, []); kinderVon.get(e).push(k.kind_id); }
  }
  const info = new Map(), gruender = {};
  for (const l of STAMMLINIEN) {
    const g = personen.find((p) => p.vorname === l.gruender.vorname && p.nachname === l.gruender.nachname && String(p.geburtsdatum || "").slice(0, 10) === l.gruender.geb);
    if (!g) continue;
    gruender[l.key] = g;
    const best = new Map([[g.id, { gen: 0, mann: true }]]);
    const schlange = [g.id];
    while (schlange.length) {
      const id = schlange.shift(); const st = best.get(id); const p = byId.get(id);
      const maennlich = /^m/i.test(String(p?.geschlecht || ""));
      for (const kid of kinderVon.get(id) || []) {
        const neu = { gen: st.gen + 1, mann: st.mann && maennlich };
        const alt = best.get(kid);
        if (!alt) { best.set(kid, neu); schlange.push(kid); }
        else if (neu.mann && !alt.mann) { alt.mann = true; alt.gen = Math.min(alt.gen, neu.gen); schlange.push(kid); }
      }
    }
    for (const [id, st] of best) { if (!info.has(id)) info.set(id, []); info.get(id).push({ key: l.key, gen: st.gen, mann: st.mann }); }
  }
  return { info, gruender };
}
async function stammlinienLaden() {
  if (stammlinienLauf) return stammlinienLauf;
  stammlinienLauf = (async () => {
    try {
      const [pe, fa, ki] = await Promise.all([
        alleZeilenLaden(() => sb.from("personen").select("id, vorname, nachname, geschlecht, geburtsdatum").order("id")),
        alleZeilenLaden(() => sb.from("familien").select("id, partner_a_id, partner_b_id").order("id")),
        alleZeilenLaden(() => sb.from("familien_kinder").select("familie_id, kind_id").order("kind_id")),
      ]);
      if (pe.error || fa.error || ki.error) return;
      const r = stammlinienBerechnenAus(pe.data || [], fa.data || [], ki.data || []);
      stammlinienInfo = r.info; stammlinienGruender = r.gruender;
      document.dispatchEvent(new CustomEvent("stammlinien-bereit"));
    } catch (e) { debugLog?.(`Stammlinien: ${e.message}`); }
    finally { setTimeout(() => { stammlinienLauf = null; }, 0); }
  })();
  return stammlinienLauf;
}
function stammlinienTitel(e) {
  const l = STAMMLINIEN.find((x) => x.key === e.key);
  return `${l?.name || e.key} · ${e.gen === 0 ? "Gründer" : `${e.gen}. Generation`} · ${e.mann ? "im Mannesstamm" : "über eine Tochter"}`;
}
function linienBadgesHtml(personId) {
  const list = stammlinienInfo.get(personId);
  if (!list?.length) return "";
  return list.map((e) => `<span class="linie-badge linie-${e.key}${e.mann ? "" : " is-tochter"}" title="${escapeHtml(stammlinienTitel(e))}">${STAMMLINIEN.find((x) => x.key === e.key)?.kurz || "?"}</span>`).join("");
}
function linienBadgesElement(personId) {
  const html = linienBadgesHtml(personId);
  if (!html) return null;
  const sp = document.createElement("span"); sp.className = "linie-badges"; sp.innerHTML = html; return sp;
}

function pruefPunktHtml(p) {
  if (!p || !rolleIstEigentuemer()) return "";
  if (!p.herkunft_quelle) return !pruefSpaltenVorhanden ? "" : `<span class="pruef-punkt is-eigen" role="img" title="selbst erfasst" aria-label="selbst erfasst"></span>`;
  const t = `${p.geprueft_am ? "geprüft" : "ungeprüft"} · aus ${p.herkunft_quelle}`;
  return `<span class="pruef-punkt ${p.geprueft_am ? "is-geprueft" : "is-offen"}" role="img" title="${escapeHtml(t)}" aria-label="${escapeHtml(t)}"></span>`;
}

// v369: Seite der Doppelseite im Kirchenbuch (links/rechts). Fehlen die Spalten (Paket 4 nicht eingespielt),
// wird ohne sie gespeichert, damit nichts verloren geht.
let kbSeiteVorhanden = true;
function istKbSeitenFehler(error) {
  return kbSeiteVorhanden && /_seite|todesumstand|partner_ohne|kinder_ohne/i.test(`${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`);
}
const ohneKbSeite = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !k.endsWith("_seite") && !k.startsWith("todesumstand") && k !== "partner_ohne_datenblatt" && k !== "kinder_ohne_datenblatt"));
async function mitKbSeite(bau) {
  let r = await bau(kbSeiteVorhanden);
  if (r?.error && istKbSeitenFehler(r.error)) {
    kbSeiteVorhanden = false;
    debugLog("ℹ️ Kirchenbuch-Seite nicht verfügbar (Spalten fehlen) – gespeichert ohne Seitenangabe.");
    r = await bau(false);
  }
  return r;
}
const kbSeiteWert = (id) => { const v = document.getElementById(id)?.value || ""; return v === "links" || v === "rechts" ? v : null; };
// v387: Fundstelle aus einem Matricula-Link lesbar machen, damit sie auch ohne funktionierenden Link
// erhalten bleibt (Matricula garantiert keine dauerhaften Links).
// …/de/oesterreich/vorarlberg/bartholomaeberg/429%252F3/?pg=61 → „Bartholomäberg · Buch 429/3 · Bild 61“
function matriculaFundstelle(url) {
  try {
    const u = new URL(String(url || "").trim());
    if (!/matricula-online\.eu$/i.test(u.hostname)) return null;
    const teile = u.pathname.split("/").filter(Boolean);
    const start = /^[a-z]{2}$/i.test(teile[0] || "") ? 1 : 0; // Sprache (de/en/…)
    const [land, dioezese, pfarre, buchRoh] = teile.slice(start);
    if (!pfarre) return null;
    let buch = buchRoh || "";
    for (let i = 0; i < 3 && /%/.test(buch); i++) { try { buch = decodeURIComponent(buch); } catch { break; } }
    buch = buch.replace(/\+/g, " ").trim();
    const kurz = buch.match(/(Tauf|Trauungs|Sterbe|Firm|Tot|Ehe)[a-zäöü]*buch\s*\d+[a-z]?/i); // „AT-ADF PA Bartholomaeberg Taufbuch 5“ → „Taufbuch 5“
    if (kurz) buch = kurz[0];
    const umlaute = (t) => t.replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü");
    const gross = (w) => w ? w[0].toUpperCase() + w.slice(1) : w;
    const klein = new Set(["mit", "und", "am", "an", "im", "in", "bei", "ob", "auf"]);
    const schoen = (t) => {
      const teile = umlaute(decodeURIComponent(String(t || ""))).split("-").filter(Boolean);
      const mitLeer = teile.some((w) => w === "st" || klein.has(w));
      return teile.map((w) => w === "st" ? "St." : klein.has(w) ? w : gross(w)).join(mitLeer ? " " : "-");
    };
    const bild = u.searchParams.get("pg");
    return { land: schoen(land), dioezese: schoen(dioezese), pfarre: schoen(pfarre), buch, bild,
      text: [schoen(pfarre), buch ? (/buch/i.test(buch) ? buch : `Buch ${buch}`) : "", bild ? `Bild ${bild}` : ""].filter(Boolean).join(" · ") };
  } catch { return null; }
}
function matriculaFundstelleSpan(url) {
  const f = matriculaFundstelle(url);
  if (!f) return null;
  const sp = document.createElement("span");
  sp.className = "person-view-book-quelle";
  sp.textContent = f.text;
  sp.title = `Matricula: ${[f.land, f.dioezese, f.pfarre].filter(Boolean).join(" → ")}${f.buch ? ` → ${f.buch}` : ""}${f.bild ? ` → Bild ${f.bild}` : ""}`;
  return sp;
}
function kbFundstelleText(seite, zeile) {
  const teile = [];
  if (seite === "links" || seite === "rechts") teile.push(`${seite === "links" ? "linke" : "rechte"} Seite`);
  if (zeile !== null && zeile !== undefined && String(zeile).trim() !== "") teile.push(`Zeile ${zeile}`);
  return teile.join(", ");
}

async function synchronisierePersonenDelta() {
  if (!personenCacheGeladen || !personenCacheSyncInitialisiert) return false;
  if (syncPruefungSeitCacheLaden) return false;
  if (syncLadePromise) return syncLadePromise;

  syncLadePromise = (async () => {
    egressMessung.syncPruefungen = Number(egressMessung.syncPruefungen || 0) + 1;
    egressMessung.syncFehler = "";
    egressMessung.syncLetzteZeit = Date.now();
    egressMessung.syncLetzteSeq = Number(personenCacheSyncSeq || 0);
    const aenderungen = await holeSyncAenderungenSeit(personenCacheSyncSeq);
    egressMessung.syncLetzteAenderungen = aenderungen.length;
    egressMessung.syncPersonenAktualisiert = 0;
    egressMessung.syncPersonenGeloescht = 0;
    egressMessung.syncBeziehungenAktualisiert = 0;
    speichereEgressMessung();
    aktualisiereEgressMessung();
    if (!aenderungen.length) {
      const aktuellerStand = await holeSyncMaxSeq();
      egressMessung.syncLetzteSeq = aktuellerStand;
      egressMessung.syncLetzterErfolgreicherLaufAenderungen = 0;
      egressMessung.syncLetzterErfolgreicherLaufSeq = aktuellerStand;
      egressMessung.syncLetzterErfolgreicherLaufAktualisiert = 0;
      egressMessung.syncLetzterErfolgreicherLaufGeloescht = 0;
      syncPruefungSeitCacheLaden = true;
      speichereEgressMessung();
      aktualisiereEgressMessung();
      return false;
    }

    const letzteAenderung = new Map();
    for (const a of aenderungen) {
      const key = `${a.tabelle}:${a.datensatz_id}`;
      letzteAenderung.set(key, a);
    }

    const personenAenderungen = [...letzteAenderung.values()].filter(a => a.tabelle === "personen");
    const zuLoeschendePersonen = new Set(personenAenderungen.filter(a => a.aktion === "DELETE").map(a => a.datensatz_id));
    const zuLadendePersonen = personenAenderungen.filter(a => a.aktion !== "DELETE").map(a => a.datensatz_id);

    if (zuLoeschendePersonen.size) {
      personenCache = personenCache.filter(p => !zuLoeschendePersonen.has(p.id));
      egressMessung.syncPersonenGeloescht = zuLoeschendePersonen.size;
      for (const id of zuLoeschendePersonen) {
        const karte = personenKartenCache.get(id);
        if (karte) karte.li.remove();
        personenKartenCache.delete(id);
      }
    }

    if (zuLadendePersonen.length) {
      const { data, error } = await personenMitPruefSpalten("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, Notiz, created_at, erstellt_am", (sp) => sb.from("personen")
        .select(sp)
        .in("id", [...new Set(zuLadendePersonen)]));
      if (error) throw error;
      const byId = new Map(personenCache.map(p => [p.id, p]));
      for (const person of data || []) byId.set(person.id, person);
      personenCache = [...byId.values()];
      egressMessung.syncPersonenAktualisiert = (data || []).length;
    }

    const familienGeaendert = [...letzteAenderung.values()].some(a =>
      a.tabelle === "familien" || a.tabelle === "familien_kinder" || a.tabelle === "beziehung"
    );
    if (familienGeaendert) {
      await ladeFamilienAusSupabaseFuerSync();
      egressMessung.syncBeziehungenAktualisiert = 1;
    }

    const fotosGeaendert = [...letzteAenderung.values()].some(a =>
      a.tabelle === "fotos" || a.tabelle === "foto_personen"
    );
    if (fotosGeaendert) {
      schluesselfotoCache.clear();
      schluesselfotoMetaCache.clear();
      schluesselfotoMetaGeladen = false;
    }

    baueAuswahlCachesAusSyncDaten();

    const neuerStand = await holeSyncMaxSeq();
    personenCacheSyncSeq = neuerStand;
    egressMessung.syncLetzteSeq = neuerStand;
    egressMessung.syncLetzterErfolgreicherLaufAenderungen = aenderungen.length;
    egressMessung.syncLetzterErfolgreicherLaufSeq = neuerStand;
    egressMessung.syncLetzterErfolgreicherLaufAktualisiert = egressMessung.syncPersonenAktualisiert;
    egressMessung.syncLetzterErfolgreicherLaufGeloescht = egressMessung.syncPersonenGeloescht;
    syncPruefungSeitCacheLaden = true;
    speichereEgressMessung();
    aktualisiereEgressMessung();
    await speicherePersonenImPersistentenCache({
      personen: personenCache,
      familien: familienAuswahlCache,
      familienKinder: familienKinderAuswahlCache,
      beziehungen: beziehungenAuswahlCache,
      syncSeq: personenCacheSyncSeq,
      syncInitialisiert: true
    });

    personenCacheZeitpunkt = Date.now();
    personenCacheQuelle = "localStorage";
    personenKartenCache.forEach((karte, id) => {
      const person = personenCache.find(p => p.id === id);
      if (person) aktualisierePersonenKarte(karte, person);
    });
    await renderPersonenList(personenCache);
    const suchfeld = document.getElementById("search-input");
    if (suchfeld?.value) window.partezettelPersonenSuche?.(suchfeld.value);
    aktualisierePersonenCacheStatus();
    debugLog(`🔄 Delta-Sync: ${aenderungen.length} Änderungen verarbeitet, neuer Stand seq ${personenCacheSyncSeq}.`);
    return true;
  })();

  try {
    return await syncLadePromise;
  } catch (err) {
    egressMessung.syncFehler = String(err?.message || err || "Unbekannter Fehler");
    speichereEgressMessung();
    aktualisiereEgressMessung();
    throw err;
  } finally {
    syncLadePromise = null;
  }
}

// ---------- Personenliste laden ----------
// ---------- v346: Ladehinweis beim Start ----------
// Zeigt in „Bestand“, was gerade passiert (Schritt, Dauer, Foto-Fortschritt) und erklärt, warum das erste Laden
// auf einem neuen Gerät länger dauert. Alle Schritte werden mit Zeit im technischen Protokoll festgehalten.
const ladeHinweis = { start: 0, timer: null, erstes: false, schritt: "", listeFertig: false, fotoBasis: null, ruhig: 0 };

function ladeHinweisFotoStand() {
  const basis = ladeHinweis.fotoBasis || { versuche: 0, fertig: 0 };
  const total = Math.max(0, (egressMessung.fotoNetzwerkVersuche || 0) - basis.versuche);
  const fertig = Math.max(0, (egressMessung.fotoNetzwerkErfolge || 0) + (egressMessung.fotoNetzwerkFehler || 0) - basis.fertig);
  return { total, fertig: Math.min(fertig, total) };
}

function ladeHinweisZeichnen() {
  const box = document.getElementById("lade-hinweis");
  if (!box) return;
  const sek = Math.round((performance.now() - ladeHinweis.start) / 1000);
  const foto = ladeHinweisFotoStand();
  const fotosLaufen = ladeHinweis.listeFertig && foto.total > foto.fertig;
  document.getElementById("lade-hinweis-titel").textContent = ladeHinweis.erstes
    ? "Erstes Laden auf diesem Gerät"
    : "Personenliste wird aktualisiert";
  document.getElementById("lade-hinweis-text").textContent = ladeHinweis.erstes
    ? "Die Personenliste und die Vorschaubilder werden einmalig aus der Datenbank geladen und danach auf diesem Gerät gespeichert. Das dauert beim ersten Mal je nach Verbindung etwas länger. Beim nächsten Start geht es deutlich schneller."
    : "Es wird nach Änderungen gesucht und die Liste aktualisiert.";
  const schritt = fotosLaufen ? `Vorschaubilder werden geladen: ${foto.fertig} von ${foto.total}` : ladeHinweis.schritt;
  document.getElementById("lade-hinweis-schritt").textContent = `${schritt} · ${sek} s`;
  box.hidden = false;
}

function ladeHinweisStart(erstes) {
  ladeHinweis.start = performance.now();
  ladeHinweis.erstes = !!erstes;
  ladeHinweis.schritt = "Verbindung zur Datenbank …";
  ladeHinweis.listeFertig = false;
  ladeHinweis.ruhig = 0;
  ladeHinweis.fotoBasis = {
    versuche: egressMessung.fotoNetzwerkVersuche || 0,
    fertig: (egressMessung.fotoNetzwerkErfolge || 0) + (egressMessung.fotoNetzwerkFehler || 0)
  };
  if (ladeHinweis.timer) clearInterval(ladeHinweis.timer);
  ladeHinweis.timer = setInterval(() => {
    ladeHinweisZeichnen();
    if (!ladeHinweis.listeFertig) return;
    const foto = ladeHinweisFotoStand();
    ladeHinweis.ruhig = foto.total > foto.fertig ? 0 : ladeHinweis.ruhig + 1;
    if (ladeHinweis.ruhig >= 3) ladeHinweisEnde();   // seit 3 Sekunden nichts mehr offen
  }, 1000);
  ladeHinweisZeichnen();
  debugLog(`⏱ Laden gestartet (${erstes ? "erstes Laden auf diesem Gerät" : "Aktualisierung"}), ${Math.round(performance.now() / 100) / 10} s nach Seitenstart.`);
}

function ladeHinweisSchritt(text) {
  ladeHinweis.schritt = text;
  debugLog(`⏱ ${text} (${Math.round((performance.now() - ladeHinweis.start) / 100) / 10} s)`);
  ladeHinweisZeichnen();
}

function ladeHinweisListeFertig() {
  ladeHinweis.listeFertig = true;
  ladeHinweis.schritt = "Liste fertig";
  debugLog(`⏱ Liste fertig nach ${Math.round((performance.now() - ladeHinweis.start) / 100) / 10} s (${Math.round(performance.now() / 100) / 10} s nach Seitenstart).`);
  ladeHinweisZeichnen();
}

function ladeHinweisEnde() {
  if (ladeHinweis.timer) { clearInterval(ladeHinweis.timer); ladeHinweis.timer = null; }
  const box = document.getElementById("lade-hinweis");
  if (box) box.hidden = true;
  const foto = ladeHinweisFotoStand();
  debugLog(`⏱ Laden abgeschlossen nach ${Math.round((performance.now() - ladeHinweis.start) / 100) / 10} s, Vorschaubilder: ${foto.fertig} von ${foto.total}.`);
}

let personenKeineDaten = false;   // true: Datenbank hat 0 Personen ohne Fehler geliefert

async function ladeHinweisKeineDaten() {
  personenKeineDaten = true;
  if (ladeHinweis.timer) { clearInterval(ladeHinweis.timer); ladeHinweis.timer = null; }
  let konto = "";
  try {
    const { data: { session } } = await sb.auth.getSession();
    konto = session?.user?.email || "";
  } catch (_) { /* nicht kritisch */ }
  const rolle = zugang && !zugang.kompatibel ? ` (Rolle: ${ROLLEN_NAMEN[zugang.rolle] || zugang.rolle})` : "";
  debugLog(`⚠️ Die Datenbank hat 0 Personen geliefert, ohne Fehlermeldung. Angemeldet als ${konto || "unbekannt"}${rolle}. Vermutlich darf dieses Konto die Daten (noch) nicht lesen – oder die Datenbank ist leer.`);
  const box = document.getElementById("lade-hinweis");
  if (!box) return;
  document.getElementById("lade-hinweis-titel").textContent = "Keine Personen sichtbar";
  document.getElementById("lade-hinweis-text").textContent = "Die Datenbank hat keine Personen geliefert und keine Fehlermeldung gemeldet. Entweder ist sie leer, oder dieses Konto darf die Daten noch nicht lesen. Bitte den Eigentümer informieren und das technische Protokoll mitschicken.";
  document.getElementById("lade-hinweis-schritt").textContent = konto ? `Abgefragt als ${konto}${rolle}` : "Konto unbekannt";
  box.hidden = false;
}

function ladeHinweisFehler(text) {
  if (ladeHinweis.timer) { clearInterval(ladeHinweis.timer); ladeHinweis.timer = null; }
  const box = document.getElementById("lade-hinweis");
  if (!box) return;
  document.getElementById("lade-hinweis-titel").textContent = "Laden hat nicht geklappt";
  document.getElementById("lade-hinweis-text").textContent = "Bitte die Verbindung prüfen und mit „Aktualisieren“ erneut versuchen. Das technische Protokoll zeigt, wo es hängt.";
  document.getElementById("lade-hinweis-schritt").textContent = text;
  box.hidden = false;
}

document.addEventListener("DOMContentLoaded", () => {
  // Protokoll direkt aus dem Ladehinweis öffnen
  document.getElementById("lade-hinweis-log")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="erfassen"]')?.click();
    const panel = document.querySelector("details.debug-panel");
    if (panel) { panel.open = true; panel.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  // Protokoll in die Zwischenablage kopieren (zum Weitergeben bei Problemen)
  document.getElementById("debug-copy")?.addEventListener("click", async () => {
    const text = debugLogZeilen.join("\n") + "\n";
    const knopf = document.getElementById("debug-copy");
    try {
      await navigator.clipboard.writeText(text);
      knopf.textContent = "Kopiert ✓";
    } catch (err) {
      const bereich = document.createElement("textarea");
      bereich.value = text; document.body.appendChild(bereich); bereich.select();
      try { document.execCommand("copy"); knopf.textContent = "Kopiert ✓"; } catch (_) { knopf.textContent = "Kopieren nicht möglich"; }
      bereich.remove();
    }
    setTimeout(() => { knopf.textContent = "Protokoll kopieren"; }, 2500);
  });
});

async function loadPersonen(force = false) {
  if (force) {
    syncPruefungSeitCacheLaden = false;
    schluesselfotoCache.clear();
    schluesselfotoMetaCache.clear();
    schluesselfotoMetaGeladen = false;
  }
  const banner = document.getElementById("pending-banner");
  try {
    await ensureSession();
  } catch (err) {
    const msg = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    if (banner) { banner.hidden = false; banner.textContent = `Fehler beim Laden: ${msg}`; }
    debugLog(`❌ Personen laden: ${msg}`);
    return;
  }

  // Innerhalb derselben Sitzung zuerst nur den Änderungsstand prüfen.
  if (!force && personenCacheGeladen) {
    if (personenCacheSyncInitialisiert) {
      try {
        await synchronisierePersonenDelta();
      } catch (syncErr) {
        debugLog(`⚠️ Delta-Sync: ${syncErr.message || syncErr}`);
      }
    }
    aktualisierePersonenCacheStatus();
    await renderPersonenList(personenCache);
    const empty = document.getElementById("list-empty");
    if (empty) empty.hidden = personenCache.length > 0;
    return;
  }
  // Nach einem Safari-Neustart zuerst den dauerhaften Cache laden.
  // Ein älterer Cache ohne syncSeq wird einmalig vollständig aktualisiert,
  // damit der erste Synchronisationsstand sicher gesetzt wird.
  let ersteLadung = true;
  if (!force) {
    const lokalGeladen = await ladePersonenAusPersistentemCache();
    ersteLadung = !lokalGeladen;
    const cacheOhnePruefFelder = lokalGeladen && pruefSpaltenVorhanden && personenCache.length > 0 && !personenCache.some((p) => Object.prototype.hasOwnProperty.call(p, "geprueft_am"));
    if (cacheOhnePruefFelder) debugLog("ℹ️ Cache ohne Prüf-Kennzeichen: einmalige vollständige Aktualisierung.");
    // v373: Ein Cache aus der Zeit vor dem seitenweisen Laden kann bei 1000 Personen abgeschnitten sein.
    const cacheAbgeschnitten = lokalGeladen && !personenCacheSeitenweise;
    if (cacheAbgeschnitten) debugLog("ℹ️ Gespeicherte Personenliste stammt aus einer älteren Version: einmalige vollständige Aktualisierung.");
    if (lokalGeladen && personenCacheSyncInitialisiert && !cacheOhnePruefFelder && !cacheAbgeschnitten) {
      try {
        await synchronisierePersonenDelta();
      } catch (syncErr) {
        debugLog(`⚠️ Delta-Sync nach Cache-Laden: ${syncErr.message || syncErr}`);
      }
      // v373: Anzahl gegen die Datenbank prüfen; weicht sie ab, die Liste einmal vollständig neu laden.
      try {
        const { count, error: countError } = await sb.from("personen").select("id", { count: "exact", head: true });
        if (!countError && Number.isFinite(count) && count !== personenCache.length) {
          debugLog(`ℹ️ Personenliste unvollständig (${personenCache.length} statt ${count}): vollständige Aktualisierung.`);
          return loadPersonen(true);
        }
      } catch (countErr) {
        debugLog(`⚠️ Anzahl prüfen: ${countErr.message || countErr}`);
      }
      return;
    }
    if (lokalGeladen && !personenCacheSyncInitialisiert) {
      debugLog("ℹ️ Alter Cache ohne Sync-Stand: einmalige Aktualisierung wird durchgeführt.");
    }
  }

  if (personenLadePromise) return personenLadePromise;

  personenLadePromise = (async () => {
    const list = document.getElementById("personen-list");
    const empty = document.getElementById("list-empty");
    egressMessung.personenSupabaseAbrufe++;
    speichereEgressMessung();
    aktualisiereEgressMessung();
    ladeHinweisStart(ersteLadung && !force);
    ladeHinweisSchritt("Personen werden abgerufen");
    const { data, error } = await personenMitPruefSpalten("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, Notiz, created_at, erstellt_am", (sp) => alleZeilenLaden(() => sb
      .from("personen")
      .select(sp)
      .order("nachname", { ascending: true })
      .order("id", { ascending: true })));

    if (error) throw error;

    personenCache = data || [];
    ladeHinweisSchritt(`${personenCache.length} Personen empfangen${personenCache.length ? ", Beziehungen werden abgerufen" : ""}`);
    if (!personenCache.length) {
      // Keine Daten sichtbar: nichts als „geladen“ speichern, damit ein späterer Versuch alles neu lädt.
      personenCacheGeladen = false;
      personenCacheSyncInitialisiert = false;
      personenCacheQuelle = "";
      aktualisierePersonenCacheStatus();
      await ladeHinweisKeineDaten();
      await renderPersonenList(personenCache);
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Keine Personen sichtbar. Dieses Konto hat möglicherweise noch keinen Zugriff auf die Daten.";
      }
      return;
    }
    personenKeineDaten = false;
    try {
      const [{ data: familien }, { data: familienKinder }, { data: beziehungen }] = await Promise.all([
        alleZeilenLaden(() => sb.from("familien").select("*").order("id")),
        alleZeilenLaden(() => sb.from("familien_kinder").select("familie_id, kind_id").order("familie_id").order("kind_id")),
        alleZeilenLaden(() => sb.from("beziehung").select("personen_a_id, personen_b_id, beziehungstyp").order("personen_a_id").order("personen_b_id"))
      ]);
      familienAuswahlCache = familien || [];
      partnerIdsAuswahlCache = new Set();
      for (const f of familienAuswahlCache) {
        const typ = String(f.familientyp || "").toLowerCase();
        if ((typ === "ehe" || typ === "partnerschaft") && !partnerschaftIstBeendet(f, personenCache)) {
          if (f.partner_a_id) partnerIdsAuswahlCache.add(f.partner_a_id);
          if (f.partner_b_id) partnerIdsAuswahlCache.add(f.partner_b_id);
        }
      }
      for (const b of beziehungen || []) {
        if (b.beziehungstyp === "Ehe" || b.beziehungstyp === "Partnerschaft") {
          if (b.personen_a_id) partnerIdsAuswahlCache.add(b.personen_a_id);
          if (b.personen_b_id) partnerIdsAuswahlCache.add(b.personen_b_id);
        }
      }
      const kinderByFamilie = new Map();
      for (const k of familienKinder || []) {
        if (!kinderByFamilie.has(k.familie_id)) kinderByFamilie.set(k.familie_id, []);
        kinderByFamilie.get(k.familie_id).push(k.kind_id);
      }
      for (const f of familien || []) f._kinder = kinderByFamilie.get(f.id) || [];

      personenVerwandtschaftCache = new Map(personenCache.map((p) => [p.id, {
        eltern: new Set(),
        ehePartnerschaften: new Set(),
        kinder: new Set(),
      }]));
      for (const fk of familienKinder || []) {
        const familie = (familien || []).find((f) => f.id === fk.familie_id);
        if (!familie || !fk.kind_id) continue;
        const info = personenVerwandtschaftCache.get(fk.kind_id);
        if (!info) continue;
        for (const partnerId of [familie.partner_a_id, familie.partner_b_id]) {
          if (partnerId && partnerId !== fk.kind_id) info.eltern.add(partnerId);
        }
      }
      for (const familie of familien || []) {
        const typ = String(familie.familientyp || '').trim().toLocaleLowerCase('de');
        const istEheOderPartnerschaft = typ === 'ehe' || typ === 'partnerschaft';
        for (const partnerId of [familie.partner_a_id, familie.partner_b_id]) {
          if (!partnerId) continue;
          const info = personenVerwandtschaftCache.get(partnerId);
          if (!info) continue;
          if (istEheOderPartnerschaft) info.ehePartnerschaften.add(familie.id);
          for (const kindId of familie._kinder || []) {
            if (kindId && kindId !== partnerId) info.kinder.add(kindId);
          }
        }
      }
      berechneFamilienSortKeys(personenCache, familien || []);

      // Den vollständigen, funktional nötigen Personen-/Auswahlcache dauerhaft sichern.
      familienKinderAuswahlCache = familienKinder || [];
      beziehungenAuswahlCache = beziehungen || [];
      ladeHinweisSchritt("Änderungsstand wird gelesen und auf diesem Gerät gespeichert");
      let syncSeqNachLaden = 0;
      try { syncSeqNachLaden = await holeSyncMaxSeq(); } catch (syncErr) { debugLog(`⚠️ Sync-Stand konnte nicht gelesen werden: ${syncErr.message || syncErr}`); }
      personenCacheSyncSeq = syncSeqNachLaden;
      personenCacheSyncInitialisiert = true;
      await speicherePersonenImPersistentenCache({
        personen: personenCache,
        familien: familienAuswahlCache,
        familienKinder: familienKinderAuswahlCache,
        beziehungen: beziehungenAuswahlCache,
        syncSeq: personenCacheSyncSeq,
        syncInitialisiert: true
      });
      personenCacheQuelle = "Supabase";
    } catch (familyErr) {
      debugLog(`⚠️ Familien-Sortierung: ${familyErr.message}`);
    }
    personenCacheQuelle = "Supabase";
    personenCacheGeladen = true;
    personenCacheZeitpunkt = Date.now();
    aktualisierePersonenCacheStatus();
    debugLog(`✅ Personen-Cache geladen: ${personenCache.length} Personen.`);
    if (banner) banner.hidden = true;
    ladeHinweisSchritt("Liste wird aufgebaut");
    await renderPersonenList(personenCache);
    if (empty) empty.hidden = personenCache.length > 0;
    ladeHinweisListeFertig();
    // Falls der Nutzer schon während des Ladevorgangs in das Suchfeld
    // geschrieben hat, die aktuelle Eingabe nach dem Cache-Aufbau sofort
    // anwenden. Dadurch geht kein erster Buchstabe verloren.
    const suchfeldNachLaden = document.getElementById("search-input");
    if (suchfeldNachLaden?.value) {
      window.partezettelPersonenSuche?.(suchfeldNachLaden.value);
    }
  })();

  try {
    await personenLadePromise;
  } catch (err) {
    console.error(err);
    if (banner) { banner.hidden = false; banner.textContent = `Fehler beim Laden: ${err.message || err}`; }
    debugLog(`❌ Personen laden: ${err.message || err}`);
    ladeHinweisFehler(String(err.message || err));
  } finally {
    personenLadePromise = null;
  }
}

// v431: Nach dem Speichern sofort überall verfügbar (Bestand, Suche, Stammbaum, Personenauswahl, Chronik).
// Bisher prüfte der Abgleich nur einmal pro Sitzung auf Änderungen – neue Personen erschienen erst nach „Aktualisieren“.
// v447: Während Bearbeiten/Ansicht offen sind, wird die Bestandsliste nicht im Hintergrund neu gezeichnet,
// sondern erst, wenn sie wieder sichtbar wird.
function bestandNachziehen() {
  if (!bestandNeuZeichnenNoetig) return;
  bestandNeuZeichnenNoetig = false;
  renderPersonenList(personenCache).catch((e) => debugLog(`⚠️ Bestand nachzeichnen: ${e.message || e}`));
}
document.addEventListener("click", (e) => {
  if (e.target.closest?.('.tab-btn[data-tab="liste"]')) setTimeout(bestandNachziehen, 0);
});
let personenNachSpeichernLauf = null;
async function personenNachSpeichern(neueId = null) {
  if (personenNachSpeichernLauf) await personenNachSpeichernLauf.catch(() => {});
  personenNachSpeichernLauf = (async () => {
    syncPruefungSeitCacheLaden = false;
    // v447: Ist das Bearbeiten-Fenster noch offen, nur die Daten abgleichen; die Bestandsliste dahinter
    // wird erst nach dem Schließen neu gezeichnet (spart beim Speichern rund eine Sekunde Blockade).
    const fensterOffen = !document.getElementById("detail-overlay")?.hidden;
    try {
      if (fensterOffen && personenCacheGeladen && personenCacheSyncInitialisiert) {
        await synchronisierePersonenDelta();
        bestandNeuZeichnenNoetig = true;
      } else await loadPersonen();
    } catch (e) { debugLog(`⚠️ Bestand nach Speichern: ${e.message || e}`); }
    // Sicherheitsnetz: fehlt die neue Person noch, direkt holen und einfügen
    if (neueId && !personenCache.some((x) => x.id === neueId)) {
      try {
        const { data } = await sb.from("personen").select("*").eq("id", neueId).maybeSingle();
        if (data) { personenCache.push(data); if (fensterOffen) bestandNeuZeichnenNoetig = true; else await renderPersonenList(personenCache); }
      } catch (e) { debugLog(`⚠️ Neue Person nachladen: ${e.message || e}`); }
    }
    treeDataGeladenAm = 0;
    try { if (typeof chronikCache !== "undefined") chronikCache = null; } catch {}
    if (treeData.personen.length) {
      try { await loadStammbaumData(); } catch (e) { debugLog(`⚠️ Stammbaum nach Speichern: ${e.message || e}`); }
    }
  })();
  return personenNachSpeichernLauf;
}

// v453: Person sofort aus Liste und Zwischenspeicher nehmen (nach dem Löschen oder wenn es sie nicht mehr gibt)
function personAusListeEntfernen(id) {
  personenCache = (personenCache || []).filter((p) => p.id !== id);
  const karte = personenKartenCache.get(id);
  if (karte) karte.li.remove();
  personenKartenCache.delete(id);
  try { if (Array.isArray(treeData?.personen)) treeData.personen = treeData.personen.filter((p) => p.id !== id); } catch {}
}
// Eine Person steht noch in der Liste, existiert in der Datenbank aber nicht mehr („Geist“):
// aus der Liste nehmen und die Liste einmal vollständig neu laden, damit auch der gespeicherte Stand stimmt.
async function personNichtMehrVorhanden(id) {
  personAusListeEntfernen(id);
  document.getElementById("person-view-overlay")?.setAttribute("hidden", "");
  document.body.classList.remove("person-view-open");
  const banner = document.getElementById("pending-banner");
  if (banner) { banner.hidden = false; banner.textContent = "Diese Person gibt es nicht mehr (bereits gelöscht) – die Liste wird aktualisiert …"; setTimeout(() => { banner.hidden = true; }, 5000); }
  debugLog(`ℹ️ Person ${id} existiert nicht mehr – Liste wird vollständig neu geladen.`);
  try { await loadPersonen(true); } catch (e) { debugLog(`⚠️ Neu laden: ${e.message || e}`); }
}

function invalidierePersonenCache() {
  personenCacheGeladen = false;
  personenCacheZeitpunkt = 0;
  personenCacheQuelle = "";
  aktualisierePersonenCacheStatus();
}

function aktualisierePersonenCacheStatus() {
  const btn = document.getElementById("refresh-btn");
  if (!btn) return;
  let text = "Aktualisieren";
  if (personenCacheGeladen) {
    const zeit = personenCacheZeitpunkt ? new Date(personenCacheZeitpunkt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
    const lokal = personenCacheQuelle === "localStorage" || personenCacheQuelle === "IndexedDB";
    text = `Aktualisieren – ${personenCache.length} Personen geladen${zeit ? ` um ${zeit}` : ""} (${lokal ? "lokal" : "Supabase"})`;
  }
  btn.title = text;
  btn.setAttribute("aria-label", text);
}

const schluesselfotoCache = new Map(); // personenId -> { url, gueltigBis }
const schluesselfotoMetaCache = new Map(); // personenId -> dateipfad | null
let schluesselfotoMetaGeladen = false;
const schluesselfotoLadePromise = { value: null };
const schluesselfotoMetaPromise = { value: null };
const personenKartenCache = new Map(); // personenId -> { li, img, placeholder, name, years, relations, note }
let schluesselfotoObserver = null;

async function ladeSchluesselfotoMetadaten(force = false) {
  if (!force && schluesselfotoMetaGeladen) return;
  if (schluesselfotoMetaPromise.value) {
    await schluesselfotoMetaPromise.value;
    return;
  }

  schluesselfotoMetaPromise.value = (async () => {
    const { data, error } = await sb.from("fotos")
      .select("personen_id, dateipfad")
      .eq("ist_schluesselfoto", true);
    if (error) {
      debugLog(`❌ Schlüsselfoto-Metadaten laden: ${error.message}`);
      return;
    }

    schluesselfotoMetaCache.clear();
    for (const foto of data || []) {
      if (foto?.personen_id) schluesselfotoMetaCache.set(foto.personen_id, foto.dateipfad || null);
    }
    schluesselfotoMetaGeladen = true;
  })();

  try { await schluesselfotoMetaPromise.value; }
  finally { schluesselfotoMetaPromise.value = null; }
}

async function ladeSchluesselfotos(personen, force = false) {
  if (!personen.length) return;
  await ladeSchluesselfotoMetadaten(force);

  const jetzt = Date.now();
  const fehlende = personen.filter((p) => {
    const pfad = schluesselfotoMetaCache.get(p.id);
    const eintrag = schluesselfotoCache.get(p.id);
    if (!pfad) {
      schluesselfotoCache.delete(p.id);
      return false;
    }
    return force || !eintrag || eintrag.gueltigBis <= jetzt || eintrag.pfad !== pfad;
  });
  if (!fehlende.length) return;
  if (schluesselfotoLadePromise.value) {
    await schluesselfotoLadePromise.value.catch(() => {});
    return ladeSchluesselfotos(personen, force);   // v444: danach die eigenen Fotos auch wirklich laden
  }

  schluesselfotoLadePromise.value = (async () => {
    const fotos = fehlende
      .map(p => ({ personenId: p.id, dateipfad: schluesselfotoMetaCache.get(p.id) }))
      .filter(f => f.dateipfad);
    if (!fotos.length) return;

    const pfade = [...new Set(fotos.map(f => f.dateipfad))];
    const urlByPath = await ladeFotoBilder(pfade);
    const gueltigBis = Date.now() + (55 * 60 * 1000);
    for (const foto of fotos) {
      const url = urlByPath.get(foto.dateipfad);
      if (url) schluesselfotoCache.set(foto.personenId, { url, pfad: foto.dateipfad, gueltigBis });
    }
  })();

  try { await schluesselfotoLadePromise.value; }
  finally { schluesselfotoLadePromise.value = null; }
}

function setzeSchluesselfotoInKarte(personenId) {
  const karte = personenKartenCache.get(personenId);
  if (!karte || !karte.img) return;
  const fotoEintrag = schluesselfotoCache.get(personenId);
  const fotoUrl = typeof fotoEintrag === "string" ? fotoEintrag : (fotoEintrag?.url || "");
  if (fotoUrl) {
    if (karte.img.src !== fotoUrl) {
      egressMessung.urlSetzungen++;
      if (!egressMessung.uniqueAssignedUrls.includes(fotoUrl)) {
        egressMessung.uniqueAssignedUrls.push(fotoUrl);
        egressMessung.eindeutigeURLSetzungen++;
      }
      speichereEgressMessung();
      karte.img.dataset.egressDebugUrl = fotoUrl;
      karte.img.src = fotoUrl;
      aktualisiereEgressMessung();
    }
    karte.img.hidden = false;
    karte.placeholder.hidden = true;
  } else {
    karte.img.removeAttribute("src");
    karte.img.hidden = true;
    karte.placeholder.hidden = false;
  }
}

function beobachteSchluesselfotos() {
  const list = document.getElementById("personen-list");
  if (!list) return;

  if (schluesselfotoObserver) schluesselfotoObserver.disconnect();
  if (!("IntersectionObserver" in window)) {
    const personen = [...personenKartenCache.values()]
      .filter(k => !k.li.hidden)
      .map(k => k.person)
      .filter(Boolean);
    ladeSchluesselfotos(personen).then(() => {
      personen.forEach(p => setzeSchluesselfotoInKarte(p.id));
    });
    return;
  }

  schluesselfotoObserver = new IntersectionObserver((entries) => {
    const sichtbar = entries
      .filter(entry => entry.isIntersecting)
      .map(entry => personenKartenCache.get(entry.target.dataset.personId)?.person)
      .filter(Boolean);
    if (!sichtbar.length) return;
    ladeSchluesselfotos(sichtbar).then(() => {
      sichtbar.forEach(p => setzeSchluesselfotoInKarte(p.id));
    });
  }, { root: null, rootMargin: "600px 0px", threshold: 0 });   // v444: Bildschirm statt ganzer Liste – nur Fotos in der Nähe laden

  for (const karte of personenKartenCache.values()) schluesselfotoObserver.observe(karte.li);
}

function erstellePersonenKarte(p) {
  const li = document.createElement("li");
  li.className = "person-card";
  li.dataset.personId = p.id;
  li.setAttribute("role", "button");
  li.setAttribute("tabindex", "0");
  li.setAttribute("aria-label", `Details zu ${[p.vorname, p.nachname].filter(Boolean).join(" ")}`);

  const fotoEintrag = schluesselfotoCache.get(p.id);
  const fotoUrl = typeof fotoEintrag === "string" ? fotoEintrag : (fotoEintrag?.url || "");
  const img = document.createElement("img");
  img.className = "person-card__photo";
  img.alt = `Schlüsselfoto von ${p.vorname} ${p.nachname}`;
  img.loading = "lazy";
  img.decoding = "async";
  img.hidden = !fotoUrl;
  if (fotoUrl) img.src = fotoUrl;

  const placeholder = document.createElement("div");
  placeholder.className = "person-card__photo-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.textContent = "👤";
  placeholder.hidden = !!fotoUrl;

  const content = document.createElement("div");
  content.className = "person-card__content";
  const name = document.createElement("div");
  name.className = "person-card__name";
  const years = document.createElement("div");
  years.className = "person-card__years";
  const relations = document.createElement("div");
  relations.className = "person-card__relations";
  const note = document.createElement("div");
  note.className = "person-card__note";

  const audioToggle = document.createElement("button");
  audioToggle.type = "button";
  audioToggle.className = "btn btn--ghost person-card__audio-toggle";
  audioToggle.textContent = "🎙️ Sprachnotizen";
  audioToggle.setAttribute("aria-expanded", "false");
  const audioPanel = document.createElement("div");
  audioPanel.className = "person-card__audio-panel";
  audioPanel.hidden = true;
  content.append(name, years, relations, note, audioToggle, audioPanel);
  li.append(img, placeholder, content);
  audioToggle.addEventListener("click", async (event) => {
    event.stopPropagation();
    const öffnen = audioPanel.hidden;
    audioPanel.hidden = !öffnen;
    audioToggle.setAttribute("aria-expanded", String(öffnen));
    if (öffnen) await ladeBestandsSprachnotizen(p.id, audioPanel);
  });
  // iOS/Safari: Karten explizit als bedienbare Elemente behandeln. Der Click
  // bleibt die zentrale Aktion; Enter/Leertaste ergänzen Tastaturbedienung.
  li.addEventListener("click", (event) => {
    if (event.target.closest("a,button,input,select,textarea,audio")) return;
    openPersonDetail(p.id);
  });
  li.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPersonDetail(p.id);
  });

  const karte = { li, img, placeholder, name, years, relations, note, audioToggle, audioPanel, person: p };
  personenKartenCache.set(p.id, karte);
  aktualisierePersonenKarte(karte, p);
  return karte;
}

// v443: Fingerabdruck einer Karte – ändert sich nichts, wird die Karte nicht neu befüllt
function personenKartenSignatur(p) {
  const v = personenVerwandtschaftCache.get(p.id);
  const l = typeof stammlinienInfo !== "undefined" ? stammlinienInfo.get(p.id) : null;
  const k = typeof kbUebersicht !== "undefined" ? kbUebersicht.get(p.id) : null;
  return `${JSON.stringify(p)}|${l ? JSON.stringify(l) : ""}|${k ? JSON.stringify(k) : ""}|${v ? `${v.eltern?.size}/${v.ehePartnerschaften?.size}/${v.kinder?.size}` : ""}|${rolleIstEigentuemer() ? 1 : 0}|${new Date().toDateString()}`;
}
function aktualisierePersonenKarte(karte, p) {
  const signatur = personenKartenSignatur(p);
  if (karte.signatur === signatur) { karte.person = p; setzeSchluesselfotoInKarte(p.id); return; }
  karte.signatur = signatur;
  karte.person = p;
  karte.li.dataset.personId = p.id;
  karte.name.textContent = `${p.vorname || ""} ${p.nachname || ""}`.trim();
  const punkt = pruefPunkt(p);
  if (punkt) karte.name.prepend(punkt);
  { const lb = linienBadgesElement(p.id); if (lb) karte.name.appendChild(lb); }
  { const kb = kbChipsElement(p.id); if (kb) karte.name.appendChild(kb); }   // v412
  const kartenLedigenname = String(p.Ledigenname || p.ledigenname || "").trim();
  if (kartenLedigenname) {
    const maiden = document.createElement("span");
    maiden.className = "person-card__maiden";
    maiden.textContent = ` (geb. ${kartenLedigenname})`;
    karte.name.appendChild(maiden);
  }
  if (istNurName(p)) {
    const nn = document.createElement("span");
    nn.className = "nurname-badge"; nn.textContent = "nur Name"; nn.title = "Keine Lebensdaten bekannt";
    karte.name.appendChild(nn);
  }
  karte.img.alt = `Schlüsselfoto von ${p.vorname || ""} ${p.nachname || ""}`.trim();

  const sterbeJahrAnzeige = p.sterbedatum
    ? p.sterbedatum.split("-")[0]
    : (p.sterbejahr ? String(p.sterbejahr) : "");
  const jahre = [
    p.geburtsdatum ? p.geburtsdatum.split("-")[0] : (p.geburtsjahr ? String(p.geburtsjahr) : ""),
    sterbeJahrAnzeige
  ].filter(Boolean).join(" – ");
  const alterAnzeige = (todesumstandText(p) && !(p.sterbedatum || p.sterbejahr)) ? "" : lebensalterAnzeige(p);
  karte.years.textContent = [`${jahre}${jahre && alterAnzeige ? " · " : ""}${alterAnzeige}`, todesumstandText(p)].filter(Boolean).join(" · ");
  karte.years.hidden = !karte.years.textContent;

  const verwandtschaft = personenVerwandtschaftCache.get(p.id);
  const elternAnzahl = verwandtschaft?.eltern?.size || 0;
  const ehePartnerschaftenAnzahl = verwandtschaft?.ehePartnerschaften?.size || 0;
  const kinderAnzahl = verwandtschaft?.kinder?.size || 0;
  karte.relations.textContent = `👥 Eltern: ${elternAnzahl} · 💍 Ehe/Partn.: ${ehePartnerschaftenAnzahl} · 👶 Kinder: ${kinderAnzahl}`;
  karte.relations.setAttribute("aria-label", `Verwandtschaft: Eltern ${elternAnzahl}, Ehe oder Partnerschaften ${ehePartnerschaftenAnzahl}, Kinder ${kinderAnzahl}`);

  karte.note.textContent = p.Notiz || "";
  karte.note.hidden = !p.Notiz;
  setzeSchluesselfotoInKarte(p.id);
}

// v292: Diktiergerät-Bedienung mit gut sichtbarer Aufnahmedauer direkt im Bestand.
// Sprachnotizen direkt in der Bestandskarte – unabhängig vom Bearbeitungsmodus.
const bestandsAudioRecorder = new Map();
async function ladeBestandsSprachnotizen(personId, panel) {
  panel.innerHTML = "";
  const status = document.createElement("p");
  status.className = "person-card__audio-status";
  status.textContent = "Sprachnotizen werden geladen …";
  panel.appendChild(status);
  const { data, error } = await sb.from("sprachnotizen")
    .select("id, dateipfad, dauer_sekunden").eq("person_id", personId);
  panel.innerHTML = "";
  if (error) {
    status.textContent = `Fehler beim Laden: ${error.message}`;
    panel.appendChild(status);
    return;
  }
  if (!data || !data.length) {
    const leer = document.createElement("p");
    leer.className = "person-card__audio-status";
    leer.textContent = "Noch keine Sprachnotizen vorhanden.";
    panel.appendChild(leer);
  }
  for (const item of data || []) {
    const row = document.createElement("div");
    row.className = "person-card__audio-item";
    const player = document.createElement("audio");
    player.controls = true;
    player.preload = "none";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn--ghost";
    del.textContent = "🗑️";
    del.title = "Sprachnotiz löschen";
    del.setAttribute("aria-label", "Sprachnotiz löschen");
    player.addEventListener("play", async (event) => {
      if (player.src) return;
      event.preventDefault();
      try {
        const { data: signed, error: signedError } = await sb.storage.from(BUCKET_AUDIO).createSignedUrl(item.dateipfad, 3600);
        if (signedError || !signed?.signedUrl) throw new Error(signedError?.message || "Keine Audio-URL erhalten");
        player.src = signed.signedUrl;
        player.load();
        await player.play();
      } catch (err) {
        status.textContent = `Abspielen fehlgeschlagen: ${err.message || err}`;
      }
    });
    del.dataset.rolle = "eigentuemer";
    del.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!darfLoeschen("Sprachnotizen löschen")) return;
      if (!confirm(papierkorbAktiv ? "Diese Sprachnotiz in den Papierkorb legen? (30 Tage wiederherstellbar)" : "Diese Sprachnotiz unwiderruflich löschen?")) return;
      const { error: storageError } = papierkorbAktiv ? { error: null } : await sb.storage.from(BUCKET_AUDIO).remove([item.dateipfad]);
      if (storageError) { status.textContent = `Fehler beim Löschen: ${storageError.message}`; return; }
      const { error: dbError } = await sb.from("sprachnotizen").delete().eq("id", item.id);
      if (dbError) { status.textContent = `Fehler beim Löschen: ${dbError.message}`; return; }
      await ladeBestandsSprachnotizen(personId, panel);
    });
    row.append(player, del);
    panel.appendChild(row);
  }
  const actions = document.createElement("div");
  actions.className = "person-card__audio-actions";
  const record = document.createElement("button");
  record.type = "button";
  record.className = "btn btn--secondary";
  record.textContent = "🎙️ Aufnahme starten";
  const message = document.createElement("span");
  message.className = "person-card__audio-status";
  actions.append(record, message);
  panel.appendChild(actions);

  record.addEventListener("click", async (event) => {
    event.stopPropagation();
    let state = bestandsAudioRecorder.get(personId);
    if (state?.recorder?.state === "recording") {
      state.recorder.pause();
      state.paused = true;
      record.textContent = "▶️ Fortsetzen";
      message.textContent = "Aufnahme pausiert";
      return;
    }
    if (state?.recorder?.state === "paused") {
      state.recorder.resume();
      state.paused = false;
      record.textContent = "⏸️ Pause";
      message.textContent = "Aufnahme läuft · 00:00";
      return;
    }
    if (state?.recorder?.state === "inactive" && state.finished) {
      bestandsAudioRecorder.delete(personId);
      state = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMimeType();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
      const chunks = [];
      const startedAt = Date.now();
      let elapsedBeforePause = 0;
      let segmentStartedAt = Date.now();
      let durationTimer = null;
      state = { recorder, chunks, startedAt, finished: false };
      bestandsAudioRecorder.set(personId, state);
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      const formatAudioTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      const updateAudioTime = () => {
        const elapsed = elapsedBeforePause + (recorder.state === "recording" ? Math.floor((Date.now() - segmentStartedAt) / 1000) : 0);
        message.textContent = `Aufnahme läuft · ${formatAudioTime(elapsed)}`;
      };
      durationTimer = window.setInterval(updateAudioTime, 500);
      recorder.onpause = () => { elapsedBeforePause += Math.floor((Date.now() - segmentStartedAt) / 1000); updateAudioTime(); };
      recorder.onresume = () => { segmentStartedAt = Date.now(); updateAudioTime(); };
      recorder.onstop = async () => {
        if (durationTimer) window.clearInterval(durationTimer);
        stream.getTracks().forEach(track => track.stop());
        state.finished = true;
        const mimeType = recorder.mimeType || mime || "audio/webm";
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) { message.textContent = "Keine Audiodaten aufgenommen."; record.textContent = "🎙️ Aufnahme starten"; return; }
        message.textContent = "Lade Sprachnotiz hoch …";
        record.disabled = true;
        const path = `${personId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await sb.storage.from(BUCKET_AUDIO).upload(path, blob);
        if (uploadError) { message.textContent = `Upload fehlgeschlagen: ${uploadError.message}`; record.disabled = false; return; }
        const { error: insertError } = await sb.from("sprachnotizen").insert({ person_id: personId, dateipfad: path, dauer_sekunden: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) });
        if (insertError) { message.textContent = `Speichern fehlgeschlagen: ${insertError.message}`; record.disabled = false; return; }
        message.textContent = "Sprachnotiz gespeichert ✓";
        record.disabled = false;
        record.textContent = "🎙️ Aufnahme starten";
        await ladeBestandsSprachnotizen(personId, panel);
      };
      recorder.start();
      record.textContent = "⏸️ Pause";
      message.textContent = "Aufnahme läuft · 00:00";
      // Der nächste Klick pausiert/fortsetzt; zum Beenden dient die separate Schaltfläche.
      const stop = document.createElement("button");
      stop.type = "button";
      stop.className = "btn btn--secondary";
      stop.textContent = "⏹️ Beenden & speichern";
      stop.addEventListener("click", (e) => { e.stopPropagation(); if (recorder.state !== "inactive") recorder.stop(); });
      actions.insertBefore(stop, message);
      recorder.addEventListener("stop", () => { stop.remove(); record.textContent = "🎙️ Aufnahme starten"; });
    } catch (err) {
      message.textContent = `Mikrofon nicht verfügbar: ${err.message || "Zugriff verweigert"}`;
      record.textContent = "🎙️ Aufnahme starten";
    }
  });
}


async function renderPersonenList(personen) {
  const list = document.getElementById("personen-list");
  if (!list) return;
  const sortiertePersonen = sortierePersonen(personen);
  const sichtbarIds = new Set(sortiertePersonen.map(p => p.id));

  // Karten werden nur einmal erzeugt und danach wiederverwendet. Beim Tippen in
  // der Suche werden dadurch weder <img>-Elemente noch deren src neu erzeugt.
  for (const p of personenCache) {
    if (!personenKartenCache.has(p.id)) erstellePersonenKarte(p);
    const karte = personenKartenCache.get(p.id);
    aktualisierePersonenKarte(karte, p);
    karte.li.hidden = !sichtbarIds.has(p.id);
  }

  // Sortierung durch Verschieben der bestehenden DOM-Knoten, nicht durch Neuanlage.
  const fragment = document.createDocumentFragment();
  for (const p of sortiertePersonen) {
    const karte = personenKartenCache.get(p.id);
    if (karte) fragment.appendChild(karte.li);
  }
  list.appendChild(fragment);
  const filterFeld = document.getElementById("personen-pruef-filter-feld");
  if (filterFeld) filterFeld.hidden = !rolleIstEigentuemer() || !personenCache.some((x) => x.herkunft_quelle);
  if (filterFeld?.hidden && personenPruefFilter) { personenPruefFilter = ""; const sel = document.getElementById("personen-pruef-filter"); if (sel) sel.value = ""; }
  beobachteSchluesselfotos();
  if (!stammlinienInfo.size) stammlinienLaden();   // v409
  if (rolleIstEigentuemer()) kbUebersichtLaden();   // v412
  kbFilterOptionenAnpassen();
  // Trefferzähler („272 Personen“) nach jedem Neuaufbau der Liste aktualisieren.
  if (typeof window.partezettelPersonenSuche === "function") {
    window.partezettelPersonenSuche(document.getElementById("search-input")?.value || "");
  }
}


const personenSortSelect=document.getElementById("personen-sortierung");
document.getElementById("personen-pruef-filter")?.addEventListener("change", (e) => {
  personenPruefFilter = e.target.value || "";
  // v441: passende Sortierung gleich mitwählen (älteste zuerst)
  const passendeSortierung = { "daten:geb-ohne-tod": "geburtsjahr", "daten:nur-sterbejahr": "sterbejahr" }[personenPruefFilter];
  if (passendeSortierung && personenSortSelect && personenSortSelect.value !== passendeSortierung) {
    personenSortSelect.value = passendeSortierung;
    personenSortSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  window.partezettelPersonenSuche?.(document.getElementById("search-input")?.value || "");
});
const personenSortButton=document.getElementById("personen-sort-richtung");

// ---------- Robuste lokale Namenssuche ----------
// Die Suche arbeitet ausschließlich auf dem bereits geladenen personenCache.
// Der direkte Handler wird zusätzlich vom <input>-Element aufgerufen. Damit
// hängt die Suche nicht davon ab, ob iPadOS einen zuvor registrierten
// Event-Listener nach einem View-/PWA-Wechsel noch korrekt ausführt.
let personenSucheLauf = 0;
let personenSucheZuletzt = null;   // v427

function normalizePersonenSuchtext(value) {
  return PersonSuche.normalisiere(value);
}
function personenSuchTreffer(person, suchwert, extra = "") {
  return PersonSuche.trifft(person || {}, suchwert, extra);
}

// v378: Personen ohne jedes Datum („nur Name“), meist Ehepartner aus den Hausblättern
const istNurName = (p) => !!p && !(p.geburtsdatum || p.geburtsjahr || p.sterbedatum || p.sterbejahr);
// v365: Filter „aus Hausblatt · ungeprüft / geprüft“ im Bestand
let personenPruefFilter = "";
function pruefFilterPasst(p) {
  if (personenPruefFilter === "offen") return !!p.herkunft_quelle && !p.geprueft_am;
  if (personenPruefFilter === "geprueft") return !!p.herkunft_quelle && !!p.geprueft_am;
  if (personenPruefFilter === "hausblatt") return !!p.herkunft_quelle;
  if (personenPruefFilter === "eigene") return !p.herkunft_quelle;
  if (personenPruefFilter === "ohne-nurname") return !istNurName(p);
  if (personenPruefFilter === "nurname") return istNurName(p);
  // v441: Lebensdaten vervollständigen (Eigentümer – das ganze Filterfeld ist nur für ihn sichtbar)
  if (personenPruefFilter === "daten:geb-ohne-tod") return !!(p.geburtsdatum || p.geburtsjahr) && !p.sterbedatum && !p.sterbejahr;
  if (personenPruefFilter === "daten:nur-sterbejahr") return !!p.sterbejahr && !p.sterbedatum;
  if (personenPruefFilter.startsWith("kb:")) {   // v412: fehlende Kirchenbuch-Links
    const e = kbUebersicht.get(p.id); if (!e) return false;
    const art = personenPruefFilter.slice(3);
    if (art === "T") return !e.T;
    if (art === "Tr") return e.ehen > 0 && !e.Tr;
    if (art === "S") return e.tot && !e.S;
    if (art === "alle") return e.T && (e.ehen === 0 || e.Tr) && (!e.tot || e.S);
    return true;
  }
  if (personenPruefFilter.startsWith("linie:")) {   // v409
    const [, key, art] = personenPruefFilter.split(":");
    const l = stammlinienInfo.get(p.id) || [];
    if (key === "beide") return l.length >= 2;
    const e = l.find((x) => x.key === key);
    return !!e && (art !== "mann" || e.mann);
  }
  return true;
}
function wendePersonenSucheAn(suchwert) {
  const q = normalizePersonenSuchtext(suchwert);
  const tokens = q ? q.split(" ").filter(Boolean) : [];
  const suchTokens = PersonSuche.zerlege(suchwert);   // v427: einmal statt für jede Person neu
  const list = document.getElementById("personen-list");
  const empty = document.getElementById("list-empty");

  if (!personenCacheGeladen || !Array.isArray(personenCache) || !personenCache.length) {
    if (empty) {
      empty.hidden = false;
      empty.textContent = personenKeineDaten
        ? "Keine Personen sichtbar. Dieses Konto hat möglicherweise noch keinen Zugriff auf die Daten."
        : "Personen werden noch geladen …";
    }
    return false;
  }

  // Alle Karten sind nach loadPersonen bereits vorhanden. Falls die Suche
  // außergewöhnlich früh kommt, werden fehlende Karten einmalig erzeugt.
  // Beim Filtern werden weder Karten noch Bilder neu erzeugt.
  for (const p of personenCache) {
    if (!personenKartenCache.has(p.id)) erstellePersonenKarte(p);
  }

  let treffer = 0;
  for (const p of personenCache) {
    const karte = personenKartenCache.get(p.id);
    if (!karte) continue;

    // Mehrwortsuche: Jeder Suchbegriff muss als Teilstring im gemeinsamen
    // Namens-Suchraum vorkommen. Dadurch ist die Reihenfolge egal:
    // "Ganahl Alois" findet "Alois Ganahl" und umgekehrt.
    const sichtbar = (suchTokens.length === 0 || PersonSuche.trifft(p, suchTokens)) && pruefFilterPasst(p);
    karte.treffer = sichtbar;
    if (sichtbar) treffer++;
  }
  // v444: nur die ersten Karten zeigen, weitere beim Hinunterwischen – hält die Liste auf dem iPad flüssig
  const suchSchluessel = `${q}|${personenPruefFilter}|${personenSortierung}|${personenSortRichtung}`;
  if (suchSchluessel !== personenListeSuchSchluessel) { personenListeSuchSchluessel = suchSchluessel; personenListeGrenze = PERSONEN_LISTE_SCHRITT; }
  personenListeBegrenzen();

  if (empty) {
    empty.textContent = treffer
      ? ""
      : (q ? `Keine Person für „${suchwert || q}“ gefunden.` : "Keine Personen für diesen Filter.");
    empty.hidden = treffer > 0;
  }
  if (list) list.setAttribute("data-suchtreffer", String(treffer));

  const status = document.getElementById("personen-suchtreffer");
  const filterText = { offen: " ungeprüft", geprueft: " geprüft", hausblatt: " aus Hausblatt", eigene: " selbst erfasst" }[personenPruefFilter] || "";
  if (status) status.textContent = q ? `${treffer} Treffer${filterText}` : `${treffer} Personen${filterText}`;
  return true;
}

// v444: Liste in Portionen – nur die ersten 150 Treffer stehen im Bildschirmaufbau, weitere kommen beim Hinunterwischen
const PERSONEN_LISTE_SCHRITT = 150;
let personenListeGrenze = PERSONEN_LISTE_SCHRITT;
let personenListeSuchSchluessel = "";
let personenListeBeobachter = null;
function personenListeBegrenzen() {
  const list = document.getElementById("personen-list");
  if (!list) return;
  let n = 0, mehr = 0;
  for (const li of list.children) {
    const karte = personenKartenCache.get(li.dataset.personId);
    const treffer = !!karte?.treffer;
    let zeigen = false;
    if (treffer) { n++; zeigen = n <= personenListeGrenze; if (!zeigen) mehr++; }
    if (li.hidden === zeigen) li.hidden = !zeigen;
  }
  let knopf = document.getElementById("personen-mehr");
  if (!knopf) {
    knopf = document.createElement("button");
    knopf.type = "button"; knopf.id = "personen-mehr"; knopf.className = "btn btn--secondary btn--full personen-mehr";
    knopf.addEventListener("click", () => { personenListeGrenze += PERSONEN_LISTE_SCHRITT * 2; personenListeBegrenzen(); });
    list.after(knopf);
    if ("IntersectionObserver" in window) {
      personenListeBeobachter = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting) && !knopf.hidden) { personenListeGrenze += PERSONEN_LISTE_SCHRITT; personenListeBegrenzen(); } }, { rootMargin: "900px 0px" });
      personenListeBeobachter.observe(knopf);
    }
  }
  knopf.hidden = mehr === 0;
  knopf.textContent = `Weitere ${Math.min(mehr, PERSONEN_LISTE_SCHRITT * 2)} von ${mehr} anzeigen`;
}

// Öffentliche Funktion für den direkten oninput/onkeyup-Handler im HTML.
window.partezettelPersonenSuche = function (suchwert) {
  personenSucheLauf++;
  personenSucheZuletzt = String(suchwert ?? "");
  return wendePersonenSucheAn(suchwert);
};

async function aktualisierePersonenSortierung() {
  aktualisierePersonenCacheStatus();
  if (personenSortierung === "schluesselfoto") { try { await ladeSchluesselfotoMetadaten(); } catch {} }   // v447
  await renderPersonenList(personenCache);
  const feld = document.getElementById("search-input");
  const q = (feld?.value || "").trim();
  window.partezettelPersonenSuche(q);
}

let egressSuchSchrittTimer = null;
function registriereEgressSuchSchrittNachSuche(suchwert) {
  clearTimeout(egressSuchSchrittTimer);
  egressSuchSchrittTimer = setTimeout(() => {
    registriereEgressSchritt(suchwert ? `Suche: ${suchwert}` : "Suche: leer");
  }, 800);
}

// v427: Beim Tippen nur EIN Suchlauf, kurz nach dem letzten Tastendruck. Vorher liefen pro Buchstabe
// bis zu fünf Suchläufe (oninput, onkeyup, zwei Listener, Dokument-Listener) – das blockierte die Tastatur.
let personenSucheTippTimer = null;
window.partezettelPersonenSucheTippen = function (wert) {
  wert = String(wert ?? "");
  clearTimeout(personenSucheTippTimer);
  personenSucheTippTimer = setTimeout(() => {
    if (wert === personenSucheZuletzt) return;
    personenSucheZuletzt = wert;
    window.partezettelPersonenSuche(wert);
    registriereEgressSuchSchrittNachSuche(wert);
  }, wert ? 180 : 60);
};
const personenSuchfeld = document.getElementById("search-input");
if (personenSuchfeld) {
  for (const art of ["input", "search", "keyup"]) personenSuchfeld.addEventListener(art, () => window.partezettelPersonenSucheTippen(personenSuchfeld.value));
}

// v332: Standardrichtung je Sortierfeld (Zuletzt erfasst = neueste zuerst), Richtungstaste beschriftet.
const PERSONEN_SORT_STANDARDRICHTUNG = { name: 1, alter: 1, geburtsjahr: 1, sterbejahr: 1, erstellt: -1, familie: 1 };
function aktualisiereSortRichtungButton() {
  if (!personenSortButton) return;
  const aufsteigend = personenSortRichtung === 1;
  personenSortButton.textContent = aufsteigend ? "↑" : "↓";
  const text = aufsteigend ? "Aufsteigend sortiert – antippen für absteigend" : "Absteigend sortiert – antippen für aufsteigend";
  personenSortButton.title = text;
  personenSortButton.setAttribute("aria-label", text);
}
if(personenSortSelect)personenSortSelect.addEventListener("change",()=>{personenSortierung=personenSortSelect.value;personenSortRichtung=PERSONEN_SORT_STANDARDRICHTUNG[personenSortierung]??1;aktualisiereSortRichtungButton();aktualisierePersonenSortierung();});
if(personenSortButton)personenSortButton.addEventListener("click",()=>{personenSortRichtung*=-1;aktualisiereSortRichtungButton();aktualisierePersonenSortierung();});
aktualisiereSortRichtungButton();

document.getElementById("refresh-btn").addEventListener("click", () => loadPersonen(true));
