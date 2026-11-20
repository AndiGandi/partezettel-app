// Familienspuren – Fehlende Daten schätzen (nur Eigentümer, Reiter „Verlauf“), ab Version 443
// Rechnet aus den vorhandenen Einträgen, in welchem Zeitraum eine Heirat, Geburt oder ein Tod
// ungefähr liegen muss, damit man in den Kirchenbüchern gezielt suchen kann.
// Es wird nichts gespeichert und nichts an den Daten geändert – reine Rechenhilfe.

const SCHAETZ_STANDARD = { erstesKind: 2, erstesKindSpanne: 4, heiratsalterM: 28, heiratsalterW: 25, alterErstesKindM: 30, alterErstesKindW: 27 };
let schaetzLetzte = null;

// Dezimaljahr aus Datum („1861-11-19“ → 1861,88) oder nur Jahr (→ Jahresmitte, ungenau)
function szJahr(datum, jahr) {
  const d = chrDatum(datum);
  if (d) return { j: d.getFullYear() + (d.getMonth() * 30.44 + d.getDate()) / 365.25, genau: true };
  const y = jahr ? Number(jahr) : (datum && /^\d{4}$/.test(String(datum)) ? Number(datum) : null);
  return y ? { j: y + 0.5, genau: false } : null;
}
const szGeb = (p) => szJahr(p?.geburtsdatum, p?.geburtsjahr);
const szTod = (p) => szJahr(p?.sterbedatum, p?.sterbejahr);
const szBeginn = (f) => szJahr(f?.beginn, f?.beginn_jahr);
const szMedian = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const szQuantil = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const szJ = (x) => Math.floor(x);
const szBereich = (a, b) => szJ(a) === szJ(b) ? String(szJ(a)) : `${szJ(a)}–${szJ(b)}`;
const szDatumText = (v) => { const d = chrDatum(v); return d ? d.toLocaleDateString("de-AT") : String(v || ""); };
const szPlatzhalter = (p) => /^anonym(us|a)$/i.test(String(p?.vorname || "").trim());

