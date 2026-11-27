// Familienspuren – Datenprüfung (nur Eigentümer), ab Version 467
// Sucht mögliche Dubletten und unwahrscheinliche Angaben. Was als „stimmt so“ oder „verschiedene Personen“
// markiert ist (Tabelle pruef_ausnahmen, Supabase Paket 12), erscheint bei späteren Prüfungen nicht mehr.
// Dubletten lassen sich zusammenführen (Funktion fs_personen_zusammenfuehren, Paket 12). Version 467

const PRUEF_REGELN = {
  dublette:             { sym: "👥", titel: "Mögliche Dubletten", text: "Gleiche oder ähnlich geschriebene Namen (Mathies/Mathis, Leo/Leopold, Ernst Emil/Emil Ernst) und passende Geburts- oder Sterbedaten.", ok: "✓ Verschiedene Personen" },
  tod_vor_geburt:       { sym: "⛔", titel: "Tod vor der Geburt", text: "Das Sterbedatum liegt vor dem Geburtsdatum." },
  kind_nach_tod_mutter: { sym: "🕯️", titel: "Kind nach dem Tod der Mutter geboren", text: "Ein Kind ist nach dem Sterbedatum der Mutter geboren." },
  kind_nach_tod_vater:  { sym: "🕯️", titel: "Kind lange nach dem Tod des Vaters geboren", text: "Ein Kind ist mehr als 10 Monate nach dem Tod des Vaters geboren." },
  vater_alter:          { sym: "👴", titel: "Ungewöhnliches Alter des Vaters", text: "Vater bei der Geburt jünger als 16 oder älter als 65." },
  mutter_alter:         { sym: "👵", titel: "Ungewöhnliches Alter der Mutter", text: "Mutter bei der Geburt jünger als 15 oder älter als 48." },
  ehe_jung:             { sym: "💍", titel: "Sehr junge Heirat", text: "Ein Partner war bei der Heirat jünger als 15." },
  ueber_105:            { sym: "🎂", titel: "Über 105 Jahre alt geworden", text: "Lebensdauer über 105 Jahre." },
  plaus_fehler:         { sym: "⛔", titel: "Widersprüche in den Daten", text: "Aus der Plausibilitätsprüfung: Angaben, die nicht gleichzeitig stimmen können (z. B. Kind vor den Eltern geboren, Ehe nach dem Tod)." },
  plaus_warnung:        { sym: "⚠️", titel: "Ungewöhnliche Abstände", text: "Aus der Plausibilitätsprüfung: z. B. großer Altersabstand in einer Ehe. Kann stimmen – bitte prüfen." },
  ohne_sterbedatum:     { sym: "❔", titel: "Vor 1900 geboren, ohne Sterbedatum", text: "Gilt als verstorben; das Sterbedatum fehlt noch.", hinweis: true }
};
// v458: Plausibilität (Stammbaum-Prüfung) in die Datenprüfung übernehmen – nur was hier nicht schon geprüft wird
async function plausAlsFunde(d) {
  if (typeof plausBerichtAnalyse !== "function") return [];
  try { if (!treeData?.personen?.length) await loadStammbaumData(); } catch { return []; }
  const P = new Map(d.personen.map((p) => [p.id, p]));
  const doppelt = /Vater wäre|Mutter wäre|ohne Sterbedatum|liegt nach dem Tod|nach dem Tod der Mutter geboren|Monate nach dem Tod/i;   // schon eigene Regeln
  const funde = [];
  for (const b of plausBerichtAnalyse().befunde) {
    if (b.stufe === "hinweis" || doppelt.test(b.text)) continue;
    const ids = (b.personen || []).filter((id) => P.has(id));
    if (!ids.length) continue;
    const art = b.text.replace(/^[^:]*:\s*/, "").replace(/\d+/g, "#").replace(/\s+/g, " ").slice(0, 60);
    funde.push({ regel: `plaus_${b.stufe}`, schluessel: `${[...ids].sort().join(",")}|${art}`, personen: ids.map((id) => P.get(id)), details: b.text });
  }
  return funde;
}
const PRUEF_LOKAL_KEY = "fs-pruef-ausnahmen";
let pruefAusnahmen = new Map();   // "regel|schluessel" -> {notiz, geprueft_am}
let pruefAusnahmenInDb = false;
let pruefLetzte = null;

