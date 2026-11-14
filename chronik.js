// Familienspuren – Chronik & Statistik (v381)
// Rechnet alle Auswertungen direkt aus der Datenbank (keine KI). Wird nach app.js geladen
// und nutzt dessen globale Hilfen (sb, alleZeilenLaden, openPersonDetail, debugLog, todesumstandText).

/* ---------- Zeitgeschehen: Jahresliste (Montafon, Vorarlberg, Österreich, Welt) ---------- */
// [Jahr, Text, Quelle] – Quelle "B" = Dorfchronik Bartholomäberg (Gemeindebuch S. 58–65), sonst allgemein
const ZEITGESCHEHEN = [
  [842, "Das Rätische Urbar nennt acht Schmelzöfen im Drusentalgau – wohl die Bergwerke am Bartholomäberg und Kristberg", "B"],
  [1100, "Um 1100: Bartholomäberg ist nach der Überlieferung bereits Pfarrei", "B"],
  [1150, "Um 1150: Das romanische Vortragekreuz entsteht, der älteste Schatz der Pfarrkirche", "B"],
  [1280, "1280–1320: Die Walser wandern ins Silbertal ein und siedeln auch am Rand von Bartholomäberg", "B"],
  [1319, "Eine Urkunde nennt die Silbergruben am Berg „muntafune“ – der alte Name des Dorfes", "B"],
  [1350, "Das Bartholomäberger Zinsbuch nennt Bartholomäberg als Pfarre", "B"],
  [1383, "Erblehensbrief des Hans Tschug nennt den Widum und die angrenzenden Güter", "B"],
  [1418, "Erste urkundliche Nachricht über die Pfarrkirche (Ablassbrief vom Konstanzer Konzil)", "B"],
  [1420, "Die Parzelle Gantschier wird als „cuntschir“ genannt", "B"],
  [1431, "Erster namentlich bekannter Pfarrer von Bartholomäberg: „pfaff baltiser“", "B"],
  [1432, "Erste urkundliche Nennung des Namens Mangein bzw. Mangeng", "B"],
  [1450, "Um 1450: Hochblüte des Bergbaus – in rund 50 Stollen wird Kupfer, Eisen und Silber gegraben", "B"],
  [1503, "Der Churer Bischof Heinrich VI. weiht in der Kirche einen Altar zu Ehren des hl. Georg", "B"],
  [1517, "Gründung der St.-Anna-Kaplanei", "B"],
  [1525, "Der Anna- oder Knappenaltar wird geschnitzt – einer der schönsten gotischen Flügelaltäre des Landes", "B"],
  [1591, "Pest in Bartholomäberg; die Toten sollen am „Totabühel“ in einem Massengrab liegen", "B"],
  [1597, "Schruns wird abgetrennt und eigene Pfarrei", "B"],
  [1618, "Beginn des Dreißigjährigen Krieges"],
  [1636, "Beginn der Pfarrmatriken (Tauf-, Trauungs- und Sterbebücher)", "B"],
  [1642, "Drei Glocken (rund 3.500 kg) werden von der Glockengießerfamilie Rossier aus Lothringen gegossen", "B"],
  [1647, "Schwedische Truppen erobern Bregenz"],
  [1648, "Westfälischer Friede beendet den Dreißigjährigen Krieg"],
  [1657, "Stiftung der Frühmesspfründe unter Pfarrer Luzius Hauser und Vorsteher Rochus Fritz", "B"],
  [1659, "Gründung der Rosenkranzbruderschaft (15 Rosenkranzgeheimnisse auf Tragstangen)", "B"],
  [1683, "Zweite Türkenbelagerung Wiens"],
  [1689, "Lawinenkatastrophe: 58 Menschen verschüttet, 36 Tote", "B"],
  [1703, "Spanischer Erbfolgekrieg: bayerische Truppen fallen in Tirol ein („Bayerischer Rummel“)"],
  [1719, "Sehr heißer Sommer – kaum ein Viertel der normalen Ernte", "B"],
  [1728, "Erste Nachricht von der Schule „in dem Mesmerhaus“", "B"],
  [1729, "Neubau der Barockkirche unter Pfarrer Johann Franz Marent", "B"],
  [1735, "Große Maikäferplage – über 200 Mäßle Maikäfer müssen abgeliefert werden", "B"],
  [1740, "Maria Theresia übernimmt die Herrschaft in den habsburgischen Ländern"],
  [1743, "Weihe der neuen Kirche durch Bischof Benedikt von Rost aus Chur", "B"],
  [1752, "Maria Theresia erlaubt den Montafonern Viehmärkte in Schruns (22. September)", "B"],
  [1756, "Großer Heu- und Futtermangel – das Vieh muss im April außer Landes gebracht werden", "B"],
  [1756, "Beginn des Siebenjährigen Krieges"],
  [1759, "Maikäferjahr (wieder 1762): insgesamt 320 Eimer Maikäfer sind abzuliefern", "B"],
  [1762, "Größte Wasserflut seit Menschengedenken – alle Brücken bis Feldkirch werden mitgerissen", "B"],
  [1770, "Erste Hausnummern: Konskription und Nummerierung der Häuser in den habsburgischen Ländern"],
  [1771, "Meister Josef Vonier aus Schruns baut den oberen Teil des Turmes und die Turmkuppel; Vorsteher ist Christian Mangeng", "B"],
  [1774, "Allgemeine Schulpflicht durch die Theresianische Schulordnung"],
  [1780, "Tod Maria Theresias – Joseph II. regiert allein"],
  [1781, "Toleranzpatent Josephs II."],
  [1784, "Josephinische Matrikenordnung: Kirchenbücher werden nach staatlichen Vorgaben geführt"],
  [1789, "Französische Revolution"],
  [1792, "Bau der Barockorgel durch Michael Graß aus Bürserberg", "B"],
  [1799, "Koalitionskrieg: Schlacht bei Feldkirch, die Franzosen werden zurückgeschlagen"],
  [1800, "Französische Truppen besetzen Vorarlberg"],
  [1805, "Friede von Pressburg: Vorarlberg kommt an Bayern"],
  [1806, "Ende des Heiligen Römischen Reiches"],
  [1809, "Aufstand in Tirol und Vorarlberg gegen Bayern und Napoleon (Andreas Hofer, Anton Schneider)"],
  [1810, "Andreas Hofer wird in Mantua hingerichtet"],
  [1811, "Über zwei Dutzend Männer werden zur Großen Armee Napoleons eingezogen; sechs fallen in Russland", "B"],
  [1812, "Napoleons Russlandfeldzug: Vorarlberger kämpfen im bayerischen Heer, nur wenige kehren zurück"],
  [1813, "Völkerschlacht bei Leipzig"],
  [1814, "Laut Totenbuch sterben in der Pfarrei 61 Menschen, davon 18 Kinder", "B"],
  [1814, "Vorarlberg kommt wieder zu Österreich"],
  [1815, "Wiener Kongress und Napoleons Niederlage bei Waterloo"],
  [1816, "„Jahr ohne Sommer“ nach dem Ausbruch des Tambora: Missernten und Hunger"],
  [1817, "Hungerjahr in Bartholomäberg: Die Leute stillen ihren Hunger mit „Stafelblacken“, Nesseln und Gras", "B"],
  [1817, "Hungersnot nach der Missernte des Vorjahres"],
  [1836, "Geburt von Franz Josef Battlogg, dem späteren Kirchenmusikreformer Vorarlbergs", "B"],
  [1846, "Missernten und Teuerung in ganz Europa (Hungerjahre 1846/47)"],
  [1848, "Revolution in Österreich – Aufhebung der Grundherrschaft"],
  [1859, "Krieg in Italien (Schlacht bei Solferino)"],
  [1861, "Erster Vorarlberger Landtag"],
  [1866, "Krieg gegen Preußen (Königgrätz)"],
  [1867, "Ausgleich: Österreich-Ungarn entsteht"],
  [1869, "Reichsvolksschulgesetz: achtjährige Schulpflicht"],
  [1872, "Eröffnung der Vorarlbergbahn bis Bludenz"],
  [1873, "Furchtbare Viehseuche – viele Ställe müssen geräumt werden", "B"],
  [1874, "Gründung des Veteranenvereins unter Christian Juen", "B"],
  [1884, "Eröffnung der Arlbergbahn"],
  [1894, "Gründung der Feuerwehr Bartholomäberg (erster Kommandant Johann Josef Köberle)", "B"],
  [1903, "Maria Anna Drinkwälder geb. Galehr vermacht dem Armenfonds 27.000 Kronen; 1905/06 wird das Armenhaus gebaut (Zimmermeister Johann Josef Mangeng)", "B"],
  [1905, "Eröffnung der Montafonerbahn Bludenz–Schruns"],
  [1912, "Gründung des Viehzuchtvereins Bartholomäberg (18. November)", "B"],
  [1914, "Im Ersten Weltkrieg fallen 31 Männer aus Bartholomäberg (bis 1918)", "B"],
  [1914, "Beginn des Ersten Weltkriegs"],
  [1915, "Italien tritt in den Krieg ein – Front in Südtirol und Tirol"],
  [1916, "Tod Kaiser Franz Josephs"],
  [1918, "Ende des Ersten Weltkriegs, Spanische Grippe, Gründung der Republik"],
  [1919, "Volksabstimmung in Vorarlberg über einen Anschluss an die Schweiz"],
  [1923, "Neues Geläute mit 4 Glocken (5.422 kg), nachdem die alten Glocken dem Krieg geopfert wurden", "B"],
  [1924, "Gründung der Vorarlberger Illwerke"],
  [1925, "Der Schilling ersetzt die Krone"],
  [1928, "Gründung der Harmoniemusik Bartholomäberg unter Kapellmeister Dagobert Mathies", "B"],
  [1929, "Weltwirtschaftskrise"],
  [1932, "Bau der Straße von St. Anton über Bartholomäberg nach Innerberg (bis 1938) und des Schulhauses im Dorfzentrum", "B"],
  [1934, "Bürgerkrieg im Februar, Ständestaat, Ermordung von Kanzler Dollfuß"],
  [1936, "Bau des Kriegerdenkmals für die Gefallenen des Ersten Weltkriegs", "B"],
  [1938, "„Anschluss“ Österreichs an das Deutsche Reich"],
  [1939, "Im Zweiten Weltkrieg werden 49 Bartholomäberger Opfer des Krieges (bis 1945)", "B"],
  [1939, "Beginn des Zweiten Weltkriegs"],
  [1945, "Ende des Zweiten Weltkriegs – französische Besatzung in Vorarlberg"],
  [1949, "Bau des Schulhauses in Innerberg (1949/50)", "B"],
  [1952, "Josef Gunzinger spendet ein neues Geläute (5.505 kg)", "B"],
  [1953, "Am Bittmontag erfrieren bei −8 °C alle Maikäfer – Ende der jahrhundertelangen Plage", "B"],
  [1954, "„Weißer Tod“ in Bartholomäberg: zwei Großlawinen fordern 16 Menschenleben; Sturm wirft 8.000 fm Holz um", "B"],
  [1954, "Lawinenwinter: Katastrophe von Blons; Eröffnung der Silvretta-Hochalpenstraße"],
  [1955, "Bau des Schulhauses in Jetzmunt", "B"],
  [1955, "Staatsvertrag: Ende der Besatzungszeit"],
  [1956, "Pfarrer Martin Zudrell, der letzte der elf Priester aus Bartholomäberg, wird begraben", "B"],
  [1957, "Bau des Schulhauses in Gantschier (1957/58)", "B"],
  [1959, "Josef Keßler wird Ehrenbürger der Gemeinde", "B"],
  [1966, "Innenrenovierung der Pfarrkirche", "B"],
  [1967, "Straße Schruns–Bartholomäberg fertig, Hotel „Bergerhof“, Wintersportverein und Wasserversorgung", "B"],
  [1968, "Gründung der Trachtenkapelle Gantschier", "B"],
  [1969, "Bartholomäberg bekommt eine Posthilfsstelle", "B"],
  [1969, "Erste Mondlandung"],
  [1971, "Beginn des Kanalbaus", "B"],
  [1973, "Restaurierung der Orgel", "B"],
  [1978, "Bartholomäberg erhält einen Kindergarten", "B"],
  [1980, "Besuch von Bundespräsident Rudolf Kirchschläger", "B"],
  [1982, "29./30. Jänner: gefährliche Lawinenlage durch 1,50 m Pulverschnee", "B"],
  [1986, "Pfarrhaus und Altersheim werden übergeben; die Gemeinde zählt 2.044 Einwohner", "B"],
  [1989, "Einweihung der Kapelle im „Valschalang“", "B"],
  [1989, "Fall der Berliner Mauer"],
  [1990, "1. Sippentreffen der Mangeng im Gemeindesaal Bartholomäberg", "B"],
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
    if (tag(p.geburtsdatum) && !(typeof zugang !== "undefined" && zugang?.rolle === "leser" && chrVermutlichLebend(p))) r.heute.push({ art: "geboren", p, jahr: chrJahr(p.geburtsdatum) });   // v419: Lebende nicht für Leser
    if (tag(p.sterbedatum)) r.heute.push({ art: "gestorben", p, jahr: chrJahr(p.sterbedatum) });
  }
  for (const f of ehen) if (tag(f.beginn)) r.heute.push({ art: "geheiratet", p: P.get(f.partner_a_id), p2: P.get(f.partner_b_id), jahr: chrJahr(f.beginn) });
  r.heute.sort((a, b) => a.jahr - b.jahr);
  r.heuteText = heute.toLocaleDateString("de-AT", { day: "numeric", month: "long" });

  // 10 · Schicksalsschläge (v394): Familien mit vielen Todesfällen in kurzer Zeit – wird bei jeder Berechnung neu ermittelt
  {
    const datumOderJahr = (v, j) => chrDatum(v) || (j ? new Date(`${j}-07-01T00:00:00`) : null);
    const tod = (p) => datumOderJahr(p?.sterbedatum, p?.sterbejahr);
    const geb = (p) => datumOderJahr(p?.geburtsdatum, p?.geburtsjahr);
    const kandidaten = [];
    for (const f of d.familien) {
      const ks = (kinderVon.get(f.id) || []).map((id) => P.get(id)).filter(Boolean);
      if (ks.length < 2) continue;
      const vater = [P.get(f.partner_a_id), P.get(f.partner_b_id)].find((x) => x && chrMann(x));
      const mutter = [P.get(f.partner_a_id), P.get(f.partner_b_id)].find((x) => x && chrFrau(x));
      const ereignisse = [];
      let punkte = 0, kinderTot = 0;
      for (const k of ks) {
        const g = geb(k), t = tod(k);
        if (!g || !t || t < g) continue;
        const alter = chrJahre(g, t);
        if (alter < 15) {
          kinderTot++;
          punkte += alter < 1 ? 2 : 3;
          ereignisse.push({ t, art: "kind", p: k, alter });
        }
      }
      const kleineBeiTod = (eltern) => {
        const te = tod(eltern); if (!te) return [];
        return ks.filter((k) => { const g = geb(k); const tk = tod(k); return g && g <= te && chrJahre(g, te) < 15 && (!tk || tk > te); });
      };
      for (const [eltern, rolle] of [[vater, "vater"], [mutter, "mutter"]]) {
        if (!eltern) continue;
        const kleine = kleineBeiTod(eltern);
        const te = tod(eltern);
        if (te && kleine.length) { punkte += 4 + kleine.length; ereignisse.push({ t: te, art: rolle, p: eltern, kleine: kleine.length }); }
        else if (te && ereignisse.length) { ereignisse.push({ t: te, art: rolle, p: eltern, kleine: 0 }); }
      }
      if (kinderTot < 2 && !ereignisse.some((e) => e.art !== "kind")) continue;
      ereignisse.sort((a, b) => a.t - b.t);
      // Häufung: mindestens drei Todesfälle innerhalb von zwei Jahren
      for (let i = 0; i + 2 < ereignisse.length; i++) if ((ereignisse[i + 2].t - ereignisse[i].t) / (365.25 * 864e5) <= 2) { punkte += 4; break; }
      if (punkte >= 8 && ereignisse.length >= 3) kandidaten.push({ f, vater, mutter, ks, kinderTot, ereignisse, punkte });
    }
    kandidaten.sort((a, b) => b.punkte - a.punkte);
    const gesehen = new Set(), auswahl = [];
    for (const k of kandidaten) { // jede Person nur in einer Geschichte
      const ids = [k.vater?.id, k.mutter?.id].filter(Boolean);
      if (ids.some((id) => gesehen.has(id))) continue;
      ids.forEach((id) => gesehen.add(id)); auswahl.push(k);
      if (auswahl.length >= 4) break;
    }
    r.schicksal = auswahl;
  }

  // 9 · Zeitgeschehen: wie viele Personen lebten damals?
  r.zeit = ZEITGESCHEHEN.map(([jahr, text, quelle]) => {
    const lebend = d.personen.filter((p) => { const g = chrGebJahr(p); if (!g || g > jahr) return false; const t = chrTodJahr(p); return t ? t >= jahr : jahr - g <= 90; });
    const geboren = d.personen.filter((p) => chrGebJahr(p) === jahr);
    return { jahr, text, quelle, lebend: lebend.length, geboren };
  }).filter((z) => z.lebend || z.geboren.length);
  // 11 · Stammlinien (v409)
  r.linien = null;
  if (typeof stammlinienBerechnenAus === "function" && typeof STAMMLINIEN !== "undefined") {
    const { info, gruender } = stammlinienBerechnenAus(d.personen, d.familien, d.kinder);
    const zeilen = STAMMLINIEN.filter((l) => gruender[l.key]).map((l) => {
      const mit = [...info.entries()].filter(([, li]) => li.some((e) => e.key === l.key));
      const eintr = mit.map(([id, li]) => ({ p: P.get(id), e: li.find((e) => e.key === l.key) })).filter((x) => x.p);
      const jahrVon = (p) => Number(String(p.geburtsdatum || p.geburtsjahr || "").slice(0, 4)) || null;
      const mitJahr = eintr.filter((x) => x.e.gen > 0 && jahrVon(x.p)).sort((a, b) => jahrVon(b.p) - jahrVon(a.p));
      return { l, g: gruender[l.key], n: eintr.length, mann: eintr.filter((x) => x.e.mann).length, gen: Math.max(0, ...eintr.map((x) => x.e.gen)), juengste: mitJahr[0]?.p || null };
    });
    const beide = [...info.values()].filter((li) => li.length >= 2).length;
    const inL = (id, key) => (info.get(id) || []).some((e) => e.key === key);
    const ehen = d.familien.filter((f) => f.partner_a_id && f.partner_b_id && STAMMLINIEN.length >= 2 &&
      ((inL(f.partner_a_id, STAMMLINIEN[0].key) && inL(f.partner_b_id, STAMMLINIEN[1].key)) || (inL(f.partner_a_id, STAMMLINIEN[1].key) && inL(f.partner_b_id, STAMMLINIEN[0].key))));
    const jz = (p) => Number(String(p?.geburtsdatum || p?.geburtsjahr || "").slice(0, 4)) || 9999;
    r.linien = { zeilen, beide, ehen: ehen.map((f) => [P.get(f.partner_a_id), P.get(f.partner_b_id)]).filter(([a, b]) => a && b).sort((x, y) => Math.min(jz(x[0]), jz(x[1])) - Math.min(jz(y[0]), jz(y[1]))) };
  }

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
    karte("📅 Heute vor … Jahren", `<p class="chr-sub">${chrEsc(r.heuteText)}</p>` + (() => { try { const t = tagesMonatTag(); const nt = NAMENSTAGE[t.md]; return mondZeileHtml(MOND.tag(t.jahr, t.monat, t.tag)) + (nt ? `<p class="tb-namenstag">😇 <strong>Namenstag:</strong> ${chrEsc(nt[1].slice(0, 4).join(", "))} <span class="tb-klein">(${chrEsc(nt[0])})</span></p>` : ""); } catch { return ""; } })() + (r.heute.length ? liste(r.heute, (x) => `<b>${x.jahr}</b> · vor ${new Date().getFullYear() - x.jahr} Jahren ${x.art === "geheiratet" ? `heirateten ${chrLink(x.p)} und ${chrLink(x.p2)}` : `${x.art === "geboren" ? "wurde" : "starb"} ${chrLink(x.p)}${x.art === "geboren" ? " geboren" : ""}`}`) : `<p class="chr-leer">Heute gibt es im Bestand keinen Geburts-, Todes- oder Hochzeitstag.</p>`), "chr-breit"),
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
    karte("💔 Schicksalsschläge", r.schicksal.length ? `<p class="chr-sub">Familien, die besonders viele Verluste in kurzer Zeit erlebten – automatisch aus den Lebensdaten ermittelt (Kinder unter 15 Jahren, früher Tod eines Elternteils, Häufung von Todesfällen).</p>
      ${r.schicksal.map((g) => {
        const jahr = (t) => t.getFullYear();
        const alterTxt = (a) => a < 1 ? (a * 12 < 1 ? "wenige Tage alt" : `${Math.max(1, Math.round(a * 12))} Monate alt`) : (Math.floor(a) === 1 ? "1 Jahr alt" : `${Math.floor(a)} Jahre alt`);
        const zeilen = g.ereignisse.map((e) => e.art === "kind"
          ? `<li><b>${jahr(e.t)}</b> stirbt ${chrFrau(e.p) ? "Tochter" : "Sohn"} ${chrLink(e.p)}, ${alterTxt(e.alter)}</li>`
          : `<li><b>${jahr(e.t)}</b> stirbt ${e.art === "vater" ? "der Vater" : "die Mutter"} ${chrLink(e.p)}${e.kleine ? ` – ${e.kleine === 1 ? "ein Kind ist" : `${e.kleine} Kinder sind`} noch unter 15` : ""}</li>`).join("");
        return `<div class="chr-schicksal"><h4>${g.vater ? chrLink(g.vater) : "?"} ∞ ${g.mutter ? chrLink(g.mutter) : "?"}</h4>
          <p class="chr-sub">${g.ks.length} Kinder, davon ${g.kinderTot} vor dem 15. Geburtstag gestorben</p><ol class="chr-liste chr-zeitlinie">${zeilen}</ol></div>`;
      }).join("")}` : `<p class="chr-leer">Keine auffälligen Häufungen gefunden.</p>`, "chr-breit"),
    r.linien && r.linien.zeilen.length ? karte("🌳 Stammlinien", `${r.linien.zeilen.map((x) => `<h4><span class="linie-badge linie-${x.l.key}">${chrEsc(x.l.kurz)}</span> ${chrEsc(x.l.name)}</h4>
      <p>Gründer ${chrLink(x.g)} · <b>${chrZahl(x.n - 1)}</b> Nachkommen im Bestand, davon <b>${chrZahl(Math.max(0, x.mann - 1))}</b> im Mannesstamm · ${x.gen} Generationen${x.juengste ? ` · jüngste: ${chrLink(x.juengste)}` : ""}</p>`).join("")}
      <p class="chr-sub">${chrZahl(r.linien.beide)} Personen stammen aus beiden Linien.</p>
      ${r.linien.ehen.length ? `<h4>Ehen zwischen den Linien</h4>${liste(r.linien.ehen.slice(0, 8), ([a, b]) => `${chrLink(a)} ∞ ${chrLink(b)}`)}` : ""}`) : "",
    karte("🧬 Verwandtschaft", `<p><b>${chrZahl(r.verbund.groesste)} von ${chrZahl(z.personen)}</b> Personen (${chrRund(100 * r.verbund.groesste / Math.max(1, z.personen), 0)} %) sind über Eltern, Kinder und Ehen miteinander verbunden.</p>
      <p class="chr-sub">Daneben gibt es ${r.verbund.inseln} getrennte „Inseln“, davon ${r.verbund.einzeln} einzelne Personen ohne jede Verbindung.</p>
      <h4>Stammeltern mit den meisten Nachkommen im Bestand</h4>${liste(r.stammeltern, (x) => `${chrLink(x.p)} – <b>${chrZahl(x.n)}</b> Nachkommen`)}`),
    karte("📜 Zeitgeschehen", `<p class="chr-sub">Was zur Zeit deiner Vorfahren geschah – ⛪ markiert Einträge aus der Dorfchronik Bartholomäberg. Dazu die Zahl der Personen aus dem Bestand, die damals lebten.</p>
      <ol class="chr-zeit">${r.zeit.map((x) => `<li${x.quelle === "B" ? ' class="chr-ort"' : ""}><b>${x.jahr}</b> ${x.quelle === "B" ? '<span class="chr-ortmarke">⛪ Bartholomäberg</span> ' : ""}${chrEsc(x.text)}<small>${x.lebend === 1 ? "1 Person lebte" : `${x.lebend} Personen lebten`}${x.geboren.length ? ` · geboren: ${x.geboren.slice(0, 4).map(chrLink).join(", ")}${x.geboren.length > 4 ? ` und ${x.geboren.length - 4} weitere` : ""}` : ""}</small></li>`).join("")}</ol>`, "chr-breit")
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
  return ZEITGESCHEHEN.filter(([j]) => j >= g && j <= t).map(([j, text, quelle]) => ({ jahr: j, text, quelle, alter: j - g }));
}
function zeigeZeitgeschehen(person) {
  const sec = document.getElementById("pv-zeit-section");
  const liste = document.getElementById("pv-zeit-list");
  if (!sec || !liste) return;
  const ev = zeitgeschehenFuerPerson(person);
  sec.hidden = !ev.length;
  if (!ev.length) { liste.innerHTML = ""; return; }
  const sichtbar = 6;
  liste.innerHTML = ev.map((e, i) => `<li${i >= sichtbar ? " hidden" : ""}><b>${e.jahr}</b>${e.alter === 0 ? " · im Geburtsjahr" : ` · mit ${e.alter} Jahren`}<span>${e.quelle === "B" ? "⛪ " : ""}${chrEsc(e.text)}</span></li>`).join("") +
    (ev.length > sichtbar ? `<li class="pv-zeit-mehr"><button type="button" class="btn btn--ghost">Alle ${ev.length} Ereignisse zeigen</button></li>` : "");
  liste.querySelector(".pv-zeit-mehr button")?.addEventListener("click", (e) => {
    liste.querySelectorAll("li[hidden]").forEach((li) => { li.hidden = false; });
    e.currentTarget.closest("li").remove();
  });
}

