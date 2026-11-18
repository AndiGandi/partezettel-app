// Familienspuren – Hausblätter-Import (nur Eigentümer)
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 439

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
      <p class="imp-klein">${escapeHtml(hp.quelle || `Hausblatt Innerberg Nr. ${(hp.haeuser || []).join(", ")}`)}${(hp.kontext || []).length ? ` · ${escapeHtml(hp.kontext.slice(0, 3).join(" · "))}` : ""}</p>
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
      const { data, error } = await filter(sb.from(tabelle).select(spalten)).order("id").range(von, von + 999); // v374: feste Reihenfolge
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
    // v388: andere Quellen (z. B. Sippenbuch) bringen ihren Herkunftstext selbst mit
    const haeuserText = hp.quelle || `Hausblatt Innerberg Nr. ${(hp.haeuser || []).join(", ")}`;
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
    // v376: Heirat nur mit Jahr in beginn_jahr übernehmen, sofern die Spalte existiert (Paket 6)
    let famJahrOk = false;
    try { famJahrOk = !(await sb.from("familien").select("beginn_jahr").limit(1)).error; } catch { famJahrOk = false; }
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
        if (famJahrOk && B && !fa.heirat_iso && fa.heirat_jahr) zeile.beginn_jahr = Number(fa.heirat_jahr);
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
    const dbHaeuser = await alleZeilen("haeuser", "id, ort, nummer, name", (q) => q.order("ort"));
    const hausNach = new Map(dbHaeuser.map((h) => [hausSchluessel(h.ort, h.nummer), h.id]));
    const hausInfo = new Map((paket.haeuser || []).map((h) => [hausSchluessel(h.ort, h.nummer), h]));
    // v378: vorhandene Häuser ohne Namen bekommen den Namen aus dem Hausblatt
    p.hausNamen = [];
    for (const h of dbHaeuser) {
      const info = hausInfo.get(hausSchluessel(h.ort, h.nummer));
      if (info?.name && !String(h.name || "").trim()) p.hausNamen.push({ id: h.id, name: info.name });
    }
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
      for (const hn of plan.hausNamen || []) {
        const { error: hnErr } = await sb.from("haeuser").update({ name: hn.name }).eq("id", hn.id).or("name.is.null,name.eq.");
        if (hnErr) debugLog(`⚠️ Hausname ${hn.name}: ${hnErr.message}`);
      }
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
      await zaehle("foto_personen", "personen_id", "Foto-Markierungen");
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
function zeigeLinienZeile(person) {   // v409
  const ziel = document.getElementById("pv-lifetime");
  if (!ziel) return;
  let box = document.getElementById("pv-linien");
  if (!box) { box = document.createElement("p"); box.id = "pv-linien"; box.className = "pv-linien"; ziel.insertAdjacentElement("afterend", box); }
  const list = stammlinienInfo.get(person?.id) || [];
  box.hidden = !list.length;
  box.innerHTML = list.map((e) => {
    const l = STAMMLINIEN.find((x) => x.key === e.key); const g = stammlinienGruender[e.key];
    const nach = e.gen > 0 && g ? ` nach ${escapeHtml(g.vorname)} (*${String(g.geburtsdatum || "").slice(0, 4)})` : "";
    return `<span class="pv-linie"><span class="linie-badge linie-${e.key}${e.mann ? "" : " is-tochter"}">${l?.kurz || "?"}</span> <strong>${escapeHtml(l?.name || "")}</strong> · ${e.gen === 0 ? "Gründer" : `${e.gen}. Generation${nach}`} · ${e.mann ? "im Mannesstamm" : "über eine Tochter"}</span>`;
  }).join("<br>");
}
document.addEventListener("stammlinien-bereit", () => {
  try { for (const karte of personenKartenCache.values()) if (karte?.person) aktualisierePersonenKarte(karte, karte.person); } catch {}
  try { const pv = document.getElementById("person-view-overlay"); if (pv && !pv.hidden && currentPersonViewId) zeigeLinienZeile({ id: currentPersonViewId }); } catch {}
  try { const t = document.querySelector('.tab-btn[aria-selected="true"]')?.dataset.tab; if (t === "stammbaum") renderStammbaum(document.getElementById("tree-person-select")?.value); } catch {}
});

