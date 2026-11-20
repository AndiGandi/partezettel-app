// Familienspuren – Komfort: Das bin ich, Vorlesen, Einführung, Tagesblatt, Zurück, Anmeldeprotokoll, Neuerungen, Papierkorb, Start
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 444

/* =====================================================================
   v418: Komfort für weniger Geübte
   – „Das bin ich“ (je Gerät gespeichert, jederzeit änderbar)
   – Verwandtschaftszeile „Für dich: …“ in der Personenansicht
   – 🔊 Vorlesen
   – „Heute vor … Jahren“ einmal täglich beim Start
   – Einführung beim ersten Anmelden (in der Hilfe jederzeit wieder)
   – ← Zurück in der Kopfzeile, überall gleich
   – Anmeldeprotokoll (wann, welches Gerät) für den Eigentümer
   ===================================================================== */
const KOMFORT = { ich: "fs-ich", heuteTag: "fs-heute-tag", heuteAus: "fs-heute-aus", tour: "fs-einfuehrung-" };
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} }

// ---------- „Das bin ich“ ----------
function ichPerson() { try { return JSON.parse(lsGet(KOMFORT.ich) || "null"); } catch { return null; } }
function ichSetzen(id, name) {
  lsSet(KOMFORT.ich, id ? JSON.stringify({ id, name }) : null);
  ichAnzeigeAktualisieren();
  if (currentPersonViewId && !document.getElementById("person-view-overlay")?.hidden) komfortPersonAnsicht({ id: currentPersonViewId });
}
function ichAnzeigeAktualisieren() {
  const ich = ichPerson();
  const el = document.getElementById("konto-ich-name");
  if (el) el.textContent = ich ? ich.name : "noch nicht festgelegt";
  const weg = document.getElementById("konto-ich-weg");
  if (weg) weg.hidden = !ich;
}

// Personensuche für „Wer bist du?“ (nutzt die Stammbaumdaten)
async function personSucheAufbauen(container, beiWahl, platzhalter = "Namen eingeben …") {
  container.innerHTML = `<input type="search" class="komfort-suche__feld" placeholder="${escapeHtml(platzhalter)}" autocomplete="off" autocapitalize="words"><div class="komfort-suche__treffer" role="listbox"></div>`;
  const feld = container.querySelector("input"), liste = container.querySelector(".komfort-suche__treffer");
  try { await treeDatenAktualisieren(600000); } catch {}
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const zeigen = () => {
    const q = norm(feld.value).trim();
    liste.replaceChildren();
    if (q.length < 2) return;
    const teile = q.split(/\s+/);
    const treffer = (treeData.personen || []).filter((p) => { const t = norm(treePersonSearchText(p)); return teile.every((x) => t.includes(x)); }).slice(0, 8);
    if (!treffer.length) { liste.innerHTML = '<p class="komfort-suche__leer">Niemand gefunden.</p>'; return; }
    for (const p of treffer) {
      const b = document.createElement("button"); b.type = "button"; b.className = "komfort-suche__eintrag";
      b.textContent = treePersonSearchText(p);
      b.addEventListener("click", () => beiWahl(p));
      liste.appendChild(b);
    }
  };
  feld.addEventListener("input", zeigen);
  return feld;
}

// v419: Verwandtschaftswort für „dich“ aufbereiten (Geschlecht, ohne vage Angaben)
function beziehungZuMir(personId, ichId) {
  if (!personId || !ichId || !treePerson(personId) || !treePerson(ichId)) return null;
  if (personId === ichId) return { wort: "du", artikel: "" };
  let rel = null, erg = null;
  try { erg = treeRelationshipResult(personId, ichId); rel = erg?.relation || null; } catch {}
  if (!rel || /keine gespeicherte|nicht eindeutig|angeheiratet verwandt/i.test(rel)) return null;
  // v440: angeheiratet – „der Ehemann deiner Tante (Maria Meier)“, „die Tante deiner Ehefrau (Anna …)“
  if (erg?.angeheiratet) {
    const a = erg.angeheiratet;
    const artikel = TREE_WEIBLICH_WORT.test(String(a.art).split(" ")[0]) ? "die" : "der";
    return { wort: `${a.art} ${treeGenitiv(a.rolle, true)}`, artikel, zusatz: treePersonKurzname(a.ueber) };
  }
  const g = String(treePerson(personId)?.geschlecht || "").toLowerCase();
  const w = /^w/.test(g), m = /^m/.test(g);
  rel = rel.replace("Cousin/Cousine", w ? "Cousine" : m ? "Cousin" : "Cousin/Cousine");
  return { wort: rel, artikel: w ? "deine" : m ? "dein" : "" };
}

// ---------- Personenansicht: Für dich · Vorlesen · Das bin ich ----------
let vorlesenPersonDaten = null;
function komfortPersonAnsicht(person) {
  if (person?.vorname !== undefined) vorlesenPersonDaten = person;
  const kopf = document.querySelector("#person-view-overlay .person-view-heading");
  if (!kopf || !person?.id) return;
  let box = document.getElementById("pv-komfort");
  if (!box) { box = document.createElement("div"); box.id = "pv-komfort"; box.className = "pv-komfort"; kopf.appendChild(box); }
  else kopf.appendChild(box);   // immer ganz unten im Kopf
  const ich = ichPerson();
  const istIch = ich?.id === person.id;
  // v430: kein „Das bin ich“-Knopf mehr bei jeder Person (festlegen unter Konto); stattdessen Sprung zur Verwandtschaft im Stammbaum
  box.innerHTML = `<p class="pv-komfort__ich" id="pv-ich-zeile" hidden></p>
    <div class="pv-komfort__knoepfe">
      <button type="button" class="btn btn--secondary pv-vorlesen" id="pv-vorlesen">🔊 Vorlesen</button>
      <button type="button" class="btn btn--ghost pv-ich-weg" id="pv-ich-weg" hidden>↔ Wie sind wir verwandt?</button>
    </div>`;
  box.querySelector("#pv-vorlesen").addEventListener("click", () => vorlesenUmschalten());
  box.querySelector("#pv-ich-weg").addEventListener("click", () => { if (ich) void verwandtschaftImStammbaum(ich.id, person.id); });
  vorlesenStopp();
  const zeile = box.querySelector("#pv-ich-zeile");
  if (istIch) { zeile.textContent = "👤 Das bist du."; zeile.hidden = false; return; }
  if (!ich) return;
  (async () => {
    try {
      await treeDatenAktualisieren(600000);
      if (currentPersonViewId !== person.id) return;
      if (!treePerson(ich.id)) return;
      const b = beziehungZuMir(person.id, ich.id);
      const weg = box.querySelector("#pv-ich-weg"); if (weg && treePerson(person.id)) weg.hidden = false;
      if (!b) { zeile.textContent = `👤 Keine nähere Verwandtschaft zu dir (${ich.name}) erfasst.`; zeile.classList.add("is-leer"); }
      else {
        zeile.innerHTML = b.artikel ? `👤 Das ist ${b.artikel} <strong>${escapeHtml(b.wort)}</strong>${b.zusatz ? ` (${escapeHtml(b.zusatz)})` : ""}` : `👤 Verwandtschaft zu dir: <strong>${escapeHtml(b.wort)}</strong>`;
        zeile.title = `bezogen auf ${ich.name}`;
      }
      zeile.hidden = false;
    } catch (e) { debugLog(`⚠️ Verwandtschaft zu mir: ${e.message || e}`); }
  })();
}