function datenSchaetzen(d) {
  const P = new Map(d.personen.map((p) => [p.id, p]));
  const istEhe = (f) => f.partner_a_id && f.partner_b_id && !/eltern/i.test(String(f.familientyp || ""));
  const ehen = d.familien.filter(istEhe);
  const kinderVon = new Map(), elternFamVon = new Map();
  for (const k of d.kinder) {
    const p = P.get(k.kind_id); if (!p) continue;
    if (!kinderVon.has(k.familie_id)) kinderVon.set(k.familie_id, []);
    kinderVon.get(k.familie_id).push(p);
    if (!elternFamVon.has(k.kind_id)) elternFamVon.set(k.kind_id, []);
    elternFamVon.get(k.kind_id).push(k.familie_id);
  }
  const F = new Map(d.familien.map((f) => [f.id, f]));
  const ehenVon = new Map();
  for (const f of ehen) for (const id of [f.partner_a_id, f.partner_b_id]) { if (!ehenVon.has(id)) ehenVon.set(id, []); ehenVon.get(id).push(f); }
  const geburten = (f) => (kinderVon.get(f.id) || []).map((k) => ({ k, g: szGeb(k) })).filter((x) => x.g).sort((a, b) => a.g.j - b.g.j);
  const partner = (f, id) => P.get(f.partner_a_id === id ? f.partner_b_id : f.partner_a_id);

  // ---------- 1. Aus dem eigenen Bestand lernen ----------
  const erstesKind = [], heiratM = [], heiratW = [], erstesKindAlterM = [], erstesKindAlterW = [], geschwAbstand = [];
  for (const f of ehen) {
    const b = szBeginn(f); const g = geburten(f);
    if (b?.genau && g.length && g[0].g.genau) { const x = g[0].g.j - b.j; if (x > -0.5 && x < 12) erstesKind.push(Math.max(0, x)); }
    if (b) for (const id of [f.partner_a_id, f.partner_b_id]) {
      const p = P.get(id), gp = szGeb(p); if (!gp) continue; const a = b.j - gp.j;
      if (a >= 14 && a <= 75) (chrFrau(p) ? heiratW : chrMann(p) ? heiratM : []).push(a);
    }
    for (let i = 1; i < g.length; i++) { const x = g[i].g.j - g[i - 1].g.j; if (x > 0.7 && x < 8) geschwAbstand.push(x); }
  }
  for (const [id, liste] of ehenVon) {
    const p = P.get(id), gp = szGeb(p); if (!gp) continue;
    const alle = liste.flatMap(geburten); if (!alle.length) continue;
    const a = Math.min(...alle.map((x) => x.g.j)) - gp.j;
    if (a >= 14 && a <= 60) (chrFrau(p) ? erstesKindAlterW : chrMann(p) ? erstesKindAlterM : []).push(a);
  }
  const genug = (a, n = 8) => a.length >= n;
  const S = {
    erstesKind: genug(erstesKind) ? szMedian(erstesKind) : SCHAETZ_STANDARD.erstesKind,
    erstesKind90: genug(erstesKind) ? Math.max(1.5, szQuantil(erstesKind, 0.9)) : SCHAETZ_STANDARD.erstesKindSpanne,
    heiratM: genug(heiratM) ? szMedian(heiratM) : SCHAETZ_STANDARD.heiratsalterM,
    heiratW: genug(heiratW) ? szMedian(heiratW) : SCHAETZ_STANDARD.heiratsalterW,
    heiratM10: genug(heiratM) ? szQuantil(heiratM, 0.1) : 22, heiratM90: genug(heiratM) ? szQuantil(heiratM, 0.9) : 38,
    heiratW10: genug(heiratW) ? szQuantil(heiratW, 0.1) : 20, heiratW90: genug(heiratW) ? szQuantil(heiratW, 0.9) : 33,
    alterKindM: genug(erstesKindAlterM) ? szMedian(erstesKindAlterM) : SCHAETZ_STANDARD.alterErstesKindM,
    alterKindW: genug(erstesKindAlterW) ? szMedian(erstesKindAlterW) : SCHAETZ_STANDARD.alterErstesKindW,
    alterKindM10: genug(erstesKindAlterM) ? szQuantil(erstesKindAlterM, 0.1) : 23, alterKindM90: genug(erstesKindAlterM) ? szQuantil(erstesKindAlterM, 0.9) : 40,
    alterKindW10: genug(erstesKindAlterW) ? szQuantil(erstesKindAlterW, 0.1) : 20, alterKindW90: genug(erstesKindAlterW) ? szQuantil(erstesKindAlterW, 0.9) : 35,
    geschwAbstand: genug(geschwAbstand) ? szMedian(geschwAbstand) : 2,
    n: { erstesKind: erstesKind.length, heiratM: heiratM.length, heiratW: heiratW.length, kindM: erstesKindAlterM.length, kindW: erstesKindAlterW.length, geschw: geschwAbstand.length }
  };

  // ---------- 2. Heirat ohne Datum, aber mit Kindern ----------
  const heirat = [];
  for (const f of ehen) {
    if (szBeginn(f)) continue;
    const g = geburten(f); if (!g.length) continue;
    const a = P.get(f.partner_a_id), b = P.get(f.partner_b_id);
    const erstes = g[0];
    const grund = [`erstes bekanntes Kind ${chrName(erstes.k)} geboren ${erstes.g.genau ? szDatumText(erstes.k.geburtsdatum) : szJ(erstes.g.j)}`];
    let frueh = erstes.g.j - S.erstesKind90 - (erstes.g.genau ? 0 : 0.5);
    let spaet = erstes.g.j + (erstes.g.genau ? 0.05 : 0.5);
    let schaetz = erstes.g.j - S.erstesKind;
    const hinweise = [];
    for (const p of [a, b]) {
      const gp = szGeb(p);
      if (gp) {
        const min = gp.j + (chrFrau(p) ? 16 : 18);
        if (min > frueh) { frueh = min; grund.push(`${p.vorname || "?"} erst ${szJ(min)} alt genug`); }
        // Mutter beim ersten bekannten Kind schon älter → wahrscheinlich fehlen ältere Kinder
        if (chrFrau(p) && erstes.g.j - gp.j > S.alterKindW + 6) hinweise.push(`${p.vorname || "Mutter"} war beim ersten bekannten Kind schon ${szJ(erstes.g.j - gp.j)} – vielleicht fehlen ältere Kinder, Heirat dann früher`);
      }
      // frühere Ehe dieses Partners: neue Heirat erst nach dem Tod des früheren Ehepartners
      for (const alt of (ehenVon.get(p?.id) || [])) {
        if (alt.id === f.id) continue;
        const ga = geburten(alt), ba = szBeginn(alt);
        const altVorher = (ba && ba.j < erstes.g.j) || (ga.length && ga[ga.length - 1].g.j < erstes.g.j);
        if (!altVorher) continue;
        const ex = partner(alt, p.id), tex = szTod(ex);
        if (tex && tex.j < spaet) {
          if (tex.j > frueh) { frueh = tex.j; grund.push(`nach dem Tod von ${chrName(ex)} (${tex.genau ? szDatumText(ex.sterbedatum) : szJ(tex.j)})`); }
        } else if (ga.length) {
          const letzt = ga[ga.length - 1].g.j;
          if (letzt > frueh) { frueh = letzt; grund.push(`nach dem letzten Kind der früheren Ehe mit ${chrName(ex)} (${szJ(letzt)})`); }
        }
      }
    }
    // Unehelich vor der Ehe geborene Kinder verschieben das Bild – nur Hinweis
    if (g.length >= 2 && g[1].g.j - g[0].g.j > 4) hinweise.push(`großer Abstand zum nächsten Kind (${szJ(g[1].g.j)}) – erstes Kind evtl. vorehelich`);
    const widerspruch = frueh > spaet;
    if (!widerspruch) schaetz = Math.min(Math.max(schaetz, frueh), spaet);
    heirat.push({ art: "heirat", f, personen: [a, b], schaetz, frueh, spaet, grund, hinweise, widerspruch, sortJ: schaetz,
      suchtext: widerspruch ? "Angaben widersprechen sich" : `≈ ${szJ(schaetz)} · im Trauungsbuch suchen <strong>${szBereich(frueh, spaet)}</strong>` });
  }

  // ---------- 3. Geburt ohne Datum und ohne Jahr ----------
  // „sicher“ = harte Grenzen (biologisch möglich), „wahrscheinlich“ = typischer Bereich aus dem Bestand
  const geburt = [];
  for (const p of d.personen) {
    if (szGeb(p) || szPlatzhalter(p)) continue;
    const hart = [], wahr = [], schaetzungen = [], grund = [];
    const frau = chrFrau(p);
    const meineEhen = (ehenVon.get(p.id) || []).map((f) => ({ f, b: szBeginn(f), g: geburten(f) }));
    const datierte = meineEhen.filter((x) => x.b).sort((x, y) => x.b.j - y.b.j);
    for (const { f, b } of datierte) { hart.push([b.j - 70, b.j - (frau ? 15 : 17)]); grund.push(`Heirat ${b.genau ? szDatumText(f.beginn) : szJ(b.j)}`); }
    if (datierte.length) {   // nur die erste Heirat sagt etwas über das typische Alter (Witwer heiraten oft spät)
      const b = datierte[0].b;
      schaetzungen.push(b.j - (frau ? S.heiratW : S.heiratM));
      wahr.push([b.j - (frau ? S.heiratW90 : S.heiratM90), b.j - (frau ? S.heiratW10 : S.heiratM10)]);
    }
    const alleKinder = meineEhen.flatMap((x) => x.g).sort((x, y) => x.g.j - y.g.j);
    if (alleKinder.length) {
      const erst = alleKinder[0].g.j, letzt = alleKinder[alleKinder.length - 1].g.j;
      schaetzungen.push(erst - (frau ? S.alterKindW : S.alterKindM));
      hart.push([letzt - (frau ? 50 : 80), erst - (frau ? 14 : 16)]);
      wahr.push([erst - (frau ? S.alterKindW90 : S.alterKindM90), erst - (frau ? S.alterKindW10 : S.alterKindM10)]);
      grund.push(`${alleKinder.length} ${alleKinder.length === 1 ? "Kind" : "Kinder"} ${szBereich(erst, letzt)}`);
    }
    for (const fid of (elternFamVon.get(p.id) || [])) {
      const fam = F.get(fid); if (!fam) continue;
      const geschw = (kinderVon.get(fid) || []).filter((k) => k.id !== p.id).map(szGeb).filter(Boolean).map((x) => x.j).sort((x, y) => x - y);
      const eltern = [P.get(fam.partner_a_id), P.get(fam.partner_b_id)].filter(Boolean);
      const mutter = eltern.find(chrFrau), vater = eltern.find(chrMann);
      const gm = szGeb(mutter), tm = szTod(mutter), tv = szTod(vater), b = szBeginn(fam);
      if (gm) { hart.push([gm.j + 14, gm.j + 50]); grund.push(`Mutter geb. ${szJ(gm.j)}`); }
      if (tm) { hart.push([-Infinity, tm.j + 0.05]); grund.push(`Mutter † ${szJ(tm.j)}`); }
      if (tv) hart.push([-Infinity, tv.j + 0.8]);
      if (b) { hart.push([b.j - 3, Infinity]); grund.push(`Eltern heirateten ${szJ(b.j)}`); }
      if (geschw.length) {
        schaetzungen.push(szMedian(geschw));
        wahr.push([geschw[0] - 3 * S.geschwAbstand, geschw[geschw.length - 1] + 3 * S.geschwAbstand]);
        grund.push(`${geschw.length} Geschwister ${szBereich(geschw[0], geschw[geschw.length - 1])}`);
      }
    }
    const tp = szTod(p);
    if (tp) hart.push([tp.j - 105, tp.j]);
    if (!hart.length && !wahr.length) continue;
    const schnitt = (l) => [Math.max(-Infinity, ...l.map((x) => x[0])), Math.min(Infinity, ...l.map((x) => x[1]))];
    const [hv, hb] = schnitt(hart);
    if (!isFinite(hv) || !isFinite(hb)) continue;
    const widerspruch = hv > hb;
    let [wv, wb] = schnitt([...wahr, [hv, hb]]);
    if (wahr.length && wv > wb) {   // typische Bereiche passen nicht zusammen → Hülle davon, innerhalb der harten Grenzen
      wv = Math.max(hv, Math.min(...wahr.map((x) => x[0]))); wb = Math.min(hb, Math.max(...wahr.map((x) => x[1])));
    }
    if (!wahr.length || wv > wb) { wv = hv; wb = hb; }
    if (wb - wv < 4) { const m = (wv + wb) / 2; wv = Math.max(hv, m - 2); wb = Math.min(hb, m + 2); }   // mindestens ±2 Jahre
    if (!widerspruch && hb - hv > 40 && wb - wv > 15) continue;   // zu ungenau, hilft beim Suchen nicht
    let schaetz = schaetzungen.length ? schaetzungen.reduce((x, y) => x + y, 0) / schaetzungen.length : (wv + wb) / 2;
    if (!widerspruch) schaetz = Math.min(Math.max(schaetz, wv), wb);
    const sicher = szBereich(hv, hb) !== szBereich(wv, wb) ? ` <small>(möglich ${szBereich(hv, hb)})</small>` : "";
    geburt.push({ art: "geburt", personen: [p], schaetz, frueh: wv, spaet: wb, grund, hinweise: [], widerspruch, sortJ: schaetz,
      suchtext: widerspruch ? "Angaben widersprechen sich" : `≈ ${szJ(schaetz)} · im Taufbuch zuerst suchen <strong>${szBereich(wv, wb)}</strong>${sicher}` });
  }

  // ---------- 4. Tod ohne Datum – nur wenn er sich eingrenzen lässt ----------
  const tod = [];
  for (const p of d.personen) {
    if (szTod(p) || szPlatzhalter(p)) continue;
    const gp = szGeb(p);
    if (gp && gp.j >= (typeof LEBEND_AB_JAHR !== "undefined" ? LEBEND_AB_JAHR : 1920)) continue;
    let frueh = -Infinity, spaet = Infinity; const grund = [];
    const unten = (j, text) => { if (j > frueh) { frueh = j; grund.push(text); } };
    const oben = (j, text) => { if (j < spaet) { spaet = j; grund.push(text); } };
    const meine = (ehenVon.get(p.id) || []).map((f) => ({ f, b: szBeginn(f), g: geburten(f) }));
    for (const { f, b, g } of meine) {
      if (b) unten(b.j, `Heirat ${szJ(b.j)}`);
      if (g.length) {
        const letzt = g[g.length - 1];
        unten(chrMann(p) ? letzt.g.j - 0.75 : letzt.g.j, `letztes Kind ${chrName(letzt.k)} ${szJ(letzt.g.j)}`);
      }
      // Ehepartner heiratet später wieder → diese Person war da schon tot
      const ex = partner(f, p.id);
      const meinErstes = g.length ? g[0].g.j : (b ? b.j : null);
      for (const neu of (ehenVon.get(ex?.id) || [])) {
        if (neu.id === f.id) continue;
        const bn = szBeginn(neu), gn = geburten(neu);
        const nachher = meinErstes !== null && ((bn && bn.j > meinErstes) || (gn.length && gn[0].g.j > (g.length ? g[g.length - 1].g.j : meinErstes)));
        if (!nachher) continue;
        if (bn) oben(bn.j, `${ex.vorname || "Ehepartner"} heiratete wieder ${bn.genau ? szDatumText(neu.beginn) : szJ(bn.j)}`);
        else if (gn.length) oben(gn[0].g.j - 0.75, `${ex.vorname || "Ehepartner"} hat ab ${szJ(gn[0].g.j)} Kinder in neuer Ehe`);
      }
    }
    if (gp) { unten(gp.j, `geboren ${szJ(gp.j)}`); oben(gp.j + 100, "spätestens mit 100"); }
    if (!isFinite(frueh) || !isFinite(spaet) || spaet - frueh > 30) continue;
    const widerspruch = frueh > spaet + 0.1;
    tod.push({ art: "tod", personen: [p], schaetz: null, frueh, spaet, grund, hinweise: [], widerspruch, sortJ: frueh,
      suchtext: widerspruch ? "Angaben widersprechen sich" : `im Sterbebuch suchen <strong>${szBereich(frueh, spaet)}</strong>` });
  }

  for (const l of [heirat, geburt, tod]) l.sort((x, y) => (x.widerspruch - y.widerspruch) || ((x.spaet - x.frueh) - (y.spaet - y.frueh)) || (x.sortJ - y.sortJ));
  return { S, heirat, geburt, tod };
}