async function pruefAusnahmenLaden() {
  pruefAusnahmen = new Map();
  const { data, error } = await sb.from("pruef_ausnahmen").select("regel, schluessel, notiz, geprueft_am");
  pruefAusnahmenInDb = !error;
  if (!error) for (const a of data || []) pruefAusnahmen.set(`${a.regel}|${a.schluessel}`, a);
  else {
    try { for (const a of JSON.parse(localStorage.getItem(PRUEF_LOKAL_KEY) || "[]")) pruefAusnahmen.set(`${a.regel}|${a.schluessel}`, a); } catch {}
  }
}
async function pruefAusnahmeSetzen(regel, schluessel, notiz = null) {
  const eintrag = { regel, schluessel, notiz, geprueft_am: new Date().toISOString() };
  if (pruefAusnahmenInDb) {
    const { error } = await sb.from("pruef_ausnahmen").upsert({ regel, schluessel, notiz }, { onConflict: "regel,schluessel" });
    if (error) throw error;
  } else {
    pruefAusnahmen.set(`${regel}|${schluessel}`, eintrag);
    try { localStorage.setItem(PRUEF_LOKAL_KEY, JSON.stringify([...pruefAusnahmen.values()])); } catch {}
    return;
  }
  pruefAusnahmen.set(`${regel}|${schluessel}`, eintrag);
}
async function pruefAusnahmeAufheben(regel, schluessel) {
  if (pruefAusnahmenInDb) {
    const { error } = await sb.from("pruef_ausnahmen").delete().eq("regel", regel).eq("schluessel", schluessel);
    if (error) throw error;
  }
  pruefAusnahmen.delete(`${regel}|${schluessel}`);
  if (!pruefAusnahmenInDb) { try { localStorage.setItem(PRUEF_LOKAL_KEY, JSON.stringify([...pruefAusnahmen.values()])); } catch {} }
}

