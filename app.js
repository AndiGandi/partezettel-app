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
      loginScreen.hidden = true;
      appShell.hidden = false;
      debugLog("Angemeldet.");
      // v191: Gruppenfotos gleich beim App-Start laden, damit auch die Übersicht
      // und Personendetails nicht mit leeren Platzhaltern erscheinen.
      void ladeGruppenfotoListe().catch(err => debugLog(`⚠️ Gruppenfotos beim Start: ${err.message || err}`));
    } else {
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
        loginScreen.hidden = true;
        appShell.hidden = false;
      } else {
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
async function ladeErstPartnerPersonen() {
  if (!erstPartnerVorhanden || erstPartnerPersonenGeladen) return;
  const { data, error } = await sb.from("personen")
    .select("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr")
    .order("nachname").limit(5000);
  if (error) throw error;

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
    erstPartnerVorhanden.appendChild(new Option(personenAuswahlText(person), person.id));
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
  const { data, error } = await sb.from("personen").select("id, vorname, nachname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr").order("nachname").limit(5000);
  if (error) throw error;
  erstRelationDaten.personen = data || [];
  for (const person of erstRelationDaten.personen) erstPerson.appendChild(new Option(personenAuswahlText(person), person.id));
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

// ---------- Formular absenden ----------
const form = document.getElementById("person-form");
const formMessage = document.getElementById("form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  debugLog("Formular abgeschickt – Verarbeitung startet.");
  formMessage.textContent = "Speichere …";

  const eintrag = {
    id: crypto.randomUUID(),
    vorname: document.getElementById("vorname").value.trim(),
    nachname: document.getElementById("nachname").value.trim(),
    ledigenname: document.getElementById("ledigenname").value.trim() || null,
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

  if (!eintrag.vorname || !eintrag.nachname) {
    formMessage.textContent = "Bitte Vor- und Nachname eintragen.";
    return;
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
function lebensalterInTagen(person) {
  if (!person?.geburtsdatum && !person?.geburtsjahr) return null;
  const geburt = person.geburtsdatum ? new Date(`${person.geburtsdatum}T00:00:00`) : new Date(`${person.geburtsjahr}-07-01T00:00:00`);
  if (Number.isNaN(geburt.getTime())) return null;
  let ende = null;
  if (person.sterbedatum) {
    ende = new Date(`${person.sterbedatum}T00:00:00`);
  } else if (person.sterbejahr) {
    const jahr = Number(person.sterbejahr);
    if (!Number.isInteger(jahr) || jahr < 1000 || jahr > 3000) return null;
    ende = new Date(`${jahr}-12-31T00:00:00`);
  } else {
    return null;
  }
  if (Number.isNaN(ende.getTime()) || ende < geburt) return null;
  return Math.floor((ende - geburt) / 86400000);
}
function lebensalterSortierungInTagen(person) {
  if (!person?.geburtsdatum && !person?.geburtsjahr) return null;
  const geburt = person.geburtsdatum ? new Date(`${person.geburtsdatum}T12:00:00`) : new Date(`${person.geburtsjahr}-07-01T12:00:00`);
  if (Number.isNaN(geburt.getTime())) return null;
  let ende = null;
  if (person.sterbedatum) ende = new Date(`${person.sterbedatum}T12:00:00`);
  else if (person.sterbejahr) {
    const jahr = Number(person.sterbejahr);
    if (!Number.isInteger(jahr) || jahr < 1000 || jahr > 3000) return null;
    ende = new Date(`${jahr}-12-31T12:00:00`);
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
  const jahre = Math.floor(tage / 365.2425);
  const nurSterbejahr = !person.sterbedatum && !!person.sterbejahr;
  return `${nurSterbejahr ? "ca. " : ""}${jahre} Jahre`;
}
function sortierNameVergleich(a, b) {
  const nc = String(a.nachname || "").localeCompare(String(b.nachname || ""), "de", { sensitivity: "base" });
  return nc || String(a.vorname || "").localeCompare(String(b.vorname || ""), "de", { sensitivity: "base" }) || String(a.id || "").localeCompare(String(b.id || ""));
}
function personenVergleich(a, b) {
  let av = null, bv = null, cmp = 0;
  if (personenSortierung === "name") {
    cmp = sortierNameVergleich(a, b) * personenSortRichtung;
    return cmp;
  }
  if (personenSortierung === "alter") {
    av = lebensalterSortierungInTagen(a); bv = lebensalterSortierungInTagen(b);
  } else if (personenSortierung === "geburtsjahr" || personenSortierung === "sterbejahr") {
    av = sortierJahr(a, personenSortierung); bv = sortierJahr(b, personenSortierung);
  } else if (personenSortierung === "erstellt") {
    const aRaw = a.erstellt_am || a.created_at;
    const bRaw = b.erstellt_am || b.created_at;
    av = aRaw ? new Date(aRaw).getTime() : null;
    bv = bRaw ? new Date(bRaw).getTime() : null;
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
  if (!person) return "(unbekannte Person)";
  const nachname = String(person.nachname || "").trim();
  const vorname = String(person.vorname || "").trim();
  const name = [nachname, vorname].filter(Boolean).join(", ") || "(unbekannte Person)";
  const ledigenname = String(person.Ledigenname || "").trim();
  const geburtsjahr = person.geburtsdatum ? String(person.geburtsdatum).slice(0, 4) : (person.geburtsjahr ? String(person.geburtsjahr) : "");
  const sterbejahr = person.sterbedatum ? String(person.sterbedatum).slice(0, 4) : (person.sterbejahr ? String(person.sterbejahr) : "");
  let text = name;
  if (ledigenname && ledigenname.toLocaleLowerCase("de") !== nachname.toLocaleLowerCase("de")) {
    text += ` (geb. ${ledigenname})`;
  }
  if (/^\d{4}$/.test(geburtsjahr)) text += ` (geb. ${geburtsjahr})`;
  if (/^\d{4}$/.test(sterbejahr)) text += ` (gest. ${sterbejahr})`;
  return text;
}

function personenAuswahlSortierung(a, b) {
  const an = String(a?.nachname || "").trim();
  const bn = String(b?.nachname || "").trim();
  const n = an.localeCompare(bn, "de", { sensitivity: "base" });
  if (n) return n;
  const av = String(a?.vorname || "").trim();
  const bv = String(b?.vorname || "").trim();
  const v = av.localeCompare(bv, "de", { sensitivity: "base" });
  if (v) return v;
  const ay = Number(a?.geburtsjahr || (a?.geburtsdatum ? String(a.geburtsdatum).slice(0,4) : 0)) || 0;
  const by = Number(b?.geburtsjahr || (b?.geburtsdatum ? String(b.geburtsdatum).slice(0,4) : 0)) || 0;
  if (ay && by) return ay - by;
  if (ay) return -1;
  if (by) return 1;
  return String(a?.id || "").localeCompare(String(b?.id || ""));
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
          return `${endeJahr - startJahr} Jahre`;
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
  return jahre >= 0 ? `${jahre} Jahre` : "";
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
      const { data, error } = await sb.from("personen")
        .select("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, Notiz, created_at, erstellt_am")
        .in("id", [...new Set(zuLadendePersonen)]);
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
  if (!force) {
    const lokalGeladen = await ladePersonenAusPersistentemCache();
    if (lokalGeladen && personenCacheSyncInitialisiert) {
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
    const { data, error } = await sb
      .from("personen")
      .select("id, vorname, nachname, Ledigenname, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, Notiz, created_at, erstellt_am")
      .order("nachname", { ascending: true });

    if (error) throw error;

    personenCache = data || [];
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
    await renderPersonenList(personenCache);
    if (empty) empty.hidden = personenCache.length > 0;
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
  const el = document.getElementById("personen-cache-status");
  if (!el) return;
  if (personenCacheGeladen) {
    const zeit = personenCacheZeitpunkt ? new Date(personenCacheZeitpunkt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
    const lokal = personenCacheQuelle === "localStorage" || personenCacheQuelle === "IndexedDB";
    const quelleText = lokal ? "lokal" : "Supabase";
    el.textContent = `Cache: ${personenCache.length} Personen geladen${zeit ? ` · ${zeit}` : ""} · ${quelleText}`;
    el.classList.add("is-loaded");
  } else {
    el.textContent = "Cache: wird geladen …";
    el.classList.remove("is-loaded");
  }
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
    del.addEventListener("click", async (event) => {
      event.stopPropagation();
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
  beobachteSchluesselfotos();
}


const personenSortSelect=document.getElementById("personen-sortierung");
const personenSortButton=document.getElementById("personen-sort-richtung");

// ---------- Robuste lokale Namenssuche ----------
// Die Suche arbeitet ausschließlich auf dem bereits geladenen personenCache.
// Der direkte Handler wird zusätzlich vom <input>-Element aufgerufen. Damit
// hängt die Suche nicht davon ab, ob iPadOS einen zuvor registrierten
// Event-Listener nach einem View-/PWA-Wechsel noch korrekt ausführt.
let personenSucheLauf = 0;

function normalizePersonenSuchtext(value) {
  return String(value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function personenSuchtext(p, extra = "") {
  return normalizePersonenSuchtext(
    [p?.vorname, p?.nachname, p?.Ledigenname, p?.ledigenname, p?.geburtsname,
      p?.geburtsdatum, p?.geburtsjahr, p?.sterbedatum, p?.sterbejahr, extra]
      .filter(v => v !== null && v !== undefined && String(v).trim() !== "")
      .join(" ")
  );
}

function personenSuchTreffer(person, suchwert, extra = "") {
  const tokens = normalizePersonenSuchtext(suchwert).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const haystack = personenSuchtext(person, extra);
  return tokens.every(token => haystack.includes(token));
}

function wendePersonenSucheAn(suchwert) {
  const q = normalizePersonenSuchtext(suchwert);
  const tokens = q ? q.split(" ").filter(Boolean) : [];
  const list = document.getElementById("personen-list");
  const empty = document.getElementById("list-empty");

  if (!personenCacheGeladen || !Array.isArray(personenCache) || !personenCache.length) {
    if (empty) {
      empty.hidden = false;
      empty.textContent = "Personen werden noch geladen …";
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
    const sichtbar = tokens.length === 0 || personenSuchTreffer(p, q);
    karte.li.hidden = !sichtbar;
    if (sichtbar) treffer++;
  }

  if (empty) {
    empty.textContent = treffer
      ? ""
      : `Keine Person für „${suchwert || q}“ gefunden.`;
    empty.hidden = treffer > 0;
  }
  if (list) list.setAttribute("data-suchtreffer", String(treffer));

  const status = document.getElementById("personen-suchtreffer");
  if (status) status.textContent = q ? `${treffer} Treffer` : `${treffer} Personen`;
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
  if (q) window.partezettelPersonenSuche(q);
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

if(personenSortSelect)personenSortSelect.addEventListener("change",()=>{personenSortierung=personenSortSelect.value;aktualisierePersonenSortierung();});
if(personenSortButton)personenSortButton.addEventListener("click",()=>{personenSortRichtung*=-1;personenSortButton.textContent=personenSortRichtung===1?"↑":"↓";aktualisierePersonenSortierung();});

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

function personViewAlter(person, bisDatum = null) {
  const birthValue = person?.geburtsdatum || person?.geburtsjahr;
  if (!birthValue) return "";
  const birth = person.geburtsdatum ? new Date(`${person.geburtsdatum}T00:00:00`) : new Date(`${person.geburtsjahr}-07-01T00:00:00`);
  if (!Number.isFinite(birth.getTime())) return "";
  const end = bisDatum ? new Date(`${bisDatum}T00:00:00`) : new Date();
  if (!Number.isFinite(end.getTime()) || end < birth) return "";
  let years = end.getFullYear() - birth.getFullYear();
  if (end.getMonth() < birth.getMonth() || (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate())) years--;
  if (years < 0 || years > 125) return "";
  return `${person.geburtsdatum ? "" : "ca. "}${years} ${years === 1 ? "Jahr" : "Jahre"}`;
}

let currentPersonViewId = null;
async function openPersonDetail(personId, options = {}) {
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
    const personAudioPanel = document.getElementById("pv-audio-panel");
    if (personAudioPanel) {
      personAudioPanel.replaceChildren();
      ladeBestandsSprachnotizen(person.id, personAudioPanel).catch(err => {
        personAudioPanel.textContent = `Sprachnotizen konnten nicht geladen werden: ${err?.message || err}`;
      });
    }
    const birth = person.geburtsdatum || person.geburtsjahr;
    const death = person.sterbedatum || person.sterbejahr;
    const lifeParts = [birth ? personViewDatum(birth) : "", death ? personViewDatum(death) : ""].filter(Boolean);
    const alter = personViewAlter(person, person.sterbedatum || (person.sterbejahr ? `${person.sterbejahr}-12-31` : null));
    if (alter) lifeParts.push(death ? `† ${alter}` : `kein Sterbedatum erfasst · ${alter}`);
    else if (death) lifeParts.push("verstorben");
    else if (birth) lifeParts.push("kein Sterbedatum erfasst");
    document.getElementById("pv-lifetime").textContent = lifeParts.join(" · ");

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

    const facts = document.getElementById("pv-basics");
    facts.replaceChildren();
    const addFact = (label, value) => {
      if (value === null || value === undefined || String(value).trim() === "") return;
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = String(value);
      facts.append(dt, dd);
    };
    addFact("Ledigenname", person.Ledigenname || person.ledigenname);
    if (birth) addFact(person.geburtsdatum ? "Geboren" : "Geburtsjahr", personViewDatum(birth));
    if (death) addFact(person.sterbedatum ? "Verstorben" : "Todesjahr", personViewDatum(death));
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
      const { data, error: relatedError } = await sb.from("personen").select("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr").in("id", relatedIds);
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
      if (options.showMaidenName) {
        const maiden = String(related.Ledigenname || "").trim();
        if (maiden && maiden.toLocaleLowerCase() !== String(related.nachname || "").trim().toLocaleLowerCase()) details.push(`geb. ${maiden}`);
      }
      if (life) details.push(life);
      // Das Alter wird nur für verstorbene Personen ergänzt. Bei unvollständigen
      // Daten (nur Jahreszahlen) ist es ausdrücklich eine ungefähre Angabe.
      if (death && birth) {
        const birthDate = String(related.geburtsdatum || "").trim();
        const deathDate = String(related.sterbedatum || "").trim();
        const birthYear = Number(related.geburtsjahr || (birthDate.match(/^(\d{4})/) || [])[1] || (birthDate.match(/\.(\d{4})$/) || [])[1]);
        const deathYear = Number(related.sterbejahr || (deathDate.match(/^(\d{4})/) || [])[1] || (deathDate.match(/\.(\d{4})$/) || [])[1]);
        if (Number.isFinite(birthYear) && birthYear > 0 && Number.isFinite(deathYear) && deathYear >= birthYear) {
          let age = deathYear - birthYear;
          const parseDate = value => {
            const m = String(value || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            return m ? { day:Number(m[1]), month:Number(m[2]), year:Number(m[3]) } : null;
          };
          const bd = parseDate(birthDate), dd = parseDate(deathDate);
          if (bd && dd && (dd.month < bd.month || (dd.month === bd.month && dd.day < bd.day))) age--;
          const exact = !!(bd && dd);
          details.push(`${exact ? "" : "ca. "}${age} Jahre`);
        }
      }
      if (extra) details.push(extra);
      button.textContent = details.join(" · ");
      button.addEventListener("click", () => openPersonDetail(related.id)); container.appendChild(button);
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
          if (years >= 0) duration = ` · ${earliest.approximate ? "ca. " : ""}${years} ${years === 1 ? "Jahr" : "Jahre"}`;
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
      overlay.hidden = true; document.body.classList.remove("person-view-open");
      const treeTab = document.querySelector('.tab-btn[data-tab="stammbaum"]');
      if (treeTab) treeTab.click();
      await loadStammbaum();
      setTreePersonSelection(personId);
      document.getElementById("tab-stammbaum")?.scrollIntoView({ block: "start", behavior: "auto" });
    };
    document.getElementById("pv-edit").onclick = async () => {
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
});
document.getElementById("person-view-overlay")?.addEventListener("click", (event) => {
  if (event.target.id === "person-view-overlay") {
    event.currentTarget.hidden = true;
    document.body.classList.remove("person-view-open");
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
  if (!vorname || !nachname) {
    msg.textContent = "Vor- und Nachname dürfen nicht leer sein.";
    return;
  }
  const { error } = await sb.from("personen").update({
    vorname,
    nachname,
    "Ledigenname": document.getElementById("d-ledigenname").value.trim() || null,
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
          await sb.storage.from(BUCKET_FOTOS).remove([foto.dateipfad]); await loescheFotoAusBrowserCache(foto.dateipfad);
          await sb.from("fotos").delete().eq("id", foto.id);
        }
      } else {
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
  const nameMitLedigenname = ledigenname && ledigenname.toLocaleLowerCase("de") !== String(person.nachname || "").trim().toLocaleLowerCase("de")
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
  const personen = (personenCache || []).slice().sort((a,b) => `${a.nachname||""} ${a.vorname||""}`.localeCompare(`${b.nachname||""} ${b.vorname||""}`, "de"));
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
  return p ? `${p.vorname || ""} ${p.nachname || ""}`.trim() : "unbekannte Person";
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
  const gefiltert = normalizePersonenSuchtext(suchtext) ? alle.filter(p => {
    const a = fotoPersonAnzeige(p);
    return personenSuchTreffer(p, suchtext, a.daten || "");
  }).slice(0, 30) : [];
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
      }).join("")
    : '<p class="foto-person-suche-hinweis">Keine passende Person gefunden.</p>';
}

fotoPersonSuche?.addEventListener("input", renderFotoPersonAuswahl);
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
        const search = document.createElement("input");
        search.type = "search";
        search.placeholder = "Name suchen …";
        search.autocomplete = "off";
        const select = document.createElement("select");
        select.innerHTML = '<option value="">— Person auswählen —</option>';
        const save = document.createElement("button");
        save.type = "button"; save.className = "btn btn--secondary"; save.textContent = "Zuordnen";
        const cancel = document.createElement("button");
        cancel.type = "button"; cancel.className = "btn btn--ghost"; cancel.textContent = "Abbrechen";

        const verfuegbar = (personenCache || [])
          .filter(p => !detailViewerMarkierungen.some(x => x.id !== row.id && x.personen_id === p.id))
          .slice()
          .sort((a,b) => `${a.nachname||""} ${a.vorname||""}`.localeCompare(`${b.nachname||""} ${b.vorname||""}`, "de"));
        const fill = () => {
          const q = search.value;
          const list = normalizePersonenSuchtext(q) ? verfuegbar.filter(p => {
            const a = fotoPersonAnzeige(p);
            return personenSuchTreffer(p, q, a.daten || "");
          }) : verfuegbar;
          select.innerHTML = '<option value="">— Person auswählen —</option>' + list.map(p => {
            const a = fotoPersonAnzeige(p);
            return `<option value="${p.id}">${escapeHtml(a.name)}${a.daten ? ` — ${escapeHtml(a.daten)}` : ""}</option>`;
          }).join("");
        };
        fill();
        search.addEventListener("input", fill);
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
        wrap.append(search, select, save, cancel);
        legend.appendChild(wrap);
        search.focus();
      };
      name.addEventListener("click", openChooser);
      name.addEventListener("pointerup", (event) => { if (event.pointerType === "touch") openChooser(event); });
      legend.style.cursor = "pointer";
    } else {
      const openPerson = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const personId = row.personen_id;
        closeDetailPhotoViewer();
        // Personen-Tab aktivieren, damit die darunterliegende Ansicht
        // ebenfalls auf dem richtigen Bereich steht.
        document.querySelector('.tab-btn[data-tab="liste"]')?.click();
        try {
          await openPersonDetail(personId);
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
    div.innerHTML = `<audio controls preload="none"></audio><button class="del-btn" title="Löschen">🗑️</button>`;

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
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = personenAuswahlText(p);
      select.appendChild(opt);
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
          <div class="familie-trauungsbuch" aria-live="polite"><span>Trauungsbuch:</span> <a class="familie-trauungsbuch-link" target="_blank" rel="noopener" hidden></a><span class="familie-trauungsbuch-zeile"></span><button type="button" class="source-edit-btn familie-source-edit" title="Trauungsbuch-Link bearbeiten" aria-label="Trauungsbuch-Link bearbeiten">✏️</button><div class="familie-source-editor" hidden><input type="url" class="familie-source-url" placeholder="https://…" aria-label="Trauungsbuch-URL"><label>Zeile <input type="number" class="familie-source-row" min="1" placeholder="–"></label><button type="button" class="btn btn--secondary familie-source-save">Quelle speichern</button></div></div>
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
        const legacyQuelle = (quellenPersonen || []).find(p => String(p.trauungsbuch_link || "").trim());
        if (legacyQuelle) eheQuelle = {
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
      const updateDaten = {
        familie_id: f.id,
        trauungsbuch_link: url || eheQuelle?.trauungsbuch_link || null,
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
            if (j >= 0) text = `${j} Jahre`;
          }
        } else if (tod?.jahr) {
          const sj = Number(String(start).slice(0,4));
          const ej = Number(tod.jahr);
          if (Number.isFinite(sj) && Number.isFinite(ej) && ej >= sj) text = `${ej-sj} Jahre`;
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
    partnerAddBtn.textContent = hatPartnerschaft ? "Weitere Partnerschaft hinzufügen" : "Partnerschaft hinzufügen";
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

  // Die Auswahl darf nie von einem unvollständigen Cache abhängen.
  // "select *" ist absichtlich gewählt, damit zusätzliche/ältere Spalten
  // in der Tabelle nicht dazu führen, dass die gesamte Personenabfrage fehlschlägt.
  let personenFuerAuswahl = [];
  try {
    const { data, error } = await sb.from("personen")
      .select("*")
      .order("nachname", { ascending: true });
    if (error) throw error;
    personenFuerAuswahl = Array.isArray(data) ? data : [];
    if (personenFuerAuswahl.length) personenCache = personenFuerAuswahl;
  } catch (err) {
    debugLog(`⚠️ Personen für Auswahl direkt laden: ${err.message || err}`);
    personenFuerAuswahl = Array.isArray(personenCache) ? personenCache : [];
  }

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

  kandidaten.sort((a, b) => {
    const name = personenAuswahlText(a).localeCompare(personenAuswahlText(b), "de", { sensitivity: "base" });
    return name;
  });

  for (const p of kandidaten) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = personenAuswahlText(p);
    select.appendChild(opt);
  }
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
  el.textContent = jahre >= 0 ? `${jahre} Jahre` : "–";
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

  msg.textContent = "INSERT Partnerschaft: wird gespeichert …";
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
        msg.textContent = `✅ INSERT erfolgreich – Beziehung + Familie gespeichert`;
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
  return { personen, familien, familien_kinder, fotos, foto_personen, sprachnotizen };
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
      tables: ["personen", "familien", "familien_kinder", "fotos", "foto_personen", "sprachnotizen"],
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

    await upsertBatch("personen", data.personen, "Personen");
    await upsertBatch("familien", data.familien || [], "Familien");
    await upsertBatch("familien_kinder", data.familien_kinder || [], "Kinder-Verknüpfungen");
    await upsertBatch("fotos", data.fotos || [], "Foto-Daten");
    await upsertBatch("foto_personen", data.foto_personen || [], "Foto-Personen-Verknüpfungen");
    await upsertBatch("sprachnotizen", data.sprachnotizen || [], "Sprachnotizen");

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
  const file = event.target.files?.[0];
  await stelleBackupWiederHer(file);
  event.target.value = "";
});

document.getElementById("export-json-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle JSON …";
  const data = await fetchAllExportData();
  downloadFile("partezettel-export.json", JSON.stringify(data, null, 2), "application/json");
  msg.textContent = "JSON-Datei heruntergeladen ✓";
});

document.getElementById("export-gedcom-btn").addEventListener("click", async () => {
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

document.getElementById("export-pdf-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle PDF …";
  const { personen, familien, familien_kinder } = await fetchAllExportData();

  if (!window.jspdf) {
    msg.textContent = "PDF-Bibliothek konnte nicht geladen werden.";
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 15;
  const personById = new Map(personen.map((p) => [p.id, p]));
  const name = (id) => {
    const p = personById.get(id);
    return p ? `${p.vorname} ${p.nachname}` : "(unbekannte Person)";
  };
  const addLine = (text, size = 10, bold = false) => {
    if (y > 275) { doc.addPage(); y = 15; }
    doc.setFontSize(size);
    doc.setFont(undefined, bold ? "bold" : "normal");
    const wrapped = doc.splitTextToSize(String(text), 180);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 5 + 1;
  };

  addLine("Partezettel Archiv — Familienübersicht", 16, true);
  y += 3;
  for (const p of personen) {
    addLine(`${p.vorname} ${p.nachname}${p.Ledigenname ? ` geb. ${p.Ledigenname}` : ""}`, 11, true);
    const sterbeJahrAnzeige = p.sterbedatum
      ? p.sterbedatum.split("-")[0]
      : (p.sterbejahr ? String(p.sterbejahr) : "");
    const jahre = [p.geburtsdatum ? p.geburtsdatum.split("-")[0] : (p.geburtsjahr ? String(p.geburtsjahr) : ""), sterbeJahrAnzeige]
      .filter(Boolean)
      .join(" – ");
    if (jahre) addLine(jahre);
    if (p.Notiz) addLine(p.Notiz);
    y += 2;
  }
  if (familien.length) {
    addLine("Familien", 13, true);
    for (const f of familien) {
      const partner = [f.partner_a_id, f.partner_b_id].filter(Boolean).map(name).join(" + ");
      addLine(`${partner} — ${f.familientyp || "Partnerschaft"}`, 10, true);
      const kids = familien_kinder.filter((k) => k.familie_id === f.id);
      for (const k of kids) addLine(`  Kind: ${name(k.kind_id)}${k.beziehungstyp && k.beziehungstyp !== "biologisch" ? ` — ${k.beziehungstyp}` : ""}`);
    }
  }
  doc.save("partezettel-export.pdf");
  msg.textContent = "PDF heruntergeladen ✓";
});

// ===================== Stammbaum v31 =====================
let treeZoom = 1;
let treeViewMode = "cards";
let treeData = { personen: [], familien: [], kinder: [], photos: new Map() };

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
    ? ` <span class="tree-node__maiden-name">(geb. ${escTree(ledigenname)})</span>` : "";
  return `<button type="button" class="tree-node ${rootId === person.id ? "tree-node--root" : ""} ${relationClass} ${lineClass} ${extraClass}" data-tree-person="${person.id}">
    ${foto ? `<img class="tree-node__photo" src="${escTree(foto)}" alt="Schlüsselfoto von ${escTree(person.vorname)} ${escTree(person.nachname)}">` : `<span class="tree-node__placeholder" aria-hidden="true">👤</span>`}
    <span class="tree-node__name">${escTree(person.vorname)} ${escTree(person.nachname)}${maidenLabel}</span>
    ${jahre ? `<span class="tree-node__years">${escTree(jahre)}</span>` : ""}
  </button>`;
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

async function loadStammbaumData() {
  await ensureSession();
  const [{ data: personen, error: personenError }, { data: familien, error: familienError }, { data: kinder, error: kinderError }] = await Promise.all([
    sb.from("personen").select("id, vorname, nachname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr").order("nachname", { ascending: true }),
    sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, ende_automatik_ignorieren"),
    sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp")
  ]);
  if (personenError) throw personenError;
  if (familienError) throw familienError;
  if (kinderError) throw kinderError;

  treeData.personen = personen || [];
  treeData.familien = familien || [];
  treeData.kinder = kinder || [];
  treeData.photos = new Map();

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

function renderStammbaum(rootId) {
  if (treeViewMode === "classic") { renderKlassischerStammbaum(rootId); return; }
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
  return p ? `${p.vorname || ""} ${p.nachname || ""}`.trim() : "Unbekannt";
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
  });
  close?.addEventListener("click", () => { panel.hidden = true; });
  reset.addEventListener("click", () => {
    a.value = "";
    b.value = "";
    result.innerHTML = "";
    treeRelationshipSelection = { personAId: null, personBId: null };
    const treeSelectElement = document.getElementById("tree-person-select");
    if (treeSelectElement?.value) renderStammbaum(treeSelectElement.value);
  });
  calc.addEventListener("click", () => {
    const personAId = a.value;
    const personBId = b.value;
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

let treePersonSearchIndexSource = null;
let treePersonSearchIndex = [];

function getTreePersonSearchIndex() {
  const people = treeData.personen || [];
  if (treePersonSearchIndexSource !== people) {
    treePersonSearchIndexSource = people;
    treePersonSearchIndex = people
      .map((person) => ({
        person,
        search: treeNormalizeName(`${person.vorname || ""} ${person.nachname || ""} ${person.geburtsjahr || ""} ${person.geburtsdatum || ""} ${person.sterbejahr || ""} ${person.sterbedatum || ""} ${person.Ledigenname || ""}`)
      }))
      .sort((a, b) => personenAuswahlSortierung(a.person, b.person));
  }
  return treePersonSearchIndex;
}

function fillTreePersonSelect(searchValue = "", preferredId = "") {
  const select = document.getElementById("tree-person-select");
  const search = document.getElementById("tree-person-search");
  const options = document.getElementById("tree-person-options");
  if (!select) return "";
  const query = treeNormalizeName(searchValue);
  const previous = preferredId || select.value;
  const index = getTreePersonSearchIndex();
  // Begrenzte Ergebnisliste hält das native Auswahlmenü auf iPad und iPhone flüssig.
  const limit = query ? 120 : 80;
  const matches = [];
  for (const entry of index) {
    const tokens = query.split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.every(token => entry.search.includes(token))) matches.push(entry.person);
    if (matches.length >= limit) break;
  }
  select.replaceChildren(new Option("— Person auswählen —", ""));
  if (options) options.replaceChildren();
  const datalistFragment = options ? document.createDocumentFragment() : null;
  const selectFragment = document.createDocumentFragment();
  for (const person of matches) {
    const opt = document.createElement("option");
    opt.value = person.id;
    opt.textContent = treePersonSearchText(person);
    selectFragment.appendChild(opt);
    if (datalistFragment) {
      const suggestion = document.createElement("option");
      suggestion.value = treePersonSearchText(person);
      datalistFragment.appendChild(suggestion);
    }
  }
  select.appendChild(selectFragment);
  if (options && datalistFragment) options.appendChild(datalistFragment);
  if (previous && matches.some((person) => person.id === previous)) {
    select.value = previous;
  } else if (matches.length === 1) {
    select.value = matches[0].id;
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
  canvas.querySelectorAll("[data-classic-person]").forEach(el=>{el.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const id=el.dataset.classicPerson;if(!id)return;const s=document.getElementById("tree-person-select");if(s)s.value=id;renderKlassischerStammbaum(id);});el.addEventListener("dblclick",async e=>{e.preventDefault();e.stopPropagation();const id=el.dataset.classicPerson;if(!id)return;const s=document.getElementById("tree-person-select");if(s)s.value=id;await openPersonDetail(id,{fromTree:true});});});
}

function setTreeViewMode(mode, rootId = "") {
  treeViewMode = mode === "classic" ? "classic" : "cards";
  const panel = document.getElementById("tab-stammbaum");
  const cards = document.getElementById("tree-view-cards");
  const classic = document.getElementById("tree-view-classic");
  const cardStage = document.getElementById("tree-stage");
  const classicStage = document.getElementById("tree-classic-stage");
  if (panel) panel.classList.toggle("tree-view--classic", treeViewMode === "classic");
  if (cardStage) cardStage.hidden = treeViewMode === "classic";
  if (classicStage) classicStage.hidden = treeViewMode !== "classic";
  if (cards) { cards.classList.toggle("is-active", treeViewMode === "cards"); cards.setAttribute("aria-selected", treeViewMode === "cards" ? "true" : "false"); }
  if (classic) { classic.classList.toggle("is-active", treeViewMode === "classic"); classic.setAttribute("aria-selected", treeViewMode === "classic" ? "true" : "false"); }
  const select = document.getElementById("tree-person-select");
  const id = rootId || select?.value || treeData.personen[0]?.id || "";
  if (treeViewMode === "classic") renderKlassischerStammbaum(id);
  else renderStammbaum(id);
}

async function loadStammbaum() {
  const message = document.getElementById("tree-message");
  const select = document.getElementById("tree-person-select");
  const search = document.getElementById("tree-person-search");
  try {
    message.textContent = "Stammbaum wird geladen …";
    await loadStammbaumData();
    if (!treeData.personen.length) {
      select.innerHTML = '<option value="">— keine Personen vorhanden —</option>';
      renderStammbaum("");
      message.textContent = "";
      return;
    }
    const current = select.value && treePerson(select.value) ? select.value : treeData.personen[0].id;
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
  const value = document.getElementById("tree-zoom-value");
  if (stage) stage.style.transform = `scale(${treeZoom})`;
  if (classicStage) classicStage.style.transform = `scale(${treeZoom})`;
  if (value) value.textContent = `${Math.round(treeZoom * 100)} %`;
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

function renderTreeLinePreset(rootIds, direction) {
  const originalFamilies = treeData.familien;
  const originalChildren = treeData.kinder;
  const roots = [...new Set((Array.isArray(rootIds) ? rootIds : [rootIds]).filter(Boolean))];
  if (!roots.length) return;
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
  treeData.familien = relevantFamilies;
  treeData.kinder = originalChildren.filter(link => relevantIds.has(link.familie_id));
  try { renderStammbaum(roots[0]); }
  finally { treeData.familien = originalFamilies; treeData.kinder = originalChildren; }
  requestAnimationFrame(() => {
    const stage = document.getElementById("tree-stage");
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
  if (!preset) return;
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
  if (treeViewMode === "classic") {
    treeViewMode = "cards";
    setTreeViewMode("cards");
  }
  if (select) select.value = root.id;
  if (search) search.value = "";
  const confirm = document.getElementById("tree-person-confirm");
  if (confirm) confirm.disabled = true;
  renderTreeLinePreset(roots, preset.direction);
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
  if (treeViewMode === "classic") renderKlassischerStammbaum(id);
  else renderStammbaum(id);
  requestAnimationFrame(() => {
    const stage = document.getElementById(treeViewMode === "classic" ? "tree-classic-stage" : "tree-stage");
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
if (treePersonSearch) treePersonSearch.addEventListener("input", () => {
  const query = treePersonSearch.value;
  if (treePersonConfirm) treePersonConfirm.disabled = !query.trim();
  if (treeSearchDebounce) clearTimeout(treeSearchDebounce);
  treeSearchDebounce = setTimeout(() => {
    fillTreePersonSelect(query, "");
    const normalized = treeNormalizeName(query);
    const matches = getTreePersonSearchIndex().filter(entry => normalized && entry.search.includes(normalized));
    if (treePersonConfirm) treePersonConfirm.disabled = !query.trim() || matches.length === 0;
  }, 140);
});
if (treePersonConfirm) treePersonConfirm.addEventListener("click", async () => {
  const query = treeNormalizeName(treePersonSearch?.value || "");
  if (!query) return;
  const message = document.getElementById("tree-message");
  const index = getTreePersonSearchIndex();
  const exact = index.filter(entry => treeNormalizeName(treePersonSearchText(entry.person)) === query);
  const matches = exact.length ? exact : index.filter(entry => entry.search.split(/\s+/).some(token => token === query) || entry.search.includes(query));
  if (matches.length !== 1) {
    if (message) message.textContent = matches.length > 1
      ? `Mehrere Personen passen (${matches.length}). Bitte Vorname, Nachname oder Geburtsjahr genauer eingeben.`
      : "Keine eindeutige Person gefunden. Bitte einen Vorschlag aus der Liste auswählen oder genauer suchen.";
    return;
  }

  const selectedId = matches[0].person.id;
  treePersonConfirm.disabled = true;
  if (message) message.textContent = "Stammbau-Daten werden aktualisiert …";
  try {
    // Beim Bestätigen nicht nur den bestehenden Browser-Zustand neu zeichnen,
    // sondern Personen, Familien und Kinderbeziehungen erneut aus Supabase laden.
    await loadStammbaumData();
    if (!treePerson(selectedId)) throw new Error("Die ausgewählte Person ist in den aktualisierten Daten nicht mehr vorhanden.");
    if (treePersonSearch) treePersonSearch.value = "";
    fillTreePersonSelect("", selectedId);
    setTreePersonSelection(selectedId, { confirmed: true });
    fillTreeRelationshipSelects();
    if (message) message.textContent = `Auswahl bestätigt und Stammbau-Daten aktualisiert: ${treePersonSearchText(treePerson(selectedId))}`;
  } catch (err) {
    if (message) message.textContent = `Aktualisierung fehlgeschlagen: ${err.message || err}`;
    debugLog(`❌ Stammbaum-Aktualisierung: ${err.message || err}`);
  } finally {
    treePersonConfirm.disabled = !treePersonSearch?.value.trim();
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
window.addEventListener("resize", () => { if (treeViewMode === "classic" && treeSelect?.value) renderKlassischerStammbaum(treeSelect.value); });
updateTreeZoom();
initTreeRelationshipUI();
