// Familienspuren – Chronik & Statistik (v381)
// Rechnet alle Auswertungen direkt aus der Datenbank (keine KI). Wird nach app.js geladen
// und nutzt dessen globale Hilfen (sb, alleZeilenLaden, openPersonDetail, debugLog, todesumstandText).

/* ---------- Zeitgeschehen: Jahresliste (Montafon, Vorarlberg, Österreich, Welt) ---------- */
const ZEITGESCHEHEN = [
  [1618, "Beginn des Dreißigjährigen Krieges"],
  [1647, "Schwedische Truppen erobern Bregenz"],
  [1648, "Westfälischer Friede beendet den Dreißigjährigen Krieg"],
  [1683, "Zweite Türkenbelagerung Wiens"],
  [1703, "Spanischer Erbfolgekrieg: bayerische Truppen fallen in Tirol ein („Bayerischer Rummel“)"],
  [1740, "Maria Theresia übernimmt die Herrschaft in den habsburgischen Ländern"],
  [1756, "Beginn des Siebenjährigen Krieges"],
  [1770, "Erste Hausnummern: Konskription und Nummerierung der Häuser in den habsburgischen Ländern"],
  [1774, "Allgemeine Schulpflicht durch die Theresianische Schulordnung"],
  [1780, "Tod Maria Theresias – Joseph II. regiert allein"],
  [1781, "Toleranzpatent Josephs II."],
  [1784, "Josephinische Matrikenordnung: Kirchenbücher werden nach staatlichen Vorgaben geführt"],
  [1789, "Französische Revolution"],
  [1799, "Koalitionskrieg: Schlacht bei Feldkirch, die Franzosen werden zurückgeschlagen"],
  [1800, "Französische Truppen besetzen Vorarlberg"],
  [1805, "Friede von Pressburg: Vorarlberg kommt an Bayern"],
  [1806, "Ende des Heiligen Römischen Reiches"],
  [1809, "Aufstand in Tirol und Vorarlberg gegen Bayern und Napoleon (Andreas Hofer, Anton Schneider)"],
  [1810, "Andreas Hofer wird in Mantua hingerichtet"],
  [1813, "Völkerschlacht bei Leipzig"],
  [1814, "Vorarlberg kommt wieder zu Österreich"],
  [1815, "Wiener Kongress und Napoleons Niederlage bei Waterloo"],
  [1816, "„Jahr ohne Sommer“ nach dem Ausbruch des Tambora: Missernten und Hunger"],
  [1817, "Hungersnot nach der Missernte des Vorjahres"],
  [1846, "Missernten und Teuerung in ganz Europa (Hungerjahre 1846/47)"],
  [1848, "Revolution in Österreich – Aufhebung der Grundherrschaft"],
  [1859, "Krieg in Italien (Schlacht bei Solferino)"],
  [1861, "Erster Vorarlberger Landtag"],
  [1866, "Krieg gegen Preußen (Königgrätz)"],
  [1867, "Ausgleich: Österreich-Ungarn entsteht"],
  [1869, "Reichsvolksschulgesetz: achtjährige Schulpflicht"],
  [1872, "Eröffnung der Vorarlbergbahn bis Bludenz"],
  [1884, "Eröffnung der Arlbergbahn"],
  [1905, "Eröffnung der Montafonerbahn Bludenz–Schruns"],
  [1914, "Beginn des Ersten Weltkriegs"],
  [1915, "Italien tritt in den Krieg ein – Front in Südtirol und Tirol"],
  [1916, "Tod Kaiser Franz Josephs"],
  [1918, "Ende des Ersten Weltkriegs, Spanische Grippe, Gründung der Republik"],
  [1919, "Volksabstimmung in Vorarlberg über einen Anschluss an die Schweiz"],
  [1924, "Gründung der Vorarlberger Illwerke"],
  [1925, "Der Schilling ersetzt die Krone"],
  [1929, "Weltwirtschaftskrise"],
  [1934, "Bürgerkrieg im Februar, Ständestaat, Ermordung von Kanzler Dollfuß"],
  [1938, "„Anschluss“ Österreichs an das Deutsche Reich"],
  [1939, "Beginn des Zweiten Weltkriegs"],
  [1945, "Ende des Zweiten Weltkriegs – französische Besatzung in Vorarlberg"],
  [1954, "Lawinenwinter: Katastrophe von Blons; Eröffnung der Silvretta-Hochalpenstraße"],
  [1955, "Staatsvertrag: Ende der Besatzungszeit"],
  [1969, "Erste Mondlandung"],
  [1989, "Fall der Berliner Mauer"],
  [1995, "Österreich tritt der Europäischen Union bei"],
  [2002, "Einführung des Euro"]
];