// ---------- Regeln ----------
function datenPruefen(d) {
  const P = new Map(d.personen.map((p) => [p.id, p]));
  const funde = [];
  const neu = (regel, schluessel, personen, details) => funde.push({ regel, schluessel: String(schluessel), personen: personen.filter(Boolean), details });
  const n = (x) => PersonSuche.normalisiere(x || "");
  const vollDatum = (v) => (v && String(v).length >= 10 ? String(v).slice(0, 10) : null);
  const alterBei = (geb, ereignis) => {   // in Jahren, aus vollem Datum oder Jahr
    const g = chrDatum(geb?.geburtsdatum), e = chrDatum(ereignis);
    if (g && e) return chrJahre(g, e);
    const gj = chrGebJahr(geb), ej = typeof ereignis === "number" ? ereignis : chrJahr(ereignis);
    return gj && ej ? ej - gj : null;
  };
  const aktuell = new Date().getFullYear();

  // Dubletten
  const nachnamen = (p) => new Set([n(p.nachname), n(p.Ledigenname)].filter(Boolean));
  // v453: Schreibvarianten zählen als gleich (Mathies/Mathis, Reiner/Rainer, Leo/Leopold, Theres/Theresia)
  const lev = (x, y) => { let v = Array.from({ length: y.length + 1 }, (_, i) => i); for (let i = 1; i <= x.length; i++) { const w = [i]; for (let j = 1; j <= y.length; j++) w[j] = Math.min(v[j] + 1, w[j - 1] + 1, v[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); v = w; } return v[y.length]; };
  const aehnlich = (x, y) => { if (x === y) return true; const k = Math.min(x.length, y.length);
    if (k === 1) return x[0] === y[0]; /* Abkürzung „M. Rosina“ = „Maria Rosina“ */ if (k >= 3 && (x.startsWith(y) || y.startsWith(x))) return true; const dd = Math.abs(x.length - y.length) <= 2 ? lev(x, y) : 9; return (dd <= 1 && k >= 4) || (dd <= 2 && k >= 6); };
  const passt = (a, b) => { const A = nachnamen(a), B = nachnamen(b); if (!A.size || !B.size) return true; for (const x of A) for (const y of B) if (aehnlich(x, y)) return true; return false; };
  // „Anna“ und „Anna Maria“ passen zusammen, „Maria Franziska“ und „Maria Berta“ nicht (oft Zwillinge);
  // die Reihenfolge ist egal („Ernst Emil“ = „Emil Ernst“)
  const vornamePasst = (a, b) => { const A = n(a.vorname).split(/[\s.\-]+/).filter(Boolean), B = n(b.vorname).split(/[\s.\-]+/).filter(Boolean); const [k, g] = A.length <= B.length ? [A, B] : [B, A]; return k.length > 0 && k.every((t) => g.some((u) => aehnlich(t, u))); };
  const gruppen = new Map();
  const merke = (k, p) => { if (!gruppen.has(k)) gruppen.set(k, []); if (!gruppen.get(k).includes(p)) gruppen.get(k).push(p); };
  for (const p of d.personen) {
    if (!n(p.vorname)) continue;
    const gd = vollDatum(p.geburtsdatum), td = vollDatum(p.sterbedatum);
    // nach Datum gruppieren (Vornamen werden danach verglichen) – so fallen auch andere Reihenfolgen und Schreibweisen auf
    if (td) merke(`t|${td}`, p);
    if (gd) merke(`g|${gd}`, p);
    const gj = chrGebJahr(p), tj = chrTodJahr(p);
    if (gj && tj) merke(`j|${gj}|${tj}`, p);
  }
  const partnerVon = new Map();
  for (const f of d.familien) { for (const [x, y] of [[f.partner_a_id, f.partner_b_id], [f.partner_b_id, f.partner_a_id]]) if (x && y) { if (!partnerVon.has(x)) partnerVon.set(x, new Set()); partnerVon.get(x).add(y); } }
  const wurzel = new Map(); const finde = (x) => { while (wurzel.get(x) !== x) { wurzel.set(x, wurzel.get(wurzel.get(x))); x = wurzel.get(x); } return x; };
  for (const liste of gruppen.values()) {
    if (liste.length < 2) continue;
    for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i], b = liste[j];
      if (a.id === b.id || !passt(a, b) || !vornamePasst(a, b) || partnerVon.get(a.id)?.has(b.id)) continue;
      // v453: widersprüchliche Daten = verschiedene Personen
      const gA = vollDatum(a.geburtsdatum), gB = vollDatum(b.geburtsdatum), tA = vollDatum(a.sterbedatum), tB = vollDatum(b.sterbedatum);
      // Ausnahme: ein Datum stimmt auf den Tag genau und der Vorname ist identisch (ein Datum vermutlich verlesen)
      const genauGleich = ((gA && gA === gB) || (tA && tA === tB)) && n(a.vorname) === n(b.vorname);
      if (!genauGleich) {
        if ((gA && gB && gA !== gB) || (tA && tB && tA !== tB)) continue;
        const gjA = chrGebJahr(a), gjB = chrGebJahr(b), tjA = chrTodJahr(a), tjB = chrTodJahr(b);
        if ((gjA && gjB && Math.abs(gjA - gjB) > 1) || (tjA && tjB && Math.abs(tjA - tjB) > 1)) continue;
      }
      if (a.geschlecht && b.geschlecht && a.geschlecht !== b.geschlecht) continue;
      for (const x of [a.id, b.id]) if (!wurzel.has(x)) wurzel.set(x, x);
      wurzel.set(finde(a.id), finde(b.id));
    }
  }
  const dGruppen = new Map();
  for (const id of wurzel.keys()) { const r = finde(id); if (!dGruppen.has(r)) dGruppen.set(r, []); dGruppen.get(r).push(P.get(id)); }
  for (const g of dGruppen.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    neu("dublette", g.map((p) => p.id).join(","), g, `${g.length} Einträge`);
  }

  // Eltern–Kind
  const kinderVon = new Map();
  for (const k of d.kinder) { if (!kinderVon.has(k.familie_id)) kinderVon.set(k.familie_id, []); kinderVon.get(k.familie_id).push(P.get(k.kind_id)); }
  const vaterFund = new Map(), mutterFund = new Map(), nachMutter = new Map(), nachVater = new Map();
  const sammle = (map, eltern, kind, text) => { if (!map.has(eltern.id)) map.set(eltern.id, { eltern, kinder: [] }); map.get(eltern.id).kinder.push({ kind, text }); };
  for (const f of d.familien) {
    const kinder = (kinderVon.get(f.id) || []).filter(Boolean);
    if (!kinder.length) continue;
    for (const e of [P.get(f.partner_a_id), P.get(f.partner_b_id)].filter(Boolean)) {
      const mann = chrMann(e), frau = chrFrau(e);
      for (const k of kinder) {
        const kgeb = k.geburtsdatum || chrGebJahr(k);
        if (!kgeb) continue;
        const alter = alterBei(e, k.geburtsdatum || chrGebJahr(k));
        if (alter !== null) {
          if (mann && (alter < 16 || alter > 65)) sammle(vaterFund, e, k, `${Math.floor(alter)} Jahre bei Geburt`);
          if (frau && (alter < 15 || alter > 48)) sammle(mutterFund, e, k, `${Math.floor(alter)} Jahre bei Geburt`);
        }
        const tod = chrDatum(e.sterbedatum), kd = chrDatum(k.geburtsdatum);
        const tj = chrTodJahr(e), kj = chrGebJahr(k);
        if (frau && ((tod && kd && kd > tod) || (!(tod && kd) && tj && kj && kj > tj))) sammle(nachMutter, e, k, `Mutter gestorben ${e.sterbedatum || tj}`);
        if (mann && ((tod && kd && (kd - tod) > 300 * 86400000) || (!(tod && kd) && tj && kj && kj > tj + 1))) sammle(nachVater, e, k, `Vater gestorben ${e.sterbedatum || tj}`);
      }
    }
  }
  for (const [map, regel] of [[vaterFund, "vater_alter"], [mutterFund, "mutter_alter"], [nachMutter, "kind_nach_tod_mutter"], [nachVater, "kind_nach_tod_vater"]]) {
    for (const { eltern, kinder } of map.values()) neu(regel, eltern.id, [eltern, ...kinder.map((x) => x.kind)], kinder.map((x) => `${chrName(x.kind)}: ${x.text}`).join(" · "));
  }

  // Einzelpersonen
  for (const p of d.personen) {
    const g = chrDatum(p.geburtsdatum), t = chrDatum(p.sterbedatum), gj = chrGebJahr(p), tj = chrTodJahr(p);
    if ((g && t && t < g) || (!(g && t) && gj && tj && tj < gj)) neu("tod_vor_geburt", p.id, [p], `geboren ${p.geburtsdatum || gj}, gestorben ${p.sterbedatum || tj}`);
    if (gj && tj && tj - gj > 105) neu("ueber_105", p.id, [p], `${tj - gj} Jahre`);
    if (gj && gj < 1900 && !tj && !(typeof todesumstandText === "function" && todesumstandText(p))) neu("ohne_sterbedatum", p.id, [p], `geboren ${p.geburtsdatum || gj}`);
  }
  // Heirat
  for (const f of d.familien) {
    if (!f.beginn) continue;
    for (const e of [P.get(f.partner_a_id), P.get(f.partner_b_id)].filter(Boolean)) {
      const a = alterBei(e, f.beginn);
      if (a !== null && a < 15) { neu("ehe_jung", f.id, [P.get(f.partner_a_id), P.get(f.partner_b_id)], `${chrName(e)}: ${Math.floor(a)} Jahre bei der Heirat (${f.beginn})`); break; }
    }
  }
  return funde;
}

