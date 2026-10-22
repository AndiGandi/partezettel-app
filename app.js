// Partezettel Archiv – Version 366
// v366: Hausblätter-Import: zweiter Durchgang für evtl. lebende Personen (eigene Import-Kennung, eigenes Rückgängig); Zuordnung zum ersten Import.
// v365: Prüf-Punkt (orange = ungeprüft, grün = geprüft) bei importierten Personen in Liste, Personenansicht und Stammbaum; Filter „Anzeigen“ im Bestand.
// v364: Lebensalter/Ehedauer unter 1 Jahr in Monaten, unter 1 Monat in Tagen (nie „0 Jahre“); nach Import/Rückgängig vollständig neu laden.
// v363: Hausblätter-Import Stufe 2: Vorschau, Import (Personen, Familien, Häuser, Stationen) mit Import-Kennung, „Rückgängig“; Vermerk „aus Hausblatt · ungeprüft“; Backup enthält Häuser/Stationen/Importe.
// v362: Hausblätter-Import Stufe 1 (Export / Sicherung, nur Eigentümer): Import-Datei laden, Abweichungen entscheiden, „Gleiche Person?“ bestätigen.
// v361: Trauungsbuch-Quelle einer Ehe lässt sich entfernen (Feld leeren + speichern); alte Personenfelder gelten nur eindeutig für eine Ehe; keine Doppelzeile in „Kirchenbücher“.
// Partezettel Archiv – Version 321
// Partezettel Archiv – Version 320
// v316: Fehler beim Neuaufbau der Stammlinie behoben; Ausgangs-ID korrekt übergeben und Nachkommen rekursiv einbeziehen.
// v308: Stammlinienauswahl verbessert, Zentrierung nach Auswahl, Bestätigung und schnelleres Suchfeld.
// v286: Johann Josef und Anna Maria Mangeng als gemeinsame Stammlinie mit beiden Vorfahrenzweigen.
// v283: Vorgefertigte Stammlinien für Ganahl Reinhard/Paula und Mangeng Peter/Johann Josef.
// v281: Gruppenfoto-Zahlen-Schaltfläche direkt oberhalb der Namensliste positionieren.
// v288: iPhone-Suche mobil angeordnet; Personenkarten per Touch/Tastatur zuverlässig öffnen.
// v302: Integrierte Hilfeseite und Kurzanleitung für alle Hauptbereiche.
// v294: Diktiergerät direkt in der großen Bestandsansicht.
// v279: Trauungsbuchquellen chronologisch mit Ehe-Nummer anzeigen; Stammbaum übernimmt Auswahl aus Bestand.
// v276: Trauungsbuchquellen aus familien_trauungsbuch_quellen zusätzlich im Bereich Kirchenbücher anzeigen, je Ehe separat.\n// v273: Verwandtschaftspfad nutzt vorhandene Geschlechtsangaben für Vater/Mutter, Sohn/Tochter usw.; fehlende Angaben werden neutral beschriftet. v272: Elternanzeige erweitert.
// v222: Gruppenfoto-Namen vollständig anzeigen und Tauschauswahl auf bereits zugeordnete Personen begrenzen.
// v206: vorhandene Trauungsbuch-Links kompakt im Eheblock anzeigen, keine neue DB-Spalte: Kirchenbuchlinks in Personendetails und mehrere Trauungsbuchquellen je Ehe;  Klassischer Stammbaum – mehr Abstand zwischen Generationen, horizontal scrollbar, keine abgeschnittenen Karten. // v202: Verwandtschaft bei der Ersterfassung (Voll-/Halbgeschwister) und Schlüsselfoto auswählen; gewähltes Foto wird beim Upload markiert. // v199: Klassischer Stammbaum – eigener Familienzweig unterhalb der Geschwisterzeile, mit klaren Verbindungslinien. // v192: Klassische Stammbaumdarstellung aus v189 wiederhergestellt; Foto- und Gruppenfoto-Optimierungen aus v191 beibehalten.
// v188: Klassischer Stammbaum mit echten Familien-Verbindungslinien. Restore prüft vorhandene Mediendateien ohne Download (exists/409) und korrigiert die Gültigkeitsdauer der Schlüsselfoto-URL. // v181: Backup erstellt keine automatischen Datenbank-Löschungen. Bestehende Fotooptimierung entfernt; neue Fotos werden beim Hochladen optimiert. Persistenter Personen-/Bild-Cache + robuste Warteschlangenbereinigung + Egress-Test.
// v160: Sitzungscache + robuste lokale Namenssuche mit direktem oninput-Handler.
// ==========================================================
// Partezettel Archiv – App-Logik
// ==========================================================


// ======================================================================
// v340: Gemeinsames Modul für Namenssuche, Anzeige und Sortierung.
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

  // Suchbegriffe: Kommas, Klammern, Punkte, „geb./gest.“ werden ignoriert (ganzes Wort, nicht „Gebhard“).
  function zerlege(wert, ohneJahre = false) {
    let t = normalisiere(wert).replace(/\b(geb|geboren|gest|gestorben)\.?(?![a-z0-9])/g, " ");
    if (ohneJahre) t = t.replace(/\b\d{4}\b/g, " ");
    return t.replace(/[(),.;:*†]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
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

  const sortSchluessel = (p) => String(p?.nachname || p?.Ledigenname || p?.ledigenname || p?.geburtsname || "").trim();
  // Eine Sortierung für alle: Nachname (ersatzweise Ledigenname), Vorname, Geburtsjahr; ohne Namen zuletzt.
  function sort(a, b) {
    const ka = sortSchluessel(a);
    const kb = sortSchluessel(b);
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    const n = ka.localeCompare(kb, "de", { sensitivity: "base" });
    if (n) return n;
    const v = String(a?.vorname || "").trim().localeCompare(String(b?.vorname || "").trim(), "de", { sensitivity: "base" });
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
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "").join(" ")),
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
function debugLog(msg) {
  const el = document.getElementById("debug-log");
  const zeit = new Date().toLocaleTimeString("de-DE");
  console.log("[Partezettel]", msg);
  if (el) {
    el.textContent += `[${zeit}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
  }
}

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

function speichereEgressMessung() {
  try {
    sessionStorage.setItem(EGRESS_DEBUG_KEY, JSON.stringify(egressMessung));
  } catch (_) {}
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
  if (!el) return;
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

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginMessage.textContent = "Anmeldung …";
      try {
        await anmelden(loginEmail.value.trim(), loginPassword.value);
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

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    // Beim Verlassen des Stammbaums die letzte Verwandtschaftsanfrage verwerfen,
    // damit beim nächsten Öffnen keine alte Anfrage oder Ergebnisanzeige stehen bleibt.
    const aktiverTab = document.querySelector(".tab-btn.is-active")?.dataset.tab;
    if (aktiverTab === "stammbaum" && btn.dataset.tab !== "stammbaum") {
      const relationA = document.getElementById("tree-relation-person-a");
      const relationB = document.getElementById("tree-relation-person-b");
      const relationResult = document.getElementById("tree-relationship-result");
      const relationPanel = document.getElementById("tree-relationship-panel");
      if (relationA) relationA.value = "";
      if (relationB) relationB.value = "";
      if (relationResult) relationResult.innerHTML = "";
      if (relationPanel) relationPanel.hidden = true;
      treeRelationshipSelection = { personAId: null, personBId: null };
    }
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
    // Falls die Personenbearbeitung offen ist, beim Wechsel des Hauptreiters schließen.
    const overlay = document.getElementById("detail-overlay");
    if (overlay) overlay.hidden = true;

    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("is-active");
    // Beim Wechsel des Hauptbereichs immer an den Anfang der Ansicht springen.
    // So startet jede Ansicht oben und nicht an der zuletzt gespeicherten
    // Scrollposition der vorherigen Ansicht.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (btn.dataset.tab === "liste") await loadPersonen();
    if (btn.dataset.tab === "verlauf") await ladeVerlaufTab(false);
    if (btn.dataset.tab === "fotos") {
      // Beim direkten Wechsel auf „Fotos“ zuerst die Personen laden,
      // damit die Auswahl nicht leer bleibt, wenn der Cache noch nicht gefüllt ist.
      if (!Array.isArray(personenCache) || personenCache.length === 0) {
        try { await loadPersonen(); } catch (err) {
          debugLog(`⚠️ Personen für Gruppenfotos: ${err.message || err}`);
        }
      }
      fuelleGruppenfotoPersonen();
      await ladeGruppenfotoListe();
    }
    if (btn.dataset.tab === "stammbaum") {
      // Wenn der Stammbaum aus der Bestand-Detailansicht geöffnet wird,
      // übernimmt er die dort zuletzt ausgewählte Person als Ausgangspunkt.
      await loadStammbaum();
      if (currentDetailPersonId && treePerson(currentDetailPersonId)) {
        setTreePersonSelection(currentDetailPersonId);
      }
    }
  });
});

// ---------- Foto-Aufnahme + Bearbeitung ----------
const fotoInput = document.getElementById("foto-input");
const fotoInputGalerie = document.getElementById("foto-input-galerie");
const fotoStatus = document.getElementById("foto-status");
const fotoPreview = document.getElementById("foto-preview");

let fotoEditorQueue = [];
let fotoEditorResolve = null;
let fotoEditorImage = null;
let fotoEditorRotation = 0;
let fotoEditorCrop = { x: 0, y: 0, w: 1, h: 1 };
let fotoEditorDragging = false;
let fotoEditorDragStart = null;

const photoEditor = document.getElementById("photo-editor");
const photoCanvas = document.getElementById("photo-editor-canvas");
const photoCtx = photoCanvas.getContext("2d");
const fotoEditorBaseCanvas = document.createElement("canvas");
let fotoEditorResize = false;
let fotoEditorResizeX = 0;
let fotoEditorResizeY = 0;

function bildZuDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawPhotoEditor() {
  if (!fotoEditorImage) return;
  const img = fotoEditorImage;
  const maxW = 1200;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const rotated = Math.abs(fotoEditorRotation % 180) === 90;
  photoCanvas.width = rotated ? h : w;
  photoCanvas.height = rotated ? w : h;

  // Erst das unverdeckte Bild in ein eigenes Canvas zeichnen.
  fotoEditorBaseCanvas.width = photoCanvas.width;
  fotoEditorBaseCanvas.height = photoCanvas.height;
  const bctx = fotoEditorBaseCanvas.getContext("2d");
  bctx.clearRect(0, 0, fotoEditorBaseCanvas.width, fotoEditorBaseCanvas.height);
  bctx.save();
  bctx.translate(fotoEditorBaseCanvas.width / 2, fotoEditorBaseCanvas.height / 2);
  bctx.rotate(fotoEditorRotation * Math.PI / 180);
  bctx.drawImage(img, -w / 2, -h / 2, w, h);
  bctx.restore();

  photoCtx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
  photoCtx.drawImage(fotoEditorBaseCanvas, 0, 0);

  const cw = photoCanvas.width * fotoEditorCrop.w;
  const ch = photoCanvas.height * fotoEditorCrop.h;
  const cx = photoCanvas.width * fotoEditorCrop.x;
  const cy = photoCanvas.height * fotoEditorCrop.y;
  photoCtx.save();
  photoCtx.fillStyle = "rgba(0,0,0,.50)";
  photoCtx.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
  photoCtx.globalCompositeOperation = "destination-out";
  photoCtx.fillRect(cx, cy, cw, ch);
  photoCtx.globalCompositeOperation = "source-over";
  photoCtx.strokeStyle = "white";
  photoCtx.lineWidth = Math.max(3, photoCanvas.width / 300);
  photoCtx.strokeRect(cx, cy, cw, ch);
  // Ecken als sichtbare Griffe
  const r = Math.max(12, photoCanvas.width / 45);
  photoCtx.fillStyle = "white";
  [[cx,cy],[cx+cw,cy],[cx,cy+ch],[cx+cw,cy+ch]].forEach(([x,y]) => photoCtx.fillRect(x-r/2,y-r/2,r,r));
  photoCtx.restore();
}

function openPhotoEditor(file) {
  return new Promise(async resolve => {
    fotoEditorResolve = resolve;
    fotoEditorRotation = 0;
    fotoEditorCrop = { x: 0, y: 0, w: 1, h: 1 };
    fotoEditorImage = await loadImage(await bildZuDataURL(file));
    photoEditor.hidden = false;
    syncCropControls();
    drawPhotoEditor();
  });
}

function closePhotoEditor(result) {
  photoEditor.hidden = true;
  const resolve = fotoEditorResolve;
  fotoEditorResolve = null;
  fotoEditorImage = null;
  if (resolve) resolve(result);
}

async function blobZuJPEGUnter200KB(blob) {
  if (!blob) return null;
  const MAX_BYTES = 200 * 1024;
  if (blob.size <= MAX_BYTES && blob.type === "image/jpeg") return new File([blob], "partezettel.jpg", { type: "image/jpeg" });

  const img = await loadImage(await bildZuDataURL(blob));
  let scale = 1;
  let quality = 0.82;

  const encode = (width, height, q) => new Promise(resolve => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, "image/jpeg", q);
  });

  // Zuerst nur die JPEG-Qualität reduzieren. Erst wenn das nicht reicht,
  // wird die Auflösung schrittweise reduziert. Dadurch bleiben kleine Bilder
  // und bereits gut komprimierte Fotos unverändert bzw. möglichst groß.
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = await encode(img.naturalWidth * scale, img.naturalHeight * scale, quality);
    if (candidate && candidate.size <= MAX_BYTES) {
      return new File([candidate], "partezettel.jpg", { type: "image/jpeg" });
    }
    if (quality > 0.42) {
      quality -= 0.08;
    } else {
      scale *= 0.88;
      quality = 0.76;
    }
  }

  // Letzter Versuch mit stärkerer Reduzierung, damit das Ziel auch bei
  // sehr detailreichen Bildern möglichst zuverlässig erreicht wird.
  while (scale > 0.25) {
    const candidate = await encode(img.naturalWidth * scale, img.naturalHeight * scale, 0.68);
    if (candidate && candidate.size <= MAX_BYTES) {
      return new File([candidate], "partezettel.jpg", { type: "image/jpeg" });
    }
    scale *= 0.82;
  }
  const fallback = await encode(img.naturalWidth * scale, img.naturalHeight * scale, 0.60);
  return fallback ? new File([fallback], "partezettel.jpg", { type: "image/jpeg" }) : null;
}

function exportEditedPhoto() {
  if (!fotoEditorImage || !fotoEditorBaseCanvas.width) return null;
  const src = fotoEditorBaseCanvas;
  const x = Math.max(0, Math.round(src.width * fotoEditorCrop.x));
  const y = Math.max(0, Math.round(src.height * fotoEditorCrop.y));
  const w = Math.max(1, Math.min(src.width - x, Math.round(src.width * fotoEditorCrop.w)));
  const h = Math.max(1, Math.min(src.height - y, Math.round(src.height * fotoEditorCrop.h)));
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  out.getContext("2d").drawImage(src, x, y, w, h, 0, 0, w, h);
  return new Promise(resolve => out.toBlob(async blob => resolve(blob ? await blobZuJPEGUnter200KB(blob) : null), "image/jpeg", .92));
}

async function bearbeiteFotos(files) {
  const result = [];
  for (const file of Array.from(files || [])) {
    const edited = await openPhotoEditor(file);
    if (edited) result.push(edited);
  }
  return result;
}

async function handleFotoAuswahl(files) {
  const auswahl = Array.from(files || []).filter(Boolean);
  if (!auswahl.length) return;
  const bearbeitet = await bearbeiteFotos(auswahl);
  if (!bearbeitet.length) return;
  currentFotoBlobs.push(...bearbeitet);
  aktualisiereSchluesselfotoAuswahl();
  fotoStatus.textContent = currentFotoBlobs.length === 1 ? "1 Foto ausgewählt ✓" : `${currentFotoBlobs.length} Fotos ausgewählt ✓`;
  if (fotoWeiterBtn) fotoWeiterBtn.hidden = false;
  const url = URL.createObjectURL(currentFotoBlobs[0]);
  fotoPreview.src = url;
  fotoPreview.hidden = false;
  fotoPreview.style.display = "block";
}

const schluesselfotoAuswahl = document.getElementById("schluesselfoto-auswahl");
const schluesselfotoAuswahlWrap = document.getElementById("schluesselfoto-auswahl-wrap");
function aktualisiereSchluesselfotoAuswahl() {
  if (!schluesselfotoAuswahl || !schluesselfotoAuswahlWrap) return;
  schluesselfotoAuswahl.innerHTML = "";
  currentFotoBlobs.forEach((foto, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Foto ${index + 1}${index === 0 ? " (erstes Foto)" : ""}`;
    schluesselfotoAuswahl.appendChild(option);
  });
  currentSchluesselfotoIndex = Math.min(currentSchluesselfotoIndex, Math.max(0, currentFotoBlobs.length - 1));
  schluesselfotoAuswahl.value = String(currentSchluesselfotoIndex);
  schluesselfotoAuswahlWrap.hidden = currentFotoBlobs.length === 0;
}
schluesselfotoAuswahl?.addEventListener("change", () => { currentSchluesselfotoIndex = Number(schluesselfotoAuswahl.value) || 0; });
fotoInput.addEventListener("change", async () => { await handleFotoAuswahl(fotoInput.files); fotoInput.value = ""; });
const fotoWeiterBtn = document.getElementById("foto-weiter-btn");
if (fotoWeiterBtn) fotoWeiterBtn.addEventListener("click", () => fotoInput.click());

// ---------- Sprachaufnahme (kein Zeitlimit) ----------
const audioBtn = document.getElementById("audio-record-btn");
const audioStatus = document.getElementById("audio-status");
const audioPreview = document.getElementById("audio-preview");

function pickAudioMimeType() {
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

let currentAudioMimeType = "audio/webm";
let currentAudioExt = "webm";

if (audioBtn && audioStatus && audioPreview) {
  audioBtn.addEventListener("click", async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chosenType = pickAudioMimeType();
        mediaRecorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          currentAudioMimeType = mediaRecorder.mimeType || chosenType || "audio/webm";
          currentAudioExt = currentAudioMimeType.includes("mp4") ? "m4a"
            : currentAudioMimeType.includes("ogg") ? "ogg"
            : "webm";
          currentAudioBlob = new Blob(audioChunks, { type: currentAudioMimeType });
          const url = URL.createObjectURL(currentAudioBlob);
          audioPreview.src = url;
          audioPreview.hidden = false;
          const dauer = Math.round((Date.now() - recordStartTime) / 1000);
          audioStatus.textContent = `Aufnahme: ${dauer}s ✓`;
          stream.getTracks().forEach((t) => t.stop());
        };
        mediaRecorder.start();
        recordStartTime = Date.now();
        isRecording = true;
        audioBtn.textContent = "⏹️ Aufnahme stoppen";
        audioStatus.textContent = "Aufnahme läuft …";
      } catch (err) {
        audioStatus.textContent = "Mikrofonzugriff fehlgeschlagen";
        debugLog(`❌ Mikrofon: ${err.message || err}`);
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      audioBtn.textContent = "🎙️ Aufnahme starten";
    }
  });
}
fotoInputGalerie.addEventListener("change", async () => { await handleFotoAuswahl(fotoInputGalerie.files); fotoInputGalerie.value = ""; });

document.getElementById("photo-rotate-left").addEventListener("click", () => { fotoEditorRotation -= 90; drawPhotoEditor(); });
document.getElementById("photo-rotate-right").addEventListener("click", () => { fotoEditorRotation += 90; drawPhotoEditor(); });
document.getElementById("photo-reset").addEventListener("click", () => { fotoEditorRotation=0; fotoEditorCrop={x:0,y:0,w:1,h:1}; syncCropControls(); drawPhotoEditor(); });
const cropLeft = document.getElementById("crop-left");
const cropRight = document.getElementById("crop-right");
const cropTop = document.getElementById("crop-top");
const cropBottom = document.getElementById("crop-bottom");
function syncCropControls() {
  if (!cropLeft) return;
  cropLeft.value = Math.round(fotoEditorCrop.x * 100);
  cropRight.value = Math.round((1 - (fotoEditorCrop.x + fotoEditorCrop.w)) * 100);
  cropTop.value = Math.round(fotoEditorCrop.y * 100);
  cropBottom.value = Math.round((1 - (fotoEditorCrop.y + fotoEditorCrop.h)) * 100);
}
function updateCropFromControls() {
  if (!cropLeft) return;
  let l=Number(cropLeft.value)/100, r=Number(cropRight.value)/100, t=Number(cropTop.value)/100, b=Number(cropBottom.value)/100;
  if (l+r>0.90) { r=Math.min(r,0.90-l); cropRight.value=Math.round(r*100); }
  if (t+b>0.90) { b=Math.min(b,0.90-t); cropBottom.value=Math.round(b*100); }
  fotoEditorCrop={x:l,y:t,w:1-l-r,h:1-t-b};
  drawPhotoEditor();
}
[cropLeft,cropRight,cropTop,cropBottom].filter(Boolean).forEach(el=>el.addEventListener("input", updateCropFromControls));
document.getElementById("photo-cancel").addEventListener("click", () => closePhotoEditor(null));
document.getElementById("photo-apply").addEventListener("click", async () => closePhotoEditor(await exportEditedPhoto()));

function clampCrop() {
  fotoEditorCrop.w = Math.max(.08, Math.min(1, fotoEditorCrop.w));
  fotoEditorCrop.h = Math.max(.08, Math.min(1, fotoEditorCrop.h));
  fotoEditorCrop.x = Math.max(0, Math.min(1 - fotoEditorCrop.w, fotoEditorCrop.x));
  fotoEditorCrop.y = Math.max(0, Math.min(1 - fotoEditorCrop.h, fotoEditorCrop.y));
}

function photoCanvasPoint(e) {
  const rect = photoCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  };
}

photoCanvas.addEventListener("pointerdown", e => {
  if (!fotoEditorImage) return;
  const p = photoCanvasPoint(e);
  const c = fotoEditorCrop;
  const edge = Math.max(0.025, 18 / Math.max(photoCanvas.width, photoCanvas.height));
  const nearL = Math.abs(p.x - c.x) < edge;
  const nearR = Math.abs(p.x - (c.x + c.w)) < edge;
  const nearT = Math.abs(p.y - c.y) < edge;
  const nearB = Math.abs(p.y - (c.y + c.h)) < edge;
  const nearCorner = (nearL || nearR) && (nearT || nearB);
  const inside = p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
  if (!nearCorner && !inside) return;
  fotoEditorDragging = true;
  fotoEditorResize = nearCorner;
  fotoEditorResizeX = nearR ? 1 : (nearL ? -1 : 0);
  fotoEditorResizeY = nearB ? 1 : (nearT ? -1 : 0);
  photoCanvas.setPointerCapture?.(e.pointerId);
  fotoEditorDragStart = { x:p.x, y:p.y, cx:c.x, cy:c.y, cw:c.w, ch:c.h };
  e.preventDefault();
});

photoCanvas.addEventListener("pointermove", e => {
  if (!fotoEditorDragging) return;
  const p = photoCanvasPoint(e);
  const dx = p.x - fotoEditorDragStart.x;
  const dy = p.y - fotoEditorDragStart.y;
  const s = fotoEditorDragStart;
  if (fotoEditorResize) {
    let nx=s.cx, ny=s.cy, nw=s.cw, nh=s.ch;
    if (fotoEditorResizeX > 0) nw=s.cw+dx;
    if (fotoEditorResizeX < 0) { nx=s.cx+dx; nw=s.cw-dx; }
    if (fotoEditorResizeY > 0) nh=s.ch+dy;
    if (fotoEditorResizeY < 0) { ny=s.cy+dy; nh=s.ch-dy; }
    fotoEditorCrop={x:nx,y:ny,w:nw,h:nh};
  } else {
    fotoEditorCrop.x=s.cx+dx;
    fotoEditorCrop.y=s.cy+dy;
  }
  clampCrop();
  syncCropControls();
  drawPhotoEditor();
  e.preventDefault();
});

photoCanvas.addEventListener("pointerup", () => { fotoEditorDragging=false; fotoEditorResize=false; });
photoCanvas.addEventListener("pointercancel", () => { fotoEditorDragging=false; fotoEditorResize=false; });

// ---------- Datumsauswahl ----------
const MONATE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
function initDatum(prefix) {
  const tag=document.getElementById(prefix+"-tag"), monat=document.getElementById(prefix+"-monat"), jahr=document.getElementById(prefix+"-jahr");
  if (!tag || !monat || !jahr) return;
  initDatumElemente(tag, monat, jahr);
}
function initDatumElemente(tag, monat, jahr) {
  // Dynamische Partnerschaftsblöcke werden direkt über ihre Elemente initialisiert.
  // Dadurch ist die Datumsauswahl unabhängig von dynamisch vergebenen DOM-IDs.
  tag.replaceChildren(new Option("Tag", ""));
  for(let i=1;i<=31;i++) tag.appendChild(new Option(String(i), String(i).padStart(2,"0")));
  monat.replaceChildren(new Option("Monat", ""));
  MONATE.forEach((m,i)=>monat.appendChild(new Option(m, String(i+1).padStart(2,"0"))));
  jahr.replaceChildren(new Option("Jahr", ""));
  for(let y=new Date().getFullYear();y>=1600;y--) jahr.appendChild(new Option(String(y), String(y)));
}
function initJahrOnly(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.replaceChildren(new Option("Jahr", ""));
  for (let y = new Date().getFullYear(); y >= 1600; y--) {
    el.appendChild(new Option(String(y), String(y)));
  }
}

function getDatumElemente(tag, monat, jahr) {
  const t = tag?.value || "";
  const m = monat?.value || "";
  const y = jahr?.value || "";
  return t && m && y ? `${y}-${m}-${t}` : null;
}
function getDatum(prefix) {
  const t=document.getElementById(prefix+"-tag")?.value, m=document.getElementById(prefix+"-monat")?.value, y=document.getElementById(prefix+"-jahr")?.value;
  return t&&m&&y ? `${y}-${m}-${t}` : null;
}
function setDatum(prefix, value) {
  const t=document.getElementById(prefix+"-tag"),m=document.getElementById(prefix+"-monat"),y=document.getElementById(prefix+"-jahr");
  if(!t||!m||!y) return;
  setDatumElemente(t,m,y,value);
}
function setDatumElemente(t,m,y,value) {
  if(!value){t.value="";m.value="";y.value="";return;}
  const teile=String(value).slice(0,10).split("-");
  const yy=teile[0]||"", mm=teile[1]||"", dd=teile[2]||"";
  // Nur Werte auswählen, die in den jeweiligen Selects tatsächlich vorhanden sind.
  // So bleiben vollständige Daten sichtbar und Teilangaben (z. B. nur Jahr) möglich.
  y.value=/^\d{4}$/.test(yy) ? yy : "";
  m.value=/^\d{2}$/.test(mm) ? mm : "";
  t.value=/^\d{2}$/.test(dd) ? dd : "";
}
function setDatumJahr(prefix, jahr) {
  const t=document.getElementById(prefix+"-tag"),m=document.getElementById(prefix+"-monat"),y=document.getElementById(prefix+"-jahr");
  if(!t||!m||!y) return;
  setDatumJahrElemente(t,m,y,jahr);
}
function setDatumJahrElemente(t,m,y,jahr) {
  t.value="";
  m.value="";
  y.value=/^\d{4}$/.test(String(jahr||"")) ? String(jahr) : "";
}
["geburtsdatum","sterbedatum","d-geburtsdatum","d-sterbedatum","d-partner-beginn","d-partner-ende"].forEach(initDatum);
["geburtsjahr","sterbejahr","d-geburtsjahr","d-sterbejahr"].forEach(initJahrOnly);

// Vollständiges Datum und "nur Jahr bekannt" schließen sich gegenseitig aus.
// Bei einem vollständigen Datum wird das reine Jahresfeld gesperrt; bei einem
// reinen Jahr werden Tag/Monat/Jahr des vollständigen Datums gesperrt.
function synchronisiereNurJahrFeld(datumPrefix, jahrOnlyId) {
  const tag = document.getElementById(`${datumPrefix}-tag`);
  const monat = document.getElementById(`${datumPrefix}-monat`);
  const jahr = document.getElementById(`${datumPrefix}-jahr`);
  const nurJahr = document.getElementById(jahrOnlyId);
  if (!tag || !monat || !jahr || !nurJahr) return;

  const aktualisieren = () => {
    const vollstaendig = !!(tag.value && monat.value && jahr.value);
    const nurJahrGewaeht = !!nurJahr.value;

    if (vollstaendig) {
      nurJahr.value = "";
      nurJahr.disabled = true;
      tag.disabled = false;
      monat.disabled = false;
      jahr.disabled = false;
    } else if (nurJahrGewaeht) {
      tag.value = "";
      monat.value = "";
      jahr.value = "";
      tag.disabled = true;
      monat.disabled = true;
      jahr.disabled = true;
      nurJahr.disabled = false;
    } else {
      nurJahr.disabled = false;
      tag.disabled = false;
      monat.disabled = false;
      jahr.disabled = false;
    }
  };

  if (!nurJahr.dataset.syncInit) {
    [tag, monat, jahr, nurJahr].forEach((el) => el.addEventListener("change", aktualisieren));
    nurJahr.dataset.syncInit = "1";
  }
  aktualisieren();
}

synchronisiereNurJahrFeld("geburtsdatum", "geburtsjahr");
synchronisiereNurJahrFeld("sterbedatum", "sterbejahr");
synchronisiereNurJahrFeld("d-geburtsdatum", "d-geburtsjahr");
synchronisiereNurJahrFeld("d-sterbedatum", "d-sterbejahr");

// ---------- Verwandtschaft direkt bei der Ersterfassung ----------
const erstRelation = document.getElementById("erstverwandtschaft-typ");
const erstPerson = document.getElementById("erstverwandtschaft-person");
const erstFamilie = document.getElementById("erstverwandtschaft-familie");
const erstElternteil = document.getElementById("erstverwandtschaft-elternteil");
const erstRelationHinweis = document.getElementById("erstverwandtschaft-hinweis");
let erstRelationDaten = { personen: [], familien: [] };
const erstPartnerVorhanden = document.getElementById("erst-partner-vorhanden");
const erstPartnerschaftArt = document.getElementById("erst-partnerschaft-art");
let erstPartnerPersonenGeladen = false;
let erstPartnerFamilienCache = null;
// v340: Eine Datenquelle für alle Personenlisten: der Bestands-Cache (mit Änderungsprüfung).
let personenFrischAm = 0;
async function ensurePersonenFrisch(maxAlterMs = 30000) {
  const veraltet = !personenCacheGeladen || !Array.isArray(personenCache) || personenCache.length < 2 || (Date.now() - personenFrischAm) > maxAlterMs;
  if (veraltet) {
    try { await loadPersonen(); } catch (err) { debugLog(`⚠️ Personenliste aktualisieren: ${err.message || err}`); }
    if (!Array.isArray(personenCache) || personenCache.length < 2) {
      try { await loadPersonen(true); } catch (err) { debugLog(`⚠️ Personenliste vollständig laden: ${err.message || err}`); }
    }
    personenFrischAm = Date.now();
  }
  return Array.isArray(personenCache) ? personenCache : [];
}

async function ladeErstPartnerPersonen() {
  if (!erstPartnerVorhanden || erstPartnerPersonenGeladen) return;
  const data = await ensurePersonenFrisch();

  // Nur die kleinen Beziehungsfelder laden; keine Fotos oder Medien.
  if (!Array.isArray(erstPartnerFamilienCache)) {
    const { data: familien, error: familienError } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, ende, ende_automatik_ignorieren");
    if (familienError) throw familienError;
    erstPartnerFamilienCache = familien || [];
  }
  const personenLookup = new Map([...(personenCache || []), ...(data || [])].map(p => [p.id, p]));
  const belegt = new Set();
  for (const familie of erstPartnerFamilienCache) {
    const typ = String(familie.familientyp || "").trim().toLocaleLowerCase("de");
    if (typ !== "ehe" && typ !== "partnerschaft") continue;
    if (partnerschaftIstBeendet(familie, personenLookup)) continue;
    if (familie.partner_a_id) belegt.add(familie.partner_a_id);
    if (familie.partner_b_id) belegt.add(familie.partner_b_id);
  }

  const aktuell = document.getElementById("erstverwandtschaft-person")?.value || "";
  erstPartnerVorhanden.innerHTML = '<option value="">— keinen Partner auswählen —</option>';
  const kandidaten = (data || []).filter(person => person.id !== aktuell && !belegt.has(person.id))
    .sort(personenAuswahlSortierung);
  for (const person of kandidaten) {
    erstPartnerVorhanden.appendChild(personOption(person));
  }
  const hinweis = document.getElementById("erst-partner-hinweis");
  if (hinweis) hinweis.textContent = kandidaten.length
    ? `${kandidaten.length} verfügbare Personen – bereits verheiratete Personen werden ausgeblendet.`
    : "Keine verfügbaren Personen gefunden. Personen mit laufender Ehe/Partnerschaft werden ausgeblendet.";
  erstPartnerPersonenGeladen = true;
}
if (erstPartnerVorhanden) {
  erstPartnerVorhanden.addEventListener("focus", async () => {
    try { await ladeErstPartnerPersonen(); }
    catch (err) { const msg = document.getElementById("erst-partner-hinweis"); if (msg) msg.textContent = `Personen konnten nicht geladen werden: ${err.message || err}`; }
  });
}
async function ladeErstverwandtschaftPersonen() {
  if (!erstPerson) return;
  erstPerson.innerHTML = '<option value="">— Person auswählen —</option>';
  const personen = await ensurePersonenFrisch();
  erstRelationDaten.personen = personen.slice().sort(PersonSuche.sort);
  for (const person of erstRelationDaten.personen) erstPerson.appendChild(personOption(person));
}
async function aktualisiereErstverwandtschaft() {
  const typ = erstRelation?.value || "keine";
  document.getElementById("erstverwandtschaft-person-wrap").hidden = typ === "keine";
  document.getElementById("erstverwandtschaft-familie-wrap").hidden = typ !== "voll";
  document.getElementById("erstverwandtschaft-elternteil-wrap").hidden = typ !== "halb";
  erstRelationHinweis.textContent = "";
  if (typ === "keine") return;
  try {
    if (!erstRelationDaten.personen.length) await ladeErstverwandtschaftPersonen();
    if (!erstPerson.value) { erstRelationHinweis.textContent = "Bitte eine Bezugsperson auswählen."; return; }
    const { data: links, error: le } = await sb.from("familien_kinder").select("familie_id, kind_id, beziehungstyp").eq("kind_id", erstPerson.value);
    if (le) throw le;
    const ids = [...new Set((links || []).map(x => x.familie_id))];
    let familien = [];
    if (ids.length) {
      const { data, error } = await sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp").in("id", ids);
      if (error) throw error;
      familien = data || [];
    }
    erstRelationDaten.familien = familien.map(f => ({...f, link:(links||[]).find(l=>l.familie_id===f.id)}));
    erstFamilie.innerHTML = '<option value="">— Elternfamilie auswählen —</option>';
    for (const f of erstRelationDaten.familien) {
      const eltern = [f.partner_a_id,f.partner_b_id].filter(Boolean).map(id => personenAuswahlText(erstRelationDaten.personen.find(p=>p.id===id))).join(" + ");
      erstFamilie.appendChild(new Option(eltern || "Unbekannte Eltern", f.id));
    }
    erstElternteil.innerHTML = '<option value="">— gemeinsamen Elternteil auswählen —</option>';
    const elternIds = [...new Set(erstRelationDaten.familien.flatMap(f=>[f.partner_a_id,f.partner_b_id]).filter(Boolean))];
    for (const id of elternIds) erstElternteil.appendChild(new Option(personenAuswahlText(erstRelationDaten.personen.find(p=>p.id===id)), id));
    if (typ === "voll") {
      if (erstRelationDaten.familien.length === 1) erstFamilie.value = erstRelationDaten.familien[0].id;
      erstRelationHinweis.textContent = erstRelationDaten.familien.length ? "Die neue Person wird derselben Elternfamilie zugeordnet." : "Für diese Person ist noch keine Elternfamilie hinterlegt. Bitte zuerst die Eltern erfassen oder eine andere Beziehung wählen.";
    } else {
      erstRelationHinweis.textContent = "Wähle den Elternteil, den beide Personen gemeinsam haben. Für die neue Person wird eine eigene Ein-Eltern-Familie angelegt.";
    }
  } catch (err) { erstRelationHinweis.textContent = `Verwandtschaft konnte nicht geladen werden: ${err.message || err}`; }
}
if (erstRelation) erstRelation.addEventListener("change", () => { erstRelationDaten = { personen: [], familien: [] }; aktualisiereErstverwandtschaft(); });
if (erstPerson) erstPerson.addEventListener("change", aktualisiereErstverwandtschaft);
if (erstFamilie) erstFamilie.addEventListener("change", () => { erstRelationHinweis.textContent = "Diese Elternfamilie wird für die neue Person übernommen."; });
if (erstElternteil) erstElternteil.addEventListener("change", () => { erstRelationHinweis.textContent = "Der ausgewählte Elternteil wird mit der neuen Person verknüpft."; });

async function speichereErstverwandtschaft(eintrag) {
  const typ = eintrag.erstverwandtschaftTyp;
  if (!typ || typ === "keine") return;
  const bezugId = eintrag.erstverwandtschaftPerson;
  if (!bezugId || bezugId === eintrag.id) throw new Error("Bitte eine gültige Bezugsperson auswählen.");
  if (typ === "voll") {
    const familieId = eintrag.erstverwandtschaftFamilie;
    if (!familieId) throw new Error("Für Vollgeschwister bitte die gemeinsame Elternfamilie auswählen.");
    const { error } = await sb.from("familien_kinder").upsert({ familie_id: familieId, kind_id: eintrag.id, beziehungstyp: "biologisch" }, { onConflict: "familie_id,kind_id" });
    if (error) throw error;
    return;
  }
  if (typ === "halb") {
    const elternId = eintrag.erstverwandtschaftElternteil;
    if (!elternId) throw new Error("Bitte den gemeinsamen Elternteil auswählen.");
    const { data: f, error: fe } = await sb.from("familien").insert({ partner_a_id: elternId, partner_b_id: null, familientyp: "Elternfamilie" }).select("id").single();
    if (fe) throw fe;
    const { error: ke } = await sb.from("familien_kinder").insert({ familie_id: f.id, kind_id: eintrag.id, beziehungstyp: "biologisch" });
    if (ke) throw ke;
  }
}

// v329: Fehlendes Pflichtfeld markieren – der Cursor springt direkt in das Feld.
function fokussiereFehlerFeld(feld) {
  if (!feld) return;
  try { feld.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) { /* ältere Browser */ }
  feld.focus({ preventScroll: true });
}

// ---------- Formular absenden ----------
const form = document.getElementById("person-form");
const formMessage = document.getElementById("form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  // Pflichtfelder: nur Vorname und Geschlecht (Nachname kann unbekannt sein, z. B. nur Ledigenname bekannt).
  if (!document.getElementById("vorname").value.trim()) {
    formMessage.textContent = "Bitte den Vornamen eingeben.";
    fokussiereFehlerFeld(document.getElementById("vorname"));
    return;
  }
  if (!document.getElementById("geschlecht").value) {
    formMessage.textContent = "Bitte das Geschlecht auswählen.";
    fokussiereFehlerFeld(document.getElementById("geschlecht"));
    return;
  }
  debugLog("Formular abgeschickt – Verarbeitung startet.");
  formMessage.textContent = "Speichere …";

  const eintrag = {
    id: crypto.randomUUID(),
    vorname: document.getElementById("vorname").value.trim(),
    nachname: document.getElementById("nachname").value.trim(),
    ledigenname: document.getElementById("ledigenname").value.trim() || null,
    geschlecht: document.getElementById("geschlecht").value || null,
    geburtsdatum: getDatum("geburtsdatum"),
    geburtsjahr: getDatum("geburtsdatum") ? null : (document.getElementById("geburtsjahr").value.trim() ? Number(document.getElementById("geburtsjahr").value.trim()) : null),
    sterbedatum: getDatum("sterbedatum"),
    sterbejahr: getDatum("sterbedatum") ? null : (document.getElementById("sterbejahr").value.trim() ? Number(document.getElementById("sterbejahr").value.trim()) : null),
    taufbuch_link: document.getElementById("taufbuch-link").value.trim() || null,
    trauungsbuch_link: document.getElementById("trauungsbuch-link").value.trim() || null,
    sterbebuch_link: document.getElementById("sterbebuch-link").value.trim() || null,
    taufbuch_zeile: document.getElementById("taufbuch-zeile").value.trim() ? Number(document.getElementById("taufbuch-zeile").value) : null,
    trauungsbuch_zeile: document.getElementById("trauungsbuch-zeile").value.trim() ? Number(document.getElementById("trauungsbuch-zeile").value) : null,
    sterbebuch_zeile: document.getElementById("sterbebuch-zeile").value.trim() ? Number(document.getElementById("sterbebuch-zeile").value) : null,
    notiz: document.getElementById("notiz").value.trim() || null,
    fotos: currentFotoBlobs,
    schluesselfotoIndex: currentSchluesselfotoIndex,
    audio: currentAudioBlob,
    audio_dauer: audioPreview.hidden ? null : Math.round((audioPreview.duration || 0)),
    erstverwandtschaftTyp: document.getElementById("erstverwandtschaft-typ")?.value || "keine",
    erstverwandtschaftPerson: document.getElementById("erstverwandtschaft-person")?.value || null,
    erstverwandtschaftFamilie: document.getElementById("erstverwandtschaft-familie")?.value || null,
    erstverwandtschaftElternteil: document.getElementById("erstverwandtschaft-elternteil")?.value || null,
    erstPartnerId: document.getElementById("erst-partner-vorhanden")?.value || null,
    erstPartnerschaftArt: document.getElementById("erst-partnerschaft-art")?.value || "Ehe",
  };

  if (!eintrag.vorname) {
    formMessage.textContent = "Bitte den Vornamen eintragen.";
    return;
  }

  // v360: Plausibilität der Lebensdaten (Fehler blockieren, Warnungen werden nachgefragt)
  {
    const befunde = plausLebensdaten(eintrag);
    if (!(await plausFragen(befunde))) {
      formMessage.textContent = `Nicht gespeichert: ${befunde.find((b) => b.stufe === "fehler")?.text || "bitte die Angaben prüfen."}`;
      fokussiereFehlerFeld(document.getElementById("geburtsdatum-tag") || document.getElementById("vorname"));
      return;
    }
  }

  if (eintrag.erstverwandtschaftTyp !== "keine") {
    if (!eintrag.erstverwandtschaftPerson) { formMessage.textContent = "Bitte die Bezugsperson auswählen."; return; }
    if (eintrag.erstverwandtschaftTyp === "voll" && !eintrag.erstverwandtschaftFamilie) { formMessage.textContent = "Bitte die gemeinsame Elternfamilie auswählen."; return; }
    if (eintrag.erstverwandtschaftTyp === "halb" && !eintrag.erstverwandtschaftElternteil) { formMessage.textContent = "Bitte den gemeinsamen Elternteil auswählen."; return; }
  }

  if (navigator.onLine) {
    const result = await sendEintrag(eintrag, (msg) => { formMessage.textContent = msg; });
    if (result.ok) {
      formMessage.textContent = "Gespeichert ✓";
      resetForm();
    } else {
      await queueEintrag(eintrag);
      formMessage.textContent = `Fehler: ${result.error} — In Warteschlange gespeichert, wird später erneut versucht.`;
      resetForm();
    }
  } else {
    await queueEintrag(eintrag);
    formMessage.textContent = "Offline – Eintrag wird gesendet, sobald wieder Verbindung besteht.";
    resetForm();
  }
});

function resetForm() {
  form.reset();
  ["geburtsdatum","sterbedatum"].forEach(p=>setDatum(p,null));
  document.getElementById("geburtsjahr").value = "";
  document.getElementById("sterbejahr").value = "";
  document.getElementById("taufbuch-link").value = "";
  document.getElementById("trauungsbuch-link").value = "";
  document.getElementById("sterbebuch-link").value = "";
  document.getElementById("taufbuch-zeile").value = "";
  document.getElementById("trauungsbuch-zeile").value = "";
  document.getElementById("sterbebuch-zeile").value = "";
  document.getElementById("ledigenname").value = "";
  document.getElementById("geschlecht").value = "";
  if (erstRelation) erstRelation.value = "keine";
  if (erstPerson) erstPerson.innerHTML = '<option value="">— Person auswählen —</option>';
  if (erstFamilie) erstFamilie.innerHTML = '<option value="">— Elternfamilie auswählen —</option>';
  if (erstElternteil) erstElternteil.innerHTML = '<option value="">— Mutter oder Vater auswählen —</option>';
  if (erstRelationHinweis) erstRelationHinweis.textContent = "";
  if (erstPartnerVorhanden) { erstPartnerVorhanden.value = ""; erstPartnerVorhanden.innerHTML = '<option value="">— keinen Partner auswählen —</option>'; erstPartnerPersonenGeladen = false; erstPartnerFamilienCache = null; }
  const erstPartnerHinweis = document.getElementById("erst-partner-hinweis");
  if (erstPartnerHinweis) erstPartnerHinweis.textContent = "";
  document.getElementById("erstverwandtschaft-person-wrap").hidden = true;
  document.getElementById("erstverwandtschaft-familie-wrap").hidden = true;
  document.getElementById("erstverwandtschaft-elternteil-wrap").hidden = true;
  erstRelationDaten = { personen: [], familien: [] };

  // Neue Person beginnt nach dem Speichern garantiert ohne alte Medien.
  currentFotoBlobs = [];
  currentSchluesselfotoIndex = 0;
  aktualisiereSchluesselfotoAuswahl();
  if (fotoWeiterBtn) fotoWeiterBtn.hidden = true;
  if (fotoPreview) {
    const oldUrl = fotoPreview.src;
    fotoPreview.hidden = true;
    fotoPreview.setAttribute("hidden", "");
    fotoPreview.style.setProperty("display", "none", "important");
    fotoPreview.removeAttribute("src");
    if (oldUrl && oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
  }
  if (fotoInput) fotoInput.value = "";
  if (fotoInputGalerie) fotoInputGalerie.value = "";

  currentAudioBlob = null;
  audioChunks = [];
  if (audioPreview) {
    audioPreview.hidden = true;
    audioPreview.removeAttribute("src");
  }
  if (audioStatus) audioStatus.textContent = "Keine Aufnahme";
  if (fotoStatus) fotoStatus.textContent = "Kein Foto ausgewählt";
}

function mitTimeout(promise, ms, meldung) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(meldung)), ms)),
  ]);
}

// ---------- Eintrag an Supabase senden ----------
async function sendEintrag(eintrag, onProgress) {
  const step = (msg) => { if (onProgress) onProgress(msg); debugLog(msg); };
  try {
    step("Schritt 1/4: Anmelden …");
    await mitTimeout(
      ensureSession(),
      15000,
      "Zeitüberschreitung bei der Anmeldung (Netzwerk antwortet nicht)"
    );

    step("Schritt 2/4: Person speichern …");
    const { error: personError } = await mitTimeout(
      sb.from("personen").upsert({
        id: eintrag.id,
        vorname: eintrag.vorname,
        nachname: eintrag.nachname,
        "Ledigenname": eintrag.ledigenname,
        ...(eintrag.geschlecht ? { geschlecht: eintrag.geschlecht } : {}),
        geburtsdatum: eintrag.geburtsdatum,
        geburtsjahr: eintrag.geburtsjahr,
        sterbedatum: eintrag.sterbedatum,
        sterbejahr: eintrag.sterbejahr,
        taufbuch_link: eintrag.taufbuch_link,
        trauungsbuch_link: eintrag.trauungsbuch_link,
        sterbebuch_link: eintrag.sterbebuch_link,
        taufbuch_zeile: eintrag.taufbuch_zeile,
        trauungsbuch_zeile: eintrag.trauungsbuch_zeile,
        sterbebuch_zeile: eintrag.sterbebuch_zeile,
        Notiz: eintrag.notiz,
      }, { onConflict: "id" }),
      15000,
      "Zeitüberschreitung beim Speichern der Person (Netzwerk antwortet nicht)"
    );
    if (personError) throw personError;
    personenFrischAm = 0;   // v340: neue Person soll in allen Auswahllisten sofort verfügbar sein

    // Familienbeziehung nur nach erfolgreichem Personen-INSERT speichern.
    if (eintrag.erstverwandtschaftTyp && eintrag.erstverwandtschaftTyp !== "keine") {
      step("Verwandtschaft speichern …");
      await speichereErstverwandtschaft(eintrag);
    }
    if (eintrag.erstPartnerId) {
      if (eintrag.erstPartnerId === eintrag.id) throw new Error("Die Person kann nicht ihr eigener Partner sein.");
      step("Ehe/Partnerschaft speichern …");
      const { error: partnerError } = await sb.from("familien").insert({
        partner_a_id: eintrag.id,
        partner_b_id: eintrag.erstPartnerId,
        familientyp: eintrag.erstPartnerschaftArt || "Ehe",
        beginn: null,
        ende: null,
      });
      if (partnerError) throw partnerError;
    }

    // 2. Fotos hochladen
    if (eintrag.fotos && eintrag.fotos.length) {
      step(`Schritt 3/4: ${eintrag.fotos.length} Foto${eintrag.fotos.length === 1 ? "" : "s"} hochladen …`);
      for (const foto of eintrag.fotos) {
        const ext = foto.type && foto.type.includes("png") ? "png" : foto.type && foto.type.includes("webp") ? "webp" : "jpg";
        const path = `${eintrag.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        if (!foto || typeof foto.arrayBuffer !== "function") {
          throw new Error("Foto-Daten konnten nicht gelesen werden");
        }
        const fotoDaten = await foto.arrayBuffer();
        if (!fotoDaten || fotoDaten.byteLength === 0) {
          throw new Error("Foto enthält keine Bilddaten");
        }
        const { error: uploadError } = await mitTimeout(
          sb.storage.from(BUCKET_FOTOS).upload(path, fotoDaten, {
            contentType: foto.type || "image/jpeg",
            upsert: false,
          }),
          20000,
          "Zeitüberschreitung beim Foto-Upload (Netzwerk antwortet nicht)"
        );
        if (uploadError) throw uploadError;
        const istSchluesselfoto = eintrag.fotos.indexOf(foto) === eintrag.schluesselfotoIndex;
        const { error: insertError } = await sb.from("fotos").insert({ personen_id: eintrag.id, dateipfad: path, ist_schluesselfoto: istSchluesselfoto });
        if (insertError) throw insertError;
      }
    }

    // 3. Sprachnotiz hochladen
    if (eintrag.audio) {
      step("Schritt 4/4: Sprachnotiz hochladen …");
      const ext = eintrag.audio.type && eintrag.audio.type.includes("mp4") ? "m4a"
        : eintrag.audio.type && eintrag.audio.type.includes("ogg") ? "ogg"
        : "webm";
      const path = `${eintrag.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await mitTimeout(
        sb.storage.from(BUCKET_AUDIO).upload(path, eintrag.audio),
        20000,
        "Zeitüberschreitung beim Audio-Upload (Netzwerk antwortet nicht)"
      );
      if (uploadError) throw uploadError;
      await sb.from("sprachnotizen").insert({
        person_id: eintrag.id,
        dateipfad: path,
        dauer_sekunden: eintrag.audio_dauer,
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("Senden fehlgeschlagen:", err);
    const meldung = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    debugLog(`❌ Fehler: ${meldung}`);
    return { ok: false, error: meldung };
  }
}

// ---------- Offline-Warteschlange (IndexedDB) ----------
const DB_NAME = "partezettel-queue";
const STORE_NAME = "eintraege";

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueEintrag(eintrag) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(eintrag);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueue() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Einmalige Bereinigung der acht bekannten, nie erfolgreich gespeicherten Test-/Fehlversuche.
// Ausschließlich lokale IndexedDB-Warteschlange – Supabase wird dabei nicht verändert.
const BEKANNTE_FEHLER_QUEUE_IDS_V174 = [
  "0ff6f5ca-3011-4ee7-91f7-561c36001dfd",
  "270958b4-a398-462b-8524-04fc0e986b6d",
  "cc8439db-fb5f-40f0-87f5-1905165927cb",
  "d0e233c9-8408-4dd1-9c6b-5f049ae88d03",
  "ef71b0f8-72f7-4474-9a70-e5501223a9d8",
  "f21b831c-cc9e-4196-b3bb-f3887036f42e",
  "f4a3ab05-0578-4704-af35-ee7980c3c7aa",
  "fdbb5a03-c089-4a05-94a6-dcd04064c429"
];

async function bereinigeBekannteFehlerQueueV177() {
  const bekannteIds = new Set(BEKANNTE_FEHLER_QUEUE_IDS_V174);
  const normalisiere = value => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

  const db = await openQueueDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;

      const eintrag = cursor.value || {};
      const id = String(eintrag.id ?? "").trim();
      const vorname = normalisiere(eintrag.vorname);
      const nachname = normalisiere(eintrag.nachname);

      // Neben den bekannten IDs wird der letzte Testeintrag zusätzlich
      // über seinen Inhalt erkannt. Damit ist die Bereinigung unabhängig
      // davon, ob Safari die ID intern anders zurückliefert.
      const istBekannterFehler = bekannteIds.has(id);
      const istAnonymousTest = vorname === "anonymous" && nachname === "test";

      if (istBekannterFehler || istAnonymousTest) {
        cursor.delete();
      }
      cursor.continue();
    };

    cursorReq.onerror = () => reject(cursorReq.error);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB-Transaktion abgebrochen"));
  });

  // Sicherheitsprüfung: falls ein passender Datensatz trotz der ersten
  // Cursor-Runde noch vorhanden ist, wird genau dieser Datensatz nochmals
  // über seinen tatsächlich gespeicherten Schlüssel gelöscht.
  const verbliebene = await getQueue();
  const erneutZuLoeschen = verbliebene.filter(eintrag => {
    const id = String(eintrag?.id ?? "").trim();
    const vorname = normalisiere(eintrag?.vorname);
    const nachname = normalisiere(eintrag?.nachname);
    return bekannteIds.has(id) || (vorname === "anonymous" && nachname === "test");
  });

  for (const eintrag of erneutZuLoeschen) {
    await removeFromQueue(eintrag.id);
  }

  const endkontrolle = await getQueue();
  const nochVorhanden = endkontrolle.some(eintrag => {
    const id = String(eintrag?.id ?? "").trim();
    const vorname = normalisiere(eintrag?.vorname);
    const nachname = normalisiere(eintrag?.nachname);
    return bekannteIds.has(id) || (vorname === "anonymous" && nachname === "test");
  });

  if (nochVorhanden) {
    throw new Error("Die lokale Bereinigung konnte den Anonymous-Testeintrag nicht entfernen.");
  }

  localStorage.setItem("partezettel-v177-final-queue-bereinigung", "1");
  debugLog("🧹 v178: alte Fehlversuche einschließlich Anonymous Test lokal entfernt. Supabase unverändert.");
}

async function zeigeQueueDiagnose() {
  const output = document.getElementById("queue-diagnostic-output");
  if (!output) return;

  try {
    const queue = await getQueue();
    if (queue.length === 0) {
      output.innerHTML = "<p>Keine Einträge in der lokalen Warteschlange.</p>";
      return;
    }

    const rows = queue.map((eintrag, index) => {
      const vorname = String(eintrag.vorname ?? "");
      const nachname = String(eintrag.nachname ?? "");
      const id = escapeHtml(String(eintrag.id ?? ""));
      return `<tr><td>${index + 1}</td><td>${escapeHtml(vorname)}</td><td>${escapeHtml(nachname)}</td><td><code>${id}</code></td></tr>`;
    }).join("");

    output.innerHTML = `<p><strong>${queue.length} Einträge</strong> – nur Anzeige, keine Änderung.</p>
      <table><thead><tr><th>#</th><th>Vorname</th><th>Nachname</th><th>ID</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) {
    output.textContent = `Fehler beim Lesen der lokalen Warteschlange: ${err.message || err}`;
  }
}

async function flushQueue() {
  const queue = await getQueue();
  const banner = document.getElementById("pending-banner");
  if (queue.length === 0) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.textContent = `${queue.length} wartende Einträge werden gesendet …`;

  for (const eintrag of queue) {
    const result = await sendEintrag(eintrag);
    if (result.ok) await removeFromQueue(eintrag.id);
  }

  const remaining = await getQueue();
  if (remaining.length === 0) {
    banner.hidden = true;
  } else {
    banner.textContent = `${remaining.length} Einträge warten noch auf Verbindung.`;
  }
}

// v178: Keine automatische Queue-Übermittlung. Dadurch kann kein paralleler online-
// Handler die gerade bereinigten Alt-Einträge wieder in der Diagnose erscheinen lassen.
// Die Queue bleibt für neue, ausdrücklich erzeugte Offline-Einträge verfügbar.

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("queue-diagnostic-btn");
  if (btn) btn.addEventListener("click", zeigeQueueDiagnose);
});


let personenSortierung = "name";
let personenSortRichtung = 1;
function sortierJahr(person, feld) {
  if (feld === "geburtsjahr") return person.geburtsdatum ? Number(String(person.geburtsdatum).slice(0,4)) : (person.geburtsjahr ? Number(person.geburtsjahr) : null);
  if (feld === "sterbejahr") return person.sterbedatum ? Number(String(person.sterbedatum).slice(0,4)) : (person.sterbejahr ? Number(person.sterbejahr) : null);
  return null;
}
// v364: Dauer verständlich anzeigen – ab 1 Jahr in Jahren, darunter in Monaten, darunter in Tagen (nie „0 Jahre“).
// exakt = beide Daten taggenau bekannt; sonst „ca. N Jahre“ bzw. „unter 1 Jahr“.
function dauerText(start, ende, exakt = true) {
  if (!(start instanceof Date) || !(ende instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime()) || ende < start) return "";
  const vorTag = (a, b) => a.getMonth() < b.getMonth() || (a.getMonth() === b.getMonth() && a.getDate() < b.getDate());
  let j = ende.getFullYear() - start.getFullYear();
  if (vorTag(ende, start)) j--;
  if (j >= 1) return `${exakt ? "" : "ca. "}${j} ${j === 1 ? "Jahr" : "Jahre"}`;
  if (!exakt) return "unter 1 Jahr";
  let m = (ende.getFullYear() - start.getFullYear()) * 12 + ende.getMonth() - start.getMonth();
  if (ende.getDate() < start.getDate()) m--;
  if (m >= 1) return `${m} ${m === 1 ? "Monat" : "Monate"}`;
  const t = Math.round((Date.UTC(ende.getFullYear(), ende.getMonth(), ende.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
  if (t >= 1) return `${t} ${t === 1 ? "Tag" : "Tage"}`;
  return "unter 1 Tag";
}
function lebensalterInTagen(person) {
  if (!person?.geburtsdatum && !person?.geburtsjahr) return null;
  const geburt = person.geburtsdatum ? new Date(`${person.geburtsdatum}T00:00:00`) : new Date(`${String(person.geburtsjahr).padStart(4, "0")}-07-01T00:00:00`);
  if (Number.isNaN(geburt.getTime())) return null;
  let ende = null;
  if (person.sterbedatum) {
    ende = new Date(`${person.sterbedatum}T00:00:00`);
  } else if (person.sterbejahr) {
    const jahr = Number(person.sterbejahr);
    if (!Number.isInteger(jahr) || jahr < 1000 || jahr > 3000) return null;
    ende = new Date(`${String(jahr).padStart(4, "0")}-12-31T00:00:00`);
  } else {
    return null;
  }
  if (Number.isNaN(ende.getTime()) || ende < geburt) return null;
  return Math.floor((ende - geburt) / 86400000);
}
function lebensalterSortierungInTagen(person) {
  if (!person?.geburtsdatum && !person?.geburtsjahr) return null;
  const geburt = person.geburtsdatum ? new Date(`${person.geburtsdatum}T12:00:00`) : new Date(`${String(person.geburtsjahr).padStart(4, "0")}-07-01T12:00:00`);
  if (Number.isNaN(geburt.getTime())) return null;
  let ende = null;
  if (person.sterbedatum) ende = new Date(`${person.sterbedatum}T12:00:00`);
  else if (person.sterbejahr) {
    const jahr = Number(person.sterbejahr);
    if (!Number.isInteger(jahr) || jahr < 1000 || jahr > 3000) return null;
    ende = new Date(`${String(jahr).padStart(4, "0")}-12-31T12:00:00`);
  } else {
    // Ohne bekanntes Sterbedatum oder Sterbejahr ist das Lebensalter
    // für diese genealogische Sortierung nicht verlässlich und bleibt außen vor.
    return null;
  }
  if (Number.isNaN(ende.getTime()) || ende < geburt) return null;
  return Math.floor((ende - geburt) / 86400000);
}
function lebensalterAnzeige(person) {
  const tage = lebensalterInTagen(person);
  if (tage === null) return "";
  const exakt = !!(person.geburtsdatum && person.sterbedatum);
  if (exakt) return dauerText(new Date(`${person.geburtsdatum}T00:00:00`), new Date(`${person.sterbedatum}T00:00:00`), true);
  const jahre = Math.floor(tage / 365.2425);
  return jahre >= 1 ? `ca. ${jahre} ${jahre === 1 ? "Jahr" : "Jahre"}` : "unter 1 Jahr";
}
function sortierNachnameSchluessel(p) {
  return PersonSuche.sortSchluessel(p);
}
function sortierNameVergleich(a, b) {
  const ka = sortierNachnameSchluessel(a), kb = sortierNachnameSchluessel(b);
  if (!ka && kb) return 1;
  if (ka && !kb) return -1;
  const nc = ka.localeCompare(kb, "de", { sensitivity: "base" });
  return nc || String(a.vorname || "").localeCompare(String(b.vorname || ""), "de", { sensitivity: "base" }) || String(a.id || "").localeCompare(String(b.id || ""));
}
// Zeitstempel robust lesen (Safari/WebKit verträgt "2026-09-28 06:16:42+00" nicht).
function sortierZeitstempel(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(" ", "T").replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d{2})$/, "$1:00");
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}
function personenVergleich(a, b) {
  let av = null, bv = null, cmp = 0;
  if (personenSortierung === "name") {
    // Personen ganz ohne Namen stehen in beiden Richtungen am Ende.
    const ka = sortierNachnameSchluessel(a), kb = sortierNachnameSchluessel(b);
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    return sortierNameVergleich(a, b) * personenSortRichtung;
  }
  if (personenSortierung === "alter") {
    av = lebensalterSortierungInTagen(a); bv = lebensalterSortierungInTagen(b);
  } else if (personenSortierung === "geburtsjahr" || personenSortierung === "sterbejahr") {
    av = sortierJahr(a, personenSortierung); bv = sortierJahr(b, personenSortierung);
  } else if (personenSortierung === "erstellt") {
    const aRaw = a.erstellt_am || a.created_at;
    const bRaw = b.erstellt_am || b.created_at;
    av = sortierZeitstempel(aRaw);
    bv = sortierZeitstempel(bRaw);
  } else if (personenSortierung === "familie") {
    av = String(a._familienSortKey || a.nachname || "").trim();
    bv = String(b._familienSortKey || b.nachname || "").trim();
    if (!av) av = null;
    if (!bv) bv = null;
  }

  // Fehlende Werte bleiben immer am Ende – unabhängig von der Sortierrichtung.
  const aMissing = av === null || av === undefined || av === "" || (typeof av === "number" && !Number.isFinite(av));
  const bMissing = bv === null || bv === undefined || bv === "" || (typeof bv === "number" && !Number.isFinite(bv));
  if (aMissing && !bMissing) return 1;
  if (!aMissing && bMissing) return -1;
  if (!aMissing && !bMissing) {
    if (personenSortierung === "familie") cmp = String(av).localeCompare(String(bv), "de", { sensitivity: "base" });
    else cmp = av < bv ? -1 : av > bv ? 1 : 0;
    if (cmp) return cmp * personenSortRichtung;
  }
  // Bei gleichen/fehlenden Sortierwerten bleibt eine nachvollziehbare Namensreihenfolge.
  return sortierNameVergleich(a, b);
}
function sortierePersonen(personen) { return [...personen].sort(personenVergleich); }
function personenAuswahlText(person) {
  return PersonSuche.label(person);
}

function personenAuswahlSortierung(a, b) {
  return PersonSuche.sort(a, b);
}

function berechneFamilienSortKeys(personen,familien) {
  const ids=new Set(personen.map(p=>p.id)), adj=new Map(personen.map(p=>[p.id,new Set()]));
  for(const f of familien||[]) { const a=f.partner_a_id,b=f.partner_b_id; if(ids.has(a)&&ids.has(b)){adj.get(a).add(b);adj.get(b).add(a);} for(const k of f._kinder||[]){if(!ids.has(k))continue;if(ids.has(a)){adj.get(a).add(k);adj.get(k).add(a);}if(ids.has(b)){adj.get(b).add(k);adj.get(k).add(b);}}}
  const byId=new Map(personen.map(p=>[p.id,p])),seen=new Set();
  for(const p of personen){if(seen.has(p.id))continue;const stack=[p.id],comp=[];seen.add(p.id);while(stack.length){const id=stack.pop();comp.push(id);for(const n of adj.get(id)||[]){if(!seen.has(n)){seen.add(n);stack.push(n);}}}const key=comp.map(id=>byId.get(id)?.nachname||"").filter(Boolean).sort((x,y)=>x.localeCompare(y,"de",{sensitivity:"base"}))[0]||p.nachname||"";for(const id of comp)byId.get(id)._familienSortKey=key; }
}


// Wenn ein Todesdatum nachträglich erfasst wird, wird ein noch offenes
// Ehe-/Partnerschaftsende automatisch mit diesem Datum befüllt.
// Ein bereits vorhandenes Ende (z. B. Scheidung) wird niemals überschrieben.
// Bei ausschließlich bekanntem Sterbejahr bleibt das Datenbankfeld "ende"
// leer; die bestehende Anzeige kennzeichnet die Partnerschaft dennoch als
// durch den Tod beendet.
async function synchronisierePartnerschaftsEndeBeiTod(personId, sterbedatum, sterbejahr) {
  if (!personId || (!sterbedatum && !sterbejahr)) return;

  const { data: familien, error } = await sb
    .from("familien")
    .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, ende_automatik_ignorieren")
    .or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`);

  if (error) throw error;

  const typErlaubt = (typ) => {
    const t = String(typ || "").trim().toLocaleLowerCase("de");
    return t === "ehe" || t === "partnerschaft";
  };

  for (const familie of familien || []) {
    if (!typErlaubt(familie.familientyp) || familie.ende || familie.ende_automatik_ignorieren) continue;

    if (sterbedatum) {
      const { error: updateError } = await sb
        .from("familien")
        .update({ ende: sterbedatum })
        .eq("id", familie.id)
        .is("ende", null);

      if (updateError) throw updateError;
    }
    // Bei einem reinen Sterbejahr kein künstliches Datum speichern.
    // partnerschaftTodesende() liefert das Jahr weiterhin für die Anzeige.
  }
}

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

function partnerschaftEndeAnzeige(familie, lookup = personenCache) {
  if (familie?.ende) return `Ende: ${datumAnzeige(familie.ende)}`;
  const tod = partnerschaftTodesende(familie, lookup);
  if (!tod) return "Ende: offen";
  return tod.exakt ? `Ende: ${datumAnzeige(tod.datum)} · Tod` : `Ende: Tod ${tod.jahr}`;
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
      if (!partnerId || !istEheOderPartnerschaft) continue;
      const info = personenVerwandtschaftCache.get(partnerId);
      if (!info) continue;
      info.ehePartnerschaften.add(familie.id);
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
      if (!partnerId || !istEheOderPartnerschaft) continue;
      const info = personenVerwandtschaftCache.get(partnerId);
      if (!info) continue;
      info.ehePartnerschaften.add(familie.id);
      for (const kindId of familie._kinder || []) {
        if (kindId && kindId !== partnerId) info.kinder.add(kindId);
      }
    }
  }
  try { berechneFamilienSortKeys(personenCache, familienAuswahlCache); } catch (_) {}
}

async function ladeFamilienAusSupabaseFuerSync() {
  const [{ data: familien, error: familienError }, { data: familienKinder, error: kinderError }, { data: beziehungen, error: beziehungsError }] = await Promise.all([
    sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, ende_automatik_ignorieren"),
    sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp"),
    sb.from("beziehung").select("id, personen_a_id, personen_b_id, beziehungstyp")
  ]);
  if (familienError) throw familienError;
  if (kinderError) throw kinderError;
  if (beziehungsError) throw beziehungsError;
  familienAuswahlCache = familien || [];
  familienKinderAuswahlCache = familienKinder || [];
  beziehungenAuswahlCache = beziehungen || [];
  baueAuswahlCachesAusSyncDaten();
}

// v365: Prüf-Kennzeichen. Personen aus einem Import tragen herkunft_quelle; geprueft_am zeigt, ob schon geprüft.
// Fehlen die Spalten (Paket 3 nicht eingespielt), wird ohne sie weitergearbeitet.
let pruefSpaltenVorhanden = true;
const mitPruefSpalten = (basis) => pruefSpaltenVorhanden ? `${basis}, herkunft_quelle, geprueft_am` : basis;
function istPruefSpaltenFehler(error) {
  return pruefSpaltenVorhanden && /herkunft_quelle|geprueft_am|42703/i.test(`${error?.code || ""} ${error?.message || ""}`);
}
async function personenMitPruefSpalten(basis, bau) {
  let r = await bau(mitPruefSpalten(basis));
  if (r.error && istPruefSpaltenFehler(r.error)) {
    pruefSpaltenVorhanden = false;
    debugLog("ℹ️ Prüf-Kennzeichen nicht verfügbar (Spalten fehlen), Personen werden ohne geladen.");
    r = await bau(basis);
  }
  return r;
}
// Kleiner Punkt: Bernstein = ungeprüft, Grün = geprüft; Personen ohne Import-Herkunft erhalten keinen Punkt.
function pruefPunkt(p) {
  if (!p?.herkunft_quelle) return null;
  const s = document.createElement("span");
  s.className = `pruef-punkt ${p.geprueft_am ? "is-geprueft" : "is-offen"}`;
  s.title = `${p.geprueft_am ? "geprüft" : "ungeprüft"} · aus ${p.herkunft_quelle}`;
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", s.title);
  return s;
}
function pruefPunktHtml(p) {
  if (!p?.herkunft_quelle) return "";
  const t = `${p.geprueft_am ? "geprüft" : "ungeprüft"} · aus ${p.herkunft_quelle}`;
  return `<span class="pruef-punkt ${p.geprueft_am ? "is-geprueft" : "is-offen"}" role="img" title="${escapeHtml(t)}" aria-label="${escapeHtml(t)}"></span>`;
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
    const text = document.getElementById("debug-log")?.textContent || "";
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
    if (lokalGeladen && personenCacheSyncInitialisiert && !cacheOhnePruefFelder) {
      try {
        await synchronisierePersonenDelta();
      } catch (syncErr) {
        debugLog(`⚠️ Delta-Sync nach Cache-Laden: ${syncErr.message || syncErr}`);
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
    const { data, error } = await personenMitPruefSpalten("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, Notiz, created_at, erstellt_am", (sp) => sb
      .from("personen")
      .select(sp)
      .order("nachname", { ascending: true }));

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
        sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, ende_automatik_ignorieren"),
        sb.from("familien_kinder").select("familie_id, kind_id"),
        sb.from("beziehung").select("personen_a_id, personen_b_id, beziehungstyp")
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
          if (!partnerId || !istEheOderPartnerschaft) continue;
          const info = personenVerwandtschaftCache.get(partnerId);
          if (!info) continue;
          info.ehePartnerschaften.add(familie.id);
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
    await schluesselfotoLadePromise.value;
    return;
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
  }, { root: list, rootMargin: "400px 0px", threshold: 0.01 });

  for (const karte of personenKartenCache.values()) {
    if (!karte.li.hidden) schluesselfotoObserver.observe(karte.li);
  }
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

function aktualisierePersonenKarte(karte, p) {
  karte.person = p;
  karte.li.dataset.personId = p.id;
  karte.name.textContent = `${p.vorname || ""} ${p.nachname || ""}`.trim();
  const punkt = pruefPunkt(p);
  if (punkt) karte.name.prepend(punkt);
  const kartenLedigenname = String(p.Ledigenname || p.ledigenname || "").trim();
  if (kartenLedigenname) {
    const maiden = document.createElement("span");
    maiden.className = "person-card__maiden";
    maiden.textContent = ` (geb. ${kartenLedigenname})`;
    karte.name.appendChild(maiden);
  }
  karte.img.alt = `Schlüsselfoto von ${p.vorname || ""} ${p.nachname || ""}`.trim();

  const sterbeJahrAnzeige = p.sterbedatum
    ? p.sterbedatum.split("-")[0]
    : (p.sterbejahr ? String(p.sterbejahr) : "");
  const jahre = [
    p.geburtsdatum ? p.geburtsdatum.split("-")[0] : (p.geburtsjahr ? String(p.geburtsjahr) : ""),
    sterbeJahrAnzeige
  ].filter(Boolean).join(" – ");
  const alterAnzeige = lebensalterAnzeige(p);
  karte.years.textContent = `${jahre}${jahre && alterAnzeige ? " · " : ""}${alterAnzeige}`;
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
      if (!confirm("Diese Sprachnotiz unwiderruflich löschen?")) return;
      const { error: storageError } = await sb.storage.from(BUCKET_AUDIO).remove([item.dateipfad]);
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
  if (filterFeld) filterFeld.hidden = !personenCache.some((x) => x.herkunft_quelle);
  beobachteSchluesselfotos();
  // Trefferzähler („272 Personen“) nach jedem Neuaufbau der Liste aktualisieren.
  if (typeof window.partezettelPersonenSuche === "function") {
    window.partezettelPersonenSuche(document.getElementById("search-input")?.value || "");
  }
}


const personenSortSelect=document.getElementById("personen-sortierung");
document.getElementById("personen-pruef-filter")?.addEventListener("change", (e) => {
  personenPruefFilter = e.target.value || "";
  window.partezettelPersonenSuche?.(document.getElementById("search-input")?.value || "");
});
const personenSortButton=document.getElementById("personen-sort-richtung");

// ---------- Robuste lokale Namenssuche ----------
// Die Suche arbeitet ausschließlich auf dem bereits geladenen personenCache.
// Der direkte Handler wird zusätzlich vom <input>-Element aufgerufen. Damit
// hängt die Suche nicht davon ab, ob iPadOS einen zuvor registrierten
// Event-Listener nach einem View-/PWA-Wechsel noch korrekt ausführt.
let personenSucheLauf = 0;

function normalizePersonenSuchtext(value) {
  return PersonSuche.normalisiere(value);
}

function personenSuchtext(p, extra = "") {
  const e = PersonSuche.eintrag(p || {});
  return extra ? `${e.search} ${PersonSuche.normalisiere(extra)}` : e.search;
}

function personenSuchTreffer(person, suchwert, extra = "") {
  return PersonSuche.trifft(person || {}, suchwert, extra);
}

// v365: Filter „aus Hausblatt · ungeprüft / geprüft“ im Bestand
let personenPruefFilter = "";
function pruefFilterPasst(p) {
  if (personenPruefFilter === "offen") return !!p.herkunft_quelle && !p.geprueft_am;
  if (personenPruefFilter === "geprueft") return !!p.herkunft_quelle && !!p.geprueft_am;
  return true;
}
function wendePersonenSucheAn(suchwert) {
  const q = normalizePersonenSuchtext(suchwert);
  const tokens = q ? q.split(" ").filter(Boolean) : [];
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
    const sichtbar = (tokens.length === 0 || personenSuchTreffer(p, q)) && pruefFilterPasst(p);
    karte.li.hidden = !sichtbar;
    if (sichtbar) treffer++;
  }

  if (empty) {
    empty.textContent = treffer
      ? ""
      : (q ? `Keine Person für „${suchwert || q}“ gefunden.` : "Keine Personen für diesen Filter.");
    empty.hidden = treffer > 0;
  }
  if (list) list.setAttribute("data-suchtreffer", String(treffer));

  const status = document.getElementById("personen-suchtreffer");
  const filterText = personenPruefFilter === "offen" ? " ungeprüft" : personenPruefFilter === "geprueft" ? " geprüft" : "";
  if (status) status.textContent = q ? `${treffer} Treffer${filterText}` : `${treffer} Personen${filterText}`;
  return true;
}

// Öffentliche Funktion für den direkten oninput/onkeyup-Handler im HTML.
window.partezettelPersonenSuche = function (suchwert) {
  personenSucheLauf++;
  return wendePersonenSucheAn(suchwert);
};

// Fallback für programmatische Änderungen und ältere Ansichten.
function filterePersonenListeLokal() {
  const feld = document.getElementById("search-input");
  return window.partezettelPersonenSuche(feld?.value || "");
}

async function aktualisierePersonenSortierung() {
  aktualisierePersonenCacheStatus();
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

const personenSuchfeld = document.getElementById("search-input");
if (personenSuchfeld) {
  personenSuchfeld.addEventListener("input", () => {
    window.partezettelPersonenSuche(personenSuchfeld.value);
    registriereEgressSuchSchrittNachSuche(personenSuchfeld.value);
  });
  personenSuchfeld.addEventListener("search", () => {
    window.partezettelPersonenSuche(personenSuchfeld.value);
    registriereEgressSuchSchrittNachSuche(personenSuchfeld.value);
  });
  personenSuchfeld.addEventListener("keyup", () => {
    window.partezettelPersonenSuche(personenSuchfeld.value);
    registriereEgressSuchSchrittNachSuche(personenSuchfeld.value);
  });
}

document.addEventListener("input", (event) => {
  if (event.target?.id === "search-input") {
    window.partezettelPersonenSuche(event.target.value);
    registriereEgressSuchSchrittNachSuche(event.target.value);
  }
});

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

// ---------- Init ----------
(async function init() {
  try {
    await ensureSession();
    // v178: Alte lokale Fehlversuche robust und mit Endkontrolle bereinigen.
    await bereinigeBekannteFehlerQueueV177();
    // Keine automatische Übermittlung der Warteschlange: so entstehen keine
    // wiederkehrenden 400er-POSTs aus den alten Fehlversuchen.
    await zeigeQueueDiagnose();
    // Auch bei einer bereits bestehenden Anmeldung die Personenliste sofort
    // laden. So ist der lokale Such-Cache schon beim ersten Öffnen vorhanden.
    await loadPersonen();
  } catch (err) {
    const msg = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    debugLog(`⚠️ ${msg}`);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.error("SW-Fehler:", e));
  }
})();

// ==========================================================
// PERSON-DETAIL / BEARBEITEN
// ==========================================================

let currentDetailPersonId = null;
let detailOpenedFromTree = false;
let detailReturnTreePersonId = null;
let autoPartnerSave = false;
let detailAudioMediaRecorder = null;
let detailAudioChunks = [];
let detailAudioStart = null;
let detailIsRecording = false;

const detailOverlay = document.getElementById("detail-overlay");
const detailFamilieMessage = document.getElementById("d-familie-message");

function setDetailFamilieMessage(text) {
  if (detailFamilieMessage) detailFamilieMessage.textContent = text || "";
}

function aktualisiereLinkButton(id, wert) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const link = String(wert || "").trim();
  if (link) {
    btn.href = link;
    btn.hidden = false;
    btn.classList.add("btn--link-present");
    btn.removeAttribute("aria-disabled");
    btn.setAttribute("tabindex", "0");
  } else {
    btn.href = "#";
    btn.hidden = false;
    btn.classList.remove("btn--link-present");
    btn.setAttribute("aria-disabled", "true");
    btn.removeAttribute("tabindex");
  }
}


function personViewDatum(value) {
  if (!value) return "";
  const d = new Date(String(value).length === 4 ? `${value}-01-01T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  if (/^\d{4}$/.test(String(value))) return String(value);
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function personViewAlter(person, bisDatum = null, endeExakt = true) {
  const birthValue = person?.geburtsdatum || person?.geburtsjahr;
  if (!birthValue) return "";
  const birth = person.geburtsdatum ? new Date(`${person.geburtsdatum}T00:00:00`) : new Date(`${String(person.geburtsjahr).padStart(4, "0")}-07-01T00:00:00`);
  if (!Number.isFinite(birth.getTime())) return "";
  const end = bisDatum ? new Date(`${bisDatum}T00:00:00`) : new Date();
  if (!Number.isFinite(end.getTime()) || end < birth) return "";
  let years = end.getFullYear() - birth.getFullYear();
  if (end.getMonth() < birth.getMonth() || (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate())) years--;
  if (years < 0 || years > 125) return "";
  return dauerText(birth, end, !!person.geburtsdatum && endeExakt);
}

// v359: Lebenszeile der Personenansicht in verständlichem Wortlaut
//  gestorben:           „02.04.1920 – 15.01.1990 · wurde 69 Jahre alt“
//  vermutlich lebend:   „geboren 02.04.1961 · 65 Jahre alt“ (kein Hinweis auf ein fehlendes Sterbedatum)
//  sehr alt, ohne Tod:  „geboren 1860 · Sterbedatum unbekannt“
//  nur Tod bekannt:     „gestorben 15.01.1990“
function personViewLebenszeile(person) {
  const geb = person?.geburtsdatum || person?.geburtsjahr;
  const tod = person?.sterbedatum || person?.sterbejahr;
  const gebText = geb ? personViewDatum(geb) : "";
  const todText = tod ? personViewDatum(tod) : "";
  const alter = personViewAlter(person, person?.sterbedatum || (person?.sterbejahr ? `${person.sterbejahr}-12-31` : null), !!person?.sterbedatum || !person?.sterbejahr);
  const alterSatz = alter === "unter 1 Tag" ? "starb am Tag der Geburt" : alter === "unter 1 Jahr" ? "starb im ersten Lebensjahr" : alter ? `wurde ${alter} alt` : "";
  if (geb && tod) return [`${gebText} – ${todText}`, alterSatz].filter(Boolean).join(" · ");
  if (tod) return `gestorben ${todText}`;
  if (geb) {
    const gebJahr = Number(String(person.geburtsdatum || person.geburtsjahr).slice(0, 4));
    if (Number.isFinite(gebJahr) && new Date().getFullYear() - gebJahr > 110) return `geboren ${gebText} · Sterbedatum unbekannt`;
    return [`geboren ${gebText}`, alter ? `${alter} alt` : ""].filter(Boolean).join(" · ");
  }
  return "";
}

let currentPersonViewId = null;
// ---------- v355: Rückkehr zum Gruppenfoto ----------
// Öffnet man aus dem Gruppenfoto eine Person, führt das ✕ der Personenansicht wieder zurück in dasselbe Gruppenfoto
// (und zu der Ansicht, aus der das Foto geöffnet wurde).
let rueckkehrNachPerson = null;

async function kehreZumGruppenfotoZurueck() {
  const ziel = rueckkehrNachPerson;
  rueckkehrNachPerson = null;
  if (!ziel) return false;
  const aktiv = document.querySelector(".tab-btn.is-active")?.dataset.tab;
  if (ziel.tab && aktiv !== ziel.tab) document.querySelector(`.tab-btn[data-tab="${ziel.tab}"]`)?.click();
  if (ziel.personId) {
    try { await openPersonDetail(ziel.personId, { fromTree: ziel.tab === "stammbaum" }); }
    catch (err) { debugLog(`⚠️ Rückkehr zur Person: ${err?.message || err}`); }
  }
  if (ziel.viewer?.url) renderGruppenfotoViewer(ziel.viewer.url, ziel.viewer.markierungen, ziel.viewer.foto);
  return true;
}

async function openPersonDetail(personId, options = {}) {
  // Eine Rückkehr bleibt nur beim Öffnen aus dem Gruppenfoto und beim Weiterklicken zu Verwandten erhalten.
  if (!options.vonGruppenfoto && !options.behalteRueckkehr) rueckkehrNachPerson = null;
  currentPersonViewId = personId;
  try {
    await ensureSession();
    const { data: person, error } = await sb.from("personen").select("*").eq("id", personId).single();
    if (error || !person) {
      debugLog(`❌ Fehler beim Laden der Person: ${error?.message || "Person nicht gefunden"}`);
      return;
    }
    const overlay = document.getElementById("person-view-overlay");
    // Detailansicht sofort öffnen: nachgelagerte Foto-, Familien- oder Audioabfragen
    // dürfen das Öffnen der Person auf iPhone/iPad nicht blockieren.
    if (overlay) {
      overlay.hidden = false;
      overlay.scrollTop = 0;
      document.body.classList.add("person-view-open");
    }
    const name = [person.vorname, person.nachname].filter(Boolean).join(" ") || "Unbekannte Person";
    document.getElementById("pv-name").textContent = name;
    const kopfLedig = String(person.Ledigenname || person.ledigenname || person.geburtsname || "").trim();
    setzeVerlaufFuerPerson(person.id);
    const kopfLedigElement = document.getElementById("pv-maiden");
    if (kopfLedigElement) { kopfLedigElement.textContent = kopfLedig ? `geb. ${kopfLedig}` : ""; kopfLedigElement.hidden = !kopfLedig; }
    const personAudioPanel = document.getElementById("pv-audio-panel");
    if (personAudioPanel) {
      personAudioPanel.replaceChildren();
      ladeBestandsSprachnotizen(person.id, personAudioPanel).catch(err => {
        personAudioPanel.textContent = `Sprachnotizen konnten nicht geladen werden: ${err?.message || err}`;
      });
    }
    document.getElementById("pv-lifetime").textContent = personViewLebenszeile(person);
    zeigeHerkunftsvermerk(person);

    const keyphoto = document.getElementById("pv-keyphoto");
    keyphoto.hidden = true; keyphoto.removeAttribute("src");
    await ladeSchluesselfotos([person]);
    const photo = schluesselfotoCache.get(person.id);
    if (photo?.url) {
      keyphoto.src = photo.url; keyphoto.hidden = false;
      keyphoto.title = "Schlüsselfoto bildschirmfüllend öffnen";
      keyphoto.style.cursor = "zoom-in";
      keyphoto.onclick = () => {
        const viewer = document.getElementById("detail-photo-viewer");
        const viewerImg = document.getElementById("detail-photo-viewer-img");
        if (!viewer || !viewerImg) return;
        detailViewerFoto = null;
        if (detailPhotoViewerMarkers) detailPhotoViewerMarkers.innerHTML = "";
        if (detailPhotoViewerLegend) { detailPhotoViewerLegend.innerHTML = ""; detailPhotoViewerLegend.hidden = true; }
        if (detailPhotoViewerToggleNumbers) detailPhotoViewerToggleNumbers.hidden = true;
        setDetailPhotoViewerNumbersVisible(false);
        viewerImg.src = photo.url;
        viewer.hidden = false;
      };
    } else {
      keyphoto.onclick = null;
      keyphoto.removeAttribute("title");
    }

    // Kirchenbücher nur zeigen, wenn mindestens ein Link vorhanden ist.
    // Die Zeilennummer steht unmittelbar beim jeweiligen Link.
    const booksSection = document.getElementById("pv-books-section");
    const booksList = document.getElementById("pv-books-list");
    booksList.replaceChildren();
    const books = [
      ["Taufbuch", person.taufbuch_link, person.taufbuch_zeile],
      ["Trauungsbuch", person.trauungsbuch_link, person.trauungsbuch_zeile],
      ["Sterbebuch", person.sterbebuch_link, person.sterbebuch_zeile]
    ];
    books.filter(([, link]) => String(link || "").trim()).forEach(([label, url, line]) => {
      const row = document.createElement("div"); row.className = "person-view-book-row";
      const link = document.createElement("a"); link.href = String(url).trim(); link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = `📖 ${label} öffnen`;
      row.appendChild(link);
      // v361: alte Trauungsbuch-Zeile der Person markieren, damit sie entfällt,
      // sobald dieselbe Quelle bei einer Ehe hinterlegt ist.
      if (label === "Trauungsbuch") row.dataset.altTrauung = trauungsUrlSchluessel(url);
      if (line !== null && line !== undefined && String(line).trim() !== "") {
        const lineText = document.createElement("span"); lineText.className = "person-view-book-line"; lineText.textContent = `Zeile ${line}`; row.appendChild(lineText);
      }
      booksList.appendChild(row);
    });
    booksSection.hidden = booksList.children.length === 0;

    const spouseSection = document.getElementById("pv-spouse-section");
    const spouseList = document.getElementById("pv-spouse-list"); spouseList.replaceChildren();
    const [{ data: familyRows, error: familyError }, { data: childLinks, error: childError }] = await Promise.all([
      sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende").or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`),
      sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp")
    ]);
    if (familyError) debugLog(`⚠️ Ehepartner laden: ${familyError.message}`);
    if (childError) debugLog(`⚠️ Kinder laden: ${childError.message}`);
    const partnerFamilies = (familyRows || [])
      .filter(f => f.partner_a_id && f.partner_b_id && f.familientyp !== "Eltern")
      .sort((a, b) => {
        const da = String(a.beginn || "9999-99-99").slice(0, 10);
        const db = String(b.beginn || "9999-99-99").slice(0, 10);
        return da.localeCompare(db) || String(a.id || "").localeCompare(String(b.id || ""));
      });

    // Trauungsbuchquellen gehören zur jeweiligen Ehe und werden deshalb
    // zusätzlich im Bereich „Kirchenbücher“ angezeigt – auch bei mehreren Ehen.
    if (partnerFamilies.length) {
      const eheFamilienIds = partnerFamilies.map(f => f.id).filter(Boolean);
      try {
        const { data: eheQuellen, error: eheQuellenError } = await sb
          .from("familien_trauungsbuch_quellen")
          .select("familie_id, trauungsbuch_link, trauungsbuch_zeile")
          .in("familie_id", eheFamilienIds);
        if (eheQuellenError) throw eheQuellenError;

        const bereitsAngezeigt = new Set(
          [...booksList.querySelectorAll("a")].map(a => {
            const row = a.closest(".person-view-book-row");
            const line = row?.querySelector(".person-view-book-line")?.textContent || "";
            return `${a.href}|${line}`;
          })
        );
        const eheReihenfolge = new Map(partnerFamilies.map((familie, index) => [familie.id, index + 1]));
        for (const quelle of [...(eheQuellen || [])].sort((a, b) => (eheReihenfolge.get(a.familie_id) || 999) - (eheReihenfolge.get(b.familie_id) || 999))) {
          const url = String(quelle.trauungsbuch_link || "").trim();
          if (!url) continue;
          const line = quelle.trauungsbuch_zeile;
          const lineLabel = line !== null && line !== undefined && String(line).trim() !== "" ? `Zeile ${line}` : "";
          const key = `${new URL(url, window.location.href).href}|${lineLabel}`;
          if (bereitsAngezeigt.has(key)) continue;
          // v361: gleiche Seite wie die alte Personen-Quelle → alte Zeile ausblenden (Doppel vermeiden)
          booksList.querySelectorAll("[data-alt-trauung]").forEach(alt => {
            if (alt.dataset.altTrauung === trauungsUrlSchluessel(url)) alt.remove();
          });

          const row = document.createElement("div");
          row.className = "person-view-book-row";
          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          const eheNummer = eheReihenfolge.get(quelle.familie_id);
          link.textContent = `📖 ${eheNummer ? `${eheNummer}. Ehe – ` : ""}Trauungsbuch öffnen`;
          row.appendChild(link);
          if (lineLabel) {
            const lineText = document.createElement("span");
            lineText.className = "person-view-book-line";
            lineText.textContent = lineLabel;
            row.appendChild(lineText);
          }
          booksList.appendChild(row);
          bereitsAngezeigt.add(key);
        }
        booksSection.hidden = booksList.children.length === 0;
      } catch (err) {
        debugLog(`⚠️ Trauungsbuchquellen in Kirchenbüchern laden: ${err.message || err}`);
      }
    }

    const spouseIds = [...new Set(partnerFamilies.map(f => f.partner_a_id === personId ? f.partner_b_id : f.partner_a_id).filter(Boolean))];
    const childFamilyIds = new Set(partnerFamilies.map(f => f.id));
    const childrenLinks = (childLinks || []).filter(link => childFamilyIds.has(link.familie_id));

    // Eltern der aktuellen Person: familien_kinder verknüpft das Kind mit seiner Elternfamilie.
    // Familien und Personen werden nur für tatsächlich vorhandene Elternlinks nachgeladen.
    const ownParentFamilyIds = [...new Set((childLinks || []).filter(link => link.kind_id === personId).map(link => link.familie_id).filter(Boolean))];
    let ownParentFamilies = [];
    if (ownParentFamilyIds.length) {
      const { data: parentFamilyData, error: parentFamilyError } = await sb.from("familien")
        .select("id, partner_a_id, partner_b_id, familientyp")
        .in("id", ownParentFamilyIds);
      if (parentFamilyError) debugLog(`⚠️ Eltern in Bestand laden: ${parentFamilyError.message}`);
      // Entscheidend ist die tatsächliche Kind-Verknüpfung in familien_kinder,
      // nicht der Text in familientyp. Ältere Datensätze können Eltern trotz
      // anderer Familientyp-Bezeichnung enthalten. Der Filter nach Typ führte
      // dazu, dass ein Elternteil oder beide Eltern in der Bestand-Ansicht fehlten.
      ownParentFamilies = parentFamilyData || [];
    }
    const parentIds = [...new Set(ownParentFamilies.flatMap(f => [f.partner_a_id, f.partner_b_id]).filter(id => id && id !== personId))];
    const relatedIds = [...new Set([...spouseIds, ...childrenLinks.map(x => x.kind_id).filter(Boolean), ...parentIds])];
    let relatedPeople = [];
    if (relatedIds.length) {
      const { data, error: relatedError } = await personenMitPruefSpalten("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr", (sp) => sb.from("personen").select(sp).in("id", relatedIds));
      if (relatedError) debugLog(`⚠️ Verwandte Personen laden: ${relatedError.message}`);
      relatedPeople = data || [];
    }
    const relatedMap = new Map(relatedPeople.map(p => [p.id, p]));
    const addPersonLink = (container, related, extra = "", options = {}) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "person-view-person-link";
      const name = [related.vorname, related.nachname].filter(Boolean).join(" ");
      const birth = related.geburtsdatum || related.geburtsjahr;
      const death = related.sterbedatum || related.sterbejahr;
      const life = [birth, death].filter(Boolean).map(personViewDatum).join(" – ");
      const details = [name];
      // Ledigenname steht immer dabei, wenn vorhanden (auch wenn er dem Nachnamen entspricht).
      const maiden = String(related.Ledigenname || related.ledigenname || related.geburtsname || "").trim();
      if (maiden) details.push(`geb. ${maiden}`);
      if (life) details.push(life);
      // Das Alter wird nur für verstorbene Personen ergänzt. Bei unvollständigen
      // Daten (nur Jahreszahlen) ist es ausdrücklich eine ungefähre Angabe.
      if (death && birth) {
        const alterText = lebensalterAnzeige(related);
        if (alterText) details.push(alterText);
      }
      if (extra) details.push(extra);
      button.textContent = details.join(" · ");
      const relPunkt = pruefPunkt(related);
      if (relPunkt) button.prepend(relPunkt);
      button.addEventListener("click", () => openPersonDetail(related.id, { behalteRueckkehr: true })); container.appendChild(button);
    };
    const parentsSection = document.getElementById("pv-parents-section");
    const parentsList = document.getElementById("pv-parents-list");
    parentsList.replaceChildren();
    // Eltern über sämtliche verknüpften Elternfamilien sammeln. So funktionieren
    // auch Datensätze, in denen Vater und Mutter in getrennten Familienzeilen
    // hinterlegt sind. IDs deduplizieren, ohne die gespeicherte Zuordnung zu ändern.
    const parentRoleSeen = new Set();
    const orderedParentIds = [];
    for (const family of ownParentFamilies) {
      for (const parentId of [family.partner_a_id, family.partner_b_id]) {
        if (!parentId || parentId === personId || parentRoleSeen.has(parentId)) continue;
        parentRoleSeen.add(parentId);
        orderedParentIds.push(parentId);
      }
    }
    for (const parentId of orderedParentIds) {
      const parent = relatedMap.get(parentId);
      if (!parent) {
        debugLog(`⚠️ Elternteil ${parentId} ist verknüpft, aber konnte für die Bestand-Anzeige nicht geladen werden.`);
        continue;
      }
      const row = document.createElement("div"); row.className = "person-view-relation-row";
      addPersonLink(row, parent, "", { showMaidenName: true });
      parentsList.appendChild(row);
    }
    parentsSection.hidden = !parentsList.children.length;

    for (const family of partnerFamilies) {
      const spouseId = family.partner_a_id === personId ? family.partner_b_id : family.partner_a_id;
      const spouse = relatedMap.get(spouseId); if (!spouse) continue;
      const row = document.createElement("div"); row.className = "person-view-relation-row";
      // Bei Ehepartnern den Ledigenname immer anzeigen, sofern vorhanden.
      addPersonLink(row, spouse, "", { showMaidenName: true });
      const marriage = family.beginn ? personViewDatum(family.beginn) : "";
      if (marriage) {
        const date = document.createElement("span"); date.className = "person-view-relation-date";
        let duration = "";
        const startDate = new Date(`${String(family.beginn).slice(0, 10)}T00:00:00`);
        // Ehedauer endet am gespeicherten Ehe-Ende oder – falls keines
        // hinterlegt ist – am früheren Sterbedatum der beiden Ehepartner.
        // So wird bei mehreren Ehen nicht versehentlich bis zum Tod eines
        // späteren Ehepartners weitergerechnet.
        // Alle bekannten möglichen Enddaten berücksichtigen. Ein gespeichertes
        // Familienende darf ein früheres Sterbedatum eines Ehepartners nicht
        // übergehen (z. B. wenn das Familienende fälschlich auf den Tod des
        // späteren Ehepartners gesetzt wurde).
        const endCandidates = [];
        const addEndCandidate = (value, approximate = false) => {
          if (!value) return;
          const dateText = String(value).slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return;
          const parsed = new Date(`${dateText}T00:00:00`);
          if (!Number.isNaN(parsed.getTime()) && parsed >= startDate) {
            endCandidates.push({ date: parsed, approximate });
          }
        };
        addEndCandidate(family.ende);
        const peopleForDuration = [...relatedPeople, ...(Array.isArray(personenCache) ? personenCache : [])];
        const couple = [personId, spouseId]
          .map(id => personAusLookup(peopleForDuration, id))
          .filter(Boolean);
        // Beide Partner immer prüfen: Ein Sterbejahr des früher verstorbenen
        // Partners zählt auch dann, wenn beim anderen ein genaues Sterbedatum
        // vorhanden ist. Das Jahresende ist nur ein Vergleichsanker, kein
        // behauptetes genaues Sterbedatum.
        couple.forEach(p => {
          if (p.sterbedatum) {
            addEndCandidate(p.sterbedatum, false);
          } else if (p.sterbejahr) {
            const year = Number(p.sterbejahr);
            if (Number.isInteger(year) && year > 0) addEndCandidate(`${year}-12-31`, true);
          }
        });
        // Bei unbekanntem Todesdatum endet eine frühere Ehe spätestens mit
        // Beginn einer späteren Ehe desselben Partners. Gilt auch für bereits
        // vorhandene Ehen; nur die Anzeige wird berechnet, DB-Daten bleiben gleich.
        const coupleIds = new Set([personId, spouseId]);
        const currentStart = String(family.beginn || "").slice(0, 10);
        (partnerFamilies || []).forEach(otherFamily => {
          if (!otherFamily || otherFamily.id === family.id || String(otherFamily.familientyp || "").trim().toLocaleLowerCase("de") !== "ehe") return;
          if (![otherFamily.partner_a_id, otherFamily.partner_b_id].some(id => coupleIds.has(id))) return;
          const laterStart = String(otherFamily.beginn || "").slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(laterStart) && laterStart >= currentStart) addEndCandidate(laterStart, false);
        });
        endCandidates.sort((a, b) => a.date - b.date);
        const earliest = endCandidates[0] || null;
        const endDate = earliest?.date || null;
        if (endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate >= startDate) {
          let years = endDate.getFullYear() - startDate.getFullYear();
          if (endDate.getMonth() < startDate.getMonth() || (endDate.getMonth() === startDate.getMonth() && endDate.getDate() < startDate.getDate())) years--;
          if (years >= 0) duration = ` · ${dauerText(startDate, endDate, !earliest.approximate)}`;
        }
        date.textContent = `💍 Hochzeit: ${marriage}${duration}`; row.appendChild(date);
      }
      spouseList.appendChild(row);
    }
    spouseSection.hidden = !spouseList.children.length;

    const childrenSection = document.getElementById("pv-children-section");
    const childrenList = document.getElementById("pv-children-list"); childrenList.replaceChildren();
    const uniqueChildIds = [...new Set(childrenLinks.map(x => x.kind_id).filter(id => id && id !== personId))];
    uniqueChildIds.map(id => relatedMap.get(id)).filter(Boolean).sort((a,b) => String(a.geburtsdatum || a.geburtsjahr || "9999").localeCompare(String(b.geburtsdatum || b.geburtsjahr || "9999")) || `${a.nachname||""} ${a.vorname||""}`.localeCompare(`${b.nachname||""} ${b.vorname||""}`, "de")).forEach(child => addPersonLink(childrenList, child));
    childrenSection.hidden = !childrenList.children.length;

    // Weitere Fotos dieser Person inklusive Gruppenfotos, auf denen sie markiert ist.
    const photosSection = document.getElementById("pv-photos-section");
    const photosList = document.getElementById("pv-photos-list");
    photosList.replaceChildren();
    try {
      const [{ data: directPhotos, error: directPhotosError }, { data: photoLinks, error: photoLinksError }] = await Promise.all([
        sb.from("fotos").select("*").eq("personen_id", personId),
        // Sortierwert und Verknüpfungs-ID werden in derselben ohnehin nötigen Abfrage geladen.
        sb.from("foto_personen").select("id, foto_id, sortierung").eq("personen_id", personId)
      ]);
      if (directPhotosError) throw directPhotosError;
      if (photoLinksError) throw photoLinksError;
      const photoIds = [...new Set([...(directPhotos || []).map(f => f.id), ...(photoLinks || []).map(x => x.foto_id)].filter(Boolean))];
      let photoRows = [];
      if (photoIds.length) {
        const { data, error: photoError } = await sb.from("fotos").select("*").in("id", photoIds);
        if (photoError) throw photoError;
        photoRows = (data || []).filter(f => f.dateipfad);
      }
      // Die Reihenfolge ist personenspezifisch: Verknüpfte Fotos verwenden
      // foto_personen.sortierung; reine Eigentümerfotos verwenden fotos.sortierung.
      // So beeinflusst das Sortieren bei einer Person keine andere Person.
      const orderKey = `partezettel-foto-reihenfolge-${personId}`;
      let legacyOrder = [];
      try { legacyOrder = JSON.parse(localStorage.getItem(orderKey) || "[]"); } catch (_) {}
      const legacyIndex = new Map(legacyOrder.map((id, index) => [String(id), index]));
      const linkByPhotoId = new Map((photoLinks || []).map(link => [String(link.foto_id), link]));
      const hasSort = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
      photoRows.forEach(photo => {
        photo._personSortRow = linkByPhotoId.get(String(photo.id)) || null;
        const row = photo._personSortRow;
        photo._personSortValue = row ? row.sortierung : (photo.personen_id === personId ? photo.sortierung : null);
      });
      // Erst eine stabile Ausgangsreihenfolge bestimmen. Bereits lokal gespeicherte
      // Reihenfolgen werden nur als Migrationshilfe für noch unsortierte Fotos genutzt.
      photoRows.sort((a, b) => {
        if (!!a.ist_schluesselfoto !== !!b.ist_schluesselfoto) return Number(!!b.ist_schluesselfoto) - Number(!!a.ist_schluesselfoto);
        const ai = legacyIndex.has(String(a.id)) ? legacyIndex.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
        const bi = legacyIndex.has(String(b.id)) ? legacyIndex.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
        return ai - bi
          || String(a.aufnahme_jahr || "9999").localeCompare(String(b.aufnahme_jahr || "9999"))
          || String(a.created_at || "").localeCompare(String(b.created_at || ""))
          || String(a.id).localeCompare(String(b.id));
      });
      const SORT_GAP = 100000;
      let fallbackIndex = 0;
      photoRows.forEach(photo => {
        if (photo.ist_schluesselfoto) {
          photo._personFallbackRank = -SORT_GAP;
          photo._personSortRank = -SORT_GAP;
          return;
        }
        photo._personFallbackRank = fallbackIndex++ * SORT_GAP;
        photo._personSortRank = hasSort(photo._personSortValue) ? Number(photo._personSortValue) : photo._personFallbackRank;
      });
      photoRows.sort((a, b) => {
        if (!!a.ist_schluesselfoto !== !!b.ist_schluesselfoto) return Number(!!b.ist_schluesselfoto) - Number(!!a.ist_schluesselfoto);
        return a._personSortRank - b._personSortRank
          || a._personFallbackRank - b._personFallbackRank
          || String(a.id).localeCompare(String(b.id));
      });
      const photoUrls = await ladeFotoBilder([...new Set(photoRows.map(f => f.dateipfad))]);
      const writePersonSort = async (photo, rank) => {
        const row = photo._personSortRow;
        if (row) {
          const { error } = await sb.from("foto_personen").update({ sortierung: rank }).eq("id", row.id);
          if (error) throw error;
          row.sortierung = rank;
        } else if (photo.personen_id === personId) {
          const { error } = await sb.from("fotos").update({ sortierung: rank }).eq("id", photo.id);
          if (error) throw error;
          photo.sortierung = rank;
        } else {
          throw new Error("Für dieses Foto fehlt die persönliche Fotozuordnung.");
        }
        photo._personSortValue = rank;
        photo._personSortRank = rank;
      };
      const persistMovedPhoto = async (photo, orderedPhotos) => {
        const sortable = orderedPhotos.filter(f => !f.ist_schluesselfoto);
        const needsInitialization = legacyOrder.length > 0 && sortable.some(f => !hasSort(f._personSortValue));
        if (needsInitialization) {
          // Einmalige Initialisierung: Die aktuelle Reihenfolge (einschließlich
          // einer eventuell vorhandenen lokalen Alt-Reihenfolge) wird für diese
          // Person in die passenden Sortierfelder übernommen. Es werden nur
          // kleine Integerwerte geschrieben, niemals Bilddateien übertragen.
          const oldValues = new Map(sortable.map(f => [f.id, f._personSortValue]));
          try {
            for (let i = 0; i < sortable.length; i++) {
              await writePersonSort(sortable[i], i * SORT_GAP);
            }
          } catch (saveError) {
            let restoreError = null;
            for (const row of sortable) {
              try { await writePersonSort(row, oldValues.get(row.id) ?? null); }
              catch (err) { restoreError = err; }
            }
            if (restoreError) {
              throw new Error(`${saveError.message || saveError}; Wiederherstellung unvollständig: ${restoreError.message || restoreError}`);
            }
            throw saveError;
          }
          return;
        }
        const index = sortable.findIndex(f => f.id === photo.id);
        const left = index > 0 ? sortable[index - 1] : null;
        const right = index < sortable.length - 1 ? sortable[index + 1] : null;
        const leftRank = left ? left._personSortRank : null;
        const rightRank = right ? right._personSortRank : null;
        let rank;
        if (leftRank === null) rank = rightRank - SORT_GAP;
        else if (rightRank === null) rank = leftRank + SORT_GAP;
        else if (rightRank - leftRank > 1) rank = Math.floor((leftRank + rightRank) / 2);
        else {
          // Nur wenn ein Sortierabstand aufgebraucht ist, werden die kleinen
          // Metadatenwerte neu nummeriert. Bilddateien werden dabei nie übertragen.
          const oldValues = new Map(sortable.map(f => [f.id, f._personSortValue]));
          try {
            for (let i = 0; i < sortable.length; i++) {
              const normalizedRank = i * SORT_GAP;
              await writePersonSort(sortable[i], normalizedRank);
            }
          } catch (saveError) {
            let restoreError = null;
            for (const row of sortable) {
              try { await writePersonSort(row, oldValues.get(row.id) ?? null); }
              catch (err) { restoreError = err; }
            }
            if (restoreError) {
              throw new Error(`${saveError.message || saveError}; Wiederherstellung unvollständig: ${restoreError.message || restoreError}`);
            }
            throw saveError;
          }
          return;
        }
        await writePersonSort(photo, rank);
      };
      const openPhoto = async (photo, url) => {
        if (photo.gruppenfoto) {
          const { data: markers, error: markersError } = await sb.from("foto_personen").select("id, personen_id, nummer, position_x, position_y, position_format").eq("foto_id", photo.id).order("nummer", { ascending: true });
          if (markersError) debugLog(`⚠️ Gruppenfoto-Markierungen: ${markersError.message}`);
          openGruppenfotoViewer(url, markers || [], photo);
        } else {
          const viewer = document.getElementById("detail-photo-viewer");
          const viewerImg = document.getElementById("detail-photo-viewer-img");
          if (viewer && viewerImg) {
            detailViewerFoto = null;
            if (detailPhotoViewerMarkers) detailPhotoViewerMarkers.innerHTML = "";
            if (detailPhotoViewerLegend) { detailPhotoViewerLegend.innerHTML = ""; detailPhotoViewerLegend.hidden = true; }
            if (detailPhotoViewerToggleNumbers) detailPhotoViewerToggleNumbers.hidden = true;
            setDetailPhotoViewerNumbersVisible(false);
            viewerImg.src = url; viewer.hidden = false;
          }
        }
      };
      let photoOrderSaving = false;
      const renderPersonPhotos = () => {
        photosList.replaceChildren();
        photoRows.forEach((photo, index) => {
          const url = photoUrls.get(photo.dateipfad) || fotoBildMemoryCache.get(photo.dateipfad) || "";
          if (!url) return;
          const tile = document.createElement("div"); tile.className = "person-view-photo-tile";
          const open = document.createElement("button"); open.type = "button"; open.className = "person-view-photo-open";
          open.setAttribute("aria-label", `${photo.titel || (photo.gruppenfoto ? "Gruppenfoto" : "Foto ansehen")} groß öffnen`);
          const img = document.createElement("img"); img.src = url; img.alt = photo.titel || (photo.gruppenfoto ? "Gruppenfoto" : "Foto");
          const caption = document.createElement("span"); caption.textContent = `${photo.ist_schluesselfoto ? "⭐ " : ""}${photo.titel || (photo.gruppenfoto ? "Gruppenfoto" : "Foto ansehen")}`;
          open.append(img, caption); open.addEventListener("click", () => openPhoto(photo, url));
          const controls = document.createElement("div"); controls.className = "person-view-photo-order";
          if (!photo.ist_schluesselfoto) {
            const sortableRows = photoRows.filter(f => !f.ist_schluesselfoto);
            const sortableIndex = sortableRows.findIndex(f => f.id === photo.id);
            const up = document.createElement("button"); up.type = "button"; up.className = "btn btn--ghost"; up.textContent = "↑"; up.title = "Foto nach vorne verschieben"; up.setAttribute("aria-label", "Foto nach vorne verschieben"); up.disabled = photoOrderSaving || sortableIndex === 0;
            const down = document.createElement("button"); down.type = "button"; down.className = "btn btn--ghost"; down.textContent = "↓"; down.title = "Foto nach hinten verschieben"; down.setAttribute("aria-label", "Foto nach hinten verschieben"); down.disabled = photoOrderSaving || sortableIndex === sortableRows.length - 1;
            const move = async (delta) => {
              if (photoOrderSaving) return;
              const target = sortableIndex + delta;
              if (target < 0 || target >= sortableRows.length) return;
              const previousOrder = [...photoRows];
              const previousRanks = new Map(photoRows.map(f => [f.id, { rank: f._personSortRank, value: f._personSortValue }]));
              photoOrderSaving = true;
              const [item] = photoRows.splice(photoRows.findIndex(f => f.id === photo.id), 1);
              const targetPhoto = sortableRows[target];
              const targetIndex = photoRows.findIndex(f => f.id === targetPhoto.id);
              photoRows.splice(targetIndex + (delta > 0 ? 1 : 0), 0, item);
              renderPersonPhotos();
              try {
                await persistMovedPhoto(item, photoRows);
                // Erst nach bestätigtem Speichern lokale Alt-Reihenfolge entfernen.
                try { localStorage.removeItem(orderKey); } catch (_) {}
                photoOrderSaving = false;
                renderPersonPhotos();
              } catch (err) {
                photoRows.splice(0, photoRows.length, ...previousOrder);
                for (const row of photoRows) {
                  const old = previousRanks.get(row.id);
                  if (old) { row._personSortRank = old.rank; row._personSortValue = old.value; }
                }
                photoOrderSaving = false;
                renderPersonPhotos();
                debugLog(`❌ Foto-Reihenfolge konnte nicht in Supabase gespeichert werden: ${err.message || err}`);
                alert(`Die Foto-Reihenfolge konnte nicht gespeichert werden. Die Anzeige wurde auf die vorherige Reihenfolge zurückgesetzt.\nBitte Verbindung und Berechtigungen prüfen.\n\n${err.message || err}`);
              }
            };
            up.addEventListener("click", () => move(-1)); down.addEventListener("click", () => move(1));
            controls.append(up, down);
          } else {
            controls.textContent = "Schlüsselfoto";
            controls.setAttribute("aria-label", "Schlüsselfoto bleibt an erster Stelle");
          }
          tile.append(open, controls); photosList.appendChild(tile);
        });
      };
      renderPersonPhotos();
    } catch (photoErr) {
      debugLog(`⚠️ Weitere Fotos konnten nicht geladen werden: ${photoErr.message || photoErr}`);
    }
    photosSection.hidden = photosList.children.length === 0;

    // Optionale externe Quellen nur anzeigen, wenn tatsächlich gültige Links vorhanden sind.
    const personLinks = normalisiereWeiterfuehrendeLinks(person.weiterfuehrende_links)
      .map(link => {
        try {
          const parsed = new URL(link.url);
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
          return { titel: link.titel || parsed.hostname, url: parsed.href };
        } catch (_) { return null; }
      }).filter(Boolean);
    const linksSection = document.getElementById("pv-links-section");
    const linksList = document.getElementById("pv-links-list");
    if (linksSection && linksList) {
      linksList.replaceChildren();
      personLinks.forEach(link => {
        const row = document.createElement("div");
        row.className = "person-view-link-row";
        const anchor = document.createElement("a");
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = link.titel;
        row.appendChild(anchor);
        linksList.appendChild(row);
      });
      linksSection.hidden = personLinks.length === 0;
    }

    const notes = String(person.Notiz || person.notiz || "").trim();
    document.getElementById("pv-notes-section").hidden = !notes;
    document.getElementById("pv-notes").textContent = notes;
    document.getElementById("pv-tree").onclick = async () => {
      rueckkehrNachPerson = null;
      overlay.hidden = true; document.body.classList.remove("person-view-open");
      const treeTab = document.querySelector('.tab-btn[data-tab="stammbaum"]');
      if (treeTab) treeTab.click();
      await loadStammbaum();
      setTreePersonSelection(personId);
      document.getElementById("tab-stammbaum")?.scrollIntoView({ block: "start", behavior: "auto" });
    };
    document.getElementById("pv-edit").onclick = async () => {
      rueckkehrNachPerson = null;
      overlay.hidden = true; document.body.classList.remove("person-view-open");
      await openPersonEdit(personId, options);
    };
    overlay.hidden = false; overlay.scrollTop = 0; document.body.classList.add("person-view-open");
  } catch (err) {
    debugLog(`❌ Fehler beim Öffnen der Personenansicht: ${err?.message || err}`);
  }
}

document.getElementById("pv-close")?.addEventListener("click", () => {
  document.getElementById("person-view-overlay").hidden = true;
  document.body.classList.remove("person-view-open");
  void kehreZumGruppenfotoZurueck();
});
document.getElementById("person-view-overlay")?.addEventListener("click", (event) => {
  if (event.target.id === "person-view-overlay") {
    event.currentTarget.hidden = true;
    document.body.classList.remove("person-view-open");
    void kehreZumGruppenfotoZurueck();
  }
});

function normalisiereWeiterfuehrendeLinks(value) {
  if (Array.isArray(value)) return value.filter(x => x && (String(x.titel || "").trim() || String(x.url || "").trim())).map(x => ({ titel: String(x.titel || "").trim(), url: String(x.url || "").trim() }));
  if (typeof value === "string") { try { return normalisiereWeiterfuehrendeLinks(JSON.parse(value)); } catch (_) { return []; } }
  return [];
}
function rendereWeiterfuehrendeLinksEditor(value) {
  const container = document.getElementById("d-weiterfuehrende-links-list");
  if (!container) return;
  const links = normalisiereWeiterfuehrendeLinks(value);
  container.replaceChildren();
  links.forEach(link => fuegeWeiterfuehrendenLinkHinzu(link.titel, link.url));
}
function fuegeWeiterfuehrendenLinkHinzu(titel = "", url = "") {
  const container = document.getElementById("d-weiterfuehrende-links-list");
  if (!container) return;
  const row = document.createElement("div"); row.className = "weiterfuehrende-link-row";
  const titleLabel = document.createElement("label"); titleLabel.className = "field weiterfuehrende-link-title";
  const titleSpan = document.createElement("span"); titleSpan.textContent = "Titel";
  const titleInput = document.createElement("input"); titleInput.type = "text"; titleInput.className = "weiterfuehrende-link-titel"; titleInput.placeholder = "z. B. Verlustlisten"; titleInput.value = titel;
  titleLabel.append(titleSpan, titleInput);
  const urlLabel = document.createElement("label"); urlLabel.className = "field weiterfuehrende-link-url";
  const urlSpan = document.createElement("span"); urlSpan.textContent = "Webadresse (URL)";
  const urlInput = document.createElement("input"); urlInput.type = "url"; urlInput.className = "weiterfuehrende-link-url-input"; urlInput.placeholder = "https://…"; urlInput.inputMode = "url"; urlInput.value = url;
  urlLabel.append(urlSpan, urlInput);
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn--ghost weiterfuehrende-link-remove"; remove.textContent = "✕"; remove.setAttribute("aria-label", "Link entfernen"); remove.addEventListener("click", () => row.remove());
  row.append(titleLabel, urlLabel, remove); container.append(row);
}
function leseWeiterfuehrendeLinksEditor() {
  return [...document.querySelectorAll("#d-weiterfuehrende-links-list .weiterfuehrende-link-row")].map(row => ({
    titel: row.querySelector(".weiterfuehrende-link-titel")?.value.trim() || "",
    url: row.querySelector(".weiterfuehrende-link-url-input")?.value.trim() || ""
  })).filter(link => link.titel && link.url);
}
const weiterfuehrendeLinksAddButton = document.getElementById("d-weiterfuehrende-links-add");
if (weiterfuehrendeLinksAddButton) weiterfuehrendeLinksAddButton.addEventListener("click", () => fuegeWeiterfuehrendenLinkHinzu());

async function openPersonEdit(personId, options = {}) {
  currentDetailPersonId = personId;
  detailOpenedFromTree = options.fromTree === true;
  detailReturnTreePersonId = detailOpenedFromTree ? personId : null;
  await ensureSession();

  const { data: person, error } = await sb.from("personen").select("*").eq("id", personId).single();
  if (error) { debugLog(`❌ Fehler beim Laden der Person: ${error.message}`); return; }

  document.getElementById("d-vorname").value = person.vorname || "";
  document.getElementById("d-nachname").value = person.nachname || "";
  document.getElementById("d-ledigenname").value = person.Ledigenname || "";
  { const g = treePersonGender(person); document.getElementById("d-geschlecht").value = g === "m" ? "männlich" : g === "w" ? "weiblich" : ""; }
  setDatum("d-geburtsdatum", person.geburtsdatum);
  setDatum("d-sterbedatum", person.sterbedatum);
  document.getElementById("d-geburtsjahr").value = person.geburtsjahr ? String(person.geburtsjahr) : "";
  document.getElementById("d-sterbejahr").value = person.sterbejahr ? String(person.sterbejahr) : "";
  synchronisiereNurJahrFeld("d-geburtsdatum", "d-geburtsjahr");
  synchronisiereNurJahrFeld("d-sterbedatum", "d-sterbejahr");
  document.getElementById("d-taufbuch-link").value = person.taufbuch_link || "";
  document.getElementById("d-trauungsbuch-link").value = person.trauungsbuch_link || "";
  document.getElementById("d-sterbebuch-link").value = person.sterbebuch_link || "";
  document.getElementById("d-taufbuch-zeile").value = person.taufbuch_zeile ?? "";
  document.getElementById("d-trauungsbuch-zeile").value = person.trauungsbuch_zeile ?? "";
  document.getElementById("d-sterbebuch-zeile").value = person.sterbebuch_zeile ?? "";
  aktualisiereLinkButton("d-taufbuch-open", person.taufbuch_link);
  aktualisiereLinkButton("d-trauungsbuch-open", person.trauungsbuch_link);
  aktualisiereLinkButton("d-sterbebuch-open", person.sterbebuch_link);
  document.getElementById("d-taufbuch-open").textContent = person.taufbuch_link ? "📖 Taufbuch öffnen" : "📖 Kein Taufbuch-Link";
  document.getElementById("d-sterbebuch-open").textContent = person.sterbebuch_link ? "📖 Sterbebuch öffnen" : "📖 Kein Sterbebuch-Link";
  document.getElementById("d-notiz").value = person.Notiz || "";
  rendereWeiterfuehrendeLinksEditor(person.weiterfuehrende_links);
  document.getElementById("d-person-message").textContent = "";
  document.getElementById("d-foto-message").textContent = "";
  document.getElementById("d-audio-message").textContent = "";
  setDetailFamilieMessage("");
  document.getElementById("d-delete-message").textContent = "";

  // Personendaten sofort öffnen. Nachgelagerte Medien/Familien dürfen das
  // Öffnen der Detailansicht nicht blockieren.
  detailOverlay.hidden = false;
  // Die Detailansicht immer am Anfang öffnen, damit der Name sofort sichtbar ist.
  detailOverlay.scrollTop = 0;
  const detailSheet = detailOverlay.querySelector(".detail-sheet");
  if (detailSheet) detailSheet.scrollTop = 0;
  requestAnimationFrame(() => {
    detailOverlay.scrollTop = 0;
    if (detailSheet) detailSheet.scrollTop = 0;
  });

  try { await loadDetailFotos(personId); } catch (err) { debugLog(`⚠️ Fotos der Person konnten nicht geladen werden: ${err.message || err}`); }
  try { await loadDetailAudio(personId); } catch (err) { debugLog(`⚠️ Sprachnotizen der Person konnten nicht geladen werden: ${err.message || err}`); }
  // Für die Familienansicht immer aktuelle Personennamen verwenden.
  try { await loadPersonen(); } catch (_) {}
  try { await loadDetailFamilie(personId); } catch (err) { debugLog(`⚠️ Familienangaben konnten nicht geladen werden: ${err.message || err}`); }
}

document.getElementById("detail-close-btn").addEventListener("click", async () => {
  if (detailGeaendert && !window.confirm("Es gibt nicht gespeicherte Änderungen. Trotzdem schließen?")) return;
  setzeDetailSauber();
  const fromTree = detailOpenedFromTree;
  const returnTreePersonId = detailReturnTreePersonId;
  detailOverlay.hidden = true;
  detailOpenedFromTree = false;
  detailReturnTreePersonId = null;
  if (fromTree) {
    const select = document.getElementById("tree-person-select");
    if (select && returnTreePersonId) select.value = returnTreePersonId;
    try { await loadStammbaum(); } catch (err) { debugLog(`⚠️ Stammbaum nach Rückkehr: ${err.message || err}`); }
  } else {
    loadPersonen();
  }
});

// Trauungsbuch-Link bei Ehepartnern synchronisieren.
// Es wird ausschließlich das Trauungsbuch-Feld behandelt. Bereits vorhandene
// Links werden nicht überschrieben; nur ein fehlender Link wird ergänzt.
async function synchronisiereTrauungsbuchEhepartner(personId, link) {
  const eigenerLink = String(link || "").trim();
  if (!personId || !eigenerLink) return;

  const { data: familien, error: familienError } = await sb.from("familien")
    .select("id, partner_a_id, partner_b_id, familientyp")
    .or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`)
    .eq("familientyp", "Ehe");
  if (familienError) throw familienError;

  const partnerIds = [...new Set((familien || [])
    .map((f) => familiePartnerIds(f, personId)[0])
    .filter(Boolean))];
  if (!partnerIds.length) return;

  const { data: partnerPersonen, error: partnerError } = await sb.from("personen")
    .select("id, trauungsbuch_link")
    .in("id", partnerIds);
  if (partnerError) throw partnerError;

  for (const partner of partnerPersonen || []) {
    // Bestehende Daten des Partners niemals überschreiben.
    if (String(partner.trauungsbuch_link || "").trim()) continue;
    const { error } = await sb.from("personen")
      .update({ trauungsbuch_link: eigenerLink })
      .eq("id", partner.id);
    if (error) throw error;
  }
}

// Bei einer neu angelegten Ehe kann der Link bereits beim anderen Ehepartner
// vorhanden sein. In diesem Fall wird nur die fehlende Seite ergänzt.
async function synchronisiereTrauungsbuchBeiEhe(personAId, personBId) {
  if (!personAId || !personBId) return;

  const { data: personen, error } = await sb.from("personen")
    .select("id, trauungsbuch_link")
    .in("id", [personAId, personBId]);
  if (error) throw error;

  const a = (personen || []).find((p) => p.id === personAId);
  const b = (personen || []).find((p) => p.id === personBId);
  const linkA = String(a?.trauungsbuch_link || "").trim();
  const linkB = String(b?.trauungsbuch_link || "").trim();
  const gemeinsamerLink = linkA || linkB;
  if (!gemeinsamerLink) return;

  if (!linkA) {
    const { error: e } = await sb.from("personen")
      .update({ trauungsbuch_link: gemeinsamerLink })
      .eq("id", personAId);
    if (e) throw e;
  }
  if (!linkB) {
    const { error: e } = await sb.from("personen")
      .update({ trauungsbuch_link: gemeinsamerLink })
      .eq("id", personBId);
    if (e) throw e;
  }
}

// ---- Person-Felder speichern ----
document.getElementById("d-save-person-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-person-message");
  msg.textContent = "Speichere …";
  // Elternauswahl vor dem allgemeinen Speichern sichern. Die allgemeinen
  // Personendaten dürfen bereits gespeicherte Elternbeziehungen nicht verlieren.
  const elternVaterId = document.getElementById("d-vater")?.value || null;
  const elternMutterId = document.getElementById("d-mutter")?.value || null;
  const vorname = document.getElementById("d-vorname").value.trim();
  const nachname = document.getElementById("d-nachname").value.trim();
  if (!vorname) {
    msg.textContent = "Bitte den Vornamen eingeben.";
    fokussiereFehlerFeld(document.getElementById("d-vorname"));
    return;
  }
  const geschlechtWert = document.getElementById("d-geschlecht").value;
  if (!geschlechtWert) {
    msg.textContent = "Bitte das Geschlecht auswählen.";
    fokussiereFehlerFeld(document.getElementById("d-geschlecht"));
    return;
  }
  // v360: Plausibilität der Lebensdaten und im Vergleich mit Eltern, Kindern und Partnern
  {
    const neu = plausFormPerson("d-");
    const befunde = [...plausLebensdaten(neu), ...(await plausVerwandteDerPerson(currentDetailPersonId, neu))];
    if (!(await plausFragen(befunde))) {
      msg.textContent = `Nicht gespeichert: ${befunde.find((b) => b.stufe === "fehler")?.text || "bitte die Angaben prüfen."}`;
      return;
    }
  }
  const { error } = await sb.from("personen").update({
    vorname,
    nachname,
    "Ledigenname": document.getElementById("d-ledigenname").value.trim() || null,
    geschlecht: geschlechtWert,
    geburtsdatum: getDatum("d-geburtsdatum"),
    geburtsjahr: getDatum("d-geburtsdatum") ? null : (document.getElementById("d-geburtsjahr").value.trim() ? Number(document.getElementById("d-geburtsjahr").value.trim()) : null),
    sterbedatum: getDatum("d-sterbedatum"),
    sterbejahr: getDatum("d-sterbedatum") ? null : (document.getElementById("d-sterbejahr").value.trim() ? Number(document.getElementById("d-sterbejahr").value.trim()) : null),
    taufbuch_link: document.getElementById("d-taufbuch-link").value.trim() || null,
    trauungsbuch_link: document.getElementById("d-trauungsbuch-link").value.trim() || null,
    sterbebuch_link: document.getElementById("d-sterbebuch-link").value.trim() || null,
    taufbuch_zeile: document.getElementById("d-taufbuch-zeile").value.trim() ? Number(document.getElementById("d-taufbuch-zeile").value) : null,
    trauungsbuch_zeile: document.getElementById("d-trauungsbuch-zeile").value.trim() ? Number(document.getElementById("d-trauungsbuch-zeile").value) : null,
    sterbebuch_zeile: document.getElementById("d-sterbebuch-zeile").value.trim() ? Number(document.getElementById("d-sterbebuch-zeile").value) : null,
    Notiz: document.getElementById("d-notiz").value.trim() || null,
    weiterfuehrende_links: leseWeiterfuehrendeLinksEditor(),
  }).eq("id", currentDetailPersonId);
  personenFrischAm = 0;   // v340: geänderte Namen sofort in allen Auswahllisten verwenden
  if (error) {
    msg.textContent = `Fehler: ${error.message}`;
    return;
  }

  // Wird ein Todesdatum nachträglich eingetragen, ein bisher offenes
  // Ehe-/Partnerschaftsende automatisch übernehmen. Ein vorhandenes
  // manuelles Ende wird dabei niemals verändert.
  try {
    await synchronisierePartnerschaftsEndeBeiTod(
      currentDetailPersonId,
      getDatum("d-sterbedatum"),
      document.getElementById("d-sterbejahr").value.trim()
        ? Number(document.getElementById("d-sterbejahr").value.trim())
        : null
    );
  } catch (err) {
    debugLog(`⚠️ Partnerschaftsende durch Tod: ${err.message || err}`);
  }

  // Elternbeziehungen nach dem Personendatensatz erneut absichern. Wenn beide
  // Auswahlfelder leer sind, wird bewusst nichts an bestehenden Beziehungen
  // geändert; das Löschen von Eltern erfolgt ausschließlich über „Eltern speichern“.
  if (elternVaterId || elternMutterId) {
    try {
      await speichereElternZuKind(currentDetailPersonId, elternVaterId, elternMutterId);
    } catch (err) {
      msg.textContent = `Person gespeichert, Elternbeziehungen konnten nicht gesichert werden: ${err.message || err}`;
      debugLog(`❌ Elternbeziehungen beim allgemeinen Speichern: ${err.message || err}`);
      return;
    }
  }

  // Lokalen Cache sofort aktualisieren, damit die Partnerschaftsanzeige
  // unmittelbar nach dem Speichern den neuen Tod berücksichtigt.
  const cachePerson = personenCache.find((p) => p.id === currentDetailPersonId);
  if (cachePerson) {
    cachePerson.geburtsdatum = getDatum("d-geburtsdatum");
    cachePerson.geburtsjahr = cachePerson.geburtsdatum ? null : (
      document.getElementById("d-geburtsjahr").value.trim()
        ? Number(document.getElementById("d-geburtsjahr").value.trim())
        : null
    );
    cachePerson.sterbedatum = getDatum("d-sterbedatum");
    cachePerson.sterbejahr = cachePerson.sterbedatum ? null : (
      document.getElementById("d-sterbejahr").value.trim()
        ? Number(document.getElementById("d-sterbejahr").value.trim())
        : null
    );
  }

  // Nur das Trauungsbuch darf bei einer Ehe auf den Partner ergänzt werden.
  // Leere Partnerfelder werden gefüllt; bestehende Partner-Links bleiben unangetastet.
  try {
    await synchronisiereTrauungsbuchEhepartner(
      currentDetailPersonId,
      document.getElementById("d-trauungsbuch-link").value.trim()
    );
  } catch (err) {
    debugLog(`⚠️ Trauungsbuch-Synchronisierung: ${err.message || err}`);
  }

  msg.textContent = "Gespeichert ✓";
  aktualisiereLinkButton("d-taufbuch-open", document.getElementById("d-taufbuch-link").value.trim());
  aktualisiereLinkButton("d-trauungsbuch-open", document.getElementById("d-trauungsbuch-link").value.trim());
  aktualisiereLinkButton("d-sterbebuch-open", document.getElementById("d-sterbebuch-link").value.trim());
  await loadDetailFamilie(currentDetailPersonId);
});

document.getElementById("d-taufbuch-link")?.addEventListener("input", (e) => {
  aktualisiereLinkButton("d-taufbuch-open", e.target.value);
});
document.getElementById("d-trauungsbuch-link")?.addEventListener("input", (e) => {
  aktualisiereLinkButton("d-trauungsbuch-open", e.target.value);
});
document.getElementById("d-sterbebuch-link")?.addEventListener("input", (e) => {
  aktualisiereLinkButton("d-sterbebuch-open", e.target.value);
});

// v209: URL-Felder bei Bedarf mit dem Bleistift ein-/ausblenden.
document.querySelectorAll("[data-source-edit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.sourceEdit);
    if (!input) return;
    input.classList.toggle("source-url-hidden");
    input.classList.toggle("source-url-editing");
    if (!input.classList.contains("source-url-hidden")) input.focus();
  });
});


// ---- Fotos im Detail ----
async function loadDetailFotos(personId) {
  const container = document.getElementById("d-fotos-list");
  container.innerHTML = "";
  const [{ data: eigene, error: eigeneError }, { data: links, error: linksError }] = await Promise.all([
    sb.from("fotos").select("*").eq("personen_id", personId),
    sb.from("foto_personen").select("id, foto_id, sortierung").eq("personen_id", personId)
  ]);
  if (eigeneError) { debugLog(`❌ Fotos laden: ${eigeneError.message}`); return; }
  if (linksError) { debugLog(`❌ Foto-Verknüpfungen laden: ${linksError.message}`); return; }
  const ids = [...new Set([...(eigene || []).map(f => f.id), ...(links || []).map(x => x.foto_id)])];
  let verknuepfte = [];
  if (ids.length) {
    const { data, error } = await sb.from("fotos").select("*").in("id", ids);
    if (error) { debugLog(`❌ Verknüpfte Fotos laden: ${error.message}`); return; }
    verknuepfte = data || [];
  }
  const personLinkByPhotoId = new Map((links || []).map(link => [String(link.foto_id), link]));
  const sortValue = foto => {
    const link = personLinkByPhotoId.get(String(foto.id));
    if (link) return link.sortierung;
    return foto.personen_id === personId ? foto.sortierung : null;
  };
  const legacyOrderKey = `partezettel-foto-reihenfolge-${personId}`;
  let legacyOrder = [];
  try { legacyOrder = JSON.parse(localStorage.getItem(legacyOrderKey) || "[]"); } catch (_) {}
  const legacyIndex = new Map(legacyOrder.map((id, index) => [String(id), index]));
  const fotos = [...verknuepfte].sort((a, b) => {
    if (!!a.ist_schluesselfoto !== !!b.ist_schluesselfoto) return Number(!!b.ist_schluesselfoto) - Number(!!a.ist_schluesselfoto);
    const ai = legacyIndex.has(String(a.id)) ? legacyIndex.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
    const bi = legacyIndex.has(String(b.id)) ? legacyIndex.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
    return ai - bi
      || String(a.aufnahme_jahr || "9999").localeCompare(String(b.aufnahme_jahr || "9999"))
      || String(a.created_at || "").localeCompare(String(b.created_at || ""))
      || String(a.id).localeCompare(String(b.id));
  });
  const DETAIL_SORT_GAP = 100000;
  let detailFallbackIndex = 0;
  fotos.forEach(foto => {
    const value = sortValue(foto);
    const hasValue = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
    foto._personFallbackRank = foto.ist_schluesselfoto ? -DETAIL_SORT_GAP : detailFallbackIndex * DETAIL_SORT_GAP;
    foto._personSortRank = foto.ist_schluesselfoto ? -DETAIL_SORT_GAP : (hasValue ? Number(value) : foto._personFallbackRank);
    if (!foto.ist_schluesselfoto) detailFallbackIndex++;
  });
  fotos.sort((a, b) => {
    if (!!a.ist_schluesselfoto !== !!b.ist_schluesselfoto) return Number(!!b.ist_schluesselfoto) - Number(!!a.ist_schluesselfoto);
    return a._personSortRank - b._personSortRank || a._personFallbackRank - b._personFallbackRank || String(a.id).localeCompare(String(b.id));
  });
  // Kleine, reine Schlüsselfoto-Vorschau neben den Namensfeldern aktualisieren.
  const keyPreview = document.getElementById("d-schluesselfoto-vorschau");
  if (keyPreview) {
    keyPreview.innerHTML = '<span class="person-keyphoto-placeholder" aria-hidden="true">👤</span>';
    const keyFoto = fotos.find(f => f.ist_schluesselfoto && f.dateipfad);
    if (keyFoto) {
      const keyUrl = await ladeFotoBild(keyFoto.dateipfad);
      if (keyUrl) keyPreview.innerHTML = `<img src="${keyUrl}" alt="Schlüsselfoto">`;
    }
  }
  // Alle Fotos beim Öffnen der Personendetails laden, damit auch normale
  // Fotos (nicht nur Schlüsselfotos und Gruppenfotos) als Vorschaubilder erscheinen.
  const direktLadenPfade = fotos.filter(f => f.dateipfad).map(f => f.dateipfad);
  const fotoUrls = await ladeFotoBilder(direktLadenPfade);
  for (const foto of fotos) {
    const fotoUrl = foto.dateipfad ? (fotoUrls.get(foto.dateipfad) || "") : "";
    const { data: markierungen } = await sb.from("foto_personen")
      .select("id, personen_id, nummer, position_x, position_y, position_format")
      .eq("foto_id", foto.id)
      .order("nummer", { ascending: true });
    // Nur ausdrücklich als Gruppenfoto gespeicherte Datensätze als Gruppenfoto
    // darstellen. Eine vorhandene Personen-Verknüpfung allein darf normale Fotos
    // nicht in die Gruppenfoto-Ansicht umleiten.
    const istGruppenfoto = !!foto.gruppenfoto;
    const div = document.createElement("div");
    div.className = `detail-media-item${istGruppenfoto ? " detail-group-photo-item" : ""}`;

    if (istGruppenfoto) {
      div.innerHTML = `
        <div class="detail-group-photo-wrap">
          <img src="${fotoUrl}" alt="Gruppenfoto">
          <div class="detail-group-photo-markers"></div>
        </div>
        <div class="detail-group-photo-info">
          <div class="detail-group-photo-title-date">
            <div class="detail-group-photo-title-row">
              <div class="detail-group-photo-title">${foto.titel ? escapeHtml(String(foto.titel)) : ""}</div>
              <button class="btn btn--ghost detail-group-photo-metadata-edit" type="button" title="Bezeichnung und Datum bearbeiten" aria-label="Bezeichnung und Datum bearbeiten">✏️</button>
            </div>
            ${foto.aufnahme_jahr ? `<div class="detail-group-photo-year">${escapeHtml(foto.aufnahme_tag && foto.aufnahme_monat ? `${String(foto.aufnahme_tag).padStart(2, "0")}. ${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][Number(foto.aufnahme_monat) - 1]} ${foto.aufnahme_jahr}` : foto.aufnahme_monat ? `${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][Number(foto.aufnahme_monat) - 1]} ${foto.aufnahme_jahr}` : String(foto.aufnahme_jahr))}</div>` : ""}
          </div>
          <span class="beziehung-text">${foto.ist_schluesselfoto ? "⭐ Schlüsselfoto · Gruppenfoto" : "Gruppenfoto"}</span>
          <div class="detail-group-photo-legend"></div>
          <div class="detail-group-photo-actions">
            <button class="foto-personen-open-btn btn btn--secondary" type="button">👥 Personen</button>
            <button class="key-photo-btn" type="button" title="Als Schlüsselfoto festlegen" ${foto.ist_schluesselfoto ? "disabled" : ""}>⭐ Schlüssel</button>
            <button class="del-btn" title="Verknüpfung entfernen">🗑️</button>
          </div>
        </div>`;
      const wrap = div.querySelector(".detail-group-photo-wrap");
      div.querySelector(".detail-group-photo-metadata-edit").addEventListener("click", (event) => {
        event.stopPropagation();
        void openFotoPersonenModal(foto);
      });
      const markerEl = div.querySelector(".detail-group-photo-markers");
      const legendEl = div.querySelector(".detail-group-photo-legend");
      (markierungen || []).forEach(row => {
        const marker = document.createElement("span");
        marker.className = "detail-group-photo-marker";
        marker.textContent = row.nummer;
        marker.style.left = `${Number(row.position_x ?? 50)}%`;
        marker.style.top = `${Number(row.position_y ?? 50)}%`;
        marker.title = `${row.nummer}: ${fotoPersonName(row.personen_id)}`;
        markerEl.appendChild(marker);
        const entry = document.createElement("span");
        entry.className = "detail-group-photo-legend-item";
        const name = fotoPersonName(row.personen_id);
        const alter = gruppenfotoPersonenAlter(row.personen_id, foto);
        entry.textContent = `#${row.nummer} ${name}${alter ? ` · ${alter}` : ""}`;
        legendEl.appendChild(entry);
      });
      const gruppenfotoOeffnen = async (event) => {
        event.stopPropagation();
        let url = fotoUrl || fotoBildMemoryCache.get(foto.dateipfad) || null;
        if (!url) url = await ladeFotoBild(foto.dateipfad);
        if (!url) {
          document.getElementById("d-foto-message").textContent = "Foto konnte nicht geladen werden.";
          return;
        }
        const img = wrap.querySelector("img");
        if (img && !img.src) img.src = url;
        openGruppenfotoViewer(url, markierungen || [], foto);
      };
      wrap.addEventListener("click", gruppenfotoOeffnen);
    } else {
      div.innerHTML = `<img src="${fotoUrl}" alt="Foto"><span class="beziehung-text">${foto.ist_schluesselfoto ? "⭐ Schlüsselfoto" : "Foto"}</span><button class="key-photo-btn" type="button" title="Als Schlüsselfoto festlegen" ${foto.ist_schluesselfoto ? "disabled" : ""}>⭐ Schlüssel</button><button class="del-btn" title="Löschen">🗑️</button>`;
      const fotoImg = div.querySelector("img");
      if (fotoUrl) fotoImg.dataset.fotoLoaded = "true";
      const openFoto = async (event) => {
        if (event) event.stopPropagation();
        const msg = document.getElementById("d-foto-message");
        // Nur eine URL verwenden, wenn das Bild tatsächlich erfolgreich geladen wurde.
        let url = fotoImg.dataset.fotoLoaded === "true" ? (fotoBildMemoryCache.get(foto.dateipfad) || fotoImg.src) : null;
        if (!url || url === window.location.href) {
          fotoImg.dataset.fotoLoaded = "false";
          msg.textContent = "Foto wird geladen …";
          try { url = await ladeFotoBild(foto.dateipfad); }
          catch (err) { debugLog(`❌ Foto laden: ${err.message || err}`); url = null; }
        }
        if (!url) {
          msg.textContent = "Foto konnte nicht geladen werden. Bitte Verbindung prüfen und erneut tippen.";
          return;
        }
        fotoImg.src = url;
        fotoImg.dataset.fotoLoaded = "true";
        fotoImg.onerror = () => {
          fotoImg.dataset.fotoLoaded = "false";
          msg.textContent = "Foto konnte nicht angezeigt werden. Bitte erneut tippen.";
        };
        const viewer = document.getElementById("detail-photo-viewer");
        const viewerImg = document.getElementById("detail-photo-viewer-img");
        if (!viewer || !viewerImg) {
          msg.textContent = "Foto geladen, aber die Fotoansicht ist nicht verfügbar.";
          return;
        }
        viewerImg.src = url;
        viewer.hidden = false;
        msg.textContent = "";
      };
      // Auf Touchgeräten ist click zuverlässig; pointerup zusätzlich kann doppelt auslösen.
      fotoImg.addEventListener("click", openFoto);
      // Auch die gesamte Fotokarte ist antippbar, nicht nur das kleine Vorschaubild.
      div.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        openFoto(event);
      });
    }
    div.querySelector(".foto-personen-open-btn")?.addEventListener("click", (event) => { event.stopPropagation(); openFotoPersonenModal(foto); });
    div.querySelector(".key-photo-btn").addEventListener("click", async () => {
      const msg = document.getElementById("d-foto-message");
      msg.textContent = "Schlüsselfoto wird gesetzt …";
      const { error: resetError } = await sb.from("fotos").update({ ist_schluesselfoto: false }).eq("personen_id", personId);
      if (resetError) { msg.textContent = `Fehler: ${resetError.message}`; return; }
      const { error: keyError } = await sb.from("fotos").update({ ist_schluesselfoto: true }).eq("id", foto.id);
      if (keyError) { msg.textContent = `Fehler: ${keyError.message}`; return; }
      msg.textContent = "Schlüsselfoto gesetzt ✓";
      await loadDetailFotos(personId);
      invalidierePersonenCache();
      await loadPersonen(true);
    });
    div.querySelector(".del-btn").addEventListener("click", async () => {
      if (!confirm(istGruppenfoto ? "Diese Person vom Gruppenfoto entfernen?" : "Foto bzw. Verknüpfung wirklich entfernen?")) return;
      const { data: links } = await sb.from("foto_personen").select("id, personen_id").eq("foto_id", foto.id);
      if ((links || []).length) {
        await sb.from("foto_personen").delete().eq("foto_id", foto.id).eq("personen_id", personId);
        const verbleibend = (links || []).filter(x => x.personen_id !== personId);
        const istEigentuemer = foto.personen_id === personId;
        if (!verbleibend.length && istEigentuemer) {
          if (rolleIstEigentuemer()) {
            await sb.storage.from(BUCKET_FOTOS).remove([foto.dateipfad]); await loescheFotoAusBrowserCache(foto.dateipfad);
            await sb.from("fotos").delete().eq("id", foto.id);
          } else {
            alert("Die Verknüpfung wurde entfernt. Das Foto selbst bleibt im Archiv, Dateien löscht nur der Eigentümer.");
          }
        }
      } else {
        if (!darfLoeschen("Fotos löschen")) return;
        await sb.storage.from(BUCKET_FOTOS).remove([foto.dateipfad]); await loescheFotoAusBrowserCache(foto.dateipfad);
        await sb.from("fotos").delete().eq("id", foto.id);
      }
      await loadDetailFotos(personId);
      invalidierePersonenCache();
      loadPersonen(true);
    });
    container.appendChild(div);
  }
}


async function uploadDetailFoto(file) {
  const msg = document.getElementById("d-foto-message");
  msg.textContent = "Foto anpassen …";
  const edited = await openPhotoEditor(file);
  if (!edited) { msg.textContent = "Foto nicht übernommen."; return; }
  const optimiert = await blobZuJPEGUnter200KB(edited);
  if (!optimiert) { msg.textContent = "Foto konnte nicht optimiert werden."; return; }
  msg.textContent = `Lade hoch … (${Math.round(optimiert.size / 1024)} KB)`;
  const path = `${currentDetailPersonId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const { error: uploadError } = await sb.storage.from(BUCKET_FOTOS).upload(path, optimiert, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploadError) { msg.textContent = `Fehler: ${uploadError.message}`; return; }
  const { error: insertError } = await sb.from("fotos").insert({ personen_id: currentDetailPersonId, dateipfad: path, ist_schluesselfoto: false });
  msg.textContent = insertError ? `Fehler: ${insertError.message}` : "Foto hinzugefügt ✓";
  loadDetailFotos(currentDetailPersonId);
}


function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","\'":"&#39;"}[ch]));
}

// ---- Zentrale Fotoübersicht ----
const gruppenfotoInput = document.getElementById("gruppenfoto-input");
const gruppenfotoTitel = document.getElementById("gruppenfoto-titel");
const gruppenfotoTag = document.getElementById("gruppenfoto-tag");
const gruppenfotoMonat = document.getElementById("gruppenfoto-monat");
const gruppenfotoJahr = document.getElementById("gruppenfoto-jahr");
const gruppenfotoBearbeitenTag = document.getElementById("gruppenfoto-bearbeiten-tag");
const gruppenfotoBearbeitenMonat = document.getElementById("gruppenfoto-bearbeiten-monat");
const gruppenfotoBearbeitenJahr = document.getElementById("gruppenfoto-bearbeiten-jahr");

function fuelleGruppenfotoDatumsfelder() {
  const monate = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const fuelle = (el, typ) => {
    if (!el || el.tagName !== "SELECT" || el.dataset.optionsReady === "true") return;
    const aktuell = el.value;
    el.innerHTML = "";
    const leer = document.createElement("option");
    leer.value = "";
    leer.textContent = typ === "tag" ? "Tag" : typ === "monat" ? "Monat" : "Jahr";
    el.appendChild(leer);
    if (typ === "tag") {
      for (let n = 1; n <= 31; n++) { const o = document.createElement("option"); o.value = String(n); o.textContent = String(n); el.appendChild(o); }
    } else if (typ === "monat") {
      monate.forEach((name, i) => { const o = document.createElement("option"); o.value = String(i + 1); o.textContent = name; el.appendChild(o); });
    } else {
      for (let n = 2100; n >= 1500; n--) { const o = document.createElement("option"); o.value = String(n); o.textContent = String(n); el.appendChild(o); }
    }
    el.dataset.optionsReady = "true";
    if (aktuell) el.value = aktuell;
  };
  [[gruppenfotoTag, "tag"], [gruppenfotoMonat, "monat"], [gruppenfotoJahr, "jahr"],
   [gruppenfotoBearbeitenTag, "tag"], [gruppenfotoBearbeitenMonat, "monat"], [gruppenfotoBearbeitenJahr, "jahr"]]
    .forEach(([el, typ]) => fuelle(el, typ));
}
fuelleGruppenfotoDatumsfelder();
const gruppenfotoPreview = document.getElementById("gruppenfoto-preview");
const gruppenfotoStatus = document.getElementById("gruppenfoto-status");
const gruppenfotoPersonenListe = document.getElementById("gruppenfoto-personen-liste");
const gruppenfotoPersonenSuche = document.getElementById("gruppenfoto-personen-suche");
const gruppenfotoPersonenAnzahl = document.getElementById("gruppenfoto-personen-anzahl");
const gruppenfotoSpeichern = document.getElementById("gruppenfoto-speichern");
const gruppenfotoMessage = document.getElementById("gruppenfoto-message");
const gruppenfotoListe = document.getElementById("gruppenfoto-liste");
const gruppenfotoLeer = document.getElementById("gruppenfoto-leer");
let gruppenfotoDatei = null;

function fotoPersonJahrDatumAnzeige(person) {
  if (!person) return "";
  const datum = (wert, jahr) => {
    if (wert) {
      const m = String(wert).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[3]}.${m[2]}.${m[1]}`;
      return String(wert);
    }
    return jahr ? String(jahr) : "";
  };
  const geb = datum(person.geburtsdatum, person.geburtsjahr);
  const gest = datum(person.sterbedatum, person.sterbejahr);
  const teile = [];
  if (geb) teile.push(`geb. ${geb}`);
  if (gest) teile.push(`gest. ${gest}`);
  return teile.join(" · ");
}

function fotoPersonAnzeige(person) {
  if (!person) return { name: "Unbekannte Person", daten: "" };
  const name = [person.vorname, person.nachname].filter(Boolean).join(" ") || "Unbekannte Person";
  const ledigenname = String(person.Ledigenname || person.ledigenname || person.geburtsname || "").trim();
  const nameMitLedigenname = ledigenname
    ? `${name} (geb. ${ledigenname})` : name;
  return { name: nameMitLedigenname, daten: fotoPersonJahrDatumAnzeige(person) };
}

// Auswahl bleibt beim Ändern des Suchbegriffs erhalten, auch wenn markierte
// Personen gerade nicht in der gefilterten Ergebnisliste sichtbar sind.
const gruppenfotoAuswahlIds = new Set();

function gruppenfotoAusgewaehltePersonen() {
  return [...gruppenfotoAuswahlIds];
}

function aktualisiereGruppenfotoPersonenAnzahl() {
  if (gruppenfotoPersonenAnzahl) {
    const n = gruppenfotoAuswahlIds.size;
    gruppenfotoPersonenAnzahl.textContent = `${n} ${n === 1 ? "Person ausgewählt" : "Personen ausgewählt"}`;
  }
}

function fuelleGruppenfotoPersonen() {
  if (!gruppenfotoPersonenListe) return;
  // Checkboxen vor dem Neuaufbau in den dauerhaften Auswahlzustand übernehmen.
  gruppenfotoPersonenListe.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.checked) gruppenfotoAuswahlIds.add(cb.value);
    else gruppenfotoAuswahlIds.delete(cb.value);
  });
  const bisher = gruppenfotoAuswahlIds;
  const suchtext = gruppenfotoPersonenSuche?.value || "";
  const personen = (personenCache || []).slice().sort(PersonSuche.sort);
  const gefiltert = personen.filter(p => personenSuchTreffer(p, suchtext));
  gruppenfotoPersonenListe.innerHTML = gefiltert.map(p => {
    const anzeige = fotoPersonAnzeige(p);
    return `
    <label class="gruppenfoto-person-option">
      <input type="checkbox" value="${p.id}" ${bisher.has(p.id) ? "checked" : ""}>
      <span class="gruppenfoto-person-option__text"><strong>${escapeHtml(anzeige.name)}</strong>${anzeige.daten ? `<small>${escapeHtml(anzeige.daten)}</small>` : ""}</span>
    </label>`;
  }).join("");
  gruppenfotoPersonenListe.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener("change", () => {
    if (cb.checked) gruppenfotoAuswahlIds.add(cb.value);
    else gruppenfotoAuswahlIds.delete(cb.value);
    aktualisiereGruppenfotoPersonenAnzahl();
  }));
  aktualisiereGruppenfotoPersonenAnzahl();
}

gruppenfotoPersonenSuche?.addEventListener("input", fuelleGruppenfotoPersonen);
gruppenfotoPersonenSuche?.addEventListener("search", fuelleGruppenfotoPersonen);

async function ladeGruppenfotoListe() {
  if (!gruppenfotoListe) return;
  const { data, error } = await sb.from("fotos").select("*").eq("gruppenfoto", true).order("id", { ascending: false });
  if (error) { if (gruppenfotoMessage) gruppenfotoMessage.textContent = `Fehler: ${error.message}`; return; }
  const fotos = data || [];
  // Beim ersten App-Laden auch die Gruppenbilder selbst laden. Die gemeinsame
  // Foto-Cache-Funktion verhindert erneute Downloads bei weiteren Ansichten.
  const fotoUrls = await ladeFotoBilder(fotos.map(f => f.dateipfad));
  gruppenfotoListe.innerHTML = "";
  gruppenfotoLeer.hidden = !!fotos.length;
  for (const foto of fotos) {
    const div = document.createElement("div");
    div.className = "detail-media-item gruppenfoto-uebersicht-item";
    const url = fotoUrls.get(foto.dateipfad) || "";
    const titel = String(foto.titel || "").trim();
    const datum = [foto.aufnahme_tag, foto.aufnahme_monat, foto.aufnahme_jahr].filter(v => v !== null && v !== undefined && v !== "").map((v, i) => String(v).padStart(i < 2 ? 2 : 4, "0"));
    const datumText = foto.aufnahme_jahr ? (foto.aufnahme_tag && foto.aufnahme_monat ? `${String(foto.aufnahme_tag).padStart(2,"0")}.${String(foto.aufnahme_monat).padStart(2,"0")}.${foto.aufnahme_jahr}` : foto.aufnahme_monat ? `${String(foto.aufnahme_monat).padStart(2,"0")}.${foto.aufnahme_jahr}` : String(foto.aufnahme_jahr)) : "";
    div.innerHTML = `<img class="gruppenfoto-miniatur" alt="Gruppenfoto" loading="eager"><div class="gruppenfoto-uebersicht-beschriftung"><span class="beziehung-text">📷 ${escapeHtml(titel || "Gruppenfoto")}</span>${datumText ? `<small class="gruppenfoto-datum">${escapeHtml(datumText)}</small>` : ""}</div><div class="gruppenfoto-uebersicht-aktionen"><button type="button" class="btn btn--secondary gruppenfoto-personen-btn">Foto öffnen / Personen</button><button type="button" class="btn btn--ghost gruppenfoto-metadaten-edit-btn" aria-label="Titel und Aufnahmedatum bearbeiten" title="Titel und Datum bearbeiten">✏️</button></div>`;
    const img = div.querySelector(".gruppenfoto-miniatur");
    if (url) img.src = url;
    div.querySelector(".gruppenfoto-personen-btn").addEventListener("click", () => openFotoPersonenModal(foto));
    div.querySelector(".gruppenfoto-metadaten-edit-btn").addEventListener("click", () => openFotoPersonenModal(foto));
    gruppenfotoListe.appendChild(div);
  }
}

gruppenfotoInput?.addEventListener("change", () => {
  const file = gruppenfotoInput.files?.[0];
  gruppenfotoDatei = file || null;
  if (!file) { gruppenfotoPreview.hidden = true; gruppenfotoStatus.textContent = "Kein Foto ausgewählt"; return; }
  gruppenfotoPreview.src = URL.createObjectURL(file);
  gruppenfotoPreview.hidden = false;
  gruppenfotoStatus.textContent = `${file.name} ausgewählt ✓`;
});

gruppenfotoSpeichern?.addEventListener("click", async () => {
  gruppenfotoMessage.textContent = "";
  if (!gruppenfotoDatei) { gruppenfotoMessage.textContent = "Bitte zuerst ein Foto auswählen."; return; }
  const ids = gruppenfotoAusgewaehltePersonen();
  if (!ids.length) { gruppenfotoMessage.textContent = "Bitte mindestens eine Person auswählen."; return; }
  gruppenfotoSpeichern.disabled = true;
  try {
    gruppenfotoMessage.textContent = "Foto anpassen …";
    const edited = await openPhotoEditor(gruppenfotoDatei);
    if (!edited) { gruppenfotoMessage.textContent = "Foto nicht übernommen."; return; }
    const optimiert = await blobZuJPEGUnter200KB(edited);
    if (!optimiert) throw new Error("Foto konnte nicht optimiert werden.");
    const path = `gruppenfotos/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
    gruppenfotoMessage.textContent = `Lade hoch … (${Math.round(optimiert.size / 1024)} KB)`;
    const { error: uploadError } = await sb.storage.from(BUCKET_FOTOS).upload(path, optimiert, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
    const tag = gruppenfotoTag?.value ? Number(gruppenfotoTag.value) : null;
    const monat = gruppenfotoMonat?.value ? Number(gruppenfotoMonat.value) : null;
    const jahr = gruppenfotoJahr?.value ? Number(gruppenfotoJahr.value) : null;
    if (tag !== null && (!monat || !jahr)) throw new Error("Für einen Aufnahmetag bitte auch Monat und Jahr angeben.");
    if (monat !== null && !jahr) throw new Error("Für einen Aufnahmemonat bitte auch das Jahr angeben.");
    const { data: foto, error: insertError } = await sb.from("fotos").insert({
      personen_id: ids[0], dateipfad: path, ist_schluesselfoto: false, gruppenfoto: true,
      titel: gruppenfotoTitel?.value.trim() || null, aufnahme_tag: tag, aufnahme_monat: monat, aufnahme_jahr: jahr
    }).select().single();
    if (insertError) { await sb.storage.from(BUCKET_FOTOS).remove([path]); throw insertError; }
    const rows = ids.map((personen_id, index) => ({ foto_id: foto.id, personen_id, nummer: index + 1, position_x: 50, position_y: 50, position_format: "bild" }));
    const { error: linkError } = await sb.from("foto_personen").insert(rows);
    if (linkError) { await sb.storage.from(BUCKET_FOTOS).remove([path]); await sb.from("fotos").delete().eq("id", foto.id); throw linkError; }
    gruppenfotoMessage.textContent = "Foto gespeichert ✓";
    gruppenfotoDatei = null; gruppenfotoInput.value = ""; gruppenfotoPreview.hidden = true; gruppenfotoStatus.textContent = "Kein Foto ausgewählt";
    if (gruppenfotoTitel) gruppenfotoTitel.value = "";
    if (gruppenfotoTag) gruppenfotoTag.value = "";
    if (gruppenfotoMonat) gruppenfotoMonat.value = "";
    if (gruppenfotoJahr) gruppenfotoJahr.value = "";
    gruppenfotoAuswahlIds.clear();
    gruppenfotoPersonenListe.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    if (gruppenfotoPersonenSuche) gruppenfotoPersonenSuche.value = "";
    aktualisiereGruppenfotoPersonenAnzahl();
    await ladeGruppenfotoListe();
    await openFotoPersonenModal(foto);
  } catch (err) {
    gruppenfotoMessage.textContent = `Fehler: ${err.message || err}`;
  } finally { gruppenfotoSpeichern.disabled = false; }
});

// ---- Gruppenfoto: mehrere Personen + manuelle Nummern/Positionen ----
let fotoPersonenAktuell = null;
let fotoMarkierungen = [];
let fotoAktiveMarkierungId = null;

const fotoPersonenModal = document.getElementById("foto-personen-modal");
const fotoMarkierbild = document.getElementById("foto-markierbild");
const fotoMarkierbildWrap = document.getElementById("foto-markierbild-wrap");
const fotoMarkierflaeche = document.getElementById("foto-markierflaeche");
const fotoMarkierungenEl = document.getElementById("foto-markierungen");
const fotoPersonenListe = document.getElementById("foto-personen-liste");
const fotoPersonAuswahl = document.getElementById("foto-person-auswahl");
const fotoPersonSuche = document.getElementById("foto-person-suche");
const fotoPersonSuchergebnisse = document.getElementById("foto-person-suchergebnisse");
const fotoPersonenMessage = document.getElementById("foto-personen-message");
const gruppenfotoBearbeitenTitel = document.getElementById("gruppenfoto-bearbeiten-titel");



const gruppenfotoMetadatenSpeichern = document.getElementById("gruppenfoto-metadaten-speichern");
const gruppenfotoMetadatenMessage = document.getElementById("gruppenfoto-metadaten-message");

function fotoPersonName(id) {
  if (!id) return "unbekannte Person";
  const p = personenCache.find(x => x.id === id);
  if (!p) return "unbekannte Person";
  const n = PersonSuche.name(p);
  return n && n !== "(unbekannte Person)" ? n : "unbekannte Person";   // v341: mit „(geb. …)“
}

function gruppenfotoPersonenAlter(id, foto) {
  const p = personenCache.find(x => x.id === id);
  if (!p || (!p.geburtsdatum && !p.geburtsjahr) || !foto) return "";
  const birth = p.geburtsdatum ? new Date(`${p.geburtsdatum}T00:00:00`) : null;
  const year = Number(foto.aufnahme_jahr || 0);
  if (!year) return "";
  let years;
  let ungefaehr = false;
  if (birth && Number.isFinite(birth.getTime())) {
    const photoDate = foto.aufnahme_tag && foto.aufnahme_monat
      ? new Date(year, Number(foto.aufnahme_monat) - 1, Number(foto.aufnahme_tag))
      : new Date(year, 6, 1);
    years = photoDate.getFullYear() - birth.getFullYear();
    if (photoDate.getMonth() < birth.getMonth() ||
        (photoDate.getMonth() === birth.getMonth() && photoDate.getDate() < birth.getDate())) years--;
    if (!(foto.aufnahme_tag && foto.aufnahme_monat)) ungefaehr = true;
  } else {
    years = year - Number(p.geburtsjahr);
    ungefaehr = true;
  }
  if (!Number.isFinite(years) || years < 0 || years > 125) return "";
  return `${ungefaehr ? "ca. " : ""}${years}J`;
}

async function openFotoPersonenModal(foto) {
  if (!fotoPersonenModal) return;
  // Die Personenliste muss auch erreichbar sein, wenn der Nutzer direkt über
  // den Fotos-Menüpunkt kommt und die Personenansicht noch nicht geladen wurde.
  if (!Array.isArray(personenCache) || personenCache.length === 0) {
    try { await loadPersonen(); } catch (err) {
      fotoPersonenMessage.textContent = `Personen konnten nicht geladen werden: ${err.message || err}`;
    }
  }
  fotoPersonenAktuell = foto;
  fotoAktiveMarkierungId = null;
  fotoPersonenMessage.textContent = "Lade …";
  // Metadaten bei jedem Öffnen aus dem aktuellen Datensatz befüllen.
  if (gruppenfotoBearbeitenTitel) gruppenfotoBearbeitenTitel.value = foto.titel || "";
  if (gruppenfotoBearbeitenTag) gruppenfotoBearbeitenTag.value = foto.aufnahme_tag ?? "";
  if (gruppenfotoBearbeitenMonat) gruppenfotoBearbeitenMonat.value = foto.aufnahme_monat ?? "";
  if (gruppenfotoBearbeitenJahr) gruppenfotoBearbeitenJahr.value = foto.aufnahme_jahr ?? "";
  if (gruppenfotoMetadatenMessage) gruppenfotoMetadatenMessage.textContent = "";
  const { data: rows, error } = await sb.from("foto_personen").select("id, foto_id, personen_id, nummer, position_x, position_y, position_format").eq("foto_id", foto.id).order("nummer", { ascending: true });
  if (error) { fotoPersonenMessage.textContent = `Fehler: ${error.message}`; return; }
  fotoMarkierungen = rows || [];
  const fotoUrl = await ladeFotoBild(foto.dateipfad);
  fotoMarkierbild.src = fotoUrl || "";
  // Für die nachträgliche Zuordnung alle Personen anzeigen. Bereits zugeordnete
  // Personen bleiben sichtbar und werden mit ihrer vorhandenen Nummer markiert.
  // So ist auch bei einem großen Gruppenfoto sofort erkennbar, wer schon zugeordnet ist.
  fotoPersonAuswahl._alleVerfuegbarenPersonen = (personenCache || [])
    .slice()
    .sort((a,b) => `${a.nachname||""} ${a.vorname||""}`.localeCompare(`${b.nachname||""} ${b.vorname||""}`, "de"));
  if (fotoPersonSuche) fotoPersonSuche.value = "";
  renderFotoPersonAuswahl();
  fotoPersonAuswahl.disabled = !(fotoPersonAuswahl._alleVerfuegbarenPersonen || []).some(p =>
    !fotoMarkierungen.some(r => r.personen_id === p.id)
  );
  fotoPersonenModal.hidden = false;
  const renderAfterLoad = () => {
    // Bestehende gespeicherte Bildkoordinaten beim Öffnen niemals automatisch
    // umrechnen oder in Supabase überschreiben. Erstellen, Bearbeiten und
    // Anzeigen verwenden dieselben position_x-/position_y-Prozentwerte.
    renderFotoMarkierungen();
    fotoPersonenMessage.textContent = "";
  };
  if (fotoMarkierbild.complete && fotoMarkierbild.naturalWidth) renderAfterLoad();
  else fotoMarkierbild.addEventListener("load", renderAfterLoad, { once: true });
}


gruppenfotoMetadatenSpeichern?.addEventListener("click", async () => {
  if (!fotoPersonenAktuell?.id) {
    if (gruppenfotoMetadatenMessage) gruppenfotoMetadatenMessage.textContent = "Kein Gruppenfoto ausgewählt.";
    return;
  }
  const tag = gruppenfotoBearbeitenTag?.value ? Number(gruppenfotoBearbeitenTag.value) : null;
  const monat = gruppenfotoBearbeitenMonat?.value ? Number(gruppenfotoBearbeitenMonat.value) : null;
  const jahr = gruppenfotoBearbeitenJahr?.value ? Number(gruppenfotoBearbeitenJahr.value) : null;
  if (tag !== null && (!monat || !jahr)) {
    gruppenfotoMetadatenMessage.textContent = "Für einen Tag bitte auch Monat und Jahr angeben.";
    return;
  }
  if (monat !== null && !jahr) {
    gruppenfotoMetadatenMessage.textContent = "Für einen Monat bitte auch das Jahr angeben.";
    return;
  }
  gruppenfotoMetadatenSpeichern.disabled = true;
  gruppenfotoMetadatenMessage.textContent = "Speichere …";
  try {
    const { data, error } = await sb.from("fotos").update({
      titel: gruppenfotoBearbeitenTitel?.value.trim() || null,
      aufnahme_tag: tag,
      aufnahme_monat: monat,
      aufnahme_jahr: jahr
    }).eq("id", fotoPersonenAktuell.id).select().single();
    if (error) throw error;
    fotoPersonenAktuell = data;
    gruppenfotoMetadatenMessage.textContent = "Bezeichnung und Datum gespeichert ✓";
    await ladeGruppenfotoListe();
  } catch (err) {
    gruppenfotoMetadatenMessage.textContent = `Speichern fehlgeschlagen: ${err.message || err}`;
  } finally {
    gruppenfotoMetadatenSpeichern.disabled = false;
  }
});


function renderFotoPersonAuswahl() {
  if (!fotoPersonAuswahl || !fotoPersonSuchergebnisse) return;
  const alle = fotoPersonAuswahl._alleVerfuegbarenPersonen || [];
  const suchtext = fotoPersonSuche?.value || "";
  const suchTokens = PersonSuche.zerlege(suchtext);
  const alleTreffer = suchTokens.length ? alle.filter(p => PersonSuche.trifft(p, suchTokens, fotoPersonAnzeige(p).daten || "")).sort(PersonSuche.sort) : [];
  const gefiltert = alleTreffer.slice(0, 50);
  const belegteNummern = new Map(
    fotoMarkierungen.filter(r => r.personen_id).map(r => [r.personen_id, r.nummer])
  );
  fotoPersonSuchergebnisse.innerHTML = !suchtext
    ? '<p class="foto-person-suche-hinweis">Name eingeben; passende Personen erscheinen hier.</p>'
    : gefiltert.length ? gefiltert.map(p => {
        const anzeige = fotoPersonAnzeige(p);
        const nr = belegteNummern.get(p.id);
        return `<button type="button" class="foto-person-suchergebnis" data-person-id="${escapeHtml(String(p.id))}" ${nr ? "disabled" : ""} role="option">
          <strong>${escapeHtml(anzeige.name)}</strong>
          ${anzeige.daten ? `<small>${escapeHtml(anzeige.daten)}</small>` : ""}
          ${nr ? `<small>Bereits auf dem Foto (Nr. ${nr})</small>` : `<span>＋ Hinzufügen</span>`}
        </button>`;
      }).join("") + (alleTreffer.length > gefiltert.length ? `<p class="foto-person-suche-hinweis">${alleTreffer.length} Treffer – die ersten ${gefiltert.length} werden angezeigt. Bitte genauer suchen.</p>` : "")
    : '<p class="foto-person-suche-hinweis">Keine passende Person gefunden.</p>';
}

fotoPersonSuche?.addEventListener("input", renderFotoPersonAuswahl);
fotoPersonSuche?.addEventListener("search", renderFotoPersonAuswahl);
fotoPersonSuchergebnisse?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-person-id]");
  if (!button || button.disabled || !fotoPersonenAktuell) return;
  const personenId = button.dataset.personId;
  if (fotoMarkierungen.some(r => r.personen_id === personenId)) return;
  button.disabled = true;
  fotoPersonenMessage.textContent = "Person wird hinzugefügt …";
  const maxNr = Math.max(0, ...fotoMarkierungen.map(r => Number(r.nummer) || 0));
  const { data, error } = await sb.from("foto_personen").insert({
    foto_id: fotoPersonenAktuell.id, personen_id: personenId, nummer: maxNr + 1,
    position_x: 50, position_y: 50, position_format: "bild"
  }).select().single();
  if (error) {
    fotoPersonenMessage.textContent = `Fehler: ${error.message}`;
    button.disabled = false;
    return;
  }
  fotoMarkierungen.push(data);
  fotoPersonSuche.value = "";
  renderFotoPersonAuswahl();
  renderFotoMarkierungen();
  fotoPersonenMessage.textContent = "Person hinzugefügt ✓";
});

async function migriereAlteFotoPositionen() {
  if (!fotoMarkierbildWrap || !fotoMarkierbild.naturalWidth) return;
  const legacy = fotoMarkierungen.filter(r => (r.position_format || "flaeche") !== "bild");
  if (!legacy.length) return;

  const bildRect = fotoMarkierbild.getBoundingClientRect();
  const flaechenRect = fotoMarkierflaeche.getBoundingClientRect();
  if (!bildRect.width || !bildRect.height || !flaechenRect.width || !flaechenRect.height) return;

  for (const row of legacy) {
    const oldXpx = flaechenRect.left + (Number(row.position_x ?? 50) / 100) * flaechenRect.width;
    const oldYpx = flaechenRect.top + (Number(row.position_y ?? 50) / 100) * flaechenRect.height;
    const x = Math.max(0, Math.min(100, ((oldXpx - bildRect.left) / bildRect.width) * 100));
    const y = Math.max(0, Math.min(100, ((oldYpx - bildRect.top) / bildRect.height) * 100));
    const { error } = await sb.from("foto_personen").update({ position_x: x, position_y: y, position_format: "bild" }).eq("id", row.id);
    if (!error) { row.position_x = x; row.position_y = y; row.position_format = "bild"; }
  }
}

function renderFotoMarkierungen() {
  fotoMarkierungenEl.innerHTML = "";
  fotoPersonenListe.innerHTML = "";

  // Markierungsfläche exakt auf das sichtbare Bild legen, nicht auf schwarze Seitenränder.
  if (fotoMarkierbild?.naturalWidth && fotoMarkierbildWrap && fotoMarkierungenEl) {
    const wrapRect = fotoMarkierbildWrap.getBoundingClientRect();
    const imageRect = fotoMarkierbild.getBoundingClientRect();
    if (wrapRect.width && wrapRect.height && imageRect.width && imageRect.height) {
      Object.assign(fotoMarkierungenEl.style, {
        position: "absolute",
        left: `${imageRect.left - wrapRect.left}px`,
        top: `${imageRect.top - wrapRect.top}px`,
        width: `${imageRect.width}px`,
        height: `${imageRect.height}px`,
        right: "auto",
        bottom: "auto"
      });
    }
  }
  const sorted = [...fotoMarkierungen].sort((a,b) => Number(a.nummer)-Number(b.nummer));

  for (const row of sorted) {
    const m = document.createElement("div");
    m.className = "foto-markierung" + (row.id === fotoAktiveMarkierungId ? " is-active" : "");
    m.textContent = row.nummer;
    m.style.left = `${Number(row.position_x ?? 50)}%`;
    m.style.top = `${Number(row.position_y ?? 50)}%`;
    m.title = `${row.nummer}: ${fotoPersonName(row.personen_id)}`;
    // Nummern können direkt mit Finger/Maus fein positioniert werden.
    // Pointer-Capture verhindert, dass die Markierung beim Ziehen verloren geht.
    let markerDragging = false;
    let markerMoved = false;
    let markerStartX = 0;
    let markerStartY = 0;
    m.style.touchAction = "none";
    m.style.cursor = "grab";
    m.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      markerDragging = true;
      markerMoved = false;
      markerStartX = e.clientX;
      markerStartY = e.clientY;
      m.style.cursor = "grabbing";
      m.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    m.addEventListener("pointermove", (e) => {
      if (!markerDragging || !fotoMarkierbild.naturalWidth) return;
      e.stopPropagation();
      const dx = e.clientX - markerStartX;
      const dy = e.clientY - markerStartY;
      if (Math.abs(dx) + Math.abs(dy) > 2) markerMoved = true;
      const rect = fotoMarkierbild.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      m.style.left = `${x}%`;
      m.style.top = `${y}%`;
      row._pendingPosition = { x, y };
    });
    m.addEventListener("pointerup", async (e) => {
      if (!markerDragging) return;
      e.stopPropagation();
      markerDragging = false;
      m.style.cursor = "grab";
      if (row._pendingPosition && markerMoved) {
        const { x, y } = row._pendingPosition;
        const { error } = await sb.from("foto_personen").update({
          position_x: x, position_y: y, position_format: "bild"
        }).eq("id", row.id);
        if (error) {
          fotoPersonenMessage.textContent = `Fehler beim Speichern der Position: ${error.message}`;
          renderFotoMarkierungen();
        } else {
          row.position_x = x;
          row.position_y = y;
          row.position_format = "bild";
          fotoPersonenMessage.textContent = `Position von Nr. ${row.nummer} gespeichert ✓`;
        }
        delete row._pendingPosition;
      } else {
        fotoAktiveMarkierungId = row.id;
        renderFotoMarkierungen();
      }
    });
    m.addEventListener("pointercancel", () => {
      markerDragging = false;
      delete row._pendingPosition;
      renderFotoMarkierungen();
    });
    fotoMarkierungenEl.appendChild(m);

    const line = document.createElement("div");
    line.className = "foto-person-zeile";

    const name = document.createElement("span");
    name.className = "foto-person-zeile__name";
    name.textContent = fotoPersonName(row.personen_id);

    const num = document.createElement("span");
    num.className = "foto-person-zeile__num";
    num.textContent = `#${row.nummer}`;

    const assignBtn = document.createElement("button");
    assignBtn.type = "button";
    assignBtn.className = "btn btn--secondary foto-person-aendern-btn";
    assignBtn.textContent = row.personen_id ? "Person ändern" : "Person zuordnen";

    const positionBtn = document.createElement("button");
    positionBtn.type = "button";
    positionBtn.className = "btn btn--ghost foto-position-btn";
    positionBtn.textContent = "Position";

    const numberBtn = document.createElement("button");
    numberBtn.type = "button";
    numberBtn.className = "btn btn--ghost foto-nummer-btn";
    numberBtn.textContent = "Nr.";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn--ghost foto-person-loeschen-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", `Nr. ${row.nummer} entfernen`);

    line.append(num, name, assignBtn, positionBtn, numberBtn, deleteBtn);

    assignBtn.addEventListener("click", () => {
      if (line.querySelector(".foto-person-change-wrap")) return;

      // Für eine bereits zugeordnete Person ist dies ein Tausch: nur Personen
      // dieses Fotos anbieten. Bei einer unbekannten Person muss dagegen das
      // gesamte Archiv auswählbar bleiben.
      const zugeordneteIds = new Set(
        fotoMarkierungen.map(x => x.personen_id).filter(Boolean)
      );
      const verfuegbar = (personenCache || [])
        .filter(p => !row.personen_id || zugeordneteIds.has(p.id))
        .slice()
        .sort((a,b) =>
          `${a.nachname || ""} ${a.vorname || ""}`.localeCompare(
            `${b.nachname || ""} ${b.vorname || ""}`, "de"
          )
        );

      const wrap = document.createElement("div");
      wrap.className = "foto-person-change-wrap";

      const search = document.createElement("input");
      search.type = "search";
      search.className = "foto-person-change-search";
      search.placeholder = "Name oder Geburtsjahr suchen …";
      search.autocomplete = "off";
      search.setAttribute("aria-label", "Person suchen");

      const select = document.createElement("select");
      select.className = "foto-person-change-select";
      select.setAttribute("aria-label", "Person für diesen Marker auswählen");

      const save = document.createElement("button");
      save.type = "button";
      save.className = "btn btn--primary";
      save.textContent = "Zuordnung speichern";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn--ghost";
      cancel.textContent = "Abbrechen";

      function fillSelect() {
        const q = treeNormalizeName(search.value);
        const filtered = q
          ? verfuegbar.filter(p => {
              const a = fotoPersonAnzeige(p);
              return treeNormalizeName(`${a.name} ${a.daten || ""}`).includes(q);
            })
          : verfuegbar;

        select.innerHTML = '<option value="">— Person auswählen —</option>' +
          filtered.map(p => {
            const anzeige = fotoPersonAnzeige(p);
            const belegung = fotoMarkierungen.find(x => x.id !== row.id && x.personen_id === p.id);
            const istAktuell = p.id === row.personen_id;
            const status = belegung && !istAktuell ? ` — tauschen mit Nr. ${belegung.nummer}` : "";
            return `<option value="${escapeHtml(p.id)}" ${istAktuell ? "selected" : ""}>${escapeHtml(anzeige.name)}${anzeige.daten ? ` — ${escapeHtml(anzeige.daten)}` : ""}${status}</option>`;
          }).join("");

        save.disabled = !select.value;
      }

      search.addEventListener("input", fillSelect);
      select.addEventListener("change", () => {
        save.disabled = !select.value;
      });

      wrap.append(search, select, save, cancel);

      // Die bestehende Zeile bleibt sichtbar; die Zuordnung wird darunter
      // geöffnet, damit die Bedienelemente auf iPhone/iPad eindeutig sind.
      line.classList.add("is-editing");
      line.appendChild(wrap);
      assignBtn.hidden = true;
      positionBtn.hidden = true;
      numberBtn.hidden = true;
      deleteBtn.hidden = true;

      fillSelect();
      search.focus();

      save.addEventListener("click", async () => {
        const neueId = select.value || null;
        if (!neueId) {
          fotoPersonenMessage.textContent = "Bitte zuerst eine Person auswählen.";
          return;
        }

        const belegung = fotoMarkierungen.find(x => x.id !== row.id && x.personen_id === neueId);
        save.disabled = true;
        save.textContent = belegung ? "Tausche …" : "Speichere …";

        if (belegung) {
          // Tausch ohne Löschen/Neuanlegen: beide vorhandenen Markierungen bleiben
          // mit ihren Nummern und Bildpositionen bestehen; nur die Personen-IDs wechseln.
          const alteId = row.personen_id || null;
          const freigabe = await sb.from("foto_personen").update({ personen_id: null }).eq("id", row.id);
          if (freigabe.error) {
            save.disabled = false; save.textContent = "Zuordnung speichern";
            fotoPersonenMessage.textContent = `Tausch nicht möglich: ${freigabe.error.message}`;
            return;
          }
          const zweite = await sb.from("foto_personen").update({ personen_id: alteId }).eq("id", belegung.id);
          if (zweite.error) {
            // Best effort rollback, damit die ursprüngliche Zuordnung erhalten bleibt.
            await sb.from("foto_personen").update({ personen_id: alteId }).eq("id", row.id);
            save.disabled = false; save.textContent = "Zuordnung speichern";
            fotoPersonenMessage.textContent = `Tausch fehlgeschlagen: ${zweite.error.message}`;
            return;
          }
          const erste = await sb.from("foto_personen").update({ personen_id: neueId }).eq("id", row.id);
          if (erste.error) {
            await sb.from("foto_personen").update({ personen_id: neueId }).eq("id", belegung.id);
            await sb.from("foto_personen").update({ personen_id: alteId }).eq("id", row.id);
            save.disabled = false; save.textContent = "Zuordnung speichern";
            fotoPersonenMessage.textContent = `Tausch fehlgeschlagen: ${erste.error.message}`;
            return;
          }
          row.personen_id = neueId;
          belegung.personen_id = alteId;
          fotoPersonenMessage.textContent = `Personen zwischen Nr. ${row.nummer} und Nr. ${belegung.nummer} getauscht ✓`;
        } else {
          const { error } = await sb.from("foto_personen").update({ personen_id: neueId }).eq("id", row.id);
          if (error) {
            save.disabled = false; save.textContent = "Zuordnung speichern";
            fotoPersonenMessage.textContent = `Fehler beim Speichern: ${error.message}`;
            return;
          }
          row.personen_id = neueId;
          fotoPersonenMessage.textContent = `Nr. ${row.nummer}: ${fotoPersonName(neueId)} gespeichert ✓`;
        }
        renderFotoMarkierungen();
      });

      cancel.addEventListener("click", () => {
        fotoPersonenMessage.textContent = "";
        renderFotoMarkierungen();
      });
    });

    positionBtn.addEventListener("click", () => {
      fotoAktiveMarkierungId = row.id;
      fotoPersonenMessage.textContent = `Tippe jetzt auf die Position von Nr. ${row.nummer}.`;
      renderFotoMarkierungen();
    });

    numberBtn.addEventListener("click", async () => {
      const wert = Number(prompt(`Neue Nummer für ${fotoPersonName(row.personen_id)}:`, row.nummer));
      if (!Number.isInteger(wert) || wert < 1) return;
      if (fotoMarkierungen.some(x => x.id !== row.id && Number(x.nummer) === wert)) {
        fotoPersonenMessage.textContent = `Nr. ${wert} ist bereits vergeben.`;
        return;
      }
      const { error } = await sb.from("foto_personen").update({ nummer: wert }).eq("id", row.id);
      if (!error) {
        row.nummer = wert;
        fotoAktiveMarkierungId = null;
        renderFotoMarkierungen();
      } else {
        fotoPersonenMessage.textContent = `Fehler beim Speichern der Nummer: ${error.message}`;
      }
    });

    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Nr. ${row.nummer} wirklich vom Foto entfernen?`)) return;
      const { error } = await sb.from("foto_personen").delete().eq("id", row.id);
      if (!error) {
        fotoMarkierungen = fotoMarkierungen.filter(x => x.id !== row.id);
        fotoAktiveMarkierungId = null;
        renderFotoMarkierungen();
      } else {
        fotoPersonenMessage.textContent = `Fehler beim Entfernen: ${error.message}`;
      }
    });

    fotoPersonenListe.appendChild(line);
  }
}

fotoMarkierbildWrap?.addEventListener("click", async (event) => {
  if (!fotoAktiveMarkierungId || !fotoMarkierbild.naturalWidth) return;

  const bildRect = fotoMarkierbild.getBoundingClientRect();
  if (!bildRect.width || !bildRect.height) return;

  // Position wird ausschließlich relativ zum tatsächlich dargestellten Bild
  // gespeichert. Dadurch bleibt sie bei jeder späteren Darstellung exakt gleich.
  const x = Math.max(0, Math.min(100, ((event.clientX - bildRect.left) / bildRect.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - bildRect.top) / bildRect.height) * 100));

  const row = fotoMarkierungen.find(r => r.id === fotoAktiveMarkierungId);
  if (!row) return;
  const { error } = await sb.from("foto_personen").update({ position_x: x, position_y: y, position_format: "bild" }).eq("id", row.id);
  if (!error) { row.position_x = x; row.position_y = y; row.position_format = "bild"; fotoAktiveMarkierungId = null; fotoPersonenMessage.textContent = "Position gespeichert ✓"; renderFotoMarkierungen(); }
  else fotoPersonenMessage.textContent = `Fehler: ${error.message}`;
});

document.getElementById("foto-person-hinzufuegen")?.addEventListener("click", async () => {
  const personenId = fotoPersonAuswahl.value;
  if (!personenId || !fotoPersonenAktuell) return;
  const maxNr = Math.max(0, ...fotoMarkierungen.map(r => Number(r.nummer) || 0));
  const { data, error } = await sb.from("foto_personen").insert({ foto_id: fotoPersonenAktuell.id, personen_id: personenId, nummer: maxNr + 1, position_x: 50, position_y: 50, position_format: "bild" }).select().single();
  if (error) { fotoPersonenMessage.textContent = `Fehler: ${error.message}`; return; }
  fotoMarkierungen.push(data); fotoPersonAuswahl.value = ""; renderFotoMarkierungen();
});

document.getElementById("foto-unbekannt-hinzufuegen")?.addEventListener("click", async () => {
  if (!fotoPersonenAktuell) return;
  const maxNr = Math.max(0, ...fotoMarkierungen.map(r => Number(r.nummer) || 0));
  const { data, error } = await sb.from("foto_personen").insert({ foto_id: fotoPersonenAktuell.id, personen_id: null, nummer: maxNr + 1, position_x: 50, position_y: 50, position_format: "bild" }).select().single();
  if (error) { fotoPersonenMessage.textContent = `Fehler: ${error.message}`; return; }
  fotoMarkierungen.push(data); renderFotoMarkierungen();
});

gruppenfotoMetadatenSpeichern?.addEventListener("click", async () => {
  if (!fotoPersonenAktuell) return;
  gruppenfotoMetadatenSpeichern.disabled = true;
  if (gruppenfotoMetadatenMessage) gruppenfotoMetadatenMessage.textContent = "Speichere …";
  try {
    const tag = gruppenfotoBearbeitenTag?.value ? Number(gruppenfotoBearbeitenTag.value) : null;
    const monat = gruppenfotoBearbeitenMonat?.value ? Number(gruppenfotoBearbeitenMonat.value) : null;
    const jahr = gruppenfotoBearbeitenJahr?.value ? Number(gruppenfotoBearbeitenJahr.value) : null;
    if (tag !== null && (!monat || !jahr)) throw new Error("Für einen Aufnahmetag bitte auch Monat und Jahr angeben.");
    if (monat !== null && !jahr) throw new Error("Für einen Aufnahmemonat bitte auch das Jahr angeben.");
    if (tag !== null && (tag < 1 || tag > 31)) throw new Error("Der Tag muss zwischen 1 und 31 liegen.");
    if (monat !== null && (monat < 1 || monat > 12)) throw new Error("Der Monat muss zwischen 1 und 12 liegen.");
    if (jahr !== null && (jahr < 1500 || jahr > 2100)) throw new Error("Das Jahr muss zwischen 1500 und 2100 liegen.");
    const changes = {
      titel: gruppenfotoBearbeitenTitel?.value.trim() || null,
      aufnahme_tag: tag,
      aufnahme_monat: monat,
      aufnahme_jahr: jahr
    };
    const { data, error } = await sb.from("fotos").update(changes).eq("id", fotoPersonenAktuell.id).select().single();
    if (error) throw error;
    Object.assign(fotoPersonenAktuell, data || changes);
    if (gruppenfotoMetadatenMessage) gruppenfotoMetadatenMessage.textContent = "Bezeichnung und Aufnahmedatum gespeichert ✓";
    await ladeGruppenfotoListe();
  } catch (err) {
    if (gruppenfotoMetadatenMessage) gruppenfotoMetadatenMessage.textContent = `Fehler: ${err.message || err}`;
  } finally { gruppenfotoMetadatenSpeichern.disabled = false; }
});

document.getElementById("foto-personen-close")?.addEventListener("click", () => { fotoPersonenModal.hidden = true; fotoPersonenAktuell = null; fotoMarkierungen = []; fotoAktiveMarkierungId = null; });
fotoPersonenModal?.addEventListener("click", e => { if (e.target === fotoPersonenModal) fotoPersonenModal.hidden = true; });

const detailPhotoViewer = document.getElementById("detail-photo-viewer");
const detailPhotoViewerImg = document.getElementById("detail-photo-viewer-img");
const detailPhotoViewerClose = document.getElementById("detail-photo-viewer-close");
const detailPhotoViewerMarkers = document.getElementById("detail-photo-viewer-markers");
const detailPhotoViewerLegend = document.getElementById("detail-photo-viewer-legend");
const detailPhotoViewerToggleNumbers = document.getElementById("detail-photo-viewer-toggle-numbers");
let detailPhotoViewerNumbersVisible = true;

function setDetailPhotoViewerNumbersVisible(visible) {
  detailPhotoViewerNumbersVisible = !!visible;
  if (detailPhotoViewerMarkers) detailPhotoViewerMarkers.hidden = !detailPhotoViewerNumbersVisible;
  if (detailPhotoViewerToggleNumbers) {
    detailPhotoViewerToggleNumbers.textContent = detailPhotoViewerNumbersVisible ? "Zahlen ausblenden" : "Zahlen einblenden";
    detailPhotoViewerToggleNumbers.setAttribute("aria-pressed", String(detailPhotoViewerNumbersVisible));
  }
}
detailPhotoViewerToggleNumbers?.addEventListener("click", () => setDetailPhotoViewerNumbersVisible(!detailPhotoViewerNumbersVisible));

function closeDetailPhotoViewer() {
  if (!detailPhotoViewer) return;
  detailPhotoViewer.hidden = true;
  if (detailPhotoViewerImg) detailPhotoViewerImg.src = "";
  if (detailPhotoViewerMarkers) detailPhotoViewerMarkers.innerHTML = "";
  if (detailPhotoViewerLegend) { detailPhotoViewerLegend.innerHTML = ""; detailPhotoViewerLegend.hidden = true; }
}

let detailViewerFoto = null;
let detailViewerMarkierungen = [];
let detailViewerUrl = "";

function renderGruppenfotoViewer(url, markierungen = [], foto = null) {
  if (!detailPhotoViewer || !detailPhotoViewerImg || !url) return;
  detailViewerFoto = foto || null;
  detailViewerMarkierungen = markierungen || [];
  detailViewerUrl = url;
  detailPhotoViewerImg.src = url;
  if (detailPhotoViewerMarkers) detailPhotoViewerMarkers.innerHTML = "";
  if (detailPhotoViewerLegend) detailPhotoViewerLegend.innerHTML = "";
  // Die Umschalt-Schaltfläche gehört in die rechte Legende direkt über die Namensliste.
  // Sie wird vor jedem Rendern dorthin verschoben, damit sie nicht links neben dem Foto bleibt.
  if (detailPhotoViewerLegend && detailPhotoViewerToggleNumbers) {
    detailPhotoViewerToggleNumbers.hidden = !(markierungen || []).length;
    detailPhotoViewerToggleNumbers.style.display = "block";
    detailPhotoViewerToggleNumbers.style.width = "100%";
    detailPhotoViewerToggleNumbers.style.boxSizing = "border-box";
    detailPhotoViewerToggleNumbers.style.margin = "0 0 8px 0";
    detailPhotoViewerLegend.appendChild(detailPhotoViewerToggleNumbers);
  }
  setDetailPhotoViewerNumbersVisible(true);

  const rows = [...(markierungen || [])].sort((a,b) => Number(a.nummer) - Number(b.nummer));
  rows.forEach(row => {
    const marker = document.createElement("span");
    marker.className = "detail-photo-viewer__marker";
    marker.textContent = row.nummer;
    marker.style.left = `${Number(row.position_x ?? 50)}%`;
    marker.style.top = `${Number(row.position_y ?? 50)}%`;
    marker.title = `${row.nummer}: ${fotoPersonName(row.personen_id)}`;
    detailPhotoViewerMarkers?.appendChild(marker);

    const legend = document.createElement("div");
    legend.className = "detail-photo-viewer__legend-item";
    const badge = document.createElement("span");
    badge.className = "detail-photo-viewer__legend-num";
    badge.textContent = row.nummer;
    const name = document.createElement("button");
    name.type = "button";
    name.className = "detail-photo-viewer__legend-name";
    const p = personenCache.find(person => person.id === row.personen_id);
    const alterImBild = gruppenfotoPersonenAlter(row.personen_id, foto);
    name.textContent = `${fotoPersonName(row.personen_id)}${alterImBild ? ` · ${alterImBild}` : ""}`;
    name.disabled = false;
    if (row.personen_id) {
      name.dataset.personId = row.personen_id;
    } else {
      name.classList.add("is-unknown");
      name.title = "Tippen, um eine Person zuzuordnen";
    }

    // Auf dem iPad zuverlässig über Touch/Pointer reagieren.
    // Der gesamte Legenden-Eintrag ist anklickbar, nicht nur der Text.
    if (!row.personen_id) {
      const openChooser = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (legend.querySelector(".detail-photo-viewer__assign")) return;
        name.hidden = true;
        const wrap = document.createElement("div");
        wrap.className = "detail-photo-viewer__assign";
        const select = document.createElement("select");
        select.innerHTML = '<option value="">— Person auswählen —</option>';
        const save = document.createElement("button");
        save.type = "button"; save.className = "btn btn--secondary"; save.textContent = "Zuordnen";
        const cancel = document.createElement("button");
        cancel.type = "button"; cancel.className = "btn btn--ghost"; cancel.textContent = "Abbrechen";

        const verfuegbar = (personenCache || [])
          .filter(p => !detailViewerMarkierungen.some(x => x.id !== row.id && x.personen_id === p.id))
          .slice()
          .sort(PersonSuche.sort);
        verfuegbar.forEach(p => select.appendChild(personOption(p)));
        save.addEventListener("click", async () => {
          const neueId = select.value;
          if (!neueId) return;
          if (detailViewerMarkierungen.some(x => x.id !== row.id && x.personen_id === neueId)) return;
          const { error } = await sb.from("foto_personen").update({ personen_id: neueId }).eq("id", row.id);
          if (error) {
            const msg = document.createElement("div");
            msg.className = "form-message"; msg.textContent = `Fehler: ${error.message}`;
            wrap.appendChild(msg);
            return;
          }
          row.personen_id = neueId;
          renderGruppenfotoViewer(detailViewerUrl, detailViewerMarkierungen, detailViewerFoto);
        });
        cancel.addEventListener("click", () => renderGruppenfotoViewer(detailViewerUrl, detailViewerMarkierungen, detailViewerFoto));
        wrap.append(select, save, cancel);
        legend.appendChild(wrap);
        const auswahl = personPickerFuerSelect(select, { platzhalter: "Name suchen …" });   // v341: gemeinsame Personenauswahl
        if (auswahl) auswahl.input.focus();
      };
      name.addEventListener("click", openChooser);
      name.addEventListener("pointerup", (event) => { if (event.pointerType === "touch") openChooser(event); });
      legend.style.cursor = "pointer";
    } else {
      const openPerson = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const personId = row.personen_id;
        // v355: merken, woher man kam, damit das ✕ der Personenansicht wieder ins Gruppenfoto führt
        const personOverlay = document.getElementById("person-view-overlay");
        rueckkehrNachPerson = {
          tab: document.querySelector(".tab-btn.is-active")?.dataset.tab || "liste",
          personId: personOverlay && !personOverlay.hidden ? currentPersonViewId : null,
          viewer: { url: detailViewerUrl, markierungen: detailViewerMarkierungen, foto: detailViewerFoto }
        };
        closeDetailPhotoViewer();
        // Personen-Tab aktivieren, damit die darunterliegende Ansicht
        // ebenfalls auf dem richtigen Bereich steht.
        document.querySelector('.tab-btn[data-tab="liste"]')?.click();
        try {
          await openPersonDetail(personId, { vonGruppenfoto: true });
        } catch (err) {
          debugLog(`❌ Person aus Gruppenfoto öffnen: ${err.message || err}`);
        }
      };
      name.addEventListener("click", openPerson);
      name.addEventListener("pointerup", (event) => {
        if (event.pointerType === "touch") openPerson(event);
      });
      legend.addEventListener("click", (event) => {
        if (event.target === name) return;
        openPerson(event);
      });
      legend.style.cursor = "pointer";
    }
    legend.append(badge, name);
    detailPhotoViewerLegend?.appendChild(legend);
  });
  if (detailPhotoViewerLegend) detailPhotoViewerLegend.hidden = rows.length === 0;
  if (detailPhotoViewerToggleNumbers) detailPhotoViewerToggleNumbers.hidden = rows.length === 0;
  detailPhotoViewer.hidden = false;
}

function openGruppenfotoViewer(url, markierungen = [], foto = null) {
  renderGruppenfotoViewer(url, markierungen, foto);
}

detailPhotoViewerClose?.addEventListener("click", closeDetailPhotoViewer);
detailPhotoViewer?.addEventListener("click", (event) => {
  if (event.target === detailPhotoViewer) closeDetailPhotoViewer();
});

// Auch das gerade ausgewählte Foto bei „Neu erfassen“ kann vergrößert werden.
function openPreviewFoto() {
  if (!fotoPreview?.src || fotoPreview.hidden) return;
  if (detailPhotoViewerImg) detailPhotoViewerImg.src = fotoPreview.src;
  if (detailPhotoViewer) detailPhotoViewer.hidden = false;
}
fotoPreview?.addEventListener("click", openPreviewFoto);
fotoPreview?.addEventListener("pointerup", openPreviewFoto);

document.getElementById("d-foto-input").addEventListener("change", async (e) => {
  if (e.target.files.length) {
    for (const file of Array.from(e.target.files)) await uploadDetailFoto(file);
    e.target.value = "";
  }
});
document.getElementById("d-foto-input-galerie").addEventListener("change", async (e) => {
  if (e.target.files.length) {
    for (const file of Array.from(e.target.files)) await uploadDetailFoto(file);
    e.target.value = "";
  }
});

// ---- Sprachnotizen im Detail ----
async function loadDetailAudio(personId) {
  const container = document.getElementById("d-audio-list");
  container.innerHTML = "";
  const { data, error } = await sb
    .from("sprachnotizen")
    .select("id, dateipfad, dauer_sekunden")
    .eq("person_id", personId);
  if (error) { debugLog(`❌ Sprachnotizen laden: ${error.message}`); return; }

  for (const note of data || []) {
    const div = document.createElement("div");
    div.className = "detail-media-item";
    div.innerHTML = `<audio controls preload="none"></audio><button class="del-btn" data-rolle="eigentuemer" title="Löschen">🗑️</button>`;

    const audio = div.querySelector("audio");
    let audioUrl = null;
    let urlPromise = null;

    const ladeAudioUrl = async () => {
      if (audioUrl) return audioUrl;
      if (!urlPromise) {
        urlPromise = sb.storage.from(BUCKET_AUDIO).createSignedUrl(note.dateipfad, 3600)
          .then(({ data: signed, error: signedError }) => {
            if (signedError || !signed?.signedUrl) {
              throw new Error(signedError?.message || "Keine signierte Audio-URL erhalten");
            }
            audioUrl = signed.signedUrl;
            return audioUrl;
          });
      }
      return urlPromise;
    };

    audio.addEventListener("play", async (event) => {
      if (audio.src) return;
      event.preventDefault();
      try {
        const url = await ladeAudioUrl();
        audio.src = url;
        audio.load();
        await audio.play();
      } catch (err) {
        debugLog(`❌ Sprachnotiz abspielen: ${err.message || err}`);
      }
    });

    div.querySelector(".del-btn").addEventListener("click", async () => {
      if (!darfLoeschen("Sprachnotizen löschen")) return;
      const { error: storageError } = await sb.storage.from(BUCKET_AUDIO).remove([note.dateipfad]);
      if (storageError) {
        debugLog(`⚠️ Sprachnotiz-Datei konnte nicht gelöscht werden: ${storageError.message}`);
        return;
      }
      const { error: dbError } = await sb.from("sprachnotizen").delete().eq("id", note.id);
      if (dbError) {
        debugLog(`⚠️ Sprachnotiz-Eintrag konnte nicht gelöscht werden: ${dbError.message}`);
        return;
      }
      loadDetailAudio(personId);
    });
    container.appendChild(div);
  }
}

document.getElementById("d-audio-record-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-audio-message");
  const btn = document.getElementById("d-audio-record-btn");
  if (!detailIsRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosenType = pickAudioMimeType();
      detailAudioMediaRecorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
      detailAudioChunks = [];
      detailAudioMediaRecorder.ondataavailable = (e) => detailAudioChunks.push(e.data);
      detailAudioMediaRecorder.onstop = async () => {
        const mimeType = detailAudioMediaRecorder.mimeType || chosenType || "audio/webm";
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(detailAudioChunks, { type: mimeType });
        const dauer = Math.round((Date.now() - detailAudioStart) / 1000);
        stream.getTracks().forEach((t) => t.stop());
        msg.textContent = "Lade hoch …";
        const path = `${currentDetailPersonId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await sb.storage.from(BUCKET_AUDIO).upload(path, blob);
        if (uploadError) { msg.textContent = `Fehler: ${uploadError.message}`; return; }
        const { error: insertError } = await sb.from("sprachnotizen").insert({
          person_id: currentDetailPersonId, dateipfad: path, dauer_sekunden: dauer,
        });
        msg.textContent = insertError ? `Fehler: ${insertError.message}` : "Sprachnotiz hinzugefügt ✓";
        loadDetailAudio(currentDetailPersonId);
      };
      detailAudioMediaRecorder.start();
      detailAudioStart = Date.now();
      detailIsRecording = true;
      btn.textContent = "⏹️ Aufnahme stoppen";
    } catch (err) {
      msg.textContent = "Mikrofonzugriff fehlgeschlagen";
    }
  } else {
    detailAudioMediaRecorder.stop();
    detailIsRecording = false;
    btn.textContent = "🎙️ Neue Aufnahme hinzufügen";
  }
});

// ---- Familie im Detail ----
function personNameById(id) {
  const p = personenCache.find((x) => x.id === id);
  return p ? `${p.vorname} ${p.nachname}` : "(unbekannte Person)";
}

function familiePartnerIds(familie, personId) {
  return [familie.partner_a_id, familie.partner_b_id].filter((id) => id && id !== personId);
}

// ---------- v357: Bearbeiten – ＋-Muster, Speichern-Leiste und Rückmeldungen ----------
// Regel: Beziehungen (Eltern, Partner, Kinder) speichern sofort mit ihrem eigenen „Hinzufügen“.
// Die Angaben zur Person (Name, Datum, Notiz, Quellen) speichert die Leiste unten, sobald etwas geändert wurde.
let detailGeaendert = false;
let toastTimer = null;
let barTimer = null;
let neuHinzufuegen = null;   // merkt, welches „Hinzufügen“ gerade ausgelöst wurde

function zeigeToast(text) {
  if (!text) return;
  let el = document.getElementById("detail-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "detail-toast";
    el.className = "detail-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("is-sichtbar");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-sichtbar"), 2800);
}

function setzeDetailGeaendert(wert, text) {
  detailGeaendert = !!wert;
  const bar = document.getElementById("detail-savebar");
  const txt = document.getElementById("detail-savebar-text");
  if (!bar) return;
  clearTimeout(barTimer);
  bar.classList.remove("is-ok");
  if (wert) { bar.hidden = false; if (txt) txt.textContent = text || "Nicht gespeicherte Änderungen"; }
  else bar.hidden = true;
}

function setzeDetailSauber() { setzeDetailGeaendert(false); }

function setzeNeuFormular(name, offen) {
  const neu = document.getElementById(`d-${name}-neu`);
  const plus = document.getElementById(`d-${name}-plus`);
  if (!neu || !plus) return;
  neu.hidden = !offen;
  plus.hidden = !!offen;
  if (offen) {
    const feld = document.getElementById(name === "partner" ? "d-partner-person" : "d-kind-person");
    const sucheingabe = feld?.parentElement?.querySelector("input[type=search], input[type=text]");
    (sucheingabe || feld)?.focus?.();
  } else if (name === "partner") {
    const sel = document.getElementById("d-partner-person"); if (sel) sel.value = "";
    const typ = document.getElementById("d-partner-typ"); if (typ) typ.value = "";
    const felder = document.getElementById("d-partner-felder"); if (felder) felder.hidden = true;
    ["d-partner-person"].forEach((id) => document.getElementById(id)?.dispatchEvent(new Event("change")));
  }
}

// Nach jedem Neuladen der Familienangaben: Formulare einklappen, vorhandene Partnerschaften verdichten
function aktualisiereNeuFormulare() {
  const hatPartner = document.querySelectorAll("#d-partner-list .familie-item").length > 0;
  const partnerPlus = document.getElementById("d-partner-plus");
  if (partnerPlus) partnerPlus.textContent = hatPartner ? "＋ Weitere Partnerschaft hinzufügen" : "＋ Partner/in hinzufügen";
  const hatKinder = document.querySelectorAll("#d-kinder-list > *").length > 0;
  const kindPlus = document.getElementById("d-kind-plus");
  if (kindPlus) kindPlus.textContent = hatKinder ? "＋ Weiteres Kind hinzufügen" : "＋ Kind hinzufügen";
  // Ein erfolgreich ausgelöstes „Hinzufügen“ leert die Auswahl: dann das Formular wieder einklappen
  if (neuHinzufuegen === "partner" && !document.getElementById("d-partner-person")?.value) setzeNeuFormular("partner", false);
  if (neuHinzufuegen === "kind" && !document.getElementById("d-kind-person")?.value) setzeNeuFormular("kind", false);
  neuHinzufuegen = null;
  // Mehrere Partnerschaften: die Auswahl „Zu welcher Partnerschaft?“ gleich zeigen
  const familienAuswahl = document.getElementById("d-kind-partner-family");
  const mehr = document.getElementById("d-kind-mehr");
  if (familienAuswahl && mehr) mehr.open = familienAuswahl.options.length > 2;
  // Eltern speichern erst anbieten, wenn man etwas ändern will
  const elternSpeichern = document.getElementById("d-save-eltern-btn");
  if (elternSpeichern) elternSpeichern.hidden = true;
  verdichtePartnerBloecke();
}

function verdichtePartnerBloecke() {
  for (const item of document.querySelectorAll("#d-partner-list .familie-item")) {
    if (item.dataset.verdichtet === "1") continue;
    const felder = item.querySelector(".familie-edit-fields");
    const block = item.querySelector(".familie-edit-block");
    if (!felder || !block) continue;
    item.dataset.verdichtet = "1";
    const typ = item.querySelector(".familie-typ-edit")?.value || "Partnerschaft";
    const von = item.querySelector(".familie-beginn-jahr")?.value || "";
    const bis = item.querySelector(".familie-ende-jahr")?.value || "";
    const zeitraum = von && bis ? `${von} – ${bis}` : von ? `seit ${von}` : bis ? `bis ${bis}` : "";
    const kurz = [typ, zeitraum].filter(Boolean).join(" · ");
    const kopf = document.createElement("div");
    kopf.className = "familie-kopf";
    const text = document.createElement("span");
    text.className = "familie-kurz";
    text.textContent = kurz;
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "btn btn--ghost familie-toggle";
    knopf.setAttribute("aria-expanded", "false");
    knopf.textContent = "✎ Bearbeiten";
    knopf.addEventListener("click", () => {
      const offen = felder.hidden;
      felder.hidden = !offen;
      knopf.setAttribute("aria-expanded", String(offen));
      knopf.textContent = offen ? "Zuklappen" : "✎ Bearbeiten";
    });
    kopf.append(text, knopf);
    felder.hidden = true;
    felder.before(kopf);
  }
}

// loadDetailFamilie um die Nachbearbeitung ergänzen (Aufrufer bleiben unverändert)
const loadDetailFamilieOriginal = loadDetailFamilie;
loadDetailFamilie = async function (personId) {
  await loadDetailFamilieOriginal(personId);
  try { aktualisiereNeuFormulare(); } catch (err) { debugLog(`⚠️ Formulare einklappen: ${err.message || err}`); }
};

document.addEventListener("DOMContentLoaded", () => {
  const el = (id) => document.getElementById(id);
  // ＋-Knöpfe, Abbrechen
  el("d-partner-plus")?.addEventListener("click", () => setzeNeuFormular("partner", true));
  el("d-kind-plus")?.addEventListener("click", () => setzeNeuFormular("kind", true));
  el("d-partner-abbrechen")?.addEventListener("click", () => setzeNeuFormular("partner", false));
  el("d-kind-abbrechen")?.addEventListener("click", () => { setzeNeuFormular("kind", false); const k = el("d-kind-person"); if (k) k.value = ""; });
  // Merker vor dem eigentlichen Hinzufügen setzen (Aufnahmephase), damit er nie zu spät kommt
  el("d-add-partner-btn")?.addEventListener("click", () => { neuHinzufuegen = "partner"; }, true);
  el("d-add-kind-btn")?.addEventListener("click", () => { neuHinzufuegen = "kind"; }, true);
  // Art, Beginn und Ende erst nach Auswahl der Person; Ehe ist vorgewählt
  el("d-partner-person")?.addEventListener("change", () => {
    const gewaehlt = !!el("d-partner-person").value;
    const felder = el("d-partner-felder");
    if (felder) felder.hidden = !gewaehlt;
    if (gewaehlt && el("d-partner-typ") && !el("d-partner-typ").value) {
      el("d-partner-typ").value = "Ehe";
      el("d-partner-typ").dispatchEvent(new Event("change"));
    }
  });
  // Eltern: Speichern-Knopf erst nach Tippen auf ✎ oder Auswahl
  document.querySelectorAll("[data-parent-edit]").forEach((b) => b.addEventListener("click", () => { const s = el("d-save-eltern-btn"); if (s) s.hidden = false; }));
  ["d-vater", "d-mutter"].forEach((id) => el(id)?.addEventListener("change", (e) => { if (e.isTrusted) { const s = el("d-save-eltern-btn"); if (s) s.hidden = false; } }));
  // Änderungen an der Person erkennen (nur echte Eingaben, keine programmatischen Befüllungen)
  const personFeld = document.querySelector("#detail-overlay .person-edit-fields");
  const alsGeaendert = (e) => { if (e.isTrusted) setzeDetailGeaendert(true); };
  personFeld?.addEventListener("input", alsGeaendert);
  personFeld?.addEventListener("change", alsGeaendert);
  personFeld?.addEventListener("click", (e) => {
    if (e.isTrusted && (e.target.closest(".weiterfuehrende-link-remove") || e.target.closest("#d-weiterfuehrende-links-add"))) setzeDetailGeaendert(true);
  });
  // Speichern-Leiste
  el("detail-savebar-speichern")?.addEventListener("click", () => el("d-save-person-btn")?.click());
  el("detail-savebar-verwerfen")?.addEventListener("click", async () => {
    if (!window.confirm("Die Änderungen an dieser Person verwerfen?")) return;
    setzeDetailSauber();
    try { await openPersonEdit(currentDetailPersonId, { fromTree: detailOpenedFromTree }); } catch (err) { debugLog(`⚠️ Verwerfen: ${err.message || err}`); }
  });
  // Rückmeldung des bisherigen Speicherns in die Leiste und als Hinweis spiegeln
  const personMsg = el("d-person-message");
  if (personMsg) new MutationObserver(() => {
    const t = personMsg.textContent.trim();
    const bar = el("detail-savebar"), txt = el("detail-savebar-text");
    if (!t || !bar || !txt) return;
    if (t.startsWith("Speichere")) { bar.hidden = false; txt.textContent = "Speichere …"; }
    else if (t.startsWith("Gespeichert")) {
      detailGeaendert = false; bar.hidden = false; bar.classList.add("is-ok"); txt.textContent = "Gespeichert ✓";
      clearTimeout(barTimer); barTimer = setTimeout(() => { bar.hidden = true; bar.classList.remove("is-ok"); }, 1800);
    } else if (detailGeaendert) { bar.hidden = false; bar.classList.remove("is-ok"); txt.textContent = t; }
  }).observe(personMsg, { childList: true, characterData: true, subtree: true });
  const famMsg = el("d-familie-message");
  if (famMsg) new MutationObserver(() => { const t = famMsg.textContent.trim(); if (t && !t.startsWith("Speichere")) zeigeToast(t); })
    .observe(famMsg, { childList: true, characterData: true, subtree: true });
});

// v361: Trauungsbuch-Quellen – Hilfsfunktionen
function trauungsUrlSchluessel(url) {
  try { return new URL(String(url || "").trim(), window.location.href).href; } catch { return String(url || "").trim(); }
}
// Alte Personenfelder (trauungsbuch_link) gelten nur dann für eine Ehe, wenn es eindeutig ist:
// beide Partner haben denselben Link, oder nur einer hat einen Link und hat genau eine Partnerschaft.
async function eindeutigeAlteTrauungsQuelle(personenListe) {
  const mitLink = personenListe.filter(p => String(p.trauungsbuch_link || "").trim());
  if (!mitLink.length) return null;
  if (mitLink.length === 2) {
    return trauungsUrlSchluessel(mitLink[0].trauungsbuch_link) === trauungsUrlSchluessel(mitLink[1].trauungsbuch_link) ? mitLink[0] : null;
  }
  const p = mitLink[0];
  try {
    const { data, error } = await sb.from("familien").select("id, familientyp, partner_a_id, partner_b_id")
      .or(`partner_a_id.eq.${p.id},partner_b_id.eq.${p.id}`);
    if (error) throw error;
    const ehen = (data || []).filter(x => x.partner_a_id && x.partner_b_id && x.familientyp !== "Eltern");
    return ehen.length === 1 ? p : null;
  } catch (err) {
    debugLog(`⚠️ Alte Trauungsbuchquelle prüfen: ${err.message || err}`);
    return null;
  }
}
// Entfernt die Quelle einer Ehe. Stammte die Anzeige aus den alten Personenfeldern,
// werden diese bei beiden Partnern geleert (nur wenn sie genau diesen Link enthalten).
async function entferneTrauungsQuelle(familieId, url, personIds, ausAltfeldern) {
  const schluessel = trauungsUrlSchluessel(url);
  if (!ausAltfeldern) {
    const { error } = await sb.from("familien_trauungsbuch_quellen").delete().eq("familie_id", familieId);
    return error ? error.message : null;
  }
  const { data: leute, error: e2 } = await sb.from("personen").select("id, trauungsbuch_link").in("id", personIds.filter(Boolean));
  if (e2) return e2.message;
  for (const p of leute || []) {
    if (trauungsUrlSchluessel(p.trauungsbuch_link) !== schluessel) continue;
    const { error: e3 } = await sb.from("personen").update({ trauungsbuch_link: null, trauungsbuch_zeile: null }).eq("id", p.id);
    if (e3) return e3.message;
  }
  return null;
}

async function loadDetailFamilie(personId) {
  const parentSelectVater = document.getElementById("d-vater");
  const parentSelectMutter = document.getElementById("d-mutter");
  const partnerList = document.getElementById("d-partner-list");
  const childList = document.getElementById("d-kinder-list");
  if (!parentSelectVater || !parentSelectMutter || !partnerList || !childList) return;

  // Die Familienansicht darf nicht davon abhängen, ob die globale Personenliste
  // vorher geladen wurde. Das Stammbaum-Fenster lädt Personen separat.
  // Deshalb wird hier sichergestellt, dass die Auswahl und die Kinderliste
  // einen vollständigen Personenbestand haben.
  if (personenCache.length < 2) {
    const { data: familienPersonen, error: familienPersonenError } = await sb
      .from("personen")
      .select("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, Notiz")
      .order("nachname", { ascending: true });
    if (familienPersonenError) {
      debugLog(`❌ Personen für Familienauswahl laden: ${familienPersonenError.message}`);
    } else if (Array.isArray(familienPersonen)) {
      personenCache = familienPersonen;
    }
  }

  const [{ data: childLinks, error: childError }, partnerAResult, partnerBResult] = await Promise.all([
    sb.from("familien_kinder").select("id, familie_id, beziehungstyp").eq("kind_id", personId),
    sb.from("familien").select("*").eq("partner_a_id", personId),
    sb.from("familien").select("*").eq("partner_b_id", personId),
  ]);
  if (childError) debugLog(`❌ Eltern laden: ${childError.message}`);
  if (partnerAResult.error) debugLog(`❌ Familien laden (A): ${partnerAResult.error.message}`);
  if (partnerBResult.error) debugLog(`❌ Familien laden (B): ${partnerBResult.error.message}`);
  const partnerFamilies = [
    ...(partnerAResult.data || []),
    ...(partnerBResult.data || []),
  ].filter((f, index, arr) => arr.findIndex((x) => x.id === f.id) === index);

  const parentFamilyIds = (childLinks || []).map((x) => x.familie_id);
  let parentFamilies = [];
  if (parentFamilyIds.length) {
    const { data, error } = await sb.from("familien")
      .select("*")
      .in("id", parentFamilyIds);
    if (error) {
      debugLog(`❌ Elternfamilien laden: ${error.message}`);
    } else {
      // Jede Familienverknüpfung eines Kindes definiert seine Elternfamilie.
      // Der Familientyp kann "Partnerschaft", "Ehe" oder "Eltern" sein.
      parentFamilies = data || [];
    }
  }

  const detailPersonIds = new Set([personId]);
  for (const f of partnerFamilies) {
    for (const id of [f.partner_a_id, f.partner_b_id]) if (id) detailPersonIds.add(id);
  }
  for (const f of parentFamilies) {
    for (const id of [f.partner_a_id, f.partner_b_id]) if (id) detailPersonIds.add(id);
  }
  const detailPersonMap = new Map(personenCache.map((p) => [p.id, p]));
  if (detailPersonIds.size) {
    const { data: detailPersons, error: detailPersonsError } = await sb
      .from("personen")
      .select("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr")
      .in("id", Array.from(detailPersonIds));
    if (detailPersonsError) {
      debugLog(`❌ Personendaten für Familienanzeige: ${detailPersonsError.message}`);
    } else {
      for (const p of detailPersons || []) detailPersonMap.set(p.id, p);
    }
  }
  const detailPerson = (id) => detailPersonMap.get(id) || personenCache.find((p) => p.id === id) || null;

  // Nur eine Elternfamilie ist die aktive Elternbeziehung des Kindes.
  // Bei alten, fehlerhaften Mehrfachverknüpfungen wird die erste vollständige
  // Familie bevorzugt; beim Speichern werden alle alten Links bereinigt.
  const aktuelleElternfamilie = parentFamilies.find((f) =>
    f.partner_a_id && f.partner_b_id
  ) || parentFamilies[0] || null;

  let vaterId = null;
  let mutterId = null;
  if (aktuelleElternfamilie) {
    const a = detailPerson(aktuelleElternfamilie.partner_a_id);
    const b = detailPerson(aktuelleElternfamilie.partner_b_id);

    // Elternzuordnung folgt der gespeicherten Partnerreihenfolge, nicht Geschlechtsdaten.
    vaterId = a?.id || null;
    mutterId = b?.id || null;
  }

  [parentSelectVater, parentSelectMutter].forEach((select) => {
    select.innerHTML = '<option value="">— nicht angegeben —</option>';
    personenCache.filter((p) => p.id !== personId).sort(personenAuswahlSortierung).forEach((p) => {
      select.appendChild(personOption(p));
    });
  });

  parentSelectVater.value = vaterId || "";
  parentSelectMutter.value = mutterId || "";
  const aktualisiereElternLink = (select, button) => {
    const person = personenCache.find(p => p.id === select.value);
    button.textContent = person ? personenAuswahlText(person) : "— nicht angegeben —";
    button.hidden = !person;
    select.hidden = !!person;
  };
  const vaterOpen = document.getElementById("d-vater-open");
  const mutterOpen = document.getElementById("d-mutter-open");
  aktualisiereElternLink(parentSelectVater, vaterOpen);
  aktualisiereElternLink(parentSelectMutter, mutterOpen);
  vaterOpen.onclick = () => { if (parentSelectVater.value) openPersonDetail(parentSelectVater.value); };
  mutterOpen.onclick = () => { if (parentSelectMutter.value) openPersonDetail(parentSelectMutter.value); };
  document.querySelectorAll("[data-parent-edit]").forEach(btn => {
    btn.onclick = () => {
      const select = document.getElementById(btn.dataset.parentEdit);
      const openBtn = document.getElementById(btn.dataset.parentEdit.replace("d-vater", "d-vater-open").replace("d-mutter", "d-mutter-open"));
      select.hidden = false; if (openBtn) openBtn.hidden = true; select.focus();
    };
  });
  [parentSelectVater, parentSelectMutter].forEach(select => select.addEventListener("change", () => {
    const openBtn = document.getElementById(select.id === "d-vater" ? "d-vater-open" : "d-mutter-open");
    aktualisiereElternLink(select, openBtn);
  }));

  partnerList.innerHTML = "";
  // Ehe-/Partnerschaftsblöcke chronologisch sortieren: frühester Beginn zuerst.
  // Unbekannte Beginndaten bleiben am Ende; die Originaldaten werden nicht verändert.
  const partnerFamiliesChronologisch = [...(partnerFamilies || [])].sort((a, b) => {
    const da = String(a?.beginn || "").slice(0, 10);
    const db = String(b?.beginn || "").slice(0, 10);
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
  for (const f of partnerFamiliesChronologisch) {
    const otherId = familiePartnerIds(f, personId)[0];
    if (!otherId) continue;
    const div = document.createElement("div");
    div.className = "detail-media-item familie-item";
    const typ = f.familientyp || "Partnerschaft";
    const tod = partnerschaftTodesende(f, detailPersonMap, personId);
    div.innerHTML = `
      <div class="beziehung-text familie-edit-block">
        <button type="button" class="familie-partner-link" title="Person bearbeiten">${personenAuswahlText(detailPerson(otherId))}</button>
        <div class="familie-edit-fields">
          <label class="field"><span>Art</span>
            <select class="familie-typ-edit">
              <option value="Partnerschaft">Partnerschaft</option>
              <option value="Ehe">Ehe</option>
            </select>
          </label>
          <label class="field"><span>Beginn</span>
            <div class="date-parts familie-beginn-edit">
              <select class="familie-beginn-tag"><option value="">Tag</option></select>
              <select class="familie-beginn-monat"><option value="">Monat</option></select>
              <select class="familie-beginn-jahr"><option value="">Jahr</option></select>
            </div>
          </label>
          <label class="field"><span>Ende</span>
            <div class="date-parts familie-ende-edit">
              <select class="familie-ende-tag"><option value="">Tag</option></select>
              <select class="familie-ende-monat"><option value="">Monat</option></select>
              <select class="familie-ende-jahr"><option value="">Jahr</option></select>
            </div>
          </label>
          <label class="field familie-jahre-field"><span>Ehejahre</span>
            <div class="familie-jahre">${ehejahreAnzeige({ ...f, familientyp: typ }, detailPersonMap, partnerFamilies) || "–"}</div>
          </label>
          <div class="familie-actions">
            <button class="del-btn" title="Partnerschaft löschen">🗑️</button>
          </div>
          <div class="familie-auto-ende"></div>
          <div class="familie-trauungsbuch" aria-live="polite"><span>Trauungsbuch:</span> <a class="familie-trauungsbuch-link" target="_blank" rel="noopener" hidden></a><span class="familie-trauungsbuch-zeile"></span><button type="button" class="source-edit-btn familie-source-edit" title="Trauungsbuch-Link bearbeiten" aria-label="Trauungsbuch-Link bearbeiten">✏️</button><div class="familie-source-editor" hidden><input type="url" class="familie-source-url" placeholder="https://…" aria-label="Trauungsbuch-URL"><label>Zeile <input type="number" class="familie-source-row" min="1" placeholder="–"></label><button type="button" class="btn btn--secondary familie-source-save">Quelle speichern</button><small class="familie-source-hint">Feld leeren und speichern entfernt den Link.</small></div></div>
          <button type="button" class="btn btn--secondary familie-save-btn">Partnerschaft speichern</button>
        </div>
      </div>`;

    const typEdit = div.querySelector(".familie-typ-edit");
    const beginnEdit = div.querySelector(".familie-beginn-edit");
    const endeEdit = div.querySelector(".familie-ende-edit");
    const beginnPrefix = `familie-${f.id}-beginn`;
    const endePrefix = `familie-${f.id}-ende`;
    beginnEdit.querySelector(".familie-beginn-tag").id = `${beginnPrefix}-tag`;
    beginnEdit.querySelector(".familie-beginn-monat").id = `${beginnPrefix}-monat`;
    beginnEdit.querySelector(".familie-beginn-jahr").id = `${beginnPrefix}-jahr`;
    endeEdit.querySelector(".familie-ende-tag").id = `${endePrefix}-tag`;
    endeEdit.querySelector(".familie-ende-monat").id = `${endePrefix}-monat`;
    endeEdit.querySelector(".familie-ende-jahr").id = `${endePrefix}-jahr`;
    // Die dynamischen Selects direkt initialisieren. Das ist robuster als eine
    // Suche über dynamisch erzeugte IDs und stellt sicher, dass Tag/Monat/Jahr
    // immer vollständig als Auswahl vorhanden sind.
    const beginnTag = beginnEdit.querySelector(".familie-beginn-tag");
    const beginnMonat = beginnEdit.querySelector(".familie-beginn-monat");
    const beginnJahr = beginnEdit.querySelector(".familie-beginn-jahr");
    const endeTag = endeEdit.querySelector(".familie-ende-tag");
    const endeMonat = endeEdit.querySelector(".familie-ende-monat");
    const endeJahr = endeEdit.querySelector(".familie-ende-jahr");
    initDatumElemente(beginnTag, beginnMonat, beginnJahr);
    initDatumElemente(endeTag, endeMonat, endeJahr);
    const autoEndeEl = div.querySelector(".familie-auto-ende");
    // Merkt, ob der Benutzer das automatisch vorgeschlagene Ende bewusst
    // verändert hat. Dadurch kann ein gelöschtes Todesende als "Ende unbekannt"
    // gespeichert werden, ohne beim nächsten Laden sofort wieder aufzutauchen.
    let endeManuellGeaendert = false;
    typEdit.value = typ;
    setDatumElemente(beginnTag, beginnMonat, beginnJahr, f.beginn || null);
    if (f.ende) {
      // Ein tatsächlich gespeichertes Ende hat immer Vorrang.
      setDatumElemente(endeTag, endeMonat, endeJahr, f.ende);
    } else if (tod?.exakt) {
      // Exaktes Sterbedatum des zuerst verstorbenen Partners als Anzeige.
      // Es wird erst beim ausdrücklichen Speichern in die Familienbeziehung übernommen.
      setDatumElemente(endeTag, endeMonat, endeJahr, tod.datum);
    } else if (tod?.jahr) {
      // Nur Sterbejahr bekannt: ausschließlich das Jahr anzeigen.
      // Kein künstliches Datum (z. B. 01.01.) in der Datenbank.
      setDatumJahrElemente(endeTag, endeMonat, endeJahr, tod.jahr);
    } else {
      setDatumElemente(endeTag, endeMonat, endeJahr, null);
    }
    // Der Hinweis gehört dauerhaft zur Partnerschaft, wenn ihr Ende durch den
    // Tod des ANDEREN Partners bestimmt wurde. Ein manuelles Ende (z. B.
    // Scheidung) bleibt davon unberührt. Bei nur bekanntem Sterbejahr kann das
    // Jahr angezeigt werden, ohne ein künstliches Datum zu speichern.
    if (tod && (!f.ende || (tod.exakt && f.ende === tod.datum))) {
      autoEndeEl.textContent = tod.exakt
        ? `Ende automatisch durch Tod: ${datumAnzeige(tod.datum)}`
        : `Ende automatisch durch Tod: ${tod.jahr}`;
      autoEndeEl.className = "familie-auto-ende capture-status";
    }

    [endeTag, endeMonat, endeJahr].forEach((el) => el.addEventListener("change", () => {
      endeManuellGeaendert = true;
    }));

    div.querySelector(".familie-partner-link").addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openPersonDetail(otherId);
    });

    // Trauungsbuchquelle pro Ehe aus der neuen Familientabelle laden.
    // Wenn dort noch kein Eintrag existiert, nur zur Anzeige auf alte Personendaten zurückfallen.
    const familienQuelleLink = div.querySelector(".familie-trauungsbuch-link");
    const familienQuelleZeile = div.querySelector(".familie-trauungsbuch-zeile");
    const sourceEditor = div.querySelector(".familie-source-editor");
    const sourceEditBtn = div.querySelector(".familie-source-edit");
    const sourceUrlInput = div.querySelector(".familie-source-url");
    const sourceRowInput = div.querySelector(".familie-source-row");
    let eheQuelle = null;
    try {
      const { data: eheQuelleData, error: eheQuelleError } = await sb
        .from("familien_trauungsbuch_quellen")
        .select("familie_id, trauungsbuch_link, trauungsbuch_zeile")
        .eq("familie_id", f.id)
        .maybeSingle();
      if (eheQuelleError) throw eheQuelleError;
      eheQuelle = eheQuelleData || null;
      if (!eheQuelle) {
        const { data: quellenPersonen, error: quellenError } = await sb.from("personen")
          .select("id, vorname, nachname, trauungsbuch_link, trauungsbuch_zeile")
          .in("id", [personId, otherId]);
        if (quellenError) throw quellenError;
        const legacyQuelle = await eindeutigeAlteTrauungsQuelle(quellenPersonen || []);
        if (legacyQuelle) eheQuelle = {
          alt: true,
          familie_id: f.id,
          trauungsbuch_link: legacyQuelle.trauungsbuch_link || "",
          trauungsbuch_zeile: legacyQuelle.trauungsbuch_zeile || null
        };
      }
      if (eheQuelle?.trauungsbuch_link) {
        familienQuelleLink.href = eheQuelle.trauungsbuch_link;
        familienQuelleLink.textContent = "Trauungsbuch öffnen";
        familienQuelleLink.hidden = false;
        familienQuelleLink.classList.add("btn--link-present");
        familienQuelleLink.removeAttribute("aria-disabled");
        familienQuelleZeile.textContent = eheQuelle.trauungsbuch_zeile ? `Zeile ${eheQuelle.trauungsbuch_zeile}` : "Zeile –";
      } else {
        familienQuelleLink.hidden = false;
        familienQuelleLink.href = "#";
        familienQuelleLink.textContent = "Trauungsbuch nicht hinterlegt";
        familienQuelleLink.classList.remove("btn--link-present");
        familienQuelleLink.setAttribute("aria-disabled", "true");
        familienQuelleZeile.textContent = "";
      }
    } catch (err) {
      familienQuelleLink.hidden = false;
      familienQuelleLink.href = "#";
      familienQuelleLink.textContent = "Trauungsbuch-Quelle nicht verfügbar";
      familienQuelleLink.classList.remove("btn--link-present");
      familienQuelleZeile.textContent = "";
      debugLog(`⚠️ Trauungsbuchquelle anzeigen: ${err.message || err}`);
    }

    sourceUrlInput.value = eheQuelle?.trauungsbuch_link || "";
    sourceRowInput.value = eheQuelle?.trauungsbuch_zeile ?? "";
    sourceEditBtn.addEventListener("click", () => { sourceEditor.hidden = !sourceEditor.hidden; });
    div.querySelector(".familie-source-save").addEventListener("click", async () => {
      const url = sourceUrlInput.value.trim();
      const rowText = sourceRowInput.value.trim();
      const row = rowText ? Number(rowText) : null;
      if (rowText && (!Number.isInteger(row) || row < 1)) {
        alert("Bitte eine gültige Zeilennummer ab 1 eingeben.");
        sourceRowInput.focus();
        return;
      }
      if (!url) {
        // v361: leeres Feld = Quelle dieser Ehe entfernen (vorher wurde der alte Link behalten)
        if (!eheQuelle?.trauungsbuch_link) { sourceEditor.hidden = true; return; }
        if (!confirm("Trauungsbuch-Link dieser Ehe entfernen?")) return;
        const fehler = await entferneTrauungsQuelle(f.id, eheQuelle.trauungsbuch_link, [personId, otherId], !!eheQuelle.alt);
        if (fehler) { alert(`Trauungsbuch-Quelle konnte nicht entfernt werden: ${fehler}`); return; }
        await loadDetailFamilie(currentDetailPersonId);
        return;
      }
      const updateDaten = {
        familie_id: f.id,
        trauungsbuch_link: url,
        trauungsbuch_zeile: row,
        geaendert_am: new Date().toISOString()
      };
      const { error } = await sb.from("familien_trauungsbuch_quellen").upsert(updateDaten, { onConflict: "familie_id" });
      if (error) { alert(`Trauungsbuch-Quelle konnte nicht gespeichert werden: ${error.message}`); return; }
      await loadDetailFamilie(currentDetailPersonId);
    });

    div.querySelector(".familie-save-btn").addEventListener("click", async () => {
      let eingegebenesEnde = getDatum(endePrefix);
      // Ist kein manuelles Ende eingegeben und ist der Todestag des anderen
      // Partners bekannt, wird dieser beim Speichern als Partnerschaftsende
      // übernommen. Bei nur bekanntem Sterbejahr bleibt das Ende absichtlich
      // NULL; der Hinweis bleibt trotzdem erhalten.
      // Nur wenn der Benutzer das Ende nicht verändert hat, darf der Tod
      // weiterhin automatisch als Ende übernommen werden. Wird ein
      // automatisch vorgeschlagenes Datum bewusst gelöscht, wird dies als
      // "Ende unbekannt / bereits beendet" gespeichert.
      let automatikIgnorieren = !!f.ende_automatik_ignorieren;
      if (endeManuellGeaendert) {
        automatikIgnorieren = !eingegebenesEnde;
      } else if (!eingegebenesEnde && tod?.exakt && !automatikIgnorieren) {
        eingegebenesEnde = tod.datum;
      }
      const updates = {
        familientyp: typEdit.value || "Partnerschaft",
        beginn: getDatum(beginnPrefix),
        ende: eingegebenesEnde,
        ende_automatik_ignorieren: automatikIgnorieren,
      };
      const msg = document.getElementById("d-familie-message");
      msg.textContent = "Partnerschaft wird gespeichert …";
      const { error } = await sb.from("familien").update(updates).eq("id", f.id);
      if (error) {
        msg.textContent = `Fehler: ${error.message}`;
      } else {
        msg.textContent = "Partnerschaft gespeichert ✓";
        await loadDetailFamilie(personId);
      }
    });

    div.querySelector(".del-btn").addEventListener("click", async () => {
      if (!confirm("Diese Partnerschaft mit allen zugehörigen Kinder-Verknüpfungen löschen?")) return;
      const { error } = await sb.from("familien").delete().eq("id", f.id);
      if (error) setDetailFamilieMessage(`Fehler: ${error.message}`);
      else await loadDetailFamilie(personId);
    });
    partnerList.appendChild(div);

    // Dauer der Ehe immer direkt nach dem Einfügen berechnen. Die Anzeige
    // hängt damit nicht davon ab, ob die vorherige HTML-Erzeugung den
    // Familientyp bereits korrekt normalisiert hat.
    const jahreEl = div.querySelector(".familie-jahre");
    const aktualisiereEhejahre = () => {
      const start = getDatumElemente(beginnTag, beginnMonat, beginnJahr);
      const end = getDatumElemente(endeTag, endeMonat, endeJahr);
      let text = "";
      if (String(typEdit.value || "").trim().toLocaleLowerCase("de") === "ehe" && start) {
        let endeDatum = end;
        if (!endeDatum && tod?.exakt) endeDatum = tod.datum;
        if (endeDatum) {
          const a = new Date(`${start}T00:00:00`);
          const b = new Date(`${String(endeDatum).slice(0,10)}T00:00:00`);
          if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && b >= a) {
            let j = b.getFullYear() - a.getFullYear();
            if ((b.getMonth() * 100 + b.getDate()) < (a.getMonth() * 100 + a.getDate())) j--;
            if (j >= 0) text = dauerText(a, b, true);
          }
        } else if (tod?.jahr) {
          const sj = Number(String(start).slice(0,4));
          const ej = Number(tod.jahr);
          if (Number.isFinite(sj) && Number.isFinite(ej) && ej >= sj) text = ej - sj >= 1 ? `${ej - sj} ${ej - sj === 1 ? "Jahr" : "Jahre"}` : "unter 1 Jahr";
        }
      }
      jahreEl.textContent = text;
    };
    [beginnTag, beginnMonat, beginnJahr, endeTag, endeMonat, endeJahr, typEdit].forEach((el) => el.addEventListener("change", aktualisiereEhejahre));
    aktualisiereEhejahre();
  }
  // Kompatibilitäts-Fallback: Falls der neue Familien-Datensatz nicht verfügbar ist,
  // lesen wir Partnerschaften aus der seit v9/v10 bewährten Tabelle beziehung.
  let kompatPartner = [];
  if (!partnerFamilies.length) {
    const { data: beziehungen, error: beziehungsError } = await sb
      .from("beziehung")
      .select("id, personen_a_id, personen_b_id, beziehungstyp")
      .or(`personen_a_id.eq.${personId},personen_b_id.eq.${personId}`);
    if (beziehungsError) {
      debugLog(`❌ Partnerschaften-Fallback: ${beziehungsError.message}`);
    } else {
      kompatPartner = (beziehungen || []).filter((b) =>
        b.beziehungstyp === "Ehe" || b.beziehungstyp === "Partnerschaft"
      );
    }
  }

  if (!partnerList.children.length) {
    for (const b of kompatPartner) {
      const otherId = b.personen_a_id === personId ? b.personen_b_id : b.personen_a_id;
      if (!otherId) continue;
      const div = document.createElement("div");
      div.className = "detail-media-item familie-item";
      div.innerHTML = `<span class="beziehung-text">${personenAuswahlText(detailPerson(otherId))} — ${b.beziehungstyp}</span><button class="del-btn" title="Partnerschaft löschen">🗑️</button>`;
      div.querySelector(".del-btn").addEventListener("click", async () => {
        if (!confirm("Diese Partnerschaft löschen?")) return;
        const { error } = await sb.from("beziehung").delete().eq("id", b.id);
        if (error) setDetailFamilieMessage(`Fehler: ${error.message}`);
        else await loadDetailFamilie(personId);
      });
      partnerList.appendChild(div);
    }
  }
  if (!partnerList.children.length) partnerList.innerHTML = '<span class="capture-status">Keine Partnerschaft erfasst</span>';

  // Kinder ausschließlich über die Familien dieses konkreten Paares laden.
  // Zuerst werden die Familien des aktuellen Elternteils ermittelt. Die
  // Kinderverknüpfungen werden danach über genau diese Familien gelesen.
  const partnerFamilyIds = (partnerFamilies || []).map((f) => f.id).filter(Boolean);
  let childLinksForPerson = [];
  if (partnerFamilyIds.length) {
    const { data, error } = await sb.from("familien_kinder")
      .select("id, familie_id, kind_id, beziehungstyp")
      .in("familie_id", partnerFamilyIds);
    if (error) {
      debugLog(`❌ Kinder laden: ${error.message}`);
    } else {
      childLinksForPerson = data || [];
    }
  }

  // Kinder immer direkt aus personen holen. Falls diese Abfrage scheitert,
  // wird der bereits geladene vollständige Personen-Cache verwendet.
  const childIds = [...new Set(childLinksForPerson.map((x) => x.kind_id).filter(Boolean))];
  let childPersons = [];
  if (childIds.length) {
    const { data, error } = await sb.from("personen").select("*").in("id", childIds);
    if (error) {
      debugLog(`❌ Kinderdaten direkt laden: ${error.message}`);
      childPersons = (personenCache || []).filter((p) => childIds.includes(p.id));
    } else {
      childPersons = data || [];
    }
  }
  const childPersonMap = new Map((childPersons || []).map((p) => [p.id, p]));

  childList.innerHTML = "";
  childLinksForPerson.sort((a, b) => {
    const childA = childPersonMap.get(a.kind_id);
    const childB = childPersonMap.get(b.kind_id);
    const dateA = String(childA?.geburtsdatum || "");
    const dateB = String(childB?.geburtsdatum || "");
    // Wie früher: Kinder chronologisch nach Geburtsdatum. Unbekannte Daten
    // stehen danach; bei Gleichstand entscheidet der Name.
    if (dateA && dateB) {
      const cmp = dateA.localeCompare(dateB);
      if (cmp !== 0) return cmp;
    } else if (dateA) return -1;
    else if (dateB) return 1;
    return personenAuswahlText(childA || { vorname: "", nachname: "" })
      .localeCompare(personenAuswahlText(childB || { vorname: "", nachname: "" }), "de", { sensitivity: "base" });
  });

  for (const link of childLinksForPerson) {
    const child = childPersonMap.get(link.kind_id);
    if (!child) {
      debugLog(`⚠️ Kind ${link.kind_id} ist verknüpft, aber der Personendatensatz konnte nicht geladen werden.`);
      continue;
    }
    const div = document.createElement("div");
    div.className = "detail-media-item familie-item";
    div.innerHTML = `<span class="beziehung-text" role="button" tabindex="0" title="Personendaten öffnen">${personenAuswahlText(child)}${link.beziehungstyp && link.beziehungstyp !== "biologisch" ? ` — ${link.beziehungstyp}` : ""}</span><button class="del-btn" title="Kind-Verknüpfung löschen">🗑️</button>`;
    const childNameEl = div.querySelector(".beziehung-text");
    const openChild = async (event) => { if (event) event.stopPropagation(); await openPersonDetail(child.id); };
    childNameEl.addEventListener("click", openChild);
    childNameEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openChild(event); }
    });
    div.querySelector(".del-btn").addEventListener("click", async (event) => {
      event.stopPropagation();
      const childName = personenAuswahlText(child);
      if (!confirm(`Möchtest du die Kinder-Verknüpfung von „${childName}“ wirklich löschen?`)) return;
      const { error } = await sb.from("familien_kinder").delete().eq("id", link.id);
      if (error) { setDetailFamilieMessage(`Fehler: ${error.message}`); return; }
      try {
        await loescheElternfamilieWennLeer(link.familie_id);
        await loadDetailFamilie(personId);
      } catch (err) { setDetailFamilieMessage(`Fehler: ${err.message}`); }
    });
    childList.appendChild(div);
  }
  if (!childList.children.length) childList.innerHTML = '<span class="capture-status">Keine Kinder erfasst</span>';

  await fillFamilienPersonSelect("d-partner-person", personId);
  const partnerAddBtn = document.getElementById("d-add-partner-btn");
  if (partnerAddBtn) {
    const hatPartnerschaft = !!partnerList.querySelector(".familie-item");
    // Der Button muss auch ohne bisherige Partnerschaft sichtbar sein,
    // sonst kann die erste Partnerschaft nicht angelegt werden.
    partnerAddBtn.hidden = false;
    partnerAddBtn.textContent = "Hinzufügen";   // v357: kurzer Text, die Überschrift „＋ …“ sagt schon, worum es geht
  }
  await fillFamilienPersonSelect("d-kind-person", personId);
  const familySelect = document.getElementById("d-kind-partner-family");
  familySelect.innerHTML = "";
  const validPartnerFamilies = (partnerFamilies || []).filter((f) => {
    const otherId = familiePartnerIds(f, personId)[0];
    return !!otherId;
  });
  if (!validPartnerFamilies.length) {
    familySelect.appendChild(new Option("— keine Partnerschaft vorhanden —", ""));
    familySelect.disabled = true;
  } else {
    familySelect.disabled = false;
    familySelect.appendChild(new Option(
      validPartnerFamilies.length === 1 ? "— diese Partnerschaft —" : "— Partnerschaft auswählen —",
      ""
    ));
    for (const f of validPartnerFamilies) {
      const otherId = familiePartnerIds(f, personId)[0];
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = `${personenAuswahlText(detailPerson(otherId))} — ${f.familientyp || "Partnerschaft"}`;
      familySelect.appendChild(opt);
    }
    // Bei genau einem Paar ist dieses Paar eindeutig und wird automatisch
    // ausgewählt. Bei mehreren Partnerschaften muss der Benutzer das Paar
    // ausdrücklich auswählen. Andere Personen/Familien erscheinen hier nie.
    if (validPartnerFamilies.length === 1) familySelect.value = validPartnerFamilies[0].id;
  }
}

async function fillFamilienPersonSelect(selectId, excludePersonId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">— auswählen —</option>';

  // v340: gemeinsamer Bestands-Cache statt eigenem Komplettabruf bei jedem Öffnen.
  const personenFuerAuswahl = await ensurePersonenFrisch();

  let kandidaten = personenFuerAuswahl.filter((p) => p.id !== excludePersonId);

  // Partnerauswahl: eine Person mit einer laufenden Ehe/Partnerschaft
  // steht nicht nochmals als laufender Partner zur Verfügung.
  if (selectId === "d-partner-person") {
    kandidaten = kandidaten.filter((p) => !partnerIdsAuswahlCache.has(p.id));
  }

  // Kinder: Eine Person, die bereits als Kind einer Familie eingetragen ist,
  // soll nicht ein zweites Mal ein Elternpaar bekommen. Außerdem darf ein
  // Elternteil der aktuell bearbeiteten Person nicht gleichzeitig als deren
  // Kind ausgewählt werden. Das ist nur ein Auswahlfilter und verändert keine
  // bestehenden Daten.
  if (selectId === "d-kind-person") {
    try {
      const [{ data: kinderLinks, error: kinderError }, { data: eigeneFamilien, error: familienError }] = await Promise.all([
        sb.from("familien_kinder").select("kind_id"),
        sb.from("familien").select("partner_a_id, partner_b_id").or(`partner_a_id.eq.${excludePersonId},partner_b_id.eq.${excludePersonId}`)
      ]);
      if (kinderError) throw kinderError;
      if (familienError) throw familienError;

      const hatBereitsEltern = new Set((kinderLinks || []).map((k) => k.kind_id).filter(Boolean));
      const eigeneElternteile = new Set();
      for (const f of eigeneFamilien || []) {
        if (f.partner_a_id && f.partner_a_id !== excludePersonId) eigeneElternteile.add(f.partner_a_id);
        if (f.partner_b_id && f.partner_b_id !== excludePersonId) eigeneElternteile.add(f.partner_b_id);
      }

      kandidaten = kandidaten.filter((p) =>
        !hatBereitsEltern.has(p.id) && !eigeneElternteile.has(p.id)
      );
    } catch (err) {
      debugLog(`⚠️ Kinder-Auswahlfilter: ${err.message || err}`);
      // Bei einem Filterfehler keine Daten verstecken. Die Auswahl bleibt
      // wie bisher funktionsfähig.
    }
  }

  kandidaten.sort(PersonSuche.sort);

  for (const p of kandidaten) select.appendChild(personOption(p));
}

async function findeOderErstelleFamilie(partnerAId, partnerBId, typ = "Partnerschaft", beginn = null, ende = null) {
  if (!partnerAId) throw new Error("Partner A fehlt.");

  // Partnerschaft: bewusst nur EIN einfacher INSERT.
  // Keine gegenseitige Prüfung, keine Vorab-Suche, kein RETURNING/SELECT.
  if (partnerBId) {
    // Exakt derselbe einfache INSERT wie der erfolgreiche SQL-Test.
    // Die Datenbank erzeugt die UUID selbst.
    const datensatz = {
      partner_a_id: partnerAId,
      partner_b_id: partnerBId,
      familientyp: typ || "Partnerschaft",
      beginn: beginn || null,
      ende: ende || null,
    };

    debugLog(`Familien-INSERT: ${partnerAId} ↔ ${partnerBId}`);
    const { error } = await sb.from("familien").insert(datensatz);
    if (error) throw error;

    debugLog("Familien-INSERT erfolgreich.");
    return datensatz;
  }

  // Ein Eltern-/Einzel-Eltern-Familieneintrag.
  const neueId = crypto.randomUUID();
  const datensatz = {
    id: neueId,
    partner_a_id: partnerAId,
    partner_b_id: null,
    familientyp: typ || "Partnerschaft",
    beginn: beginn || null,
    ende: ende || null,
  };

  const { error } = await sb.from("familien").insert(datensatz);
  if (error) throw error;
  return datensatz;
}

async function addKindZuFamilie(familieId, kindId, beziehungstyp = "biologisch") {
  const { error } = await sb.from("familien_kinder").upsert({
    familie_id: familieId,
    kind_id: kindId,
    beziehungstyp,
  }, { onConflict: "familie_id,kind_id" });
  if (error) throw error;
}

async function speichereElternZuKind(kindId, vaterId, mutterId) {
  if (vaterId && mutterId && vaterId === mutterId) {
    throw new Error("Vater und Mutter dürfen nicht dieselbe Person sein.");
  }

  // Alle Familienverknüpfungen dieses Kindes laden.
  const { data: links, error: linksError } = await sb
    .from("familien_kinder")
    .select("id, familie_id, kind_id, beziehungstyp")
    .eq("kind_id", kindId);
  if (linksError) throw linksError;

  const familyIds = [...new Set((links || []).map((l) => l.familie_id))];
  let families = [];
  if (familyIds.length) {
    const { data, error } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
      .in("id", familyIds);
    if (error) throw error;
    families = data || [];
  }

  // Jede familien_kinder-Verknüpfung dieses Kindes ist eine gespeicherte
  // Elternzuordnung – auch bei älteren Datensätzen, deren Familientyp nicht
  // exakt "Eltern" lautet. Beim Speichern dürfen diese Links nicht verloren gehen.
  const oldParentLinks = links || [];

  // Ziel-Familie: A=Vater (oder einziger Elternteil), B=Mutter.
  const zielA = vaterId || mutterId || null;
  const zielB = vaterId && mutterId ? mutterId : null;

  // Keine Eltern gewählt: alle Elternlinks dieses Kindes entfernen.
  if (!zielA) {
    for (const link of oldParentLinks) {
      const { error } = await sb.from("familien_kinder").delete().eq("id", link.id);
      if (error) throw error;
      await loescheElternfamilieWennLeer(link.familie_id);
    }
    return;
  }

  // Wichtig:
  // Die Elternfamilie wird NICHT nur bei den Familien dieses Kindes gesucht.
  // Eine Elternfamilie gehört zu den Eltern und wird von mehreren Geschwistern
  // gemeinsam verwendet. Früher konnte deshalb beim Speichern eines weiteren
  // Kindes eine zweite identische Elternfamilie entstehen.
  let zielFamilie = null;

  if (zielB) {
    const { data, error } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, created_at")
      .or(
        `and(partner_a_id.eq.${zielA},partner_b_id.eq.${zielB}),` +
        `and(partner_a_id.eq.${zielB},partner_b_id.eq.${zielA})`
      )
      .order("created_at", { ascending: true });
    if (error) throw error;
    // Der eindeutige Index erlaubt dieselbe Partnerkombination nur einmal.
    // Sind die Eltern bereits als Ehe/Partnerschaft gespeichert, muss diese
    // Familie auch für die Kinderzuordnung verwendet werden. Ein zusätzlicher
    // Datensatz mit familientyp="Eltern" würde am Index scheitern.
    zielFamilie = (data || []).find((f) => f.partner_a_id && f.partner_b_id) || null;
  } else {
    const { data, error } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, created_at")
      .eq("partner_a_id", zielA)
      .is("partner_b_id", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    zielFamilie = (data || []).find((f) => f.partner_a_id === zielA && !f.partner_b_id) || null;
  }

  // Nur wenn wirklich noch keine passende Elternfamilie existiert,
  // wird eine neue angelegt.
  if (!zielFamilie) {
    const { data, error } = await sb.from("familien")
      .insert({
        partner_a_id: zielA,
        partner_b_id: zielB,
        familientyp: "Eltern"
      })
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
      .single();
    if (error) throw error;
    zielFamilie = data;
  }

  // Alle bisherigen Elternlinks dieses Kindes entfernen.
  // Dadurch bleiben keine alten falschen Vater/Mutter-Kombinationen bestehen.
  for (const link of oldParentLinks) {
    if (link.familie_id === zielFamilie.id) continue;
    const { error } = await sb.from("familien_kinder").delete().eq("id", link.id);
    if (error) throw error;
    await loescheElternfamilieWennLeer(link.familie_id);
  }

  const existingTarget = oldParentLinks.find((l) => l.familie_id === zielFamilie.id);
  if (!existingTarget) {
    const { error } = await sb.from("familien_kinder").insert({
      familie_id: zielFamilie.id,
      kind_id: kindId,
      beziehungstyp: "biologisch"
    });
    if (error) throw error;
  }
}

async function loescheElternfamilieWennLeer(familieId) {
  const { data, error } = await sb.from("familien_kinder")
    .select("id")
    .eq("familie_id", familieId)
    .limit(1);
  if (error) throw error;

  if (!data || data.length === 0) {
    // Nur explizite Elternfamilien automatisch entfernen. Ältere oder anders
    // typisierte Familien können zugleich Ehe-/Partnerschaftsdaten enthalten;
    // diese dürfen beim Bereinigen einer Elternzuordnung nicht gelöscht werden.
    const { data: familie, error: familieError } = await sb.from("familien")
      .select("id, familientyp")
      .eq("id", familieId)
      .maybeSingle();
    if (familieError) throw familieError;
    if (familie && String(familie.familientyp || "").trim().toLocaleLowerCase("de") === "eltern") {
      const { error: delError } = await sb.from("familien")
        .delete()
        .eq("id", familieId);
      if (delError) throw delError;
    }
  }
}

document.getElementById("d-save-eltern-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-familie-message");
  const vater = document.getElementById("d-vater").value || null;
  const mutter = document.getElementById("d-mutter").value || null;

  // v360: Eltern gegen die Lebensdaten des Kindes prüfen
  try {
    const kindForm = { id: currentDetailPersonId, vorname: document.getElementById("d-vorname")?.value || "", nachname: document.getElementById("d-nachname")?.value || "", ...plausFormPerson("d-") };
    const lookup = await plausLadePersonen([vater, mutter]);
    const befunde = [vater, mutter].filter(Boolean).flatMap((id) => (lookup.has(id) ? plausElternKind(lookup.get(id), kindForm, "biologisch") : []));
    if (!(await plausFragen(befunde))) { msg.textContent = "Nicht gespeichert."; return; }
  } catch (err) { debugLog(`⚠️ Plausibilität (Eltern): ${err.message || err}`); }
  msg.textContent = "Speichere Eltern …";
  try {
    await speichereElternZuKind(currentDetailPersonId, vater, mutter);
    msg.textContent = "Eltern gespeichert ✓";
    await loadDetailFamilie(currentDetailPersonId);
  } catch (err) {
    msg.textContent = `Fehler: ${err.message}`;
    debugLog(`❌ Eltern speichern: ${err.message}`);
  }
});

// Partner/in auswählen löst KEIN automatisches Speichern aus.
// Zuerst Partner/in, Art (Partnerschaft/Ehe) und optional die Daten auswählen,
// anschließend ausdrücklich auf „Partner/in hinzufügen“ tippen.
function aktualisiereNeueEhejahre() {
  const el = document.getElementById("d-partner-ehejahre");
  if (!el) return;
  const typ = document.getElementById("d-partner-typ")?.value || "";
  if (typ.toLocaleLowerCase("de") !== "ehe") { el.textContent = "–"; return; }
  const start = getDatum("d-partner-beginn");
  let end = getDatum("d-partner-ende");
  if (!start || !end) { el.textContent = "–"; return; }
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) { el.textContent = "–"; return; }
  let jahre = b.getFullYear() - a.getFullYear();
  if ((b.getMonth() * 100 + b.getDate()) < (a.getMonth() * 100 + a.getDate())) jahre--;
  el.textContent = jahre >= 0 ? dauerText(a, b, true) : "–";
}

document.getElementById("d-partner-person").addEventListener("change", () => {
  const msg = document.getElementById("d-familie-message");
  if (msg) msg.textContent = "";
  aktualisiereNeueEhejahre();
});
["d-partner-typ","d-partner-beginn-tag","d-partner-beginn-monat","d-partner-beginn-jahr","d-partner-ende-tag","d-partner-ende-monat","d-partner-ende-jahr"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", aktualisiereNeueEhejahre);
});
aktualisiereNeueEhejahre();

document.getElementById("d-add-partner-btn").addEventListener("click", async () => {
  const wasAutoPartnerSave = autoPartnerSave;
  const msg = document.getElementById("d-familie-message");
  const partnerId = document.getElementById("d-partner-person").value;
  if (!partnerId) { msg.textContent = "Bitte Partner/in auswählen."; return; }

  msg.textContent = "Speichere Partnerschaft …";
  try {
    await ensureSession();
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData?.session?.user?.id || "keine Session-ID";
    debugLog(`Partnerschaftstest: Session ${userId}`);

    const typ = document.getElementById("d-partner-typ").value;
    if (!typ) {
      msg.textContent = "Bitte zuerst Partnerschaft oder Ehe auswählen.";
      return;
    }
    const beginn = getDatum("d-partner-beginn");
    const ende = getDatum("d-partner-ende");
    // v360: Beginn und Ende gegen die Lebensdaten beider Partner prüfen
    try {
      const selbstForm = { id: currentDetailPersonId, vorname: document.getElementById("d-vorname")?.value || "", nachname: document.getElementById("d-nachname")?.value || "", ...plausFormPerson("d-") };
      const lookup = await plausLadePersonen([partnerId]);
      const befunde = lookup.has(partnerId) ? plausPartnerschaft({ beginn, ende, familientyp: typ }, selbstForm, lookup.get(partnerId)) : [];
      if (!(await plausFragen(befunde))) { msg.textContent = "Nicht gespeichert."; return; }
    } catch (err) { debugLog(`⚠️ Plausibilität (Partner): ${err.message || err}`); }

    const beziehungsDatensatz = {
      personen_a_id: currentDetailPersonId,
      personen_b_id: partnerId,
      beziehungstyp: typ,
    };

    debugLog(`BEZIEHUNG-INSERT: ${JSON.stringify(beziehungsDatensatz)}`);

    const { data: beziehungData, error: beziehungsError } = await sb
      .from("beziehung")
      .insert(beziehungsDatensatz)
      .select("id, personen_a_id, personen_b_id, beziehungstyp")
      .single();

    if (beziehungsError) {
      const detail = [
        beziehungsError.message,
        beziehungsError.details,
        beziehungsError.hint,
        beziehungsError.code ? `Code: ${beziehungsError.code}` : ""
      ].filter(Boolean).join(" | ");
      debugLog(`❌ BEZIEHUNG-INSERT FEHLER: ${detail}`);
      msg.textContent = `❌ INSERT FEHLER: ${detail}`;
      return;
    }

    debugLog(`✅ BEZIEHUNG-INSERT ERFOLGREICH: ${JSON.stringify(beziehungData)}`);
    msg.textContent = `✅ INSERT erfolgreich – ID: ${beziehungData.id}`;

    // Zusätzlich Familien-Datensatz versuchen. Ein Fehler hier wird separat angezeigt.
    try {
      const familienDatensatz = {
        partner_a_id: currentDetailPersonId,
        partner_b_id: partnerId,
        familientyp: typ,
        beginn,
        ende,
      };
      debugLog(`FAMILIEN-INSERT: ${JSON.stringify(familienDatensatz)}`);
      const { data: familienData, error: familyErr } = await sb
        .from("familien")
        .insert(familienDatensatz)
        .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
        .single();

      if (familyErr) {
        const detail = [familyErr.message, familyErr.details, familyErr.hint, familyErr.code ? `Code: ${familyErr.code}` : ""]
          .filter(Boolean).join(" | ");
        debugLog(`⚠️ FAMILIEN-INSERT FEHLER: ${detail}`);
        msg.textContent = `✅ Beziehung gespeichert. ⚠️ Familien-INSERT Fehler: ${detail}`;
      } else {
        debugLog(`✅ FAMILIEN-INSERT ERFOLGREICH: ${JSON.stringify(familienData)}`);
        // Nur bei einer Ehe: derselbe Trauungsbuch-Link darf beim anderen
        // Ehepartner ergänzt werden. Andere Buch-Links werden nicht angefasst.
        if (typ === "Ehe") {
          try {
            await synchronisiereTrauungsbuchBeiEhe(currentDetailPersonId, partnerId);
          } catch (syncErr) {
            debugLog(`⚠️ Trauungsbuch-Synchronisierung bei Ehe: ${syncErr.message || syncErr}`);
          }
        }
        msg.textContent = "Partnerschaft hinzugefügt ✓";
      }
    } catch (familyErr) {
      const detail = familyErr?.message || String(familyErr);
      debugLog(`⚠️ FAMILIEN-INSERT AUSNAHME: ${detail}`);
      msg.textContent = `✅ Beziehung gespeichert. ⚠️ Familien-INSERT Fehler: ${detail}`;
    }

    if (!wasAutoPartnerSave) {
      document.getElementById("d-partner-person").value = "";
      setDatum("d-partner-beginn", null);
      setDatum("d-partner-ende", null);
    }
    await loadDetailFamilie(currentDetailPersonId);
    if (wasAutoPartnerSave) {
      const partnerSelect = document.getElementById("d-partner-person");
      if (partnerSelect) partnerSelect.value = partnerId;
    }
  } catch (err) {
    const detail = err?.message || String(err);
    debugLog(`❌ Partnerschaftstest AUSNAHME: ${detail}`);
    msg.textContent = `❌ INSERT FEHLER: ${detail}`;
  }
});

document.getElementById("d-add-kind-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-familie-message");
  const kindId = document.getElementById("d-kind-person").value;
  if (!kindId) { msg.textContent = "Bitte Kind auswählen."; return; }
  // v360: Elternteil (diese Person) gegen die Lebensdaten des Kindes prüfen
  try {
    const elternForm = { id: currentDetailPersonId, vorname: document.getElementById("d-vorname")?.value || "", nachname: document.getElementById("d-nachname")?.value || "", ...plausFormPerson("d-") };
    const lookup = await plausLadePersonen([kindId]);
    const befunde = lookup.has(kindId) ? plausElternKind(elternForm, lookup.get(kindId), document.getElementById("d-kind-typ")?.value || "biologisch") : [];
    if (!(await plausFragen(befunde))) { msg.textContent = "Nicht gespeichert."; return; }
  } catch (err) { debugLog(`⚠️ Plausibilität (Kind): ${err.message || err}`); }
  try {
    let familie = null;
    const partnerFamilies = await sb.from("familien").select("*").or(`partner_a_id.eq.${currentDetailPersonId},partner_b_id.eq.${currentDetailPersonId}`);
    const validPartnerFamilies = (partnerFamilies.data || []).filter((f) =>
      familiePartnerIds(f, currentDetailPersonId)[0]
    );
    const preferredPartnerId = document.getElementById("d-kind-partner-family").value || null;
    if (preferredPartnerId) familie = validPartnerFamilies.find((f) => f.id === preferredPartnerId) || null;
    if (!familie && validPartnerFamilies.length === 1) familie = validPartnerFamilies[0];
    if (!familie && validPartnerFamilies.length > 1) {
      msg.textContent = "Bitte die Partnerschaft auswählen, zu der das Kind gehört.";
      return;
    }
    if (!familie) {
      // Keine Partnerschaft vorhanden: Einzel-Elternfamilie anlegen, wie bisher.
      familie = await findeOderErstelleFamilie(currentDetailPersonId, null, "Eltern");
    }
    await addKindZuFamilie(familie.id, kindId, document.getElementById("d-kind-typ").value || "biologisch");
    msg.textContent = "Kind hinzugefügt ✓";
    document.getElementById("d-kind-person").value = "";
    await loadDetailFamilie(currentDetailPersonId);
  } catch (err) { msg.textContent = `Fehler: ${err.message}`; }
});

// ---- Person vollständig löschen ----
document.getElementById("d-delete-person-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-delete-message");
  if (!darfLoeschen("Personen löschen")) return;
  if (!confirm("Diese Person inkl. aller Fotos, Sprachnotizen und Beziehungen unwiderruflich löschen?")) return;
  msg.textContent = "Lösche …";

  try {
    await ensureSession();

    // Zuerst abhängige Datensätze löschen. Dadurch blockieren alte
    // Beziehungen die Löschung der Person nicht mehr.
    const { error: beziehungError } = await sb.from("beziehung")
      .delete()
      .or(`personen_a_id.eq.${currentDetailPersonId},personen_b_id.eq.${currentDetailPersonId}`);
    if (beziehungError) throw beziehungError;

    // Familienzuordnungen explizit entfernen; vorhandene CASCADEs bleiben zusätzlich wirksam.
    const { data: familien, error: familienFetchError } = await sb.from("familien")
      .select("id")
      .or(`partner_a_id.eq.${currentDetailPersonId},partner_b_id.eq.${currentDetailPersonId}`);
    if (familienFetchError) throw familienFetchError;

    const familienIds = (familien || []).map(f => f.id);
    if (familienIds.length) {
      const { error: kinderError } = await sb.from("familien_kinder")
        .delete()
        .in("familie_id", familienIds);
      if (kinderError) throw kinderError;

      const { error: familienError } = await sb.from("familien")
        .delete()
        .in("id", familienIds);
      if (familienError) throw familienError;
    }

    const { data: fotos, error: fotoFetchError } = await sb.from("fotos")
      .select("*").eq("personen_id", currentDetailPersonId);
    if (fotoFetchError) throw fotoFetchError;

    for (const f of fotos || []) {
      if (f.dateipfad) { await sb.storage.from(BUCKET_FOTOS).remove([f.dateipfad]); await loescheFotoAusBrowserCache(f.dateipfad); }
      const { error } = await sb.from("fotos").delete().eq("id", f.id);
      if (error) throw error;
    }

    const { data: audios, error: audioFetchError } = await sb.from("sprachnotizen")
      .select("*").eq("person_id", currentDetailPersonId);
    if (audioFetchError) throw audioFetchError;

    for (const a of audios || []) {
      if (a.dateipfad) await sb.storage.from(BUCKET_AUDIO).remove([a.dateipfad]);
      const { error } = await sb.from("sprachnotizen").delete().eq("id", a.id);
      if (error) throw error;
    }

    const { error: personError } = await sb.from("personen")
      .delete()
      .eq("id", currentDetailPersonId);
    if (personError) throw personError;

    detailOverlay.hidden = true;
    currentDetailPersonId = null;
    msg.textContent = "";
    await loadPersonen();
  } catch (err) {
    const detail = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    msg.textContent = `Fehler: ${detail}`;
    debugLog(`❌ Person löschen: ${detail}`);
  }
});

// ==========================================================
// EXPORT
// ==========================================================

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchAllTableRows(table, orderColumn = "id") {
  const rows = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select("*").order(orderColumn).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchAllExportData() {
  const [personen, familien, familien_kinder, fotos, foto_personen, sprachnotizen] = await Promise.all([
    fetchAllTableRows("personen", "nachname"),
    fetchAllTableRows("familien", "id"),
    fetchAllTableRows("familien_kinder", "id"),
    fetchAllTableRows("fotos", "id"),
    fetchAllTableRows("foto_personen", "id"),
    fetchAllTableRows("sprachnotizen", "id"),
  ]);
  // v363: Häuser, Stationen und Importe (Paket 3) mitsichern; fehlen die Tabellen, bleiben sie leer
  const optional = async (t) => { try { return await fetchAllTableRows(t, "id"); } catch (err) { debugLog(`ℹ️ Backup ohne ${t}: ${err.message || err}`); return []; } };
  const [importe, haeuser, person_stationen] = rolleIstEigentuemer()
    ? await Promise.all([optional("importe"), optional("haeuser"), optional("person_stationen")])
    : [[], await optional("haeuser"), await optional("person_stationen")];
  return { personen, familien, familien_kinder, fotos, foto_personen, sprachnotizen, importe, haeuser, person_stationen };
}

function backupDateiname() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `Partezettel_Backup_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}

function u16(value) {
  const a = new Uint8Array(2);
  new DataView(a.buffer).setUint16(0, value, true);
  return a;
}

function u32(value) {
  const a = new Uint8Array(4);
  new DataView(a.buffer).setUint32(0, value >>> 0, true);
  return a;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// CRC-32 für ZIP-Dateien. Wir verwenden bewusst STORE (keine Kompression),
// damit das Backup ohne zusätzliche Bibliothek auf iPad/iPhone erzeugt werden kann.
const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = ZIP_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipEncodeName(name) {
  return new TextEncoder().encode(name);
}

function erstelleZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = zipEncodeName(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const crc = crc32(data);
    const local = concatBytes([
      new Uint8Array([0x50,0x4B,0x03,0x04]),
      u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), nameBytes, data
    ]);
    locals.push(local);

    const central = concatBytes([
      new Uint8Array([0x50,0x4B,0x01,0x02]),
      u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      nameBytes
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralBytes = concatBytes(centrals);
  const localBytes = concatBytes(locals);
  const count = entries.length;
  const eocd = concatBytes([
    new Uint8Array([0x50,0x4B,0x05,0x06]),
    u16(0), u16(0), u16(count), u16(count),
    u32(centralBytes.length), u32(centralOffset), u16(0)
  ]);
  return concatBytes([localBytes, centralBytes, eocd]);
}

function zipReadDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Keine gültige ZIP-Datei.");

  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (centralOffset + centralSize > bytes.length) throw new Error("ZIP-Datei ist beschädigt.");

  const decoder = new TextDecoder();
  const entries = new Map();
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014B50) throw new Error("Ungültiger ZIP-Verzeichniseintrag.");
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    if (flags & 0x08) throw new Error("ZIP mit Daten-Deskriptor wird nicht unterstützt.");
    if (method !== 0) throw new Error("Dieses Backup verwendet eine nicht unterstützte Kompression.");

    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    const local = localOffset;
    if (view.getUint32(local, true) !== 0x04034B50) throw new Error("Ungültiger ZIP-Dateikopf.");
    const localNameLength = view.getUint16(local + 26, true);
    const localExtraLength = view.getUint16(local + 28, true);
    const dataStart = local + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length || uncompressedSize !== compressedSize) throw new Error("ZIP-Datei ist beschädigt.");
    entries.set(name, bytes.slice(dataStart, dataEnd));
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function sichereDateiname(name) {
  return String(name || "datei").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function mediaZipPath(bucket, path) {
  const parts = String(path || "").split("/").filter(Boolean).map(sichereDateiname);
  return `media/${bucket === BUCKET_FOTOS ? "fotos" : "sprachnotizen"}/${parts.join("/")}`;
}

async function sammleMedien(backupData, msg) {
  const media = [];
  const fehlendeFotos = [];
  const fehlendeAudio = [];
  const seen = new Set();
  const quellen = [
    ...(backupData.fotos || []).map((row) => ({ bucket: BUCKET_FOTOS, path: row.dateipfad, type: "foto" })),
    ...(backupData.sprachnotizen || []).map((row) => ({ bucket: BUCKET_AUDIO, path: row.dateipfad, type: "audio" })),
  ];

  let index = 0;
  for (const quelle of quellen) {
    if (!quelle.path || seen.has(`${quelle.bucket}|${quelle.path}`)) continue;
    seen.add(`${quelle.bucket}|${quelle.path}`);
    index++;
    msg.textContent = `Medien sichern … ${index}/${quellen.length}`;
    const { data, error } = await sb.storage.from(quelle.bucket).download(quelle.path);
    if (error || !data) {
      if (quelle.type === "foto") fehlendeFotos.push(quelle.path);
      else fehlendeAudio.push(quelle.path);
      debugLog(`⚠️ Mediendatei fehlt und wird im Backup übersprungen: ${quelle.bucket}/${quelle.path}`);
      continue;
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    media.push({
      bucket: quelle.bucket,
      path: quelle.path,
      zipPath: mediaZipPath(quelle.bucket, quelle.path),
      mimeType: data.type || (quelle.type === "foto" ? "image/jpeg" : "audio/mp4"),
      size: bytes.length,
      bytes,
    });
  }
  return { media, fehlendeFotos, fehlendeAudio };
}

async function teileOderLadeDateiHerunter(file) {
  if (navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "Partezettel Backup", text: "Vollständiges Partezettel-Backup", files: [file] });
        return "geteilt";
      }
    } catch (err) {
      if (err && err.name === "AbortError") return "abgebrochen";
      debugLog(`⚠️ Teilen nicht möglich, verwende Download: ${err.message || err}`);
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "download";
}

async function erstelleICloudBackup() {
  if (!darfLoeschen("ein vollständiges Backup erstellen")) return;
  const msg = document.getElementById("backup-message");
  msg.textContent = "Backup wird vorbereitet …";
  try {
    await ensureSession();
    const data = await fetchAllExportData();
    const gesammelt = await sammleMedien(data, msg);
    const media = gesammelt.media;

    // Fehlende Mediendateien werden nur im Backup übersprungen.
    // Das Backup darf niemals automatisch Datensätze in Supabase löschen.
    if (gesammelt.fehlendeFotos.length) {
      const fehlendeSet = new Set(gesammelt.fehlendeFotos);
      data.fotos = (data.fotos || []).filter(row => !fehlendeSet.has(row.dateipfad));
    }
    if (gesammelt.fehlendeAudio.length) {
      const fehlendeSet = new Set(gesammelt.fehlendeAudio);
      data.sprachnotizen = (data.sprachnotizen || []).filter(row => !fehlendeSet.has(row.dateipfad));
    }

    const manifest = {
      format: "partezettel-complete-backup",
      version: 2,
      createdAt: new Date().toISOString(),
      app: "Partezettel Archiv",
      tables: ["personen", "familien", "familien_kinder", "fotos", "foto_personen", "sprachnotizen", "importe", "haeuser", "person_stationen"],
      media: media.map(({ bucket, path, zipPath, mimeType, size }) => ({ bucket, path, zipPath, mimeType, size })),
    };
    const daten = { ...data };
    const entries = [
      { name: "backup.json", data: new TextEncoder().encode(JSON.stringify({ manifest, data: daten }, null, 2)) },
    ];
    for (const item of media) entries.push({ name: item.zipPath, data: item.bytes });

    msg.textContent = `ZIP-Backup wird erstellt … (${entries.length} Dateien)`;
    const zipBytes = erstelleZip(entries);
    const file = new File([zipBytes], backupDateiname(), { type: "application/zip" });
    const result = await teileOderLadeDateiHerunter(file);
    const bereinigt = gesammelt.fehlendeFotos.length + gesammelt.fehlendeAudio.length;
    const hinweis = bereinigt ? ` · ${bereinigt} verwaiste Medieneinträge übersprungen` : "";
    if (result === "abgebrochen") msg.textContent = "Backup nicht gespeichert.";
    else if (result === "geteilt") msg.textContent = `Vollständiges Backup erstellt ✓ (${media.length} Mediendateien). Über „Dateien“ kannst du es in iCloud Drive speichern.${hinweis}`;
    else msg.textContent = `Vollständiges Backup erstellt ✓ (${media.length} Mediendateien).${hinweis}`;
  } catch (err) {
    msg.textContent = `Fehler: ${err.message || err}`;
    debugLog(`❌ Vollständiges Backup: ${err.message || err}`);
  }
}

async function stelleBackupWiederHer(file) {
  const msg = document.getElementById("backup-message");
  if (!file) return;
  if (!confirm("Dieses vollständige Backup in Supabase einspielen? Vorhandene Datensätze mit gleicher ID werden überschrieben; vorhandene Mediendateien bleiben unverändert.")) return;
  msg.textContent = "Backup wird geprüft …";
  try {
    await ensureSession();
    let backup;
    let zipEntries = null;
    if (file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      zipEntries = zipReadDirectory(bytes);
      const backupBytes = zipEntries.get("backup.json");
      if (!backupBytes) throw new Error("backup.json fehlt im Backup.");
      backup = JSON.parse(new TextDecoder().decode(backupBytes));
    } else {
      backup = JSON.parse(await file.text());
    }

    const data = backup.data || backup;
    if (!data || (backup.manifest?.format !== "partezettel-complete-backup" && backup.format !== "partezettel-backup") || !Array.isArray(data.personen) || !Array.isArray(data.familien) || !Array.isArray(data.familien_kinder)) {
      throw new Error("Keine gültige Partezettel-Backup-Datei.");
    }

    const upsertBatch = async (table, rows, label) => {
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        if (!batch.length) continue;
        const { error } = await sb.from(table).upsert(batch, { onConflict: "id" });
        if (error) throw new Error(`${label}: ${error.message}`);
      }
    };

    // v363: Importe und Häuser vor den Personen, Stationen danach (nur wenn Paket 3 eingespielt ist)
    if ((data.importe || []).length) await upsertBatch("importe", data.importe, "Importe");
    if ((data.haeuser || []).length) await upsertBatch("haeuser", data.haeuser, "Häuser");
    await upsertBatch("personen", data.personen, "Personen");
    await upsertBatch("familien", data.familien || [], "Familien");
    await upsertBatch("familien_kinder", data.familien_kinder || [], "Kinder-Verknüpfungen");
    await upsertBatch("fotos", data.fotos || [], "Foto-Daten");
    await upsertBatch("foto_personen", data.foto_personen || [], "Foto-Personen-Verknüpfungen");
    await upsertBatch("sprachnotizen", data.sprachnotizen || [], "Sprachnotizen");
    if ((data.person_stationen || []).length) await upsertBatch("person_stationen", data.person_stationen, "Stationen");

    let restoredMedia = 0;
    let skippedMedia = 0;
    const media = backup.manifest?.media || [];
    if (zipEntries && media.length) {
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        msg.textContent = `Mediendateien wiederherstellen … ${i + 1}/${media.length}`;
        const bytes = zipEntries.get(item.zipPath);
        if (!bytes) throw new Error(`Mediendatei fehlt im ZIP: ${item.zipPath}`);

        // Bestehende Datei nicht überschreiben. So benötigt der Restore keine UPDATE-Rechte
        // und ein vorhandenes Original bleibt unangetastet.
        // Die Existenzprüfung lädt die Datei NICHT mehr herunter (früher .download()),
        // sondern fragt nur per exists() (HEAD-Anfrage, keine Dateidaten) nach. Ist exists()
        // in der geladenen Supabase-Version nicht verfügbar oder schlägt es fehl, wird direkt
        // hochgeladen; ein 409 "already exists" zählt dann als "vorhanden beibehalten".
        const bucketApi = sb.storage.from(item.bucket);
        let existiertBereits = false;
        if (typeof bucketApi.exists === "function") {
          const { data: existiert, error: existsError } = await bucketApi.exists(item.path);
          if (!existsError && existiert === true) existiertBereits = true;
        }
        if (existiertBereits) {
          skippedMedia++;
          continue;
        }
        const blob = new Blob([bytes], { type: item.mimeType || "application/octet-stream" });
        const { error } = await bucketApi.upload(item.path, blob, {
          upsert: false,
          contentType: item.mimeType || "application/octet-stream",
        });
        if (error) {
          const status = String(error.statusCode || error.status || "");
          if (status === "409" || /already exists|duplicate/i.test(error.message || "")) {
            skippedMedia++;
            continue;
          }
          throw new Error(`Mediendatei ${item.path}: ${error.message}`);
        }
        restoredMedia++;
      }
    }

    await loadPersonen();
    if (zipEntries) {
      msg.textContent = `Vollständiges Backup wiederhergestellt ✓ (${data.personen.length} Personen, ${restoredMedia} Mediendateien ergänzt, ${skippedMedia} vorhandene beibehalten).`;
    } else {
      msg.textContent = `Datenbank-Backup wiederhergestellt ✓ (${data.personen.length} Personen).`;
    }
  } catch (err) {
    msg.textContent = `Fehler beim Wiederherstellen: ${err.message || err}`;
    debugLog(`❌ Backup wiederherstellen: ${err.message || err}`);
  }
}

const backupBtn = document.getElementById("backup-icloud-btn");
if (backupBtn) backupBtn.addEventListener("click", erstelleICloudBackup);
const backupInput = document.getElementById("backup-restore-input");
if (backupInput) backupInput.addEventListener("change", async (event) => {
  if (!darfLoeschen("ein Backup wiederherstellen")) { event.target.value = ""; return; }
  const file = event.target.files?.[0];
  await stelleBackupWiederHer(file);
  event.target.value = "";
});

document.getElementById("export-json-btn").addEventListener("click", async () => {
  if (!darfLoeschen("Daten als JSON exportieren")) return;
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle JSON …";
  const data = await fetchAllExportData();
  downloadFile("partezettel-export.json", JSON.stringify(data, null, 2), "application/json");
  msg.textContent = "JSON-Datei heruntergeladen ✓";
});

document.getElementById("export-gedcom-btn").addEventListener("click", async () => {
  if (!darfLoeschen("Daten als GEDCOM exportieren")) return;
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle GEDCOM …";
  const { personen, familien, familien_kinder } = await fetchAllExportData();

  const gedcomDate = (d) => {
    if (!d) return null;
    const [y, m, day] = String(d).slice(0, 10).split("-");
    const monate = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${parseInt(day, 10)} ${monate[parseInt(m, 10) - 1]} ${y}`;
  };
  const clean = (v) => String(v || "").replace(/[\r\n]+/g, " ").trim();
  const personById = new Map(personen.map((p) => [p.id, p]));
  const gidById = new Map();
  personen.forEach((p, i) => gidById.set(p.id, `@I${i + 1}@`));
  const fidById = new Map();
  familien.forEach((f, i) => fidById.set(f.id, `@F${i + 1}@`));

  const famsByPerson = new Map();
  const famcByPerson = new Map();
  for (const f of familien) {
    for (const pid of [f.partner_a_id, f.partner_b_id].filter(Boolean)) {
      if (!famsByPerson.has(pid)) famsByPerson.set(pid, []);
      famsByPerson.get(pid).push(f.id);
    }
  }
  for (const fk of familien_kinder) {
    if (!famcByPerson.has(fk.kind_id)) famcByPerson.set(fk.kind_id, []);
    famcByPerson.get(fk.kind_id).push(fk.familie_id);
  }

  const lines = [
    "0 HEAD",
    "1 SOUR PartezettelArchiv",
    "2 NAME Partezettel Archiv",
    "1 GEDC",
    "2 VERS 5.5.1",
    "1 CHAR UTF-8",
  ];

  for (const p of personen) {
    lines.push(`0 ${gidById.get(p.id)} INDI`);
    lines.push(`1 NAME ${clean(p.vorname)} /${clean(p.nachname)}/`);
    if (p.Ledigenname) lines.push(`1 NOTE Geburtsname: ${clean(p.Ledigenname)}`);
    if (p.geburtsdatum || p.geburtsjahr) {
      lines.push("1 BIRT");
      lines.push(`2 DATE ${p.geburtsdatum ? gedcomDate(p.geburtsdatum) : String(p.geburtsjahr)}`);
    }
    if (p.sterbedatum || p.sterbejahr) { lines.push("1 DEAT"); lines.push(`2 DATE ${p.sterbedatum ? gedcomDate(p.sterbedatum) : String(p.sterbejahr)}`); }
    if (p.Notiz) lines.push(`1 NOTE ${clean(p.Notiz)}`);
    for (const fid of famsByPerson.get(p.id) || []) lines.push(`1 FAMS ${fidById.get(fid)}`);
    for (const fid of famcByPerson.get(p.id) || []) lines.push(`1 FAMC ${fidById.get(fid)}`);
  }

  for (const f of familien) {
    const fid = fidById.get(f.id);
    lines.push(`0 ${fid} FAM`);
    const a = personById.get(f.partner_a_id);
    const b = f.partner_b_id ? personById.get(f.partner_b_id) : null;
    const partners = [a, b].filter(Boolean);
    // GEDCOM-Rollen werden nicht mehr aus einem Geschlechtsfeld abgeleitet.
    // Für den Export werden vorhandene Partner in der gespeicherten Reihenfolge ausgegeben.
    if (a) lines.push(`1 HUSB ${gidById.get(a.id)}`);
    if (b) lines.push(`1 WIFE ${gidById.get(b.id)}`);
    if (f.beginn) {
      lines.push("1 MARR");
      lines.push(`2 DATE ${gedcomDate(f.beginn)}`);
    }
    if (f.ende) {
      if ((f.familientyp || "").toLowerCase() === "ehe") {
        lines.push("1 DIV");
        lines.push(`2 DATE ${gedcomDate(f.ende)}`);
      } else {
        lines.push(`1 NOTE Ende der ${clean(f.familientyp || "Partnerschaft")}: ${gedcomDate(f.ende)}`);
      }
    }
    if (f.familientyp && f.familientyp.toLowerCase() !== "ehe" && !f.beginn) {
      lines.push(`1 NOTE ${clean(f.familientyp)}`);
    }
    if (f.notiz) lines.push(`1 NOTE ${clean(f.notiz)}`);
    for (const fk of familien_kinder.filter((x) => x.familie_id === f.id)) {
      if (gidById.has(fk.kind_id)) {
        lines.push(`1 CHIL ${gidById.get(fk.kind_id)}`);
        if (fk.beziehungstyp && fk.beziehungstyp !== "biologisch") lines.push(`2 NOTE ${clean(fk.beziehungstyp)}`);
      }
    }
  }

  lines.push("0 TRLR");
  downloadFile("partezettel-export.ged", lines.join("\n"), "text/plain;charset=utf-8");
  msg.textContent = "GEDCOM-Datei heruntergeladen ✓";
});

// ---------- v350: PDF-Export im Familienspuren-Design ----------
// Aufbau: Kopf mit Logo und „Familienspuren“ wie auf der Startseite, Personen nach Buchstaben,
// danach Familien mit Kindern, Fußzeile mit Vertraulichkeitshinweis und Seitenzahl.
const PDF_FARBEN = {
  wald: [23, 79, 59], waldTief: [16, 61, 46], gold: [139, 112, 71], creme: [248, 246, 239],
  salbei: [237, 241, 233], linie: [216, 223, 212], text: [43, 42, 40], grau: [92, 87, 78], hell: [140, 136, 126]
};

async function holePdfDaten() {
  const [personen, familien, familien_kinder] = await Promise.all([
    fetchAllTableRows("personen", "nachname"),
    fetchAllTableRows("familien", "id"),
    fetchAllTableRows("familien_kinder", "id")
  ]);
  return { personen, familien, familien_kinder };
}

// Das Logo der Startseite als PNG (aus dem SVG der Kopfzeile), damit es im PDF identisch aussieht.
async function pdfLogoPng() {
  try {
    const quelle = document.querySelector(".app-header__logo svg");
    if (!quelle) return null;
    let svg = new XMLSerializer().serializeToString(quelle).replace(/currentColor/g, "#174f3b");
    if (!/xmlns=/.test(svg)) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    svg = svg.replace("<svg", '<svg width="640" height="520"');
    const bild = new Image();
    await new Promise((ok, fehler) => {
      bild.onload = ok;
      bild.onerror = () => fehler(new Error("Logo konnte nicht gezeichnet werden"));
      bild.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    const leinwand = document.createElement("canvas");
    leinwand.width = 640; leinwand.height = 520;
    leinwand.getContext("2d").drawImage(bild, 0, 0, 640, 520);
    return leinwand.toDataURL("image/png");
  } catch (err) {
    debugLog(`⚠️ PDF-Logo: ${err.message || err} (PDF wird ohne Logo erstellt)`);
    return null;
  }
}

function pdfDatum(wert) {
  const m = String(wert || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

// Geboren und gestorben stehen im PDF in zwei festen Spalten (lebende Personen: nur die erste Spalte).
function pdfLebensdaten(p) {
  const geboren = pdfDatum(p.geburtsdatum) || (p.geburtsjahr ? String(p.geburtsjahr) : "");
  const gestorben = pdfDatum(p.sterbedatum) || (p.sterbejahr ? String(p.sterbejahr) : "");
  return { geboren: geboren ? `* ${geboren}` : "", gestorben: gestorben ? `\u2020 ${gestorben}` : "" };
}

function baueFamilienPdf(jsPDF, daten, logo) {
  const F = PDF_FARBEN;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const B = 210, H = 297, R = 16, INNEN = B - 2 * R, UNTEN = H - 20;
  const X_GEB = B - R - 60;    // linke Datumsspalte: geboren
  const X_TOT = B - R - 30;    // rechte Datumsspalte: gestorben
  const personen = [...daten.personen].sort(PersonSuche.sort);
  const byId = new Map(daten.personen.map((p) => [p.id, p]));
  const familien = daten.familien || [];
  const kinder = daten.familien_kinder || [];
  let y = 0;

  const setzeText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setzeFuell = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setzeLinie = (c, w) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); };

  function kopfGross() {
    setzeFuell(F.creme); doc.rect(0, 0, B, 44, "F");
    setzeFuell(F.wald); doc.rect(0, 0, B, 2.2, "F");
    setzeLinie(F.linie, 0.3); doc.line(0, 44, B, 44);
    if (logo) doc.addImage(logo, "PNG", R, 11, 25, 20.3);
    const tx = logo ? R + 31 : R;
    doc.setFont("helvetica", "bold"); doc.setFontSize(27); setzeText(F.wald);
    doc.text("Familienspuren", tx, 25);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); setzeText(F.gold);
    doc.text("Menschen. Generationen. Geschichten.", tx, 32);
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); setzeText(F.waldTief);
    doc.text("Familienübersicht", R, 59);
    const datum = new Date().toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); setzeText(F.grau);
    doc.text(`Stand: ${datum}   ·   ${personen.length} Personen   ·   ${familien.length} Familien`, R, 66);
    setzeLinie(F.gold, 0.8); doc.line(R, 70, R + 22, 70);
    y = 80;
  }

  function kopfKlein() {
    setzeFuell(F.creme); doc.rect(0, 0, B, 15, "F");
    setzeFuell(F.wald); doc.rect(0, 0, B, 1.4, "F");
    setzeLinie(F.linie, 0.3); doc.line(0, 15, B, 15);
    if (logo) doc.addImage(logo, "PNG", R, 3.6, 9.4, 7.6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); setzeText(F.wald);
    doc.text("Familienspuren", logo ? R + 12.5 : R, 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setzeText(F.gold);
    doc.text("Familienübersicht", B - R, 10, { align: "right" });
    y = 24;
  }

  function neueSeite() { doc.addPage(); kopfKlein(); }
  function platz(hoehe) { if (y + hoehe > UNTEN) neueSeite(); }

  function buchstabe(b) {
    platz(29);
    if (y > 30) y += 3;
    setzeFuell(F.wald); doc.roundedRect(R, y, 8.5, 8.5, 1.6, 1.6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); setzeText([255, 255, 255]);
    doc.text(b, R + 4.25, y + 6.3, { align: "center" });
    setzeLinie(F.linie, 0.4); doc.line(R + 11.5, y + 4.25, X_GEB - 3, y + 4.25);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setzeText(F.hell);
    doc.text("geboren", X_GEB, y + 5.6);
    doc.text("gestorben", X_TOT, y + 5.6);
    y += 12.5;
  }

  function person(p) {
    const vorname = String(p.vorname || "").trim();
    const nachname = String(p.nachname || "").trim();
    const ledig = String(p.Ledigenname || p.ledigenname || p.geburtsname || "").trim();
    let haupt = [vorname, nachname].filter(Boolean).join(" ") || (ledig ? "" : "Unbekannte Person");
    const lebens = pdfLebensdaten(p);
    const notiz = String(p.Notiz || "").replace(/\s+/g, " ").trim();
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    let notizZeilen = notiz ? doc.splitTextToSize(notiz, INNEN - 6) : [];
    if (notizZeilen.length > 3) { notizZeilen = notizZeilen.slice(0, 3); notizZeilen[2] = notizZeilen[2].replace(/\s*\S{0,3}$/, "") + " …"; }
    const hoehe = 7.2 + notizZeilen.length * 3.9 + 2;
    platz(hoehe);
    // Name (bei Platzmangel gekürzt), Mädchenname in Grau
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); setzeText(F.text);
    const maxName = INNEN - 6 - 62;
    if (doc.getTextWidth(haupt) > maxName) haupt = doc.splitTextToSize(haupt, maxName)[0].replace(/\s*\S?$/, "") + " …";
    doc.text(haupt, R + 3, y + 4.6);
    if (ledig) {
      doc.setFont("helvetica", "normal"); setzeText(F.grau);
      doc.text(`${haupt ? "   " : ""}geb. ${ledig}`, R + 3 + (haupt ? doc.getTextWidth(haupt) : 0), y + 4.6);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setzeText(F.gold);
    if (lebens.geboren) doc.text(lebens.geboren, X_GEB, y + 4.6);
    if (lebens.gestorben) doc.text(lebens.gestorben, X_TOT, y + 4.6);
    if (notizZeilen.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setzeText(F.grau);
      doc.text(notizZeilen, R + 3, y + 9.2);
    }
    y += hoehe;
    setzeLinie([232, 228, 218], 0.15); doc.line(R, y - 1.1, B - R, y - 1.1);
  }

  function abschnitt(titel) {
    platz(34);
    setzeFuell(F.salbei); doc.roundedRect(R, y, INNEN, 10.5, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); setzeText(F.waldTief);
    doc.text(titel, R + 4, y + 7.1);
    y += 16;
  }

  function name(id) {
    const p = byId.get(id);
    return p ? PersonSuche.name(p) : "(unbekannte Person)";
  }

  function familie(f) {
    const partner = [f.partner_a_id, f.partner_b_id].filter(Boolean).map(name).join("  +  ") || "Familie";
    const typ = String(f.familientyp || "Partnerschaft");
    const kids = kinder.filter((k) => k.familie_id === f.id).map((k) =>
      `${name(k.kind_id)}${k.beziehungstyp && k.beziehungstyp !== "biologisch" ? ` (${k.beziehungstyp})` : ""}`);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    const partnerZeilen = doc.splitTextToSize(partner, INNEN - 34);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const kinderZeilen = kids.length ? doc.splitTextToSize(kids.join("  ·  "), INNEN - 22) : [];
    const hoehe = 6 + (partnerZeilen.length - 1) * 4.6 + (kinderZeilen.length ? 1.2 + kinderZeilen.length * 4.2 : 0) + 3.4;
    platz(hoehe);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); setzeText(F.text);
    doc.text(partnerZeilen, R + 3, y + 4.4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setzeText(F.gold);
    doc.text(typ, B - R, y + 4.4, { align: "right" });
    let zy = y + 4.4 + (partnerZeilen.length - 1) * 4.6;
    if (kinderZeilen.length) {
      zy += 5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); setzeText(F.grau);
      doc.text("Kinder", R + 3, zy);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); setzeText(F.text);
      doc.text(kinderZeilen, R + 19, zy);
    }
    y += hoehe;
    setzeLinie([232, 228, 218], 0.15); doc.line(R, y - 1.1, B - R, y - 1.1);
  }

  kopfGross();
  let aktuell = null;
  for (const p of personen) {
    const schluessel = String(PersonSuche.sortSchluessel(p) || "").trim();
    // Ä, Ö, Ü gehören zu A, O, U (wie in der Sortierung)
    let b = schluessel ? schluessel.charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("de") : "…";
    if (!/\p{L}/u.test(b) && b !== "…") b = "#";
    if (b !== aktuell) { buchstabe(b); aktuell = b; }
    person(p);
  }
  if (familien.length) {
    y += 6;
    abschnitt("Familien und Kinder");
    const schluesselFam = (f) => PersonSuche.sortSchluessel(byId.get(f.partner_a_id) || byId.get(f.partner_b_id)) || "~";
    for (const f of [...familien].sort((x, y2) => String(schluesselFam(x)).localeCompare(String(schluesselFam(y2)), "de"))) familie(f);
  }

  // Fußzeile auf jeder Seite
  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    setzeLinie(F.linie, 0.3); doc.line(R, H - 14, B - R, H - 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); setzeText(F.hell);
    doc.text("Familienspuren  ·  Vertraulich, nur für den Familienkreis", R, H - 9);
    doc.text(`Seite ${i} von ${seiten}`, B - R, H - 9, { align: "right" });
  }
  doc.setProperties({ title: "Familienspuren – Familienübersicht", subject: "Personen und Familien", author: "Familienspuren", creator: "Familienspuren" });
  return doc;
}

document.getElementById("export-pdf-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle PDF …";
  try {
    if (!window.jspdf) { msg.textContent = "PDF-Bibliothek konnte nicht geladen werden."; return; }
    const daten = await holePdfDaten();
    const logo = await pdfLogoPng();
    const doc = baueFamilienPdf(window.jspdf.jsPDF, daten, logo);
    const heute = new Date().toISOString().slice(0, 10);
    doc.save(`Familienspuren_Familienuebersicht_${heute}.pdf`);
    msg.textContent = `PDF heruntergeladen ✓ (${daten.personen.length} Personen, ${doc.getNumberOfPages()} Seiten)`;
  } catch (err) {
    msg.textContent = `PDF konnte nicht erstellt werden: ${err.message || err}`;
    debugLog(`❌ PDF-Export: ${err.message || err}`);
  }
});

// ===================== Stammbaum v31 =====================
let treeZoom = 1;
let treeViewMode = "classic";   // v339: Standardansicht ist die Familienansicht
let treeData = { personen: [], familien: [], kinder: [], photos: new Map() };
let treeDataGeladenAm = 0;

function escTree(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

function treeNormalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("de").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function treeMaleAncestorSurname(personId, seen = new Set()) {
  if (!personId || seen.has(personId)) return "";
  seen.add(personId);
  const person = treePerson(personId);
  if (!person) return "";
  const families = treeParentFamiliesForPerson(personId);
  for (const family of families) {
    const candidates = [family.partner_a_id, family.partner_b_id].filter(Boolean);
    for (const candidateId of candidates) {
      const surname = treeMaleAncestorSurname(candidateId, seen);
      if (surname) return surname;
    }
  }
  return String(person.nachname || "").trim();
}

function treeLineColorClass(lineSurname) {
  const value = treeNormalizeName(lineSurname);
  if (!value) return "";
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return `tree-line-color-${Math.abs(hash) % 6}`;
}

// ---------- v356: Kompakte Frauen-Namen in den Stammbaum-Ansichten ----------
// Trägt eine Frau den Nachnamen ihres Partners und hat einen anderen Geburtsnamen, steht in den Stammbaum-Karten nur
// „Luise (geb. Mangeng)“ statt „Luise Ganahl (geb. Mangeng)“. Listen, Suche, Überschriften und PDF zeigen den vollen Namen.
function treeNamensgleichMitPartner(p, nachname) {
  const ziel = treeNormalizeName(nachname);
  for (const f of treeFamiliesForPerson(p.id)) {
    const andere = f.partner_a_id === p.id ? f.partner_b_id : f.partner_a_id;
    const q = andere ? treePerson(andere) : null;
    if (q && treeNormalizeName(q.nachname) === ziel) return true;
  }
  return false;
}
function treeAnzeigeName(p) {
  const vorname = String(p.vorname || "").trim();
  const nachname = String(p.nachname || "").trim();
  const ledig = String(p.Ledigenname || p.ledigenname || p.geburtsname || "").trim();
  let name = [vorname, nachname].filter(Boolean).join(" ").trim();
  if (vorname && nachname && ledig && treeNormalizeName(nachname) !== treeNormalizeName(ledig) && treeNamensgleichMitPartner(p, nachname)) name = vorname;
  return { name: name || "(ohne Namen)", ledig };
}
function treeKompaktLabel(p) {
  const an = treeAnzeigeName(p);
  return an.ledig ? `${an.name} (geb. ${an.ledig})` : an.name;
}

function treePersonCard(person, rootId = null, extraClass = "", lineSurname = "") {
  if (!person) return "";
  const jahre = [(person.geburtsdatum ? person.geburtsdatum.split("-")[0] : (person.geburtsjahr ? String(person.geburtsjahr) : "")), (person.sterbedatum ? person.sterbedatum.split("-")[0] : (person.sterbejahr ? String(person.sterbejahr) : ""))].filter(Boolean).join(" – ");
  const foto = treeData.photos.get(person.id);
  const isLinePerson = lineSurname && treeNormalizeName(person.nachname) === treeNormalizeName(lineSurname);
  const lineClass = isLinePerson ? `tree-node--line ${treeLineColorClass(lineSurname)}` : "";
  const relationClass = treeRelationshipSelection.personAId === person.id
    ? "tree-node--relation-a"
    : treeRelationshipSelection.personBId === person.id
      ? "tree-node--relation-b"
      : "";
  const ledigenname = String(person.Ledigenname || person.ledigenname || person.geburtsname || "").trim();
  const nachname = String(person.nachname || "").trim();
  const maidenLabel = ledigenname
    ? ` <span class="tree-node__maiden-name">geb. ${escTree(ledigenname)}</span>` : "";
  return `<button type="button" class="tree-node ${rootId === person.id ? "tree-node--root" : ""} ${relationClass} ${lineClass} ${extraClass}" data-tree-person="${person.id}">
    ${foto ? `<img class="tree-node__photo" src="${escTree(foto)}" alt="Schlüsselfoto von ${escTree(person.vorname)} ${escTree(person.nachname)}">` : `<span class="tree-node__placeholder" aria-hidden="true">👤</span>`}
    <span class="tree-node__name">${pruefPunktHtml(person)}${escTree(treeAnzeigeName(person).name)}${maidenLabel}</span>
    ${jahre ? `<span class="tree-node__years">${escTree(jahre)}</span>` : ""}
  </button>`;
}

// v353: Platzhalter für unbekannte Personen („Anonymous“, „Anonyma“ ohne Nachnamen) erscheinen nicht im Stammbaum,
// in der Stammbaum-Suche und bei den Cousins. Im Bestand bleiben sie unverändert erhalten.
const TREE_PLATZHALTER_VORNAMEN = new Set(["anonymous", "anonyma", "anonymus"]);
function treeIstPlatzhalter(p) {
  if (!p) return false;
  const vor = String(p.vorname || "").trim().toLowerCase();
  return TREE_PLATZHALTER_VORNAMEN.has(vor) && !String(p.nachname || "").trim() && !String(p.Ledigenname || p.ledigenname || "").trim();
}

// Entfernt Platzhalter samt ihrer Verknüpfungen: Eine Familie behält ihre echten Partner und Kinder;
// Familien ohne Kinder und mit weniger als zwei echten Partnern entfallen.
function treeOhnePlatzhalter(personen, familien, kinder) {
  const weg = new Set((personen || []).filter(treeIstPlatzhalter).map((p) => p.id));
  if (!weg.size) return { personen: personen || [], familien: familien || [], kinder: kinder || [] };
  const kinderOk = (kinder || []).filter((k) => !weg.has(k.kind_id));
  const mitKindern = new Set(kinderOk.map((k) => k.familie_id));
  const familienOk = [];
  for (const f of familien || []) {
    const a = weg.has(f.partner_a_id) ? null : f.partner_a_id;
    const b = weg.has(f.partner_b_id) ? null : f.partner_b_id;
    const echte = [a, b].filter(Boolean).length;
    if (echte < 2 && !mitKindern.has(f.id)) continue;
    familienOk.push({ ...f, partner_a_id: a, partner_b_id: b });
  }
  const familienIds = new Set(familienOk.map((f) => f.id));
  return {
    personen: personen.filter((p) => !weg.has(p.id)),
    familien: familienOk,
    kinder: kinderOk.filter((k) => familienIds.has(k.familie_id))
  };
}

function treePerson(id) {
  return treeData.personen.find((p) => p.id === id) || null;
}

function treeFamiliesForPerson(id) {
  return treeData.familien.filter((f) => f.partner_a_id === id || f.partner_b_id === id);
}

function treeChildrenForFamily(familyId) {
  return treeData.kinder
    .filter((k) => k.familie_id === familyId)
    .map((k) => ({ ...k, person: treePerson(k.kind_id) }))
    .filter((k) => k.person)
    .sort((a, b) => {
      const dateA = a.person.geburtsdatum || "";
      const dateB = b.person.geburtsdatum || "";
      // Kinder werden chronologisch nach dem vollständigen Geburtsdatum angezeigt.
      // Fehlende Geburtsdaten stehen am Ende.
      if (dateA && dateB) return dateA.localeCompare(dateB);
      if (dateA) return -1;
      if (dateB) return 1;
      const nameA = `${a.person.nachname || ""} ${a.person.vorname || ""}`;
      const nameB = `${b.person.nachname || ""} ${b.person.vorname || ""}`;
      return nameA.localeCompare(nameB, "de", { sensitivity: "base" });
    });
}

function treeParentFamiliesForPerson(id) {
  return treeData.kinder.filter((k) => k.kind_id === id).map((k) => treeData.familien.find((f) => f.id === k.familie_id)).filter(Boolean);
}

async function loadStammbaumData(optionen = {}) {
  await ensureSession();
  const [{ data: personen, error: personenError }, { data: familien, error: familienError }, { data: kinder, error: kinderError }] = await Promise.all([
    personenMitPruefSpalten("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr", (sp) => sb.from("personen").select(sp).order("nachname", { ascending: true })),
    sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, ende_automatik_ignorieren"),
    sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp")
  ]);
  if (personenError) throw personenError;
  if (familienError) throw familienError;
  if (kinderError) throw kinderError;

  const bereinigt = treeOhnePlatzhalter(personen || [], familien || [], kinder || []);
  treeData.personen = bereinigt.personen;
  treeData.familien = bereinigt.familien;
  treeData.kinder = bereinigt.kinder;
  treeData.photos = new Map();
  treeDataGeladenAm = Date.now();
  // Suchvorschläge stehen ab hier bereit – noch bevor die Schlüsselfotos geladen sind.
  if (typeof optionen.nachStruktur === "function") {
    try { optionen.nachStruktur(); } catch (err) { debugLog(`⚠️ Stammbaum-Vorschläge: ${err.message || err}`); }
  }

  const ids = treeData.personen.map((p) => p.id);
  if (ids.length) {
    const { data: fotos, error: fotoError } = await sb.from("fotos")
      .select("personen_id, dateipfad, ist_schluesselfoto")
      .in("personen_id", ids)
      .eq("ist_schluesselfoto", true);
    if (fotoError) debugLog(`❌ Stammbaum-Schlüsselfotos: ${fotoError.message}`);
    const fotoUrls = await ladeFotoBilder((fotos || []).map(f => f.dateipfad));
    for (const foto of fotos || []) {
      const fotoUrl = fotoUrls.get(foto.dateipfad);
      if (fotoUrl) treeData.photos.set(foto.personen_id, fotoUrl);
    }
  }
}

function treeUniquePeople(ids) {
  const seen = new Set();
  const result = [];
  for (const id of ids || []) {
    if (!id || seen.has(id) || !treePerson(id)) continue;
    seen.add(id);
    result.push(treePerson(id));
  }
  return result;
}

function treeParentIdsForPeople(ids) {
  const parents = [];
  for (const id of ids || []) {
    for (const family of treeParentFamiliesForPerson(id)) {
      if (family.partner_a_id) parents.push(family.partner_a_id);
      if (family.partner_b_id) parents.push(family.partner_b_id);
    }
  }
  return [...new Set(parents)];
}

function treeChildIdsForPeople(ids) {
  const children = [];
  for (const id of ids || []) {
    for (const family of treeFamiliesForPerson(id)) {
      for (const child of treeChildrenForFamily(family.id)) children.push(child.person.id);
    }
  }
  return [...new Set(children)];
}

function treeGenerationName(distance, direction) {
  const names = {
    1: direction === "up" ? "Eltern" : "Kinder",
    2: direction === "up" ? "Großeltern" : "Enkelkinder",
    3: direction === "up" ? "Urgroßeltern" : "Urenkelkinder",
    4: direction === "up" ? "Ururgroßeltern" : "Ururenkelkinder",
    5: direction === "up" ? "Urururgroßeltern" : "Urururenkelkinder"
  };
  return names[distance] || `${distance}. Generation`;
}

function treeGenerationRow(personIds, rootId, stammlinie, label, extraClass = "") {
  const people = treeUniquePeople(personIds);
  if (!people.length) return null;
  const section = document.createElement("div");
  section.className = `tree-deep-generation ${extraClass}`.trim();

  const title = document.createElement("div");
  title.className = "tree-deep-generation__label";
  title.textContent = label;
  section.appendChild(title);

  const row = document.createElement("div");
  row.className = "tree-generation tree-deep-generation__row";
  row.innerHTML = people.map((person) => treePersonCard(person, rootId, "", stammlinie)).join("");
  section.appendChild(row);
  return section;
}

// ---------- v337: Ahnentafel (Vorfahren-Diagramm) ----------
// Die ausgewählte Person steht links, nach rechts folgen Eltern, Großeltern, Urgroßeltern usw.
// Nummerierung nach Kekulé: 1 = Person, 2 = Vater, 3 = Mutter, 4/5 = Eltern des Vaters, 6/7 = Eltern der Mutter ...
let treePedigreeGens = 4;

function treePedigreeMaße() {
  const klein = window.innerWidth < 900; // iPad hochkant und Handy: schmalere Karten, damit 4 Generationen ohne Wischen passen
  return klein
    ? { cardW: 160, cardH: 62, gap: 34, slotH: 74, head: 72 }
    : { cardW: 198, cardH: 64, gap: 52, slotH: 78, head: 58 };
}

// Eltern einer Person: bevorzugt die biologische Familie; Vater = männlich, Mutter = weiblich.
function treePedigreeParents(personId) {
  const links = treeData.kinder.filter((k) => k.kind_id === personId);
  const link = links.find((k) => !k.beziehungstyp || k.beziehungstyp === "biologisch") || links[0];
  const familie = link ? treeData.familien.find((f) => f.id === link.familie_id) : null;
  if (!familie) return { vater: null, mutter: null };
  const partner = [familie.partner_a_id, familie.partner_b_id].map((id) => (id ? treePerson(id) : null));
  let vater = null;
  let mutter = null;
  for (const p of partner) {
    if (!p) continue;
    const g = treePersonGender(p);
    if (g === "m" && !vater) vater = p;
    else if (g === "w" && !mutter) mutter = p;
  }
  for (const p of partner) {
    if (!p || p === vater || p === mutter) continue;
    if (!vater) vater = p;
    else if (!mutter) mutter = p;
  }
  return { vater, mutter };
}

function treePedigreeCollect(rootId, gens) {
  const knoten = [];
  const wurzel = treePerson(rootId);
  if (!wurzel) return knoten;
  const rec = (person, gen, idx, pfad, rolle) => {
    knoten.push({ gen, idx, person, rolle, kekule: (2 ** gen) + idx });
    if (!person || gen >= gens - 1) return;
    const { vater, mutter } = treePedigreeParents(person.id);
    const neuerPfad = new Set(pfad);
    neuerPfad.add(person.id);
    rec(vater && !neuerPfad.has(vater.id) ? vater : null, gen + 1, idx * 2, neuerPfad, "Vater");
    rec(mutter && !neuerPfad.has(mutter.id) ? mutter : null, gen + 1, idx * 2 + 1, neuerPfad, "Mutter");
  };
  rec(wurzel, 0, 0, new Set(), "");
  return knoten;
}

function treePedigreeNodeHtml(k, m, y, rootId) {
  const style = `left:${k.gen * (m.cardW + m.gap)}px;top:${y - m.cardH / 2}px;width:${m.cardW}px;height:${m.cardH}px`;
  if (!k.person) {
    return `<div class="tree-ped-node tree-ped-node--unknown" style="${style}"><span class="tree-ped-node__name">${escTree(k.rolle)} unbekannt</span><span class="tree-ped-node__nr">${k.kekule}</span></div>`;
  }
  const p = k.person;
  const g = treePersonGender(p);
  const name = treeAnzeigeName(p).name;
  const ledig = String(p.Ledigenname || p.ledigenname || "").trim();
  const jahre = treeYearsText(p);
  const foto = treeData.photos.get(p.id);
  return `<button type="button" class="tree-ped-node tree-ped-node--${g}${p.id === rootId ? " tree-ped-node--root" : ""}" data-tree-person="${escTree(p.id)}" style="${style}">`
    + (foto ? `<span class="tree-ped-node__photo"><img src="${escTree(foto)}" alt=""></span>` : "")
    + `<span class="tree-ped-node__text"><span class="tree-ped-node__name">${escTree(name)}${ledig ? ` <span class="tree-ped-node__maiden">(geb. ${escTree(ledig)})</span>` : ""}</span>${jahre ? `<span class="tree-ped-node__years">${escTree(jahre)}</span>` : ""}</span>`
    + `<span class="tree-ped-node__nr">${k.kekule}</span></button>`;
}

// Antippen = Person als neue Mitte, Doppelklick/Doppeltippen = Personendaten öffnen (wie in der Kartenansicht).
function treeBindPersonInteractions(container) {
  let unterdruecken = false;
  let letzterTipp = { id: null, zeit: 0 };
  container.querySelectorAll("[data-tree-person]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      if (unterdruecken) { unterdruecken = false; event.stopPropagation(); return; }
      const id = el.dataset.treePerson;
      if (!id) return;
      const auswahl = document.getElementById("tree-person-select");
      if (auswahl) auswahl.value = id;
      renderStammbaum(id);
    });
    el.addEventListener("dblclick", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = el.dataset.treePerson;
      if (!id) return;
      const auswahl = document.getElementById("tree-person-select");
      if (auswahl) auswahl.value = id;
      await openPersonDetail(id, { fromTree: true });
    });
    el.addEventListener("pointerup", async (event) => {
      if (event.pointerType !== "touch") return;
      const id = el.dataset.treePerson;
      if (!id) return;
      const jetzt = Date.now();
      if (letzterTipp.id === id && jetzt - letzterTipp.zeit <= 450) {
        letzterTipp = { id: null, zeit: 0 };
        unterdruecken = true;
        event.preventDefault();
        event.stopPropagation();
        const auswahl = document.getElementById("tree-person-select");
        if (auswahl) auswahl.value = id;
        await openPersonDetail(id, { fromTree: true });
      } else {
        letzterTipp = { id, zeit: jetzt };
      }
    });
  });
}

function renderAhnentafel(rootId) {
  const stage = document.getElementById("tree-pedigree-stage");
  const message = document.getElementById("tree-message");
  if (!stage) return;
  stage.innerHTML = "";
  const wurzel = treePerson(rootId);
  if (!wurzel) {
    stage.style.width = "";
    stage.style.height = "";
    stage.innerHTML = '<div class="tree-empty">Bitte eine Person auswählen.</div>';
    return;
  }
  const gens = treePedigreeGens;
  const m = treePedigreeMaße();
  const knoten = treePedigreeCollect(rootId, gens);
  const blatt = 2 ** (gens - 1);
  const breite = gens * m.cardW + (gens - 1) * m.gap;
  const hoehe = m.head + blatt * m.slotH;
  const mitteY = (k) => m.head + ((k.idx + 0.5) * (blatt / 2 ** k.gen)) * m.slotH;
  const nachSchluessel = new Map(knoten.map((k) => [`${k.gen}:${k.idx}`, k]));

  // Verbindungslinien Kind → Eltern
  const pfade = [];
  for (const k of knoten) {
    if (!k.person || k.gen >= gens - 1) continue;
    const vater = nachSchluessel.get(`${k.gen + 1}:${k.idx * 2}`);
    const mutter = nachSchluessel.get(`${k.gen + 1}:${k.idx * 2 + 1}`);
    if (!vater || !mutter) continue;
    const x1 = k.gen * (m.cardW + m.gap) + m.cardW;
    const x2 = (k.gen + 1) * (m.cardW + m.gap);
    const xm = x1 + m.gap / 2;
    const y1 = mitteY(k);
    const yv = mitteY(vater);
    const ym = mitteY(mutter);
    pfade.push(`M${x1} ${y1}H${xm}M${xm} ${yv}V${ym}M${xm} ${yv}H${x2}M${xm} ${ym}H${x2}`);
  }

  const bekannt = knoten.filter((k) => k.person && k.gen > 0).length;
  const moeglich = 2 ** gens - 2;
  const spaltenKopf = Array.from({ length: gens }, (_, g) =>
    `<div class="tree-ped-colhead" style="left:${g * (m.cardW + m.gap)}px;top:${m.head - 26}px;width:${m.cardW}px">${g === 0 ? "Ausgangsperson" : escTree(treeGenerationName(g, "up"))}</div>`).join("");
  const karten = knoten.map((k) => treePedigreeNodeHtml(k, m, mitteY(k), rootId)).join("");

  stage.style.width = `${breite}px`;
  stage.style.height = `${hoehe}px`;
  stage.innerHTML = `<div class="tree-ped-caption" style="max-width:${Math.min(breite, 380)}px">Ahnentafel von <strong>${escTree(treePersonLabel(rootId))}</strong> · ${bekannt} von ${moeglich} Vorfahren in ${gens} Generationen erfasst${treeActivePreset?.label ? ` · Linie: ${escTree(treeActivePreset.label)}` : ""}</div>`
    + spaltenKopf
    + `<svg class="tree-ped-lines" width="${breite}" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}" aria-hidden="true"><path d="${pfade.join("")}"/></svg>`
    + karten;
  treeBindPersonInteractions(stage);
  updateTreeZoom();
  if (message) message.textContent = bekannt === 0 ? "Für diese Person sind keine Eltern erfasst." : "";
}

// ---------- v338: Nachkommenliste (einklappbar) ----------
function treeDescendants(personId, pfad = new Set()) {
  const person = treePerson(personId);
  const neuerPfad = new Set(pfad);
  neuerPfad.add(personId);
  const familien = [];
  let anzahl = 0;
  for (const familie of treeFamiliesForPerson(personId)) {
    const partnerId = familie.partner_a_id === personId ? familie.partner_b_id : familie.partner_a_id;
    const kinder = [];
    for (const kind of treeChildrenForFamily(familie.id)) {
      if (neuerPfad.has(kind.kind_id)) continue;   // Schleifenschutz bei fehlerhaften Daten
      const unter = treeDescendants(kind.kind_id, neuerPfad);
      kinder.push(unter);
      anzahl += 1 + unter.anzahl;
    }
    familien.push({ partner: partnerId ? treePerson(partnerId) : null, kinder });
  }
  return { person, familien, anzahl };
}

function treeDescNameHtml(p) {
  const name = treeAnzeigeName(p).name;
  const ledig = String(p.Ledigenname || p.ledigenname || "").trim();
  return `${escTree(name)}${ledig ? ` <span class="tree-desc__maiden">(geb. ${escTree(ledig)})</span>` : ""}`;
}

function treeDescNodeHtml(knoten, tiefe) {
  const p = knoten.person;
  if (!p) return "";
  const g = treePersonGender(p);
  const jahre = treeYearsText(p);
  const kopf = `<span class="tree-desc__dot tree-desc__dot--${g}"></span>`
    + `<span class="tree-desc__text"><span class="tree-desc__name">${treeDescNameHtml(p)}</span>${jahre ? `<span class="tree-desc__years">${escTree(jahre)}</span>` : ""}</span>`
    + (knoten.anzahl ? `<span class="tree-desc__count" title="Nachkommen insgesamt">${knoten.anzahl}</span>` : "");
  const partnerZeile = (partner) => partner
    ? `<div class="tree-desc__partner">⚭ ${treeDescNameHtml(partner)}${treeYearsText(partner) ? ` · ${escTree(treeYearsText(partner))}` : ""}</div>`
    : `<div class="tree-desc__partner">⚭ Partner unbekannt</div>`;
  const hatKinder = knoten.familien.some((f) => f.kinder.length);
  if (!hatKinder) {
    const partner = knoten.familien.filter((f) => f.partner).map((f) => partnerZeile(f.partner)).join("");
    return `<li class="tree-desc__item"><div class="tree-desc__row tree-desc__row--leaf" data-tree-open="${escTree(p.id)}" role="button" tabindex="0">${kopf}</div>${partner ? `<div class="tree-desc__leafinfo">${partner}</div>` : ""}</li>`;
  }
  const teile = knoten.familien.map((f) => {
    if (!f.kinder.length && !f.partner) return "";
    const kinder = f.kinder.length ? `<ul class="tree-desc__list">${f.kinder.map((k) => treeDescNodeHtml(k, tiefe + 1)).join("")}</ul>` : "";
    return partnerZeile(f.partner) + kinder;
  }).join("");
  return `<li class="tree-desc__item"><details${tiefe < 2 ? " open" : ""}><summary class="tree-desc__row">${kopf}<button type="button" class="tree-desc__open" data-tree-open="${escTree(p.id)}" aria-label="Personendaten öffnen" title="Personendaten öffnen">›</button></summary><div class="tree-desc__body">${teile}</div></details></li>`;
}

function renderNachkommen(rootId) {
  const stage = document.getElementById("tree-descendants-stage");
  const message = document.getElementById("tree-message");
  if (!stage) return;
  const wurzel = treePerson(rootId);
  if (!wurzel) {
    stage.innerHTML = '<div class="tree-empty">Bitte eine Person auswählen.</div>';
    return;
  }
  const baum = treeDescendants(rootId);
  const linie = treeActivePreset?.label ? ` · Linie: ${escTree(treeActivePreset.label)}` : "";
  const titel = baum.anzahl
    ? `Nachkommen von <strong>${escTree(treePersonLabel(rootId))}</strong> · ${baum.anzahl} ${baum.anzahl === 1 ? "Person" : "Personen"}${linie}`
    : `<strong>${escTree(treePersonLabel(rootId))}</strong> · keine Nachkommen erfasst${linie}`;
  stage.innerHTML = `<div class="tree-desc__caption">${titel}</div><ul class="tree-desc__list tree-desc__list--root">${treeDescNodeHtml(baum, 0)}</ul>`;
  if (message) message.textContent = "";
}

function initTreeDescendants() {
  const stage = document.getElementById("tree-descendants-stage");
  if (!stage) return;
  const oeffnen = async (event, ziel) => {
    event.preventDefault();
    event.stopPropagation();
    const id = ziel.dataset.treeOpen;
    if (!id) return;
    const auswahl = document.getElementById("tree-person-select");
    if (auswahl) auswahl.value = id;
    await openPersonDetail(id, { fromTree: true });
  };
  stage.addEventListener("click", (event) => {
    const ziel = event.target.closest("[data-tree-open]");
    if (ziel) oeffnen(event, ziel);
  });
  stage.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const ziel = event.target.closest(".tree-desc__row--leaf[data-tree-open]");
    if (ziel) oeffnen(event, ziel);
  });
  document.getElementById("tree-list-expand")?.addEventListener("click", () => stage.querySelectorAll("details").forEach((d) => { d.open = true; }));
  document.getElementById("tree-list-collapse")?.addEventListener("click", () => {
    stage.querySelectorAll("details").forEach((d, i) => { d.open = i === 0; });
  });
}

function renderStammbaum(rootId) {
  treeCousinsRefreshIfOpen(rootId);
  if (treeActivePreset && !treeFilterAktiv) {
    treeFilterAktiv = true;
    const originalFamilien = treeData.familien;
    const originalKinder = treeData.kinder;
    try {
      const teil = treePresetFilter(treeActivePreset.roots, treeActivePreset.direction);
      treeData.familien = teil.familien;
      treeData.kinder = teil.kinder;
      renderStammbaum(rootId);
    } finally {
      treeData.familien = originalFamilien;
      treeData.kinder = originalKinder;
      treeFilterAktiv = false;
    }
    return;
  }
  if (treeViewMode === "classic") { renderKlassischerStammbaum(rootId); return; }
  if (treeViewMode === "pedigree") { renderAhnentafel(rootId); return; }
  if (treeViewMode === "descendants") { renderNachkommen(rootId); return; }
  if (treeViewMode === "tree3d") { renderBaum3D(rootId); return; }
  const stage = document.getElementById("tree-stage");
  const message = document.getElementById("tree-message");
  if (!stage) return;
  stage.innerHTML = "";
  const root = treePerson(rootId);
  if (!root) {
    stage.innerHTML = '<div class="tree-empty">Bitte eine Person auswählen.</div>';
    return;
  }

  const stammlinie = treeMaleAncestorSurname(rootId) || String(root.nachname || "").trim();
  const stammlinieFarbe = treeLineColorClass(stammlinie);

  const legend = document.createElement("div");
  legend.className = `tree-line-legend ${stammlinieFarbe}`;
  legend.innerHTML = `<span class="tree-line-legend__dot" aria-hidden="true"></span><span>Stammlinie: <strong>${escTree(stammlinie || "unbekannt")}</strong></span>`;
  stage.appendChild(legend);

  // Die Stammlinienansicht zeigt mindestens fünf Generationsebenen:
  // zwei Ebenen oberhalb, die ausgewählte Person in der Mitte und zwei Ebenen
  // darunter. Wenn weitere Eltern oder Nachkommen vorhanden sind, werden diese
  // ebenfalls angezeigt. Bereits besuchte Personen verhindern Schleifen.
  const MAX_GENERATIONS = 12;
  const ancestorLevels = [];
  const descendantLevels = [];

  let currentUp = [rootId];
  const seenUp = new Set([rootId]);
  for (let distance = 1; distance <= MAX_GENERATIONS; distance += 1) {
    const next = treeUniquePeople(treeParentIdsForPeople(currentUp))
      .map((p) => p.id)
      .filter((id) => !seenUp.has(id));
    if (!next.length) break;
    next.forEach((id) => seenUp.add(id));
    ancestorLevels.push(next);
    currentUp = next;
  }

  let currentDown = [rootId];
  const seenDown = new Set([rootId]);
  for (let distance = 1; distance <= MAX_GENERATIONS; distance += 1) {
    const next = treeUniquePeople(treeChildIdsForPeople(currentDown))
      .map((p) => p.id)
      .filter((id) => !seenDown.has(id));
    if (!next.length) break;
    next.forEach((id) => seenDown.add(id));
    descendantLevels.push(next);
    currentDown = next;
  }

  // Älteste Vorfahren zuerst, damit der Stammbaum von oben nach unten lesbar ist.
  for (let i = ancestorLevels.length - 1; i >= 0; i -= 1) {
    const distance = i + 1;
    const section = treeGenerationRow(
      ancestorLevels[i],
      rootId,
      stammlinie,
      treeGenerationName(distance, "up"),
      "tree-deep-generation--ancestor"
    );
    if (section) stage.appendChild(section);
  }

  const rootSection = document.createElement("div");
  rootSection.className = "tree-root-generation";
  const rootLabel = document.createElement("div");
  rootLabel.className = "tree-deep-generation__label tree-root-generation__label";
  rootLabel.textContent = `${root.vorname || ""} ${root.nachname || ""}`.trim();
  rootSection.appendChild(rootLabel);

  const rootFamilies = treeFamiliesForPerson(rootId);
  const visibleRootFamilies = rootFamilies.filter((f) => treeChildrenForFamily(f.id).length || f.partner_a_id === rootId || f.partner_b_id === rootId);
  if (visibleRootFamilies.length) {
    for (const f of visibleRootFamilies) {
      const block = document.createElement("div");
      block.className = "tree-family-block tree-root-family-block";
      const otherId = [f.partner_a_id, f.partner_b_id].find((id) => id && id !== rootId);
      const partner = treePerson(otherId);
      const isMarriage = String(f.familientyp || "").toLowerCase() === "ehe";
      const partnerCard = partner
        ? treePersonCard(partner, null, "", stammlinie)
        : `<div class="tree-node"><span class="tree-node__placeholder">?</span><span class="tree-node__name">Unbekannter Partner</span></div>`;
      const relationType = f.familientyp || "Partnerschaft";
      block.innerHTML = `
        <div class="tree-couple">
          ${treePersonCard(root, rootId, "", stammlinie)}
          <div class="tree-relationship ${isMarriage ? "tree-relationship--marriage" : ""}" aria-label="${escTree(relationType)}">
            <span class="tree-marriage__label">${escTree(relationType)}</span>
            ${isMarriage ? `<span class="tree-marriage__rings" aria-hidden="true">◯◯</span>` : `<span class="tree-partner-link" aria-hidden="true"></span>`}
          </div>
          ${partnerCard}
        </div>`;
      rootSection.appendChild(block);
    }
  } else {
    const row = document.createElement("div");
    row.className = "tree-generation tree-deep-generation__row";
    row.innerHTML = treePersonCard(root, rootId, "", stammlinie);
    rootSection.appendChild(row);
  }
  stage.appendChild(rootSection);

  for (let i = 0; i < descendantLevels.length; i += 1) {
    const distance = i + 1;
    const section = treeGenerationRow(
      descendantLevels[i],
      rootId,
      stammlinie,
      treeGenerationName(distance, "down"),
      "tree-deep-generation--descendant"
    );
    if (section) stage.appendChild(section);
  }

  let suppressNextTreeClick = false;
  let lastTreeTouch = { id: null, time: 0 };

  stage.querySelectorAll("[data-tree-person]").forEach((el) => {
    const openTreePerson = async (event) => {
      if (suppressNextTreeClick) {
        suppressNextTreeClick = false;
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event) event.preventDefault();
      const id = el.dataset.treePerson;
      if (!id) return;
      const select = document.getElementById("tree-person-select");
      if (select) select.value = id;
      renderStammbaum(id);
    };

    el.addEventListener("click", openTreePerson);

    // Desktop: Doppelklick.
    el.addEventListener("dblclick", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = el.dataset.treePerson;
      if (!id) return;
      const select = document.getElementById("tree-person-select");
      if (select) select.value = id;
      await openPersonDetail(id, { fromTree: true });
    });

    // iPad/iPhone: schneller zweiter Fingertipp = Doppelklick.
    el.addEventListener("pointerup", async (event) => {
      if (event.pointerType !== "touch") return;
      const id = el.dataset.treePerson;
      if (!id) return;
      const now = Date.now();
      const isDoubleTap = lastTreeTouch.id === id && (now - lastTreeTouch.time) <= 450;
      if (isDoubleTap) {
        lastTreeTouch = { id: null, time: 0 };
        suppressNextTreeClick = true;
        event.preventDefault();
        event.stopPropagation();
        const select = document.getElementById("tree-person-select");
        if (select) select.value = id;
        await openPersonDetail(id, { fromTree: true });
      } else {
        lastTreeTouch = { id, time: now };
      }
    });
  });
  if (message) message.textContent = "";
}


function treePersonGender(person) {
  // Geschlecht ist optional. Vorhandene Werte werden für präzise
  // Verwandtschaftsbezeichnungen genutzt; fehlende Werte bleiben neutral.
  const raw = String(person?.geschlecht || "").trim().toLocaleLowerCase("de");
  if (["m", "mann", "männlich", "maennlich", "männliches", "male"].includes(raw)) return "m";
  if (["w", "f", "frau", "weiblich", "weibliches", "female"].includes(raw)) return "w";
  return "u";
}

let treeRelationshipSelection = { personAId: null, personBId: null };

function treePersonLabel(id) {
  const p = treePerson(id);
  if (!p) return "Unbekannt";
  const base = `${p.vorname || ""} ${p.nachname || ""}`.trim();
  const ledigenname = String(p.Ledigenname || p.ledigenname || p.geburtsname || "").trim();
  const nachname = String(p.nachname || "").trim();
  return ledigenname
    ? `${base}, geb. ${ledigenname}`
    : base;
}

function treeRelationshipModel() {
  const parentMap = new Map();
  const childMap = new Map();
  const add = (map, key, value) => {
    if (!key || !value || key === value) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };

  // Das Verwandtschaftsmodell arbeitet ausschließlich mit echten
  // Eltern-Kind-Verbindungen. Ehe/Partnerschaft wird separat behandelt.
  for (const family of treeData.familien || []) {
    const parents = [family.partner_a_id, family.partner_b_id].filter(Boolean);
    if (!parents.length) continue;
    for (const childLink of treeData.kinder.filter((k) => k.familie_id === family.id)) {
      const childId = childLink.kind_id;
      if (!childId || !treePerson(childId)) continue;
      for (const parentId of parents) {
        if (!treePerson(parentId)) continue;
        add(parentMap, childId, parentId);
        add(childMap, parentId, childId);
      }
    }
  }
  return { parentMap, childMap };
}

function treeAncestorDistances(startId, model) {
  const distances = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    const distance = distances.get(id) || 0;
    for (const parentId of model.parentMap.get(id) || []) {
      if (distances.has(parentId)) continue;
      distances.set(parentId, distance + 1);
      queue.push(parentId);
    }
  }
  return distances;
}

function treeChooseCommonAncestor(aId, bId, model) {
  const aAncestors = treeAncestorDistances(aId, model);
  const bAncestors = treeAncestorDistances(bId, model);
  const candidates = [];
  for (const [ancestorId, aDistance] of aAncestors) {
    if (ancestorId === aId || ancestorId === bId) continue;
    const bDistance = bAncestors.get(ancestorId);
    if (bDistance == null) continue;
    candidates.push({ ancestorId, aDistance, bDistance });
  }
  candidates.sort((x, y) =>
    (x.aDistance + x.bDistance) - (y.aDistance + y.bDistance) ||
    Math.max(x.aDistance, x.bDistance) - Math.max(y.aDistance, y.bDistance)
  );
  return candidates[0] || null;
}

function treeParentPathToAncestor(startId, ancestorId, model) {
  if (startId === ancestorId) return [];
  const queue = [startId];
  const visited = new Set([startId]);
  const prev = new Map();
  while (queue.length) {
    const id = queue.shift();
    for (const parentId of model.parentMap.get(id) || []) {
      if (visited.has(parentId)) continue;
      visited.add(parentId);
      prev.set(parentId, id);
      if (parentId === ancestorId) {
        const ids = [];
        let cur = ancestorId;
        while (cur !== startId) {
          ids.unshift(cur);
          cur = prev.get(cur);
          if (!cur) return null;
        }
        return ids;
      }
      queue.push(parentId);
    }
  }
  return null;
}

function treeSiblingPath(aId, bId, model) {
  const aParents = model.parentMap.get(aId) || new Set();
  const bParents = model.parentMap.get(bId) || new Set();
  for (const parentId of aParents) {
    if (bParents.has(parentId)) return { parentId };
  }
  return null;
}

function treeBloodRelationFromDistances(aId, bId, aDistance, bDistance) {
  const target = treePerson(bId);
  const targetGender = treePersonGender(target);
  const source = treePerson(aId);
  const sourceGender = treePersonGender(source);
  const word = (male, female) => targetGender === "m" ? male : targetGender === "w" ? female : male;
  const sourceWord = (male, female) => sourceGender === "m" ? male : sourceGender === "w" ? female : male;

  if (aDistance === 1 && bDistance === 1) return sourceWord("Bruder", "Schwester");

  // A ist direkter Vorfahr von B.
  if (aDistance === 0) {
    if (bDistance === 1) return sourceWord("Vater", "Mutter");
    if (bDistance === 2) return sourceWord("Großvater", "Großmutter");
    return `${"Ur".repeat(bDistance - 2)}groß${sourceWord("vater", "mutter")}`;
  }

  // A ist direkter Nachkomme von B.
  if (bDistance === 0) {
    if (aDistance === 1) return sourceWord("Sohn", "Tochter");
    if (aDistance === 2) return sourceWord("Enkel", "Enkelin");
    return `${"Ur".repeat(aDistance - 2)}enkel${sourceGender === "w" ? "in" : ""}`;
  }

  // Seitenlinie: gleicher gemeinsamer Vorfahr.
  if (aDistance === 1 && bDistance >= 2) {
    const grade = bDistance - 2;
    if (grade === 0) return sourceWord("Onkel", "Tante");
    if (grade === 1) return sourceWord("Großonkel (1. Grades)", "Großtante (1. Grades)");
    return sourceWord(`${"Ur".repeat(grade - 1)}großonkel (${grade}. Grades)`, `${"Ur".repeat(grade - 1)}großtante (${grade}. Grades)`);
  }

  if (bDistance === 1 && aDistance >= 2) {
    const grade = aDistance - 2;
    if (grade === 0) return sourceWord("Neffe", "Nichte");
    if (grade === 1) return sourceWord("Großneffe (1. Grades)", "Großnichte (1. Grades)");
    return sourceWord(`${"Ur".repeat(grade - 1)}großneffe (${grade}. Grades)`, `${"Ur".repeat(grade - 1)}großnichte (${grade}. Grades)`);
  }

  if (aDistance >= 2 && bDistance >= 2) {
    const cousinDegree = Math.min(aDistance, bDistance) - 1;
    const removed = Math.abs(aDistance - bDistance);
    const base = `Cousin/Cousine ${cousinDegree}. Grades`;
    return removed ? `${base}, ${removed} Generation${removed === 1 ? "" : "en"} entfernt` : base;
  }
  return null;
}

function treeBloodRelationship(aId, bId, model) {
  const sibling = treeSiblingPath(aId, bId, model);
  if (sibling) {
    return {
      relation: treeGenderWord(aId, "Bruder", "Schwester"),
      commonAncestor: sibling.parentId,
      aDistance: 1,
      bDistance: 1
    };
  }

  const aAncestors = treeAncestorDistances(aId, model);
  const bAncestors = treeAncestorDistances(bId, model);

  // Direkte Vorfahren/Nachkommen müssen vor dem gemeinsamen Vorfahren geprüft werden.
  if (aAncestors.has(bId)) {
    const distance = aAncestors.get(bId);
    return { relation: treeBloodRelationFromDistances(aId, bId, distance, 0), commonAncestor: bId, aDistance: distance, bDistance: 0 };
  }
  if (bAncestors.has(aId)) {
    const distance = bAncestors.get(aId);
    return { relation: treeBloodRelationFromDistances(aId, bId, 0, distance), commonAncestor: aId, aDistance: 0, bDistance: distance };
  }

  const common = treeChooseCommonAncestor(aId, bId, model);
  if (!common) return null;
  return {
    relation: treeBloodRelationFromDistances(aId, bId, common.aDistance, common.bDistance),
    commonAncestor: common.ancestorId,
    aDistance: common.aDistance,
    bDistance: common.bDistance
  };
}

function treeRelationshipGraph() {
  // Kompatibilität für die bestehende UI und für angeheiratete Beziehungen.
  const graph = new Map();
  const add = (a, b, type) => {
    if (!a || !b || a === b) return;
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a).push({ id: b, type });
  };
  for (const f of treeData.familien || []) {
    const a = f.partner_a_id, b = f.partner_b_id;
    if (a && b) { add(a, b, "spouse"); add(b, a, "spouse"); }
    for (const k of treeChildrenForFamily(f.id)) {
      const child = k.person?.id || k.kind_id;
      if (!child) continue;
      if (a) { add(child, a, "parent"); add(a, child, "child"); }
      if (b) { add(child, b, "parent"); add(b, child, "child"); }
    }
  }
  return graph;
}

function treeFindRelationshipPath(startId, targetId) {
  if (!startId || !targetId) return null;
  if (startId === targetId) return [];
  const graph = treeRelationshipGraph();
  const queue = [startId];
  const visited = new Set([startId]);
  const prev = new Map();
  while (queue.length) {
    const id = queue.shift();
    for (const edge of graph.get(id) || []) {
      if (visited.has(edge.id)) continue;
      visited.add(edge.id);
      prev.set(edge.id, { from: id, type: edge.type });
      if (edge.id === targetId) {
        const path = [];
        let cur = targetId;
        while (cur !== startId) {
          const step = prev.get(cur);
          if (!step) return null;
          path.unshift({ from: step.from, to: cur, type: step.type });
          cur = step.from;
        }
        return path;
      }
      queue.push(edge.id);
    }
  }
  return null;
}

function treeGenderWord(id, male, female, neutral = "Person") {
  const g = treePersonGender(treePerson(id));
  return g === "m" ? male : g === "w" ? female : neutral;
}

function treeInLawRelation(path) {
  const spouseIndexes = path.map((e, i) => e.type === "spouse" ? i : -1).filter(i => i >= 0);
  if (!spouseIndexes.length) return null;
  if (path.length === 1) return treeGenderWord(path[0].to, "Ehemann", "Ehefrau");
  if (path.length === 2) {
    const spouseEdge = path.find(e => e.type === "spouse");
    const other = path.find(e => e !== spouseEdge);
    if (other?.type === "parent") return treeGenderWord(path[path.length - 1].to, "Schwiegersohn", "Schwiegertochter");
    if (other?.type === "child") return treeGenderWord(path[path.length - 1].to, "Schwiegervater", "Schwiegermutter");
  }
  const bloodOnly = path.filter(e => e.type !== "spouse");
  if (bloodOnly.length === 2 && bloodOnly.some(e => e.type === "parent") && bloodOnly.some(e => e.type === "child")) {
    return treeGenderWord(path[path.length - 1].to, "Schwager", "Schwägerin");
  }
  if (bloodOnly.length === 1) {
    const e = bloodOnly[0];
    if (e.type === "parent") return treeGenderWord(path[path.length - 1].to, "Schwiegervater", "Schwiegermutter");
    if (e.type === "child") return treeGenderWord(path[path.length - 1].to, "Schwiegersohn", "Schwiegertochter");
  }
  return "angeheiratet verwandt";
}

function treeRelationshipStepWord(fromId, edgeType, toId) {
  if (edgeType === "sibling") {
    return treeGenderWord(fromId, "Bruder", "Schwester", "Geschwister") + " von";
  }

  if (edgeType === "spouse") {
    return treeGenderWord(fromId, "Ehemann", "Ehefrau", "Partner/in") + " von";
  }

  // parent: from = Kind, to = Elternteil. Das Geschlecht des Kindes
  // bestimmt Sohn/Tochter; ohne Angabe bleibt die Formulierung sinnvoll.
  if (edgeType === "parent") {
    return treeGenderWord(fromId, "Sohn", "Tochter", "Kind") + " von";
  }

  // child: from = Elternteil, to = Kind. Das Geschlecht des Elternteils
  // bestimmt Vater/Mutter; ohne Angabe wird neutral formuliert.
  if (edgeType === "child") {
    return treeGenderWord(fromId, "Vater", "Mutter", "Elternteil") + " von";
  }

  return "verwandt mit";
}

function treeBuildBloodPath(aId, bId, model, blood) {
  if (!blood) return null;
  if (blood.aDistance === 1 && blood.bDistance === 1) {
    return [{ from: aId, to: bId, type: "sibling" }];
  }

  const aToAncestor = treeParentPathToAncestor(aId, blood.commonAncestor, model) || [];
  const bToAncestor = treeParentPathToAncestor(bId, blood.commonAncestor, model) || [];

  // Der Pfad soll aus Sicht der gewählten Startperson verlaufen.
  // Bei einer Seitenlinie wird deshalb nicht über den gemeinsamen Vorfahren
  // „hinweg“ gezeichnet. Stattdessen verbinden wir die beiden Äste über
  // deren Geschwister auf der Ebene direkt unterhalb des gemeinsamen
  // Vorfahren. Dadurch entsteht z. B.:
  //
  // Oskar → Paula → Hubert → Andreas
  //
  // und nicht eine technisch richtige, aber für den Benutzer verwirrende
  // Darstellung über den gemeinsamen Großeltern-Knoten.
  const path = [];
  let current = aId;

  // Direkter Vorfahren-/Nachkommenpfad.
  // Der gemeinsame Knoten ist bei einem direkten Vorfahren bereits
  // die Startperson und darf deshalb niemals nochmals als Pfadknoten
  // eingefügt werden.
  if (blood.aDistance === 0 || blood.bDistance === 0) {
    if (blood.aDistance === 0) {
      const childPath = [...bToAncestor]
        .filter((id) => id !== blood.commonAncestor)
        .reverse();

      for (const childId of childPath) {
        if (childId === current) continue;
        path.push({ from: current, to: childId, type: "child" });
        current = childId;
      }

      if (current !== bId) {
        path.push({ from: current, to: bId, type: "child" });
      }
    } else {
      for (const parentId of aToAncestor) {
        if (parentId === blood.commonAncestor && parentId === current) continue;
        path.push({ from: current, to: parentId, type: "parent" });
        current = parentId;
      }
    }
    return path;
  }

  // Beide Personen liegen in unterschiedlichen Ästen desselben Vorfahren.
  // Zuerst von A bis zum Geschwisterknoten des B-Zweigs.
  const aBranch = aToAncestor.length >= 2 ? aToAncestor[aToAncestor.length - 2] : aId;
  const bBranch = bToAncestor.length >= 2 ? bToAncestor[bToAncestor.length - 2] : bId;

  if (aBranch && bBranch && aBranch !== bBranch) {
    // Von A nur bis zum ersten Knoten unterhalb des gemeinsamen Vorfahren.
    // Wichtig: Der gemeinsame Vorfahr selbst darf NICHT in den sichtbaren
    // Verwandtschaftspfad aufgenommen werden. Beispiel:
    // Oskar -> Paula -> Hubert -> Andreas, nicht Oskar -> Christian -> ...
    for (const parentId of aToAncestor) {
      if (parentId === blood.commonAncestor) break;
      path.push({ from: current, to: parentId, type: "parent" });
      current = parentId;
    }

    // Die beiden Knoten direkt unterhalb des gemeinsamen Vorfahren sind
    // Geschwister. Bei einem direkten Geschwisterfall ist A selbst aBranch.
    if (current === aBranch) {
      path.push({ from: current, to: bBranch, type: "sibling" });
      current = bBranch;
    } else {
      return null;
    }

    // Vom Geschwisterknoten des B-Zweigs nach unten bis zu B.
    const bDown = [...bToAncestor].reverse().filter(
      (id) => id !== blood.commonAncestor && id !== bBranch
    );
    for (const childId of bDown) {
      path.push({ from: current, to: childId, type: "child" });
      current = childId;
    }

    // Nur anhängen, wenn B nicht bereits erreicht wurde. Dadurch kann ein
    // Knoten niemals doppelt im sichtbaren Pfad erscheinen.
    if (current !== bId) {
      path.push({ from: current, to: bId, type: "child" });
    }
    return path;
  }

  // Fallback für ungewöhnliche Graphen: sauberer gerichteter Pfad.
  for (const parentId of aToAncestor) {
    path.push({ from: current, to: parentId, type: "parent" });
    current = parentId;
  }
  const down = [...bToAncestor].reverse();
  for (const childId of down) {
    if (childId === blood.commonAncestor || childId === current) continue;
    path.push({ from: current, to: childId, type: "child" });
    current = childId;
  }
  path.push({ from: current, to: bId, type: "child" });
  return path;
}

function treeHumanRelationshipPath(aId, path) {
  if (!path || !path.length) return "";
  const steps = [];
  let currentId = aId;
  for (const e of path) {
    steps.push(`${treeRelationshipStepWord(currentId, e.type, e.to)} ${treePersonLabel(e.to)}`);
    currentId = e.to;
  }
  return steps.join(" → ");
}

function treeRelationshipPathGraphic(aId, path) {
  if (!path || !path.length) return "";
  const items = [{ id: aId, label: treePersonLabel(aId) }];
  let currentId = aId;
  for (const edge of path) {
    const relationLabel = treeRelationshipStepWord(currentId, edge.type, edge.to);
    items.push({ id: edge.to, label: treePersonLabel(edge.to), relationLabel });
    currentId = edge.to;
  }
  return `<div class="tree-relationship-graphic" aria-label="Grafischer Verwandtschaftspfad">${items.map((item, index) => {
    const person = treePerson(item.id);
    const dates = person ? [person.geburtsjahr, person.sterbejahr].filter(Boolean).join("–") : "";
    const card = `<div class="tree-relationship-node" data-tree-relation-node="${escTree(item.id)}"><strong>${escTree(item.label)}</strong>${dates ? `<small>${escTree(String(dates))}</small>` : ""}</div>`;
    if (index === 0) return card;
    return `<div class="tree-relationship-arrow" aria-hidden="true"><span>${escTree(item.relationLabel)}</span><b>↓</b></div>${card}`;
  }).join("")}</div>`;
}

function treeRelationshipSentence(aId, bId, relation) {
  const a = treePersonLabel(aId);
  const b = treePersonLabel(bId);
  if (!relation || relation === "dieselbe Person") return relation ? `${a} und ${b} sind dieselbe Person.` : "";
  return `${a} ist ${relation.toLowerCase()} von ${b}.`;
}

function treeRelationshipResult(aId, bId) {
  if (!aId || !bId) return null;
  if (aId === bId) return { relation: "dieselbe Person", path: [] };

  const model = treeRelationshipModel();
  const blood = treeBloodRelationship(aId, bId, model);
  if (blood?.relation) {
    const path = treeBuildBloodPath(aId, bId, model, blood);
    return {
      relation: blood.relation,
      path: path || [],
      sentence: treeRelationshipSentence(aId, bId, blood.relation),
      pathText: treeHumanRelationshipPath(aId, path || [])
    };
  }

  // Falls keine Blutsverwandtschaft existiert, bleibt die bisherige
  // angeheiratete Ermittlung erhalten.
  const path = treeFindRelationshipPath(aId, bId);
  if (!path) return { relation: "Keine gespeicherte Verwandtschaft gefunden", path: null };
  const relation = treeInLawRelation(path) || "verwandt (genauer Verwandtschaftsgrad nicht eindeutig bestimmbar)";
  return {
    relation,
    path,
    sentence: treeRelationshipSentence(aId, bId, relation),
    pathText: treeHumanRelationshipPath(aId, path)
  };
}

function fillTreeRelationshipSelects() {
  const selects = [document.getElementById("tree-relation-person-a"), document.getElementById("tree-relation-person-b")].filter(Boolean);
  const current = selects.map(s => s.value);
  const personen = [...(treeData.personen || [])].sort(personenAuswahlSortierung);
  for (const select of selects) {
    select.innerHTML = '<option value="">— Person auswählen —</option>';
    for (const p of personen) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = treePersonSearchText(p);
      select.appendChild(opt);
    }
  }
  selects.forEach((s, i) => { if (current[i] && treePerson(current[i])) s.value = current[i]; });
  if (typeof treeRelationSyncInputs === "function") treeRelationSyncInputs();
}

// ---------- v327: Cousins und Cousinen der Ausgangsperson ----------
function treeYearsText(person) {
  return [
    person.geburtsdatum ? person.geburtsdatum.split("-")[0] : (person.geburtsjahr ? String(person.geburtsjahr) : ""),
    person.sterbedatum ? person.sterbedatum.split("-")[0] : (person.sterbejahr ? String(person.sterbejahr) : "")
  ].filter(Boolean).join(" – ");
}

// Cousins/Cousinen 1. Grades: Kinder der Geschwister der Eltern, gruppiert nach Onkel/Tante.
// Geschwister, die nur ein Elternteil gemeinsam haben (Halbgeschwister), werden mitgeführt und markiert.
function treeBirthSortKey(person) {
  return person ? (person.geburtsdatum || (person.geburtsjahr ? String(person.geburtsjahr) : "") || "9999") : "9999";
}

function treeCousinsOf(personId) {
  const parentIds = new Set();
  for (const fam of treeParentFamiliesForPerson(personId)) {
    [fam.partner_a_id, fam.partner_b_id].filter(Boolean).forEach((id) => parentIds.add(id));
  }
  if (!parentIds.size) return { parents: 0, gruppen: [], ohneKinder: [], personen: [] };

  // Onkel/Tanten: Geschwister der Eltern
  const uncles = new Map(); // id -> { halb, eltern:Set }
  for (const parentId of parentIds) {
    const grandFamilies = treeParentFamiliesForPerson(parentId);
    const grandFamilyIds = new Set(grandFamilies.map((f) => f.id));
    const grandIds = new Set();
    grandFamilies.forEach((f) => [f.partner_a_id, f.partner_b_id].filter(Boolean).forEach((id) => grandIds.add(id)));
    if (!grandIds.size) continue;
    for (const fam of treeData.familien) {
      if (!grandIds.has(fam.partner_a_id) && !grandIds.has(fam.partner_b_id)) continue;
      const halb = !grandFamilyIds.has(fam.id);
      for (const kind of treeChildrenForFamily(fam.id)) {
        const uncleId = kind.kind_id;
        if (parentIds.has(uncleId) || uncleId === personId) continue;
        const vorhanden = uncles.get(uncleId);
        if (!vorhanden) uncles.set(uncleId, { halb, eltern: new Set([parentId]) });
        else { vorhanden.eltern.add(parentId); if (vorhanden.halb && !halb) vorhanden.halb = false; }
      }
    }
  }

  // Eigene Geschwister sind keine Cousins
  const ausschliessen = new Set([personId]);
  for (const fam of treeData.familien) {
    if (parentIds.has(fam.partner_a_id) || parentIds.has(fam.partner_b_id)) {
      treeChildrenForFamily(fam.id).forEach((k) => ausschliessen.add(k.kind_id));
    }
  }

  const nachName = (p) => `${p?.nachname || ""} ${p?.vorname || ""}`;
  const sortierer = (x, y) => treeBirthSortKey(x).localeCompare(treeBirthSortKey(y))
    || nachName(x).localeCompare(nachName(y), "de", { sensitivity: "base" });

  const gruppen = [];
  const ohneKinder = [];
  const einzigartig = new Map();
  for (const [uncleId, info] of uncles) {
    const onkelTante = treePerson(uncleId);
    if (!onkelTante) continue;
    const kinder = new Map();
    for (const fam of treeFamiliesForPerson(uncleId)) {
      for (const kind of treeChildrenForFamily(fam.id)) {
        if (ausschliessen.has(kind.kind_id) || !kind.person) continue;
        kinder.set(kind.kind_id, kind.person);
      }
    }
    if (!kinder.size) { ohneKinder.push(onkelTante); continue; }
    const liste = [...kinder.values()].sort(sortierer);
    liste.forEach((k) => einzigartig.set(k.id, k));
    gruppen.push({ onkelTante, halb: info.halb, eltern: [...info.eltern], kinder: liste });
  }
  // Doppelcousins: Sind Onkel und Tante miteinander verheiratet (z. B. Bruder der Mutter und Schwester des Vaters),
  // haben sie dieselben Kinder. Diese erscheinen dann nur einmal, gemeinsam unter beiden, und werden markiert.
  const zusammen = gruppen.map((g) => ({ mitglieder: [g], kinder: [...g.kinder], doppel: new Set() }));
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    suche: for (let i = 0; i < zusammen.length; i++) {
      for (let j = i + 1; j < zusammen.length; j++) {
        const ids = new Set(zusammen[i].kinder.map((k) => k.id));
        if (!zusammen[j].kinder.some((k) => ids.has(k.id))) continue;
        zusammen[i].mitglieder.push(...zusammen[j].mitglieder);
        for (const k of zusammen[j].kinder) if (!ids.has(k.id)) zusammen[i].kinder.push(k);
        zusammen.splice(j, 1);
        geaendert = true;
        break suche;
      }
    }
  }
  const doppelIds = new Set();
  for (const z of zusammen) {
    z.kinder.sort(sortierer);
    z.mitglieder.sort((x, y) => sortierer(x.onkelTante, y.onkelTante));
    for (const k of z.kinder) {
      const elternSeiten = new Set();
      for (const m of z.mitglieder) if (m.kinder.some((x) => x.id === k.id)) m.eltern.forEach((id) => elternSeiten.add(id));
      if (elternSeiten.size >= 2) { z.doppel.add(k.id); doppelIds.add(k.id); }
    }
  }
  zusammen.sort((x, y) => sortierer(x.mitglieder[0].onkelTante, y.mitglieder[0].onkelTante));
  ohneKinder.sort(sortierer);
  // Seiten: Kinder der Geschwister des Vaters = väterlicherseits, der Mutter = mütterlicherseits.
  // Doppelcousins zählen auf beiden Seiten.
  const seiten = { vater: new Map(), mutter: new Map(), unbekannt: new Map() };
  for (const z of zusammen) {
    for (const mg of z.mitglieder) {
      for (const pid of mg.eltern) {
        const pg = treePersonGender(treePerson(pid));
        const seite = pg === "m" ? seiten.vater : pg === "w" ? seiten.mutter : seiten.unbekannt;
        mg.kinder.forEach((k) => seite.set(k.id, k));
      }
    }
  }
  return { parents: parentIds.size, gruppen: zusammen, ohneKinder, personen: [...einzigartig.values()], doppelIds, seiten };
}

function treeCousinsRender(personId) {
  const result = document.getElementById("tree-cousins-result");
  if (!result) return;
  if (!personId || !treePerson(personId)) {
    result.innerHTML = "Bitte zuerst eine Ausgangsperson auswählen.";
    return;
  }
  const { parents, gruppen, ohneKinder, personen, doppelIds, seiten } = treeCousinsOf(personId);
  const titel = `<strong>Cousins und Cousinen von ${escTree(treePersonLabel(personId))}</strong>`;
  if (!parents) {
    result.innerHTML = `${titel}<p class="tree-cousins__hint">Für diese Person sind keine Eltern erfasst, daher können keine Cousins oder Cousinen ermittelt werden.</p>`;
    return;
  }
  const ohneKinderHinweis = ohneKinder.length
    ? `<p class="tree-cousins__hint">Onkel/Tanten ohne erfasste Kinder: ${ohneKinder.map((p) => escTree(treePersonLabel(p.id))).join("; ")}</p>` : "";
  if (!gruppen.length) {
    result.innerHTML = `${titel}<p class="tree-cousins__hint">Keine Cousins oder Cousinen erfasst. Das kann auch daran liegen, dass Eltern, Großeltern oder Geschwister der Eltern noch nicht eingetragen sind.</p>${ohneKinderHinweis}`;
    return;
  }
  const anzahl = (g) => personen.filter((p) => treePersonGender(p) === g).length;
  const m = anzahl("m"), w = anzahl("w"), u = anzahl("u");
  const dm = personen.filter((p) => doppelIds.has(p.id) && treePersonGender(p) === "m").length;
  const dw = personen.filter((p) => doppelIds.has(p.id) && treePersonGender(p) === "w").length;
  const doppelText = [dm ? `${dm} Doppelcousin${dm === 1 ? "" : "s"}` : "", dw ? `${dw} Doppelcousine${dw === 1 ? "" : "n"}` : ""].filter(Boolean).join(" und ");
  const summe = [`${m} Cousins`, `${w} Cousinen`, u ? `${u} ohne Geschlechtsangabe` : ""].filter(Boolean).join(" · ")
    + (doppelText ? ` (davon ${doppelText})` : "");
  const jahreHtml = (p) => { const j = treeYearsText(p); return j ? ` <span class="tree-cousins__years">${escTree(j)}</span>` : ""; };
  const gruppeHtml = (g) => {
    const kopfZeilen = g.mitglieder.map((mg, idx) => {
      const og = treePersonGender(mg.onkelTante);
      const rolle = og === "m" ? "Onkel" : og === "w" ? "Tante" : "Onkel/Tante";
      const geschwister = og === "m" ? (mg.halb ? "Halbbruder" : "Bruder") : og === "w" ? (mg.halb ? "Halbschwester" : "Schwester") : (mg.halb ? "Halbgeschwister" : "Geschwister");
      const eltern = mg.eltern.map((id) => {
        const pg = treePersonGender(treePerson(id));
        return `${escTree(treePersonLabel(id))} (${pg === "m" ? "Vater" : pg === "w" ? "Mutter" : "Elternteil"})`;
      }).join(" und ");
      const letzte = idx === g.mitglieder.length - 1;
      const anzahl = letzte ? ` · ${g.kinder.length} ${g.kinder.length === 1 ? "Kind" : "Kinder"}` : "";
      return `<h4 class="tree-cousins__group${g.mitglieder.length > 1 ? (letzte ? " tree-cousins__group--ende" : " tree-cousins__group--paar") : ""}"><span class="tree-cousins__role">${rolle}</span> ${escTree(treePersonLabel(mg.onkelTante.id))}${jahreHtml(mg.onkelTante)}<small>${geschwister} von ${eltern}${anzahl}</small></h4>`;
    }).join("");
    const doppelHinweis = g.doppel.size
      ? `<p class="tree-cousins__doppel">Doppelcousins: Diese Kinder sind über beide Elternteile von ${escTree(treePersonLabel(personId))} verwandt (Mutter- und Vaterseite), deshalb stehen sie nur einmal unter beiden.</p>` : "";
    const zeilen = g.kinder.map((k) => {
      const kg = treePersonGender(k);
      const doppel = g.doppel.has(k.id);
      const wort = (doppel ? "Doppelcousin" : "Cousin") + (kg === "w" ? "e" : "");
      const tag = kg === "m" || kg === "w" ? `<span class="tree-cousins__tag tree-cousins__tag--${kg}${doppel ? " tree-cousins__tag--doppel" : ""}">${wort}</span>` : "";
      return `<li><span class="tree-cousins__name">${escTree(treePersonLabel(k.id))}</span>${jahreHtml(k)}${tag}</li>`;
    }).join("");
    return `${kopfZeilen}${doppelHinweis}<ul class="tree-cousins__list">${zeilen}</ul>`;
  };
  const seiteText = (name, karte) => {
    if (!karte.size) return "";
    const liste = [...karte.values()];
    const sm = liste.filter((p) => treePersonGender(p) === "m").length;
    const sw = liste.filter((p) => treePersonGender(p) === "w").length;
    const su = liste.length - sm - sw;
    const teile = [sm ? `${sm} ${sm === 1 ? "Cousin" : "Cousins"}` : "", sw ? `${sw} ${sw === 1 ? "Cousine" : "Cousinen"}` : "", su ? `${su} ohne Geschlechtsangabe` : ""].filter(Boolean).join(", ");
    return `<strong>${name}:</strong> ${liste.length} (${teile})`;
  };
  const seitenZeile = [seiteText("Väterlicherseits", seiten.vater), seiteText("Mütterlicherseits", seiten.mutter), seiteText("Seite unbekannt", seiten.unbekannt)].filter(Boolean).join(" &nbsp;·&nbsp; ")
    + (doppelIds.size ? ` <span class="tree-cousins__hint-klein">(Doppelcousins zählen auf beiden Seiten)</span>` : "");
  result.innerHTML = `${titel}<p class="tree-cousins__summary">${personen.length} insgesamt: ${summe}</p><p class="tree-cousins__summary tree-cousins__seiten">${seitenZeile}</p>${gruppen.map(gruppeHtml).join("")}${ohneKinderHinweis}`;
}

function treeCousinsRefreshIfOpen(rootId) {
  const panel = document.getElementById("tree-cousins-panel");
  if (panel && !panel.hidden) treeCousinsRender(rootId || document.getElementById("tree-person-select")?.value || "");
}

function initTreeCousinsUI() {
  const open = document.getElementById("tree-cousins-open");
  const close = document.getElementById("tree-cousins-close");
  const panel = document.getElementById("tree-cousins-panel");
  if (!open || !panel) return;
  open.addEventListener("click", () => {
    panel.hidden = false;
    treeCousinsRender(document.getElementById("tree-person-select")?.value || "");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  close?.addEventListener("click", () => { panel.hidden = true; });
}

// ---------- v354: Lücken & Inseln (nur Eigentümer) ----------
// Zeigt Personen ohne Eltern oder Kinder und „Inseln“: Gruppen, die untereinander verbunden sind,
// aber nicht mit dem Hauptstammbaum. Es wird nichts verändert oder verbunden, die Ansicht dient dem Überblick.
function treeLueckenAnalyse(beziehungen, notizen) {
  const personen = treeData.personen;
  const byId = new Map(personen.map((p) => [p.id, p]));
  const eltern = new Map();   // kind -> Set(Elternteile)
  const kinder = new Map();   // elternteil -> Set(Kinder)
  const partner = new Map();  // person -> [{id, art}]
  const verbindungen = new Map(personen.map((p) => [p.id, []]));   // id -> [{text, mit}]
  const eltAdd = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  const verb = (id, text, mit) => { if (verbindungen.has(id)) verbindungen.get(id).push({ text, mit }); };
  const elternteile = new Map();
  for (const f of treeData.familien) {
    const ps = [f.partner_a_id, f.partner_b_id].filter((id) => byId.has(id));
    elternteile.set(f.id, ps);
    if (ps.length === 2) {
      const art = f.familientyp || "Partnerschaft";
      verb(ps[0], `${art} mit`, ps[1]);
      verb(ps[1], `${art} mit`, ps[0]);
      if (!partner.has(ps[0])) partner.set(ps[0], []); partner.get(ps[0]).push(ps[1]);
      if (!partner.has(ps[1])) partner.set(ps[1], []); partner.get(ps[1]).push(ps[0]);
    }
  }
  for (const k of treeData.kinder) {
    if (!byId.has(k.kind_id)) continue;
    for (const e of elternteile.get(k.familie_id) || []) {
      eltAdd(eltern, k.kind_id, e); eltAdd(kinder, e, k.kind_id);
      verb(k.kind_id, "Kind von", e);
      verb(e, "Elternteil von", k.kind_id);
    }
  }
  const lose = [];
  for (const b of beziehungen || []) {
    if (!byId.has(b.personen_a_id) || !byId.has(b.personen_b_id)) continue;
    const art = b.beziehungstyp || "Beziehung";
    lose.push(b);
    verb(b.personen_a_id, `${art} mit`, b.personen_b_id);
    verb(b.personen_b_id, `${art} mit`, b.personen_a_id);
  }
  // Gruppen (zusammenhängende Teile) bestimmen
  const eltern0 = new Map(personen.map((p) => [p.id, p.id]));
  const wurzel = (x) => { while (eltern0.get(x) !== x) { eltern0.set(x, eltern0.get(eltern0.get(x))); x = eltern0.get(x); } return x; };
  const vereine = (a, b) => { const ra = wurzel(a), rb = wurzel(b); if (ra !== rb) eltern0.set(ra, rb); };
  for (const [id, liste] of verbindungen) for (const v of liste) vereine(id, v.mit);
  const gruppen = new Map();
  for (const p of personen) { const r = wurzel(p.id); if (!gruppen.has(r)) gruppen.set(r, []); gruppen.get(r).push(p.id); }
  const alle = [...gruppen.values()].sort((x, y) => y.length - x.length);
  const haupt = alle[0] || [];
  const inseln = alle.slice(1).filter((g) => g.length > 1);
  const einzeln = alle.slice(1).filter((g) => g.length === 1).map((g) => g[0]);
  const gruppeVon = new Map();
  alle.forEach((g, i) => g.forEach((id) => gruppeVon.set(id, i)));
  // Hinweise: Der Name einer Person steht in der Notiz einer anderen, die in einer anderen Gruppe liegt
  const tokens = (s) => PersonSuche.normalisiere(s).split(/[^a-z0-9]+/).filter(Boolean);
  const namen = personen.map((p) => {
    const vor = tokens(p.vorname), nach = tokens(p.nachname || p.Ledigenname || p.ledigenname);
    return vor.length && nach.length && vor.join("").length >= 3 ? { id: p.id, folge: [...vor, ...nach] } : null;
  }).filter(Boolean);
  const hinweise = [];
  for (const p of personen) {
    const text = notizen.get(p.id);
    if (!text) continue;
    const tk = tokens(text);
    for (const n of namen) {
      if (n.id === p.id || gruppeVon.get(n.id) === gruppeVon.get(p.id)) continue;
      for (let i = 0; i + n.folge.length <= tk.length; i++) {
        if (n.folge.every((w, j) => tk[i + j] === w)) { hinweise.push({ von: p.id, nennt: n.id }); break; }
      }
    }
  }
  const hatKinder = (id) => (kinder.get(id)?.size || 0) > 0;
  const sortiere = (ids) => [...ids].sort((x, y) => PersonSuche.sort(byId.get(x), byId.get(y)));
  return {
    gesamt: personen.length,
    haupt, inseln, einzeln: sortiere(einzeln),
    ohneEltern: sortiere(personen.filter((p) => !eltern.has(p.id)).map((p) => p.id)),
    ohneKinder: sortiere(personen.filter((p) => !hatKinder(p.id)).map((p) => p.id)),
    verbindungen, hinweise, byId, gruppeVon
  };
}

function treeLueckenRender(analyse) {
  const ziel = document.getElementById("tree-luecken-result");
  if (!ziel) return;
  const { byId, verbindungen, hinweise } = analyse;
  const jahre = (p) => { const j = treeYearsText(p); return j ? ` <span class="tree-cousins__years">${escTree(j)}</span>` : ""; };
  const nameKnopf = (id) => `<button type="button" class="tree-luecken__person" data-luecken-person="${escTree(id)}">${escTree(treePersonLabel(id))}</button>`;
  const personZeile = (id, mitVerbindungen) => {
    const p = byId.get(id);
    const v = mitVerbindungen ? (verbindungen.get(id) || []) : [];
    const verbText = v.map((x) => `<span class="tree-luecken__verb">${escTree(x.text)} ${nameKnopf(x.mit)}</span>`).join("");
    const hin = hinweise.filter((h) => h.von === id).map((h) => `<span class="tree-luecken__hinweis">Hinweis: Notiz nennt ${nameKnopf(h.nennt)}</span>`).join("")
      + hinweise.filter((h) => h.nennt === id).map((h) => `<span class="tree-luecken__hinweis">Hinweis: genannt in der Notiz von ${nameKnopf(h.von)}</span>`).join("");
    return `<li>${nameKnopf(id)}${jahre(p)}${verbText || hin ? `<div class="tree-luecken__zeilen">${verbText}${hin}</div>` : ""}</li>`;
  };
  const zahl = (n, text) => `<div class="tree-luecken__zahl"><b>${n}</b><span>${text}</span></div>`;
  const inselPersonen = analyse.inseln.reduce((s, g) => s + g.length, 0);
  let html = `<div class="tree-luecken__zahlen">${zahl(analyse.gesamt, "Personen")}${zahl(analyse.haupt.length, "im Hauptstammbaum")}${zahl(analyse.inseln.length, `Inseln (${inselPersonen} Personen)`)}${zahl(analyse.einzeln.length, "ganz ohne Verbindung")}${zahl(analyse.ohneEltern.length, "ohne Eltern")}${zahl(analyse.ohneKinder.length, "ohne Kinder")}</div>`;
  html += `<p class="tree-cousins__hint">Der Hauptstammbaum ist die größte zusammenhängende Gruppe. „Ohne Eltern“ umfasst auch die ältesten erfassten Vorfahren, das ist normal. „Hinweis“ heißt: Der Name steht in einer Notiz, die Personen sind aber noch nicht verbunden. Hier wird nichts verändert.</p>`;
  if (analyse.inseln.length) {
    html += `<h4 class="tree-luecken__titel">Inseln</h4>`;
    analyse.inseln.forEach((g, i) => {
      const ids = [...g].sort((x, y) => PersonSuche.sort(byId.get(x), byId.get(y)));
      html += `<section class="tree-luecken__karte"><h5>Gruppe ${i + 1} · ${g.length} Personen</h5><ul class="tree-luecken__liste">${ids.map((id) => personZeile(id, true)).join("")}</ul></section>`;
    });
  } else {
    html += `<p class="tree-cousins__hint">Keine Inseln: Alle verbundenen Personen gehören zum Hauptstammbaum.</p>`;
  }
  if (analyse.einzeln.length) {
    html += `<h4 class="tree-luecken__titel">Ganz ohne Verbindung (${analyse.einzeln.length})</h4><ul class="tree-luecken__liste tree-luecken__liste--karte">${analyse.einzeln.map((id) => personZeile(id, false)).join("")}</ul>`;
  }
  const liste = (titel, ids) => ids.length ? `<details class="tree-luecken__details"><summary>${titel} (${ids.length})</summary><ul class="tree-luecken__liste">${ids.map((id) => `<li>${nameKnopf(id)}${jahre(byId.get(id))}</li>`).join("")}</ul></details>` : "";
  html += liste("Alle Personen ohne Eltern", analyse.ohneEltern) + liste("Alle Personen ohne Kinder", analyse.ohneKinder);
  ziel.innerHTML = html;
}

async function treeLueckenOeffnen() {
  if (!rolleIstEigentuemer()) return;
  const panel = document.getElementById("tree-luecken-panel");
  const ziel = document.getElementById("tree-luecken-result");
  if (!panel || !ziel) return;
  document.getElementById("tree-cousins-panel")?.setAttribute("hidden", "");
  panel.hidden = false;
  ziel.textContent = "Wird ausgewertet …";
  try {
    if (!treeData.personen.length) await loadStammbaumData();
    await ensurePersonenFrisch?.();
    const notizen = new Map();
    for (const p of (Array.isArray(personenCache) ? personenCache : [])) if (p.Notiz) notizen.set(p.id, p.Notiz);
    let beziehungen = [];
    try {
      const { data, error } = await sb.from("beziehung").select("id, personen_a_id, personen_b_id, beziehungstyp");
      if (!error) beziehungen = data || [];
    } catch (_) { /* Tabelle optional */ }
    treeLueckenRender(treeLueckenAnalyse(beziehungen, notizen));
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    ziel.textContent = `Auswertung nicht möglich: ${err.message || err}`;
  }
}

function initTreeLueckenUI() {
  document.getElementById("tree-luecken-open")?.addEventListener("click", () => { void treeLueckenOeffnen(); });
  document.getElementById("tree-luecken-close")?.addEventListener("click", () => { document.getElementById("tree-luecken-panel").hidden = true; });
  document.getElementById("tree-luecken-result")?.addEventListener("click", (e) => {
    const knopf = e.target.closest("[data-luecken-person]");
    if (knopf) void openPersonDetail(knopf.getAttribute("data-luecken-person"));
  });
}
initTreeLueckenUI();

// ---------- v360: Plausibilitätsprüfung ----------
// Prüft Lebensdaten, Eltern-Kind-Beziehungen und Partnerschaften. Es werden nur Widersprüche als „Fehler“ gemeldet, die
// bei allen möglichen Datumswerten gelten (bei nur bekanntem Jahr gilt der ganze Zeitraum). Ungewöhnliches ist eine „Warnung“.
const PLAUS = {
  alterWarnung: 105, alterFehler: 122, elternMin: 14, mutterMaxWarnung: 50, mutterMaxFehler: 57, vaterMaxWarnung: 75,
  heiratMin: 14, partnerAbstandWarnung: 35, vaterNachTodTage: 330
};
const PLAUS_JAHR = 365.25 * 24 * 3600 * 1000;

function plausZeit(wert, jahr) {
  const m = String(wert || "").match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (m) {
    const y = Number(m[1]);
    if (m[3]) { const t = Date.UTC(y, Number(m[2]) - 1, Number(m[3])); return { von: t, bis: t }; }
    if (m[2]) return { von: Date.UTC(y, Number(m[2]) - 1, 1), bis: Date.UTC(y, Number(m[2]), 0) };
    return { von: Date.UTC(y, 0, 1), bis: Date.UTC(y, 11, 31) };
  }
  const y = Number(jahr);
  if (Number.isFinite(y) && y > 0) return { von: Date.UTC(y, 0, 1), bis: Date.UTC(y, 11, 31) };
  return null;
}
const plausMitte = (z) => (z.von + z.bis) / 2;
const plausGeb = (p) => plausZeit(p?.geburtsdatum, p?.geburtsjahr);
const plausTod = (p) => plausZeit(p?.sterbedatum, p?.sterbejahr);
const plausJ = (ms) => Math.round(ms / PLAUS_JAHR);
function plausGeschlecht(p) {
  const r = String(p?.geschlecht || "").trim().toLocaleLowerCase("de");
  return r.startsWith("m") ? "m" : (r.startsWith("w") || r === "f") ? "w" : "u";
}
function plausDatumText(wert, jahr) { return wert ? personViewDatum(wert) : (jahr ? String(jahr) : ""); }
function plausName(p) { return (typeof PersonSuche !== "undefined" ? PersonSuche.name(p) : [p?.vorname, p?.nachname].filter(Boolean).join(" ")) || "(ohne Namen)"; }
const plausF = (stufe, text, personen = []) => ({ stufe, text, personen });

function plausLebensdaten(p, heute = Date.now()) {
  const f = [];
  const g = plausGeb(p), t = plausTod(p);
  if (g && g.von > heute) f.push(plausF("fehler", "Das Geburtsdatum liegt in der Zukunft."));
  if (t && t.von > heute) f.push(plausF("fehler", "Das Sterbedatum liegt in der Zukunft."));
  if (g && t && g.von > t.bis) {
    f.push(plausF("fehler", `Die Geburt (${plausDatumText(p.geburtsdatum, p.geburtsjahr)}) liegt nach dem Tod (${plausDatumText(p.sterbedatum, p.sterbejahr)}).`));
  } else if (g && t) {
    const minAlter = (t.von - g.bis) / PLAUS_JAHR, mitte = (plausMitte(t) - plausMitte(g)) / PLAUS_JAHR;
    if (minAlter > PLAUS.alterFehler) f.push(plausF("fehler", `Mit über ${PLAUS.alterFehler} Jahren gestorben: das ist nicht plausibel.`));
    else if (minAlter > PLAUS.alterWarnung) f.push(plausF("warnung", `Das Alter beim Tod wäre ca. ${plausJ(mitte * PLAUS_JAHR)} Jahre. Das ist ungewöhnlich hoch, bitte prüfen.`));
  } else if (g && !t) {
    const minAlterHeute = (heute - g.bis) / PLAUS_JAHR;
    if (minAlterHeute > PLAUS.alterFehler) f.push(plausF("hinweis", `Geboren vor über ${PLAUS.alterFehler} Jahren, aber ohne Sterbedatum: vermutlich verstorben.`));
    else if (minAlterHeute > 110) f.push(plausF("hinweis", "Geboren vor über 110 Jahren, aber ohne Sterbedatum: vermutlich verstorben."));
  }
  return f;
}

// eltern/kind: Personenobjekte; typ: Beziehungsart („biologisch“ prüft zusätzlich das Alter)
function plausElternKind(eltern, kind, typ = "biologisch") {
  const f = [], ids = [eltern?.id, kind?.id].filter(Boolean);
  const eg = plausGeb(eltern), kg = plausGeb(kind), et = plausTod(eltern);
  const rolle = plausGeschlecht(eltern) === "w" ? "Mutter" : plausGeschlecht(eltern) === "m" ? "Vater" : "Elternteil";
  const artikel = rolle === "Mutter" ? "Die" : rolle === "Vater" ? "Der" : "Der";
  const nachTod = !!(et && kg && (rolle === "Mutter" ? kg.von > et.bis : (kg.von - et.bis) / 86400000 > PLAUS.vaterNachTodTage));
  if (eg && kg) {
    if (eg.von >= kg.bis) f.push(plausF("fehler", `${plausName(eltern)} (${plausDatumText(eltern.geburtsdatum, eltern.geburtsjahr)}) ist nicht älter als das Kind ${plausName(kind)} (${plausDatumText(kind.geburtsdatum, kind.geburtsjahr)}).`, ids));
    else if ((!typ || typ === "biologisch") && !nachTod) {
      const alter = (plausMitte(kg) - plausMitte(eg)) / PLAUS_JAHR;
      const minAlter = (kg.von - eg.bis) / PLAUS_JAHR, maxAlter = (kg.bis - eg.von) / PLAUS_JAHR;
      if (maxAlter < PLAUS.elternMin) f.push(plausF("warnung", `${artikel} ${rolle} wäre bei der Geburt von ${plausName(kind)} erst ca. ${plausJ(alter * PLAUS_JAHR)} Jahre alt.`, ids));
      if (rolle === "Mutter") {
        if (minAlter > PLAUS.mutterMaxFehler) f.push(plausF("fehler", `Die Mutter wäre bei der Geburt von ${plausName(kind)} über ${PLAUS.mutterMaxFehler} Jahre alt: das ist nicht plausibel.`, ids));
        else if (minAlter > PLAUS.mutterMaxWarnung) f.push(plausF("warnung", `Die Mutter wäre bei der Geburt von ${plausName(kind)} ca. ${plausJ(alter * PLAUS_JAHR)} Jahre alt. Das ist ungewöhnlich, bitte prüfen.`, ids));
      } else if (minAlter > PLAUS.vaterMaxWarnung) {
        f.push(plausF("warnung", `${artikel} ${rolle} wäre bei der Geburt von ${plausName(kind)} ca. ${plausJ(alter * PLAUS_JAHR)} Jahre alt. Das ist ungewöhnlich, bitte prüfen.`, ids));
      }
    }
  }
  if (et && kg) {
    if (rolle === "Mutter" && kg.von > et.bis) f.push(plausF("fehler", `${plausName(kind)} wurde nach dem Tod der Mutter geboren.`, ids));
    else if (rolle !== "Mutter" && (kg.von - et.bis) / 86400000 > PLAUS.vaterNachTodTage) f.push(plausF("fehler", `${plausName(kind)} wurde mehr als 11 Monate nach dem Tod ${rolle === "Vater" ? "des Vaters" : "des Elternteils"} geboren.`, ids));
  }
  return f;
}

// fam: { beginn, ende }; a/b: Personenobjekte
function plausPartnerschaft(fam, a, b) {
  const f = [], ids = [a?.id, b?.id].filter(Boolean);
  const beginn = plausZeit(fam?.beginn), ende = plausZeit(fam?.ende);
  const art = String(fam?.familientyp || "Partnerschaft") === "Ehe" ? "Die Ehe" : "Die Partnerschaft";
  if (beginn && ende && beginn.von > ende.bis) f.push(plausF("fehler", `${art} endet (${personViewDatum(fam.ende)}) vor ihrem Beginn (${personViewDatum(fam.beginn)}).`, ids));
  for (const p of [a, b]) {
    if (!p) continue;
    const g = plausGeb(p), t = plausTod(p);
    if (beginn && g) {
      if (beginn.bis < g.von) f.push(plausF("fehler", `${art} beginnt (${personViewDatum(fam.beginn)}) vor der Geburt von ${plausName(p)}.`, ids));
      else if ((plausMitte(beginn) - plausMitte(g)) / PLAUS_JAHR < PLAUS.heiratMin && (beginn.bis - g.von) / PLAUS_JAHR < PLAUS.heiratMin) f.push(plausF("warnung", `${plausName(p)} wäre bei Beginn ${art === "Die Ehe" ? "der Ehe" : "der Partnerschaft"} erst ca. ${plausJ(plausMitte(beginn) - plausMitte(g))} Jahre alt.`, ids));
    }
    if (beginn && t && beginn.von > t.bis) f.push(plausF("fehler", `${art} beginnt (${personViewDatum(fam.beginn)}) nach dem Tod von ${plausName(p)}.`, ids));
  }
  const ga = plausGeb(a), gb = plausGeb(b);
  if (ga && gb && Math.abs(plausMitte(ga) - plausMitte(gb)) / PLAUS_JAHR > PLAUS.partnerAbstandWarnung) {
    f.push(plausF("warnung", `Zwischen ${plausName(a)} und ${plausName(b)} liegen ca. ${plausJ(Math.abs(plausMitte(ga) - plausMitte(gb)))} Jahre. Das ist ungewöhnlich, bitte prüfen.`, ids));
  }
  return f;
}

// Fragt bei Warnungen nach und blockiert bei Fehlern. true = Speichern darf weitergehen.
async function plausFragen(befunde, titel = "") {
  const fehler = befunde.filter((b) => b.stufe === "fehler"), warnungen = befunde.filter((b) => b.stufe === "warnung");
  const liste = (l) => l.map((b) => `• ${b.text}`).join("\n");
  if (fehler.length) {
    window.alert(`${titel ? `${titel}\n\n` : ""}Das kann so nicht stimmen:\n\n${liste(fehler)}\n\nBitte zuerst korrigieren.`);
    return false;
  }
  if (warnungen.length) return window.confirm(`${titel ? `${titel}\n\n` : ""}Bitte prüfen:\n\n${liste(warnungen)}\n\nTrotzdem speichern?`);
  return true;
}

function plausFormPerson(prefix) {
  const jahr = (id) => { const v = document.getElementById(id)?.value?.trim(); return v ? Number(v) : null; };
  const gd = getDatum(`${prefix}geburtsdatum`), sd = getDatum(`${prefix}sterbedatum`);
  return {
    geburtsdatum: gd, geburtsjahr: gd ? null : jahr(`${prefix}geburtsjahr`),
    sterbedatum: sd, sterbejahr: sd ? null : jahr(`${prefix}sterbejahr`),
    geschlecht: document.getElementById(`${prefix}geschlecht`)?.value || ""
  };
}

async function plausLadePersonen(ids) {
  const eindeutig = [...new Set(ids.filter(Boolean))];
  if (!eindeutig.length) return new Map();
  const { data } = await sb.from("personen").select("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr").in("id", eindeutig);
  return new Map((data || []).map((p) => [p.id, p]));
}

// Prüft die neuen Lebensdaten einer vorhandenen Person gegen ihre Eltern, Kinder und Partner (Fehler beim Laden werden ignoriert)
async function plausVerwandteDerPerson(personId, neu) {
  const befunde = [];
  try {
    const selbst = { id: personId, vorname: document.getElementById("d-vorname")?.value || "", nachname: document.getElementById("d-nachname")?.value || "", ...neu };
    const [{ data: alsKind }, { data: partnerFamilien }] = await Promise.all([
      sb.from("familien_kinder").select("familie_id, beziehungstyp").eq("kind_id", personId),
      sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende").or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`)
    ]);
    const elternFamilienIds = (alsKind || []).map((k) => k.familie_id);
    const eigeneIds = (partnerFamilien || []).map((f) => f.id);
    const [elternFamilien, eigeneKinder] = await Promise.all([
      elternFamilienIds.length ? sb.from("familien").select("id, partner_a_id, partner_b_id").in("id", elternFamilienIds) : { data: [] },
      eigeneIds.length ? sb.from("familien_kinder").select("familie_id, kind_id, beziehungstyp").in("familie_id", eigeneIds) : { data: [] }
    ]);
    const ids = [];
    for (const f of elternFamilien.data || []) ids.push(f.partner_a_id, f.partner_b_id);
    for (const f of partnerFamilien || []) ids.push(f.partner_a_id, f.partner_b_id);
    for (const k of eigeneKinder.data || []) ids.push(k.kind_id);
    const lookup = await plausLadePersonen(ids);
    for (const k of alsKind || []) {
      const fam = (elternFamilien.data || []).find((f) => f.id === k.familie_id);
      for (const eid of [fam?.partner_a_id, fam?.partner_b_id].filter(Boolean)) if (lookup.has(eid)) befunde.push(...plausElternKind(lookup.get(eid), selbst, k.beziehungstyp));
    }
    for (const k of eigeneKinder.data || []) {
      if (lookup.has(k.kind_id)) befunde.push(...plausElternKind(selbst, lookup.get(k.kind_id), k.beziehungstyp));
    }
    for (const f of partnerFamilien || []) {
      const andere = f.partner_a_id === personId ? f.partner_b_id : f.partner_a_id;
      if (andere && lookup.has(andere)) befunde.push(...plausPartnerschaft(f, selbst, lookup.get(andere)));
    }
  } catch (err) {
    debugLog(`⚠️ Plausibilität (Verwandte): ${err.message || err}`);
  }
  // doppelte Meldungen entfernen
  const gesehen = new Set();
  return befunde.filter((b) => { const k = `${b.stufe}|${b.text}`; if (gesehen.has(k)) return false; gesehen.add(k); return true; });
}

// ---- Bericht über alle Daten (nur Eigentümer) ----
function plausBerichtAnalyse() {
  const personen = treeData.personen, byId = new Map(personen.map((p) => [p.id, p]));
  const befunde = [];
  for (const p of personen) for (const b of plausLebensdaten(p)) befunde.push({ ...b, personen: [p.id], text: `${plausName(p)}: ${b.text}` });
  const famPersonen = new Map();
  for (const f of treeData.familien) {
    const ps = [f.partner_a_id, f.partner_b_id].filter((id) => byId.has(id));
    famPersonen.set(f.id, ps.map((id) => byId.get(id)));
    if (ps.length === 2) befunde.push(...plausPartnerschaft(f, byId.get(ps[0]), byId.get(ps[1])));
  }
  for (const k of treeData.kinder) {
    const kind = byId.get(k.kind_id);
    if (!kind) continue;
    for (const e of famPersonen.get(k.familie_id) || []) befunde.push(...plausElternKind(e, kind, k.beziehungstyp));
  }
  const gesehen = new Set();
  const eindeutig = befunde.filter((b) => { const k = `${b.stufe}|${b.text}`; if (gesehen.has(k)) return false; gesehen.add(k); return true; });
  const rang = { fehler: 0, warnung: 1, hinweis: 2 };
  eindeutig.sort((x, y) => rang[x.stufe] - rang[y.stufe]);
  return { befunde: eindeutig, geprueft: personen.length };
}

function plausBerichtRender(erg) {
  const ziel = document.getElementById("tree-plaus-result");
  if (!ziel) return;
  const zahl = (stufe) => erg.befunde.filter((b) => b.stufe === stufe).length;
  const kachel = (n, t) => `<div class="tree-luecken__zahl"><b>${n}</b><span>${t}</span></div>`;
  const stufenText = { fehler: "Fehler", warnung: "Warnung", hinweis: "Hinweis" };
  const zeilen = erg.befunde.slice(0, 300).map((b) => {
    const knoepfe = (b.personen || []).map((id) => `<button type="button" class="tree-luecken__person" data-plaus-person="${escTree(id)}">${escTree(treePersonLabel(id))}</button>`).join(" · ");
    return `<li class="plaus-eintrag plaus-eintrag--${b.stufe}"><span class="plaus-tag plaus-tag--${b.stufe}">${stufenText[b.stufe]}</span> ${escTree(b.text)}${knoepfe ? `<div class="tree-luecken__zeilen">${knoepfe}</div>` : ""}</li>`;
  }).join("");
  const mehr = erg.befunde.length > 300 ? `<p class="tree-cousins__hint">Es werden die ersten 300 von ${erg.befunde.length} Meldungen angezeigt.</p>` : "";
  ziel.innerHTML = `<div class="tree-luecken__zahlen">${kachel(zahl("fehler"), "Fehler")}${kachel(zahl("warnung"), "Warnungen")}${kachel(zahl("hinweis"), "Hinweise")}${kachel(erg.geprueft, "Personen geprüft")}</div>
    <p class="tree-cousins__hint">Fehler sind Widersprüche (zum Beispiel Geburt nach dem Tod). Warnungen sind ungewöhnlich, können aber stimmen. Bei nur bekanntem Jahr wird der ganze Zeitraum berücksichtigt. Es wird nichts verändert.</p>
    ${erg.befunde.length ? `<ul class="tree-luecken__liste tree-luecken__liste--karte">${zeilen}</ul>${mehr}` : `<p class="tree-cousins__hint">Keine Auffälligkeiten gefunden. ✓</p>`}`;
}

async function plausBerichtOeffnen() {
  if (!rolleIstEigentuemer()) return;
  const panel = document.getElementById("tree-plaus-panel"), ziel = document.getElementById("tree-plaus-result");
  if (!panel || !ziel) return;
  ["tree-cousins-panel", "tree-luecken-panel"].forEach((id) => document.getElementById(id)?.setAttribute("hidden", ""));
  panel.hidden = false;
  ziel.textContent = "Wird geprüft …";
  try {
    await loadStammbaumData();
    plausBerichtRender(plausBerichtAnalyse());
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) { ziel.textContent = `Prüfung nicht möglich: ${err.message || err}`; }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tree-plaus-open")?.addEventListener("click", () => { void plausBerichtOeffnen(); });
  document.getElementById("tree-plaus-close")?.addEventListener("click", () => { document.getElementById("tree-plaus-panel").hidden = true; });
  document.getElementById("tree-plaus-result")?.addEventListener("click", (e) => {
    const k = e.target.closest("[data-plaus-person]");
    if (k) void openPersonDetail(k.getAttribute("data-plaus-person"));
  });
});

// ---------- v335: Verwandtschaft – Personenfelder mit Sucheingabe statt langer Auswahlliste ----------
const treeRelationSides = {};
function treeRelationGet(key) {
  if (!treeRelationSides[key]) {
    treeRelationSides[key] = {
      input: document.getElementById(`tree-relation-search-${key}`),
      select: document.getElementById(`tree-relation-person-${key}`),
      hint: document.getElementById(`tree-relation-hint-${key}`),
      list: document.getElementById(`tree-relation-options-${key}`),
      vorschlagKey: "",
      indexRef: null
    };
  }
  return treeRelationSides[key];
}

function treeRelationShowHint(side, text, ok) {
  if (!side.hint) return;
  side.hint.textContent = text;
  side.hint.classList.toggle("is-ok", !!text && !!ok);
  side.hint.classList.toggle("is-warn", !!text && !ok);
}

function treeRelationSetPerson(key, id) {
  const side = treeRelationGet(key);
  if (!side.select || !side.input) return;
  const person = id ? treePerson(id) : null;
  side.select.value = person ? id : "";
  side.input.value = person ? treePersonSearchText(person) : "";
  treeRelationShowHint(side, person ? "✓ ausgewählt" : "", true);
}

// Gibt die Personen-ID zurück, wenn der eingetippte Text genau eine Person ergibt.
function treeRelationResolve(key) {
  const side = treeRelationGet(key);
  if (!side.input || !side.select) return "";
  const raw = side.input.value.trim();
  if (!raw) { side.select.value = ""; treeRelationShowHint(side, "", true); return ""; }
  const matches = resolveTreePersonSearch(raw);
  if (matches.length === 1) {
    const entry = matches[0];
    side.select.value = entry.person.id;
    treeRelationShowHint(side, entry.labelNorm === PersonSuche.normalisiere(raw) ? "✓ ausgewählt" : `✓ ${entry.label}`, true);
    return side.select.value;
  }
  side.select.value = "";
  treeRelationShowHint(side, matches.length > 1 ? `${matches.length} Personen passen – bitte einen Vorschlag antippen.` : "Keine Person gefunden.", false);
  return "";
}

function treeRelationFillSuggestions(key) {
  const side = treeRelationGet(key);
  if (!side.input || !side.list) return;
  const index = getTreePersonSearchIndex();
  const tokens = treeSearchTokens(side.input.value);
  const matches = [];
  for (const entry of index) {
    if (!tokens.length || tokens.every((token) => entry.search.includes(token))) {
      matches.push(entry);
      if (matches.length >= TREE_VORSCHLAEGE_MAX) break;
    }
  }
  const k = matches.map((entry) => entry.person.id).join("|");
  if (k === side.vorschlagKey && side.indexRef === index) return;
  side.vorschlagKey = k;
  side.indexRef = index;
  const fragment = document.createDocumentFragment();
  for (const entry of matches) {
    const opt = document.createElement("option");
    opt.value = entry.label;
    fragment.appendChild(opt);
  }
  side.list.replaceChildren(fragment);
}

// Gewählte Person aus dem versteckten Auswahlfeld im Eingabefeld sichtbar machen.
function treeRelationSyncInputs() {
  for (const key of ["a", "b"]) {
    const side = treeRelationGet(key);
    if (!side.select || !side.input) continue;
    if (side.select.value && treePerson(side.select.value) && !side.input.value) treeRelationSetPerson(key, side.select.value);
  }
}

function treeRelationClearInputs() {
  for (const key of ["a", "b"]) {
    const side = treeRelationGet(key);
    if (side.input) side.input.value = "";
    if (side.select) side.select.value = "";
    treeRelationShowHint(side, "", true);
  }
}

function initTreeRelationFields() {
  const timers = {};
  for (const key of ["a", "b"]) {
    const side = treeRelationGet(key);
    if (!side.input) continue;
    const update = () => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => { treeRelationFillSuggestions(key); treeRelationResolve(key); }, 60);
    };
    side.input.addEventListener("focus", () => treeRelationFillSuggestions(key));
    side.input.addEventListener("input", update);
    side.input.addEventListener("change", () => treeRelationResolve(key));
    side.input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      treeRelationResolve(key);
      document.getElementById("tree-relationship-calc")?.click();
    });
  }
  document.getElementById("tree-relation-swap")?.addEventListener("click", () => {
    const idA = treeRelationResolve("a");
    const idB = treeRelationResolve("b");
    treeRelationSetPerson("a", idB);
    treeRelationSetPerson("b", idA);
  });
}

// ---------- v340: gemeinsame Trefferliste und Personenauswahl für alle Felder ----------
const TREE_SUGGEST_MAX = 100;

function personItem(entry) {
  const t = PersonSuche.anzeige(entry.person);
  return { id: entry.person.id, name: t.name, ledig: t.ledig, sub: t.daten, label: entry.label, person: entry.person };
}

function treeSuggestAnbieter(wert) {
  const erg = PersonSuche.suche(getTreePersonSearchIndex(), wert, { max: TREE_SUGGEST_MAX });
  return { total: erg.total, items: erg.entries.map(personItem), verbergenBeiLeer: !erg.tokens.length };
}

// Gemeinsame Engine: Trefferliste unter einem Eingabefeld (Tippen, Pfeiltasten, Enter, Esc, Antippen).
function personSuggestAttach(input, anbieter, beiAuswahl, optionen = {}) {
  const wrap = input?.closest(".tree-suggest-wrap");
  if (!wrap) return null;
  input.removeAttribute("list");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  const box = document.createElement("div");
  box.className = "tree-suggest";
  box.setAttribute("role", "listbox");
  box.hidden = true;
  wrap.appendChild(box);
  let timer = null;
  let items = [];
  let aktiv = -1;

  const verbergen = () => { box.hidden = true; aktiv = -1; input.setAttribute("aria-expanded", "false"); };
  // Liste unter dem Feld öffnen; reicht der Platz nicht (z. B. wegen der Bildschirmtastatur), darüber.
  const platzieren = () => {
    if (box.hidden) return;
    const vv = window.visualViewport;
    const r = input.getBoundingClientRect();
    const sichtOben = vv ? vv.offsetTop : 0;
    const sichtUnten = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const platzUnten = sichtUnten - r.bottom - 12;
    const platzOben = r.top - sichtOben - 36;
    const oben = platzUnten < 260 && platzOben > platzUnten;
    box.classList.toggle("is-oben", oben);
    box.style.maxHeight = `${Math.round(Math.max(140, Math.min(380, oben ? platzOben : platzUnten)))}px`;
  };
  const markieren = () => {
    const knoepfe = box.querySelectorAll(".tree-suggest__item");
    knoepfe.forEach((el, i) => el.classList.toggle("is-active", i === aktiv));
    if (aktiv >= 0) knoepfe[aktiv]?.scrollIntoView({ block: "nearest" });
  };
  const zeichnen = () => {
    const erg = anbieter(input.value) || { items: [], total: 0 };
    items = erg.items || [];
    aktiv = -1;
    if (!items.length) {
      if (erg.verbergenBeiLeer) { verbergen(); return; }
      box.innerHTML = `<div class="tree-suggest__empty">${escTree(erg.leerText || "Keine Person gefunden.")}</div>`;
    } else {
      const kopf = erg.kopf || (erg.total > items.length
        ? `${erg.total} Treffer – die ersten ${items.length} werden angezeigt. Bitte weiter eingrenzen.`
        : `${erg.total} Treffer`);
      box.innerHTML = `<div class="tree-suggest__head">${escTree(kopf)}</div>` + items.map((e, i) =>
        `<button type="button" class="tree-suggest__item" role="option" data-index="${i}"><span class="tree-suggest__name">${escTree(e.name)}${e.ledig ? ` <span class="tree-suggest__maiden">(geb. ${escTree(e.ledig)})</span>` : ""}</span>${e.sub ? `<span class="tree-suggest__years">${escTree(e.sub)}</span>` : ""}</button>`).join("");
    }
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
    box.scrollTop = 0;
    platzieren();
  };
  const waehlen = (item) => {
    if (!item) return;
    if (!optionen.eingabeBleibt) input.value = item.label;
    verbergen();
    beiAuswahl(item, input);
  };

  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(zeichnen, 60); });
  input.addEventListener("focus", () => { zeichnen(); if (optionen.beiFokus) optionen.beiFokus(); });
  input.addEventListener("blur", () => setTimeout(() => { verbergen(); if (optionen.beiBlur) optionen.beiBlur(); }, 220));
  // Capture: Pfeiltasten/Enter in der Liste haben Vorrang vor anderen Tastenbelegungen des Feldes.
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { verbergen(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (box.hidden) zeichnen();
      if (!items.length) return;
      event.preventDefault();
      aktiv = event.key === "ArrowDown" ? Math.min(items.length - 1, aktiv + 1) : Math.max(0, aktiv - 1);
      markieren();
      return;
    }
    if (event.key === "Enter" && !box.hidden && items.length && (aktiv >= 0 || items.length === 1)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      waehlen(items[aktiv >= 0 ? aktiv : 0]);
    }
  }, true);
  box.addEventListener("mousedown", (event) => event.preventDefault());
  box.addEventListener("click", (event) => {
    const knopf = event.target.closest(".tree-suggest__item");
    if (knopf) waehlen(items[Number(knopf.dataset.index)]);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", platzieren);
    window.visualViewport.addEventListener("scroll", platzieren);
  }
  window.addEventListener("resize", platzieren);
  return { zeichnen, verbergen, box };
}

// <option> für Personenlisten: einheitliches Anzeigeformat, Person bleibt für die Suche am Eintrag.
function personOption(person) {
  const opt = document.createElement("option");
  opt.value = person.id;
  opt.textContent = PersonSuche.label(person);
  opt._person = person;
  return opt;
}

function personPickerEintrag(opt) {
  if (opt._person) return PersonSuche.eintrag(opt._person);
  const norm = PersonSuche.normalisiere(opt.text);
  return { person: null, label: opt.text, labelNorm: norm, search: norm, names: norm, nachVor: norm };
}

// Ersetzt die Anzeige eines <select> mit Personen durch Suchfeld + Trefferliste.
// Das <select> bleibt unsichtbar bestehen: Wert, Optionen, change-Ereignis und hidden funktionieren wie bisher.
function personPickerFuerSelect(select, optionen = {}) {
  if (!select || select._personPicker) return null;
  const wrap = document.createElement("div");
  wrap.className = "person-picker tree-suggest-wrap";
  const feld = document.createElement("div");
  feld.className = "person-picker__field";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "person-picker__input";
  input.placeholder = optionen.platzhalter || "Name oder Jahr eingeben …";
  input.autocomplete = "off";
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("enterkeyhint", "search");
  input.setAttribute("inputmode", "search");
  const loeschen = document.createElement("button");
  loeschen.type = "button";
  loeschen.className = "person-picker__clear";
  loeschen.setAttribute("aria-label", "Auswahl entfernen");
  loeschen.title = "Auswahl entfernen";
  loeschen.textContent = "✕";
  loeschen.hidden = true;
  feld.append(input, loeschen);
  wrap.appendChild(feld);
  select.parentNode.insertBefore(wrap, select);
  select.classList.add("person-picker__select");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const sync = () => {
    const hatWert = !!select.value;
    const gewaehlt = hatWert ? select.options[select.selectedIndex] : null;
    if (document.activeElement !== input) input.value = gewaehlt ? gewaehlt.text : "";
    input.classList.toggle("is-gewaehlt", hatWert);
    loeschen.hidden = !hatWert;
    wrap.hidden = select.hidden;
  };

  // select.value = … (aus dem bestehenden Code) aktualisiert das Suchfeld sofort.
  const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(select, "value", {
    configurable: true,
    get() { return proto.get.call(this); },
    set(v) { proto.set.call(this, v); sync(); }
  });
  select.focus = () => input.focus();
  new MutationObserver(() => { sync(); engine?.verbergen && document.activeElement !== input && engine.verbergen(); })
    .observe(select, { childList: true, attributes: true, attributeFilter: ["hidden"] });

  const anbieter = (wert) => {
    const alle = [...select.options].filter((o) => o.value);
    if (!alle.length) return { total: 0, items: [], leerText: "Keine Personen verfügbar (oder noch nicht geladen)." };
    const tokens = PersonSuche.zerlege(wert);
    const eintraege = alle.map((o) => ({ opt: o, e: personPickerEintrag(o) }));
    const zuItem = ({ opt, e }) => {
      const t = e.person ? PersonSuche.anzeige(e.person) : { name: opt.text, ledig: "", daten: "" };
      return { id: opt.value, name: t.name, ledig: t.ledig, sub: t.daten, label: opt.text };
    };
    if (!tokens.length) {
      return { total: alle.length, items: eintraege.slice(0, 12).map(zuItem), kopf: `${alle.length} Personen – zum Suchen Namen oder Jahr eintippen` };
    }
    const erste = tokens[0];
    const treffer = eintraege.filter(({ e }) => tokens.every((t) => e.search.includes(t)));
    const rang = ({ e }) => ((e.names.startsWith(erste) || e.nachVor.startsWith(erste)) ? 0 : (e.names.split(" ").some((w) => w.startsWith(erste)) ? 1 : 2));
    const geordnet = treffer.map((x, i) => ({ x, i, r: rang(x) })).sort((p, q) => p.r - q.r || p.i - q.i).map((p) => p.x);
    return { total: geordnet.length, items: geordnet.slice(0, TREE_SUGGEST_MAX).map(zuItem) };
  };

  const auswaehlen = (item) => {
    select.value = item.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  };
  const engine = personSuggestAttach(input, anbieter, auswaehlen, {
    beiFokus: () => {
      setTimeout(() => { try { if (input.value) input.select(); } catch (_) { /* ältere Browser */ } }, 0);
      if (optionen.beiFokus) optionen.beiFokus(select);
    },
    beiBlur: sync
  });
  loeschen.addEventListener("click", () => {
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  });
  select._personPicker = { input, wrap, sync };
  sync();
  return select._personPicker;
}

function initPersonPickers() {
  const felder = [
    ["erstverwandtschaft-person", { platzhalter: "Bezugsperson suchen …" }],
    ["erst-partner-vorhanden", { platzhalter: "Partner/in suchen …", beiFokus: (sel) => sel.dispatchEvent(new Event("focus")) }],
    ["d-vater", { platzhalter: "Vater suchen …" }],
    ["d-mutter", { platzhalter: "Mutter suchen …" }],
    ["d-partner-person", { platzhalter: "Partner/in suchen …" }],
    ["d-kind-person", { platzhalter: "Kind suchen …" }]
  ];
  for (const [id, optionen] of felder) personPickerFuerSelect(document.getElementById(id), optionen);
}

function initTreeSuggestions() {
  personSuggestAttach(document.getElementById("tree-person-search"), treeSuggestAnbieter, (item) => {
    const auswahl = document.getElementById("tree-person-select");
    if (auswahl) auswahl.value = item.id;
    refreshTreeConfirmButton();
  });
  for (const key of ["a", "b"]) {
    personSuggestAttach(document.getElementById(`tree-relation-search-${key}`), treeSuggestAnbieter, (item) => treeRelationSetPerson(key, item.id));
  }
  initPersonPickers();
}

function initTreeRelationshipUI() {
  const open = document.getElementById("tree-relationship-open");
  const close = document.getElementById("tree-relationship-close");
  const panel = document.getElementById("tree-relationship-panel");
  const calc = document.getElementById("tree-relationship-calc");
  const reset = document.getElementById("tree-relationship-reset");
  const a = document.getElementById("tree-relation-person-a");
  const b = document.getElementById("tree-relation-person-b");
  const result = document.getElementById("tree-relationship-result");
  if (!open || !panel || !calc || !reset || !a || !b || !result) return;
  open.addEventListener("click", () => {
    panel.hidden = false;
    fillTreeRelationshipSelects();
    if (!a.value && treeSelect?.value) a.value = treeSelect.value;
    treeRelationSyncInputs();
  });
  close?.addEventListener("click", () => { panel.hidden = true; });
  reset.addEventListener("click", () => {
    a.value = "";
    b.value = "";
    treeRelationClearInputs();
    result.innerHTML = "";
    treeRelationshipSelection = { personAId: null, personBId: null };
    const treeSelectElement = document.getElementById("tree-person-select");
    if (treeSelectElement?.value) renderStammbaum(treeSelectElement.value);
  });
  calc.addEventListener("click", () => {
    treeRelationResolve("a");
    treeRelationResolve("b");
    const personAId = a.value;
    const personBId = b.value;
    if (!personAId || !personBId) { result.innerHTML = "Bitte beide Personen auswählen: Namen eintippen und einen Vorschlag antippen."; return; }
    const found = treeRelationshipResult(personAId, personBId);
    if (!found) { result.innerHTML = "Bitte zwei Personen auswählen."; return; }

    treeRelationshipSelection = { personAId, personBId };
    const treeSelectElement = document.getElementById("tree-person-select");
    if (treeSelectElement && personAId && treePerson(personAId)) {
      treeSelectElement.value = personAId;
      renderStammbaum(personAId);
    }
    if (found.path === null) { result.innerHTML = `<strong>${escTree(found.relation)}</strong>`; return; }
    result.innerHTML = `<strong>${escTree(found.relation)}</strong>${found.sentence ? `<div class="tree-relationship-sentence">${escTree(found.sentence)}</div>` : ""}${found.pathText ? `<div class="tree-relationship-path"><span class="tree-relationship-path-title">So ergibt sich die Beziehung:</span>${escTree(found.pathText)}</div>` : ""}${found.path?.length ? treeRelationshipPathGraphic(a.value, found.path) : ""}`;
  });
}

function treePersonSearchText(person) {
  return personenAuswahlText(person);
}

// v334: Suche im Stammbaum – schnell und ohne Wartezeit auf das Laden des Stammbaums.
// Ablauf: Vorschläge kommen sofort aus dem bereits geladenen Bestand (personenCache); sobald die
// Stammbaum-Daten da sind, werden sie verwendet. Die Vorschlagsliste ist auf wenige Einträge begrenzt,
// weil das System-Auswahlmenü von Safari mit langen Listen deutlich langsamer wird.
const TREE_VORSCHLAEGE_MAX = 12;

function treeSearchTokens(value, ohneJahre = false) {
  return PersonSuche.zerlege(value, ohneJahre);
}

// Löst auch vollständige Vorschlagstexte mit Ledigenname und Jahresangaben auf.
function resolveTreePersonSearch(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return [];
  const normalized = PersonSuche.normalisiere(value);
  const index = getTreePersonSearchIndex();
  const exactLabel = index.filter(entry => entry.labelNorm === normalized);
  if (exactLabel.length) return exactLabel;
  const tokens = PersonSuche.zerlege(value, true);
  if (!tokens.length) return [];
  return index.filter(entry => tokens.every(token => entry.names.includes(token)));
}

let treePersonSearchIndexSource = null;
let treePersonSearchIndex = [];

let treeSuchFallbackQuelle = null;
let treeSuchFallbackLaenge = -1;
let treeSuchFallback = [];
function treeSuchPersonen() {
  if (treeData.personen && treeData.personen.length) return treeData.personen;
  if (typeof personenCacheGeladen !== "undefined" && personenCacheGeladen && Array.isArray(personenCache)) {
    if (treeSuchFallbackQuelle !== personenCache || treeSuchFallbackLaenge !== personenCache.length) {
      treeSuchFallbackQuelle = personenCache;
      treeSuchFallbackLaenge = personenCache.length;
      treeSuchFallback = personenCache.filter((p) => !treeIstPlatzhalter(p));
    }
    return treeSuchFallback;
  }
  return [];
}

function getTreePersonSearchIndex() {
  const people = treeSuchPersonen();
  if (treePersonSearchIndexSource !== people) {
    treePersonSearchIndexSource = people;
    treePersonSearchIndex = PersonSuche.eintraegeVon(people);
  }
  return treePersonSearchIndex;
}

let treeSelectBuiltFor = null;
let treeVorschlagKey = "";

function fillTreePersonSelect(searchValue = "", preferredId = "") {
  const select = document.getElementById("tree-person-select");
  const options = document.getElementById("tree-person-options");
  if (!select) return "";
  const index = getTreePersonSearchIndex();
  const previous = preferredId || select.value;

  // Das (versteckte) Auswahlfeld enthält immer alle Personen und wird nur einmal pro Datenstand aufgebaut.
  // So ist jede Person jederzeit auswählbar, auch wenn sie nicht unter den Vorschlägen steht.
  if (treeSelectBuiltFor !== index) {
    const fragment = document.createDocumentFragment();
    for (const entry of index) {
      const opt = document.createElement("option");
      opt.value = entry.person.id;
      opt.textContent = entry.label;
      fragment.appendChild(opt);
    }
    select.replaceChildren(new Option("— Person auswählen —", ""));
    select.appendChild(fragment);
    treeSelectBuiltFor = index;
    treeVorschlagKey = "";
  }

  const tokens = treeSearchTokens(searchValue);
  const matches = [];
  for (const entry of index) {
    if (!tokens.length || tokens.every(token => entry.search.includes(token))) {
      matches.push(entry);
      if (matches.length >= TREE_VORSCHLAEGE_MAX) break;
    }
  }

  // Vorschlagsliste nur dann neu aufbauen, wenn sie sich wirklich geändert hat.
  const key = matches.map(entry => entry.person.id).join("|");
  if (options && key !== treeVorschlagKey) {
    treeVorschlagKey = key;
    const fragment = document.createDocumentFragment();
    for (const entry of matches) {
      const suggestion = document.createElement("option");
      suggestion.value = entry.label;
      fragment.appendChild(suggestion);
    }
    options.replaceChildren(fragment);
  }

  if (previous && [...select.options].some(opt => opt.value === previous)) {
    select.value = previous;
  } else if (matches.length === 1) {
    select.value = matches[0].person.id;
  }
  return select.value;
}

function treeClassicPersonSort(aId, bId) {
  const a=treePerson(aId), b=treePerson(bId), da=a?.geburtsdatum||"", db=b?.geburtsdatum||"";
  if(da&&db&&da!==db) return da.localeCompare(db); if(da)return -1; if(db)return 1;
  return `${a?.nachname||""} ${a?.vorname||""}`.localeCompare(`${b?.nachname||""} ${b?.vorname||""}`,"de",{sensitivity:"base"});
}

// v204: fokussierter klassischer Stammbaum mit getrennten Generationsebenen. Genealogie ausschließlich aus
// familien + familien_kinder; keine Änderungen an der Datenbank.
function treeClassicFamilyInfo(rootId){
  const root=treePerson(rootId); if(!root)return null;
  const parentFamilies=(treeParentFamiliesForPerson(rootId)||[]).map(f=>({
    id:f.id,
    parentIds:[f.partner_a_id,f.partner_b_id].filter(Boolean).filter(id=>treePerson(id)),
    childIds:treeChildrenForFamily(f.id).map(x=>x.person?.id).filter(Boolean)
  }));
  const siblingIds=[]; const seen=new Set();
  parentFamilies.forEach(f=>f.childIds.forEach(id=>{if(id!==rootId&&!seen.has(id)&&treePerson(id)){seen.add(id);siblingIds.push(id)}}));
  const families=(treeFamiliesForPerson(rootId)||[]).map(f=>({
    id:f.id, familientyp:f.familientyp||"Partnerschaft",
    spouseId:[f.partner_a_id,f.partner_b_id].find(id=>id&&id!==rootId&&treePerson(id))||null,
    childIds:treeChildrenForFamily(f.id).map(x=>x.person?.id).filter(Boolean)
  }));
  parentFamilies.forEach(f=>f.parentIds.sort(treeClassicPersonSort)); siblingIds.sort(treeClassicPersonSort); families.forEach(f=>f.childIds.sort(treeClassicPersonSort));
  return {root,parentFamilies,parentIds:[...new Set(parentFamilies.flatMap(f=>f.parentIds))],siblingIds,families};
}

function treeClassicLine(svg,x1,y1,x2,y2,cls="tree-classic-family"){
  const e=document.createElementNS("http://www.w3.org/2000/svg","line");
  e.setAttribute("x1",Math.round(x1));e.setAttribute("y1",Math.round(y1));e.setAttribute("x2",Math.round(x2));e.setAttribute("y2",Math.round(y2));e.setAttribute("class",cls);svg.appendChild(e);
}
function treeClassicPositions(canvas){
  const c=canvas.getBoundingClientRect(),m=new Map();
  canvas.querySelectorAll("[data-classic-key]").forEach(e=>{const r=e.getBoundingClientRect();m.set(e.dataset.classicKey,{left:r.left-c.left,right:r.right-c.left,top:r.top-c.top,bottom:r.bottom-c.top,centerX:(r.left+r.right)/2-c.left});});
  return m;
}
function treeClassicConnectParents(svg,pos,family){
  const ps=family.parentIds.map(id=>pos.get(`person:${id}:parent`)).filter(Boolean);
  const ids=family.childIds.filter(id=>id===family.rootId||family.targetIds?.includes(id));
  const ts=ids.map(id=>pos.get(`person:${id}:middle`)).filter(Boolean); if(!ps.length||!ts.length)return;
  const pb=Math.max(...ps.map(p=>p.bottom)), tt=Math.min(...ts.map(p=>p.top)), by=pb+Math.max(22,Math.min(46,(tt-pb)*.42));
  if(ps.length>=2){const q=[...ps].sort((a,b)=>a.centerX-b.centerX),y=(Math.max(...q.map(p=>p.top))+Math.min(...q.map(p=>p.bottom)))/2;treeClassicLine(svg,q[0].right,y,q[q.length-1].left,y,"tree-classic-spouse");}
  const j=ps.length===1?ps[0].centerX:(Math.max(...ps.map(p=>p.left))+Math.min(...ps.map(p=>p.right)))/2;
  treeClassicLine(svg,j,pb,j,by); const xs=ts.map(p=>p.centerX); if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by); ts.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top));
}
function treeClassicConnectFamily(svg,pos,f){
  const r=pos.get(`family:${f.id}:root`),s=pos.get(`family:${f.id}:spouse`),cs=f.childIds.map(id=>pos.get(`family:${f.id}:child:${id}`)).filter(Boolean); if(!r||!s)return;
  const l=r.centerX<s.centerX?r:s, q=l===r?s:r, y=(Math.max(r.top,s.top)+Math.min(r.bottom,s.bottom))/2;
  treeClassicLine(svg,l.right,y,q.left,y,"tree-classic-spouse"); if(!cs.length)return;
  const by0=Math.max(r.bottom,s.bottom), ct=Math.min(...cs.map(p=>p.top)), by=by0+Math.max(22,Math.min(46,(ct-by0)*.42)), j=(l.right+q.left)/2;
  treeClassicLine(svg,j,by0,j,by); const xs=cs.map(p=>p.centerX); if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by); cs.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top));
}

function renderKlassischerStammbaum(rootId){
  treeCousinsRefreshIfOpen(rootId);
  const stage=document.getElementById("tree-classic-stage"); if(!stage)return; stage.innerHTML="";
  const info=treeClassicFamilyInfo(rootId); if(!info){stage.innerHTML='<div class="tree-classic-empty">Bitte eine Person auswählen.</div>';return;}
  const mobile=window.innerWidth<=700, card=mobile?125:145, gap=mobile?14:20, rowH=mobile?118:132, vw=document.getElementById("tree-viewport")?.clientWidth||window.innerWidth;
  const lineSurname=treeMaleAncestorSurname(rootId)||String(info.root.nachname||"").trim();
  const parents=[...info.parentIds].sort(treeClassicPersonSort), middle=[...info.siblingIds,rootId].sort(treeClassicPersonSort), families=info.families.filter(f=>f.spouseId||f.childIds.length);
  const blocks=families.map(f=>{const n=Math.max(2,f.childIds.length);return n*card+Math.max(0,n-1)*gap+36;}), familyW=blocks.reduce((a,b)=>a+b,0)+Math.max(0,blocks.length-1)*28;
  const rowW=ids=>Math.max(1,ids.length)*card+Math.max(0,ids.length-1)*gap;
  // v204: jede Generation bekommt eine eigene Kartenhöhe plus sicheren Zwischenraum.
  // Die Kinderzeile beginnt immer unterhalb der Partnerzeile, nicht auf Höhe der Geschwister.
  const cardHeight = mobile ? 148 : 158;
  const rowGap = mobile ? 58 : 66;
  const marginX = 32;
  const width=Math.max(vw-24,rowW(parents)+marginX*2,rowW(middle)+marginX*2,familyW+marginX*2,620), yp=48, ym=yp+cardHeight+rowGap, yf=ym+cardHeight+rowGap, ycSingle=yf+cardHeight+rowGap, ycMulti=yf+cardHeight+rowGap, height=families.length?(families.length===1?ycSingle+cardHeight+70:ycMulti+cardHeight+70):ym+cardHeight+70;
  const canvas=document.createElement("div");canvas.className="tree-classic-canvas tree-classic-canvas--focused";canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.classList.add("tree-classic-svg");canvas.appendChild(svg);
  const label=(t,y)=>{const e=document.createElement("div");e.className="tree-classic-level__label";e.textContent=t;e.style.top=`${y-27}px`;canvas.appendChild(e);};
  const node=(id,key,x,y,extra="")=>{const p=treePerson(id);if(!p)return;const e=document.createElement("div");e.className=`tree-classic-node ${extra} ${id===rootId?"tree-classic-node--root":""}`.trim();e.dataset.classicPerson=id;e.dataset.classicKey=key;e.style.left=`${x}px`;e.style.top=`${y}px`;e.style.width=`${card}px`;e.innerHTML=treePersonCard(p,rootId,"",lineSurname);canvas.appendChild(e);};
  const row=(ids,y,text,suffix,extra="")=>{if(!ids.length)return[];label(text,y);const total=rowW(ids),keys=[];let x=(width-total)/2;ids.forEach(id=>{const k=`person:${id}:${suffix}`;node(id,k,x,y,extra);keys.push(k);x+=card+gap;});return keys;};
  row(parents,yp,"Eltern","parent","tree-classic-nodes--parents");
  row(middle,ym,info.siblingIds.length?"Ausgangsperson und Geschwister":"Ausgangsperson","middle","tree-classic-nodes--middle");

  if(families.length===1){
    label("Eigener Familienzweig",yf);
    const f=families[0],re=canvas.querySelector(`[data-classic-key="person:${rootId}:middle"]`);
    // Der eigene Familienzweig liegt bewusst unterhalb der Geschwisterzeile.
    if(f.spouseId&&re){const rx=parseFloat(re.style.left),right=rx+card+gap,left=rx-card-gap,sx=right+card<=width-24?right:left;node(f.spouseId,`family:${f.id}:spouse`,sx,yf,"tree-classic-node--spouse");}
    if(f.childIds.length){label("Kinder",ycSingle);const total=rowW(f.childIds);let x=(width-total)/2;f.childIds.forEach(id=>{node(id,`family:${f.id}:child:${id}`,x,ycSingle,"tree-classic-node--children");x+=card+gap;});}
  } else if(families.length>1){
    label("Partnerschaften",yf);let x=(width-familyW)/2;
    families.forEach((f,i)=>{const bw=blocks[i],pair=f.spouseId?2*card+gap:card,px=x+(bw-pair)/2;node(rootId,`family:${f.id}:root`,px,yf,"tree-classic-node--family-root");if(f.spouseId)node(f.spouseId,`family:${f.id}:spouse`,px+card+gap,yf,"tree-classic-node--spouse");if(f.childIds.length){const total=rowW(f.childIds);let cx=x+(bw-total)/2;f.childIds.forEach(id=>{node(id,`family:${f.id}:child:${id}`,cx,ycMulti,"tree-classic-node--children");cx+=card+gap;});}x+=bw+28;});
    label("Kinder je Partnerschaft",ycMulti);
  }
  stage.appendChild(canvas);
  requestAnimationFrame(()=>{
    const pos=treeClassicPositions(canvas);svg.innerHTML="";svg.setAttribute("viewBox",`0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);svg.setAttribute("width",canvas.clientWidth);svg.setAttribute("height",canvas.clientHeight);
    for(const f of info.parentFamilies){f.rootId=rootId;f.targetIds=info.siblingIds;treeClassicConnectParents(svg,pos,f);}
    if(families.length===1){const f=families[0],r=pos.get(`person:${rootId}:middle`),s=pos.get(`family:${f.id}:spouse`),cs=f.childIds.map(id=>pos.get(`family:${f.id}:child:${id}`)).filter(Boolean);if(r&&s){const l=r.centerX<s.centerX?r:s,q=l===r?s:r,y=(Math.max(r.top,s.top)+Math.min(r.bottom,s.bottom))/2;treeClassicLine(svg,l.right,y,q.left,y,"tree-classic-spouse");const j=(r.centerX+s.centerX)/2;treeClassicLine(svg,r.centerX,r.bottom,r.centerX,y);if(cs.length){const pb=Math.max(r.bottom,s.bottom),ct=Math.min(...cs.map(p=>p.top)),by=pb+Math.max(22,Math.min(46,(ct-pb)*.42));treeClassicLine(svg,j,y,j,by);const xs=cs.map(p=>p.centerX);if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by);cs.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top));}}else if(families.length===1&&f.childIds.length){const r=pos.get(`person:${rootId}:middle`),cs=f.childIds.map(id=>pos.get(`family:${f.id}:child:${id}`)).filter(Boolean);if(r&&cs.length){const by=r.bottom+Math.max(22,Math.min(46,(Math.min(...cs.map(p=>p.top))-r.bottom)*.42));treeClassicLine(svg,r.centerX,r.bottom,r.centerX,by);const xs=cs.map(p=>p.centerX);if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by);cs.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top));}}}
    if(families.length>1)families.forEach(f=>treeClassicConnectFamily(svg,pos,f));
  });
  canvas.querySelectorAll("[data-classic-person]").forEach(el=>{el.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const id=el.dataset.classicPerson;if(!id)return;const s=document.getElementById("tree-person-select");if(s)s.value=id;renderStammbaum(id);});el.addEventListener("dblclick",async e=>{e.preventDefault();e.stopPropagation();const id=el.dataset.classicPerson;if(!id)return;const s=document.getElementById("tree-person-select");if(s)s.value=id;await openPersonDetail(id,{fromTree:true});});});
}

// ---------- v342: 3D-Wurzelbaum (Prototyp) ----------
// Die Ansicht liegt in tree3d.js und wird erst beim ersten Öffnen geladen (samt three.js vom CDN).
// Sie nutzt nur bereits geladene Namen und Jahre – es werden keine zusätzlichen Daten oder Fotos von Supabase abgerufen.
let treeModul3D = null;
let tree3dLadeLauf = 0;
let tree3dGens = 5;

async function renderBaum3D(rootId) {
  const stage = document.getElementById("tree-3d-stage");
  const message = document.getElementById("tree-message");
  if (!stage) return;
  if (!treePerson(rootId)) {
    stage.innerHTML = '<div class="tree-empty">Bitte eine Person auswählen.</div>';
    return;
  }
  // Daten sofort zusammenstellen (solange ein Linienfilter aktiv ist), erst danach das Modul laden.
  const gens = tree3dGens;
  const knoten = treePedigreeCollect(rootId, gens).map((k) => ({
    gen: k.gen, idx: k.idx, id: k.person ? k.person.id : null,
    name: k.person ? treeKompaktLabel(k.person) : "", jahre: k.person ? PersonSuche.jahre(k.person) : "",
    geschlecht: k.person ? treePersonGender(k.person) : "u", rolle: k.rolle
  }));
  const bekannt = knoten.filter((k) => k.id && k.gen > 0).length;
  const titel = treePersonLabel(rootId);
  const linie = treeActivePreset?.label ? ` · Linie: ${treeActivePreset.label}` : "";
  const lauf = ++tree3dLadeLauf;
  try {
    if (!treeModul3D) {
      stage.innerHTML = '<div class="tree-empty">3D-Ansicht wird geladen …</div>';
      treeModul3D = await import("./tree3d.js?v=366");
    }
    if (lauf !== tree3dLadeLauf || treeViewMode !== "tree3d") return;
    await treeModul3D.baumZeigen(stage, { rootId, gens, knoten, titel }, {
      alsMitte: (id) => {
        const auswahl = document.getElementById("tree-person-select");
        if (auswahl) auswahl.value = id;
        renderStammbaum(id);
      },
      oeffnen: async (id) => {
        const auswahl = document.getElementById("tree-person-select");
        if (auswahl) auswahl.value = id;
        await openPersonDetail(id, { fromTree: true });
      }
    });
    if (lauf === tree3dLadeLauf && treeViewMode === "tree3d") treeModul3D.fortsetzen();
    if (message) message.textContent = `Wurzelbaum von ${titel} · ${bekannt} von ${2 ** gens - 2} Vorfahren in ${gens} Generationen erfasst${linie}`;
  } catch (err) {
    debugLog(`❌ 3D-Ansicht: ${err.message || err}`);
    stage.innerHTML = `<div class="tree-empty">Die 3D-Ansicht konnte nicht geladen werden.<br><small>${escTree(err.message || String(err))}</small><br><small>Sie braucht beim ersten Öffnen eine Internetverbindung.</small></div>`;
    treeModul3D = null;
  }
}

function setTreeViewMode(mode, rootId = "") {
  const vorherigeAnsicht = treeViewMode;
  treeViewMode = ["classic", "pedigree", "descendants", "tree3d"].includes(mode) ? mode : "cards";
  if (vorherigeAnsicht === "tree3d" && treeViewMode !== "tree3d" && treeModul3D) treeModul3D.pausieren();
  const panel = document.getElementById("tab-stammbaum");
  const cardStage = document.getElementById("tree-stage");
  const classicStage = document.getElementById("tree-classic-stage");
  const pedigreeStage = document.getElementById("tree-pedigree-stage");
  if (panel) {
    panel.classList.toggle("tree-view--classic", treeViewMode === "classic");
    panel.classList.toggle("tree-view--pedigree", treeViewMode === "pedigree");
    panel.classList.toggle("tree-view--descendants", treeViewMode === "descendants");
    panel.classList.toggle("tree-view--3d", treeViewMode === "tree3d");
  }
  const dreiDStage = document.getElementById("tree-3d-stage");
  if (dreiDStage) dreiDStage.hidden = treeViewMode !== "tree3d";
  if (cardStage) cardStage.hidden = treeViewMode !== "cards";
  if (classicStage) classicStage.hidden = treeViewMode !== "classic";
  if (pedigreeStage) pedigreeStage.hidden = treeViewMode !== "pedigree";
  const nachkommenStage = document.getElementById("tree-descendants-stage");
  if (nachkommenStage) nachkommenStage.hidden = treeViewMode !== "descendants";
  const listenSteuerung = document.getElementById("tree-list-controls");
  if (listenSteuerung) listenSteuerung.hidden = treeViewMode !== "descendants";
  for (const [id, art] of [["tree-view-cards", "cards"], ["tree-view-classic", "classic"], ["tree-view-pedigree", "pedigree"], ["tree-view-descendants", "descendants"], ["tree-view-3d", "tree3d"]]) {
    const knopf = document.getElementById(id);
    if (!knopf) continue;
    knopf.classList.toggle("is-active", treeViewMode === art);
    knopf.setAttribute("aria-selected", treeViewMode === art ? "true" : "false");
  }
  const generationen = document.getElementById("tree-pedigree-gens-wrap");
  if (generationen) generationen.hidden = treeViewMode !== "pedigree" && treeViewMode !== "tree3d";
  const generationenAuswahl = document.getElementById("tree-pedigree-gens");
  if (generationenAuswahl && (treeViewMode === "pedigree" || treeViewMode === "tree3d")) {
    generationenAuswahl.value = String(treeViewMode === "tree3d" ? tree3dGens : treePedigreeGens);
  }
  const select = document.getElementById("tree-person-select");
  const id = rootId || select?.value || treeStandardPerson();
  renderStammbaum(id);
}

// Daten nur neu laden, wenn sie älter sind (spart Wartezeit und Datenverkehr bei „Auswahl bestätigen“).
async function treeDatenAktualisieren(maxAlterMs = 120000) {
  if (treeData.personen.length && Date.now() - treeDataGeladenAm < maxAlterMs) return;
  await loadStammbaumData();
}

async function loadStammbaum() {
  const message = document.getElementById("tree-message");
  const select = document.getElementById("tree-person-select");
  const search = document.getElementById("tree-person-search");
  try {
    message.textContent = "Stammbaum wird geladen …";
    // Vorschläge sofort aus dem Bestand anbieten, solange der Stammbaum noch lädt.
    fillTreePersonSelect(search?.value || "", select.value);
    await loadStammbaumData({ nachStruktur: () => fillTreePersonSelect(search?.value || "", select.value) });
    if (!treeData.personen.length) {
      select.innerHTML = '<option value="">— keine Personen vorhanden —</option>';
      renderStammbaum("");
      message.textContent = "";
      return;
    }
    const current = select.value && treePerson(select.value) ? select.value : treeStandardPerson();
    fillTreePersonSelect(search?.value || "", current);
    if (!select.value) {
      select.value = current;
    }
    renderStammbaum(select.value);
    fillTreeRelationshipSelects();
    message.textContent = "";
  } catch (err) {
    message.textContent = `Fehler beim Laden des Stammbaums: ${err.message || err}`;
    debugLog(`❌ Stammbaum: ${err.message || err}`);
  }
}

function updateTreeZoom() {
  const stage = document.getElementById("tree-stage");
  const classicStage = document.getElementById("tree-classic-stage");
  const pedigreeStage = document.getElementById("tree-pedigree-stage");
  const value = document.getElementById("tree-zoom-value");
  if (stage) stage.style.transform = `scale(${treeZoom})`;
  if (classicStage) classicStage.style.transform = `scale(${treeZoom})`;
  if (pedigreeStage) pedigreeStage.style.transform = `scale(${treeZoom})`;
  if (value) value.textContent = `${Math.round(treeZoom * 100)} %`;
}

// v343: Ist im Stammbaum noch keine Person gewählt, werden Hubert und Luise Ganahl gezeigt
// (Hubert als Ausgangsperson, Luise erscheint als seine Partnerin). Fallback: Luise, sonst die erste Person.
function treeStandardPerson() {
  const hubert = treeFindPresetPerson(["hubert"], "Ganahl");
  if (hubert) return hubert.id;
  const luise = treeFindPresetPerson(["luise"], "Ganahl");
  if (luise) return luise.id;
  return treeData.personen[0]?.id || "";
}

function treeFindPresetPerson(tokens, surname) {
  const normalizedSurname = treeNormalizeName(surname);
  const normalizedTokens = tokens.map(treeNormalizeName);
  const candidates = treeData.personen.filter(person => {
    const full = treeNormalizeName(`${person.vorname || ""} ${person.nachname || ""}`);
    const last = treeNormalizeName(person.nachname || "");
    return last === normalizedSurname && normalizedTokens.every(token => full.includes(token));
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function treeFindMangengRosina() {
  return treePerson("76e39d37-663f-4324-b496-7983ba905d77") || null;
}

function treeFindMangengJosef(rosinaId) {
  const josefId = "6a205f8e-b334-4d70-8b68-75782568e631";
  const familyId = "a15c4a14-e6f8-4929-99b5-29d9d4a6c54a";
  const family = treeData.familien.find(row => row.id === familyId);
  if (family && [family.partner_a_id, family.partner_b_id].includes(rosinaId) &&
      [family.partner_a_id, family.partner_b_id].includes(josefId)) return treePerson(josefId) || null;
  return treePerson(josefId) || null;
}

function treePresetGenderMatches(person, direction) {
  const gender = treeNormalizeName(person?.geschlecht || "");
  if (direction === "paternal") return /^(m|mann|maennlich|männlich|male|vater)$/.test(gender);
  if (direction === "maternal") return /^(w|f|frau|weiblich|female|mutter)$/.test(gender);
  return true;
}

// v338: Eine Stammlinie ist ein Filter (Startpersonen + Richtung der Vorfahren) und gilt für alle Ansichten.
let treeActivePreset = null;   // { roots, direction, label } – solange gesetzt, wird jede Ansicht mit dem Filter gerendert
let treeFilterAktiv = false;

function treePresetZuruecksetzen() {
  treeActivePreset = null;
  const auswahl = document.getElementById("tree-line-preset");
  if (auswahl) auswahl.value = "";
}

function treeStageIdFuerAnsicht() {
  return treeViewMode === "classic" ? "tree-classic-stage"
    : treeViewMode === "pedigree" ? "tree-pedigree-stage"
    : treeViewMode === "descendants" ? "tree-descendants-stage"
    : treeViewMode === "tree3d" ? "tree-3d-stage"
    : "tree-stage";
}

function treePresetFilter(roots, direction) {
  const originalFamilies = treeData.familien;
  const originalChildren = treeData.kinder;
  const ancestorIds = new Set(roots);
  const ancestryFamilyIds = new Set();
  let frontier = [...roots];
  for (let depth = 0; depth < 20 && frontier.length; depth += 1) {
    const next = [];
    for (const childId of frontier) {
      for (const link of originalChildren.filter(row => row.kind_id === childId)) {
        const family = originalFamilies.find(row => row.id === link.familie_id);
        if (!family) continue;
        const parentIds = [family.partner_a_id, family.partner_b_id].filter(Boolean);
        const eligible = direction === "both" ? parentIds : parentIds.filter(id => treePresetGenderMatches(treePerson(id), direction));
        if (!eligible.length) continue;
        ancestryFamilyIds.add(family.id);
        for (const parentId of eligible) if (!ancestorIds.has(parentId)) { ancestorIds.add(parentId); next.push(parentId); }
      }
    }
    frontier = next;
  }
  const includedIds = new Set(ancestorIds);
  const relevantFamilyIds = new Set(ancestryFamilyIds);
  frontier = [...includedIds];
  for (let depth = 0; depth < 30 && frontier.length; depth += 1) {
    const next = [];
    for (const personId of frontier) {
      for (const family of originalFamilies) {
        if (family.partner_a_id !== personId && family.partner_b_id !== personId) continue;
        relevantFamilyIds.add(family.id);
        for (const link of originalChildren) {
          if (link.familie_id !== family.id || !link.kind_id || includedIds.has(link.kind_id)) continue;
          includedIds.add(link.kind_id); next.push(link.kind_id);
        }
      }
    }
    frontier = next;
  }
  const relevantFamilies = originalFamilies.filter(family => relevantFamilyIds.has(family.id));
  const relevantIds = new Set(relevantFamilies.map(family => family.id));
  return { familien: relevantFamilies, kinder: originalChildren.filter(link => relevantIds.has(link.familie_id)) };
}

function renderTreeLinePreset(rootIds, direction, label = "") {
  const roots = [...new Set((Array.isArray(rootIds) ? rootIds : [rootIds]).filter(Boolean))];
  if (!roots.length) return;
  treeActivePreset = { roots, direction, label };
  renderStammbaum(roots[0]);   // renderStammbaum wendet den Filter in jeder Ansicht selbst an
  requestAnimationFrame(() => {
    const stage = document.getElementById(treeStageIdFuerAnsicht());
    if (treeViewMode === "descendants" || treeViewMode === "tree3d") { document.getElementById("tree-viewport")?.scrollTo({ top: 0 }); return; }
    const rootCard = stage?.querySelector(`[data-tree-person="${CSS.escape(roots[0])}"]`);
    centerTreeViewport(rootCard || stage);
  });
}

function applyTreeLinePreset(value) {
  const message = document.getElementById("tree-message");
  const select = document.getElementById("tree-person-select");
  const search = document.getElementById("tree-person-search");
  const presets = {
    "gawatsch-linie": { personType: "mangeng-couple", direction: "both", label: "Gawatsch Linie" },
    "reinhard-linie": { tokens: ["hubert"], direction: "both", label: "Reinhard Linie" },
    "fall-linie": { tokens: ["luise"], direction: "maternal", label: "Fall Linie" }
  };
  const preset = presets[value];
  if (!preset) {
    // „— Stammlinie auswählen —“: Filter aufheben und die aktuelle Person ungefiltert zeigen.
    if (treeActivePreset) {
      treeActivePreset = null;
      if (select?.value) renderStammbaum(select.value);
      if (message) message.textContent = "Linienfilter aufgehoben.";
    }
    return;
  }
  const root = preset.personType === "mangeng-couple"
    ? treeFindMangengRosina()
    : treeFindPresetPerson(preset.tokens, "Ganahl");
  if (!root) {
    if (message) message.textContent = `Ausgangspunkt für „${preset.label}“ konnte nicht eindeutig gefunden werden. Bitte Personendaten prüfen.`;
    return;
  }
  const roots = [root.id];
  if (preset.personType === "mangeng-couple") {
    const josef = treeFindMangengJosef(root.id);
    if (!josef) {
      if (message) message.textContent = "Josef Mangeng konnte nicht eindeutig gefunden werden. Bitte die Partnerschaft mit Rosina Mangeng, geb. Schuler, prüfen.";
      return;
    }
    roots.push(josef.id);
  }
  if (select) select.value = root.id;
  if (search) search.value = "";
  const confirm = document.getElementById("tree-person-confirm");
  if (confirm) confirm.disabled = true;
  if (treeViewMode === "classic") setTreeViewMode("cards", root.id);   // eine Linie braucht die Gesamtübersicht
  renderTreeLinePreset(roots, preset.direction, preset.label);
  if (message) message.textContent = `${preset.label} angezeigt. Der Stammbaum wurde automatisch neu aufgebaut.`;
}

const treeSelect = document.getElementById("tree-person-select");
const treePersonSearch = document.getElementById("tree-person-search");
const treePersonConfirm = document.getElementById("tree-person-confirm");
let treeSearchDebounce = null;
function centerTreeViewport(target) {
  const viewport = document.getElementById("tree-viewport");
  if (!viewport || !target) return;
  const vr = viewport.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  viewport.scrollTo({
    left: Math.max(0, viewport.scrollLeft + (tr.left + tr.width / 2 - (vr.left + vr.width / 2))),
    top: Math.max(0, viewport.scrollTop + (tr.top + tr.height / 2 - (vr.top + vr.height / 2))),
    behavior: "smooth"
  });
}
function setTreePersonSelection(id, { confirmed = false } = {}) {
  if (!treeSelect || !id || !treePerson(id)) return;
  treeSelect.value = id;
  treePresetZuruecksetzen();   // eine bewusst gewählte Person wird ohne Linienfilter gezeigt
  renderStammbaum(id);
  requestAnimationFrame(() => {
    if (treeViewMode === "descendants" || treeViewMode === "tree3d") { document.getElementById("tree-viewport")?.scrollTo({ top: 0 }); return; }
    const stage = document.getElementById(treeStageIdFuerAnsicht());
    const rootCard = stage?.querySelector(`[data-tree-person="${CSS.escape(id)}"]`);
    centerTreeViewport(rootCard || stage);
  });
  if (confirmed) {
    const message = document.getElementById("tree-message");
    if (message) message.textContent = `Auswahl bestätigt: ${treePersonSearchText(treePerson(id))}`;
    if (treePersonSearch) treePersonSearch.value = "";
  }
}
if (treeSelect) treeSelect.addEventListener("change", () => setTreePersonSelection(treeSelect.value));
const treeLinePreset = document.getElementById("tree-line-preset");
if (treeLinePreset) treeLinePreset.addEventListener("change", () => applyTreeLinePreset(treeLinePreset.value));
function refreshTreeConfirmButton() {
  if (!treePersonConfirm) return;
  const query = String(treePersonSearch?.value || "").trim();
  const selectedId = treeSelect?.value || "";
  treePersonConfirm.disabled = !(query ? resolveTreePersonSearch(query).length > 0 : Boolean(selectedId && treePerson(selectedId)));
}
if (treePersonSearch) {
  const updateTreeSearch = () => {
    if (treeSearchDebounce) clearTimeout(treeSearchDebounce);
    treeSearchDebounce = setTimeout(() => {
      fillTreePersonSelect(treePersonSearch.value, "");
      refreshTreeConfirmButton();
    }, 60);
  };
  treePersonSearch.addEventListener("focus", () => fillTreePersonSelect(treePersonSearch.value, ""));
  treePersonSearch.addEventListener("input", updateTreeSearch);
  treePersonSearch.addEventListener("change", updateTreeSearch);
  treePersonSearch.addEventListener("blur", () => setTimeout(refreshTreeConfirmButton, 0));
}
if (treePersonConfirm) treePersonConfirm.addEventListener("click", async () => {
  const rawQuery = String(treePersonSearch?.value || "").trim();
  const query = treeNormalizeName(rawQuery);
  const selectedFromDropdown = treeSelect?.value || "";
  const message = document.getElementById("tree-message");

  // Bereits ausgewählte Person aus dem nativen Auswahlfeld direkt übernehmen.
  if (!query && selectedFromDropdown && treePerson(selectedFromDropdown)) {
    try {
      treePersonConfirm.disabled = true;
      if (message) message.textContent = "Stammbaum wird aktualisiert …";
      await treeDatenAktualisieren();
      if (!treePerson(selectedFromDropdown)) throw new Error("Die ausgewählte Person ist in den aktualisierten Daten nicht mehr vorhanden.");
      fillTreePersonSelect("", selectedFromDropdown);
      setTreePersonSelection(selectedFromDropdown, { confirmed: true });
      fillTreeRelationshipSelects();
      if (message) message.textContent = `Auswahl bestätigt und Stammbaum aktualisiert: ${treePersonSearchText(treePerson(selectedFromDropdown))}`;
    } catch (err) {
      if (message) message.textContent = `Aktualisierung fehlgeschlagen: ${err.message || err}`;
      debugLog(`❌ Stammbaum-Aktualisierung: ${err.message || err}`);
    } finally {
      treePersonConfirm.disabled = true;
    }
    return;
  }

  if (!query) {
    if (message) message.textContent = "Bitte zuerst eine Person eingeben oder im Auswahlfeld auswählen.";
    return;
  }

  // Datalist-Text zuverlässig auflösen; Metadaten wie „geb.“ und Jahreszahlen stören nicht.
  const matches = resolveTreePersonSearch(rawQuery);
  if (matches.length !== 1) {
    if (message) message.textContent = matches.length > 1
      ? `Mehrere Personen passen (${matches.length}). Bitte den vollständigen Vorschlag mit Geburtsjahr auswählen.`
      : "Keine passende Person gefunden. Bitte einen Vorschlag aus der Liste auswählen oder genauer suchen.";
    return;
  }

  const selectedId = matches[0].person.id;
  treePersonConfirm.disabled = true;
  if (message) message.textContent = "Stammbaum wird aktualisiert …";
  try {
    await treeDatenAktualisieren();
    if (!treePerson(selectedId)) throw new Error("Die ausgewählte Person ist in den aktualisierten Daten nicht mehr vorhanden.");
    fillTreePersonSelect("", selectedId);
    if (treePersonSearch) treePersonSearch.value = "";
    setTreePersonSelection(selectedId, { confirmed: true });
    fillTreeRelationshipSelects();
    if (message) message.textContent = `Auswahl bestätigt und Stammbaum aktualisiert: ${treePersonSearchText(treePerson(selectedId))}`;
  } catch (err) {
    if (message) message.textContent = `Aktualisierung fehlgeschlagen: ${err.message || err}`;
    debugLog(`❌ Stammbaum-Aktualisierung: ${err.message || err}`);
  } finally {
    treePersonConfirm.disabled = true;
  }
});
const treeZoomIn = document.getElementById("tree-zoom-in");
const treeZoomOut = document.getElementById("tree-zoom-out");
const treeReset = document.getElementById("tree-reset");
if (treeZoomIn) treeZoomIn.addEventListener("click", () => { treeZoom = Math.min(1.5, +(treeZoom + 0.1).toFixed(2)); updateTreeZoom(); });
if (treeZoomOut) treeZoomOut.addEventListener("click", () => { treeZoom = Math.max(0.6, +(treeZoom - 0.1).toFixed(2)); updateTreeZoom(); });
if (treeReset) treeReset.addEventListener("click", () => { treeZoom = 1; updateTreeZoom(); });
const treeViewCards = document.getElementById("tree-view-cards");
const treeViewClassic = document.getElementById("tree-view-classic");
if (treeViewCards) treeViewCards.addEventListener("click", () => setTreeViewMode("cards"));
if (treeViewClassic) treeViewClassic.addEventListener("click", () => setTreeViewMode("classic"));
setTreeViewMode(treeViewMode);   // Startzustand der Ansichtstasten und Flächen
const treeView3D = document.getElementById("tree-view-3d");
if (treeView3D) treeView3D.addEventListener("click", () => {
  setTreeViewMode("tree3d");
  // Auf dem Handy liegt die Zeichenfläche unter den Bedienfeldern: bei Bedarf ins Bild holen.
  setTimeout(() => document.querySelector("#tab-stammbaum .tree-viewport-bar")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
});
const treeViewDescendants = document.getElementById("tree-view-descendants");
if (treeViewDescendants) treeViewDescendants.addEventListener("click", () => setTreeViewMode("descendants"));
const treeViewPedigree = document.getElementById("tree-view-pedigree");
if (treeViewPedigree) treeViewPedigree.addEventListener("click", () => setTreeViewMode("pedigree"));
const treePedigreeGensSelect = document.getElementById("tree-pedigree-gens");
if (treePedigreeGensSelect) treePedigreeGensSelect.addEventListener("change", () => {
  const wert = Math.min(6, Math.max(2, Number(treePedigreeGensSelect.value) || 4));
  if (treeViewMode === "tree3d") tree3dGens = wert; else treePedigreeGens = wert;
  if ((treeViewMode === "pedigree" || treeViewMode === "tree3d") && treeSelect?.value) renderStammbaum(treeSelect.value);
});
window.addEventListener("resize", () => { if (treeViewMode === "pedigree" && treeSelect?.value) renderAhnentafel(treeSelect.value); });
window.addEventListener("resize", () => { if (treeViewMode === "classic" && treeSelect?.value) renderKlassischerStammbaum(treeSelect.value); });
updateTreeZoom();
initTreeRelationshipUI();
initTreeRelationFields();
initTreeSuggestions();
initTreeDescendants();
initTreeCousinsUI();

// ===================== v362: Hausblätter-Import, Stufe 1 (nur Eigentümer) =====================
// Lädt eine Import-Datei (format „familienspuren-import“), zeigt Abweichungen bei vorhandenen
// Personen und die Frage „gleiche Person?“. Geändert wird nur nach Bestätigung, neue Personen
// werden in dieser Stufe nicht angelegt. Entscheidungen werden auf dem Gerät gemerkt.
const ImportAssistent = (() => {
  const FELD = { geburt: "Geburt", tod: "Tod", vorname: "Vorname" };
  let paket = null, personByKey = new Map(), bestand = new Map(), partnerText = new Map(), zustand = { abw: {}, gleich: {} }, nurOffene = true;
  const $ = (id) => document.getElementById(id);
  const speicherKey = () => `fs-import-${paket?.id || "unbekannt"}`;
  const heute = () => new Date().toISOString().slice(0, 10);
  function zustandLaden() {
    try { const z = JSON.parse(localStorage.getItem(speicherKey()) || "null"); if (z && z.abw && z.gleich) return z; } catch { /* leer */ }
    return { abw: {}, gleich: {} };
  }
  function zustandSichern() { try { localStorage.setItem(speicherKey(), JSON.stringify(zustand)); } catch { /* Gerät erlaubt keinen Speicher */ } }
  const meldung = (t) => { const m = $("imp-message"); if (m) m.textContent = t || ""; };

  // „TT.MM.JJJJ“ oder „JJJJ“ → { datum, jahr }; ungültig → null
  function textZuDatum(text) {
    const s = String(text || "").trim();
    let m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (m) {
      const d = +m[1], mo = +m[2], y = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
      if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
      return { datum: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, jahr: null };
    }
    m = s.match(/^(\d{4})$/);
    return m ? { datum: null, jahr: +m[1] } : null;
  }
  function bestandWert(p, feld) {
    if (!p) return "";
    if (feld === "vorname") return p.vorname || "";
    const w = feld === "geburt" ? "geburts" : "sterbe";
    return String(p[`${w}datum`] || "").slice(0, 10) || (p[`${w}jahr`] ? String(p[`${w}jahr`]) : "");
  }
  function zeige(feld, w) {
    if (feld === "vorname") return w || "–";
    if (!w) return "leer";
    return /^\d{4}-\d{2}-\d{2}$/.test(w) ? personViewDatum(w) : w;
  }
  const gleichWert = (feld, a, b) => feld === "vorname" ? String(a || "").trim() === String(b || "").trim() : String(a || "") === String(b || "");
  function hbAlsBestandsform(a) {
    if (a.feld === "vorname") return a.hausblatt;
    const w = textZuDatum(a.hausblatt);
    return w ? (w.datum || String(w.jahr)) : "";
  }
  const lebensdaten = (geb, tod) => [geb ? `* ${geb}` : "", tod ? `† ${tod}` : ""].filter(Boolean).join(" ");
  const bestandDaten = (p) => lebensdaten(zeige("geburt", bestandWert(p, "geburt")) === "leer" ? "" : zeige("geburt", bestandWert(p, "geburt")),
    zeige("tod", bestandWert(p, "tod")) === "leer" ? "" : zeige("tod", bestandWert(p, "tod")));
  const bestandName = (p) => plausName(p);

  async function dateiLaden(file) {
    if (typeof rolleIstEigentuemer === "function" && zugang?.rolle && !rolleIstEigentuemer()) { meldung("Der Import ist dem Eigentümer vorbehalten."); return; }
    meldung("Datei wird gelesen …");
    let daten;
    try { daten = JSON.parse(await file.text()); } catch { meldung("Die Datei ist keine gültige Import-Datei (JSON)."); return; }
    if (daten?.format !== "familienspuren-import" || !Array.isArray(daten.personen) || !Array.isArray(daten.abweichungen)) {
      meldung("Das ist keine Familienspuren-Import-Datei."); return;
    }
    if (Number(daten.version) > 1) { meldung("Diese Import-Datei ist für eine neuere App-Version. Bitte die App aktualisieren."); return; }
    paket = daten;
    personByKey = new Map(paket.personen.map((p) => [p.key, p]));
    const ids = new Set();
    for (const p of paket.personen) { if (p.bestand_id) ids.add(p.bestand_id); (p.kandidaten || []).forEach((i) => ids.add(i)); }
    for (const a of paket.abweichungen) if (a.bestand_id) ids.add(a.bestand_id);
    bestand = new Map();
    const liste = [...ids];
    try {
      for (let i = 0; i < liste.length; i += 80) {
        const { data, error } = await sb.from("personen")
          .select("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, taufbuch_link, sterbebuch_link")
          .in("id", liste.slice(i, i + 80));
        if (error) throw error;
        (data || []).forEach((p) => bestand.set(p.id, p));
      }
    } catch (err) { meldung(`Bestand konnte nicht geladen werden: ${err.message || err}`); return; }
    // Partner der vorgeschlagenen Personen laden (hilft bei „Gleiche Person?“)
    partnerText = new Map();
    try {
      const kandIds = [...new Set(paket.personen.flatMap((p) => p.kandidaten || []))];
      if (kandIds.length) {
        const [ra, rb] = await Promise.all([
          sb.from("familien").select("partner_a_id, partner_b_id, familientyp").in("partner_a_id", kandIds),
          sb.from("familien").select("partner_a_id, partner_b_id, familientyp").in("partner_b_id", kandIds)
        ]);
        const fams = [...(ra.data || []), ...(rb.data || [])].filter((f) => f.partner_a_id && f.partner_b_id && f.familientyp !== "Eltern");
        const andereIds = [...new Set(fams.flatMap((f) => [f.partner_a_id, f.partner_b_id]))].filter((i) => !bestand.has(i));
        const partner = new Map([...bestand]);
        for (let i = 0; i < andereIds.length; i += 80) {
          const { data } = await sb.from("personen").select("id, vorname, nachname, Ledigenname").in("id", andereIds.slice(i, i + 80));
          (data || []).forEach((p) => partner.set(p.id, p));
        }
        for (const f of fams) {
          for (const [x, y] of [[f.partner_a_id, f.partner_b_id], [f.partner_b_id, f.partner_a_id]]) {
            if (!kandIds.includes(x) || !partner.has(y)) continue;
            partnerText.set(x, [...(partnerText.get(x) || []), plausName(partner.get(y))]);
          }
        }
      }
    } catch (err) { debugLog(`⚠️ Import: Partner laden: ${err.message || err}`); }
    zustand = zustandLaden();
    for (const a of paket.abweichungen) {
      if (a.vorentschieden && !zustand.abw[a.id]) zustand.abw[a.id] = { wahl: a.vorentschieden.wahl, grund: a.vorentschieden.grund, am: paket.erstellt, vor: true };
    }
    zustandSichern();
    plan = null;
    await frueherenImportLaden();
    meldung("");
    render();
  }

  function abwStatus(a) {
    const p = bestand.get(a.bestand_id);
    if (!p) return "fehlt";
    if (zustand.abw[a.id]) return "erledigt";
    if (a.art === "feld" && gleichWert(a.feld, bestandWert(p, a.feld), hbAlsBestandsform(a))) return "gleich";
    if (a.art === "feld" && !gleichWert(a.feld, bestandWert(p, a.feld), a.bestand_vorher)) return "veraendert";
    return "offen";
  }
  const gleichFaelle = () => paket.personen.filter((p) => p.abgleich === "moeglich" || p.abgleich === "wahrscheinlich");

  function karteAbweichung(a) {
    const p = bestand.get(a.bestand_id), hb = personByKey.get(a.person_key) || {}, st = abwStatus(a);
    const name = p ? bestandName(p) : `${hb.vorname || ""} ${hb.nachname || ""}`;
    const link = a.feld === "tod" ? p?.sterbebuch_link : p?.taufbuch_link;
    const kopf = `<div class="imp-karte__kopf"><strong>${escapeHtml(name)}</strong>${p ? `<span class="imp-klein">${escapeHtml(bestandDaten(p))}</span>` : ""}
      <span class="imp-badge">${escapeHtml(a.art === "hinweis" ? "Hinweis" : FELD[a.feld] || a.feld)}</span></div>`;
    const werkzeuge = `<div class="imp-links">${p ? `<button type="button" class="btn btn--ghost imp-link" data-aktion="person" data-id="${escapeHtml(p.id)}">Person öffnen</button>` : ""}${link ? `<a class="btn btn--ghost imp-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">📖 ${a.feld === "tod" ? "Sterbebuch" : "Taufbuch"}</a>` : ""}</div>`;
    const hinweis = hb.unsicher ? `<p class="imp-klein imp-unsicher">Unsicher gelesen: ${escapeHtml(hb.unsicher)}</p>` : "";
    let mitte = "", fuss = "";
    if (a.art === "hinweis") {
      mitte = `<p>${escapeHtml(a.text)}</p><p class="imp-klein">${escapeHtml(a.quelle || "")}</p>`;
    } else {
      mitte = `<div class="imp-vergleich">
        <div><small>${escapeHtml(a.quelle || "Hausblatt")}</small><b>${escapeHtml(a.hausblatt)}</b></div>
        <div><small>Bestand</small><b>${escapeHtml(zeige(a.feld, bestandWert(p, a.feld)))}</b></div></div>`;
    }
    if (st === "fehlt") fuss = `<p class="imp-klein imp-warn">Diese Person ist im Bestand nicht mehr vorhanden.</p>`;
    else if (st === "erledigt") {
      const z = zustand.abw[a.id];
      const text = { bestand: "Bestand stimmt", hausblatt: "Hausblatt übernommen", anders: `Anderer Wert: ${z.wert || ""}`, gesehen: "Zur Kenntnis genommen" }[z.wahl] || z.wahl;
      fuss = `<p class="imp-erledigt">✓ ${escapeHtml(text)}${z.grund ? ` · ${escapeHtml(z.grund)}` : ""} <button type="button" class="btn btn--ghost imp-link" data-aktion="zuruecksetzen" data-id="${escapeHtml(a.id)}">ändern</button></p>`;
    } else if (st === "gleich") {
      fuss = `<p class="imp-erledigt">✓ Bestand entspricht bereits dem Hausblatt.</p>`;
    } else if (a.art === "hinweis") {
      fuss = `<div class="imp-knoepfe"><button type="button" class="btn btn--secondary" data-aktion="gesehen" data-id="${escapeHtml(a.id)}">Zur Kenntnis genommen</button></div>`;
    } else {
      fuss = `${st === "veraendert" ? `<p class="imp-klein imp-warn">Der Bestand wurde seit dem Erstellen der Datei geändert (damals: ${escapeHtml(zeige(a.feld, a.bestand_vorher))}).</p>` : ""}
        <div class="imp-knoepfe">
          <button type="button" class="btn btn--secondary" data-aktion="bestand" data-id="${escapeHtml(a.id)}">Bestand stimmt</button>
          <button type="button" class="btn btn--secondary" data-aktion="hausblatt" data-id="${escapeHtml(a.id)}">Hausblatt stimmt</button>
          <button type="button" class="btn btn--ghost" data-aktion="anders-zeigen" data-id="${escapeHtml(a.id)}">Anderer Wert …</button>
        </div>
        <div class="imp-anders" data-anders="${escapeHtml(a.id)}" hidden>
          <input type="text" ${a.feld === "vorname" ? "" : 'inputmode="numeric"'} placeholder="${a.feld === "vorname" ? "Vorname" : "TT.MM.JJJJ oder JJJJ"}" aria-label="Anderer Wert" value="${escapeHtml(a.feld === "vorname" ? a.hausblatt : "")}">
          <button type="button" class="btn btn--primary" data-aktion="anders" data-id="${escapeHtml(a.id)}">Übernehmen</button>
        </div>`;
    }
    return `<div class="imp-karte" data-status="${st}">${kopf}${mitte}${hinweis}${werkzeuge}${fuss}</div>`;
  }

  function karteGleich(hp) {
    const z = zustand.gleich[hp.key];
    const kand = (hp.kandidaten || []).map((id) => bestand.get(id)).filter(Boolean);
    const kopf = `<div class="imp-karte__kopf"><strong>${escapeHtml(`${hp.vorname} ${hp.nachname}`.trim())}</strong>
      <span class="imp-klein">${escapeHtml(lebensdaten(hp.geburt, hp.tod))}</span>
      <span class="imp-badge">${hp.abgleich === "wahrscheinlich" ? "Bitte bestätigen" : "Gleiche Person?"}</span></div>
      <p class="imp-klein">Hausblatt Innerberg Nr. ${escapeHtml((hp.haeuser || []).join(", "))}${(hp.kontext || []).length ? ` · ${escapeHtml(hp.kontext.slice(0, 3).join(" · "))}` : ""}</p>
      ${hp.unsicher ? `<p class="imp-klein imp-unsicher">Unsicher gelesen: ${escapeHtml(hp.unsicher)}</p>` : ""}`;
    const kandHtml = kand.map((p) => {
      const gewaehlt = z?.wahl === p.id;
      return `<div class="imp-kandidat${gewaehlt ? " is-gewaehlt" : ""}"><div><b>${escapeHtml(bestandName(p))}</b><span class="imp-klein">${escapeHtml(bestandDaten(p) || "ohne Lebensdaten")}</span>${partnerText.get(p.id) ? `<span class="imp-klein">verheiratet mit ${escapeHtml(partnerText.get(p.id).join(", "))}</span>` : ""}</div>
        <div class="imp-knoepfe"><button type="button" class="btn btn--ghost imp-link" data-aktion="person" data-id="${escapeHtml(p.id)}">Öffnen</button>
        ${z ? "" : `<button type="button" class="btn btn--secondary" data-aktion="gleich" data-key="${escapeHtml(hp.key)}" data-id="${escapeHtml(p.id)}">Ja, diese Person</button>`}</div></div>`;
    }).join("");
    const fuss = z
      ? `<p class="imp-erledigt">✓ ${z.wahl === "neu" ? "Neue Person (nicht im Bestand)" : "Ist dieselbe Person wie im Bestand"} <button type="button" class="btn btn--ghost imp-link" data-aktion="gleich-zuruecksetzen" data-key="${escapeHtml(hp.key)}">ändern</button></p>`
      : `<div class="imp-knoepfe"><button type="button" class="btn btn--secondary" data-aktion="gleich" data-key="${escapeHtml(hp.key)}" data-id="neu">Nein, neue Person</button></div>`;
    return `<div class="imp-karte" data-status="${z ? "erledigt" : "offen"}">${kopf}${kandHtml || '<p class="imp-klein imp-warn">Die vorgeschlagene Person ist im Bestand nicht mehr vorhanden.</p>'}${fuss}</div>`;
  }

  function render() {
    const bereich = $("imp-bereich");
    if (!bereich || !paket) return;
    const abw = paket.abweichungen, gl = gleichFaelle();
    const offenAbw = abw.filter((a) => ["offen", "veraendert"].includes(abwStatus(a))).length;
    const offenGl = gl.filter((p) => !zustand.gleich[p.key]).length;
    const fehlend = [...new Set(paket.personen.filter((p) => p.bestand_id).map((p) => p.bestand_id))].filter((id) => !bestand.has(id)).length;
    const zaehl = (l, f) => l.filter(f).length;
    const neu = zaehl(paket.personen, (p) => p.auswahl === "import"), leb = zaehl(paket.personen, (p) => p.auswahl === "lebend");
    const sichtbar = (status) => !nurOffene || ["offen", "veraendert"].includes(status);
    bereich.innerHTML = `
      <div class="imp-kopf">
        <strong>${escapeHtml(paket.titel || "Import")}</strong>
        <span class="imp-klein">Datei vom ${escapeHtml(paket.erstellt || "?")} · ${escapeHtml(paket.bestand_stand || "")}</span>
        <ul class="imp-zahlen">
          <li>Im Bestand gefunden: <b>${zaehl(paket.personen, (p) => p.bestand_id)}</b>${fehlend ? ` <span class="imp-warn">(davon ${fehlend} nicht mehr vorhanden)</span>` : ""}</li>
          <li>Abweichungen offen: <b>${offenAbw}</b> von ${abw.length}</li>
          <li>Gleiche Person? offen: <b>${offenGl}</b> von ${gl.length}</li>
          <li>Neu für später: ${neu} Personen · zurückgestellt (evtl. lebend): ${leb}</li>
        </ul>
        <label class="imp-filter"><input type="checkbox" id="imp-nur-offene" ${nurOffene ? "checked" : ""}> nur offene zeigen</label>
      </div>
      <h4 class="imp-titel">1 · Abweichungen bei vorhandenen Personen</h4>
      ${abw.filter((a) => sichtbar(abwStatus(a))).map(karteAbweichung).join("") || '<p class="imp-klein">Keine offenen Abweichungen. ✓</p>'}
      <h4 class="imp-titel">2 · Gleiche Person?</h4>
      ${gl.filter((p) => sichtbar(zustand.gleich[p.key] ? "erledigt" : "offen")).map(karteGleich).join("") || '<p class="imp-klein">Alles entschieden. ✓</p>'}
      <h4 class="imp-titel">3 · Neue Personen importieren</h4>
      ${importAbschnitt(offenAbw, offenGl)}
      <div class="imp-knoepfe"><button type="button" class="btn btn--ghost" data-aktion="schliessen">Datei schließen</button></div>`;
    bereich.hidden = false;
  }

  // ---------- v363: Stufe 2 – Vorschau, Import, Rückgängig ----------
  let plan = null, frueherImport = null, lebendImport = null, laeuft = false, trotzdem = false;
  const quelleFuer = (modus) => modus === "lebend" ? `${paket.id}#lebend` : paket.id;
  const anzahlLebend = () => paket.personen.filter((p) => p.auswahl === "lebend" && !(zustand.gleich[p.key] && zustand.gleich[p.key].wahl !== "neu")).length;
  function importKarte(imp, modus) {
    const z = imp.zusammenfassung || {};
    return `<div class="imp-karte" data-status="erledigt">
        <p class="imp-erledigt">✓ ${modus === "lebend" ? "Evtl. lebende Personen importiert" : "Importiert"} am ${escapeHtml(personViewDatum(String(imp.zeitpunkt).slice(0, 10)))}${z.personen != null ? ` · ${z.personen} neue Personen, ${z.familien || 0} Familien, ${z.kinder || 0} Eltern-Kind-Verbindungen, ${z.stationen || 0} Stationen` : ""}</p>
        <p class="imp-klein">Die neuen Personen tragen den Vermerk „aus Hausblatt … · ungeprüft“. „Rückgängig“ entfernt genau das, was dieser Import angelegt hat.</p>
        <div class="imp-knoepfe"><button type="button" class="btn btn--danger" data-aktion="rueckgaengig" data-modus="${modus}" ${laeuft ? "disabled" : ""}>${modus === "lebend" ? "Import der Lebenden rückgängig" : "Import rückgängig"}</button></div></div>`;
  }
  function lebendTeil() {
    if (lebendImport) return importKarte(lebendImport, "lebend");
    const n = anzahlLebend();
    if (!n) return "";
    if (plan && plan.modus === "lebend") return planHtml();
    return `<div class="imp-karte">
        <p><b>Zurückgestellt: ${n} möglicherweise noch lebende Personen</b> (ab 1921 geboren, ohne Sterbedatum, dazu ihre Ehepartner ohne Lebensdaten).</p>
        <p class="imp-klein">Sie werden in einem eigenen Durchgang importiert, mit eigenem „Rückgängig“. Auch sie erhalten den Vermerk „aus Hausblatt … · ungeprüft“.</p>
        <div class="imp-knoepfe"><button type="button" class="btn btn--primary" data-aktion="vorschau" data-modus="lebend">Vorschau erstellen</button></div></div>`;
  }
  const zahl = (n) => `<b>${n}</b>`;
  function importAbschnitt(offenAbw, offenGl) {
    if (frueherImport) return importKarte(frueherImport, "haupt") + lebendTeil();
    if (offenAbw || offenGl) return `<p class="imp-klein">Bitte zuerst alle offenen Karten oben entscheiden (${offenAbw + offenGl} offen).</p>`;
    if (!plan) return `<p class="imp-klein">Die Vorschau zeigt, was angelegt würde. Geschrieben wird erst nach „Import starten“.</p>
      <div class="imp-knoepfe"><button type="button" class="btn btn--primary" data-aktion="vorschau" data-modus="haupt">Vorschau erstellen</button></div>`;
    return planHtml();
  }
  function planHtml() {
    const fehler = plan.befunde.filter((b) => b.stufe === "fehler"), warn = plan.befunde.filter((b) => b.stufe === "warnung");
    const liste = (arr, max) => arr.slice(0, max).map((t) => `<li>${escapeHtml(t)}</li>`).join("") + (arr.length > max ? `<li>… und ${arr.length - max} weitere</li>` : "");
    return `<div class="imp-karte">
      <ul class="imp-zahlen">
        <li>Neue Personen: ${zahl(plan.personen.length)} <span class="imp-klein">(davon ${plan.frauenUmbenannt} Frauen mit Nachname des Mannes, Geburtsname als „geb.“)</span></li>
        <li>Neue Familien: ${zahl(plan.familien.length)} · neue Eltern-Kind-Verbindungen: ${zahl(plan.kinder.length)}</li>
        <li>Neue Häuser/Orte: ${zahl(plan.haeuser.length)} · Stationen: ${zahl(plan.stationen.length)} (davon ${plan.stationenBestand} bei vorhandenen Personen)</li>
        ${plan.modus === "lebend" ? "" : `<li>Nicht importiert: ${plan.ausgelassen.lebend} evtl. lebend (eigener Durchgang danach), ${plan.ausgelassen.nicht} nicht ausgewählt</li>`}
      </ul>
      ${plan.uebersprungen.length ? `<details><summary>Übersprungen (${plan.uebersprungen.length})</summary><ul class="imp-liste">${liste(plan.uebersprungen, 40)}</ul></details>` : ""}
      ${fehler.length || warn.length ? `<details ${fehler.length ? "open" : ""}><summary>Plausibilität: ${fehler.length} Fehler, ${warn.length} Hinweise</summary><ul class="imp-liste">${liste([...fehler, ...warn].map((b) => (b.stufe === "fehler" ? "⛔ " : "⚠️ ") + b.text), 40)}</ul></details>` : '<p class="imp-erledigt">✓ Plausibilität ohne Auffälligkeiten.</p>'}
      <details><summary>Neue Personen anzeigen</summary><ul class="imp-liste">${liste(plan.personen.map((p) => `${plausName(p)} ${lebensdaten(plausDatumText(p.geburtsdatum, p.geburtsjahr), plausDatumText(p.sterbedatum, p.sterbejahr))} · ${p.herkunft_quelle.replace("Hausblatt ", "")}`), 400)}</ul></details>
      ${fehler.length ? `<label class="imp-filter"><input type="checkbox" id="imp-trotzdem" ${trotzdem ? "checked" : ""}> Fehler gesehen, trotzdem importieren</label>` : ""}
      <div class="imp-knoepfe">
        <button type="button" class="btn btn--primary" data-aktion="importieren" data-modus="${plan.modus}" ${laeuft || (fehler.length && !trotzdem) ? "disabled" : ""}>Import starten</button>
        <button type="button" class="btn btn--ghost" data-aktion="vorschau" data-modus="${plan.modus}">Vorschau neu erstellen</button>
      </div></div>`;
  }

  async function alleZeilen(tabelle, spalten, filter) {
    const out = [];
    for (let von = 0; ; von += 1000) {
      const { data, error } = await filter(sb.from(tabelle).select(spalten)).range(von, von + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async function inStuecken(tabelle, spalten, feld, ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 80) {
      const { data, error } = await sb.from(tabelle).select(spalten).in(feld, ids.slice(i, i + 80));
      if (error) throw error;
      out.push(...(data || []));
    }
    return out;
  }
  function datumFelder(text, art) {
    const t = String(text || "").trim(), w = textZuDatum(t);
    const d = art === "geburt" ? ["geburtsdatum", "geburtsjahr"] : ["sterbedatum", "sterbejahr"];
    const wort = art === "geburt" ? "Geburt" : "Tod";
    if (w) return { [d[0]]: w.datum, [d[1]]: w.jahr, hinweis: "" };
    const j = t.match(/(1[0-9]{3}|20[0-9]{2})/);
    if (t && j) return { [d[0]]: null, [d[1]]: +j[1], hinweis: `${wort} laut Hausblatt: ${t}` };
    return { [d[0]]: null, [d[1]]: null, hinweis: t ? `${wort} laut Hausblatt: ${t}` : "" };
  }
  const hausSchluessel = (ort, nr) => `${String(ort || "").trim().toLowerCase()}|${String(nr || "").trim()}`;

  function neuePersonZeile(hp) {
    const g = datumFelder(hp.geburt, "geburt"), t = datumFelder(hp.tod, "tod");
    const haeuserText = `Hausblatt Innerberg Nr. ${(hp.haeuser || []).join(", ")}`;
    const notiz = [hp.notiz ? `${haeuserText}: ${hp.notiz}` : "", g.hinweis, t.hinweis, hp.unsicher ? `Unsicher gelesen: ${hp.unsicher}` : ""].filter(Boolean).join("\n");
    const nachname = hp.import_nachname !== undefined ? (hp.import_nachname || "") : (hp.nachname || "");
    return {
      vorname: hp.vorname, nachname, Ledigenname: hp.import_ledigenname || null, geschlecht: hp.geschlecht || null,
      geburtsdatum: g.geburtsdatum, geburtsjahr: g.geburtsjahr, sterbedatum: t.sterbedatum, sterbejahr: t.sterbejahr,
      Notiz: notiz || null, herkunft_quelle: haeuserText
    };
  }
  const signatur = (o) => [o.vorname, o.nachname || "", o.Ledigenname || "", String(o.geburtsdatum || "").slice(0, 10), o.geburtsjahr || "", String(o.sterbedatum || "").slice(0, 10), o.sterbejahr || "", o.herkunft_quelle || ""].join("|");
  // Zuordnung Datei-Schlüssel → Personen-ID des ersten Imports (gespeichert oder über die Daten wiedergefunden)
  async function hauptZuordnung() {
    const m = new Map();
    if (!frueherImport) return m;
    const zeilen = await alleZeilen("personen", "id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, herkunft_quelle", (q) => q.eq("import_id", frueherImport.id));
    const nachId = new Map(zeilen.map((z) => [z.id, z]));
    const gespeichert = frueherImport.zusammenfassung?.schluessel;
    if (gespeichert) {
      for (const [key, id] of Object.entries(gespeichert)) if (nachId.has(id)) m.set(key, nachId.get(id));
      return m;
    }
    const nachSig = new Map();
    for (const z of zeilen) { const k = signatur(z); nachSig.set(k, nachSig.has(k) ? null : z); }
    // Rückfall, falls eine Person nach dem Import bearbeitet wurde: Herkunft + Geburtsjahr + Vorname bzw. Nachname
    const jahr = (x) => String(x.geburtsdatum || "").slice(0, 4) || String(x.geburtsjahr || "");
    const grob = (x, feld) => [x.herkunft_quelle || "", jahr(x), String(x[feld] || "").trim().toLowerCase()].join("|");
    const index = (feld) => { const i = new Map(); for (const z of zeilen) { const k = grob(z, feld); i.set(k, i.has(k) ? null : z); } return i; };
    const nachVor = index("vorname"), nachNach = index("nachname");
    const vergeben = new Set();
    for (const hp of paket.personen) {
      if (hp.auswahl !== "import") continue;
      const neu = neuePersonZeile(hp);
      let z = nachSig.get(signatur(neu));
      if (!z && jahr(neu)) z = nachVor.get(grob(neu, "vorname")) || nachNach.get(grob(neu, "nachname"));
      if (z && !vergeben.has(z.id)) { m.set(hp.key, z); vergeben.add(z.id); }
    }
    return m;
  }

  async function planErstellen(modus = "haupt") {
    const p = { modus, personen: [], familien: [], kinder: [], haeuser: [], stationen: [], befunde: [], uebersprungen: [], ausgelassen: { lebend: 0, nicht: 0 }, frauenUmbenannt: 0, stationenBestand: 0, schluessel: {} };
    const zu = new Map();
    const ausErstemImport = modus === "lebend" ? await hauptZuordnung() : new Map();
    for (const hp of paket.personen) {
      let id = null;
      if (hp.abgleich === "sicher") id = hp.bestand_id;
      else if (hp.abgleich === "wahrscheinlich" || hp.abgleich === "moeglich") {
        const z = zustand.gleich[hp.key];
        if (!z) throw new Error(`„Gleiche Person?“ für ${hp.vorname} ${hp.nachname} ist noch offen.`);
        if (z.wahl !== "neu") id = z.wahl;
      }
      if (id) {
        if (!bestand.has(id)) { p.uebersprungen.push(`${hp.vorname} ${hp.nachname}: Person im Bestand nicht mehr vorhanden`); continue; }
        zu.set(hp.key, { id, neu: false, obj: bestand.get(id) });
        continue;
      }
      if (ausErstemImport.has(hp.key)) { const z = ausErstemImport.get(hp.key); zu.set(hp.key, { id: z.id, neu: false, obj: z }); continue; }
      const soll = modus === "lebend" ? "lebend" : "import";
      if (hp.auswahl !== soll) {
        if (hp.auswahl === "lebend") p.ausgelassen.lebend++;
        else if (hp.auswahl === "import" && modus === "lebend") p.uebersprungen.push(`${hp.vorname} ${hp.nachname}: aus dem ersten Import nicht mehr gefunden`);
        else p.ausgelassen.nicht++;
        continue;
      }
      const obj = { id: crypto.randomUUID(), ...neuePersonZeile(hp) };
      p.schluessel[hp.key] = obj.id;
      if (obj.Ledigenname && obj.Ledigenname !== obj.nachname) p.frauenUmbenannt++;
      zu.set(hp.key, { id: obj.id, neu: true, obj });
      p.personen.push(obj);
      p.befunde.push(...plausLebensdaten(obj));
    }
    const bestIds = [...new Set([...zu.values()].filter((x) => !x.neu).map((x) => x.id))];
    const sp = "id, partner_a_id, partner_b_id, familientyp, beginn, ende";
    const dbFam = new Map([...await inStuecken("familien", sp, "partner_a_id", bestIds), ...await inStuecken("familien", sp, "partner_b_id", bestIds)].map((f) => [f.id, f]));
    const dbLinks = await inStuecken("familien_kinder", "id, familie_id, kind_id", "kind_id", bestIds);
    const elternVon = new Map();
    dbLinks.forEach((l) => elternVon.set(l.kind_id, [...(elternVon.get(l.kind_id) || []), l.familie_id]));
    const paarKey = (a, b) => [a || "", b || ""].sort().join("|");
    const famNachPaar = new Map();
    for (const f of dbFam.values()) {
      const k = f.partner_b_id ? paarKey(f.partner_a_id, f.partner_b_id) : `allein|${f.partner_a_id}`;
      if (!famNachPaar.has(k)) famNachPaar.set(k, { id: f.id, neu: false, f });
    }
    const name = (key) => { const x = zu.get(key); return x ? plausName(x.obj) : `${personByKey.get(key)?.vorname || "?"} ${personByKey.get(key)?.nachname || ""}`.trim(); };
    const hatEltern = new Set();
    for (const fa of paket.familien) {
      const A = fa.a ? zu.get(fa.a) : null, B = fa.b ? zu.get(fa.b) : null;
      if (!A || (fa.b && !B)) {
        const kinder = (fa.kinder || []).filter((k) => zu.get(k)?.neu);
        if (kinder.length) p.uebersprungen.push(`Familie ${name(fa.a)}${fa.b ? ` + ${name(fa.b)}` : ""}: ein Elternteil wird nicht importiert – ${kinder.length} Kind(er) ohne Eltern-Verbindung`);
        continue;
      }
      const k = B ? paarKey(A.id, B.id) : `allein|${A.id}`;
      let fam = famNachPaar.get(k);
      if (!fam) {
        const notiz = [fa.notiz || "", !fa.heirat_iso && fa.heirat_jahr ? `Heirat ${fa.heirat || fa.heirat_jahr} (laut Hausblatt)` : ""].filter(Boolean).join(" · ");
        const zeile = { id: crypto.randomUUID(), partner_a_id: A.id, partner_b_id: B ? B.id : null, familientyp: B ? "Ehe" : "Eltern", beginn: B ? (fa.heirat_iso || null) : null, notiz: notiz || null };
        fam = { id: zeile.id, neu: true, f: zeile };
        famNachPaar.set(k, fam);
        p.familien.push(zeile);
        if (B) p.befunde.push(...plausPartnerschaft(zeile, A.obj, B.obj));
      } else if (fam.neu) {
        if (fa.notiz && !String(fam.f.notiz || "").includes(fa.notiz)) fam.f.notiz = [fam.f.notiz, fa.notiz].filter(Boolean).join(" · ");
        if (!fam.f.beginn && fa.heirat_iso) fam.f.beginn = fa.heirat_iso;
      }
      for (const kk of fa.kinder || []) {
        const K = zu.get(kk);
        if (!K || hatEltern.has(K.id)) continue;
        if (!K.neu && (elternVon.get(K.id) || []).length) {
          if (!(elternVon.get(K.id) || []).includes(fam.id)) p.uebersprungen.push(`${plausName(K.obj)}: hat im Bestand bereits Eltern – keine zusätzliche Verbindung`);
          hatEltern.add(K.id);
          continue;
        }
        hatEltern.add(K.id);
        p.kinder.push({ id: crypto.randomUUID(), familie_id: fam.id, kind_id: K.id, beziehungstyp: "biologisch" });
        for (const E of [A, B].filter(Boolean)) p.befunde.push(...plausElternKind(E.obj, K.obj));
      }
    }
    const dbHaeuser = await alleZeilen("haeuser", "id, ort, nummer", (q) => q.order("ort"));
    const hausNach = new Map(dbHaeuser.map((h) => [hausSchluessel(h.ort, h.nummer), h.id]));
    const hausInfo = new Map((paket.haeuser || []).map((h) => [hausSchluessel(h.ort, h.nummer), h]));
    const dbSt = await inStuecken("person_stationen", "personen_id, haus_id, art, jahr", "personen_id", bestIds);
    const stSchon = new Set(dbSt.map((x) => `${x.personen_id}|${x.haus_id}|${x.art}|${x.jahr || 0}`));
    for (const hp of paket.personen) {
      const P = zu.get(hp.key);
      if (!P) continue;
      for (const st of hp.stationen || []) {
        const hk = hausSchluessel(st.ort, st.nummer);
        let hid = hausNach.get(hk);
        if (!hid) {
          const info = hausInfo.get(hk);
          const zeile = { id: crypto.randomUUID(), ort: st.ort, nummer: st.nummer || null, name: info?.name || null, notiz: info?.quelle || null };
          p.haeuser.push(zeile); hid = zeile.id; hausNach.set(hk, hid);
        }
        const sk = `${P.id}|${hid}|${st.art}|${st.jahr || 0}`;
        if (stSchon.has(sk)) continue;
        stSchon.add(sk);
        p.stationen.push({ id: crypto.randomUUID(), personen_id: P.id, haus_id: hid, art: st.art, jahr: st.jahr || null, sortierung: st.sortierung || 0, quelle: st.quelle || null, notiz: st.notiz || null });
        if (!P.neu) p.stationenBestand++;
      }
    }
    const gesehen = new Set();
    p.befunde = p.befunde.filter((b) => (b.stufe === "fehler" || b.stufe === "warnung") && !gesehen.has(b.text) && gesehen.add(b.text));
    return p;
  }

  async function schreibe(tabelle, zeilen, label, importId) {
    for (let i = 0; i < zeilen.length; i += 100) {
      const teil = zeilen.slice(i, i + 100).map((z) => ({ ...z, import_id: importId }));
      const { error } = await sb.from(tabelle).insert(teil);
      if (error) throw new Error(`${label}: ${error.message}`);
      meldung(`Import läuft … ${label} ${Math.min(i + 100, zeilen.length)}/${zeilen.length}`);
    }
  }
  async function importieren() {
    if (!plan || laeuft) return;
    const modus = plan.modus || "haupt";
    if (!window.confirm(`Jetzt ${plan.personen.length} neue Personen, ${plan.familien.length} Familien, ${plan.kinder.length} Eltern-Kind-Verbindungen und ${plan.stationen.length} Stationen anlegen?\n\nVorher eine Sicherung gemacht? „Import rückgängig“ entfernt alles wieder.`)) return;
    laeuft = true; render();
    const importId = crypto.randomUUID();
    const zusammenfassung = { personen: plan.personen.length, familien: plan.familien.length, kinder: plan.kinder.length, haeuser: plan.haeuser.length, stationen: plan.stationen.length, schluessel: plan.schluessel };
    try {
      const { error } = await sb.from("importe").insert({ id: importId, zeitpunkt: new Date().toISOString(), beschreibung: `${paket.titel || "Import"}${modus === "lebend" ? " – evtl. lebende Personen" : ""}`, quelle: quelleFuer(modus), entscheidungen: zustand, zusammenfassung });
      if (error) {
        if (/entscheidungen|zusammenfassung|column/i.test(error.message)) throw new Error("In Supabase fehlt Paket 3b (Import-Entscheidungen). Bitte zuerst das SQL ausführen");
        throw new Error(error.message);
      }
      if (modus === "lebend") zustand.importIdLebend = importId; else zustand.importId = importId;
      zustandSichern();
      await schreibe("haeuser", plan.haeuser, "Häuser", importId);
      await schreibe("personen", plan.personen, "Personen", importId);
      await schreibe("familien", plan.familien, "Familien", importId);
      await schreibe("familien_kinder", plan.kinder, "Eltern-Kind-Verbindungen", importId);
      await schreibe("person_stationen", plan.stationen, "Stationen", importId);
      meldung(`Import abgeschlossen ✓ ${zusammenfassung.personen} Personen angelegt.`);
      plan = null;
      loadPersonen(true).catch((err) => debugLog(`⚠️ Neu laden nach Import: ${err.message || err}`));
    } catch (err) {
      meldung(`Import abgebrochen: ${err.message || err}. Bereits Angelegtes entfernst du mit „Import rückgängig“.`);
    } finally {
      await frueherenImportLaden();
      laeuft = false; render();
    }
  }

  async function frueherenImportLaden() {
    frueherImport = null; lebendImport = null;
    if (!paket) return;
    try {
      const { data, error } = await sb.from("importe").select("id, zeitpunkt, rueckgaengig_am, zusammenfassung, quelle").in("quelle", [quelleFuer("haupt"), quelleFuer("lebend")]).is("rueckgaengig_am", null).order("zeitpunkt", { ascending: false });
      if (error) throw error;
      frueherImport = (data || []).find((x) => x.quelle === quelleFuer("haupt")) || null;
      lebendImport = (data || []).find((x) => x.quelle === quelleFuer("lebend")) || null;
    } catch (err) { debugLog(`⚠️ Import-Stand: ${err.message || err}`); }
  }

  async function rueckgaengig(modus = "haupt") {
    const imp = modus === "lebend" ? lebendImport : frueherImport;
    if (!imp || laeuft) return;
    if (modus !== "lebend" && lebendImport) { window.alert("Bitte zuerst den Import der evtl. lebenden Personen rückgängig machen – er baut auf diesem Import auf."); return; }
    const id = imp.id;
    laeuft = true; meldung("Rückgängig wird geprüft …");
    try {
      const pers = (await alleZeilen("personen", "id", (q) => q.eq("import_id", id))).map((x) => x.id);
      const fremd = [];
      const zaehle = async (tab, feld, text) => { try { const r = await inStuecken(tab, "id", feld, pers); if (r.length) fremd.push(`${r.length} ${text}`); } catch { /* Tabelle fehlt */ } };
      await zaehle("fotos", "personen_id", "Fotos");
      await zaehle("foto_personen", "person_id", "Foto-Markierungen");
      await zaehle("sprachnotizen", "person_id", "Sprachnotizen");
      const fa = [...await inStuecken("familien", "id, import_id", "partner_a_id", pers), ...await inStuecken("familien", "id, import_id", "partner_b_id", pers)].filter((f) => f.import_id !== id);
      if (fa.length) fremd.push(`${new Set(fa.map((f) => f.id)).size} später angelegte Partnerschaften/Elternfamilien`);
      const kl = (await inStuecken("familien_kinder", "id, import_id", "kind_id", pers)).filter((l) => l.import_id !== id);
      if (kl.length) fremd.push(`${kl.length} später angelegte Eltern-Verbindungen`);
      if (fremd.length) {
        window.alert(`Rückgängig ist nicht möglich: An importierten Personen hängen inzwischen weitere Daten (${fremd.join(", ")}). Bitte diese zuerst entfernen.`);
        meldung(""); return;
      }
      if (!window.confirm(`Import vom ${personViewDatum(String(imp.zeitpunkt).slice(0, 10))} rückgängig machen?\n\n${pers.length} Personen und alles, was dieser Import angelegt hat, werden entfernt. Dein übriger Bestand bleibt unverändert.`)) { meldung(""); return; }
      for (const [tab, label] of [["person_stationen", "Stationen"], ["familien_kinder", "Eltern-Kind-Verbindungen"], ["familien", "Familien"], ["personen", "Personen"]]) {
        meldung(`Rückgängig … ${label}`);
        const { error } = await sb.from(tab).delete().eq("import_id", id);
        if (error) throw new Error(`${label}: ${error.message}`);
      }
      const hs = await alleZeilen("haeuser", "id", (q) => q.eq("import_id", id));
      let hausBleibt = 0;
      for (const h of hs) { const { error } = await sb.from("haeuser").delete().eq("id", h.id); if (error) hausBleibt++; }
      const { error: ue } = await sb.from("importe").update({ rueckgaengig_am: new Date().toISOString() }).eq("id", id);
      if (ue) throw new Error(ue.message);
      if (modus === "lebend") delete zustand.importIdLebend; else delete zustand.importId;
      zustandSichern();
      meldung(`Import rückgängig gemacht ✓ ${pers.length} Personen entfernt${hausBleibt ? `, ${hausBleibt} Häuser bleiben (werden noch verwendet)` : ""}.`);
      loadPersonen(true).catch((err) => debugLog(`⚠️ Neu laden nach Rückgängig: ${err.message || err}`));
    } catch (err) {
      meldung(`Rückgängig abgebrochen: ${err.message || err}`);
    } finally {
      await frueherenImportLaden();
      laeuft = false; render();
    }
  }


  async function personAendern(a, text) {
    const p = bestand.get(a.bestand_id);
    if (!p) return false;
    let upd;
    if (a.feld === "vorname") {
      const v = String(text || "").trim();
      if (!v) { window.alert("Bitte einen Vornamen eingeben."); return false; }
      upd = { vorname: v };
    } else {
      const w = textZuDatum(text);
      if (!w) { window.alert("Bitte das Datum als TT.MM.JJJJ oder nur das Jahr (JJJJ) eingeben."); return false; }
      upd = a.feld === "geburt" ? { geburtsdatum: w.datum, geburtsjahr: w.jahr } : { sterbedatum: w.datum, sterbejahr: w.jahr };
    }
    const neu = { ...p, ...upd };
    if (a.feld !== "vorname") {
      const befunde = [...plausLebensdaten(neu), ...(await plausVerwandteDerPerson(p.id, neu))];
      if (!(await plausFragen(befunde, plausName(neu)))) return false;
    }
    const vorher = zeige(a.feld, bestandWert(p, a.feld));
    if (!window.confirm(`${plausName(p)}: ${FELD[a.feld]} von „${vorher}“ auf „${String(text).trim()}“ ändern?`)) return false;
    const { error } = await sb.from("personen").update(upd).eq("id", p.id);
    if (error) { window.alert(`Konnte nicht gespeichert werden: ${error.message}`); return false; }
    Object.assign(p, upd);
    loadPersonen().catch((err) => debugLog(`⚠️ Bestand nach Import-Prüfung: ${err.message || err}`));
    return true;
  }

  async function klick(event) {
    const btn = event.target.closest("[data-aktion]");
    if (!btn || !paket) return;
    const aktion = btn.dataset.aktion, id = btn.dataset.id, a = paket.abweichungen.find((x) => x.id === id);
    if (aktion === "person") { await openPersonDetail(id); return; }
    if (aktion === "vorschau") {
      btn.disabled = true; meldung("Vorschau wird erstellt …");
      try { plan = await planErstellen(btn.dataset.modus || "haupt"); trotzdem = false; meldung(""); } catch (err) { plan = null; meldung(`Vorschau nicht möglich: ${err.message || err}`); }
      render(); return;
    }
    if (aktion === "importieren") { await importieren(); return; }
    if (aktion === "rueckgaengig") { await rueckgaengig(btn.dataset.modus || "haupt"); return; }
    if (aktion === "schliessen") { paket = null; plan = null; frueherImport = null; lebendImport = null; const b = $("imp-bereich"); b.hidden = true; b.innerHTML = ""; const f = $("imp-datei"); if (f) f.value = ""; return; }
    if (aktion === "anders-zeigen") { const box = document.querySelector(`[data-anders="${CSS.escape(id)}"]`); if (box) { box.hidden = !box.hidden; box.querySelector("input")?.focus(); } return; }
    if (aktion === "bestand" && a) zustand.abw[id] = { wahl: "bestand", am: heute() };
    else if (aktion === "gesehen" && a) zustand.abw[id] = { wahl: "gesehen", am: heute() };
    else if (aktion === "hausblatt" && a) { btn.disabled = true; const ok = await personAendern(a, a.hausblatt); btn.disabled = false; if (!ok) return; zustand.abw[id] = { wahl: "hausblatt", wert: a.hausblatt, am: heute() }; }
    else if (aktion === "anders" && a) {
      const wert = btn.closest(".imp-anders")?.querySelector("input")?.value || "";
      btn.disabled = true; const ok = await personAendern(a, wert); btn.disabled = false; if (!ok) return;
      zustand.abw[id] = { wahl: "anders", wert: wert.trim(), am: heute() };
    }
    else if (aktion === "zuruecksetzen") {
      const z = zustand.abw[id];
      if (z && (z.wahl === "hausblatt" || z.wahl === "anders") && !window.confirm("Die Entscheidung wird wieder geöffnet. Die bereits gespeicherte Änderung im Bestand bleibt bestehen. Fortfahren?")) return;
      delete zustand.abw[id];
    }
    else if (aktion === "gleich") zustand.gleich[btn.dataset.key] = { wahl: id, am: heute() };
    else if (aktion === "gleich-zuruecksetzen") delete zustand.gleich[btn.dataset.key];
    else return;
    plan = null;
    zustandSichern();
    render();
  }

  function init() {
    $("imp-datei")?.addEventListener("change", (e) => { const f = e.target.files?.[0]; if (f) dateiLaden(f); });
    $("imp-bereich")?.addEventListener("click", (e) => { klick(e).catch((err) => meldung(`Fehler: ${err.message || err}`)); });
    $("imp-bereich")?.addEventListener("change", (e) => {
      if (e.target.id === "imp-nur-offene") { nurOffene = e.target.checked; render(); }
      if (e.target.id === "imp-trotzdem") { trotzdem = e.target.checked; render(); }
    });
  }
  return { init, dateiLaden, get zustand() { return zustand; } };
})();
ImportAssistent.init();

// v363: Vermerk „aus Hausblatt … · ungeprüft“ in der Personenansicht, mit „als geprüft markieren“
function zeigeHerkunftsvermerk(person) {
  const ziel = document.getElementById("pv-lifetime");
  if (!ziel) return;
  let box = document.getElementById("pv-herkunft");
  if (!box) { box = document.createElement("p"); box.id = "pv-herkunft"; box.className = "pv-herkunft"; ziel.insertAdjacentElement("afterend", box); }
  box.innerHTML = "";
  if (!person?.herkunft_quelle) { box.hidden = true; return; }
  box.hidden = false;
  const text = document.createElement("span");
  const geprueft = person.geprueft_am ? `geprüft am ${personViewDatum(String(person.geprueft_am).slice(0, 10))}${person.geprueft_von ? ` (${person.geprueft_von})` : ""}` : "ungeprüft";
  text.textContent = `aus ${person.herkunft_quelle} · ${geprueft}`;
  const kopfPunkt = pruefPunkt(person);
  if (kopfPunkt) text.prepend(kopfPunkt);
  box.appendChild(text);
  const darf = rolleDarfSchreiben();
  if (!person.geprueft_am && darf) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn btn--ghost imp-link"; btn.textContent = "als geprüft markieren";
    btn.addEventListener("click", async () => {
      if (!window.confirm("Hast du die Angaben dieser Person geprüft (z. B. im Kirchenbuch)?")) return;
      const jetzt = new Date().toISOString();
      const { error } = await sb.from("personen").update({ geprueft_am: jetzt, geprueft_von: zugang?.name || null }).eq("id", person.id);
      if (error) { window.alert(`Konnte nicht gespeichert werden: ${error.message}`); return; }
      person.geprueft_am = jetzt; person.geprueft_von = zugang?.name || null;
      const imCache = personenCache.find((x) => x.id === person.id);
      if (imCache) {
        imCache.geprueft_am = jetzt;
        const karte = personenKartenCache.get(person.id);
        if (karte) aktualisierePersonenKarte(karte, imCache);
      }
      const imBaum = (treeData?.personen || []).find((x) => x.id === person.id);
      if (imBaum) imBaum.geprueft_am = jetzt;
      zeigeHerkunftsvermerk(person);
    });
    box.appendChild(btn);
  }
}