// ---------- 🔊 Vorlesen ----------
let vorlesenAktiv = false;
function vorlesenStopp() {
  try { window.speechSynthesis?.cancel(); } catch {}
  vorlesenAktiv = false;
  const b = document.getElementById("pv-vorlesen"); if (b) b.textContent = "🔊 Vorlesen";
}
function vorlesenText() {
  const t = (id) => document.getElementById(id)?.textContent?.trim() || "";
  const sichtbar = (id) => { const e = document.getElementById(id); return e && !e.hidden; };
  const teile = [];
  let name = t("pv-name"); if (name) teile.push(name + ".");
  if (sichtbar("pv-maiden")) teile.push(t("pv-maiden").replace(/^geb\.?/i, "Geboren als") + ".");
  const p = vorlesenPersonDaten && vorlesenPersonDaten.id === currentPersonViewId ? vorlesenPersonDaten : null;
  const datum = (iso, jahr) => {
    if (iso) { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); if (!isNaN(d)) return `am ${d.toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" })}`; }
    return jahr ? `im Jahr ${jahr}` : "";
  };
  if (p) {
    const geb = datum(p.geburtsdatum, p.geburtsjahr), tod = datum(p.sterbedatum, p.sterbejahr);
    const w = /^w/i.test(String(p.geschlecht || ""));
    if (geb) teile.push(`${w ? "Sie" : "Er"} wurde ${geb} geboren.`);
    if (tod) {
      const alter = (t("pv-lifetime").match(/(\d+)\s*Jahre/) || [])[1];
      teile.push(`${w ? "Sie" : "Er"} starb ${tod}${alter ? `, mit ${alter} Jahren` : ""}.`);
    }
  } else {
    const leben = t("pv-lifetime").replace(/\s[–-]\s/g, " bis ").replace(/·/g, ",");
    if (leben) teile.push(leben + ".");
  }
  const namen = (listId) => [...document.querySelectorAll(`#${listId} .person-view-person-link`)].map((b) => b.dataset.sprechName || b.textContent.split("·")[0].trim())
    .concat([...document.querySelectorAll(`#${listId} .person-view-relation-row--ohne`)].map((r) => (r.firstChild?.textContent || "").trim()))
    .filter(Boolean);
  const aufzaehlen = (arr) => arr.length <= 1 ? (arr[0] || "") : `${arr.slice(0, -1).join(", ")} und ${arr[arr.length - 1]}`;
  const eltern = namen("pv-parents-list"); if (eltern.length) teile.push(`Eltern: ${aufzaehlen(eltern)}.`);
  const partner = namen("pv-spouse-list");
  if (partner.length) {
    const w = /^w/i.test(String(p?.geschlecht || "")), m = /^m/i.test(String(p?.geschlecht || ""));
    const wort = w ? (partner.length > 1 ? "Ehemänner" : "Ehemann") : m ? (partner.length > 1 ? "Ehefrauen" : "Ehefrau") : "Ehepartner";
    teile.push(`${wort}: ${aufzaehlen(partner)}.`);
  }
  const kinder = namen("pv-children-list"); if (kinder.length) teile.push(`${kinder.length === 1 ? "Ein Kind" : `${kinder.length} Kinder`}: ${aufzaehlen(kinder)}.`);
  const ichZ = document.getElementById("pv-ich-zeile"); if (ichZ && !ichZ.hidden && !ichZ.classList.contains("is-leer")) teile.push(ichZ.textContent.replace("👤", "").trim() + ".");
  return teile.join(" ");
}
function vorlesenUmschalten() {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") { alert("Vorlesen wird auf diesem Gerät nicht unterstützt."); return; }
  if (vorlesenAktiv) { vorlesenStopp(); return; }
  const u = new SpeechSynthesisUtterance(vorlesenText());
  const stimmen = synth.getVoices();
  u.voice = stimmen.find((v) => v.lang === "de-AT") || stimmen.find((v) => v.lang === "de-DE") || stimmen.find((v) => /^de/i.test(v.lang)) || null;
  u.lang = u.voice?.lang || "de-DE"; u.rate = 0.92;
  u.onend = u.onerror = () => vorlesenStopp();
  vorlesenAktiv = true;
  const b = document.getElementById("pv-vorlesen"); if (b) b.textContent = "⏹ Vorlesen beenden";
  synth.cancel(); synth.speak(u);
}
document.getElementById("pv-close")?.addEventListener("click", vorlesenStopp);

// ---------- Allgemeines Fenster (Einführung, Heute vor …) ----------
function komfortFenster(inhaltHtml, { klasse = "" } = {}) {
  let ov = document.getElementById("komfort-overlay");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "komfort-overlay"; ov.className = "komfort-overlay";
    ov.innerHTML = '<div class="komfort-fenster" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) komfortFensterZu(); });
  }
  const f = ov.querySelector(".komfort-fenster");
  f.className = `komfort-fenster ${klasse}`; f.innerHTML = inhaltHtml;
  ov.hidden = false; document.body.classList.add("komfort-offen");
  return f;
}
function komfortFensterZu() {
  const ov = document.getElementById("komfort-overlay");
  if (ov) ov.hidden = true;
  document.body.classList.remove("komfort-offen");
}
function komfortFensterOffen() { const ov = document.getElementById("komfort-overlay"); return !!ov && !ov.hidden; }