// ---------- Anzeige ----------
const SCHAETZ_GRUPPEN = {
  heirat: { sym: "💍", titel: "Ehen mit Kindern, aber ohne Heiratsdatum", text: "Geschätzt aus dem ersten bekannten Kind. Untergrenzen: Alter der Partner, Tod eines früheren Ehepartners." },
  geburt: { sym: "👶", titel: "Personen ohne Geburtsdatum", text: "Geschätzt aus der ersten Heirat, eigenen Kindern, Geschwistern und den Eltern. „Zuerst suchen“ ist der typische Bereich, in Klammern der überhaupt mögliche." },
  tod:    { sym: "🕯️", titel: "Tod eingrenzbar", text: "Frühestens nach dem letzten eigenen Ereignis (Kind, Heirat), spätestens vor der Wiederheirat des Ehepartners. Nur wenn der Zeitraum höchstens 30 Jahre umfasst." }
};

async function schaetzungZeigen(neuLaden = false) {
  const box = document.getElementById("schaetz-box"), meldung = document.getElementById("schaetz-meldung");
  if (!box) return;
  if (!rolleIstEigentuemer()) { box.hidden = true; return; }
  box.hidden = false;
  meldung.textContent = "Rechne …";
  try { schaetzLetzte = datenSchaetzen(await chronikDatenLaden(neuLaden)); }
  catch (e) { meldung.textContent = `Berechnung nicht möglich: ${e.message || e}`; return; }
  schaetzRendern();
}