// ---------- Anzeige ----------
async function datenpruefungZeigen(neuLaden = false) {
  const box = document.getElementById("pruef-box"), ziel = document.getElementById("pruef-ergebnis"), meldung = document.getElementById("pruef-meldung");
  if (!box || !ziel) return;
  if (!rolleIstEigentuemer()) { box.hidden = true; return; }
  box.hidden = false;
  meldung.textContent = "Prüfe …";
  try {
    const [d] = await Promise.all([chronikDatenLaden(neuLaden), pruefAusnahmenLaden()]);
    pruefLetzte = { d, funde: [...datenPruefen(d), ...(await plausAlsFunde(d))] };
  } catch (e) { meldung.textContent = `Prüfung nicht möglich: ${e.message || e}`; return; }
  pruefRendern();
}

function pruefRendern() {
  const ziel = document.getElementById("pruef-ergebnis"), meldung = document.getElementById("pruef-meldung");
  const alle = document.getElementById("pruef-alle")?.checked;
  const { funde } = pruefLetzte;
  const offen = funde.filter((f) => !pruefAusnahmen.has(`${f.regel}|${f.schluessel}`));
  const gezeigt = alle ? funde : offen;
  const echte = offen.filter((f) => !PRUEF_REGELN[f.regel].hinweis).length;
  meldung.textContent = `${echte} offene ${echte === 1 ? "Auffälligkeit" : "Auffälligkeiten"} · ${funde.length - offen.length} als geprüft markiert${pruefAusnahmenInDb ? "" : " · Markierungen nur auf diesem Gerät (Supabase Paket 12 fehlt)"}`;
  const nachRegel = Object.keys(PRUEF_REGELN).map((r) => [r, gezeigt.filter((f) => f.regel === r)]).filter(([, l]) => l.length);
  ziel.innerHTML = nachRegel.length ? nachRegel.map(([r, liste]) => {
    const R = PRUEF_REGELN[r];
    return `<details class="pruef-gruppe"${!R.hinweis && liste.length <= 15 ? " open" : ""}>
      <summary>${R.sym} ${chrEsc(R.titel)} <span class="pruef-zahl">${liste.length}</span></summary>
      <p class="pruef-erklaerung">${chrEsc(R.text)}</p>
      <ul class="pruef-liste">${liste.slice(0, 300).map((f) => {
        const markiert = pruefAusnahmen.get(`${f.regel}|${f.schluessel}`);
        return `<li class="pruef-fund${markiert ? " is-geprueft" : ""}" data-regel="${chrEsc(f.regel)}" data-schluessel="${chrEsc(f.schluessel)}">
          <div class="pruef-personen">${f.personen.slice(0, f.regel === "dublette" || f.regel.startsWith("plaus_") ? 10 : 1).map((p) => chrLink(p)).join(f.regel === "dublette" || f.regel.startsWith("plaus_") ? "<br>" : "")}</div>
          <div class="pruef-details">${chrEsc(f.details || "")}${markiert ? `<br><small>✓ geprüft ${chrEsc(new Date(markiert.geprueft_am).toLocaleDateString("de-AT"))}${markiert.notiz ? ` – ${chrEsc(markiert.notiz)}` : ""}</small>` : ""}</div>
          <div class="pruef-knoepfe">${markiert
            ? `<button type="button" class="btn btn--ghost" data-pruef="aufheben">↩ Markierung aufheben</button>`
            : `${f.regel === "dublette" ? `<button type="button" class="btn btn--primary" data-pruef="zusammen">Zusammenführen …</button>` : ""}<button type="button" class="btn btn--secondary" data-pruef="ok">${chrEsc(R.ok || "✓ Stimmt so")}</button>`}</div>
        </li>`;
      }).join("")}</ul>${liste.length > 300 ? `<p class="pruef-erklaerung">… und ${liste.length - 300} weitere</p>` : ""}
    </details>`;
  }).join("") : `<p class="pruef-erklaerung">Keine offenen Auffälligkeiten. 👍</p>`;
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest?.("[data-pruef]");
  if (!b) return;
  const li = b.closest(".pruef-fund"); if (!li) return;
  const regel = li.dataset.regel, schluessel = li.dataset.schluessel;
  const meldung = document.getElementById("pruef-meldung");
  try {
    if (b.dataset.pruef === "ok") {
      const notiz = prompt("Geprüft – kurze Notiz (freiwillig), z. B. „lt. Taufbuch richtig“:", "");
      if (notiz === null) return;
      b.disabled = true;
      await pruefAusnahmeSetzen(regel, schluessel, notiz.trim() || null);
      pruefRendern();
    } else if (b.dataset.pruef === "aufheben") {
      b.disabled = true;
      await pruefAusnahmeAufheben(regel, schluessel);
      pruefRendern();
    } else if (b.dataset.pruef === "zusammen") {
      zusammenfuehrenDialog(schluessel.split(","));
    }
  } catch (err) { meldung.textContent = `Fehler: ${err.message || err}`; b.disabled = false; }
});
document.getElementById("pruef-alle")?.addEventListener("change", () => { if (pruefLetzte) pruefRendern(); });
document.getElementById("pruef-neu")?.addEventListener("click", () => datenpruefungZeigen(true));
document.querySelector('.tab-btn[data-tab="verlauf"]')?.addEventListener("click", () => { if (rolleIstEigentuemer()) void datenpruefungZeigen(false); });   // v458: Bereich „Verwaltung“