// ---------- Einführung ----------
const EINFUEHRUNG = [
  { icon: "🌳", titel: "Willkommen bei Familienspuren", text: "Hier findest du die Familien vom Innerberg und Bartholomäberg: Menschen, Lebensdaten, Häuser, Fotos und Geschichten. Diese kurze Einführung zeigt dir in wenigen Schritten das Wichtigste." },
  { icon: "🔍", titel: "Eine Person finden", text: "Im Bereich <strong>Bestand</strong> tippst du oben einen Namen ins Suchfeld, zum Beispiel „Ganahl“ oder „Maria“. Dann tippst du die gewünschte Person an." },
  { icon: "👤", titel: "Die Personenansicht", text: "Dort siehst du Lebensdaten, Eltern, Ehepartner und Kinder. Tippst du einen Namen an, kommst du zu dieser Person. Mit <strong>🔊 Vorlesen</strong> liest das Gerät die Angaben vor, mit <strong>🌳 Im Stammbaum anzeigen</strong> siehst du die Familie als Baum." },
  { icon: "🌳", titel: "Der Stammbaum", text: "<strong>Familie</strong> zeigt Eltern, Geschwister und Kinder, <strong>Generationen</strong> mehrere Ebenen, <strong>Ahnentafel</strong> alle Vorfahren. Einmal tippen setzt eine Person in die Mitte, zweimal tippen öffnet sie. Mit <strong>←</strong> und <strong>→</strong> gehst du zur vorigen und nächsten Ansicht." },
  { icon: "←", titel: "Zurück geht immer", text: "Oben links steht immer <strong>← Zurück</strong>. Damit kommst du einen Schritt zurück, egal wo du gerade bist. Verlaufen kannst du dich also nicht." },
  { icon: "👋", titel: "Wer bist du?", text: "Wenn du dich selbst auswählst, zeigt die App bei jeder Person, wie sie mit dir verwandt ist, zum Beispiel „Urgroßmutter“ – und mit <strong>↔ Wie sind wir verwandt?</strong> den Weg dorthin im Stammbaum. Ändern kannst du es jederzeit unter ⚙ Konto, auch wenn du die App jemand anderem zeigst. Du kannst den Schritt auch überspringen.", ich: true },
];
function einfuehrungZeigen(schritt = 0) {
  const s = EINFUEHRUNG[schritt];
  const letzter = schritt === EINFUEHRUNG.length - 1;
  const ich = ichPerson();
  const f = komfortFenster(`
    <div class="tour-punkte">${EINFUEHRUNG.map((_, i) => `<span class="${i === schritt ? "is-aktiv" : ""}"></span>`).join("")}</div>
    <div class="tour-icon" aria-hidden="true">${s.icon}</div>
    <h2 class="tour-titel">${s.titel}</h2>
    <p class="tour-text">${s.text}</p>
    ${s.ich ? `<p class="tour-ich">${ich ? `Derzeit gewählt: <strong>${escapeHtml(ich.name)}</strong>` : ""}</p><div class="komfort-suche" id="tour-ich-suche"></div>` : ""}
    <div class="tour-knoepfe">
      ${schritt > 0 ? '<button type="button" class="btn btn--ghost" data-tour="zurueck">← Zurück</button>' : '<button type="button" class="btn btn--ghost" data-tour="ende">Überspringen</button>'}
      <button type="button" class="btn btn--primary" data-tour="${letzter ? "ende" : "weiter"}">${letzter ? "Fertig" : "Weiter →"}</button>
    </div>`, { klasse: "komfort-fenster--tour" });
  f.querySelector('[data-tour="weiter"]')?.addEventListener("click", () => einfuehrungZeigen(schritt + 1));
  f.querySelector('[data-tour="zurueck"]')?.addEventListener("click", () => einfuehrungZeigen(schritt - 1));
  f.querySelectorAll('[data-tour="ende"]').forEach((b) => b.addEventListener("click", () => { einfuehrungGesehen(); komfortFensterZu(); }));
  if (s.ich) {
    personSucheAufbauen(f.querySelector("#tour-ich-suche"), (p) => {
      ichSetzen(p.id, treePersonLabel(p.id));
      const z = f.querySelector(".tour-ich"); if (z) z.innerHTML = `✓ Gewählt: <strong>${escapeHtml(treePersonLabel(p.id))}</strong>`;
      f.querySelector("#tour-ich-suche").innerHTML = "";
    }, "Deinen Namen eingeben …");
  }
}
let komfortUserId = null;
function einfuehrungGesehen() { if (komfortUserId) lsSet(KOMFORT.tour + komfortUserId, "1"); }

// ---------- Heute vor … Jahren (einmal am Tag) ----------
async function heuteVorJahrenZeigen({ auchLeer = true } = {}) {
  // v419: Tagesblatt – Mondkalender, Namenstag, Bauernregel, Jahrestage (runde hervorgehoben, Verwandte zuerst)
  if (typeof chronikDatenLaden !== "function" || typeof tagesblattAuswerten !== "function") return false;
  const d = await chronikDatenLaden(false);
  const r = tagesblattAuswerten(d, { leser: zugang?.rolle === "leser" });   // v420: ohne Personalisierung
  if (!r.ereignisse.length && !auchLeer) return false;
  const f = komfortFenster(`
    <div class="tb-kalenderblatt" aria-hidden="true"><span>${new Date().toLocaleDateString("de-AT", { month: "short", timeZone: "Europe/Vienna" }).replace(".", "").toUpperCase()}</span><b>${new Date().toLocaleDateString("de-AT", { day: "numeric", timeZone: "Europe/Vienna" }).replace(".", "")}</b></div>
    <h2 class="tour-titel">Tagesblatt</h2>
    <div class="tagesblatt">${tagesblattHtml(r)}</div>
    <label class="heute-aus"><input type="checkbox" id="heute-aus-cb" ${lsGet(KOMFORT.heuteAus) ? "checked" : ""}> Nicht mehr automatisch zeigen (beim Start und um Mitternacht)</label>
    <div class="tour-knoepfe"><span></span><button type="button" class="btn btn--primary" data-heute="ok">Schließen</button></div>`, { klasse: "komfort-fenster--heute" });
  f.querySelector("#heute-aus-cb").addEventListener("change", (e) => lsSet(KOMFORT.heuteAus, e.target.checked ? "1" : null));
  f.querySelector('[data-heute="ok"]').addEventListener("click", komfortFensterZu);
  f.querySelectorAll(".chr-link").forEach((b) => b.addEventListener("click", () => komfortFensterZu()));
  return true;
}