/* ---------- Hilfen ---------- */
const chrDatum = (v) => { if (!v) return null; const d = new Date(`${String(v).slice(0, 10)}T00:00:00`); return isNaN(d) ? null : d; };
const chrJahr = (v) => { const d = chrDatum(v); return d ? d.getFullYear() : (v && /^\d{4}$/.test(String(v)) ? Number(v) : null); };
const chrGebJahr = (p) => chrJahr(p?.geburtsdatum) || (p?.geburtsjahr ? Number(p.geburtsjahr) : null);
const chrTodJahr = (p) => chrJahr(p?.sterbedatum) || (p?.sterbejahr ? Number(p.sterbejahr) : null);
const chrJahre = (a, b) => (b - a) / (365.2425 * 24 * 3600 * 1000);
const chrEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chrFrau = (p) => String(p?.geschlecht || "").toLowerCase().startsWith("w");
const chrMann = (p) => String(p?.geschlecht || "").toLowerCase().startsWith("m");
function chrName(p) {
  if (!p) return "?";
  const n = [p.vorname, p.nachname].filter(Boolean).join(" ");
  return p.Ledigenname && p.Ledigenname !== p.nachname ? `${n} geb. ${p.Ledigenname}` : n;
}
function chrLeben(p) {
  const g = chrGebJahr(p), t = chrTodJahr(p);
  return g || t ? `${g || "?"}–${t || ""}` : "";
}
const chrLink = (p) => p ? `<button type="button" class="chr-link" data-pid="${chrEsc(p.id)}">${chrEsc(chrName(p))}</button>${chrLeben(p) ? ` <small>(${chrEsc(chrLeben(p))})</small>` : ""}` : "?";
const chrZahl = (n) => Number(n).toLocaleString("de-AT");
const chrRund = (x, s = 1) => Number(x).toLocaleString("de-AT", { maximumFractionDigits: s, minimumFractionDigits: s });

/* ---------- Daten laden ---------- */
let chronikCache = null;
async function chronikDatenLaden(neu = false) {
  if (chronikCache && !neu) return chronikCache;
  const [p, f, k, s, h] = await Promise.all([
    alleZeilenLaden(() => sb.from("personen").select("*").order("id")),
    alleZeilenLaden(() => sb.from("familien").select("*").order("id")),
    alleZeilenLaden(() => sb.from("familien_kinder").select("id, familie_id, kind_id").order("id")),
    alleZeilenLaden(() => sb.from("person_stationen").select("id, personen_id, haus_id, art, jahr, sortierung").order("id")),
    alleZeilenLaden(() => sb.from("haeuser").select("*").order("id"))
  ]);
  for (const r of [p, f, k]) if (r.error) throw r.error;
  chronikCache = { personen: p.data || [], familien: f.data || [], kinder: k.data || [], stationen: s.error ? [] : (s.data || []), haeuser: h.error ? [] : (h.data || []), geladen: new Date() };
  return chronikCache;
}