// ---------- Zusammenführen ----------
// v455: Zusammenführen auch von Hand – aus „Person bearbeiten“ eine zweite Person suchen
function manuellZusammenfuehren(personId) {
  const ich = (personenCache || []).find((p) => p.id === personId);
  if (!ich) return;
  const f = komfortFenster(`
    <h2 class="tour-titel">👥 Zusammenführen mit …</h2>
    <p class="neuerungen-klein">Welche Person ist dieselbe wie <strong>${chrEsc(PersonSuche.label(ich))}</strong>? Name oder Datum eingeben.</p>
    <input type="search" id="zf-suche" class="search-input" placeholder="z. B. Hanni Panholzer" autocomplete="off" style="width:100%;font-size:16px;">
    <div id="zf-treffer" class="zf-treffer"></div>
    <div class="tour-knoepfe"><button type="button" class="btn btn--ghost" data-zf="abbrechen">Abbrechen</button></div>`, { klasse: "komfort-fenster--zf" });
  const eingabe = f.querySelector("#zf-suche"), liste = f.querySelector("#zf-treffer");
  const zeigen = () => {
    const q = eingabe.value.trim();
    if (q.length < 2) { liste.innerHTML = `<p class="neuerungen-klein">Mindestens zwei Zeichen eingeben.</p>`; return; }
    const treffer = personenCache.filter((p) => p.id !== personId && PersonSuche.trifft(p, q)).sort(PersonSuche.sort).slice(0, 15);
    liste.innerHTML = treffer.length
      ? treffer.map((p) => `<button type="button" class="btn btn--secondary btn--full zf-wahl" data-id="${chrEsc(p.id)}" style="justify-content:flex-start;margin:4px 0;text-align:left;">${chrEsc(PersonSuche.label(p))}</button>`).join("")
      : `<p class="neuerungen-klein">Keine Person gefunden.</p>`;
  };
  eingabe.addEventListener("input", zeigen);
  eingabe.value = [ich.vorname, ich.nachname].filter(Boolean).join(" ");
  zeigen();
  setTimeout(() => eingabe.focus(), 50);
  f.querySelector('[data-zf="abbrechen"]').addEventListener("click", () => komfortFensterZu());
  liste.addEventListener("click", async (e) => {
    const b = e.target.closest(".zf-wahl"); if (!b) return;
    liste.innerHTML = `<p class="neuerungen-klein">Daten werden geladen …</p>`;
    try {
      const d = await chronikDatenLaden(true);
      pruefLetzte = { d, funde: pruefLetzte?.funde || [] };
      komfortFensterZu();
      zusammenfuehrenDialog([personId, b.dataset.id], {
        nachher: (bleibt) => { const ov = document.getElementById("detail-overlay"); if (ov) ov.hidden = true; if (typeof openPersonDetail === "function") openPersonDetail(bleibt); }
      });
    } catch (err) { liste.innerHTML = `<p class="neuerungen-klein">Fehler: ${chrEsc(err.message || String(err))}</p>`; }
  });
}
document.getElementById("d-merge-person-btn")?.addEventListener("click", () => {
  if (!rolleIstEigentuemer()) return;
  if (typeof currentDetailPersonId !== "undefined" && currentDetailPersonId) manuellZusammenfuehren(currentDetailPersonId);
});