function zeigeHerkunftsvermerk(person) {
  zeigeLinienZeile(person);
  const ziel = document.getElementById("pv-lifetime");
  if (!ziel) return;
  let box = document.getElementById("pv-herkunft");
  if (!box) { box = document.createElement("p"); box.id = "pv-herkunft"; box.className = "pv-herkunft"; ziel.insertAdjacentElement("afterend", box); }
  box.innerHTML = "";
  if (!person?.herkunft_quelle || !rolleIstEigentuemer()) { box.hidden = true; return; }
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

// v370: Wohnorte (Stationen) in der Personenansicht – anzeigen für alle, bearbeiten für Bearbeiter/Eigentümer
let wohnorteLauf = 0, wohnorteBearbeiten = false, wohnortePersonId = null;
const STATION_ART = { geboren: "Geburtshaus", elternhaus: "Elternhaus", wohnte: "wohnte", zugezogen: "zugezogen" };
const STATION_RANG = { geboren: 0, elternhaus: 0, wohnte: 1, zugezogen: 2 };
const hausText = (h) => `${h.ort}${h.nummer ? ` Nr. ${h.nummer}` : ""}${h.name ? ` „${h.name}“` : ""}`;
function stationFehlerText(error) {
  const t = `${error?.code || ""} ${error?.message || ""}`;
  if (/art_check|check constraint/i.test(t)) return "Diese Art ist in der Datenbank noch nicht erlaubt. Bitte zuerst Paket 5 (Elternhaus) in Supabase einspielen.";
  if (/duplicate|23505|doppelt/i.test(t)) return "Diesen Wohnort gibt es bei der Person schon (gleiches Haus, gleiche Art, gleiches Jahr).";
  return error?.message || String(error);
}
async function ladeWohnorte(personId) {
  const lauf = ++wohnorteLauf;
  if (wohnortePersonId !== personId) wohnorteBearbeiten = false;
  wohnortePersonId = personId;
  const section = document.getElementById("pv-wohnorte-section");
  const liste = document.getElementById("pv-wohnorte-list");
  if (!section || !liste) return;
  const darf = rolleDarfSchreiben();
  liste.innerHTML = "";
  let kopfBtn = document.getElementById("pv-wohnorte-edit");
  if (!kopfBtn && darf) {
    kopfBtn = document.createElement("button");
    kopfBtn.type = "button"; kopfBtn.id = "pv-wohnorte-edit"; kopfBtn.className = "btn btn--ghost imp-link wohnort-edit-toggle";
    section.querySelector("h3")?.appendChild(kopfBtn);
    kopfBtn.addEventListener("click", () => { wohnorteBearbeiten = !wohnorteBearbeiten; ladeWohnorte(wohnortePersonId); });
  }
  if (kopfBtn) { kopfBtn.hidden = !darf; kopfBtn.textContent = wohnorteBearbeiten ? "Fertig" : "✏️"; kopfBtn.title = wohnorteBearbeiten ? "Bearbeiten beenden" : "Wohnorte bearbeiten"; }
  try {
    const { data: st, error } = await sb.from("person_stationen").select("id, haus_id, art, jahr, datum, sortierung, quelle, notiz").eq("personen_id", personId);
    if (error) { if (!tabelleFehlt(error)) debugLog(`⚠️ Wohnorte: ${error.message}`); section.hidden = true; return; }
    if (lauf !== wohnorteLauf) return;
    const stationen = st || [];
    // Ehepartner und deren Geburts-/Elternhäuser (für „Haus des Ehepartners“)
    const partnerHaus = new Map();
    try {
      const [fa, fb] = await Promise.all([
        sb.from("familien").select("partner_a_id, partner_b_id, familientyp").eq("partner_a_id", personId),
        sb.from("familien").select("partner_a_id, partner_b_id, familientyp").eq("partner_b_id", personId)
      ]);
      const partnerIds = [...new Set([...(fa.data || []), ...(fb.data || [])].filter((f) => f.partner_a_id && f.partner_b_id && f.familientyp !== "Eltern")
        .map((f) => (f.partner_a_id === personId ? f.partner_b_id : f.partner_a_id)))];
      if (partnerIds.length) {
        const [{ data: pst }, { data: pp }] = await Promise.all([
          sb.from("person_stationen").select("personen_id, haus_id, art").in("personen_id", partnerIds),
          sb.from("personen").select("id, vorname").in("id", partnerIds)
        ]);
        const pName = new Map((pp || []).map((x) => [x.id, x.vorname]));
        for (const x of pst || []) {
          if (x.art === "geboren" || x.art === "elternhaus") partnerHaus.set(x.haus_id, pName.get(x.personen_id) || "");
        }
      }
    } catch (err) { debugLog(`⚠️ Wohnorte, Ehepartner: ${err.message || err}`); }
    if (lauf !== wohnorteLauf) return;
    const hausIds = [...new Set(stationen.map((x) => x.haus_id))];
    let hausNach = new Map();
    if (hausIds.length) {
      const { data: haeuser, error: he } = await sb.from("haeuser").select("id, ort, nummer, name").in("id", hausIds);
      if (he) { debugLog(`⚠️ Häuser: ${he.message}`); return; }
      hausNach = new Map((haeuser || []).map((h) => [h.id, h]));
    }
    if (lauf !== wohnorteLauf) return;
    const jahrVon = (x) => x.jahr || (x.datum ? Number(String(x.datum).slice(0, 4)) : null);
    // v393: zuerst Geburtshaus, dann Elternhaus, danach die übrigen – Einträge mit Jahr in zeitlicher Reihenfolge
    // (Einträge ohne Jahr behalten ihren Platz, nur die datierten werden untereinander nach Jahr geordnet)
    const rang = (x) => x.art === "geboren" ? 0 : x.art === "elternhaus" ? 1 : 2;
    const sortiert = [...stationen].sort((a, b) => rang(a) - rang(b) || (a.sortierung || 0) - (b.sortierung || 0));
    {
      const plaetze = sortiert.map((x, i) => (rang(x) === 2 && jahrVon(x) ? i : -1)).filter((i) => i >= 0);
      const datiert = plaetze.map((i) => sortiert[i]).sort((a, b) => jahrVon(a) - jahrVon(b) || (a.sortierung || 0) - (b.sortierung || 0));
      plaetze.forEach((i, k) => { sortiert[i] = datiert[k]; });
    }
    for (const x of sortiert) {
      const h = hausNach.get(x.haus_id);
      if (!h) continue;
      const li = document.createElement("li");
      const kopf = document.createElement("span");
      kopf.className = "wohnort-haus";
      kopf.textContent = hausText(h);
      li.appendChild(kopf);
      if (wohnorteBearbeiten && darf) {
        li.classList.add("is-edit");
        const box = document.createElement("span");
        box.className = "wohnort-edit";
        const art = document.createElement("select");
        art.setAttribute("aria-label", "Art");
        for (const [w, t] of Object.entries(STATION_ART)) art.add(new Option(t, w, false, w === x.art));
        const jahr = document.createElement("input");
        jahr.type = "number"; jahr.inputMode = "numeric"; jahr.min = "1000"; jahr.max = "2100"; jahr.placeholder = "Jahr"; jahr.value = jahrVon(x) || "";
        jahr.setAttribute("aria-label", "Jahr");
        const speichern = document.createElement("button");
        speichern.type = "button"; speichern.className = "btn btn--secondary imp-link"; speichern.textContent = "Speichern";
        const weg = document.createElement("button");
        weg.type = "button"; weg.className = "btn btn--ghost imp-link"; weg.textContent = "🗑"; weg.title = "Wohnort entfernen";
        speichern.addEventListener("click", async () => {
          const j = jahr.value.trim() ? Number(jahr.value) : null;
          if (j !== null && (!Number.isInteger(j) || j < 1000 || j > 2100)) { window.alert("Bitte ein gültiges Jahr eingeben (z. B. 1874) oder das Feld leer lassen."); return; }
          const aenderung = { art: art.value, sortierung: STATION_RANG[art.value] ?? 1 };
          if (j !== jahrVon(x)) { aenderung.jahr = j; aenderung.datum = null; }
          const { error: ue } = await sb.from("person_stationen").update(aenderung).eq("id", x.id);
          if (ue) { window.alert(`Konnte nicht gespeichert werden: ${stationFehlerText(ue)}`); return; }
          ladeWohnorte(personId);
        });
        weg.addEventListener("click", async () => {
          if (!window.confirm(`Wohnort „${hausText(h)}“ bei dieser Person entfernen? Das Haus selbst bleibt bestehen.`)) return;
          const { error: de } = await sb.from("person_stationen").delete().eq("id", x.id);
          if (de) { window.alert(`Konnte nicht entfernt werden: ${de.message}`); return; }
          ladeWohnorte(personId);
        });
        box.append(art, jahr, speichern, weg);
        li.appendChild(box);
      } else {
        const info = document.createElement("span");
        info.className = "wohnort-info";
        const zeit = x.datum ? personViewDatum(String(x.datum).slice(0, 10)) : (x.jahr ? String(x.jahr) : "");
        info.textContent = [STATION_ART[x.art] || x.art, zeit].filter(Boolean).join(" ");
        li.appendChild(info);
        if ((x.art === "zugezogen" || x.art === "wohnte") && partnerHaus.has(x.haus_id)) {
          const ehe = document.createElement("small");
          ehe.className = "wohnort-ehe";
          const n = partnerHaus.get(x.haus_id);
          ehe.textContent = `Haus des Ehepartners${n ? ` (${n})` : ""}`;
          li.appendChild(ehe);
        }
      }
      if (x.quelle || x.notiz) {
        const q = document.createElement("small");
        q.className = "wohnort-quelle";
        q.textContent = [x.quelle, x.notiz ? `„${x.notiz}“` : ""].filter(Boolean).join(" · ");
        li.appendChild(q);
      }
      liste.appendChild(li);
    }
    if (wohnorteBearbeiten && darf) liste.appendChild(neuerWohnortFormular(personId));
    else if (!liste.children.length && darf) {
      const leer = document.createElement("li");
      leer.className = "wohnort-leer";
      leer.textContent = "Noch keine Wohnorte – mit ✏️ hinzufügen.";
      liste.appendChild(leer);
    }
    section.hidden = !liste.children.length;
  } catch (err) {
    debugLog(`⚠️ Wohnorte: ${err.message || err}`);
  }
}
function neuerWohnortFormular(personId) {
  const li = document.createElement("li");
  li.className = "wohnort-neu";
  li.innerHTML = `<span class="wohnort-haus">＋ Wohnort hinzufügen</span>
    <span class="wohnort-edit">
      <input type="text" class="wn-ort" list="wn-orte" placeholder="Ort" value="Innerberg" aria-label="Ort">
      <input type="text" class="wn-nummer" inputmode="numeric" placeholder="Nr." aria-label="Hausnummer">
      <select class="wn-art" aria-label="Art">${Object.entries(STATION_ART).map(([w, t]) => `<option value="${w}"${w === "geboren" ? " selected" : ""}>${t}</option>`).join("")}</select>
      <input type="number" class="wn-jahr" inputmode="numeric" placeholder="Jahr" aria-label="Jahr">
      <button type="button" class="btn btn--primary imp-link wn-speichern">Hinzufügen</button>
    </span><datalist id="wn-orte"></datalist>`;
  alleZeilenLaden(() => sb.from("haeuser").select("ort").order("ort")).then(({ data }) => {
    const dl = li.querySelector("#wn-orte");
    [...new Set((data || []).map((h) => h.ort))].sort().forEach((o) => dl.appendChild(new Option(o)));
  });
  li.querySelector(".wn-speichern").addEventListener("click", async () => {
    const ort = li.querySelector(".wn-ort").value.trim();
    const nummer = li.querySelector(".wn-nummer").value.trim() || null;
    const art = li.querySelector(".wn-art").value;
    const jt = li.querySelector(".wn-jahr").value.trim();
    const jahr = jt ? Number(jt) : null;
    if (!ort) { window.alert("Bitte einen Ort eingeben."); return; }
    if (jahr !== null && (!Number.isInteger(jahr) || jahr < 1000 || jahr > 2100)) { window.alert("Bitte ein gültiges Jahr eingeben oder das Feld leer lassen."); return; }
    const { data: alle, error: he } = await alleZeilenLaden(() => sb.from("haeuser").select("id, ort, nummer").order("id"));
    if (he) { window.alert(`Häuser konnten nicht geladen werden: ${he.message}`); return; }
    const key = (o, n) => `${String(o || "").trim().toLowerCase()}|${String(n || "").trim()}`;
    let haus = (alle || []).find((h) => key(h.ort, h.nummer) === key(ort, nummer));
    if (!haus) {
      if (!window.confirm(`Das Haus „${ort}${nummer ? ` Nr. ${nummer}` : ""}“ gibt es noch nicht. Neu anlegen?`)) return;
      const neu = { id: crypto.randomUUID(), ort, nummer };
      const { error: ie } = await sb.from("haeuser").insert(neu);
      if (ie) { window.alert(`Haus konnte nicht angelegt werden: ${ie.message}`); return; }
      haus = neu;
    }
    const station = { id: crypto.randomUUID(), personen_id: personId, haus_id: haus.id, art, jahr, sortierung: STATION_RANG[art] ?? 1, quelle: `von Hand eingetragen${zugang?.name ? ` (${zugang.name})` : ""}` };
    const { error: se } = await sb.from("person_stationen").insert(station);
    if (se) { window.alert(`Konnte nicht gespeichert werden: ${stationFehlerText(se)}`); return; }
    ladeWohnorte(personId);
  });
  return li;
}