/* ===================== v419: Tagesblatt – Mondkalender, Namenstage, Bauernregeln ===================== */
// Mondkalender – Berechnung nach P. Schlyter (Störungsterme nach Meeus/Brown), Genauigkeit etwa 1–2 Bogenminuten.
// Tierkreis tropisch (wie Vorarlberger Schreib-Kalender), Ort Bartholomäberg.
const MOND = (() => {
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const rev = (x) => x - Math.floor(x / 360) * 360;
  const sind = (x) => Math.sin(x * RAD), cosd = (x) => Math.cos(x * RAD);
  const ZEICHEN = [
    ["Widder", "♈", "Feuer"], ["Stier", "♉", "Erde"], ["Zwillinge", "♊", "Luft"], ["Krebs", "♋", "Wasser"],
    ["Löwe", "♌", "Feuer"], ["Jungfrau", "♍", "Erde"], ["Waage", "♎", "Luft"], ["Skorpion", "♏", "Wasser"],
    ["Schütze", "♐", "Feuer"], ["Steinbock", "♑", "Erde"], ["Wassermann", "♒", "Luft"], ["Fische", "♓", "Wasser"],
  ];
  const TAGESART = { Feuer: "Wärmetag · Fruchttag", Erde: "Kältetag · Wurzeltag", Luft: "Luft-/Lichttag · Blütetag", Wasser: "Wassertag · Blatttag" };
  const ORT = { breite: 47.087, laenge: 9.909 };   // Bartholomäberg
  const tage = (date) => date.getTime() / 86400000 + 2440587.5 - 2451543.5;   // d nach Schlyter (UT)
  function sonne(d) {
    const w = 282.9404 + 4.70935e-5 * d, e = 0.016709 - 1.151e-9 * d, M = rev(356.0470 + 0.9856002585 * d);
    const E = M + e * DEG * sind(M) * (1 + e * cosd(M));
    const xv = cosd(E) - e, yv = Math.sqrt(1 - e * e) * sind(E);
    const v = Math.atan2(yv, xv) * DEG;
    return { lon: rev(v + w), M, L: rev(M + w) };
  }
  function mond(d) {
    const N = 125.1228 - 0.0529538083 * d, i = 5.1454, w = 318.0634 + 0.1643573223 * d, a = 60.2666, e = 0.0549;
    const M = rev(115.3654 + 13.0649929509 * d);
    let E = M + e * DEG * sind(M) * (1 + e * cosd(M));
    for (let k = 0; k < 5; k++) E = E - (E - e * DEG * sind(E) - M) / (1 - e * cosd(E));
    const xv = a * (cosd(E) - e), yv = a * Math.sqrt(1 - e * e) * sind(E);
    const v = Math.atan2(yv, xv) * DEG, r = Math.hypot(xv, yv);
    const xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
    const yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
    const zh = r * sind(v + w) * sind(i);
    let lon = Math.atan2(yh, xh) * DEG, lat = Math.atan2(zh, Math.hypot(xh, yh)) * DEG, dist = r;
    const s = sonne(d), Ms = s.M, Ls = s.L, Lm = rev(M + w + N), D = Lm - Ls, F = Lm - N;
    lon += -1.274 * sind(M - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) - 0.059 * sind(2 * M - 2 * D) - 0.057 * sind(M - 2 * D + Ms)
      + 0.053 * sind(M + 2 * D) + 0.046 * sind(2 * D - Ms) + 0.041 * sind(M - Ms) - 0.035 * sind(D) - 0.031 * sind(M + Ms)
      - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(M - 4 * D);
    lat += -0.173 * sind(F - 2 * D) - 0.055 * sind(M - F - 2 * D) - 0.046 * sind(M + F - 2 * D) + 0.033 * sind(F + 2 * D) + 0.017 * sind(2 * M + F);
    dist += -0.58 * cosd(M - 2 * D) - 0.46 * cosd(2 * D);
    return { lon: rev(lon), lat, dist, sonne: s };
  }
  function hoehe(lon, lat, d, date, istMond, dist) {
    const ecl = 23.4393 - 3.563e-7 * d;
    const x = cosd(lon) * cosd(lat), y = sind(lon) * cosd(lat), z = sind(lat);
    const ye = y * cosd(ecl) - z * sind(ecl), ze = y * sind(ecl) + z * cosd(ecl);
    const ra = Math.atan2(ye, x) * DEG, dec = Math.atan2(ze, Math.hypot(x, ye)) * DEG;
    const ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const lst = rev(sonne(d).L + 180 + ut * 15 + ORT.laenge);
    const ha = lst - ra;
    let h = Math.asin(sind(ORT.breite) * sind(dec) + cosd(ORT.breite) * cosd(dec) * cosd(ha)) * DEG;
    if (istMond) h -= Math.asin(1 / dist) * DEG * cosd(h);   // Parallaxe
    return h;
  }
  const hMond = (date) => { const d = tage(date), m = mond(d); return hoehe(m.lon, m.lat, d, date, true, m.dist); };
  const hSonne = (date) => { const d = tage(date), s = sonne(d); return hoehe(s.lon, 0, d, date, false); };
  // Mitternacht des Kalendertags in Wien
  function tagesBeginn(jahr, monat, tag) {
    let t = Date.UTC(jahr, monat - 1, tag, 0, 0);
    const off = (dt) => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vienna", hour: "2-digit", hourCycle: "h23", day: "2-digit" }).formatToParts(dt); const h = +p.find((x) => x.type === "hour").value; const dd = +p.find((x) => x.type === "day").value; return dd === tag ? h : h - 24; };
    return new Date(t - off(new Date(t)) * 3600000);
  }
  function durchgaenge(fn, start, h0) {
    const auf = [], unter = []; const schritt = 10 * 60000;
    let t0 = start.getTime(), v0 = fn(new Date(t0)) - h0;
    for (let t = t0 + schritt; t <= t0 + 86400000; t += schritt) {
      const v = fn(new Date(t)) - h0;
      if ((v0 < 0) !== (v < 0)) {
        let a = t - schritt, b = t, va = v0;
        for (let k = 0; k < 12; k++) { const m = (a + b) / 2, vm = fn(new Date(m)) - h0; if ((va < 0) === (vm < 0)) { a = m; va = vm; } else b = m; }
        (v0 < 0 ? auf : unter).push(new Date((a + b) / 2));
      }
      v0 = v;
    }
    return { auf: auf[0] || null, unter: unter[0] || null };
  }
  const BILD = ["🐏", "🐂", "👬", "🦀", "🦁", "🌾", "⚖️", "🦂", "🏹", "🐐", "🏺", "🐟"];   // v420: bildhafte Zeichen wie im Kalender
  function zeichenVon(lon) { const i = Math.floor(lon / 30), z = ZEICHEN[i]; return { name: z[0], symbol: z[1] + "\uFE0E", bild: BILD[i], element: z[2], art: TAGESART[z[2]] }; }
  function phase(date) { const m = mond(tage(date)); return rev(m.lon - m.sonne.lon); }   // 0 = Neumond, 180 = Vollmond
  function tag(jahr, monat, tagNr) {
    const beginn = tagesBeginn(jahr, monat, tagNr), ende = new Date(beginn.getTime() + 86400000);
    const mittag = new Date(beginn.getTime() + 12 * 3600000);
    const m = mond(tage(mittag));
    const z = zeichenVon(m.lon);
    // Zeichenwechsel innerhalb des Tages
    let wechsel = null;
    const zA = Math.floor(mond(tage(beginn)).lon / 30), zE = Math.floor(mond(tage(ende)).lon / 30);
    if (zA !== zE) {
      let a = beginn.getTime(), b = ende.getTime();
      for (let k = 0; k < 30; k++) { const c = (a + b) / 2; if (Math.floor(mond(tage(new Date(c))).lon / 30) === zA) a = c; else b = c; }
      wechsel = { zeit: new Date(b), nach: zeichenVon(zE * 30 + 1), von: zeichenVon(zA * 30 + 1) };
    }
    // Neumond/Vollmond an diesem Tag?
    let ereignis = null;
    const pA = phase(beginn), pE = phase(ende);
    const kreuzt = (ziel) => { const a = rev(pA - ziel + 180) - 180, b = rev(pE - ziel + 180) - 180; return a < 0 && b >= 0; };
    if (kreuzt(0)) ereignis = "Neumond"; else if (kreuzt(180)) ereignis = "Vollmond";
    const p = phase(mittag);
    const zunehmend = p < 180;
    const aufsteigend = m.lon >= 270 || m.lon < 90;   // Steinbock … Zwillinge
    const mz = durchgaenge(hMond, beginn, 0.125 - 0.583 - 0.27 + 0.27);   // Oberrand, Refraktion
    const sz = durchgaenge(hSonne, beginn, -0.833);
    const beleuchtet = Math.round((1 - Math.cos(p * RAD)) / 2 * 100);
    return { zeichen: z, wechsel, ereignis, zunehmend, aufsteigend, beleuchtet, mondAuf: mz.auf, mondUnter: mz.unter, sonneAuf: sz.auf, sonneUnter: sz.unter, laenge: m.lon };
  }
  return { tag, ZEICHEN, phase, mondLaenge: (date) => mond(tage(date)).lon };
})();
// Namenstage: Hauptfest des Namenspatrons nach dem katholischen Kalender in Österreich (je Name ein Tag).
// Schlüssel "MM-TT" -> [Patron, [Vornamen-Varianten im Bestand]]
const NAMENSTAGE = {
  "01-02": ["hl. Basilius", ["Basilius"]],
  "01-03": ["hl. Genovefa", ["Genovefa", "Genoveva"]],
  "01-06": ["hl. Kaspar (Dreikönig)", ["Kaspar"]],
  "01-08": ["hl. Severin", ["Severin"]],
  "01-13": ["hl. Hilarius", ["Hilar", "Hilarius"]],
  "01-20": ["hl. Sebastian", ["Sebastian"]],
  "01-21": ["hl. Agnes", ["Agnes"]],
  "01-26": ["hl. Paula", ["Paula", "Paulina", "Pauline"]],
  "01-27": ["hl. Angela Merici", ["Angela"]],
  "01-30": ["hl. Martina", ["Martina"]],
  "02-01": ["hl. Brigida", ["Brigitte", "Brigitta", "Birgith"]],
  "02-03": ["hl. Ansgar · hl. Blasius", ["Oskar"]],
  "02-05": ["hl. Agatha", ["Agatha", "Agathe"]],
  "02-06": ["hl. Dorothea", ["Dorothea", "Dora"]],
  "02-09": ["hl. Apollonia", ["Apollonia"]],
  "02-24": ["hl. Matthias", ["Matthias", "Mathias", "Mathies"]],
  "02-25": ["hl. Walburga", ["Walburga"]],
  "02-26": ["hl. Edigna", ["Edigna"]],
  "03-04": ["hl. Kasimir", ["Kasimir"]],
  "03-06": ["hl. Fridolin", ["Fridolin", "Fridolina"]],
  "03-07": ["hl. Felizitas", ["Felizitas", "Filizitas"]],
  "03-09": ["hl. Franziska von Rom", ["Franziska", "Francisca"]],
  "03-11": ["hl. Rosina", ["Rosina", "Rosi"]],
  "03-14": ["hl. Mathilde", ["Mathilda", "Mathilde"]],
  "03-15": ["hl. Longinus · hl. Luise", ["Longinus", "Luise", "Louise"]],
  "03-17": ["hl. Gertrud", ["Gertrud"]],
  "03-19": ["hl. Josef", ["Josef", "Josefa", "Josefine", "Josefina", "Josepha", "Josephine", "Pepi"]],
  "04-04": ["hl. Isidor von Sevilla", []],
  "04-05": ["hl. Crescentia", ["Kreszenz", "Kreszenzia", "Creszenz", "Creszenzia", "Kresenza"]],
  "04-11": ["hl. Stanislaus", ["Stanislaus"]],
  "04-14": ["hl. Lidwina", ["Ludwina"]],
  "04-16": ["hl. Bernadette", ["Bernadette"]],
  "04-23": ["hl. Georg · hl. Adalbert", ["Georg", "Adalbert"]],
  "04-24": ["hl. Fidelis von Sigmaringen", ["Fidel", "Fidelis", "Fidelius"]],
  "04-25": ["hl. Markus", ["Markus", "Marko"]],
  "04-27": ["hl. Zita", ["Zitta", "Zita"]],
  "05-03": ["hl. Philippus und Jakobus", ["Philipp"]],
  "05-04": ["hl. Florian", ["Florian"]],
  "05-07": ["sel. Gisela", ["Gisela"]],
  "05-15": ["hl. Isidor der Bauer · hl. Sophie", ["Isidor", "Sophie", "Sofie", "Sophia"]],
  "05-16": ["hl. Johannes Nepomuk", ["Nepomuk"]],
  "05-19": ["hl. Cölestin", ["Cölestina", "Cälestine", "Zölestin"]],
  "05-22": ["hl. Rita", ["Rita", "Ritta"]],
  "05-25": ["hl. Urban", ["Urban"]],
  "05-30": ["hl. Ferdinand · hl. Johanna", ["Ferdinand", "Johanna"]],
  "06-06": ["hl. Norbert", ["Norbert"]],
  "06-13": ["hl. Antonius von Padua", ["Anton", "Antonius", "Antonia"]],
  "06-16": ["hl. Benno", ["Benno"]],
  "06-21": ["hl. Aloisius", ["Alois", "Aloisia"]],
  "06-24": ["hl. Johannes der Täufer", ["Johann", "Johannes", "Hans", "Hansi", "Baptist"]],
  "06-29": ["hl. Petrus und Paulus", ["Peter", "Paul"]],
  "06-30": ["hl. Otto", ["Otto", "Ottokar"]],
  "07-03": ["hl. Thomas", ["Thomas"]],
  "07-04": ["hl. Ulrich", ["Ulrich"]],
  "07-08": ["hl. Kilian", ["Kilian"]],
  "07-11": ["hl. Benedikt", ["Benedikt", "Benedikta"]],
  "07-13": ["hl. Heinrich", ["Heinrich", "Heinz", "Heini"]],
  "07-15": ["hl. Egon", ["Egon"]],
  "07-20": ["hl. Margareta · hl. Elias", ["Margareth", "Margarethe", "Margaret", "Margret", "Margit", "Elias"]],
  "07-22": ["hl. Maria Magdalena", ["Magdalena"]],
  "07-24": ["hl. Christophorus · hl. Christina", ["Christoph", "Christine", "Christina"]],
  "07-25": ["hl. Jakobus", ["Jakob"]],
  "07-26": ["hl. Anna und Joachim", ["Anna", "Joachim", "Anitta", "Marianne"]],
  "07-29": ["hl. Martha", ["Martha", "Marta"]],
  "07-31": ["hl. Ignatius von Loyola", ["Ignaz"]],
  "08-01": ["hl. Alfons", ["Alfons"]],
  "08-03": ["hl. Lydia", ["Lydia", "Lidya"]],
  "08-05": ["hl. Oswald", ["Oswald"]],
  "08-07": ["hl. Afra", ["Afra"]],
  "08-08": ["hl. Dominikus", ["Dominikus", "Dominique"]],
  "08-10": ["hl. Laurentius", ["Lorenz"]],
  "08-11": ["hl. Susanna · hl. Philomena", ["Susanna", "Philomena"]],
  "08-18": ["hl. Helena", ["Helena", "Helene"]],
  "08-20": ["hl. Bernhard", ["Bernhard"]],
  "08-21": ["hl. Pius X.", ["Pius"]],
  "08-23": ["hl. Rosa von Lima · hl. Philipp Benizi", ["Rosa", "Benizi"]],
  "08-24": ["hl. Bartholomäus, Patrozinium Bartholomäberg", ["Bartholomä", "Bartholomäus", "Bartholmäus", "Bartle", "Bartel"]],
  "08-25": ["hl. Ludwig", ["Ludwig"]],
  "08-27": ["hl. Monika · hl. Gebhard", ["Monika", "Gebhard"]],
  "08-28": ["hl. Augustinus", ["Augustin", "Augustine"]],
  "08-29": ["hl. Sabina", ["Sabina", "Sabine"]],
  "09-04": ["hl. Rosalia · hl. Ida", ["Rosalia", "Ida"]],
  "09-06": ["hl. Magnus", ["Magnus"]],
  "09-07": ["hl. Regina", ["Regina"]],
  "09-12": ["Mariä Namen", ["Maria", "Marie"]],
  "09-13": ["hl. Notburga · hl. Tobias", ["Notburga", "Tobias"]],
  "09-16": ["hl. Edith", ["Edith"]],
  "09-17": ["hl. Hildegard · hl. Robert", ["Hildegard", "Hildegart", "Hilde", "Robert"]],
  "09-21": ["hl. Matthäus", ["Mathäus", "Matthäus"]],
  "09-22": ["hl. Mauritius", ["Mauritius", "Maurizi"]],
  "09-24": ["hl. Rupert", ["Rupert"]],
  "09-29": ["hl. Michael", ["Michael", "Michaela", "Micheal"]],
  "09-30": ["hl. Hieronymus", ["Hieronymus"]],
  "10-04": ["hl. Franz von Assisi", ["Franz"]],
  "10-09": ["hl. Dionysius", ["Dionysius"]],
  "10-13": ["hl. Eduard", ["Eduard"]],
  "10-15": ["hl. Theresia von Ávila", ["Theresia", "Theres", "Therese", "Theresa"]],
  "10-16": ["hl. Hedwig", ["Hedwig"]],
  "10-20": ["hl. Wendelin", ["Wendelin"]],
  "10-21": ["hl. Ursula", ["Ursula"]],
  "10-22": ["hl. Salome", ["Salome"]],
  "10-31": ["hl. Wolfgang", ["Wolfgang"]],
  "11-03": ["hl. Hubert", ["Hubert"]],
  "11-04": ["hl. Karl Borromäus", ["Karl"]],
  "11-05": ["hl. Emmerich", ["Emerich", "Emmerich"]],
  "11-07": ["hl. Engelbert", ["Engelbert"]],
  "11-08": ["hl. Gottfried", ["Gottfried"]],
  "11-10": ["hl. Leo", ["Leo"]],
  "11-11": ["hl. Martin", ["Martin"]],
  "11-12": ["hl. Kunibert", ["Kunibert"]],
  "11-15": ["hl. Leopold · hl. Albert", ["Leopoldine", "Albert", "Albertina"]],
  "11-16": ["hl. Otmar", ["Otmar", "Ottmar"]],
  "11-17": ["hl. Florinus", ["Florinus"]],
  "11-19": ["hl. Elisabeth von Thüringen", ["Elisabeth"]],
  "11-20": ["hl. Edmund", ["Edmund"]],
  "11-22": ["hl. Cäcilia", ["Cäcilia", "Cäzilia", "Cilli"]],
  "11-25": ["hl. Katharina", ["Katharina"]],
  "11-26": ["hl. Konrad von Konstanz", ["Konrad"]],
  "11-30": ["hl. Andreas", ["Andreas", "Andrea"]],
  "12-03": ["hl. Franz Xaver", ["Xaver"]],
  "12-04": ["hl. Barbara", ["Barbara"]],
  "12-06": ["hl. Nikolaus", ["Nikolaus", "Klaus"]],
  "12-13": ["hl. Odilia · hl. Luzia", ["Ottilie"]],
  "12-16": ["hl. Adelheid", ["Adelheid"]],
  "12-23": ["hl. Viktoria", ["Viktoria"]],
  "12-26": ["hl. Stephanus", ["Stephan", "Stefan"]],
  "12-31": ["hl. Silvester · hl. Melanie", ["Silvester", "Melanie"]],
};
const BAUERNREGELN = {
  "01-06": "Ist bis Dreikönig kein Winter, kommt keiner mehr dahinter.",
  "01-20": "Fabian und Sebastian lassen Saft in die Bäume gahn.",
  "02-02": "Lichtmess: Ist's an Lichtmess hell und rein, wird's ein langer Winter sein.",
  "02-24": "Matthias bricht's Eis – hat er keins, so macht er eins.",
  "03-19": "Ist's am Josefstag schön, kann's nur gut weitergehn.",
  "04-23": "Georgi: Ist's an Georgi warm und schön, wird man noch rauhes Wetter sehn.",
  "05-04": "Florian: Der Florian, der Florian noch einen Schneehut tragen kann.",
  "05-12": "Eisheilige (Pankratius, Servatius, Bonifatius, 12.–14. Mai) – vorher ist nichts sicher vor Frost.",
  "05-15": "Die kalte Sophie macht alles hie.",
  "05-25": "Wie's Wetter am Urbanstag, so's im Herbst noch kommen mag.",
  "06-24": "Vor Johanni bitt um Regen, nachher kommt er ungelegen.",
  "06-27": "Siebenschläfer: Wie das Wetter am Siebenschläfertag, so es sieben Wochen bleiben mag.",
  "07-25": "Ist's zu Jakobi schön und warm, hat man im Winter Kält und Harm.",
  "08-10": "Laurentius: Ist es hell am Lorenztag, viel Frucht man sich versprechen mag.",
  "08-15": "Mariä Himmelfahrt: Hat Unsere Frau gut Wetter, wenn sie zum Himmel fährt, gutes Wetter sie uns bis Mariä Geburt beschert.",
  "08-24": "Bartholomä: Wie Bartholomä sich hält, so ist der ganze Herbst bestellt.",
  "09-08": "Mariä Geburt – fliegen die Schwalben furt.",
  "09-29": "Michaeli: Regnet's an Michaeli ohne Gewitter, kommt ein milder Winter hinterher.",
  "10-16": "Hedwig: Ist Sankt Hedwig sonnig und klar, folgt ein sanfter Winter dieses Jahr.",
  "10-28": "Simon und Judä – hängt an die Stauden Schnee.",
  "11-11": "Martini: Wenn um Martini Nebel sind, wird der Winter meist gelind.",
  "11-25": "Kathrein stellt den Tanz ein.",
  "11-30": "Andreasschnee tut dem Korn weh.",
  "12-04": "Barbara im Klee – Weihnachten im Schnee.",
  "12-13": "Luzia: Sankt Luzen macht den Tag stutzen.",
  "12-21": "Thomas: Sankt Thomas bringt die längste Nacht.",
};
function tagesMonatTag(datum = new Date()) {
  const t = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(datum);
  const g = (x) => +t.find((p) => p.type === x).value;
  return { jahr: g("year"), monat: g("month"), tag: g("day"), md: `${String(g("month")).padStart(2, "0")}-${String(g("day")).padStart(2, "0")}` };
}
function chrVermutlichLebend(p) {
  if (!p || p.sterbedatum || p.sterbejahr) return false;
  const j = chrGebJahr(p);
  return !!j && j >= new Date().getFullYear() - 105;
}
const chrUhr = (d) => d ? d.toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" }) : "–";
function mondZeileHtml(m) {   // v420: Symbole wie im Vorarlberger Kalender, jeweils mit Text
  const phase = m.ereignis === "Neumond" ? ["●", "Neumond"] : m.ereignis === "Vollmond" ? ["○", "Vollmond"] : m.zunehmend ? ["☽\uFE0E", "zunehmender Mond"] : ["☾\uFE0E", "abnehmender Mond"];
  const bahn = m.aufsteigend ? ["◡", "aufsteigender Mond (obsigend)"] : ["⌒", "absteigender Mond (nidsigend)"];
  const zeile = (sym, text, klasse = "") => `<div class="tb-mz ${klasse}"><span class="tb-mz__sym" aria-hidden="true">${sym}</span><span>${text}</span></div>`;
  const wechsel = m.wechsel ? `<br><span class="tb-klein">ab ${chrUhr(m.wechsel.zeit)} Uhr im <strong>${chrEsc(m.wechsel.nach.name)}</strong> ${m.wechsel.nach.bild} – ${chrEsc(m.wechsel.nach.art)}</span>` : "";
  return `<div class="tb-mond">
    ${zeile(phase[0], `<strong>${phase[1]}</strong>`)}
    ${zeile(bahn[0], bahn[1])}
    ${zeile(m.zeichen.bild, `Mond im <strong>${chrEsc(m.zeichen.name)}</strong> <span class="tb-glyph">${m.zeichen.symbol}</span> – ${chrEsc(m.zeichen.art)}${wechsel}`)}
    ${zeile("🌙", `Mondaufgang ${chrUhr(m.mondAuf)} · Monduntergang ${chrUhr(m.mondUnter)}`, "tb-mz--klein")}
    ${zeile("☀️", `Sonnenaufgang ${chrUhr(m.sonneAuf)} · Sonnenuntergang ${chrUhr(m.sonneUnter)} <span class="tb-ort">(Bartholomäberg)</span>`, "tb-mz--klein")}
  </div>`;
}
// Ganzes Tagesblatt. opt: { leser: bool, ich: {id,name}|null, beziehung: (personId) => "Urgroßmutter"|null }
function tagesblattAuswerten(d, opt = {}) {
  const heute = tagesMonatTag();
  const r = { datum: heute, mond: MOND.tag(heute.jahr, heute.monat, heute.tag) };
  const nt = NAMENSTAGE[heute.md];
  if (nt) {
    const namen = new Set(nt[1]);
    const traeger = d.personen.filter((p) => String(p.vorname || "").split(/\s+/).some((t) => namen.has(t)));
    r.namenstag = { patron: nt[0], namen: nt[1], anzahl: traeger.length,
      verwandte: opt.beziehung ? traeger.map((p) => ({ p, rel: opt.beziehung(p.id) })).filter((x) => x.rel).slice(0, 3) : [] };
  }
  r.regel = BAUERNREGELN[heute.md] || null;
  const P = new Map(d.personen.map((p) => [p.id, p]));
  const ereignisse = [];
  const md = heute.md;
  const am = (v) => v && String(v).slice(5, 10) === md;
  for (const p of d.personen) {
    if (am(p.geburtsdatum)) ereignisse.push({ art: "geboren", p, jahr: chrJahr(p.geburtsdatum) });
    if (am(p.sterbedatum)) ereignisse.push({ art: "gestorben", p, jahr: chrJahr(p.sterbedatum) });
  }
  for (const f of d.familien) if (f.partner_a_id && f.partner_b_id && String(f.familientyp || "").toLowerCase() !== "eltern" && am(f.beginn))
    ereignisse.push({ art: "geheiratet", p: P.get(f.partner_a_id), p2: P.get(f.partner_b_id), jahr: chrJahr(f.beginn) });
  r.ereignisse = ereignisse.filter((x) => x.p && x.jahr && x.jahr <= heute.jahr)
    .filter((x) => !(opt.leser && x.art === "geboren" && chrVermutlichLebend(x.p)))   // Geburtstage Lebender nicht für Leser
    .map((x) => {
      const jahre = heute.jahr - x.jahr;
      const rund = jahre > 0 && (jahre % 25 === 0 || (jahre >= 100 && jahre % 50 === 0));
      const rel = opt.beziehung ? (opt.beziehung(x.p.id) || (x.p2 ? opt.beziehung(x.p2.id) : null)) : null;
      return { ...x, jahre, rund, rel };
    })
    .sort((a, b) => a.jahr - b.jahr);
  return r;
}
function tagesblattHtml(r) {
  const datum = new Date(Date.UTC(r.datum.jahr, r.datum.monat - 1, r.datum.tag, 12)).toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const hochzeit = (j) => j === 25 ? " (Silberne Hochzeit)" : j === 50 ? " (Goldene Hochzeit)" : j === 60 ? " (Diamantene Hochzeit)" : j === 65 ? " (Eiserne Hochzeit)" : "";
  const zeile = (x) => {
    const [icon, art] = x.art === "geheiratet" ? ["💍", "Hochzeitstag"] : x.art === "geboren" ? ["🎂", "Geburtstag"] : ["🕯️", "Todestag"];
    const wer = x.art === "geheiratet" ? `${chrLink(x.p)} und ${chrLink(x.p2)}${hochzeit(x.jahre)}` : chrLink(x.p);
    return `<li><span class="tb-icon" aria-hidden="true">${icon}</span><span><strong>${art}</strong> · heute vor ${x.jahre} Jahren (${x.jahr}): ${wer}</span></li>`;
  };
  const nt = r.namenstag;
  return `<p class="tb-datum">${chrEsc(datum)}</p>
    ${mondZeileHtml(r.mond)}
    ${nt ? `<p class="tb-namenstag">😇 <strong>Namenstag:</strong> ${chrEsc(nt.namen.slice(0, 4).join(", "))} <span class="tb-klein">(${chrEsc(nt.patron)})</span>${nt.anzahl ? ` · ${chrZahl(nt.anzahl)} ${nt.anzahl === 1 ? "Person" : "Personen"} im Bestand` : ""}</p>` : ""}
    ${r.regel ? `<p class="tb-regel">🌾 <em>${chrEsc(r.regel)}</em></p>` : ""}
    <h3 class="tb-titel">Heute vor … Jahren</h3>
    ${r.ereignisse.length ? `<ul class="heute-liste tb-liste">${r.ereignisse.map(zeile).join("")}</ul>` : '<p class="tb-klein">Heute gibt es im Bestand keinen Geburts-, Todes- oder Hochzeitstag.</p>'}
    <p class="tb-hinweis">Mondangaben berechnet nach altem Mondkalender (Tierkreis wie im Vorarlberger Kalender) – überliefertes Brauchtum, keine Empfehlung.</p>`;
}