function zusammenfuehrenDialog(ids, { nachher = null } = {}) {
  const d = pruefLetzte?.d; if (!d) return;
  const ps = ids.map((id) => d.personen.find((p) => p.id === id)).filter(Boolean);
  if (ps.length < 2) return;
  const anzahl = (p) => ({
    ehen: d.familien.filter((f) => f.partner_a_id === p.id || f.partner_b_id === p.id).length,
    kindVon: d.kinder.filter((k) => k.kind_id === p.id).length,
    stationen: d.stationen.filter((s) => s.personen_id === p.id).length
  });
  const fuelle = (p) => Object.entries(p).filter(([k, v]) => v !== null && v !== "" && !["id", "created_at", "erstellt_am", "import_id"].includes(k)).length;
  const punkte = (p) => { const a = anzahl(p); return fuelle(p) + 2 * (a.ehen + a.kindVon + a.stationen); };
  const vorschlag = [...ps].sort((a, b) => punkte(b) - punkte(a))[0].id;
  const FELDER = [["vorname", "Vorname"], ["nachname", "Nachname"], ["Ledigenname", "Ledigenname"], ["geschlecht", "Geschlecht"], ["geburtsdatum", "Geburt"], ["geburtsjahr", "Geburtsjahr"], ["geburtsmonat", "Geburtsmonat"], ["sterbedatum", "Tod"], ["sterbejahr", "Sterbejahr"], ["sterbemonat", "Sterbemonat"], ["herkunft_quelle", "Quelle"], ["taufbuch_link", "Taufbuch"], ["sterbebuch_link", "Sterbebuch"], ["Notiz", "Notiz"]];
  const zelle = (p, k) => { const v = p[k]; if (v === null || v === undefined || v === "") return "<td class='zf-leer'>–</td>"; const s = String(v); const anders = ps.some((q) => q[k] && String(q[k]) !== s); return `<td${anders ? " class='zf-anders'" : ""}>${chrEsc(/link/.test(k) ? "✓ vorhanden" : s.length > 80 ? s.slice(0, 77) + " …" : s)}</td>`; };
  const f = komfortFenster(`
    <h2 class="tour-titel">👥 Personen zusammenführen</h2>
    <p class="neuerungen-klein">Wähle, welcher Eintrag <strong>bleibt</strong>. Alle Verknüpfungen (Ehen, Kinder, Eltern, Fotos, Wohnstationen …) wandern dorthin, leere Felder werden ergänzt, <span class="zf-anders-muster">abweichende Angaben</span> kommen in die Notiz. Der andere Eintrag landet im Papierkorb.</p>
    <div class="zf-tabelle-rahmen"><table class="zf-tabelle">
      <tr><th></th>${ps.map((p) => `<th><label><input type="radio" name="zf-bleibt" value="${chrEsc(p.id)}"${p.id === vorschlag ? " checked" : ""}> bleibt</label></th>`).join("")}</tr>
      ${FELDER.filter(([k]) => ps.some((p) => p[k])).map(([k, l]) => `<tr><th>${l}</th>${ps.map((p) => zelle(p, k)).join("")}</tr>`).join("")}
      <tr><th>Ehen</th>${ps.map((p) => `<td>${anzahl(p).ehen}</td>`).join("")}</tr>
      <tr><th>Eltern bekannt</th>${ps.map((p) => `<td>${anzahl(p).kindVon ? "ja" : "–"}</td>`).join("")}</tr>
      <tr><th>Wohnstationen</th>${ps.map((p) => `<td>${anzahl(p).stationen}</td>`).join("")}</tr>
    </table></div>
    <p class="neuerungen-klein" id="zf-meldung">${papierkorbAktiv ? "" : "⚠️ Der Papierkorb (Paket 11) ist nicht eingerichtet – der zweite Eintrag wäre endgültig weg."}</p>
    <div class="tour-knoepfe"><button type="button" class="btn btn--ghost" data-zf="abbrechen">Abbrechen</button><button type="button" class="btn btn--primary" data-zf="los">Zusammenführen</button></div>`, { klasse: "komfort-fenster--zf" });
  f.querySelector('[data-zf="abbrechen"]').addEventListener("click", () => komfortFensterZu());
  f.querySelector('[data-zf="los"]').addEventListener("click", async (e) => {
    const bleibt = f.querySelector('input[name="zf-bleibt"]:checked')?.value;
    const weg = ps.map((p) => p.id).filter((id) => id !== bleibt);
    const m = f.querySelector("#zf-meldung");
    e.currentTarget.disabled = true; m.textContent = "Führe zusammen …";
    try {
      for (const w of weg) {
        const { error } = await sb.rpc("fs_personen_zusammenfuehren", { behalten: bleibt, weg: w });
        if (error) throw error;
      }
      await zusammenfuehrenMonatErgaenzen(bleibt, ps.filter((p) => p.id !== bleibt));   // v459
      komfortFensterZu();
      await personenNachSpeichern();
      if (nachher) { nachher(bleibt); return; }
      await datenpruefungZeigen(true);
      document.getElementById("pruef-meldung").textContent = `Zusammengeführt ✓ – ${weg.length + 1} Einträge sind jetzt einer. ` + document.getElementById("pruef-meldung").textContent;
    } catch (err) {
      m.textContent = /fs_personen_zusammenfuehren|function|schema cache/i.test(err.message || "") ? "Das Zusammenführen ist in der Datenbank noch nicht eingerichtet (Supabase Paket 12)." : `Fehler: ${err.message || err}`;
      e.currentTarget.disabled = false;
    }
  });
}