function schaetzRendern() {
  const ziel = document.getElementById("schaetz-ergebnis"), meldung = document.getElementById("schaetz-meldung"), lern = document.getElementById("schaetz-grundlage");
  if (!schaetzLetzte || !ziel) return;
  const { S } = schaetzLetzte;
  const q = PersonSuche.normalisiere(document.getElementById("schaetz-filter")?.value || "");
  const z = (x) => x.toLocaleString("de-AT", { maximumFractionDigits: 1 });
  const quelle = (n, min = 8) => n >= min ? `aus ${n} Fällen` : "Standardwert, zu wenig Fälle";
  lern.innerHTML = `<strong>Gelernt aus deinem Bestand:</strong> erstes Kind im Mittel ${z(S.erstesKind)} Jahre nach der Heirat, 90 % innerhalb von ${z(S.erstesKind90)} Jahren (${quelle(S.n.erstesKind)}) ·
    Heiratsalter Männer ${z(S.heiratM)} (${quelle(S.n.heiratM)}), Frauen ${z(S.heiratW)} (${quelle(S.n.heiratW)}) ·
    Alter beim ersten Kind: Väter ${z(S.alterKindM)}, Mütter ${z(S.alterKindW)} · Abstand zwischen Geschwistern ${z(S.geschwAbstand)} Jahre.`;
  const passt = (x) => !q || x.personen.some((p) => PersonSuche.normalisiere(chrName(p)).includes(q));
  let summe = 0;
  ziel.innerHTML = Object.entries(SCHAETZ_GRUPPEN).map(([k, G]) => {
    const liste = schaetzLetzte[k].filter(passt); summe += liste.length;
    return `<details class="pruef-gruppe"${k === "heirat" ? " open" : ""}>
      <summary>${G.sym} ${chrEsc(G.titel)} <span class="pruef-zahl">${liste.length}</span></summary>
      <p class="pruef-erklaerung">${chrEsc(G.text)} Engste Zeiträume zuerst.</p>
      <ul class="pruef-liste">${liste.slice(0, 400).map((x) => `<li class="pruef-fund schaetz-fund${x.widerspruch ? " is-widerspruch" : ""}">
        <div class="pruef-personen">${x.personen.map((p) => chrLink(p)).join(k === "heirat" ? "<br>⚭ " : "")}</div>
        <div class="pruef-details"><span class="schaetz-zeitraum">${x.suchtext}</span><br><small>${chrEsc(x.grund.join(" · "))}</small>${x.hinweise.length ? `<br><small class="schaetz-hinweis">⚠️ ${chrEsc(x.hinweise.join(" · "))}</small>` : ""}</div>
      </li>`).join("")}</ul>${liste.length > 400 ? `<p class="pruef-erklaerung">… und ${liste.length - 400} weitere – Namensfilter verwenden</p>` : ""}
    </details>`;
  }).join("");
  meldung.textContent = `${summe} Einträge${q ? " passend zum Filter" : ""} · reine Rechenhilfe, es wird nichts geändert`;
}

document.getElementById("schaetz-neu")?.addEventListener("click", () => schaetzungZeigen(true));
document.getElementById("schaetz-filter")?.addEventListener("input", () => schaetzRendern());
document.querySelector('.tab-btn[data-tab="verlauf"]')?.addEventListener("click", () => { if (rolleIstEigentuemer()) void schaetzungZeigen(false); });
