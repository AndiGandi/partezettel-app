// Familienspuren – Personenansicht und Bearbeiten: Felder, Fotos, Gruppenfoto, Sprachnotizen, Familie, Löschen
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 446

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

// v435: Gemeinsame Regel – wer vor 1920 geboren ist und kein Sterbedatum hat, gilt als vermutlich verstorben
// (keine Altersangabe „106 Jahre alt“, kein Schutz als „lebend“ für Leser, Statistik zählt sie nicht als lebend).
const LEBEND_AB_JAHR = 1920;
function personVermutlichLebend(p) {
  if (!p || p.sterbedatum || p.sterbejahr || (typeof todesumstandText === "function" && todesumstandText(p))) return false;
  const j = Number(String(p.geburtsdatum || p.geburtsjahr || "").slice(0, 4));
  return Number.isFinite(j) && j >= LEBEND_AB_JAHR;
}

// v359: Lebenszeile der Personenansicht in verständlichem Wortlaut
//  gestorben:           „02.04.1920 – 15.01.1990 · wurde 69 Jahre alt“
//  vermutlich lebend:   „geboren 02.04.1961 · 65 Jahre alt“ (kein Hinweis auf ein fehlendes Sterbedatum)
//  sehr alt, ohne Tod:  „geboren 1860 · Sterbedatum unbekannt“
//  nur Tod bekannt:     „gestorben 15.01.1990“
function personViewLebenszeile(person) {
  const umstand = todesumstandText(person);
  // Bei Todesumstand ohne Sterbedatum (z. B. vermisst, gefallen ohne Datum) kein „… Jahre alt“ wie bei Lebenden
  const ohneTod = umstand && !(person?.sterbedatum || person?.sterbejahr);
  const geb = person?.geburtsdatum || person?.geburtsjahr;
  const basis = ohneTod ? (geb ? `geboren ${personViewDatum(geb)}` : "") : personViewLebenszeileBasis(person);
  return [basis, umstand].filter(Boolean).join(" · ");
}
function personViewLebenszeileBasis(person) {
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
    if (Number.isFinite(gebJahr) && gebJahr < LEBEND_AB_JAHR) return `geboren ${gebText} · Sterbedatum unbekannt`;   // v435: vor 1920 geboren = vermutlich verstorben
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

// v378: Höhe der Reiterleiste als CSS-Variable, damit die Suchleiste im Bestand direkt darunter haften bleibt
function setzeReiterHoehe() {
  const t = document.querySelector(".tabs");
  if (t) document.documentElement.style.setProperty("--tabs-h", `${t.offsetHeight}px`);
}
window.addEventListener("resize", setzeReiterHoehe);
window.addEventListener("load", setzeReiterHoehe);
setTimeout(setzeReiterHoehe, 300);
// Beim Tippen: wenn weit gescrollt, Liste nach oben holen, damit die Treffer sichtbar sind
document.getElementById("search-input")?.addEventListener("input", () => {
  const liste = document.getElementById("personen-list");
  const leiste = document.querySelector("#tab-liste .list-toolbar");
  if (!liste || !leiste) return;
  const oben = liste.getBoundingClientRect().top;
  const unterLeiste = leiste.getBoundingClientRect().bottom;
  if (oben < unterLeiste - 4) window.scrollBy({ top: oben - unterLeiste - 8, behavior: "auto" });
});

// v378: Unter jedem Kind eine kleine Zeile mit seinen Ehepartnern (∞ 1. … · 2. …), Partner im Bestand anklickbar
async function zeigeEhepartnerDerKinder(kindIds, liste, personId, kinderMap) {
  if (!kindIds?.length || !liste) return;
  try {
    const [a, b] = await Promise.all([
      sb.from("familien").select("*").in("partner_a_id", kindIds),
      sb.from("familien").select("*").in("partner_b_id", kindIds)
    ]);
    if (currentPersonViewId !== personId) return;
    const ehen = [...(a.data || []), ...(b.data || [])].filter((f, i, arr) => f.partner_a_id && f.partner_b_id && String(f.familientyp || "").toLowerCase() !== "eltern" && arr.findIndex(x => x.id === f.id) === i);
    // v397: dazu die Ehepartner ohne eigenes Datenblatt der Kinder
    const ohneMap = new Map();
    try {
      const { data: ko, error: koErr } = await sb.from("personen").select("id, partner_ohne_datenblatt").in("id", kindIds);
      if (!koErr) for (const k of ko || []) { const l = partnerOhneListe(k.partner_ohne_datenblatt); if (l.length) ohneMap.set(k.id, l); }
    } catch {}
    if (!ehen.length && !ohneMap.size) return;
    const partnerIds = [...new Set(ehen.map(f => kindIds.includes(f.partner_a_id) ? f.partner_b_id : f.partner_a_id))];
    const { data: partner } = partnerIds.length ? await sb.from("personen").select("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr").in("id", partnerIds) : { data: [] };
    if (currentPersonViewId !== personId) return;
    const pMap = new Map((partner || []).map(p => [p.id, p]));
    for (const kindId of kindIds) {
      const eigene = ehen.filter(f => f.partner_a_id === kindId || f.partner_b_id === kindId)
        .sort((x, y) => String(familieBeginnWert(x) || "9999").localeCompare(String(familieBeginnWert(y) || "9999")));
      const ohne = ohneMap.get(kindId) || [];
      if (!eigene.length && !ohne.length) continue;
      const btn = [...liste.querySelectorAll(".person-view-person-link")].find(el => el.dataset.personId === kindId);
      if (!btn || btn.nextElementSibling?.classList?.contains("pv-kind-ehe")) continue;
      const zeile = document.createElement("div");
      zeile.className = "pv-kind-ehe";
      zeile.append("∞ ");
      eigene.forEach((f, i) => {
        const pid = f.partner_a_id === kindId ? f.partner_b_id : f.partner_a_id;
        const p = pMap.get(pid);
        if (i) zeile.append(" · ");
        if (eigene.length > 1) zeile.append(`${i + 1}. `);
        const jahr = f.beginn ? String(f.beginn).slice(0, 4) : (f.beginn_jahr ? String(f.beginn_jahr) : "");
        // v379: beim Ehepartner nur der Geburtsname (Ledigenname), sonst der Nachname
        // v379: nur bei Ehefrauen der Ledigenname (wie im Hausblatt), bei Männern der Nachname
        const istFrau = String(p?.geschlecht || "").toLowerCase().startsWith("w");
        const ledig = String(p?.Ledigenname || "").trim();
        // Ist kein Ledigenname bekannt und trägt sie ohnehin den Namen des Mannes, genügt der Vorname
        const kindName = String(kinderMap?.get?.(kindId)?.nachname || "").trim();
        const nach = istFrau ? (ledig || (p?.nachname && p.nachname !== kindName ? p.nachname : "")) : p?.nachname;
        const text = p ? [p.vorname, nach].filter(Boolean).join(" ") : "unbekannt";
        if (p) {
          const l = document.createElement("button");
          l.type = "button"; l.className = "pv-kind-ehe__link"; l.textContent = text;
          l.title = `${text} öffnen`;
          l.addEventListener("click", () => openPersonDetail(p.id, { behalteRueckkehr: true }));
          zeile.append(l);
        } else zeile.append(text);
        if (jahr) zeile.append(` (${jahr})`);
      });
      const gesamt = eigene.length + ohne.length;
      ohne.forEach((e, j) => {
        if (eigene.length + j) zeile.append(" · ");
        if (gesamt > 1) zeile.append(`${eigene.length + j + 1}. `);
        const sp = document.createElement("span"); sp.className = "pv-kind-ehe__ohne"; sp.textContent = e.name; sp.title = "ohne eigenes Datenblatt";
        zeile.append(sp);
        if (e.heirat) zeile.append(` (${String(e.heirat).match(/\d{4}/)?.[0] || e.heirat})`);
      });
      btn.after(zeile);
    }
  } catch (err) { debugLog(`⚠️ Ehepartner der Kinder: ${err.message || err}`); }
}

// v378: Verlauf der geöffneten Personen – „←“ bzw. ✕ führt zur vorherigen Person zurück
let personViewVerlauf = [];
let bearbeitenAusAnsicht = null;
function zeigePersonZurueck() {
  const btn = document.getElementById("pv-back");
  if (!btn) return;
  const vorher = personViewVerlauf[personViewVerlauf.length - 1];
  // v418: „← Zurück“ steht immer da – ohne vorige Person schließt er die Ansicht (wie ✕)
  btn.hidden = false;
  btn.textContent = vorher ? `← ${vorher.name || "Zurück"}` : "← Zurück";
  btn.title = vorher ? `Zurück zu ${vorher.name || "der vorherigen Person"}` : "Ansicht schließen und zurück";
}
async function personZurueck() {
  const vorher = personViewVerlauf.pop();
  if (!vorher) return false;
  await openPersonDetail(vorher.id, { zurueck: true, behalteRueckkehr: true });
  const overlay = document.getElementById("person-view-overlay");
  if (overlay && vorher.scroll) setTimeout(() => { overlay.scrollTop = vorher.scroll; }, 350);
  return true;
}
async function openPersonDetail(personId, options = {}) {
  const pvOverlay = document.getElementById("person-view-overlay");
  const pvOffen = pvOverlay && !pvOverlay.hidden;
  if (options.behalteRueckkehr && !options.zurueck && pvOffen && currentPersonViewId && currentPersonViewId !== personId) {
    personViewVerlauf.push({ id: currentPersonViewId, name: document.getElementById("pv-name")?.textContent || "", scroll: pvOverlay.scrollTop || 0 });
    if (personViewVerlauf.length > 30) personViewVerlauf.shift();
  } else if (!options.behalteRueckkehr && !options.zurueck) {
    personViewVerlauf = [];
  }
  setTimeout(zeigePersonZurueck, 0);
  // Eine Rückkehr bleibt nur beim Öffnen aus dem Gruppenfoto und beim Weiterklicken zu Verwandten erhalten.
  if (!options.vonGruppenfoto && !options.behalteRueckkehr) rueckkehrNachPerson = null;
  currentPersonViewId = personId;
  // v428: Ansicht sofort öffnen (Name aus dem Bestand), statt auf die Datenbank zu warten
  const pvSofort = document.getElementById("person-view-overlay");
  const ausBestand = (personenCache || []).find((x) => x.id === personId);
  if (pvSofort && ausBestand) {
    if (pvSofort.hidden) { pvSofort.hidden = false; pvSofort.scrollTop = 0; document.body.classList.add("person-view-open"); }
    pvSofort.dataset.geoeffnetUm = String(Date.now());
    pvSofort.classList.add("pv-laedt");
    const n = document.getElementById("pv-name"); if (n) n.textContent = [ausBestand.vorname, ausBestand.nachname].filter(Boolean).join(" ") || "Unbekannte Person";
  }
  try {
    await ensureSession();
    const { data: person, error } = await sb.from("personen").select("*").eq("id", personId).single();
    pvSofort?.classList.remove("pv-laedt");
    if (error || !person) {
      debugLog(`❌ Fehler beim Laden der Person: ${error?.message || "Person nicht gefunden"}`);
      return;
    }
    const overlay = document.getElementById("person-view-overlay");
    if (overlay && overlay.hidden) overlay.dataset.geoeffnetUm = String(Date.now());
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
    ladeWohnorte(person.id);
    if (typeof zeigeZeitgeschehen === "function") zeigeZeitgeschehen(person); // v381

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
      ["Taufbuch", person.taufbuch_link, person.taufbuch_zeile, person.taufbuch_seite],
      ["Trauungsbuch", person.trauungsbuch_link, person.trauungsbuch_zeile, person.trauungsbuch_seite],
      ["Sterbebuch", person.sterbebuch_link, person.sterbebuch_zeile, person.sterbebuch_seite]
    ];
    books.filter(([, link]) => String(link || "").trim()).forEach(([label, url, line, seite]) => {
      const row = document.createElement("div"); row.className = "person-view-book-row";
      const link = document.createElement("a"); link.href = String(url).trim(); link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = `📖 ${label} öffnen`;
      row.appendChild(link);
      // v361: alte Trauungsbuch-Zeile der Person markieren, damit sie entfällt,
      // sobald dieselbe Quelle bei einer Ehe hinterlegt ist.
      if (label === "Trauungsbuch") row.dataset.altTrauung = trauungsUrlSchluessel(url);
      const fundstelle = kbFundstelleText(seite, line);
      if (fundstelle) {
        const lineText = document.createElement("span"); lineText.className = "person-view-book-line"; lineText.textContent = fundstelle; row.appendChild(lineText);
      }
      { const q = matriculaFundstelleSpan(url); if (q) row.appendChild(q); }
      kbStiftAnhaengen(row, personId, label === "Taufbuch" ? "taufbuch" : label === "Sterbebuch" ? "sterbebuch" : "trauung");
      booksList.appendChild(row);
    });
    booksSection.hidden = booksList.children.length === 0;

    const spouseSection = document.getElementById("pv-spouse-section");
    const spouseList = document.getElementById("pv-spouse-list"); spouseList.replaceChildren();
    const [{ data: familyRows, error: familyError }, { data: childLinks, error: childError }] = await Promise.all([
      sb.from("familien").select("*").or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`),
      alleZeilenLaden(() => sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp").order("id"))
    ]);
    if (familyError) debugLog(`⚠️ Ehepartner laden: ${familyError.message}`);
    if (childError) debugLog(`⚠️ Kinder laden: ${childError.message}`);
    const partnerFamilies = (familyRows || [])
      .filter(f => f.partner_a_id && f.partner_b_id && f.familientyp !== "Eltern")
      .sort((a, b) => {
        const da = String(familieBeginnWert(a) || "9999-99-99").slice(0, 10);
        const db = String(familieBeginnWert(b) || "9999-99-99").slice(0, 10);
        return da.localeCompare(db) || String(a.id || "").localeCompare(String(b.id || ""));
      });

    // Trauungsbuchquellen gehören zur jeweiligen Ehe und werden deshalb
    // zusätzlich im Bereich „Kirchenbücher“ angezeigt – auch bei mehreren Ehen.
    if (partnerFamilies.length) {
      const eheFamilienIds = partnerFamilies.map(f => f.id).filter(Boolean);
      try {
        const { data: eheQuellen, error: eheQuellenError } = await sb
          .from("familien_trauungsbuch_quellen")
          .select("*")
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
          const lineLabel = kbFundstelleText(quelle.trauungsbuch_seite, line);
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
          { const q = matriculaFundstelleSpan(url); if (q) row.appendChild(q); }
          kbStiftAnhaengen(row, personId, `trauung:${quelle.familie_id}`);
          booksList.appendChild(row);
          bereitsAngezeigt.add(key);
        }
        booksSection.hidden = booksList.children.length === 0;
      } catch (err) {
        debugLog(`⚠️ Trauungsbuchquellen in Kirchenbüchern laden: ${err.message || err}`);
      }
    }

    try { zeigeKbKurz(person, partnerFamilies.length); } catch (e) { debugLog(`⚠️ Kirchenbuch-Übersicht: ${e.message || e}`); }   // v412
    const spouseIds = [...new Set(partnerFamilies.map(f => f.partner_a_id === personId ? f.partner_b_id : f.partner_a_id).filter(Boolean))];
    // v372: auch Kinder aus Familien mit nur einem Elternteil (z. B. ledige oder verwitwete Mutter)
    const childFamilyIds = new Set((familyRows || []).map(f => f.id));
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
      button.dataset.sprechName = maiden ? `${name}, geborene ${maiden}` : name;   // v418: für „Vorlesen“
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
      button.dataset.personId = related.id;
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
      const beginnExakt = !!family.beginn;
      const marriage = personViewDatum(familieBeginnWert(family));
      if (marriage) {
        const date = document.createElement("span"); date.className = "person-view-relation-date";
        let duration = "";
        const startDate = new Date(`${beginnExakt ? String(family.beginn).slice(0, 10) : `${family.beginn_jahr}-01-01`}T00:00:00`);
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
        if (!family.ende && family.ende_jahr) addEndCandidate(`${family.ende_jahr}-12-31`, true);
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
          // v392: nur eine wirklich SPÄTERE Ehe beendet diese (gleiches Datum = Datenfehler, nicht „unter 1 Tag“)
          if (/^\d{4}-\d{2}-\d{2}$/.test(laterStart) && laterStart > currentStart) addEndCandidate(laterStart, false);
        });
        endCandidates.sort((a, b) => a.date - b.date);
        const earliest = endCandidates[0] || null;
        const endDate = earliest?.date || null;
        // v392: Ist ein Ehepartner schon VOR der Hochzeit gestorben, stimmt das Datum nicht – Hinweis statt Dauer
        const vorherGestorben = couple.find((p) => { const t = p.sterbedatum ? new Date(`${String(p.sterbedatum).slice(0, 10)}T00:00:00`) : (p.sterbejahr ? new Date(`${p.sterbejahr}-12-31T00:00:00`) : null); return t && !Number.isNaN(startDate.getTime()) && t < startDate; });
        const gleichesDatum = beginnExakt && (partnerFamilies || []).some((o) => o && o.id !== family.id && String(o.beginn || "").slice(0, 10) === String(family.beginn).slice(0, 10));
        if (vorherGestorben) {
          duration = ` · ⚠ bitte prüfen: ${vorherGestorben.vorname || "Ehepartner"} ist vor diesem Datum gestorben`;
        } else if (gleichesDatum) {
          duration = " · ⚠ bitte prüfen: gleiches Datum wie eine andere Ehe";
        } else if (endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate >= startDate) {
          let years = endDate.getFullYear() - startDate.getFullYear();
          if (endDate.getMonth() < startDate.getMonth() || (endDate.getMonth() === startDate.getMonth() && endDate.getDate() < startDate.getDate())) years--;
          if (years >= 0) duration = ` · ${dauerText(startDate, endDate, !earliest.approximate && beginnExakt)}`;
        }
        date.textContent = `💍 Hochzeit: ${marriage}${duration}`; row.appendChild(date);
      }
      spouseList.appendChild(row);
    }
    // v397: Ehepartner ohne eigenes Datenblatt (nur Name, kein Link)
    for (const eintrag of partnerOhneListe(person.partner_ohne_datenblatt)) {
      const row = document.createElement("div"); row.className = "person-view-relation-row person-view-relation-row--ohne";
      const name = document.createElement("span"); name.className = "person-view-ohne-name"; name.textContent = eintrag.name;
      name.title = "ohne eigenes Datenblatt";
      row.appendChild(name);
      if (eintrag.heirat) { const dt = document.createElement("span"); dt.className = "person-view-relation-date"; dt.textContent = `💍 Hochzeit: ${eintrag.heirat}`; row.appendChild(dt); }
      spouseList.appendChild(row);
    }
    spouseSection.hidden = !spouseList.children.length;

    const childrenSection = document.getElementById("pv-children-section");
    const childrenList = document.getElementById("pv-children-list"); childrenList.replaceChildren();
    const uniqueChildIds = [...new Set(childrenLinks.map(x => x.kind_id).filter(id => id && id !== personId))];
    uniqueChildIds.map(id => relatedMap.get(id)).filter(Boolean).sort((a,b) => String(a.geburtsdatum || a.geburtsjahr || "9999").localeCompare(String(b.geburtsdatum || b.geburtsjahr || "9999")) || `${a.nachname||""} ${a.vorname||""}`.localeCompare(`${b.nachname||""} ${b.vorname||""}`, "de")).forEach(child => addPersonLink(childrenList, child));
    for (const eintrag of partnerOhneListe(person.kinder_ohne_datenblatt)) { // v398
      const row = document.createElement("div"); row.className = "person-view-relation-row person-view-relation-row--ohne";
      const name = document.createElement("span"); name.className = "person-view-ohne-name"; name.textContent = eintrag.name; name.title = "ohne eigenes Datenblatt";
      row.appendChild(name);
      if (eintrag.geburt) { const dt = document.createElement("span"); dt.className = "person-view-relation-date"; dt.textContent = `* ${eintrag.geburt}`; row.appendChild(dt); }
      childrenList.appendChild(row);
    }
    childrenSection.hidden = !childrenList.children.length;
    void zeigeEhepartnerDerKinder(uniqueChildIds, childrenList, personId, relatedMap);

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
      bearbeitenAusAnsicht = personId; // v378: nach dem Schließen der Maske wieder diese Ansicht
      overlay.hidden = true; document.body.classList.remove("person-view-open");
      await openPersonEdit(personId, options);
    };
    overlay.hidden = false; overlay.scrollTop = 0; document.body.classList.add("person-view-open");
    try { komfortPersonAnsicht(person); } catch (e) { debugLog(`⚠️ Komfort Personenansicht: ${e.message || e}`); }   // v418
  } catch (err) {
    debugLog(`❌ Fehler beim Öffnen der Personenansicht: ${err?.message || err}`);
    document.getElementById("person-view-overlay")?.classList.remove("pv-laedt");
  }
}

document.getElementById("pv-back")?.addEventListener("click", () => { if (personViewVerlauf.length) void personZurueck(); else document.getElementById("pv-close")?.click(); });
document.getElementById("pv-close")?.addEventListener("click", async () => {
  if (personViewVerlauf.length) { await personZurueck(); return; }
  document.getElementById("person-view-overlay").hidden = true;
  document.body.classList.remove("person-view-open");
  void kehreZumGruppenfotoZurueck();
});
document.getElementById("person-view-overlay")?.addEventListener("click", (event) => {
  if (event.target.id === "person-view-overlay") {
    if (Date.now() - Number(event.currentTarget.dataset.geoeffnetUm || 0) < 900) return;   // v428: Safari-Nachklick ignorieren
    personViewVerlauf = [];
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
  for (const b of ["taufbuch", "trauungsbuch", "sterbebuch"]) { const el = document.getElementById(`d-${b}-seite`); if (el) el.value = person[`${b}_seite`] || ""; }
  { const tu = document.getElementById("d-todesumstand"), tt = document.getElementById("d-todesumstand-text");
    if (tu) tu.value = person.todesumstand && TODESUMSTAND.hasOwnProperty(person.todesumstand) ? person.todesumstand : "";
    if (tt) tt.value = person.todesumstand_text || ""; }
  zeichnePartnerOhneDatenblatt(person.partner_ohne_datenblatt, "partner");
  zeichnePartnerOhneDatenblatt(person.kinder_ohne_datenblatt, "kind");
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
  // v445: nur den Änderungsstand holen – die Bestandsliste hinter dem Fenster wird erst beim Schließen neu gezeichnet
  // (vorher wurde sie hier jedes Mal komplett neu aufgebaut und hat Tippen auf Tag/Monat/Jahr sekundenlang blockiert).
  try {
    if (personenCacheGeladen && personenCacheSyncInitialisiert) await synchronisierePersonenDelta();
    else await loadPersonen();
  } catch (_) {}
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
    void personenNachSpeichern();   // v431
    const zurueckZu = bearbeitenAusAnsicht;
    bearbeitenAusAnsicht = null;
    if (zurueckZu) { try { await openPersonDetail(zurueckZu, { zurueck: true, behalteRueckkehr: true }); } catch (err) { debugLog(`⚠️ Rückkehr zur Ansicht: ${err.message || err}`); } }
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
// v410: Ehe-Angaben und Trauungsbuch-Quellen werden mit dem gemeinsamen „Speichern“ gesichert
async function speichereOffeneEhen() {
  let ok = true, etwas = false;
  for (const item of document.querySelectorAll("#d-partner-list .familie-item")) {
    if (item.dataset.eheGeaendert === "1" && item._eheSpeichern) { etwas = true; ok = (await item._eheSpeichern({ ohneNeuladen: true })) && ok; delete item.dataset.eheGeaendert; }
    if (item.dataset.quelleGeaendert === "1" && item._quelleSpeichern) { etwas = true; ok = (await item._quelleSpeichern({ ohneNeuladen: true })) && ok; delete item.dataset.quelleGeaendert; }
  }
  if (etwas && currentDetailPersonId) await loadDetailFamilie(currentDetailPersonId);
  return ok;
}
document.getElementById("d-save-person-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-person-message");
  msg.textContent = "Speichere …";
  if (!(await speichereOffeneEhen())) { msg.textContent = "Ehe-Angaben konnten nicht gespeichert werden."; return; }
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
  const personAenderung = {
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
    taufbuch_seite: kbSeiteWert("d-taufbuch-seite"),
    trauungsbuch_seite: kbSeiteWert("d-trauungsbuch-seite"),
    sterbebuch_seite: kbSeiteWert("d-sterbebuch-seite"),
    todesumstand: document.getElementById("d-todesumstand")?.value || null,
    todesumstand_text: (document.getElementById("d-todesumstand")?.value && document.getElementById("d-todesumstand-text")?.value.trim()) || null,
    partner_ohne_datenblatt: lesePartnerOhneDatenblatt("partner"),
    kinder_ohne_datenblatt: lesePartnerOhneDatenblatt("kind"),
    Notiz: document.getElementById("d-notiz").value.trim() || null,
    weiterfuehrende_links: leseWeiterfuehrendeLinksEditor(),
  };
  const { error } = await mitKbSeite((mitSeite) => sb.from("personen").update(mitSeite ? personAenderung : ohneKbSeite(personAenderung)).eq("id", currentDetailPersonId));
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

  if (rolleIstEigentuemer()) kbUebersichtLaden();   // v412: Kirchenbuch-Übersicht aktualisieren
  msg.textContent = "Gespeichert ✓";
  void personenNachSpeichern();   // v431: geänderte Namen/Daten sofort überall
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
            if (!papierkorbAktiv) { await sb.storage.from(BUCKET_FOTOS).remove([foto.dateipfad]); await loescheFotoAusBrowserCache(foto.dateipfad); }
            await sb.from("fotos").delete().eq("id", foto.id);
          } else {
            alert("Die Verknüpfung wurde entfernt. Das Foto selbst bleibt im Archiv, Dateien löscht nur der Eigentümer.");
          }
        }
      } else {
        if (!darfLoeschen("Fotos löschen")) return;
        if (!papierkorbAktiv) { await sb.storage.from(BUCKET_FOTOS).remove([foto.dateipfad]); await loescheFotoAusBrowserCache(foto.dateipfad); }
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
  // v420: Namen erst beim Suchen zeigen (mind. 2 Zeichen); bereits Ausgewählte bleiben immer sichtbar
  const q = suchtext.trim();
  const gefiltert = q.length >= 2 ? personen.filter(p => personenSuchTreffer(p, suchtext)) : personen.filter(p => bisher.has(p.id));
  if (!gefiltert.length) {
    gruppenfotoPersonenListe.innerHTML = `<p class="gruppenfoto-personen-hinweis">${q.length >= 2 ? "Niemand gefunden." : "Namen eingeben – passende Personen erscheinen hier zur Auswahl."}</p>`;
    aktualisiereGruppenfotoPersonenAnzahl();
    return;
  }
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



// v404: Gruppenfoto austauschen (bessere Qualität, koloriert …) – Markierungen bleiben erhalten,
// weil sie in Prozent der Bildfläche gespeichert sind.
const bildMasse = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok(null); i.src = src; });
document.getElementById("gruppenfoto-austauschen-btn")?.addEventListener("click", () => document.getElementById("gruppenfoto-austauschen-input")?.click());
document.getElementById("gruppenfoto-austauschen-input")?.addEventListener("change", async (e) => {
  const datei = e.target.files?.[0];
  e.target.value = "";
  const foto = fotoPersonenAktuell;
  const msg = document.getElementById("gruppenfoto-austauschen-message");
  if (!datei || !foto) return;
  const knopf = document.getElementById("gruppenfoto-austauschen-btn");
  try {
    knopf.disabled = true;
    msg.textContent = "Foto anpassen …";
    const edited = await openPhotoEditor(datei);
    if (!edited) { msg.textContent = "Nicht übernommen."; return; }
    const optimiert = await blobZuJPEGUnter200KB(edited, 450);
    if (!optimiert) throw new Error("Foto konnte nicht optimiert werden.");
    // Seitenverhältnis vergleichen – weicht es ab, können die Markierungen verrutschen
    const alt = await bildMasse(fotoMarkierbild.src);
    const neuUrl = URL.createObjectURL(optimiert);
    const neu = await bildMasse(neuUrl);
    if (alt && neu && alt.w && neu.w) {
      const a = alt.w / alt.h, b = neu.w / neu.h;
      if (Math.abs(a - b) / a > 0.03 && fotoMarkierungen.length
        && !confirm(`Das neue Bild hat ein anderes Seitenverhältnis (${neu.w}×${neu.h} statt ${alt.w}×${alt.h}).\nDie ${fotoMarkierungen.length} Markierungen bleiben, können aber etwas verrutschen – danach einfach verschieben.\n\nTrotzdem austauschen?`)) { msg.textContent = "Nicht ausgetauscht."; URL.revokeObjectURL(neuUrl); return; }
    }
    const path = `gruppenfotos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    msg.textContent = `Lade hoch … (${Math.round(optimiert.size / 1024)} KB)`;
    const { error: upErr } = await sb.storage.from(BUCKET_FOTOS).upload(path, optimiert, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw upErr;
    const altPfad = foto.dateipfad;
    const { error: updErr } = await sb.from("fotos").update({ dateipfad: path }).eq("id", foto.id);
    if (updErr) { await sb.storage.from(BUCKET_FOTOS).remove([path]); throw updErr; }
    foto.dateipfad = path;
    // altes Bild nur löschen, wenn kein anderer Eintrag es noch verwendet
    try {
      const { data: andere } = await sb.from("fotos").select("id").eq("dateipfad", altPfad).limit(1);
      if (altPfad && !(andere || []).length) await sb.storage.from(BUCKET_FOTOS).remove([altPfad]);
    } catch {}
    fotoMarkierbild.src = neuUrl;
    msg.textContent = `✓ Bild ausgetauscht (${Math.round(optimiert.size / 1024)} KB) – Markierungen und Personen bleiben erhalten.`;
    try { if (typeof ladeGruppenfotoListe === "function") ladeGruppenfotoListe(); } catch {}
  } catch (err) {
    msg.textContent = `Austauschen fehlgeschlagen: ${err.message || err}`;
  } finally { knopf.disabled = false; }
});

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
      legend.style.cursor = "pointer";
    } else {
      const openPerson = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (Date.now() - (window.__gfOeffnetUm || 0) < 800) return;   // v428: zweites Auslösen ignorieren
        window.__gfOeffnetUm = Date.now();
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
      name.addEventListener("click", openPerson);   // v428: nur click – pointerup + click öffnete doppelt
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
      const { error: storageError } = papierkorbAktiv ? { error: null } : await sb.storage.from(BUCKET_AUDIO).remove([note.dateipfad]);
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

// v397: Ehepartner ohne eigenes Datenblatt – nur Name (+ optional Heiratsjahr/-datum und Notiz), als Liste bei der Person
function partnerOhneListe(wert) {
  let liste = wert;
  if (typeof liste === "string") { try { liste = JSON.parse(liste); } catch { liste = []; } }
  return Array.isArray(liste) ? liste.filter((x) => x && String(x.name || "").trim()) : [];
}
function partnerOhneZeile(eintrag = {}, art = "partner") {
  const z = document.createElement("div");
  z.className = "partner-ohne-zeile";
  const kind = art === "kind";
  z.innerHTML = `<input type="text" class="partner-ohne-name" maxlength="120" placeholder="${kind ? "Name, z. B. Maria" : "Name, z. B. … geb. Hohenfelder"}" aria-label="Name">
    <input type="text" class="partner-ohne-heirat" maxlength="20" placeholder="${kind ? "Geburt (Jahr oder Datum)" : "Heirat (Jahr oder Datum)"}" aria-label="${kind ? "Geburt" : "Heirat"}">
    <button type="button" class="btn btn--ghost partner-ohne-umwandeln" title="Aus diesem Namen eine richtige Person (Datenblatt) machen">↗ Datenblatt</button>
    <button type="button" class="btn btn--ghost partner-ohne-weg" aria-label="Entfernen">✕</button>`;
  z.querySelector(".partner-ohne-name").value = eintrag.name || "";
  z.querySelector(".partner-ohne-heirat").value = (kind ? eintrag.geburt : eintrag.heirat) || "";
  z.querySelector(".partner-ohne-umwandeln").addEventListener("click", () => ohneZuDatenblatt(z, art));
  z.addEventListener("input", () => setzeDetailGeaendert(true));
  z.querySelector(".partner-ohne-weg").addEventListener("click", () => { z.remove(); setzeDetailGeaendert(true); });
  return z;
}
function zeichnePartnerOhneDatenblatt(wert, art = "partner") {
  const box = document.getElementById(`d-${art}-ohne-liste`);
  if (!box) return;
  const liste = partnerOhneListe(wert);
  box.replaceChildren(...liste.map((e) => partnerOhneZeile(e, art)));
  const det = document.getElementById(`d-${art}-ohne`);
  if (det) det.open = liste.length > 0;
}
function lesePartnerOhneDatenblatt(art = "partner") {
  const feld = art === "kind" ? "geburt" : "heirat";
  return [...document.querySelectorAll(`#d-${art}-ohne-liste .partner-ohne-zeile`)]
    .map((z) => ({ name: z.querySelector(".partner-ohne-name").value.trim(), [feld]: z.querySelector(".partner-ohne-heirat").value.trim() }))
    .filter((x) => x.name)
    .map((x) => (x[feld] ? x : { name: x.name }));
}
// „Nur Name“ → richtige Person: Namen zerlegen, Person anlegen, verbinden, Eintrag aus der Liste nehmen
function ohneNameZerlegen(text) {
  const [links, geb] = String(text || "").split(/\s+geb\.\s+/);
  const teile = String(links || "").replace(/^[….?\s]+/, "").trim().split(/\s+/).filter(Boolean);
  let vorname = "", nachname = "";
  if (teile.length >= 2) { nachname = teile.pop(); vorname = teile.join(" "); } else if (teile.length === 1) vorname = teile[0];
  return { vorname: vorname || "unbekannt", nachname: nachname || null, ledig: geb ? geb.trim() : null };
}
function ohneDatum(text) {
  const t = String(text || "").trim();
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return { datum: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, jahr: Number(m[3]) };
  const j = t.match(/\b(\d{4})\b/);
  return j ? { datum: null, jahr: Number(j[1]) } : { datum: null, jahr: null };
}
async function ohneZuDatenblatt(zeile, art) {
  const personId = currentDetailPersonId;
  if (!personId) return;
  if (detailGeaendert) { alert("Bitte zuerst die übrigen Änderungen mit „Speichern“ sichern, dann „↗ Datenblatt“ erneut antippen."); return; }
  const name = zeile.querySelector(".partner-ohne-name").value.trim();
  if (!name) return;
  const zusatz = ohneDatum(zeile.querySelector(".partner-ohne-heirat").value);
  if (!confirm(`Für „${name}“ ein eigenes Datenblatt anlegen und mit dieser Person verbinden?\nDanach öffnet sich das neue Datenblatt zum Ergänzen.`)) return;
  try {
    const { data: ich } = await sb.from("personen").select("*").eq("id", personId).single();
    const n = ohneNameZerlegen(name);
    const ichMann = String(ich?.geschlecht || "").toLowerCase().startsWith("m");
    const neu = { vorname: n.vorname, nachname: n.nachname, Ledigenname: n.ledig };
    let familieFuerKind = null;
    if (art === "partner") {
      neu.geschlecht = ich?.geschlecht ? (ichMann ? "weiblich" : "männlich") : null;
      if (!neu.nachname && ichMann) neu.nachname = ich?.nachname || null;
    } else {
      neu.geburtsdatum = zusatz.datum; neu.geburtsjahr = zusatz.datum ? null : zusatz.jahr;
      // Familie für das Kind: die einzige Ehe der Person, sonst eine Eltern-Familie nur mit ihr
      const { data: fams } = await sb.from("familien").select("*").or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`);
      const ehen = (fams || []).filter((f) => f.partner_a_id && f.partner_b_id && String(f.familientyp || "").toLowerCase() !== "eltern");
      familieFuerKind = ehen.length === 1 ? ehen[0] : (fams || []).find((f) => !f.partner_b_id || !f.partner_a_id) || null;
      if (!neu.nachname) {
        const vater = ichMann ? ich : (ehen.length === 1 ? (await sb.from("personen").select("nachname, geschlecht").eq("id", ehen[0].partner_a_id === personId ? ehen[0].partner_b_id : ehen[0].partner_a_id).single()).data : null);
        neu.nachname = (vater && String(vater.geschlecht || "").toLowerCase().startsWith("m") ? vater.nachname : ich?.nachname) || null;
      }
    }
    const neueId = crypto.randomUUID();
    const { error: pe } = await sb.from("personen").insert({ id: neueId, ...Object.fromEntries(Object.entries(neu).filter(([, v]) => v !== undefined && v !== null && v !== "")) });
    if (pe) throw pe;
    if (art === "partner") {
      const fam = { partner_a_id: ichMann ? personId : neueId, partner_b_id: ichMann ? neueId : personId, familientyp: "Ehe", beginn: zusatz.datum, beginn_jahr: zusatz.datum ? null : zusatz.jahr };
      const { error: fe } = await mitFamJahr((mitJahr) => sb.from("familien").insert(mitJahr ? fam : ohneFamJahr(fam)));
      if (fe) throw fe;
    } else {
      if (!familieFuerKind) familieFuerKind = await findeOderErstelleFamilie(personId, null, "Eltern");
      await addKindZuFamilie(familieFuerKind.id, neueId);
    }
    // Eintrag aus der Liste nehmen und die Liste sofort speichern
    zeile.remove();
    const spalte = art === "kind" ? "kinder_ohne_datenblatt" : "partner_ohne_datenblatt";
    const { error: le } = await sb.from("personen").update({ [spalte]: lesePartnerOhneDatenblatt(art) }).eq("id", personId);
    if (le) debugLog(`⚠️ Liste ${spalte}: ${le.message}`);
    setzeDetailSauber();
    zeigeToast(`Datenblatt für „${name}“ angelegt`);
    void personenNachSpeichern(neueId);   // v431
    await openPersonEdit(neueId);
  } catch (err) {
    alert(`Das Datenblatt konnte nicht angelegt werden: ${err.message || err}`);
  }
}
for (const art of ["partner", "kind"]) {
  document.getElementById(`d-${art}-ohne-plus`)?.addEventListener("click", () => {
    const box = document.getElementById(`d-${art}-ohne-liste`);
    const z = partnerOhneZeile({}, art);
    box?.appendChild(z);
    z.querySelector(".partner-ohne-name")?.focus();
  });
}

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
    knopf.textContent = "✏️";
    knopf.title = "Art, Beginn und Ende der Ehe bearbeiten"; knopf.setAttribute("aria-label", knopf.title);
    knopf.addEventListener("click", () => {
      const offen = felder.hidden;
      felder.hidden = !offen;
      knopf.setAttribute("aria-expanded", String(offen));
      knopf.textContent = offen ? "Fertig" : "✏️";
    });
    kopf.append(text, knopf);
    felder.hidden = true;
    (item.querySelector(".familie-partner-link") || felder).after(kopf);   // v410: Kopf direkt unter dem Namen
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
  // v375: Vater/Mutter auswählen speichert sofort (wie angekündigt). Nur das Entfernen braucht „Eltern speichern“.
  ["d-vater", "d-mutter"].forEach((id) => el(id)?.addEventListener("change", (e) => {
    const sel = e.currentTarget;
    const vomNutzer = e.isTrusted || sel.dataset.nutzerAuswahl === "1";
    delete sel.dataset.nutzerAuswahl;
    if (!vomNutzer) return;
    const s = el("d-save-eltern-btn");
    if (sel.value) { if (s) { s.hidden = true; s.click(); } }
    else if (s) s.hidden = false;
  }));
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
    const { error: e3 } = await mitKbSeite((mitSeite) => sb.from("personen").update(mitSeite ? { trauungsbuch_link: null, trauungsbuch_zeile: null, trauungsbuch_seite: null } : { trauungsbuch_link: null, trauungsbuch_zeile: null }).eq("id", p.id));
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
      .select("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr, Notiz")
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
      .select("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr")
      .in("id", Array.from(detailPersonIds));   // v406: geschlecht nötig für Vater/Mutter
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

    // v405: Grundsätzlich A = Vater, B = Mutter. Ist aber nur EIN Elternteil gespeichert (steht dann immer in A)
    // oder sind die beiden vertauscht, entscheidet das Geschlecht – sonst erschien z. B. eine Mutter als „Vater“.
    const weiblich = (p) => /^w/i.test(String(p?.geschlecht || ""));
    const maennlich = (p) => /^m/i.test(String(p?.geschlecht || ""));
    if (a && !b) {
      if (weiblich(a)) mutterId = a.id; else vaterId = a.id;
    } else if (!a && b) {
      if (maennlich(b)) vaterId = b.id; else mutterId = b.id;
    } else if (a && b && weiblich(a) && maennlich(b)) {
      vaterId = b.id; mutterId = a.id;
    } else {
      vaterId = a?.id || null;
      mutterId = b?.id || null;
    }
  }

  // v445: einmal sortieren, Listen in einem Schritt einsetzen (je ~2500 Einträge)
  const elternKandidaten = personenCache.filter((p) => p.id !== personId).sort(personenAuswahlSortierung);
  // Ist der Elternteil schon eingetragen, ist die Liste verborgen: dann nur diesen einen Eintrag einsetzen,
  // die volle Liste erst beim Tippen auf ✏️ (spart beim Öffnen je ~2500 Einträge).
  const elternBekannt = new Map([[parentSelectVater, vaterId], [parentSelectMutter, mutterId]]);
  [parentSelectVater, parentSelectMutter].forEach((select) => {
    const id = elternBekannt.get(select);
    const bekannt = id ? elternKandidaten.find((p) => p.id === id) : null;
    if (bekannt) { fuellePersonenAuswahl(select, [bekannt], "— nicht angegeben —"); select._volleListe = elternKandidaten; }
    else { fuellePersonenAuswahl(select, elternKandidaten, "— nicht angegeben —"); select._volleListe = null; }
  });

  parentSelectVater.value = vaterId || "";
  parentSelectMutter.value = mutterId || "";
  const aktualisiereElternLink = (select, button) => {
    const gewaehlt = select.value;   // v445: nur einmal lesen (vorher je Person ein Lesezugriff auf die 2500er-Liste)
    const person = gewaehlt ? personenCache.find(p => p.id === gewaehlt) : null;
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
      if (select._volleListe) {   // v445: volle Liste erst jetzt
        const wert = select.value;
        fuellePersonenAuswahl(select, select._volleListe, "— nicht angegeben —");
        select._volleListe = null;
        select.value = wert;
      }
      select.hidden = false; if (openBtn) openBtn.hidden = true; select.focus();
    };
  });
  [parentSelectVater, parentSelectMutter].forEach(select => {
    if (select.dataset.elternLinkInit) return;   // v445: nicht bei jedem Öffnen einen weiteren Beobachter anhängen
    select.dataset.elternLinkInit = "1";
    select.addEventListener("change", () => {
      const openBtn = document.getElementById(select.id === "d-vater" ? "d-vater-open" : "d-mutter-open");
      aktualisiereElternLink(select, openBtn);
    });
  });

  partnerList.innerHTML = "";
  // Ehe-/Partnerschaftsblöcke chronologisch sortieren: frühester Beginn zuerst.
  // Unbekannte Beginndaten bleiben am Ende; die Originaldaten werden nicht verändert.
  const partnerFamiliesChronologisch = [...(partnerFamilies || [])].sort((a, b) => {
    const da = String(familieBeginnWert(a) || "").slice(0, 10);
    const db = String(familieBeginnWert(b) || "").slice(0, 10);
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
        <div class="familie-trauungsbuch detail-event-source" aria-live="polite"><span class="source-heading">Trauungsbuch</span>
          <input type="url" class="familie-source-url source-url-hidden" placeholder="https://…" aria-label="Trauungsbuch-URL">
          <div class="source-button-line"><a class="btn source-open-btn familie-trauungsbuch-link" target="_blank" rel="noopener"></a><span class="source-line-label">Zeile</span><input type="number" class="familie-source-row" min="1" inputmode="numeric" placeholder="–" aria-label="Zeile"><select class="familie-source-side source-side-select" aria-label="Seite der Doppelseite"><option value="">Seite –</option><option value="links">links</option><option value="rechts">rechts</option></select><button type="button" class="source-edit-btn familie-source-edit" title="Trauungsbuch-Link bearbeiten" aria-label="Trauungsbuch-Link bearbeiten">✏️</button></div>
          <span class="familie-trauungsbuch-zeile"></span>
          <div class="familie-source-editor" hidden></div><button type="button" class="familie-source-save" hidden></button>
        </div>
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
          <button type="button" class="btn btn--secondary familie-save-btn" hidden>Partnerschaft speichern</button>
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
    setDatumElemente(beginnTag, beginnMonat, beginnJahr, familieBeginnWert(f));
    if (!f.ende && f.ende_jahr) {
      setDatumElemente(endeTag, endeMonat, endeJahr, String(f.ende_jahr));
    } else if (f.ende) {
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
        .select("*")
        .eq("familie_id", f.id)
        .maybeSingle();
      if (eheQuelleError) throw eheQuelleError;
      eheQuelle = eheQuelleData || null;
      if (!eheQuelle) {
        const { data: quellenPersonen, error: quellenError } = await sb.from("personen")
          .select("*")
          .in("id", [personId, otherId]);
        if (quellenError) throw quellenError;
        const legacyQuelle = await eindeutigeAlteTrauungsQuelle(quellenPersonen || []);
        if (legacyQuelle) eheQuelle = {
          alt: true,
          familie_id: f.id,
          trauungsbuch_link: legacyQuelle.trauungsbuch_link || "",
          trauungsbuch_zeile: legacyQuelle.trauungsbuch_zeile || null,
          trauungsbuch_seite: legacyQuelle.trauungsbuch_seite || null
        };
      }
      if (eheQuelle?.trauungsbuch_link) {
        familienQuelleLink.href = eheQuelle.trauungsbuch_link;
        familienQuelleLink.textContent = "📖 Trauungsbuch öffnen";
        familienQuelleLink.hidden = false;
        familienQuelleLink.classList.add("btn--link-present");
        familienQuelleLink.removeAttribute("aria-disabled");
        familienQuelleZeile.textContent = matriculaFundstelle(eheQuelle.trauungsbuch_link)?.text || "";
      } else {
        familienQuelleLink.hidden = false;
        familienQuelleLink.href = "#";
        familienQuelleLink.textContent = "📖 Kein Trauungsbuch-Link";
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
    const sourceSideInput = div.querySelector(".familie-source-side");
    if (sourceSideInput) sourceSideInput.value = eheQuelle?.trauungsbuch_seite || "";
    div.dataset.familieId = f.id;
    sourceEditBtn.addEventListener("click", () => {   // v410: wie beim Taufbuch – URL-Feld ein-/ausblenden
      sourceUrlInput.classList.toggle("source-url-hidden"); sourceUrlInput.classList.toggle("source-url-editing");
      if (!sourceUrlInput.classList.contains("source-url-hidden")) sourceUrlInput.focus();
    });
    // v410: Änderungen an Quelle oder Ehe-Angaben → Speicherleiste; gespeichert wird mit „Speichern“
    const quelleGeaendert = () => { div.dataset.quelleGeaendert = "1"; setzeDetailGeaendert(true); };
    [sourceUrlInput, sourceRowInput, div.querySelector(".familie-source-side")].forEach((x) => x?.addEventListener("input", quelleGeaendert));
    div.querySelector(".familie-source-side")?.addEventListener("change", quelleGeaendert);
    div.querySelector(".familie-edit-fields")?.addEventListener("change", () => { div.dataset.eheGeaendert = "1"; setzeDetailGeaendert(true); });
    div._quelleSpeichern = async ({ ohneNeuladen = false } = {}) => {
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
        if (!eheQuelle?.trauungsbuch_link) return true;
        if (!confirm("Trauungsbuch-Link dieser Ehe entfernen?")) return false;
        const fehler = await entferneTrauungsQuelle(f.id, eheQuelle.trauungsbuch_link, [personId, otherId], !!eheQuelle.alt);
        if (fehler) { alert(`Trauungsbuch-Quelle konnte nicht entfernt werden: ${fehler}`); return false; }
        // v410: altes Personenfeld auch im (versteckten) Formularfeld leeren, sonst schreibt „Speichern“ es zurück
        if (eheQuelle.alt) for (const id of ["d-trauungsbuch-link", "d-trauungsbuch-zeile", "d-trauungsbuch-seite"]) { const x = document.getElementById(id); if (x) x.value = ""; }
        if (!ohneNeuladen) await loadDetailFamilie(currentDetailPersonId);
        return true;
      }
      const updateDaten = {
        familie_id: f.id,
        trauungsbuch_link: url,
        trauungsbuch_zeile: row,
        trauungsbuch_seite: sourceSideInput && ["links", "rechts"].includes(sourceSideInput.value) ? sourceSideInput.value : null,
        geaendert_am: new Date().toISOString()
      };
      const { error } = await mitKbSeite((mitSeite) => sb.from("familien_trauungsbuch_quellen").upsert(mitSeite ? updateDaten : ohneKbSeite(updateDaten), { onConflict: "familie_id" }));
      if (error) { alert(`Trauungsbuch-Quelle konnte nicht gespeichert werden: ${error.message}`); return false; }
      if (!ohneNeuladen) await loadDetailFamilie(currentDetailPersonId);
      return true;
    };
    div.querySelector(".familie-source-save").addEventListener("click", () => div._quelleSpeichern());

    div._eheSpeichern = async ({ ohneNeuladen = false } = {}) => {
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
        beginn_jahr: getDatum(beginnPrefix) ? null : nurJahr(beginnPrefix),
        ende: eingegebenesEnde,
        ende_jahr: eingegebenesEnde ? null : nurJahr(endePrefix),
        ende_automatik_ignorieren: automatikIgnorieren,
      };
      const msg = document.getElementById("d-familie-message");
      msg.textContent = "Partnerschaft wird gespeichert …";
      const { error } = await mitFamJahr((mitJahr) => sb.from("familien").update(mitJahr ? updates : ohneFamJahr(updates)).eq("id", f.id));
      if (error) {
        msg.textContent = `Fehler: ${error.message}`;
        return false;
      }
      msg.textContent = "";
      if (!ohneNeuladen) await loadDetailFamilie(personId);
      return true;
    };
    div.querySelector(".familie-save-btn").addEventListener("click", () => div._eheSpeichern());

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
        alleZeilenLaden(() => sb.from("familien_kinder").select("kind_id").order("kind_id")),
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
  fuellePersonenAuswahl(select, kandidaten, "— auswählen —");
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
      const befunde = lookup.has(partnerId) ? plausPartnerschaft({ beginn, ende, beginn_jahr: beginn ? null : nurJahr("d-partner-beginn"), ende_jahr: ende ? null : nurJahr("d-partner-ende"), familientyp: typ }, selbstForm, lookup.get(partnerId)) : [];
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
        beginn_jahr: beginn ? null : nurJahr("d-partner-beginn"),
        ende,
        ende_jahr: ende ? null : nurJahr("d-partner-ende"),
      };
      debugLog(`FAMILIEN-INSERT: ${JSON.stringify(familienDatensatz)}`);
      const { data: familienData, error: familyErr } = await mitFamJahr((mitJahr) => sb
        .from("familien")
        .insert(mitJahr ? familienDatensatz : ohneFamJahr(familienDatensatz))
        .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
        .single());

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
  if (!confirm(papierkorbAktiv
    ? "Diese Person inkl. aller Fotos, Sprachnotizen und Beziehungen in den Papierkorb legen?\n\nDer Eigentümer kann sie 30 Tage lang wiederherstellen (Verlauf → Papierkorb)."
    : "Diese Person inkl. aller Fotos, Sprachnotizen und Beziehungen unwiderruflich löschen?")) return;
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
      if (f.dateipfad && !papierkorbAktiv) { await sb.storage.from(BUCKET_FOTOS).remove([f.dateipfad]); await loescheFotoAusBrowserCache(f.dateipfad); }
      const { error } = await sb.from("fotos").delete().eq("id", f.id);
      if (error) throw error;
    }

    const { data: audios, error: audioFetchError } = await sb.from("sprachnotizen")
      .select("*").eq("person_id", currentDetailPersonId);
    if (audioFetchError) throw audioFetchError;

    for (const a of audios || []) {
      if (a.dateipfad && !papierkorbAktiv) await sb.storage.from(BUCKET_AUDIO).remove([a.dateipfad]);
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