// v457/v458: Sprungleiste im Bereich „Verwaltung“ – Lücken & Inseln starten beim Anspringen gleich
document.querySelector(".pruefen-nav")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pruefen-zu]"); if (!b) return;
  const ziel = document.getElementById(b.dataset.pruefenZu);
  if (b.dataset.pruefenZu === "pruefen-plaus" && document.getElementById("tree-plaus-panel")?.hidden) document.getElementById("tree-plaus-open")?.click();
  if (b.dataset.pruefenZu === "pruefen-luecken" && document.getElementById("tree-luecken-panel")?.hidden) document.getElementById("tree-luecken-open")?.click();
  ziel?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// v458: „Alles durchsuchen“ direkt aus dem Bestand (gleiche Suche wie in der Chronik)
function allesDurchsuchenFenster(start = "") {
  const f = komfortFenster(`
    <h2 class="tour-titel">🔎 Alles durchsuchen</h2>
    <input type="search" id="alles-feld" class="search-input" placeholder="z. B. gefallen, Lawine, 1910, Innerberg 21, Amerika …" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" style="width:100%;font-size:16px;">
    <p class="neuerungen-klein">Namen, Todesumstand, Notizen, Häuser, Lebensjahre und Zeitgeschehen. „gefallen“ findet auch „vermisst“; Jahre, Zeiträume („1914-1918“), „geboren 1900“, „Frauen“ grenzen ein.</p>
    <div id="alles-ergebnis" class="chr-suche-ergebnis"></div>
    <div class="tour-knoepfe"><button type="button" class="btn btn--ghost" data-alles="zu">Schließen</button></div>`, { klasse: "komfort-fenster--alles" });
  const feld = f.querySelector("#alles-feld"), ziel = f.querySelector("#alles-ergebnis");
  let timer = null, lauf = 0;
  const suchen = async () => {
    const q = feld.value, nr = ++lauf;
    if (!q.trim()) { ziel.innerHTML = ""; return; }
    try {
      const d = await chronikDatenLaden(false);
      if (nr !== lauf) return;
      allgSucheRendern(allgemeineSuche(d, q, { leser: typeof zugang !== "undefined" && zugang?.rolle === "leser" }), ziel, q);
    } catch (err) { ziel.innerHTML = `<p class="chr-suche-summe">Suche nicht möglich: ${chrEsc(err.message || err)}</p>`; }
  };
  feld.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(suchen, feld.value ? 220 : 0); });
  f.querySelector('[data-alles="zu"]').addEventListener("click", () => komfortFensterZu());
  // Person antippen: Fenster schließen, Person öffnen (das Öffnen übernimmt der allgemeine .chr-link-Klick)
  ziel.addEventListener("click", (e) => { if (e.target.closest(".chr-link")) komfortFensterZu(); });
  feld.value = start;
  if (start.trim()) suchen();
  setTimeout(() => feld.focus(), 50);
}
document.getElementById("alles-suchen-btn")?.addEventListener("click", () => allesDurchsuchenFenster(document.getElementById("search-input")?.value || ""));

