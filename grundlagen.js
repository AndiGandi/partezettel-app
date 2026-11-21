// Familienspuren – Grundlagen: Supabase-Verbindung, Debug-Protokoll, Bild-Zwischenspeicher, Rollen, Anmeldung
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 450


// ==========================================================
// Partezettel Archiv – App-Logik
// ==========================================================
// ======================================================================
// Alle Personenfelder (Bestand, Stammbaum, Verwandtschaft, Gruppenfoto, Foto-Personen,
// Eltern-/Partner-/Kind-Auswahl) nutzen dieselben Regeln – auf iPad, iPhone, Mac und Android gleich.
// ======================================================================

const PersonSuche = (() => {
  // Vereinheitlicht Eingabe und Daten: Groß/Klein, Umlaute, ß, ae/oe/ue, Bindestriche, Apostrophe.
  function normalisiere(wert) {
    return String(wert ?? "")
      .toLocaleLowerCase("de-DE")
      .replace(/ß/g, "ss")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/['’`´]/g, "")
      .replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u")
      .replace(/[\u2010-\u2015_\/-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // v448: Datum in der Suche – „24.10.1875“, „24. 10. 1875“, „24.10.“ (Tag im Jahr), „10.1875“, „1875-10-24“,
  // „24. Oktober 1875“, „Okt. 1875“. Jedes Datum wird zu einem genauen Suchbaustein „#TT.MM.JJJJ#“,
  // der nur auf Geburts- oder Sterbedatum passt (nicht mehr auf beliebige Ziffern irgendwo).
  const MONATSNAMEN = [/^j(a|ä|ae)n/, /^feb/, /^m(ä|ae|a)r/, /^apr/, /^mai/, /^jun/, /^jul/, /^aug/, /^sep/, /^okt/, /^nov/, /^dez/];
  const MONATSWORT = "(j(?:a|ä|ae)n(?:uar|ner)?|feb(?:ruar|er)?|m(?:ä|ae|a)rz?|apr(?:il)?|mai|jun[ie]?|jul[ie]?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dez(?:ember)?)";
  const zwei = (n) => String(n).padStart(2, "0");
  const tagOk = (d) => d >= 1 && d <= 31, monatOk = (m) => m >= 1 && m <= 12;
  function monatAusWort(w) { const i = MONATSNAMEN.findIndex((r) => r.test(w)); return i >= 0 ? i + 1 : 0; }
  function datumsBausteine(roh) {
    let t = String(roh ?? "").toLocaleLowerCase("de-DE");
    const tokens = [];
    const nimm = (token) => { tokens.push(token); return " "; };
    // ISO: 1875-10-24 bzw. 1875-10
    t = t.replace(/\b(\d{4})-(\d{1,2})(?:-(\d{1,2}))?\b/g, (g, y, m, d) =>
      !monatOk(+m) ? g : (d ? (tagOk(+d) ? nimm(`#${zwei(d)}.${zwei(m)}.${y}#`) : g) : nimm(`.${zwei(m)}.${y}#`)));
    // Monatsname: „24. Oktober 1875“, „24. okt“, „Oktober 1875“
    t = t.replace(new RegExp(`(?:\\b(\\d{1,2})\\s*\\.?\\s*)?\\b${MONATSWORT}\\b\\.?(?:\\s*(\\d{4})\\b)?`, "g"), (g, d, w, y) => {
      const m = monatAusWort(w);
      if (!m || (!d && !y)) return g;               // „Mai“ allein bleibt ein Wort (auch Vorname/Name möglich)
      if (d && !tagOk(+d)) return g;
      if (d) return nimm(y ? `#${zwei(d)}.${zwei(m)}.${y}#` : `#${zwei(d)}.${zwei(m)}.`);
      return nimm(`.${zwei(m)}.${y}#`);
    });
    // Ziffern: Tag.Monat.Jahr (Jahr auch erst angefangen, z. B. „24.10.18“)
    t = t.replace(/(?<![\d.])(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,4})(?![\d.])/g, (g, d, m, y) =>
      tagOk(+d) && monatOk(+m) ? nimm(y.length === 4 ? `#${zwei(d)}.${zwei(m)}.${y}#` : `#${zwei(d)}.${zwei(m)}.${y}`) : g);
    // Monat.Jahr: „10.1875“
    t = t.replace(/(?<![\d.])(\d{1,2})\s*\.\s*(\d{4})(?![\d.])/g, (g, m, y) => monatOk(+m) ? nimm(`.${zwei(m)}.${y}#`) : g);
    // Tag.Monat ohne Jahr: „24.10.“ oder „24.10“
    t = t.replace(/(?<![\d.])(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?(?!\s*\d)/g, (g, d, m) =>
      tagOk(+d) && monatOk(+m) ? nimm(`#${zwei(d)}.${zwei(m)}.`) : g);
    return { rest: t, tokens };
  }
  // Datumsbausteine einer Person (Geburt und Tod), passend zu datumsBausteine()
  const datumsSchluessel = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `#${m[3]}.${m[2]}.${m[1]}#` : ""; };

  // Suchbegriffe: Kommas, Klammern, Punkte, „geb./gest.“ werden ignoriert (ganzes Wort, nicht „Gebhard“).
  function zerlege(wert, ohneJahre = false) {
    const { rest, tokens: datum } = /\d/.test(String(wert ?? "")) ? datumsBausteine(wert) : { rest: wert, tokens: [] };
    let t = normalisiere(rest).replace(/\b(geb|geboren|gest|gestorben)\.?(?![a-z0-9])/g, " ");
    if (ohneJahre) t = t.replace(/\b\d{4}\b/g, " ");
    const woerter = t.replace(/[(),.;:*†]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    return ohneJahre ? woerter : [...woerter, ...datum];   // ohneJahre: reiner Namensvergleich, Daten weglassen
  }

  const deDatum = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : ""; };
  const jahrVon = (datum, jahr) => (datum ? String(datum).slice(0, 4) : (jahr ? String(jahr) : ""));
  const ledigVon = (p) => String(p?.Ledigenname || p?.ledigenname || p?.geburtsname || "").trim();

  function jahre(p) {
    const g = jahrVon(p?.geburtsdatum, p?.geburtsjahr);
    const s = jahrVon(p?.sterbedatum, p?.sterbejahr);
    return g && s ? `${g} – ${s}` : (g ? `geb. ${g}` : (s ? `gest. ${s}` : ""));
  }
  function nameOhneLedig(p) {
    return [p?.vorname, p?.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  }
  function name(p) {
    const n = nameOhneLedig(p) || (ledigVon(p) ? "" : "(unbekannte Person)");
    const l = ledigVon(p);
    return l ? `${n ? n + " " : ""}(geb. ${l})` : n;
  }
  // Einheitliches Einzeilen-Format für Felder und Listen: „Vorname Nachname (geb. X) · 1880 – 1960“
  function label(p) {
    if (!p) return "(unbekannte Person)";
    const j = jahre(p);
    return j ? `${name(p)} · ${j}` : name(p);
  }
  // Einheitliches Zweizeilen-Format für Trefferlisten
  function anzeige(p) {
    return {
      name: nameOhneLedig(p) || (ledigVon(p) ? "" : "(unbekannte Person)"),
      ledig: ledigVon(p),
      daten: (typeof fotoPersonJahrDatumAnzeige === "function" ? fotoPersonJahrDatumAnzeige(p) : jahre(p)) || jahre(p)
    };
  }

  // v443: ein gemeinsamer Vergleicher ist auf dem iPad um ein Vielfaches schneller als localeCompare(…, Optionen)
  const vergleich = new Intl.Collator("de", { sensitivity: "base" }).compare;
  const sortSchluessel = (p) => String(p?.nachname || p?.Ledigenname || p?.ledigenname || p?.geburtsname || "").trim();
  // Eine Sortierung für alle: Nachname (ersatzweise Ledigenname), Vorname, Geburtsjahr; ohne Namen zuletzt.
  function sort(a, b) {
    const ka = sortSchluessel(a);
    const kb = sortSchluessel(b);
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    const n = vergleich(ka, kb);
    if (n) return n;
    const v = vergleich(String(a?.vorname || "").trim(), String(b?.vorname || "").trim());
    if (v) return v;
    const ay = Number(jahrVon(a?.geburtsdatum, a?.geburtsjahr)) || 0;
    const by = Number(jahrVon(b?.geburtsdatum, b?.geburtsjahr)) || 0;
    if (ay && by && ay !== by) return ay - by;
    if (ay && !by) return -1;
    if (!ay && by) return 1;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  }

  const cache = new WeakMap();
  function eintrag(person) {
    const sig = [person.vorname, person.nachname, person.Ledigenname, person.ledigenname, person.geburtsname,
      person.geburtsdatum, person.geburtsjahr, person.sterbedatum, person.sterbejahr].join("\u0001");
    const vorhanden = cache.get(person);
    if (vorhanden && vorhanden.sig === sig) return vorhanden;
    const lab = label(person);
    const e = {
      person, sig, label: lab, labelNorm: normalisiere(lab),
      search: normalisiere([person.vorname, person.nachname, person.Ledigenname, person.ledigenname, person.geburtsname,
        person.geburtsdatum, deDatum(person.geburtsdatum), person.geburtsjahr,
        person.sterbedatum, deDatum(person.sterbedatum), person.sterbejahr]
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "").join(" "))
        + ` ${datumsSchluessel(person.geburtsdatum)} ${datumsSchluessel(person.sterbedatum)}`,
      names: normalisiere(`${person.vorname || ""} ${person.nachname || ""} ${ledigVon(person)}`),
      nachVor: normalisiere(`${person.nachname || ""} ${person.vorname || ""}`)
    };
    cache.set(person, e);
    return e;
  }

  function eintraegeVon(personen) {
    return [...(personen || [])].sort(sort).map(eintrag);
  }

  function trifft(person, suchwert, extra = "") {
    const tokens = Array.isArray(suchwert) ? suchwert : zerlege(suchwert);
    if (!tokens.length) return true;
    const e = eintrag(person);
    const heu = extra ? `${e.search} ${normalisiere(extra)}` : e.search;
    return tokens.every((t) => heu.includes(t));
  }

  // Treffer nach Eintrag-Liste (vorsortiert): Namensanfang zuerst, danach Teiltreffer.
  function suche(eintraege, suchwert, { max = 100 } = {}) {
    const tokens = zerlege(suchwert);
    if (!tokens.length) return { total: 0, entries: [], tokens };
    const erste = tokens[0];
    const treffer = [];
    for (const e of eintraege) {
      if (tokens.every((t) => e.search.includes(t))) treffer.push(e);
    }
    const rang = (e) => ((e.names.startsWith(erste) || e.nachVor.startsWith(erste)) ? 0 : (e.names.split(" ").some((w) => w.startsWith(erste)) ? 1 : 2));
    const geordnet = treffer.map((e, i) => ({ e, i, r: rang(e) })).sort((x, y) => x.r - y.r || x.i - y.i).map((x) => x.e);
    return { total: geordnet.length, entries: geordnet.slice(0, max), tokens };
  }

  return { normalisiere, zerlege, jahre, name, label, anzeige, sort, sortSchluessel, eintrag, eintraegeVon, trifft, suche };
})();

// ---------- Sichtbares Debug-Log (funktioniert ohne Mac/Web-Inspector) ----------
// v443: Zeilen sammeln und höchstens einmal pro Bild schreiben, auf 400 Zeilen begrenzt
// (vorher wurde bei jeder Meldung der ganze, immer längere Text neu gesetzt und das Layout neu berechnet).
let debugLogZeilen = [], debugLogGeplant = false;
function debugLog(msg) {
  const zeit = new Date().toLocaleTimeString("de-DE");
  console.log("[Partezettel]", msg);
  debugLogZeilen.push(`[${zeit}] ${msg}`);
  if (debugLogZeilen.length > 400) debugLogZeilen = debugLogZeilen.slice(-400);
  if (debugLogGeplant) return;
  debugLogGeplant = true;
  requestAnimationFrame(() => {
    debugLogGeplant = false;
    // v445: Protokoll nur ins Fenster schreiben, wenn der Bereich aufgeklappt ist (sonst kostet es bei jedem Schritt Zeit).
    const panel = document.querySelector("details.debug-panel");
    if (panel && !panel.open) { debugLogVeraltet = true; return; }
    debugLogZeichnen();
  });
}
let debugLogVeraltet = false;
function debugLogZeichnen() {
  const el = document.getElementById("debug-log");
  if (!el) return;
  debugLogVeraltet = false;
  el.textContent = debugLogZeilen.join("\n") + "\n";
  el.scrollTop = el.scrollHeight;
}
document.addEventListener("toggle", (e) => {
  if (e.target?.matches?.("details.debug-panel") && e.target.open && debugLogVeraltet) debugLogZeichnen();
}, true);

// ---------- Temporäre Egress-Messung (v165) ----------
// Nur für den kontrollierten Egress-Test. Die eigentliche Bild- und Suchlogik
// bleibt unverändert. Die Messung wird in sessionStorage fortgeführt, damit
// ein versehentliches Neuladen derselben Safari-Registerkarte die Zähler nicht
// auf 0 zurücksetzt.
const EGRESS_DEBUG_KEY = "partezettel-egress-debug-v199";

function neuesEgressMessObjekt() {
  return {
    start: Date.now(),
    urlSetzungen: 0,
    eindeutigeURLSetzungen: 0,
    loadEvents: 0,
    eindeutigeLoadURLs: 0,
    fotoMemoryCacheTreffer: 0,
    fotoBrowserCacheTreffer: 0,
    fotoSupabaseDownloads: 0,
    fotoSupabaseBytes: 0,
    fotoSupabaseFehler: 0,
    fotoMemoryCachePfade: [],
    fotoBrowserCachePfade: [],
    fotoSupabasePfade: [],
    fotoDirektFallbackLoads: 0,
    fotoDirektFallbackPfade: [],
    fotoQuelleUnbekanntLoads: 0,
    fotoQuelleUnbekanntPfade: [],
    fotoMemoryLoadEvents: 0,
    fotoBrowserLoadEvents: 0,
    fotoSupabaseLoadEvents: 0,
    fotoCacheZugriffe: 0,
    fotoBrowserCacheZugriffe: 0,
    fotoNetzwerkVersuche: 0,
    fotoNetzwerkErfolge: 0,
    fotoNetzwerkFehler: 0,
    fotoLadePfade: [],
    fotoFehlerPfade: [],
    signierteURLAnfragen: 0,
    personenSupabaseAbrufe: 0,
    signierteURLPfade: 0,
    transferBytes: 0,
    timingNullBytes: 0,
    timingNichtMessbar: 0,
    transferMessungen: 0,
    syncPruefungen: 0,
    syncLetzteAenderungen: 0,
    syncLetzteSeq: 0,
    syncPersonenAktualisiert: 0,
    syncPersonenGeloescht: 0,
    syncBeziehungenAktualisiert: 0,
    syncLetzterErfolgreicherLaufAenderungen: 0,
    syncLetzterErfolgreicherLaufSeq: 0,
    syncLetzterErfolgreicherLaufAktualisiert: 0,
    syncLetzterErfolgreicherLaufGeloescht: 0,
    syncFehler: "",
    syncLetzteZeit: 0,
    uniqueAssignedUrls: [],
    uniqueLoadedUrls: [],
    schritte: []
  };
}

function ladeEgressMessung() {
  try {
    const raw = sessionStorage.getItem(EGRESS_DEBUG_KEY);
    if (!raw) return neuesEgressMessObjekt();
    const parsed = JSON.parse(raw);
    const basis = neuesEgressMessObjekt();
    return {
      ...basis,
      ...parsed,
      uniqueAssignedUrls: Array.isArray(parsed.uniqueAssignedUrls) ? parsed.uniqueAssignedUrls : [],
      uniqueLoadedUrls: Array.isArray(parsed.uniqueLoadedUrls) ? parsed.uniqueLoadedUrls : [],
      fotoMemoryCachePfade: Array.isArray(parsed.fotoMemoryCachePfade) ? parsed.fotoMemoryCachePfade : [],
      fotoBrowserCachePfade: Array.isArray(parsed.fotoBrowserCachePfade) ? parsed.fotoBrowserCachePfade : [],
      fotoSupabasePfade: Array.isArray(parsed.fotoSupabasePfade) ? parsed.fotoSupabasePfade : [],
      fotoDirektFallbackPfade: Array.isArray(parsed.fotoDirektFallbackPfade) ? parsed.fotoDirektFallbackPfade : [],
      fotoQuelleUnbekanntPfade: Array.isArray(parsed.fotoQuelleUnbekanntPfade) ? parsed.fotoQuelleUnbekanntPfade : [],
      fotoLadePfade: Array.isArray(parsed.fotoLadePfade) ? parsed.fotoLadePfade : [],
      fotoFehlerPfade: Array.isArray(parsed.fotoFehlerPfade) ? parsed.fotoFehlerPfade : [],
      schritte: Array.isArray(parsed.schritte) ? parsed.schritte : []
    };
  } catch (_) {
    return neuesEgressMessObjekt();
  }
}

const egressMessung = ladeEgressMessung();


// ---------- Persistenter Bild-Cache (v171) ----------
// Bilder werden anhand ihres stabilen Storage-Pfades im Browser Cache Storage
// abgelegt. Die signierte Supabase-URL dient nur zum erstmaligen Abruf. Nach
// einem Safari-/App-Neustart wird das Bild aus dem lokalen Cache gelesen, ohne
// erneuten Storage-Download und ohne neue signierte URL.
const FOTO_CACHE_NAME = "partezettel-fotos-v171";
const fotoBildMemoryCache = new Map(); // dateipfad -> objectURL
const fotoBildLadePromises = new Map(); // dateipfad -> Promise<objectURL|null>
const fotoQuelleNachUrl = new Map(); // objectURL/signierte URL -> Quelle der Bilddaten
const fotoPfadeMitQuelle = new Map(); // dateipfad -> letzte bekannte Quelle

function fotoCacheSchluessel(dateipfad) {
  return new Request(`${location.origin}/__partezettel_foto_cache__/${encodeURIComponent(dateipfad)}`);
}

async function leseFotoAusBrowserCache(dateipfad) {
  if (!dateipfad || !window.caches) return null;
  try {
    const cache = await caches.open(FOTO_CACHE_NAME);
    const response = await cache.match(fotoCacheSchluessel(dateipfad));
    if (!response) return null;
    const blob = await response.blob();
    if (!blob || !blob.size) return null;
    return URL.createObjectURL(blob);
  } catch (err) {
    debugLog(`⚠️ Bild-Cache lesen: ${err.message || err}`);
    return null;
  }
}

async function speichereFotoImBrowserCache(dateipfad, response) {
  if (!dateipfad || !response || !response.ok || !window.caches) return;
  try {
    const cache = await caches.open(FOTO_CACHE_NAME);
    await cache.put(fotoCacheSchluessel(dateipfad), response.clone());
  } catch (err) {
    debugLog(`⚠️ Bild-Cache speichern: ${err.message || err}`);
  }
}

async function loescheFotoAusBrowserCache(dateipfad) {
  if (!dateipfad) return;
  const memoryUrl = fotoBildMemoryCache.get(dateipfad);
  if (memoryUrl) {
    try { URL.revokeObjectURL(memoryUrl); } catch (_) {}
    fotoBildMemoryCache.delete(dateipfad);
  }
  if (!window.caches) return;
  try {
    const cache = await caches.open(FOTO_CACHE_NAME);
    await cache.delete(fotoCacheSchluessel(dateipfad));
  } catch (_) {}
}

async function ladeFotoBilder(dateipfade) {
  const pfade = [...new Set((dateipfade || []).filter(Boolean))];
  const ergebnis = new Map();
  if (!pfade.length) return ergebnis;

  const fehlende = [];
  for (const pfad of pfade) {
    if (!egressMessung.fotoLadePfade.includes(pfad)) egressMessung.fotoLadePfade.push(pfad);
    const memoryUrl = fotoBildMemoryCache.get(pfad);
    if (memoryUrl) {
      egressMessung.fotoMemoryCacheTreffer++;
      egressMessung.fotoCacheZugriffe++;
      fotoPfadeMitQuelle.set(pfad, "Arbeitsspeicher-Cache");
      fotoQuelleNachUrl.set(memoryUrl, "Arbeitsspeicher-Cache");
      if (!egressMessung.fotoMemoryCachePfade.includes(pfad)) egressMessung.fotoMemoryCachePfade.push(pfad);
      ergebnis.set(pfad, memoryUrl);
      continue;
    }
    const cachedUrl = await leseFotoAusBrowserCache(pfad);
    if (cachedUrl) {
      egressMessung.fotoBrowserCacheTreffer++;
      egressMessung.fotoBrowserCacheZugriffe++;
      fotoPfadeMitQuelle.set(pfad, "Browser-Cache");
      fotoQuelleNachUrl.set(cachedUrl, "Browser-Cache");
      if (!egressMessung.fotoBrowserCachePfade.includes(pfad)) egressMessung.fotoBrowserCachePfade.push(pfad);
      fotoBildMemoryCache.set(pfad, cachedUrl);
      ergebnis.set(pfad, cachedUrl);
    } else {
      fehlende.push(pfad);
    }
  }

  speichereEgressMessung();
  aktualisiereEgressMessung();
  if (!fehlende.length) return ergebnis;

  // Dedupliziere gleichzeitige Requests: bereits laufende Pfade werden nicht
  // nochmals signiert oder heruntergeladen.
  const neuZuLaden = fehlende.filter(p => !fotoBildLadePromises.has(p));
  const laufende = fehlende.filter(p => fotoBildLadePromises.has(p));
  if (neuZuLaden.length) {
    egressMessung.signierteURLAnfragen++;
    egressMessung.signierteURLPfade += neuZuLaden.length;
    egressMessung.fotoNetzwerkVersuche += neuZuLaden.length;
    speichereEgressMessung();
    aktualisiereEgressMessung();

    const batchPromise = (async () => {
      const { data: signedList, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUrls(neuZuLaden, 3600);
      if (error) throw error;
      const signedByPath = new Map();
      for (const item of signedList || []) if (item?.path && item?.signedUrl) signedByPath.set(item.path, item.signedUrl);

      await Promise.all(neuZuLaden.map(async (pfad) => {
        const signedUrl = signedByPath.get(pfad);
        if (!signedUrl) {
          egressMessung.fotoSupabaseFehler++;
          egressMessung.fotoNetzwerkFehler++;
          if (!egressMessung.fotoFehlerPfade.includes(pfad)) egressMessung.fotoFehlerPfade.push(pfad);
          return;
        }
        try {
          const response = await fetch(signedUrl, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          if (!blob.size) throw new Error("leere Bildantwort");
          egressMessung.fotoSupabaseDownloads++;
          egressMessung.fotoSupabaseBytes += blob.size;
          egressMessung.fotoNetzwerkErfolge++;
          if (!egressMessung.fotoSupabasePfade.includes(pfad)) egressMessung.fotoSupabasePfade.push(pfad);
          fotoPfadeMitQuelle.set(pfad, "Supabase-Netzwerk");
          const responseForCache = new Response(blob, { status: 200, headers: { "Content-Type": blob.type || "image/jpeg" } });
          await speichereFotoImBrowserCache(pfad, responseForCache);
          const objectUrl = URL.createObjectURL(blob);
          fotoBildMemoryCache.set(pfad, objectUrl);
          fotoQuelleNachUrl.set(objectUrl, "Supabase-Netzwerk");
          ergebnis.set(pfad, objectUrl);
        } catch (err) {
          egressMessung.fotoSupabaseFehler++;
          egressMessung.fotoNetzwerkFehler++;
          if (!egressMessung.fotoFehlerPfade.includes(pfad)) egressMessung.fotoFehlerPfade.push(pfad);
          // Direkter <img>-Fallback: wird explizit als nicht byte-messbar erfasst.
          fotoPfadeMitQuelle.set(pfad, "Direkter Browser-Fallback (Bytes unbekannt)");
          fotoQuelleNachUrl.set(signedUrl, "Direkter Browser-Fallback (Bytes unbekannt)");
          ergebnis.set(pfad, signedUrl);
          debugLog(`⚠️ Bild-Fallback für ${pfad}: ${err.message || err}`);
        }
      }));
    })();

    for (const pfad of neuZuLaden) fotoBildLadePromises.set(pfad, batchPromise.then(() => ergebnis.get(pfad) || null));
    try { await batchPromise; }
    catch (err) {
      for (const pfad of neuZuLaden) {
        egressMessung.fotoSupabaseFehler++;
        egressMessung.fotoNetzwerkFehler++;
        if (!egressMessung.fotoFehlerPfade.includes(pfad)) egressMessung.fotoFehlerPfade.push(pfad);
      }
      debugLog(`❌ Signierte Bild-URLs: ${err.message || err}`);
    } finally {
      for (const pfad of neuZuLaden) fotoBildLadePromises.delete(pfad);
    }
  }

  if (laufende.length) {
    await Promise.all(laufende.map(async pfad => {
      try {
        const url = await fotoBildLadePromises.get(pfad);
        if (url) ergebnis.set(pfad, url);
      } catch (_) {}
    }));
  }
  speichereEgressMessung();
  aktualisiereEgressMessung();
  return ergebnis;
}
async function ladeFotoBild(dateipfad) {
  if (!dateipfad) return null;
  // Wichtig: ladeFotoBilder verwaltet selbst die Request-Promises.
  // Hier darf vorher kein Promise unter demselben Pfad eingetragen werden,
  // sonst erkennt ladeFotoBilder den eigenen Aufruf als bereits laufend und
  // wartet auf sich selbst (Deadlock: Anzeige bleibt bei „Foto wird geladen“).
  const laufendes = fotoBildLadePromises.get(dateipfad);
  if (laufendes) return laufendes;
  const map = await ladeFotoBilder([dateipfad]);
  return map.get(dateipfad) || fotoBildMemoryCache.get(dateipfad) || null;
}

// v444: höchstens alle 2 Sekunden speichern (vorher bei jedem einzelnen Foto – bremste das Wischen)
let egressSpeichernTimer = null;
function speichereEgressMessung() {
  if (egressSpeichernTimer) return;
  egressSpeichernTimer = setTimeout(() => {
    egressSpeichernTimer = null;
    try {
      if (egressMessung.uniqueAssignedUrls?.length > 300) egressMessung.uniqueAssignedUrls = egressMessung.uniqueAssignedUrls.slice(-300);
      sessionStorage.setItem(EGRESS_DEBUG_KEY, JSON.stringify(egressMessung));
    } catch (_) {}
  }, 2000);
}

try {
  if (typeof performance !== "undefined" && performance.setResourceTimingBufferSize) {
    performance.setResourceTimingBufferSize(1000);
  }
} catch (_) {}

function formatBytesDebug(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function findeResourceTiming(url) {
  try {
    const entries = performance.getEntriesByType("resource");
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.name === url) return entries[i];
    }
  } catch (_) {}
  return null;
}

function registriereEgressBildLoad(url, img = null) {
  // Verhindert, dass dasselbe load-Event durch lokale und globale Listener
  // doppelt gezählt wird. Ein erneutes Setzen derselben URL zählt nicht erneut.
  if (img && img.dataset.egressLastCountedSrc === url) return;
  if (img) img.dataset.egressLastCountedSrc = url;
  egressMessung.loadEvents++;
  if (url && !egressMessung.uniqueLoadedUrls.includes(url)) {
    egressMessung.uniqueLoadedUrls.push(url);
    egressMessung.eindeutigeLoadURLs++;
  }
  const quelle = fotoQuelleNachUrl.get(url) || "Unbekannt / außerhalb des zentralen Ladepfads";
  if (quelle === "Arbeitsspeicher-Cache") egressMessung.fotoMemoryLoadEvents++;
  else if (quelle === "Browser-Cache") egressMessung.fotoBrowserLoadEvents++;
  else if (quelle === "Supabase-Netzwerk") egressMessung.fotoSupabaseLoadEvents++;
  else if (quelle.startsWith("Direkter Browser-Fallback")) {
    egressMessung.fotoDirektFallbackLoads++;
    const pfad = img?.dataset?.fotoPfad || "(Pfad unbekannt)";
    if (!egressMessung.fotoDirektFallbackPfade.includes(pfad)) egressMessung.fotoDirektFallbackPfade.push(pfad);
  } else {
    egressMessung.fotoQuelleUnbekanntLoads++;
    if (url && !egressMessung.fotoQuelleUnbekanntPfade.includes(url)) egressMessung.fotoQuelleUnbekanntPfade.push(url);
  }
  const timing = findeResourceTiming(url);
  if (!timing) egressMessung.timingNichtMessbar++;
  else if (Number.isFinite(timing.transferSize)) {
    egressMessung.transferMessungen++;
    if (timing.transferSize > 0) egressMessung.transferBytes += timing.transferSize;
    else egressMessung.timingNullBytes++;
  } else egressMessung.timingNichtMessbar++;
  speichereEgressMessung();
  aktualisiereEgressMessung();
}

// Capture-Listener deckt auch Bilder in Stammbaum, Gruppenfoto und Detailansicht
// ab. Die Herkunft wird nur dann zugeordnet, wenn der zentrale Loader sie kennt.
document.addEventListener("load", (event) => {
  const img = event.target;
  if (img && img.tagName === "IMG") registriereEgressBildLoad(img.currentSrc || img.src || "", img);
}, true);
function registriereEgressSchritt(label) {
  const step = {
    zeit: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    label: String(label || "(ohne Suche)"),
    urlSetzungen: egressMessung.urlSetzungen,
    eindeutigeURLSetzungen: egressMessung.eindeutigeURLSetzungen,
    loadEvents: egressMessung.loadEvents,
    eindeutigeLoadURLs: egressMessung.eindeutigeLoadURLs,
    signierteURLAnfragen: egressMessung.signierteURLAnfragen,
    personenSupabaseAbrufe: egressMessung.personenSupabaseAbrufe,
    transferBytes: egressMessung.transferBytes,
    timingNullBytes: egressMessung.timingNullBytes,
    timingNichtMessbar: egressMessung.timingNichtMessbar
  };
  egressMessung.schritte.push(step);
  if (egressMessung.schritte.length > 12) egressMessung.schritte.shift();
  speichereEgressMessung();
  aktualisiereEgressMessung();
}

function aktualisiereEgressMessung() {
  const el = document.getElementById("egress-debug-status");
  if (!el || !el.offsetParent) return;   // v444: nur wenn die Diagnose sichtbar ist
  const seit = new Date(egressMessung.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const schritte = egressMessung.schritte.length
    ? "\n\nLetzte Messschritte:\n" + egressMessung.schritte.map((s, i) =>
        `${i + 1}. ${s.zeit} „${s.label}“ → URLs ${s.urlSetzungen} (+${s.eindeutigeURLSetzungen} eindeutig), Loads ${s.loadEvents} (+${s.eindeutigeLoadURLs} eindeutig), Timing ${formatBytesDebug(s.transferBytes)}, 0 B ${s.timingNullBytes}, n.m. ${s.timingNichtMessbar}`
      ).join("\n")
    : "";
  el.textContent =
    `Messcode: v199 aktiv · Messung seit: ${seit}\n` +
    `ARBEITSSPEICHER: ${egressMessung.fotoMemoryCacheTreffer || 0} Cache-Zugriffe · ${egressMessung.fotoMemoryCachePfade?.length || 0} Dateien · ${egressMessung.fotoMemoryLoadEvents || 0} angezeigte Bilder\n` +
    `BROWSER-CACHE: ${egressMessung.fotoBrowserCacheZugriffe || 0} Cache-Zugriffe · ${egressMessung.fotoBrowserCachePfade?.length || 0} Dateien · ${egressMessung.fotoBrowserLoadEvents || 0} angezeigte Bilder\n` +
    `SUPABASE: ${egressMessung.fotoSupabaseDownloads || 0} erfolgreiche fetch-Downloads · ${egressMessung.fotoSupabasePfade?.length || 0} Dateien · ${formatBytesDebug(egressMessung.fotoSupabaseBytes || 0)} empfangene Bilddaten · ${egressMessung.fotoSupabaseLoadEvents || 0} angezeigte Bilder\n` +
    `Direkter Browser-Fallback: ${egressMessung.fotoDirektFallbackLoads || 0} angezeigte Bilder (Bytes nicht messbar)\n` +
    `Herkunft unbekannt/außerhalb des zentralen Ladepfads: ${egressMessung.fotoQuelleUnbekanntLoads || 0} angezeigte Bilder\n` +
    `Netzwerkversuche: ${egressMessung.fotoNetzwerkVersuche || 0} · Fehler: ${egressMessung.fotoNetzwerkFehler || 0} · Bildabruf-Fehler gesamt: ${egressMessung.fotoSupabaseFehler || 0}\n` +
    `Hinweis: Supabase-Bytes zählen nur erfolgreiche fetch-Antworten. Direkte img-src-Abrufe werden als Fallback separat angezeigt; deren Bytes sind im Browser nicht zuverlässig messbar.\n` +
    `Personen-Supabase-Abfragen: ${egressMessung.personenSupabaseAbrufe}\n` +
    `Delta-Sync: ${egressMessung.syncPruefungen || 0} Prüfung(en) · letzter Lauf: ${egressMessung.syncLetzterErfolgreicherLaufAenderungen || 0} Änderung(en) · seq: ${egressMessung.syncLetzterErfolgreicherLaufSeq || 0}\n` +
    `Delta verarbeitet: ${egressMessung.syncLetzterErfolgreicherLaufAktualisiert || 0} Person(en) aktualisiert · ${egressMessung.syncLetzterErfolgreicherLaufGeloescht || 0} gelöscht${egressMessung.syncBeziehungenAktualisiert ? ` · Beziehungen/Familien neu geladen: ${egressMessung.syncBeziehungenAktualisiert}` : ""}\n` +
    (egressMessung.syncFehler ? `Delta-Sync Fehler: ${egressMessung.syncFehler}\n` : "") +
    `Signierte URL-Anfragen: ${egressMessung.signierteURLAnfragen} · Pfade: ${egressMessung.signierteURLPfade}\n` +
    `Bild-URL-Zuweisungen gesamt: ${egressMessung.urlSetzungen} · eindeutig: ${egressMessung.eindeutigeURLSetzungen}\n` +
    `Bild-Ladevorgänge (Elemente): ${egressMessung.loadEvents} · eindeutige URLs: ${egressMessung.eindeutigeLoadURLs}\n` +
    `ResourceTiming > 0 B: ${formatBytesDebug(egressMessung.transferBytes)}\n` +
    `ResourceTiming 0 B: ${egressMessung.timingNullBytes} · nicht messbar: ${egressMessung.timingNichtMessbar}` + schritte;
}

function resetEgressMessung() {
  const neu = neuesEgressMessObjekt();
  Object.keys(neu).forEach(key => { egressMessung[key] = neu[key]; });
  speichereEgressMessung();
  aktualisiereEgressMessung();
}

document.addEventListener("DOMContentLoaded", () => {
  const reset = document.getElementById("egress-debug-reset");
  if (reset) reset.addEventListener("click", resetEgressMessung);
  aktualisiereEgressMessung();
});

window.addEventListener("error", (e) => {
  debugLog(`❌ JS-FEHLER: ${e.message} (${e.filename}:${e.lineno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  debugLog(`❌ UNBEHANDELTER FEHLER: ${e.reason && e.reason.message ? e.reason.message : e.reason}`);
});

debugLog("App-Skript gestartet.");

document.addEventListener("DOMContentLoaded", () => {
  const clearBtn = document.getElementById("debug-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      document.getElementById("debug-log").textContent = "";
      debugLogZeilen = [];
    });
  }
});

let sb = null;
try {
  if (!window.supabase || typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
    throw new Error("Supabase-Konfiguration fehlt.");
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("HIER_DEINEN_ANON_PUBLIC_KEY_EINFÜGEN")) {
    throw new Error("Supabase-Anon-Key fehlt in config.js.");
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  debugLog("Supabase-Client initialisiert.");
} catch (err) {
  debugLog(`⚠️ Supabase nicht initialisiert: ${err.message}`);
}

let currentFotoBlobs = [];
let currentSchluesselfotoIndex = 0;
let currentAudioBlob = null;
let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = null;
let isRecording = false;
let personenCache = []; // {id, vorname, nachname, ...}
let personenCacheGeladen = false;
let personenLadePromise = null;
let personenCacheZeitpunkt = 0;
let personenCacheQuelle = "";
// Nur für die Auswahlfilter. Diese Daten werden ausschließlich gelesen und
// verändern keine bestehenden Familien- oder Kinderverknüpfungen.
let familienAuswahlCache = [];
let personenVerwandtschaftCache = new Map();
let partnerIdsAuswahlCache = new Set();
let familienKinderAuswahlCache = [];
let beziehungenAuswahlCache = [];
let personenCacheSyncSeq = 0;
let personenCacheSyncInitialisiert = false;
let syncLadePromise = null;
// Pro Cache-Laden genau eine Delta-Prüfung. Weitere loadPersonen-Aufrufe
// innerhalb derselben Sitzung dürfen die Prüfung nicht mehrfach auslösen.
let syncPruefungSeitCacheLaden = false;

// ---------- v344: Zugang, Rollen und Hinweisseite ----------
// Rollen: eigentuemer (alles), bearbeiter (anlegen/ändern, keine Personen/Fotos/Aufnahmen löschen), leser (nur lesen).
// Durchgesetzt wird das in der Datenbank (Supabase-Regeln); die App blendet nur passend aus und warnt freundlich.
// Fehlen die Paket-1-Tabellen noch (SQL nicht eingespielt), läuft die App wie bisher (Kompatibilitätsmodus).
let zugang = { rolle: "eigentuemer", name: "", kompatibel: true };
let zugangGeprueftFuer = null;
let zugangPruefLaeuft = false;
const ROLLEN_NAMEN = { eigentuemer: "Eigentümer", bearbeiter: "Bearbeiter", leser: "Leser" };

function tabelleFehlt(error) {
  return /42P01|PGRST205|schema cache|does not exist/i.test(`${error?.code || ""} ${error?.message || ""}`);
}
function rolleIstEigentuemer() { return zugang.rolle === "eigentuemer"; }
function rolleDarfSchreiben() { return zugang.rolle === "eigentuemer" || zugang.rolle === "bearbeiter"; }
function darfLoeschen(was) {
  if (rolleIstEigentuemer()) return true;
  alert(`Nur der Eigentümer darf ${was}.\nBitte wende dich an ihn.`);
  return false;
}

function setzeRollenAnzeige() {
  for (const r of Object.keys(ROLLEN_NAMEN)) document.body.classList.toggle(`rolle-${r}`, zugang.rolle === r);
  const zeile = document.getElementById("app-user");
  if (zeile) {
    zeile.replaceChildren(document.createTextNode(zugang.kompatibel || !zugang.name ? "⚙ Konto" : `⚙ ${zugang.name}`));
    if (!zugang.kompatibel && zugang.name) {
      const rolle = document.createElement("span");
      rolle.className = "app-user__rolle";      // auf dem Handy ausgeblendet, damit der Knopf nicht umbricht
      rolle.textContent = ` · ${ROLLEN_NAMEN[zugang.rolle] || zugang.rolle}`;
      zeile.appendChild(rolle);
    }
    zeile.hidden = false;
  }
}

// v396: Eigentümer kann die App vorübergehend „als Bearbeiter“ oder „als Leser“ ansehen (nur Anzeige,
// die Rechte in der Datenbank bleiben unverändert). Nach dem Neuladen gilt wieder die echte Rolle.
function rollenVorschauStarten(rolle) {
  if (!ROLLEN_NAMEN[rolle]) return;
  if (!zugang.echteRolle) zugang.echteRolle = zugang.rolle;
  if (zugang.echteRolle !== "eigentuemer") return;
  zugang.rolle = rolle;
  zugang.vorschau = rolle !== "eigentuemer";
  if (!zugang.vorschau) { delete zugang.echteRolle; }
  setzeRollenAnzeige();
  let leiste = document.getElementById("rollen-vorschau-leiste");
  if (zugang.vorschau) {
    if (!leiste) {
      leiste = document.createElement("div");
      leiste.id = "rollen-vorschau-leiste";
      leiste.className = "rollen-vorschau-leiste";
      document.body.prepend(leiste);
    }
    leiste.innerHTML = `<span>👁 <strong>Vorschau:</strong> So sieht ein <strong>${ROLLEN_NAMEN[rolle]}</strong> die App.</span>
      <span class="rollen-vorschau-knoepfe">${Object.keys(ROLLEN_NAMEN).filter((r) => r !== "eigentuemer" && r !== rolle).map((r) => `<button type="button" data-vorschau-rolle="${r}">als ${ROLLEN_NAMEN[r]}</button>`).join("")}
      <button type="button" data-vorschau-rolle="eigentuemer" class="is-zurueck">Zurück zu meiner Ansicht</button></span>`;
  } else if (leiste) leiste.remove();
  document.body.classList.toggle("rollen-vorschau-aktiv", !!zugang.vorschau);
  rollenVorschauNeuZeichnen();
}
function rollenVorschauNeuZeichnen() {
  try { document.getElementById("konto-overlay").hidden = true; } catch {}
  const pv = document.getElementById("person-view-overlay");
  const offenePerson = pv && !pv.hidden ? currentPersonViewId : null;
  const det = document.getElementById("detail-overlay");
  if (det && !det.hidden) det.hidden = true;
  try { loadPersonen(); } catch {}
  try { const t = document.querySelector('.tab-btn[aria-selected="true"]')?.dataset.tab; if (t === "stammbaum" && typeof renderStammbaum === "function") renderStammbaum(document.getElementById("tree-person-select")?.value); } catch {}
  if (offenePerson) setTimeout(() => openPersonDetail(offenePerson), 150);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-vorschau-rolle]");
  if (!b) return;
  e.preventDefault();
  rollenVorschauStarten(b.dataset.vorschauRolle);
});

function zugangZuruecksetzen() {
  zugangGeprueftFuer = null;
  zugangPruefLaeuft = false;
  zugang = { rolle: "eigentuemer", name: "", kompatibel: true };
  for (const r of Object.keys(ROLLEN_NAMEN)) document.body.classList.remove(`rolle-${r}`);
  const overlay = document.getElementById("zugang-overlay");
  if (overlay) overlay.hidden = true;
  const zeile = document.getElementById("app-user");
  if (zeile) { zeile.textContent = ""; zeile.hidden = true; }
}

function zeigeHinweisInhalt(inhalt) {
  const h = window.HINWEIS || {};
  inhalt.replaceChildren();
  if (h.einleitung) {
    const p = document.createElement("p");
    p.textContent = h.einleitung;
    inhalt.appendChild(p);
  }
  for (const abschnitt of h.abschnitte || []) {
    const titel = document.createElement("h3");
    titel.textContent = abschnitt.titel;
    const liste = document.createElement("ul");
    for (const punkt of abschnitt.punkte || []) {
      const li = document.createElement("li");
      li.textContent = punkt;
      liste.appendChild(li);
    }
    inhalt.append(titel, liste);
  }
  const stand = document.createElement("p");
  stand.className = "zugang-stand";
  stand.textContent = `Stand: ${h.version || "–"}`;
  inhalt.appendChild(stand);
}

async function speichereZustimmung() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Nicht angemeldet.");
  const { error } = await sb.from("zustimmungen").insert({
    user_id: session.user.id,
    version: window.HINWEIS.version,
    geraet: String(navigator.userAgent || "").slice(0, 200)
  });
  if (error && !tabelleFehlt(error)) throw error;
  return true;
}

// Modi: "kein-zugriff" (nur Abmelden), "pflicht" (bestätigen), "lesen" (nur ansehen, schließen)
function zugangOverlayZeigen(modus) {
  const el = (id) => document.getElementById(id);
  const overlay = el("zugang-overlay");
  const inhalt = el("zugang-inhalt");
  const hakenZeile = el("zugang-haken-zeile");
  const haken = el("zugang-haken");
  const weiter = el("zugang-weiter");
  const schliessen = el("zugang-schliessen");
  const abmelden = el("zugang-abmelden");
  const meldung = el("zugang-meldung");
  meldung.textContent = "";
  haken.checked = false;
  weiter.disabled = true;
  hakenZeile.hidden = modus !== "pflicht";
  weiter.hidden = modus !== "pflicht";
  schliessen.hidden = modus !== "lesen";
  abmelden.hidden = modus === "lesen";
  if (modus === "kein-zugriff") {
    el("zugang-titel").textContent = "Kein Zugriff";
    const p = document.createElement("p");
    p.textContent = "Dein Konto ist angemeldet, aber noch nicht für Familienspuren freigeschaltet oder wurde deaktiviert. Bitte wende dich an den Eigentümer der Datenbank.";
    inhalt.replaceChildren(p);
  } else {
    el("zugang-titel").textContent = (window.HINWEIS && window.HINWEIS.titel) || "Hinweise";
    el("zugang-haken-text").textContent = (window.HINWEIS && window.HINWEIS.bestaetigung) || "Gelesen und verstanden.";
    zeigeHinweisInhalt(inhalt);
  }
  overlay.hidden = false;
  inhalt.scrollTop = 0;
  return new Promise((resolve) => {
    const schliesse = (ergebnis) => {
      overlay.hidden = true;
      haken.onchange = null; weiter.onclick = null; schliessen.onclick = null; abmelden.onclick = null;
      resolve(ergebnis);
    };
    haken.onchange = () => { weiter.disabled = !haken.checked; };
    weiter.onclick = async () => {
      weiter.disabled = true;
      meldung.textContent = "Speichere …";
      try {
        await speichereZustimmung();
        schliesse(true);
      } catch (err) {
        meldung.textContent = `Konnte nicht gespeichert werden: ${err.message || err}`;
        weiter.disabled = !haken.checked;
      }
    };
    schliessen.onclick = () => schliesse(true);
    abmelden.onclick = async () => {
      schliesse(false);
      try { await sb.auth.signOut(); } catch (err) { debugLog(`⚠️ Abmelden: ${err.message || err}`); }
    };
  });
}

// Prüft Konto, Rolle und Bestätigung der Hinweise. true = App darf angezeigt werden.
async function pruefeZugangUndHinweise(session) {
  const uid = session?.user?.id;
  if (!uid) return false;
  if (zugangGeprueftFuer === uid) return true;
  if (zugangPruefLaeuft) return false;
  zugangPruefLaeuft = true;
  const pruefStart = performance.now();
  try {
    const { data, error } = await sb.from("benutzerprofil").select("anzeigename, rolle, aktiv").eq("user_id", uid).maybeSingle();
    if (error) {
      if (tabelleFehlt(error)) {
        debugLog("ℹ️ Paket 1 (Rollen) ist in Supabase noch nicht eingespielt – App läuft im Kompatibilitätsmodus.");
        zugang = { rolle: "eigentuemer", name: "", kompatibel: true };
        setzeRollenAnzeige();
        zugangGeprueftFuer = uid;
        return true;
      }
      throw error;
    }
    if (!data || data.aktiv === false) {
      zugang = { rolle: "leser", name: "", kompatibel: false };
      setzeRollenAnzeige();
      await zugangOverlayZeigen("kein-zugriff");
      return false;
    }
    zugang = { rolle: data.rolle, name: data.anzeigename || "", kompatibel: false };
    setzeRollenAnzeige();
    if (window.HINWEIS && window.HINWEIS.version) {
      const { data: bestaetigt, error: zErr } = await sb.from("zustimmungen").select("id")
        .eq("user_id", uid).eq("version", window.HINWEIS.version).limit(1);
      if (zErr && !tabelleFehlt(zErr)) throw zErr;
      if (!zErr && !(bestaetigt || []).length) {
        const weiter = await zugangOverlayZeigen("pflicht");
        if (!weiter) return false;
      }
    }
    zugangGeprueftFuer = uid;
    debugLog(`⏱ Zugang und Hinweise geprüft in ${Math.round(performance.now() - pruefStart)} ms.`);
    return true;
  } finally {
    zugangPruefLaeuft = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("hinweise-oeffnen")?.addEventListener("click", () => { void zugangOverlayZeigen("lesen"); });
});

// ---------- v349: Mein Konto (Menü am Namen) ----------
async function kontoOeffnen() {
  const overlay = document.getElementById("konto-overlay");
  if (!overlay) return;
  document.getElementById("konto-meldung").textContent = "";
  document.getElementById("konto-passwort").value = "";
  document.getElementById("konto-passwort2").value = "";
  let email = "–";
  try {
    const { data: { session } } = await sb.auth.getSession();
    email = session?.user?.email || "–";
  } catch (_) { /* nicht kritisch */ }
  document.getElementById("konto-name").textContent = zugang.name || "–";
  document.getElementById("konto-email").textContent = email;
  document.getElementById("konto-rolle").textContent = zugang.kompatibel ? "–" : (ROLLEN_NAMEN[zugang.rolle] || zugang.rolle);
  overlay.hidden = false;
}
function kontoSchliessen() { const o = document.getElementById("konto-overlay"); if (o) o.hidden = true; }

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("app-user")?.addEventListener("click", () => { void kontoOeffnen(); });
  document.getElementById("konto-oeffnen")?.addEventListener("click", () => { void kontoOeffnen(); });
  document.getElementById("konto-schliessen")?.addEventListener("click", kontoSchliessen);
  document.getElementById("konto-overlay")?.addEventListener("click", (e) => { if (e.target.id === "konto-overlay") kontoSchliessen(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") kontoSchliessen(); });
  document.getElementById("konto-hinweise")?.addEventListener("click", () => { kontoSchliessen(); void zugangOverlayZeigen("lesen"); });
  document.getElementById("konto-abmelden")?.addEventListener("click", async () => {
    kontoSchliessen();
    try { await sb.auth.signOut(); } catch (err) { debugLog(`⚠️ Abmelden: ${err.message || err}`); }
  });
  document.getElementById("konto-passwort-speichern")?.addEventListener("click", async () => {
    const meldung = document.getElementById("konto-meldung");
    const eins = document.getElementById("konto-passwort");
    const zwei = document.getElementById("konto-passwort2");
    if (eins.value.length < 10) { meldung.textContent = "Das Passwort braucht mindestens 10 Zeichen."; eins.focus(); return; }
    if (eins.value !== zwei.value) { meldung.textContent = "Die beiden Eingaben stimmen nicht überein."; zwei.focus(); return; }
    meldung.textContent = "Speichere …";
    try {
      const { error } = await sb.auth.updateUser({ password: eins.value });
      if (error) throw error;
      eins.value = ""; zwei.value = "";
      meldung.textContent = "Passwort geändert ✓";
    } catch (err) {
      meldung.textContent = `Passwort konnte nicht geändert werden: ${err.message || err}`;
    }
  });
});

// ---------- v349: Änderungsprotokoll (Verlauf) ----------
// Die Datenbank schreibt das Protokoll selbst (Paket 2). Hier wird es nur gelesen und verständlich angezeigt.
const VERLAUF_TABELLEN = {
  personen: ["Person angelegt", "Person geändert", "Person gelöscht"],
  familien: ["Partnerschaft/Familie angelegt", "Partnerschaft/Familie geändert", "Partnerschaft/Familie entfernt"],
  familien_kinder: ["Kind zugeordnet", "Kind-Zuordnung geändert", "Kind-Zuordnung entfernt"],
  beziehung: ["Beziehung angelegt", "Beziehung geändert", "Beziehung entfernt"],
  fotos: ["Foto hinzugefügt", "Foto geändert", "Foto gelöscht"],
  foto_personen: ["Person auf Foto markiert", "Foto-Markierung geändert", "Foto-Markierung entfernt"],
  sprachnotizen: ["Sprachnotiz hinzugefügt", "Sprachnotiz geändert", "Sprachnotiz gelöscht"],
  familien_trauungsbuch_quellen: ["Trauungsbuch-Quelle angelegt", "Trauungsbuch-Quelle geändert", "Trauungsbuch-Quelle entfernt"],
  benutzerprofil: ["Konto freigeschaltet", "Konto/Rolle geändert", "Konto-Freigabe entfernt"]
};
const VERLAUF_AKTION = { einfuegen: 0, aendern: 1, loeschen: 2 };
const VERLAUF_FELDER = {
  vorname: "Vorname", nachname: "Nachname", Ledigenname: "Ledigenname", ledigenname: "Ledigenname", geschlecht: "Geschlecht",
  geburtsdatum: "Geburtsdatum", geburtsjahr: "Geburtsjahr", sterbedatum: "Sterbedatum", sterbejahr: "Sterbejahr", Notiz: "Notiz",
  familientyp: "Art", beginn: "Beginn", ende: "Ende", beziehungstyp: "Art", ist_schluesselfoto: "Schlüsselfoto", gruppenfoto: "Gruppenfoto",
  titel: "Titel", nummer: "Nummer", zeile: "Zeile", dateipfad: "Datei", rolle: "Rolle", aktiv: "Aktiv", anzeigename: "Name"
};
const VERLAUF_IGNORIERT = new Set(["id", "created_at", "erstellt_am", "updated_at", "geaendert_am", "user_id"]);

function verlaufWert(v) {
  if (v === null || v === undefined || v === "") return "leer";
  if (typeof v === "boolean") return v ? "ja" : "nein";
  const text = typeof v === "object" ? JSON.stringify(v) : String(v);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function verlaufPersonenNamen(ids) {
  return (ids || []).map((id) => {
    const p = (personenCache || []).find((x) => x.id === id);
    return p ? PersonSuche.name(p) : "";
  }).filter(Boolean);
}

function verlaufEintragElement(e, ohnePersonen = false) {
  const li = document.createElement("li");
  li.className = "verlauf-eintrag";
  const kopf = document.createElement("div");
  kopf.className = "verlauf-kopf";
  const zeit = document.createElement("span");
  zeit.className = "verlauf-zeit";
  zeit.textContent = new Date(e.zeitpunkt).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const wer = document.createElement("strong");
  wer.textContent = e.benutzer || "unbekannt";
  kopf.append(zeit, " ", wer);
  const titel = document.createElement("div");
  titel.className = "verlauf-titel";
  const namen = VERLAUF_TABELLEN[e.tabelle];
  titel.textContent = namen ? namen[VERLAUF_AKTION[e.aktion] ?? 1] : `${e.tabelle}: ${e.aktion}`;
  li.append(kopf, titel);
  const zeilen = [];
  const daten = e.aenderungen || {};
  if (e.aktion === "aendern") {
    for (const [feld, wert] of Object.entries(daten)) {
      if (VERLAUF_IGNORIERT.has(feld)) continue;
      zeilen.push(`${VERLAUF_FELDER[feld] || feld}: ${verlaufWert(wert?.alt)} → ${verlaufWert(wert?.neu)}`);
    }
  } else if (e.tabelle === "personen") {
    const name = [daten.vorname, daten.nachname].filter(Boolean).join(" ").trim();
    if (name) zeilen.push(name);
  } else if (e.tabelle === "fotos" && daten.dateipfad) {
    zeilen.push(verlaufWert(String(daten.dateipfad).split("/").pop()));
  }
  if (!ohnePersonen && e.tabelle !== "personen") {
    const betrifft = verlaufPersonenNamen(e.personen_ids);
    if (betrifft.length) zeilen.push(`Betrifft: ${betrifft.join(", ")}`);
  }
  for (const z of zeilen.slice(0, 8)) {
    const d = document.createElement("div");
    d.className = "verlauf-detail";
    d.textContent = z;
    li.appendChild(d);
  }
  return li;
}

// Holt eine Seite aus dem Protokoll. Rückgabe: { fehlt, eintraege, fehler }
async function holeVerlauf({ personId = "", vorId = null, benutzer = "", limit = 30 } = {}) {
  let abfrage = sb.from("aenderungsprotokoll")
    .select("id, zeitpunkt, benutzer, tabelle, datensatz_id, personen_ids, aktion, aenderungen")
    .order("id", { ascending: false }).limit(limit);
  if (personId) abfrage = abfrage.contains("personen_ids", [personId]);
  if (vorId) abfrage = abfrage.lt("id", vorId);
  if (benutzer) abfrage = abfrage.eq("benutzer", benutzer);
  const { data, error } = await abfrage;
  if (error) {
    if (tabelleFehlt(error)) return { fehlt: true, eintraege: [] };
    return { fehler: error.message || String(error), eintraege: [] };
  }
  return { eintraege: data || [] };
}

// --- Verlauf in der Personenansicht ---
let verlaufPersonId = "";
let verlaufPersonLetzteId = null;

async function ladeVerlaufPerson(weitere = false) {
  const liste = document.getElementById("pv-verlauf-liste");
  const meldung = document.getElementById("pv-verlauf-meldung");
  const mehr = document.getElementById("pv-verlauf-mehr");
  if (!liste || !verlaufPersonId) return;
  meldung.textContent = "Lade …";
  const erg = await holeVerlauf({ personId: verlaufPersonId, vorId: weitere ? verlaufPersonLetzteId : null });
  if (erg.fehlt) { meldung.textContent = "Das Änderungsprotokoll ist in der Datenbank noch nicht eingerichtet."; mehr.hidden = true; return; }
  if (erg.fehler) { meldung.textContent = `Verlauf konnte nicht geladen werden: ${erg.fehler}`; return; }
  if (!weitere) liste.replaceChildren();
  for (const e of erg.eintraege) liste.appendChild(verlaufEintragElement(e, false));
  if (erg.eintraege.length) verlaufPersonLetzteId = erg.eintraege[erg.eintraege.length - 1].id;
  meldung.textContent = liste.children.length ? "" : "Noch keine Änderungen aufgezeichnet (das Protokoll gilt ab der Einrichtung).";
  mehr.hidden = erg.eintraege.length < 30;
}

function setzeVerlaufFuerPerson(personId) {
  verlaufPersonId = personId;
  verlaufPersonLetzteId = null;
  const details = document.getElementById("pv-verlauf");
  if (details) details.open = false;
  document.getElementById("pv-verlauf-liste")?.replaceChildren();
  const meldung = document.getElementById("pv-verlauf-meldung");
  if (meldung) meldung.textContent = "";
  const mehr = document.getElementById("pv-verlauf-mehr");
  if (mehr) mehr.hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("pv-verlauf")?.addEventListener("toggle", () => {
    if (document.getElementById("pv-verlauf").open && !document.getElementById("pv-verlauf-liste").children.length) void ladeVerlaufPerson(false);
  });
  document.getElementById("pv-verlauf-mehr")?.addEventListener("click", () => { void ladeVerlaufPerson(true); });
});

// --- Verlauf-Übersicht (nur Eigentümer) ---
let verlaufTabLetzteId = null;

async function ladeVerlaufTab(weitere = false) {
  const liste = document.getElementById("verlauf-liste");
  const meldung = document.getElementById("verlauf-meldung");
  const mehr = document.getElementById("verlauf-mehr");
  const filter = document.getElementById("verlauf-benutzer");
  if (!liste) return;
  meldung.textContent = "Lade …";
  const erg = await holeVerlauf({ vorId: weitere ? verlaufTabLetzteId : null, benutzer: filter?.value || "", limit: 50 });
  if (erg.fehlt) { meldung.textContent = "Das Änderungsprotokoll ist in der Datenbank noch nicht eingerichtet (Supabase Paket 2)."; mehr.hidden = true; return; }
  if (erg.fehler) { meldung.textContent = `Verlauf konnte nicht geladen werden: ${erg.fehler}`; return; }
  if (!weitere) liste.replaceChildren();
  for (const e of erg.eintraege) liste.appendChild(verlaufEintragElement(e, false));
  if (erg.eintraege.length) verlaufTabLetzteId = erg.eintraege[erg.eintraege.length - 1].id;
  // Benutzerliste für den Filter aus den bisher gesehenen Einträgen ergänzen
  if (filter) {
    const bekannt = new Set([...filter.options].map((o) => o.value));
    for (const e of erg.eintraege) {
      if (e.benutzer && !bekannt.has(e.benutzer)) { filter.appendChild(new Option(e.benutzer, e.benutzer)); bekannt.add(e.benutzer); }
    }
  }
  meldung.textContent = liste.children.length ? "" : "Noch keine Einträge.";
  mehr.hidden = erg.eintraege.length < 50;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("verlauf-mehr")?.addEventListener("click", () => { void ladeVerlaufTab(true); });
  document.getElementById("verlauf-benutzer")?.addEventListener("change", () => { void ladeVerlaufTab(false); });
});

// ---------- v351: Wiedereinstieg im Bestand ----------
// Nach Abmelden und neuem Anmelden sowie nach längerer Pause (App im Hintergrund) startet die App im Bestand.
const PAUSE_BIS_BESTAND_MS = 30 * 60 * 1000;
let hintergrundSeit = 0;

function geheZuBestand({ ruhig = false } = {}) {
  // ruhig: eine offene Bearbeitung (nicht gespeicherte Eingaben) bleibt unangetastet
  if (ruhig && !document.getElementById("detail-overlay")?.hidden) return;
  for (const id of ["person-view-overlay", "detail-overlay", "konto-overlay"]) {
    const el = document.getElementById(id);
    if (el && !el.hidden) el.hidden = true;
  }
  document.body.classList.remove("person-view-open");
  const aktiv = document.querySelector(".tab-btn.is-active")?.dataset.tab;
  if (aktiv !== "liste") document.querySelector('.tab-btn[data-tab="liste"]')?.click();
  else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { hintergrundSeit = Date.now(); return; }
  const warPause = hintergrundSeit && Date.now() - hintergrundSeit > PAUSE_BIS_BESTAND_MS;
  hintergrundSeit = 0;
  if (warPause && !document.getElementById("app-shell")?.hidden && document.getElementById("zugang-overlay")?.hidden) {
    geheZuBestand({ ruhig: true });
  }
});

// ---------- Anmeldung ----------
async function ensureSession() {
  if (!sb) throw new Error("Supabase ist nicht verfügbar. Bitte config.js prüfen.");
  const { data: { session }, error: getSessionError } = await sb.auth.getSession();
  if (getSessionError) throw getSessionError;
  if (!session) throw new Error("Nicht angemeldet.");
  return session;
}

async function anmelden(email, password) {
  if (!sb) throw new Error("Supabase ist nicht verfügbar. Bitte config.js prüfen.");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function zeigeAppWennAngemeldet() {
  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app-shell");
  const loginMessage = document.getElementById("login-message");
  if (!loginScreen || !appShell) return;
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    if (session) {
      const warSchonAngemeldet = zugangGeprueftFuer === session.user.id;
      const frei = await pruefeZugangUndHinweise(session);
      if (!frei) {
        // Hinweisseite oder „Kein Zugriff“ ist offen – oder man hat sich gerade abgemeldet.
        const { data: { session: aktuelle } } = await sb.auth.getSession();
        loginScreen.hidden = !!aktuelle ? true : false;
        appShell.hidden = true;
        return;
      }
      loginScreen.hidden = true;
      appShell.hidden = false;
      debugLog("Angemeldet.");
      if (!warSchonAngemeldet) geheZuBestand();   // v351: nach dem Anmelden immer im Bestand starten
      if (!warSchonAngemeldet) { anmeldungProtokollieren("start"); setTimeout(() => komfortNachStart(session), 1200); }   // v418
      // v191: Gruppenfotos gleich beim App-Start laden, damit auch die Übersicht
      // und Personendetails nicht mit leeren Platzhaltern erscheinen.
      void ladeGruppenfotoListe().catch(err => debugLog(`⚠️ Gruppenfotos beim Start: ${err.message || err}`));
    } else {
      zugangZuruecksetzen();
      loginScreen.hidden = false;
      appShell.hidden = true;
    }
  } catch (err) {
    loginScreen.hidden = false;
    appShell.hidden = true;
    if (loginMessage) loginMessage.textContent = err.message;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const logoutBtn = document.getElementById("logout-btn");

  try { const gemerkt = localStorage.getItem("fs-login-email"); if (gemerkt && loginEmail && !loginEmail.value) loginEmail.value = gemerkt; } catch {}   // v418
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginMessage.textContent = "Anmeldung …";
      try {
        await anmelden(loginEmail.value.trim(), loginPassword.value);
        try { localStorage.setItem("fs-login-email", loginEmail.value.trim()); } catch {}   // v418: Anmeldename merken
        anmeldungProtokollieren("anmeldung", true);
        loginPassword.value = "";
        loginMessage.textContent = "";
        await zeigeAppWennAngemeldet();
        // v172 Diagnose: Warteschlange bewusst nicht automatisch senden.
        // Sie wird nur angezeigt, damit die 8 problematischen Einträge geprüft werden können.
        try { await loadPersonen(); } catch (err) { debugLog(`⚠️ Laden nach Anmeldung: ${err.message}`); }
      } catch (err) {
        loginMessage.textContent = `Anmeldung fehlgeschlagen: ${err.message}`;
      }
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
      await zeigeAppWennAngemeldet();
    });
  }
  if (sb) {
    sb.auth.onAuthStateChange((_event, session) => {
      const loginScreen = document.getElementById("login-screen");
      const appShell = document.getElementById("app-shell");
      if (session) {
        // Zugang und Hinweise werden in zeigeAppWennAngemeldet() geprüft (einmal je Anmeldung).
        if (zugangGeprueftFuer !== session.user.id && !zugangPruefLaeuft) void zeigeAppWennAngemeldet();
      } else {
        zugangZuruecksetzen();
        loginScreen.hidden = false;
        appShell.hidden = true;
      }
    });
    await zeigeAppWennAngemeldet();
  }
});