// ---------- Ablauf nach dem Start ----------
async function komfortNachStart(session) {
  komfortUserId = session?.user?.id || null;
  ichAnzeigeAktualisieren();
  void papierkorbPruefen();   // v436
  void flushQueueSicher();   // v436: offline gespeicherte Einträge nachsenden
  if (zugang?.vorschau) return;
  const zugangOffen = !document.getElementById("zugang-overlay")?.hidden;
  if (zugangOffen) return;
  if (komfortUserId && !lsGet(KOMFORT.tour + komfortUserId)) { try { localStorage.setItem(VERSION_GESEHEN_KEY, String(APP_VERSION)); } catch {} einfuehrungZeigen(0); return; }
  komfortTagGestartet = true; komfortTagZuletzt = wienerTag();
  const neu = neuerungenZeigen();   // v435: nach einem Update zuerst kurz zeigen, was neu ist
  if (neu) await neu;
  const heute = wienerTag();
  if (lsGet(KOMFORT.heuteAus) || lsGet(KOMFORT.heuteTag) === heute) return;
  lsSet(KOMFORT.heuteTag, heute);
  try { await heuteVorJahrenZeigen(); } catch (e) { debugLog(`⚠️ Tagesblatt: ${e.message || e}`); }
}

// ---------- v422: Tageswechsel um Mitternacht, auch ohne Neustart ----------
// Datum nach österreichischer Zeit (vorher UTC – zwischen 0 und 1 Uhr galt noch der Vortag)
function wienerTag(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
let komfortTagGestartet = false;
let komfortTagZuletzt = null;
async function tageswechselPruefen() {
  if (!komfortTagGestartet || zugang?.vorschau) return;
  const heute = wienerTag();
  if (komfortTagZuletzt === heute) return;
  komfortTagZuletzt = heute;
  // Chronik-Karte „Heute vor … Jahren“ mitziehen, falls sie gerade offen ist
  try { if (document.getElementById("tab-chronik")?.classList.contains("is-active") && typeof zeigeChronik === "function") zeigeChronik(false); } catch {}
  if (lsGet(KOMFORT.heuteAus) || lsGet(KOMFORT.heuteTag) === heute) return;
  if (!document.getElementById("zugang-overlay")?.hidden) return;              // nicht über der Anmeldung
  const ov = document.getElementById("komfort-overlay");
  const fensterOffen = ov && !ov.hidden;
  if (fensterOffen && !ov.querySelector(".komfort-fenster--heute")) return;    // Einführung o. Ä. nicht unterbrechen
  lsSet(KOMFORT.heuteTag, heute);
  try { await heuteVorJahrenZeigen(); } catch (e) { debugLog(`⚠️ Tagesblatt: ${e.message || e}`); }
}
setInterval(tageswechselPruefen, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tageswechselPruefen(); });
window.addEventListener("focus", tageswechselPruefen);
window.addEventListener("pageshow", tageswechselPruefen);

// ---------- ← Zurück in der Kopfzeile ----------
let tabVerlauf = [];
let tabWechselDurchZurueck = false;
document.addEventListener("click", (e) => {
  const b = e.target.closest?.(".tab-btn");
  if (!b) return;
  const vorher = document.querySelector(".tab-btn.is-active")?.dataset.tab;
  if (!tabWechselDurchZurueck && vorher && vorher !== b.dataset.tab) { tabVerlauf.push(vorher); if (tabVerlauf.length > 30) tabVerlauf.shift(); }
}, true);
function appZurueck() {
  if (komfortFensterOffen()) { komfortFensterZu(); return; }
  const sichtbar = (id) => { const e = document.getElementById(id); return e && !e.hidden; };
  if (sichtbar("konto-overlay")) { document.getElementById("konto-schliessen")?.click(); return; }
  if (sichtbar("detail-overlay")) { document.getElementById("detail-close-btn")?.click(); return; }
  if (sichtbar("person-view-overlay")) { document.getElementById("pv-close")?.click(); return; }
  const aktiv = document.querySelector(".tab-btn.is-active")?.dataset.tab;
  if (aktiv === "stammbaum" && treeVerlaufPos > 0) { treeZurueck(); return; }
  const ziel = tabVerlauf.pop() || (aktiv !== "liste" ? "liste" : null);
  if (!ziel) return;
  tabWechselDurchZurueck = true;
  try { document.querySelector(`.tab-btn[data-tab="${ziel}"]`)?.click(); } finally { tabWechselDurchZurueck = false; }
}
document.getElementById("app-zurueck")?.addEventListener("click", appZurueck);