// v459: Monat bei Geburt/Tod (Paket 14) beim Zusammenführen mitnehmen – nur ein leerer Monat wird ergänzt,
// und nur wenn das Jahr des bleibenden Eintrags gleich ist und kein genaues Datum vorliegt (wie „leere Felder ergänzen“).
async function zusammenfuehrenMonatErgaenzen(bleibtId, wegPersonen) {
  if (!monatSpaltenVorhanden || !wegPersonen.length) return;
  try {
    const { data: jetzt, error } = await sb.from("personen").select("id, geburtsdatum, geburtsjahr, geburtsmonat, sterbedatum, sterbejahr, sterbemonat").eq("id", bleibtId).maybeSingle();
    if (error || !jetzt) return;
    const aenderung = {};
    for (const [d, j, m] of [["geburtsdatum", "geburtsjahr", "geburtsmonat"], ["sterbedatum", "sterbejahr", "sterbemonat"]]) {
      if (jetzt[d] || jetzt[m] || !jetzt[j]) continue;
      const quelle = wegPersonen.find((p) => !p[d] && p[m] && Number(p[j]) === Number(jetzt[j]));
      if (quelle) aenderung[m] = quelle[m];
    }
    if (Object.keys(aenderung).length) {
      const { error: ue } = await sb.from("personen").update(aenderung).eq("id", bleibtId);
      if (ue) debugLog(`⚠️ Monat beim Zusammenführen: ${ue.message}`);
    }
  } catch (err) { debugLog(`⚠️ Monat beim Zusammenführen: ${err.message || err}`); }
}