/* ---------- Auswertung ---------- */
function chronikAuswerten(d) {
  const P = new Map(d.personen.map((p) => [p.id, p]));
  const F = new Map(d.familien.map((f) => [f.id, f]));
  const kinderVon = new Map(); // familie -> [kind]
  const elternFam = new Map(); // kind -> [familie]
  for (const k of d.kinder) {
    if (!P.has(k.kind_id)) continue;
    (kinderVon.get(k.familie_id) || kinderVon.set(k.familie_id, []).get(k.familie_id)).push(k.kind_id);
    (elternFam.get(k.kind_id) || elternFam.set(k.kind_id, []).get(k.kind_id)).push(k.familie_id);
  }
  const istEhe = (f) => f.partner_a_id && f.partner_b_id && String(f.familientyp || "").toLowerCase() !== "eltern";
  const ehen = d.familien.filter(istEhe);
  const r = {};

  // 1 · Zahlen
  const jahre = d.personen.map(chrGebJahr).filter(Boolean);
  r.zahlen = {
    personen: d.personen.length,
    frauen: d.personen.filter(chrFrau).length,
    maenner: d.personen.filter(chrMann).length,
    ehen: ehen.length,
    verbindungen: d.kinder.length,
    haeuser: new Set(d.stationen.map((s) => s.haus_id)).size,
    vonJahr: jahre.length ? Math.min(...jahre) : null,
    bisJahr: jahre.length ? Math.max(...jahre) : null,
    hausblatt: d.personen.filter((p) => p.herkunft_quelle).length,
    geprueft: d.personen.filter((p) => p.herkunft_quelle && p.geprueft_am).length,
    eigen: d.personen.filter((p) => !p.herkunft_quelle).length,
    nurName: d.personen.filter((p) => !(p.geburtsdatum || p.geburtsjahr || p.sterbedatum || p.sterbejahr)).length
  };
  // Generationen: längste Kette Eltern -> Kind
  const kinderDerPerson = new Map();
  for (const [fid, ks] of kinderVon) {
    const f = F.get(fid); if (!f) continue;
    for (const pid of [f.partner_a_id, f.partner_b_id]) if (pid && P.has(pid)) {
      const set = kinderDerPerson.get(pid) || kinderDerPerson.set(pid, new Set()).get(pid);
      ks.forEach((k) => set.add(k));
    }
  }
  const tiefe = new Map();
  const tiefeVon = (id, besucht = new Set()) => {
    if (tiefe.has(id)) return tiefe.get(id);
    if (besucht.has(id)) return 1;
    besucht.add(id);
    let m = 1;
    for (const k of kinderDerPerson.get(id) || []) m = Math.max(m, 1 + tiefeVon(k, besucht));
    tiefe.set(id, m); return m;
  };
  let gen = 0, genStart = null;
  for (const p of d.personen) { const t = tiefeVon(p.id); if (t > gen) { gen = t; genStart = p; } }
  r.zahlen.generationen = gen; r.zahlen.generationenStart = genStart;

  // 2 · Rekorde
  const pruef = (txt, verdacht) => ({ txt, verdacht });
  const lebende = [];
  for (const p of d.personen) {
    const g = chrDatum(p.geburtsdatum), t = chrDatum(p.sterbedatum);
    if (g && t && t > g) lebende.push({ p, alter: chrJahre(g, t) });
  }
  lebende.sort((a, b) => b.alter - a.alter);
  r.aelteste = lebende.slice(0, 5);
  const eheDauer = [];
  const altersdiff = [];
  const heirat = [];
  for (const f of ehen) {
    const a = P.get(f.partner_a_id), b = P.get(f.partner_b_id); if (!a || !b) continue;
    const beginn = chrDatum(f.beginn);
    if (beginn) {
      const enden = [chrDatum(f.ende), chrDatum(a.sterbedatum), chrDatum(b.sterbedatum)].filter((x) => x && x > beginn);
      const jungBeiHeirat = [a, b].some((x) => { const g = chrDatum(x.geburtsdatum); return g && chrJahre(g, beginn) < 16; });
      if (enden.length && (a.sterbedatum || f.ende) && (b.sterbedatum || f.ende)) eheDauer.push({ a, b, jahre: chrJahre(beginn, new Date(Math.min(...enden))), beginn, verdacht: jungBeiHeirat });
      for (const x of [a, b]) { const g = chrDatum(x.geburtsdatum); if (g) heirat.push({ p: x, alter: chrJahre(g, beginn), jahr: beginn.getFullYear() }); }
    }
    const ga = chrGebJahr(a), gb = chrGebJahr(b);
    if (ga && gb) {
      const mann = chrMann(a) ? a : chrMann(b) ? b : null, frau = mann === a ? b : a;
      if (mann) altersdiff.push({ mann, frau, diff: chrGebJahr(frau) - chrGebJahr(mann) });
    }
  }
  eheDauer.sort((x, y) => y.jahre - x.jahre); r.ehen = eheDauer.slice(0, 5);
  altersdiff.sort((x, y) => y.diff - x.diff);
  r.mannAelter = altersdiff.slice(0, 3); r.frauAelter = altersdiff.filter((x) => x.diff < 0).sort((x, y) => x.diff - y.diff).slice(0, 3);
  heirat.sort((x, y) => x.alter - y.alter);
  r.juengsteHeirat = heirat.slice(0, 3).map((h) => ({ ...h, verdacht: h.alter < 16 }));
  r.aeltesteHeirat = heirat.slice(-3).reverse();
  // Kinderzahlen
  const kinderAnzahl = [...kinderDerPerson.entries()].map(([id, set]) => ({ p: P.get(id), n: set.size })).filter((x) => x.p);
  r.mutterMeiste = kinderAnzahl.filter((x) => chrFrau(x.p)).sort((a, b) => b.n - a.n).slice(0, 5);
  r.vaterMeiste = kinderAnzahl.filter((x) => chrMann(x.p)).sort((a, b) => b.n - a.n).slice(0, 5);
  r.paarMeiste = ehen.map((f) => ({ f, a: P.get(f.partner_a_id), b: P.get(f.partner_b_id), n: (kinderVon.get(f.id) || []).length })).filter((x) => x.a && x.b && x.n).sort((a, b) => b.n - a.n).slice(0, 5);
  // Alter der Eltern bei Geburt
  const elternAlter = [];
  for (const [kid, fams] of elternFam) {
    const kd = chrDatum(P.get(kid)?.geburtsdatum); if (!kd) continue;
    for (const fid of fams) {
      const f = F.get(fid); if (!f) continue;
      for (const pid of [f.partner_a_id, f.partner_b_id]) {
        const e = P.get(pid); const g = chrDatum(e?.geburtsdatum);
        if (g) elternAlter.push({ e, kind: P.get(kid), alter: chrJahre(g, kd) });
      }
    }
  }
  const mue = elternAlter.filter((x) => chrFrau(x.e)).sort((a, b) => a.alter - b.alter);
  const vae = elternAlter.filter((x) => chrMann(x.e)).sort((a, b) => a.alter - b.alter);
  r.juengsteMutter = mue.slice(0, 3).map((x) => ({ ...x, verdacht: x.alter < 15 }));
  r.aeltesteMutter = mue.slice(-3).reverse().map((x) => ({ ...x, verdacht: x.alter > 50 }));
  r.juengsterVater = vae.slice(0, 3).map((x) => ({ ...x, verdacht: x.alter < 16 }));
  r.aeltesterVater = vae.slice(-3).reverse().map((x) => ({ ...x, verdacht: x.alter > 80 }));
  const eheZahl = new Map();
  for (const f of ehen) for (const pid of [f.partner_a_id, f.partner_b_id]) eheZahl.set(pid, (eheZahl.get(pid) || 0) + 1);
  r.mehrfach = [...eheZahl.entries()].filter(([, n]) => n >= 3).map(([id, n]) => ({ p: P.get(id), n })).filter((x) => x.p).sort((a, b) => b.n - a.n);
  r.zweimal = [...eheZahl.values()].filter((n) => n === 2).length;

  // 3 · Namen
  const zaehle = (liste) => { const m = new Map(); for (const x of liste) if (x) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const erster = (p) => String(p.vorname || "").trim().split(/\s+/)[0] || null;
  const rufname = (p) => { const t = String(p.vorname || "").trim().split(/\s+/); return (t[0] === "Maria" || t[0] === "Johann" || t[0] === "Anna") && t[1] ? t[1] : t[0]; };
  r.vornamen = zaehle(d.personen.map(erster)).slice(0, 10);
  r.nachnamen = zaehle(d.personen.map((p) => p.Ledigenname || p.nachname)).slice(0, 10);
  r.namenJh = [17, 18, 19, 20].map((jh) => {
    const ps = d.personen.filter((p) => { const g = chrGebJahr(p); return g && Math.floor(g / 100) + 1 === jh; });
    return { jh, frauen: zaehle(ps.filter(chrFrau).map(rufname)).slice(0, 3), maenner: zaehle(ps.filter(chrMann).map(rufname)).slice(0, 3), n: ps.length };
  }).filter((x) => x.n);

  // 4 · Leben und Tod
  r.lebenJh = [17, 18, 19, 20].map((jh) => {
    const ps = lebende.filter((x) => { const g = chrGebJahr(x.p); return g && Math.floor(g / 100) + 1 === jh; });
    const erw = ps.filter((x) => x.alter >= 15);
    return { jh, n: ps.length, schnitt: ps.length ? ps.reduce((s, x) => s + x.alter, 0) / ps.length : null, erwachsen: erw.length ? erw.reduce((s, x) => s + x.alter, 0) / erw.length : null, saeugling: ps.filter((x) => x.alter < 1).length };
  }).filter((x) => x.n >= 5);
  r.umstaende = d.personen.filter((p) => p.todesumstand).sort((a, b) => (chrTodJahr(a) || 0) - (chrTodJahr(b) || 0));
  const todTage = new Map();
  for (const p of d.personen) if (p.sterbedatum) (todTage.get(String(p.sterbedatum).slice(0, 10)) || todTage.set(String(p.sterbedatum).slice(0, 10), []).get(String(p.sterbedatum).slice(0, 10))).push(p);
  r.todTage = [...todTage.entries()].filter(([, l]) => l.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  const monate = new Array(12).fill(0);
  for (const p of d.personen) { const t = chrDatum(p.sterbedatum); if (t) monate[t.getMonth()]++; }
  r.sterbeMonate = monate;
  const notizText = (p) => `${p.Notiz || ""}`.toLowerCase();
  r.besondere = d.personen.filter((p) => /lawine|ofengas|zahnr|stallbrand|unglück|ertrunken|blitz/.test(notizText(p)));

  // 5 · Wanderungen
  const H = new Map(d.haeuser.map((h) => [h.id, h]));
  const stationenVon = new Map();
  for (const s of d.stationen) (stationenVon.get(s.personen_id) || stationenVon.set(s.personen_id, []).get(s.personen_id)).push(s);
  const fern = /frankreich|amerika|brasilien|schweiz|deutschland|brd|augsburg|st\.? ?gallen(?!kirch)|st\.? ?gall\.?$|altst[äa]tten|konstan|schwaben|liechtenst|ukraine|schlesien|wien|bayern/i;
  const ausw = [];
  for (const p of d.personen) {
    const orte = (stationenVon.get(p.id) || []).filter((s) => s.art === "zugezogen").map((s) => H.get(s.haus_id)?.ort).filter(Boolean);
    const treffer = [...orte, ...String(p.Notiz || "").match(/nach [A-ZÄÖÜ][\wäöüß.]+(?: [A-ZÄÖÜ][\wäöüß.]+)?/g) || []].find((o) => fern.test(o));
    if (treffer) ausw.push({ p, ziel: String(treffer).replace(/^nach /, "") });
  }
  r.auswanderer = ausw.sort((a, b) => (chrGebJahr(a.p) || 0) - (chrGebJahr(b.p) || 0));
  const zuzug = new Map(), wegzug = new Map();
  for (const [pid, ss] of stationenVon) {
    const hatInnerberg = ss.some((s) => H.get(s.haus_id)?.ort === "Innerberg");
    if (!hatInnerberg) continue;
    for (const s of ss) {
      const ort = H.get(s.haus_id)?.ort;
      if (!ort || ort === "Innerberg") continue;
      if (s.art === "zugezogen") wegzug.set(ort, (wegzug.get(ort) || 0) + 1);
      else zuzug.set(ort, (zuzug.get(ort) || 0) + 1);
    }
  }
  r.zuzug = [...zuzug.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  r.wegzug = [...wegzug.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // 6 · Häuser
  const bewohner = new Map();
  for (const s of d.stationen) { const h = H.get(s.haus_id); if (h?.ort !== "Innerberg") continue; (bewohner.get(h.id) || bewohner.set(h.id, new Set()).get(h.id)).add(s.personen_id); }
  r.haeuser = [...bewohner.entries()].map(([hid, set]) => {
    const h = H.get(hid); const ps = [...set].map((id) => P.get(id)).filter(Boolean);
    const js = ps.map(chrGebJahr).filter(Boolean);
    return { h, n: set.size, von: js.length ? Math.min(...js) : null, namen: new Set(ps.map((p) => p.Ledigenname || p.nachname).filter(Boolean)).size };
  }).sort((a, b) => b.n - a.n);
  // längste Familienfolge im selben Haus (Kind mit Elternhaus dort, dessen Elternteil auch dort)
  const imHaus = new Map(); // haus -> Set personen
  for (const s of d.stationen) (imHaus.get(s.haus_id) || imHaus.set(s.haus_id, new Set()).get(s.haus_id)).add(s.personen_id);
  const folge = [];
  for (const [hid, set] of imHaus) {
    const h = H.get(hid); if (h?.ort !== "Innerberg") continue;
    const memo = new Map();
    const lang = (id) => {
      if (memo.has(id)) return memo.get(id);
      memo.set(id, 1);
      let m = 1;
      for (const k of kinderDerPerson.get(id) || []) if (set.has(k)) m = Math.max(m, 1 + lang(k));
      memo.set(id, m); return m;
    };
    let best = 0, start = null;
    for (const id of set) { const l = lang(id); if (l > best) { best = l; start = P.get(id); } }
    if (best >= 3) folge.push({ h, gen: best, start });
  }
  r.hausFolge = folge.sort((a, b) => b.gen - a.gen).slice(0, 6);
  r.abgebrochen = d.haeuser.filter((h) => h.ort === "Innerberg" && /abgebrochen|abgebr\./i.test(h.notiz || "")).sort((a, b) => Number(a.nummer) - Number(b.nummer));

  // 7 · Verwandtschaft (Zusammenhang über Eltern, Kinder, Ehen)
  const nachbar = new Map(d.personen.map((p) => [p.id, new Set()]));
  const verbinde = (a, b) => { if (nachbar.has(a) && nachbar.has(b) && a !== b) { nachbar.get(a).add(b); nachbar.get(b).add(a); } };
  for (const f of d.familien) {
    if (f.partner_a_id && f.partner_b_id) verbinde(f.partner_a_id, f.partner_b_id);
    for (const k of kinderVon.get(f.id) || []) { verbinde(f.partner_a_id, k); verbinde(f.partner_b_id, k); }
  }
  const komp = []; const gesehen = new Set();
  for (const p of d.personen) {
    if (gesehen.has(p.id)) continue;
    const stapel = [p.id]; const teil = [];
    gesehen.add(p.id);
    while (stapel.length) { const x = stapel.pop(); teil.push(x); for (const y of nachbar.get(x)) if (!gesehen.has(y)) { gesehen.add(y); stapel.push(y); } }
    komp.push(teil);
  }
  komp.sort((a, b) => b.length - a.length);
  r.verbund = { groesste: komp[0]?.length || 0, inseln: komp.length - 1, einzeln: komp.filter((k) => k.length === 1).length, kleine: komp.slice(1, 6).map((k) => k.map((id) => P.get(id)).filter(Boolean)) };
  // Nachkommen zählen
  const nachkommen = (id) => { const s = new Set(); const st = [...(kinderDerPerson.get(id) || [])]; while (st.length) { const k = st.pop(); if (s.has(k)) continue; s.add(k); for (const x of kinderDerPerson.get(k) || []) st.push(x); } return s.size; };
  const ohneEltern = d.personen.filter((p) => !elternFam.has(p.id) && kinderDerPerson.has(p.id));
  r.stammeltern = ohneEltern.map((p) => ({ p, n: nachkommen(p.id) })).sort((a, b) => b.n - a.n).slice(0, 6);

  // 8 · Heute vor … Jahren
  const heute = new Date(); const md = `${String(heute.getMonth() + 1).padStart(2, "0")}-${String(heute.getDate()).padStart(2, "0")}`;
  const tag = (v) => v && String(v).slice(5, 10) === md;
  r.heute = [];
  for (const p of d.personen) {
    if (tag(p.geburtsdatum)) r.heute.push({ art: "geboren", p, jahr: chrJahr(p.geburtsdatum) });
    if (tag(p.sterbedatum)) r.heute.push({ art: "gestorben", p, jahr: chrJahr(p.sterbedatum) });
  }
  for (const f of ehen) if (tag(f.beginn)) r.heute.push({ art: "geheiratet", p: P.get(f.partner_a_id), p2: P.get(f.partner_b_id), jahr: chrJahr(f.beginn) });
  r.heute.sort((a, b) => a.jahr - b.jahr);
  r.heuteText = heute.toLocaleDateString("de-AT", { day: "numeric", month: "long" });

  // 9 · Zeitgeschehen: wie viele Personen lebten damals?
  r.zeit = ZEITGESCHEHEN.map(([jahr, text]) => {
    const lebend = d.personen.filter((p) => { const g = chrGebJahr(p); if (!g || g > jahr) return false; const t = chrTodJahr(p); return t ? t >= jahr : jahr - g <= 90; });
    const geboren = d.personen.filter((p) => chrGebJahr(p) === jahr);
    return { jahr, text, lebend: lebend.length, geboren };
  }).filter((z) => z.lebend || z.geboren.length);
  return r;
}

/* ---------- Darstellung ---------- */
function chronikRendern(r, ziel) {
  const z = r.zahlen;
  const liste = (arr, f) => arr.length ? `<ol class="chr-liste">${arr.map((x) => `<li>${f(x)}</li>`).join("")}</ol>` : `<p class="chr-leer">Keine Angaben.</p>`;
  const pruef = (x) => x.verdacht ? ` <span class="chr-pruef" title="Unwahrscheinlich – bitte im Kirchenbuch prüfen">bitte prüfen</span>` : "";
  const karte = (titel, inhalt, klasse = "") => `<section class="chr-karte ${klasse}"><h3>${titel}</h3>${inhalt}</section>`;
  const monatsNamen = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const maxMonat = Math.max(...r.sterbeMonate, 1);
  const html = [
    karte("📅 Heute vor … Jahren", `<p class="chr-sub">${chrEsc(r.heuteText)}</p>` + (r.heute.length ? liste(r.heute, (x) => `<b>${x.jahr}</b> · vor ${new Date().getFullYear() - x.jahr} Jahren ${x.art === "geheiratet" ? `heirateten ${chrLink(x.p)} und ${chrLink(x.p2)}` : `${x.art === "geboren" ? "wurde" : "starb"} ${chrLink(x.p)}${x.art === "geboren" ? " geboren" : ""}`}`) : `<p class="chr-leer">Heute gibt es im Bestand keinen Geburts-, Todes- oder Hochzeitstag.</p>`), "chr-breit"),
    karte("🔢 Zahlen", `<div class="chr-zahlen">
      <div><b>${chrZahl(z.personen)}</b><span>Personen</span></div>
      <div><b>${chrZahl(z.ehen)}</b><span>Ehen</span></div>
      <div><b>${chrZahl(z.verbindungen)}</b><span>Eltern-Kind-Verbindungen</span></div>
      <div><b>${chrZahl(z.haeuser)}</b><span>Häuser mit Bewohnern</span></div>
      <div><b>${z.generationen}</b><span>Generationen</span></div>
      <div><b>${z.vonJahr || "?"}–${z.bisJahr || "?"}</b><span>Geburtsjahre</span></div></div>
      <p class="chr-sub">${chrZahl(z.frauen)} Frauen · ${chrZahl(z.maenner)} Männer · ${chrZahl(z.hausblatt)} aus Hausblättern (davon ${chrZahl(z.geprueft)} geprüft) · ${chrZahl(z.eigen)} selbst erfasst · ${chrZahl(z.nurName)} „nur Name“</p>
      ${z.generationenStart ? `<p class="chr-sub">Längste Linie: ${z.generationen} Generationen, beginnend mit ${chrLink(z.generationenStart)}</p>` : ""}`),
    karte("🎂 Älteste Personen", liste(r.aelteste, (x) => `${chrLink(x.p)} – <b>${Math.floor(x.alter)} Jahre</b>`)),
    karte("💍 Längste Ehen", liste(r.ehen, (x) => `${chrLink(x.a)} und ${chrLink(x.b)} – <b>${Math.floor(x.jahre)} Jahre</b> (ab ${x.beginn.getFullYear()})${pruef(x)}`)),
    karte("👶 Meiste Kinder", `<h4>Mütter</h4>${liste(r.mutterMeiste, (x) => `${chrLink(x.p)} – <b>${x.n}</b>`)}<h4>Väter</h4>${liste(r.vaterMeiste, (x) => `${chrLink(x.p)} – <b>${x.n}</b>`)}<h4>Paare</h4>${liste(r.paarMeiste, (x) => `${chrLink(x.a)} und ${chrLink(x.b)} – <b>${x.n}</b>`)}`),
    karte("👩‍👧 Alter der Eltern bei der Geburt", `<h4>Jüngste Mütter</h4>${liste(r.juengsteMutter, (x) => `${chrLink(x.e)} – ${chrRund(x.alter)} Jahre bei ${chrLink(x.kind)}${pruef(x)}`)}
      <h4>Älteste Mütter</h4>${liste(r.aeltesteMutter, (x) => `${chrLink(x.e)} – ${chrRund(x.alter)} Jahre bei ${chrLink(x.kind)}${pruef(x)}`)}
      <h4>Jüngste Väter</h4>${liste(r.juengsterVater, (x) => `${chrLink(x.e)} – ${chrRund(x.alter)} Jahre bei ${chrLink(x.kind)}${pruef(x)}`)}
      <h4>Älteste Väter</h4>${liste(r.aeltesterVater, (x) => `${chrLink(x.e)} – ${chrRund(x.alter)} Jahre bei ${chrLink(x.kind)}${pruef(x)}`)}`),
    karte("💑 Heirat und Altersunterschied", `<h4>Jüngste bei der Heirat</h4>${liste(r.juengsteHeirat, (x) => `${chrLink(x.p)} – ${chrRund(x.alter)} Jahre (${x.jahr})${pruef(x)}`)}
      <h4>Älteste bei der Heirat</h4>${liste(r.aeltesteHeirat, (x) => `${chrLink(x.p)} – ${chrRund(x.alter)} Jahre (${x.jahr})`)}
      <h4>Mann deutlich älter</h4>${liste(r.mannAelter, (x) => `${chrLink(x.mann)} und ${chrLink(x.frau)} – <b>${x.diff} Jahre</b>`)}
      <h4>Frau deutlich älter</h4>${liste(r.frauAelter, (x) => `${chrLink(x.frau)} und ${chrLink(x.mann)} – <b>${-x.diff} Jahre</b>`)}
      <p class="chr-sub">${chrZahl(r.zweimal)} Personen waren zweimal verheiratet${r.mehrfach.length ? `, dreimal oder öfter: ${r.mehrfach.map((x) => `${chrLink(x.p)} (${x.n}×)`).join(", ")}` : ""}.</p>`),
    karte("📛 Namen", `<div class="chr-zwei"><div><h4>Häufigste Vornamen</h4>${liste(r.vornamen, ([n, c]) => `${chrEsc(n)} <b>${c}</b>`)}</div><div><h4>Häufigste Familiennamen</h4>${liste(r.nachnamen, ([n, c]) => `${chrEsc(n)} <b>${c}</b>`)}</div></div>
      <h4>Beliebteste Rufnamen je Jahrhundert</h4><table class="chr-tabelle"><tr><th>Geboren</th><th>Mädchen</th><th>Buben</th></tr>${r.namenJh.map((x) => `<tr><td>${x.jh}. Jh.</td><td>${x.frauen.map(([n]) => chrEsc(n)).join(", ")}</td><td>${x.maenner.map(([n]) => chrEsc(n)).join(", ")}</td></tr>`).join("")}</table>`),
    karte("⏳ Leben und Tod", `<table class="chr-tabelle"><tr><th>Geboren</th><th>Personen</th><th>Ø Alter</th><th>Ø Alter Erwachsener</th><th>vor dem 1. Geburtstag gestorben</th></tr>${r.lebenJh.map((x) => `<tr><td>${x.jh}. Jh.</td><td>${x.n}</td><td>${x.schnitt ? chrRund(x.schnitt, 0) : "–"}</td><td>${x.erwachsen ? chrRund(x.erwachsen, 0) : "–"}</td><td>${x.saeugling} (${chrRund(100 * x.saeugling / x.n, 0)} %)</td></tr>`).join("")}</table>
      <p class="chr-sub">Nur Personen mit genauem Geburts- und Sterbedatum.</p>
      <h4>Sterbemonate</h4><div class="chr-balken">${r.sterbeMonate.map((n, i) => `<div><i style="height:${Math.round(60 * n / maxMonat)}px"></i><small>${monatsNamen[i]}</small><b>${n}</b></div>`).join("")}</div>
      <h4>Todesumstände</h4>${liste(r.umstaende, (p) => `${chrLink(p)} – ${chrEsc(typeof todesumstandText === "function" ? todesumstandText(p) : p.todesumstand)}`)}
      ${r.todTage.length ? `<h4>Tage mit mehreren Todesfällen</h4>${liste(r.todTage, ([t, l]) => `<b>${new Date(t).toLocaleDateString("de-AT")}</b>: ${l.map(chrLink).join(", ")}`)}` : ""}
      ${r.besondere.length ? `<h4>Besondere Todesfälle laut Notiz</h4>${liste(r.besondere, (p) => chrLink(p))}` : ""}`),
    karte("🌍 Wanderungen", `<h4>Weit weg gezogen</h4>${liste(r.auswanderer, (x) => `${chrLink(x.p)} – ${chrEsc(x.ziel)}`)}
      <div class="chr-zwei"><div><h4>Herkunft der Zugezogenen</h4>${liste(r.zuzug, ([o, n]) => `${chrEsc(o)} <b>${n}</b>`)}</div><div><h4>Wegzug aus Innerberg nach</h4>${liste(r.wegzug, ([o, n]) => `${chrEsc(o)} <b>${n}</b>`)}</div></div>`),
    karte("🏠 Häuser", `<h4>Meiste Bewohner</h4>${liste(r.haeuser.slice(0, 8), (x) => `Nr. ${chrEsc(x.h.nummer)}${x.h.name ? ` „${chrEsc(x.h.name)}“` : ""} – <b>${x.n}</b> Personen, ${x.namen} Familiennamen${x.von ? `, ab ${x.von}` : ""}`)}
      <h4>Längste Familienfolge im selben Haus</h4>${liste(r.hausFolge, (x) => `Nr. ${chrEsc(x.h.nummer)}${x.h.name ? ` „${chrEsc(x.h.name)}“` : ""} – <b>${x.gen} Generationen</b>, beginnend mit ${chrLink(x.start)}`)}
      ${r.abgebrochen.length ? `<p class="chr-sub">Abgebrochene Häuser: ${r.abgebrochen.map((h) => `Nr. ${chrEsc(h.nummer)}${h.name ? ` „${chrEsc(h.name)}“` : ""}`).join(", ")}</p>` : ""}`),
    karte("🧬 Verwandtschaft", `<p><b>${chrZahl(r.verbund.groesste)} von ${chrZahl(z.personen)}</b> Personen (${chrRund(100 * r.verbund.groesste / Math.max(1, z.personen), 0)} %) sind über Eltern, Kinder und Ehen miteinander verbunden.</p>
      <p class="chr-sub">Daneben gibt es ${r.verbund.inseln} getrennte „Inseln“, davon ${r.verbund.einzeln} einzelne Personen ohne jede Verbindung.</p>
      <h4>Stammeltern mit den meisten Nachkommen im Bestand</h4>${liste(r.stammeltern, (x) => `${chrLink(x.p)} – <b>${chrZahl(x.n)}</b> Nachkommen`)}`),
    karte("📜 Zeitgeschehen", `<p class="chr-sub">Was zur Zeit deiner Vorfahren geschah – mit der Zahl der Personen aus dem Bestand, die damals lebten.</p>
      <ol class="chr-zeit">${r.zeit.map((x) => `<li><b>${x.jahr}</b> ${chrEsc(x.text)}<small>${x.lebend === 1 ? "1 Person lebte" : `${x.lebend} Personen lebten`}${x.geboren.length ? ` · geboren: ${x.geboren.slice(0, 4).map(chrLink).join(", ")}${x.geboren.length > 4 ? ` und ${x.geboren.length - 4} weitere` : ""}` : ""}</small></li>`).join("")}</ol>`, "chr-breit")
  ];
  ziel.innerHTML = html.join("");
}

async function zeigeChronik(neu = false) {
  const ziel = document.getElementById("chronik-inhalt");
  const status = document.getElementById("chronik-status");
  if (!ziel) return;
  if (status) status.textContent = "Wird berechnet …";
  try {
    const d = await chronikDatenLaden(neu);
    const r = chronikAuswerten(d);
    chronikRendern(r, ziel);
    if (status) status.textContent = `Stand: ${d.geladen.toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" })} · ${chrZahl(d.personen.length)} Personen`;
  } catch (err) {
    debugLog(`⚠️ Chronik: ${err.message || err}`);
    if (status) status.textContent = `Konnte nicht berechnet werden: ${err.message || err}`;
  }
}

document.addEventListener("click", (e) => {
  const b = e.target.closest?.(".chr-link");
  if (b?.dataset.pid) openPersonDetail(b.dataset.pid);
});
document.getElementById("chronik-neu")?.addEventListener("click", () => zeigeChronik(true));
document.querySelector('.tab-btn[data-tab="chronik"]')?.addEventListener("click", () => zeigeChronik(false));

/* ---------- Zeitgeschehen in der Personenansicht ---------- */
function zeitgeschehenFuerPerson(p) {
  const g = chrGebJahr(p);
  if (!g) return [];
  const t = chrTodJahr(p) || (g + 90 < new Date().getFullYear() ? g + 80 : new Date().getFullYear());
  return ZEITGESCHEHEN.filter(([j]) => j >= g && j <= t).map(([j, text]) => ({ jahr: j, text, alter: j - g }));
}
function zeigeZeitgeschehen(person) {
  const sec = document.getElementById("pv-zeit-section");
  const liste = document.getElementById("pv-zeit-list");
  if (!sec || !liste) return;
  const ev = zeitgeschehenFuerPerson(person);
  sec.hidden = !ev.length;
  if (!ev.length) { liste.innerHTML = ""; return; }
  const sichtbar = 6;
  liste.innerHTML = ev.map((e, i) => `<li${i >= sichtbar ? " hidden" : ""}><b>${e.jahr}</b>${e.alter === 0 ? " · im Geburtsjahr" : ` · mit ${e.alter} Jahren`}<span>${chrEsc(e.text)}</span></li>`).join("") +
    (ev.length > sichtbar ? `<li class="pv-zeit-mehr"><button type="button" class="btn btn--ghost">Alle ${ev.length} Ereignisse zeigen</button></li>` : "");
  liste.querySelector(".pv-zeit-mehr button")?.addEventListener("click", (e) => {
    liste.querySelectorAll("li[hidden]").forEach((li) => { li.hidden = false; });
    e.currentTarget.closest("li").remove();
  });
}