// ---------- Anmeldeprotokoll ----------
function geraetBeschreibung() {
  const ua = navigator.userAgent || "";
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const geraet = /iPad/.test(ua) || touchMac ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android-Handy" : "Android-Tablet")
    : /Windows/.test(ua) ? "Windows-PC" : /Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "unbekannt";
  const browser = /EdgA?\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "anderer Browser";
  const app = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  return { geraet, browser, app };
}
async function anmeldungProtokollieren(art, sofort = false) {
  try {
    if (zugang?.vorschau) return;
    if (!sofort) {   // App-Starts höchstens alle 30 Minuten je Gerät
      const letzt = Number(lsGet("fs-protokoll-zeit") || 0);
      if (Date.now() - letzt < 30 * 60 * 1000) return;
    }
    lsSet("fs-protokoll-zeit", String(Date.now()));
    const g = geraetBeschreibung();
    const version = (document.getElementById("app-version")?.textContent || "").replace(/\D/g, "");
    const { error } = await sb.from("anmeldeprotokoll").insert({ art, geraet: g.geraet, browser: g.browser, als_app: g.app, app_version: version });
    if (error) debugLog(`ℹ️ Anmeldeprotokoll: ${error.message}`);
  } catch (e) { debugLog(`ℹ️ Anmeldeprotokoll: ${e.message || e}`); }
}
async function anmeldeprotokollZeigen() {
  const ziel = document.getElementById("konto-protokoll");
  if (!ziel) return;
  ziel.hidden = false; ziel.textContent = "Wird geladen …";
  const [pr, bp] = await Promise.all([
    sb.from("anmeldeprotokoll").select("zeit, art, geraet, browser, als_app, app_version, user_id").order("zeit", { ascending: false }).limit(150),
    sb.from("benutzerprofil").select("user_id, anzeigename"),
  ]);
  if (pr.error) { ziel.textContent = /does not exist|relation|schema cache/i.test(pr.error.message) ? "Das Anmeldeprotokoll ist noch nicht eingerichtet (SQL Paket 10 ausführen)." : `Fehler: ${pr.error.message}`; return; }
  const namen = new Map((bp.data || []).map((x) => [x.user_id, x.anzeigename || "?"]));
  if (!pr.data?.length) { ziel.textContent = "Noch keine Einträge."; return; }
  const zahl = new Map(); for (const x of pr.data) zahl.set(x.user_id, (zahl.get(x.user_id) || 0) + 1);
  ziel.innerHTML = `<p class="capture-status">Letzte ${pr.data.length} Einträge · ${[...zahl].map(([u, n]) => `${escapeHtml(namen.get(u) || "?")}: ${n}`).join(" · ")}</p>
    <table class="protokoll-tabelle"><thead><tr><th>Wann</th><th>Wer</th><th>Was</th><th>Gerät</th><th>Version</th></tr></thead><tbody>
    ${pr.data.map((x) => `<tr><td>${new Date(x.zeit).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" })}</td><td>${escapeHtml(namen.get(x.user_id) || "?")}</td><td>${x.art === "anmeldung" ? "🔑 Anmeldung" : "▶︎ geöffnet"}</td><td>${escapeHtml(`${x.geraet || ""} · ${x.browser || ""}${x.als_app ? " (App)" : ""}`)}</td><td>${escapeHtml(x.app_version || "")}</td></tr>`).join("")}
    </tbody></table>`;
}
document.getElementById("konto-protokoll-btn")?.addEventListener("click", anmeldeprotokollZeigen);
document.getElementById("konto-ich-weg")?.addEventListener("click", () => ichSetzen(null));
document.getElementById("konto-ich-aendern")?.addEventListener("click", () => {
  const box = document.getElementById("konto-ich-suche"); if (!box) return;
  box.hidden = false;
  personSucheAufbauen(box, (p) => { ichSetzen(p.id, treePersonLabel(p.id)); box.hidden = true; box.innerHTML = ""; }, "Deinen Namen eingeben …").then((f) => f?.focus());
});
document.getElementById("hilfe-einfuehrung")?.addEventListener("click", () => einfuehrungZeigen(0));
document.getElementById("chronik-tagesblatt")?.addEventListener("click", () => heuteVorJahrenZeigen());   // v435: Tagesblatt in der Chronik
ichAnzeigeAktualisieren();

// v423: Zwei-Finger-Zoom im Stammbaum vergrößert den Stammbaum, nicht die ganze Seite (iPad/Safari)
(function treeGestenZoom() {
  let start = 1, mtnRahmen = null;
  const imBaum = (e) => e.target?.closest?.("#tree-viewport, .tree-zoom-controls, .tree-viewport-bar");
  // v424: auch im Fenster „Verwandtschaft ermitteln“ (Gebirge) – dort zoomt die Geste die Grafik
  const imGebirge = (e) => e.target?.closest?.(".tree-mtn-rahmen");
  document.addEventListener("gesturestart", (e) => { const r = imGebirge(e); if (!r) return; e.preventDefault(); e.stopImmediatePropagation(); mtnRahmen = r; start = mtnZoomLesen(); }, { passive: false, capture: true });
  document.addEventListener("gesturechange", (e) => { if (!mtnRahmen || !imGebirge(e)) return; e.preventDefault(); e.stopImmediatePropagation(); mtnZoomSetzen(mtnRahmen, start * e.scale, { merken: false }); }, { passive: false, capture: true });
  document.addEventListener("gestureend", (e) => { if (!mtnRahmen) return; e.preventDefault(); e.stopImmediatePropagation(); mtnZoomSetzen(mtnRahmen, start * (e.scale || 1)); mtnRahmen = null; }, { passive: false, capture: true });
  const ist3d = () => document.getElementById("tree-viewport")?.closest(".tab-panel")?.querySelector(".tree-3d-stage:not([hidden])");
  document.addEventListener("gesturestart", (e) => { if (!imBaum(e)) return; e.preventDefault(); start = treeZoom; }, { passive: false });
  document.addEventListener("gesturechange", (e) => {
    if (!imBaum(e)) return;
    e.preventDefault();
    if (ist3d()) return;
    const z = Math.max(0.6, Math.min(1.5, +(start * e.scale).toFixed(2)));
    if (z !== treeZoom) { treeZoom = z; updateTreeZoom(); }
  }, { passive: false });
  document.addEventListener("gestureend", (e) => { if (imBaum(e)) e.preventDefault(); }, { passive: false });
})();

// v426: ✕ in allen Suchfeldern – löscht den ganzen Suchtext mit einem Tipp (wie bei der Personenauswahl)
function sucheXAnbringen(input) {
  if (!input || input.dataset.sucheX || input.closest(".person-picker")) return;
  input.dataset.sucheX = "1";
  const wrap = document.createElement("span");
  wrap.className = "suche-x";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const x = document.createElement("button");
  x.type = "button"; x.className = "suche-x__knopf"; x.textContent = "✕";
  x.setAttribute("aria-label", "Suchtext löschen"); x.title = "Suchtext löschen";
  wrap.appendChild(x);
  const sync = () => { x.hidden = !input.value; };
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);
  // auch wenn das Programm den Wert setzt (z. B. Stammbaum-Suche übernimmt die Person)
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(input, "value", { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });
  x.addEventListener("pointerdown", (e) => e.preventDefault());   // Tastatur bleibt offen
  x.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("search", { bubbles: true }));
    input.focus();
  });
  sync();
}
function sucheXAlle(wurzel = document) { wurzel.querySelectorAll?.('input[type="search"]').forEach(sucheXAnbringen); }
sucheXAlle();
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === "INPUT") { if (n.type === "search") sucheXAnbringen(n); } else if (n.getElementsByTagName("input").length) sucheXAlle(n); } })   // v443: schnelle Vorprüfung
  .observe(document.body, { childList: true, subtree: true });


// ---------- v430: Verwandtschaft zu „Das bin ich“ im Stammbaum zeigen ----------
async function verwandtschaftImStammbaum(aId, bId) {
  rueckkehrNachPerson = null;
  personViewVerlauf = [];
  const ov = document.getElementById("person-view-overlay");
  if (ov) ov.hidden = true;
  document.body.classList.remove("person-view-open");
  document.querySelector('.tab-btn[data-tab="stammbaum"]')?.click();
  await loadStammbaum();
  // v432: Person setzen, ohne dass der Stammbaum die Seite zu sich scrollt (sonst landet man im Familienstammbaum)
  if (treeSelect && treePerson(aId)) { treeSelect.value = aId; treePresetZuruecksetzen(); renderStammbaum(aId); treeLinieMittigZeigen(aId, { seite: false }); }
  document.getElementById("tree-relationship-open")?.click();
  treeRelationSetPerson("a", aId);
  treeRelationSetPerson("b", bId);
  document.getElementById("tree-relationship-calc")?.click();
  // nach dem Neuzeichnen des Stammbaums zum Fenster mit Ergebnis und Gebirge scrollen
  // v433: direkt zum Ergebnis mit „So ergibt sich die Beziehung“ und dem Gebirge
  const zumFenster = () => {
    const ziel = document.querySelector("#tree-relationship-result .tree-relationship-path")
      || document.querySelector("#tree-relationship-result .tree-mtn-rahmen")
      || document.getElementById("tree-relationship-result")
      || document.getElementById("tree-relationship-panel");
    ziel?.scrollIntoView({ block: "start", behavior: "auto" });
  };
  const timer = [150, 500, 1000].map((ms) => setTimeout(zumFenster, ms));   // auch auf langsameren iPads
  zumFenster();
  // wischt man selbst, nicht mehr nachziehen
  window.addEventListener("touchstart", () => timer.forEach(clearTimeout), { once: true, passive: true });
}

// „👤 Ich“ neben Person 1 und Person 2: setzt die unter „Das bin ich“ gewählte Person ein
function verwandtschaftIchKnoepfe() {
  const ich = ichPerson();
  document.querySelectorAll(".tree-relation-ich").forEach((k) => {
    const da = !!(ich && treePerson(ich.id));
    k.hidden = !da;
    if (da) k.title = `${ich.name} einsetzen`;
  });
}
document.querySelectorAll(".tree-relation-ich").forEach((k) => k.addEventListener("click", () => {
  const ich = ichPerson();
  if (!ich || !treePerson(ich.id)) return;
  treeRelationSetPerson(k.dataset.seite, ich.id);
}));
document.getElementById("tree-relationship-open")?.addEventListener("click", verwandtschaftIchKnoepfe);


// ---------- v435: Neue Version erkennen und Neuerungen zeigen ----------
const APP_VERSION = 444;   // bei jeder Version mit hochzählen
// Kurz und verständlich für alle Nutzer; neueste zuerst. Nur Dinge, die man bemerkt.
const APP_NEUERUNGEN = [
  [444, ["Bestand: Liste lädt in Portionen – Wischen und Datumsauswahl deutlich flüssiger; weitere Personen kommen beim Hinunterwischen von selbst"]],
  [443, ["Schneller: Stammbaum, Chronik, Sortieren und der Wechsel zurück in den Bestand brauchen nur noch etwa die Hälfte der Zeit"]],
  [441, ["Bestand (Eigentümer): Anzeigen „Geburt bekannt, ohne Sterbedatum“ und „nur Sterbejahr“ – nach Alter sortiert"]],
  [440, ["Angeheiratete Verwandte in Worten: „Das ist der Ehemann deiner Tante“, „die Tante deiner Ehefrau“, Schwager, Schwiegermutter, Stiefvater …"]],
  [439, ["🔍 Datenprüfung (nur Eigentümer): mögliche Dubletten und unwahrscheinliche Angaben, „Stimmt so“ blendet Geprüftes dauerhaft aus, Dubletten zusammenführen"]],
  [436, ["🗑️ Papierkorb: Gelöschtes kann der Eigentümer 30 Tage lang wiederherstellen (Verlauf → Papierkorb)"]],
  [435, ["📅 Tagesblatt und eine Kurzanleitung („ⓘ So funktioniert die Chronik“) jetzt in der Chronik", "Wer vor 1920 geboren ist und kein Sterbedatum hat, gilt als verstorben", "Hinweis, wenn eine neue Version bereitsteht"]],
  [434, ["Chronik „Längste Ehen“: nur noch Ehen mit bekannten Sterbedaten beider Partner"]],
  [431, ["Neue oder geänderte Personen sind sofort nach dem Speichern überall auffindbar"]],
  [430, ["↔ Wie sind wir verwandt? – in der Personenansicht, führt direkt zum Gebirge im Stammbaum", "👤 Ich – bei „Verwandtschaft ermitteln“ setzt dich mit einem Tipp ein"]],
  [429, ["🔎 Alles durchsuchen in der Chronik (z. B. „gefallen“, „Lawine“, „1910“)"]],
  [428, ["Gruppenfoto: Personen öffnen schneller und springen nicht mehr zurück"]],
  [427, ["Suche im Bestand deutlich schneller"]],
  [426, ["✕ in allen Suchfeldern löscht den Suchtext mit einem Tipp"]]
];
const VERSION_GESEHEN_KEY = "fs-version-gesehen";

function neueVersionHinweis() {
  if (document.getElementById("version-hinweis")) return;
  const el = document.createElement("div");
  el.id = "version-hinweis"; el.className = "version-hinweis"; el.setAttribute("role", "status");
  el.innerHTML = `<span>✨ Neue Version verfügbar</span><button type="button" class="btn btn--primary" id="version-laden">Jetzt laden</button><button type="button" class="btn btn--ghost" id="version-spaeter" aria-label="Später">Später</button>`;
  document.body.appendChild(el);
  el.querySelector("#version-laden").addEventListener("click", () => location.reload());
  el.querySelector("#version-spaeter").addEventListener("click", () => el.remove());
}

function versionsPruefungStarten(reg) {
  if (!reg || !navigator.serviceWorker) return;
  const hatteSteuerung = !!navigator.serviceWorker.controller;   // beim allerersten Start kein Hinweis
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hatteSteuerung) neueVersionHinweis(); });
  const pruefen = () => { try { reg.update(); } catch {} };
  setInterval(pruefen, 30 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pruefen(); });
}

function neuerungenZeigen() {
  // liefert ein Promise, das sich beim Schließen erfüllt (danach darf das Tagesblatt kommen)
  let gesehen = 0;
  try { gesehen = Number(localStorage.getItem(VERSION_GESEHEN_KEY)) || 0; } catch {}
  try { localStorage.setItem(VERSION_GESEHEN_KEY, String(APP_VERSION)); } catch {}
  if (!gesehen || gesehen >= APP_VERSION) return null;   // Erststart oder nichts Neues
  const punkte = APP_NEUERUNGEN.filter(([v]) => v > gesehen && v <= APP_VERSION).flatMap(([, p]) => p).slice(0, 8);
  if (!punkte.length) return null;
  return new Promise((fertig) => {
    const f = komfortFenster(`
      <h2 class="tour-titel">✨ Neu in Version ${APP_VERSION}</h2>
      <ul class="neuerungen-liste">${punkte.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      <p class="neuerungen-klein">Mehr dazu unter <strong>Hilfe / Kurzanleitung</strong>.</p>
      <div class="tour-knoepfe"><span></span><button type="button" class="btn btn--primary" data-neu="ok">Verstanden</button></div>`, { klasse: "komfort-fenster--neu" });
    f.querySelector('[data-neu="ok"]').addEventListener("click", () => { komfortFensterZu(); fertig(); });
    const ov = document.getElementById("komfort-overlay");
    const beobachter = new MutationObserver(() => { if (ov.hidden) { beobachter.disconnect(); fertig(); } });
    beobachter.observe(ov, { attributes: true, attributeFilter: ["hidden"] });
  });
}


// ---------- v436: Papierkorb (Supabase Paket 11) ----------
// Die Datenbank legt vor jedem Löschen eine Kopie in „papierkorb“ ab. Der Eigentümer sieht sie im Reiter „Verlauf“,
// kann ganze Aktionen wiederherstellen oder endgültig löschen. Nach 30 Tagen räumt die App beim Start des Eigentümers auf;
// erst dann werden Foto- und Audiodateien aus dem Speicher entfernt.
let papierkorbAktiv = false;
const PAPIERKORB_TAGE = 30;
const PK_AUFRAEUMEN_KEY = "fs-papierkorb-aufgeraeumt";

async function papierkorbPruefen() {
  papierkorbAktiv = false;
  if (!rolleIstEigentuemer()) return false;
  try {
    const { error } = await sb.from("papierkorb").select("id", { count: "exact", head: true });
    papierkorbAktiv = !error;
  } catch { papierkorbAktiv = false; }
  const box = document.getElementById("papierkorb-box");
  if (box) box.hidden = !papierkorbAktiv;
  if (papierkorbAktiv) void papierkorbAufraeumen();
  return papierkorbAktiv;
}

// Dateien endgültig aus dem Speicher entfernen – aber nur, wenn kein vorhandenes Foto/keine Sprachnotiz sie noch nutzt
async function papierkorbDateienEntfernen(zeilen) {
  const fotos = zeilen.filter((z) => z.tabelle === "fotos" && z.daten?.dateipfad).map((z) => z.daten.dateipfad);
  const audio = zeilen.filter((z) => z.tabelle === "sprachnotizen" && z.daten?.dateipfad).map((z) => z.daten.dateipfad);
  if (fotos.length) {
    const { data: noch } = await sb.from("fotos").select("dateipfad").in("dateipfad", fotos);
    const genutzt = new Set((noch || []).map((x) => x.dateipfad));
    const weg = fotos.filter((x) => !genutzt.has(x));
    if (weg.length) { await sb.storage.from(BUCKET_FOTOS).remove(weg); for (const x of weg) { try { await loescheFotoAusBrowserCache(x); } catch {} } }
  }
  if (audio.length) {
    const { data: noch } = await sb.from("sprachnotizen").select("dateipfad").in("dateipfad", audio);
    const genutzt = new Set((noch || []).map((x) => x.dateipfad));
    const weg = audio.filter((x) => !genutzt.has(x));
    if (weg.length) await sb.storage.from(BUCKET_AUDIO).remove(weg);
  }
}

async function papierkorbEndgueltig(ids) {
  const { data: zeilen, error } = await sb.from("papierkorb").select("id, tabelle, daten").in("id", ids);
  if (error) throw error;
  await papierkorbDateienEntfernen(zeilen || []);
  const { error: e2 } = await sb.from("papierkorb").delete().in("id", ids);
  if (e2) throw e2;
}

async function papierkorbAufraeumen() {
  // höchstens einmal am Tag
  const heute = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem(PK_AUFRAEUMEN_KEY) === heute) return; } catch {}
  try {
    const grenze = new Date(Date.now() - PAPIERKORB_TAGE * 86400000).toISOString();
    const { data, error } = await sb.from("papierkorb").select("id").lt("geloescht_am", grenze).limit(1000);
    if (error) return;
    if ((data || []).length) { await papierkorbEndgueltig(data.map((x) => x.id)); debugLog(`🗑️ Papierkorb: ${data.length} Einträge älter als ${PAPIERKORB_TAGE} Tage endgültig gelöscht`); }
    try { localStorage.setItem(PK_AUFRAEUMEN_KEY, heute); } catch {}
  } catch (e) { debugLog(`⚠️ Papierkorb aufräumen: ${e.message || e}`); }
}

// Einträge zu „Aktionen“ bündeln: gleicher Benutzer, höchstens 20 Sekunden Abstand
function papierkorbGruppieren(zeilen) {
  const gruppen = [];
  for (const z of zeilen) {   // neueste zuerst
    const t = new Date(z.geloescht_am).getTime();
    const g = gruppen[gruppen.length - 1];
    if (g && g.von === z.geloescht_von && g.letzte - t <= 20000) { g.zeilen.push(z); g.letzte = t; }
    else gruppen.push({ von: z.geloescht_von, zeit: t, letzte: t, zeilen: [z] });
  }
  return gruppen;
}

const PK_ART = {
  personen: ["👤", "Person", "Personen"], familien: ["💍", "Ehe/Familie", "Ehen/Familien"], familien_kinder: ["👶", "Kind-Zuordnung", "Kind-Zuordnungen"],
  fotos: ["🖼️", "Foto", "Fotos"], foto_personen: ["🏷️", "Foto-Markierung", "Foto-Markierungen"], sprachnotizen: ["🎙️", "Sprachnotiz", "Sprachnotizen"],
  beziehung: ["🔗", "Beziehung", "Beziehungen"], haeuser: ["🏠", "Haus", "Häuser"], person_stationen: ["📍", "Wohnstation", "Wohnstationen"],
  familien_trauungsbuch_quellen: ["📖", "Trauungsbuch-Quelle", "Trauungsbuch-Quellen"]
};
function pkPersonName(id, zeilen) {
  const ausKorb = zeilen.find((z) => z.tabelle === "personen" && String(z.daten?.id) === String(id))?.daten;
  const p = ausKorb || (personenCache || []).find((x) => x.id === id) || (typeof treePerson === "function" ? treePerson(id) : null);
  if (!p) return "unbekannte Person";
  return [p.vorname, p.nachname].filter(Boolean).join(" ") || "ohne Namen";
}
function papierkorbTitel(g) {
  const z = g.zeilen;
  const nach = (t) => z.filter((x) => x.tabelle === t);
  const jahre = (d) => { const a = String(d.geburtsdatum || d.geburtsjahr || "").slice(0, 4), b = String(d.sterbedatum || d.sterbejahr || "").slice(0, 4); return a || b ? ` (${a}${b ? `–${b}` : ""})` : ""; };
  let titel;
  if (nach("personen").length) {
    const ps = nach("personen");
    titel = ps.length === 1 ? `👤 ${escapeHtml(pkPersonName(ps[0].daten.id, z))}${jahre(ps[0].daten)}` : `👤 ${ps.length} Personen: ${ps.slice(0, 3).map((x) => escapeHtml(pkPersonName(x.daten.id, z))).join(", ")}${ps.length > 3 ? " …" : ""}`;
  } else if (nach("fotos").length) titel = `🖼️ ${nach("fotos").length === 1 ? `Foto${nach("fotos")[0].daten.titel ? ` „${escapeHtml(nach("fotos")[0].daten.titel)}“` : ""}` : `${nach("fotos").length} Fotos`}`;
  else if (nach("sprachnotizen").length) titel = `🎙️ ${nach("sprachnotizen").length === 1 ? "Sprachnotiz" : `${nach("sprachnotizen").length} Sprachnotizen`}`;
  else if (nach("familien").length) { const f = nach("familien")[0].daten; titel = `💍 ${escapeHtml(f.familientyp || "Familie")}: ${escapeHtml(pkPersonName(f.partner_a_id, z))}${f.partner_b_id ? ` & ${escapeHtml(pkPersonName(f.partner_b_id, z))}` : ""}`; }
  else if (nach("familien_kinder").length) titel = `👶 Kind-Zuordnung: ${nach("familien_kinder").map((x) => escapeHtml(pkPersonName(x.daten.kind_id, z))).slice(0, 3).join(", ")}`;
  else if (nach("haeuser").length) titel = `🏠 Haus ${escapeHtml([nach("haeuser")[0].daten.ort, nach("haeuser")[0].daten.nummer].filter(Boolean).join(" "))}`;
  else { const [sym, eins] = PK_ART[z[0].tabelle] || ["🗑️", z[0].tabelle]; titel = `${sym} ${eins}`; }
  // Rest zusammenfassen
  const zaehl = {};
  for (const x of z) zaehl[x.tabelle] = (zaehl[x.tabelle] || 0) + 1;
  const haupt = nach("personen").length ? "personen" : nach("fotos").length ? "fotos" : nach("sprachnotizen").length ? "sprachnotizen" : nach("familien").length ? "familien" : nach("familien_kinder").length ? "familien_kinder" : nach("haeuser").length ? "haeuser" : z[0].tabelle;
  const rest = Object.entries(zaehl).filter(([t]) => t !== haupt).map(([t, n]) => `${n} ${n === 1 ? (PK_ART[t]?.[1] || t) : (PK_ART[t]?.[2] || t)}`);
  return { titel, rest };
}

let papierkorbNamen = null;
async function papierkorbLaden() {
  const box = document.getElementById("papierkorb-box");
  const liste = document.getElementById("papierkorb-liste");
  const meldung = document.getElementById("papierkorb-meldung");
  if (!box || !liste) return;
  if (!rolleIstEigentuemer()) { box.hidden = true; return; }
  if (!papierkorbAktiv && !(await papierkorbPruefen())) {
    box.hidden = false;
    liste.innerHTML = "";
    meldung.textContent = "Der Papierkorb ist in der Datenbank noch nicht eingerichtet (Supabase Paket 11). Bis dahin wird Gelöschtes sofort endgültig entfernt.";
    return;
  }
  box.hidden = false;
  meldung.textContent = "Lade …";
  if (!papierkorbNamen) {
    try { const { data } = await sb.from("benutzerprofil").select("user_id, anzeigename"); papierkorbNamen = new Map((data || []).map((x) => [x.user_id, x.anzeigename || "?"])); }
    catch { papierkorbNamen = new Map(); }
  }
  const { data, error } = await sb.from("papierkorb").select("id, tabelle, datensatz_id, daten, geloescht_am, geloescht_von").order("geloescht_am", { ascending: false }).limit(2000);
  if (error) { meldung.textContent = `Papierkorb konnte nicht geladen werden: ${error.message}`; return; }
  const gruppen = papierkorbGruppieren(data || []);
  meldung.textContent = gruppen.length ? `${gruppen.length} ${gruppen.length === 1 ? "gelöschte Aktion" : "gelöschte Aktionen"} · wird nach ${PAPIERKORB_TAGE} Tagen endgültig entfernt` : "Der Papierkorb ist leer.";
  liste.replaceChildren(...gruppen.map((g) => {
    const { titel, rest } = papierkorbTitel(g);
    const tage = Math.max(0, PAPIERKORB_TAGE - Math.floor((Date.now() - g.zeit) / 86400000));
    const li = document.createElement("li");
    li.className = "pk-eintrag";
    const wann = new Date(g.zeit).toLocaleString("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    li.innerHTML = `<div class="pk-text"><div class="pk-titel">${titel}</div>
        ${rest.length ? `<div class="pk-rest">mit ${escapeHtml(rest.join(", "))}</div>` : ""}
        <div class="pk-meta">gelöscht ${escapeHtml(wann)}${papierkorbNamen.get(g.von) ? ` von ${escapeHtml(papierkorbNamen.get(g.von))}` : ""} · noch ${tage} ${tage === 1 ? "Tag" : "Tage"}</div></div>
      <div class="pk-knoepfe"><button type="button" class="btn btn--primary" data-pk="zurueck">↩ Wiederherstellen</button><button type="button" class="btn btn--ghost" data-pk="weg">Endgültig löschen</button></div>`;
    const ids = g.zeilen.map((x) => x.id);
    li.querySelector('[data-pk="zurueck"]').addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      try {
        const { data: erg, error: err } = await sb.rpc("fs_papierkorb_wiederherstellen", { eintraege: ids });
        if (err) throw err;
        const text = erg?.offen ? `Wiederhergestellt: ${erg.wiederhergestellt}. ${erg.offen} Teil(e) passten nicht mehr (z. B. Person fehlt) und bleiben im Papierkorb.` : `Wiederhergestellt ✓ (${erg?.wiederhergestellt ?? ids.length} Einträge)`;
        void personenNachSpeichern();
        await papierkorbLaden();
        meldung.textContent = text;
      } catch (err) { meldung.textContent = `Wiederherstellen fehlgeschlagen: ${err.message || err}`; e.currentTarget.disabled = false; }
    });
    li.querySelector('[data-pk="weg"]').addEventListener("click", async (e) => {
      if (!confirm("Endgültig löschen? Das lässt sich nicht mehr rückgängig machen.")) return;
      e.currentTarget.disabled = true;
      try { await papierkorbEndgueltig(ids); await papierkorbLaden(); }
      catch (err) { meldung.textContent = `Löschen fehlgeschlagen: ${err.message || err}`; e.currentTarget.disabled = false; }
    });
    return li;
  }));
}


// ---------- Start der App (muss als Letztes laufen, wenn alle Teile geladen sind) ----------
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
    navigator.serviceWorker.register("sw.js").then((reg) => versionsPruefungStarten(reg)).catch((e) => console.error("SW-Fehler:", e));
  }
})();
