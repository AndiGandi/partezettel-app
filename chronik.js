// Familienspuren – Chronik & Statistik (v381)
// Rechnet alle Auswertungen direkt aus der Datenbank (keine KI). Wird nach den App-Dateien (js/…) geladen
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
  [1910, "14./15. Juni: Jahrhunderthochwasser – im Montafon werden alle Brücken weggerissen, die Ill zerstört zwei Drittel der Montafonerbahn, Teile von Schruns werden evakuiert; in Vandans denkt man sogar an eine Aussiedlung nach Bosnien"],
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
// v443: gelesene Daten merken – die Chronik fragt dieselben Daten zehntausendfach ab
const chrDatumCache = new Map();
const chrDatum = (v) => {
  if (!v) return null;
  const k = String(v).slice(0, 10);
  let d = chrDatumCache.get(k);
  if (d === undefined) { d = new Date(`${k}T00:00:00`); if (isNaN(d)) d = null; else Object.freeze(d); chrDatumCache.set(k, d); }
  return d;   // gemeinsames, nur lesbares Datum (wird nirgends verändert)
};
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
let chronikStand = 0;   // v460: Chronik neu laden, sobald sich Daten geändert haben (früher blieb sie bis „neu“ veraltet)
async function chronikDatenLaden(neu = false) {
  if (chronikCache && !neu && chronikStand === datenStand) return chronikCache;
  const standBeimLaden = datenStand;
  // v460: Familien und Kinder aus dem Bestand übernehmen, wenn dieser auf dem aktuellen Stand ist
  const ausBestand = typeof bestandAbgleichStand !== "undefined" && bestandAbgleichStand === datenStand
    && Array.isArray(familienAuswahlCache) && familienAuswahlCache.length > 0 && Array.isArray(familienKinderAuswahlCache) && familienKinderAuswahlCache.length > 0;
  const [p, f, k, s, h] = await Promise.all([
    alleZeilenLaden(() => sb.from("personen").select("*").order("id")),
    ausBestand ? { data: familienAuswahlCache, error: null } : alleZeilenLaden(() => sb.from("familien").select("*").order("id")),
    ausBestand ? { data: familienKinderAuswahlCache, error: null } : alleZeilenLaden(() => sb.from("familien_kinder").select("id, familie_id, kind_id").order("id")),
    alleZeilenLaden(() => sb.from("person_stationen").select("id, personen_id, haus_id, art, jahr, sortierung").order("id")),
    alleZeilenLaden(() => sb.from("haeuser").select("*").order("id"))
  ]);
  for (const r of [p, f, k]) if (r.error) throw r.error;
  chronikCache = { personen: p.data || [], familien: f.data || [], kinder: k.data || [], stationen: s.error ? [] : (s.data || []), haeuser: h.error ? [] : (h.data || []), geladen: new Date() };
  chronikStand = standBeimLaden;
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
      // v434: Ehedauer nur, wenn von BEIDEN Partnern das Sterbedatum bekannt ist (sonst ist das Eheende unsicher)
      const ta = chrDatum(a.sterbedatum), tb = chrDatum(b.sterbedatum);
      const enden = [chrDatum(f.ende), ta, tb].filter((x) => x && x > beginn);
      const jungBeiHeirat = [a, b].some((x) => { const g = chrDatum(x.geburtsdatum); return g && chrJahre(g, beginn) < 16; });
      if (ta && tb && ta > beginn && tb > beginn && enden.length) eheDauer.push({ a, b, jahre: chrJahre(beginn, new Date(Math.min(...enden))), beginn, verdacht: jungBeiHeirat });
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
    const datumOderJahr = (w) => (w ? datumAnker(w, "geburt") : null);   // v459: Jahr → Jahresmitte, Monat → Monatsmitte
    const tod = (p) => datumOderJahr(todWert(p));
    const geb = (p) => datumOderJahr(gebWert(p));
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
    karte("📅 Heute vor … Jahren", `<p class="chr-sub">${chrEsc(r.heuteText)}</p>` + (() => { try { const t = tagesMonatTag(); return kirchenZeileHtml(kirchenjahrTag(t.jahr, t.monat, t.tag)) + mondZeileHtml(MOND.tag(t.jahr, t.monat, t.tag), MOND.ereignisse(t.jahr, t.monat, t.tag)) + namenstagZeileHtml(namenstagFuer(t.md)); } catch { return ""; } })() + (r.heute.length ? liste(r.heute, (x) => `<b>${x.jahr}</b> · vor ${new Date().getFullYear() - x.jahr} Jahren ${x.art === "geheiratet" ? `heirateten ${chrLink(x.p)} und ${chrLink(x.p2)}` : `${x.art === "geboren" ? "wurde" : "starb"} ${chrLink(x.p)}${x.art === "geboren" ? " geboren" : ""}`}`) : `<p class="chr-leer">Heute gibt es im Bestand keinen Geburts-, Todes- oder Hochzeitstag.</p>`), "chr-breit"),
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
    karte("💍 Längste Ehen", liste(r.ehen, (x) => `${chrLink(x.a)} und ${chrLink(x.b)} – <b>${Math.floor(x.jahre)} Jahre</b> (ab ${x.beginn.getFullYear()})${pruef(x)}`) + `<p class="chr-hinweis">Nur Ehen, bei denen Hochzeitsdatum und die Sterbedaten beider Partner bekannt sind.</p>`),
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

let chronikGezeichnet = "";   // v460: Datenstand + Tag der zuletzt gezeichneten Chronik
async function zeigeChronik(neu = false) {
  const ziel = document.getElementById("chronik-inhalt");
  const status = document.getElementById("chronik-status");
  if (!ziel) return;
  const zeichenSchluessel = () => `${chronikStand}|${datenStand}|${new Date().toDateString()}|${typeof zugang !== "undefined" ? zugang?.rolle : ""}`;
  if (!neu && chronikCache && chronikStand === datenStand && chronikGezeichnet === zeichenSchluessel() && ziel.children.length) return;   // unverändert: nicht neu rechnen
  if (status) status.textContent = "Wird berechnet …";
  try {
    const d = await chronikDatenLaden(neu);
    const r = chronikAuswerten(d);
    chronikRendern(r, ziel);
    chronikGezeichnet = zeichenSchluessel();
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
  // v464: Ereignisse eines Tages wie im Bauernkalender – Mondphasen (auch Viertel), „über sich“/„unter sich“
  // (tiefster/höchster Mondstand = Wende der Deklination), auf-/absteigender Knoten (Mond quert die Ekliptik),
  // Erdnähe/Erdferne (kleinster/größter Abstand), Sonne tritt in ein Tierkreiszeichen. Uhrzeiten auf die Minute gerechnet.
  function deklination(date) {
    const d = tage(date), m = mond(d), ecl = 23.4393 - 3.563e-7 * d;
    return Math.asin(sind(m.lat) * cosd(ecl) + cosd(m.lat) * sind(ecl) * sind(m.lon)) * DEG;
  }
  const breite = (date) => mond(tage(date)).lat;
  const abstand = (date) => mond(tage(date)).dist;
  const sonnenLaenge = (date) => sonne(tage(date)).lon;
  function nullstelle(fn, a, b) {   // fn(a), fn(b) mit verschiedenen Vorzeichen
    let fa = fn(a);
    for (let k = 0; k < 30; k++) { const m = (a + b) / 2, fm = fn(m); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
    return new Date((a + b) / 2);
  }
  const winkel = (x) => rev(x + 180) - 180;   // auf −180 … 180
  // Genaue Mondphase nach J. Meeus (Astronomical Algorithms, Kap. 49) – Genauigkeit etwa eine Minute.
  // viertel: 0 Neumond, 1 erstes Viertel, 2 Vollmond, 3 letztes Viertel; nahe = ungefährer Zeitpunkt
  function phaseGenau(viertel, nahe) {
    const jd = nahe.getTime() / 86400000 + 2440587.5;
    const k = Math.round((jd - 2451550.09766) / 29.530588861 - viertel / 4) + viertel / 4;
    const T = k / 1236.85;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
    const Mm = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
    const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
    const O = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
    const S = (x) => sind(x);
    let c;
    if (viertel === 0 || viertel === 2) {
      const v = viertel === 0;
      c = (v ? -0.4072 : -0.40614) * S(Mm) + (v ? 0.17241 : 0.17302) * E * S(M) + (v ? 0.01608 : 0.01614) * S(2 * Mm) + (v ? 0.01039 : 0.01043) * S(2 * F)
        + (v ? 0.00739 : 0.00734) * E * S(Mm - M) - (v ? 0.00514 : 0.00515) * E * S(Mm + M) + (v ? 0.00208 : 0.00209) * E * E * S(2 * M)
        - 0.00111 * S(Mm - 2 * F) - 0.00057 * S(Mm + 2 * F) + 0.00056 * E * S(2 * Mm + M) - 0.00042 * S(3 * Mm) + 0.00042 * E * S(M + 2 * F)
        + 0.00038 * E * S(M - 2 * F) - 0.00024 * E * S(2 * Mm - M) - 0.00017 * S(O) - 0.00007 * S(Mm + 2 * M) + 0.00004 * S(2 * Mm - 2 * F)
        + 0.00004 * S(3 * M) + 0.00003 * S(Mm + M - 2 * F) + 0.00003 * S(2 * Mm + 2 * F) - 0.00003 * S(Mm + M + 2 * F) + 0.00003 * S(Mm - M + 2 * F)
        - 0.00002 * S(Mm - M - 2 * F) - 0.00002 * S(3 * Mm + M) + 0.00002 * S(4 * Mm);
    } else {
      c = -0.62801 * S(Mm) + 0.17172 * E * S(M) - 0.01183 * E * S(Mm + M) + 0.00862 * S(2 * Mm) + 0.00804 * S(2 * F) + 0.00454 * E * S(Mm - M)
        + 0.00204 * E * E * S(2 * M) - 0.0018 * S(Mm - 2 * F) - 0.0007 * S(Mm + 2 * F) - 0.0004 * S(3 * Mm) - 0.00034 * E * S(2 * Mm - M)
        + 0.00032 * E * S(M + 2 * F) + 0.00032 * E * S(M - 2 * F) - 0.00028 * E * E * S(Mm + 2 * M) + 0.00027 * E * S(2 * Mm + M) - 0.00017 * S(O)
        - 0.00005 * S(Mm - M - 2 * F) + 0.00004 * S(2 * Mm + 2 * F) - 0.00004 * S(Mm + M + 2 * F) + 0.00004 * S(Mm - 2 * M) + 0.00003 * S(Mm + M - 2 * F)
        + 0.00003 * S(3 * M) + 0.00002 * S(2 * Mm - 2 * F) + 0.00002 * S(Mm - M + 2 * F) - 0.00002 * S(3 * Mm + M);
      const W = 0.00306 - 0.00038 * E * cosd(M) + 0.00026 * cosd(Mm) - 0.00002 * cosd(Mm - M) + 0.00002 * cosd(Mm + M) + 0.00002 * cosd(2 * F);
      c += viertel === 1 ? W : -W;
    }
    jde += c;
    const deltaT = 69 + 0.4 * (new Date(nahe).getUTCFullYear() - 2025);   // Sekunden (TT → UT), Näherung
    return new Date((jde - 2440587.5) * 86400000 - deltaT * 1000);
  }
  // Scheinbare Sonnenlänge (mit Aberration und Nutation) – für den Eintritt in die Zeichen
  const sonnenLaengeScheinbar = (date) => { const d = tage(date), T = d / 36525, O = 125.04 - 1934.136 * T; return rev(sonne(d).lon - 0.00569 - 0.00478 * sind(O)); };
  function ereignisse(jahr, monat, tagNr) {
    const beginn = tagesBeginn(jahr, monat, tagNr).getTime(), ende = beginn + 86400000, schritt = 3 * 3600000;
    const liste = [];
    const quer = (fn, art) => {   // Vorzeichenwechsel von fn innerhalb des Tages
      for (let t = beginn; t < ende; t += schritt) {
        const t2 = Math.min(t + schritt, ende), a = fn(t), b = fn(t2);
        if (a < 0 && b >= 0) liste.push({ ...art(true), zeit: nullstelle(fn, t, t2) });
        else if (a >= 0 && b < 0 && art(false)) liste.push({ ...art(false), zeit: nullstelle(fn, t, t2) });
      }
    };
    // Mondphasen: Winkel Mond–Sonne erreicht 0 / 90 / 180 / 270 Grad
    for (const [ziel, art, symbol, v] of [[0, "Neumond", "●", 0], [90, "erstes Viertel", "☽", 1], [180, "Vollmond", "○", 2], [270, "letztes Viertel", "☾", 3]]) {
      // Tag über den Winkel Mond–Sonne finden, Uhrzeit nach Meeus; liegt die genaue Zeit knapp im Nachbartag, zählt der genaue Wert
      for (const t0 of [beginn - 86400000, beginn, beginn + 86400000]) {
        const tt = phaseGenau(v, new Date(t0 + 43200000));
        if (tt.getTime() >= beginn && tt.getTime() < ende && !liste.some((e) => e.art === art)) liste.push({ art, symbol, typ: "phase", zeit: tt });
      }
      void ziel;
    }
    // über sich / unter sich: Wende der Deklination (Ableitung wechselt das Vorzeichen)
    const h = 20 * 60000, steigung = (t) => deklination(new Date(t + h)) - deklination(new Date(t - h));
    quer(steigung, (auf) => (auf ? { art: "über sich", symbol: "◡", typ: "bahn", text: "Mond beginnt zu steigen (obsigend)" } : { art: "unter sich", symbol: "◠", typ: "bahn", text: "Mond beginnt zu sinken (nidsigend)" }));
    // Knoten: Mond quert die Ekliptik
    quer((t) => breite(new Date(t)), (auf) => (auf ? { art: "aufsteigender Knoten", symbol: "☊", typ: "knoten" } : { art: "absteigender Knoten", symbol: "☋", typ: "knoten" }));
    // Erdnähe / Erdferne: Abstand hat ein Minimum bzw. Maximum
    const aend = (t) => abstand(new Date(t + h)) - abstand(new Date(t - h));
    quer(aend, (auf) => (auf ? { art: "Mond in Erdnähe", symbol: "⊕", typ: "abstand" } : { art: "Mond in Erdferne", symbol: "⊖", typ: "abstand" }));
    // Sonne tritt in ein neues Tierkreiszeichen
    quer((t) => { const l = sonnenLaengeScheinbar(new Date(t)); return winkel(l - Math.round(l / 30) * 30); }, (auf) => (auf ? { typ: "sonne" } : null));
    for (const e of liste) if (e.typ === "sonne") { const z = zeichenVon(rev(sonnenLaengeScheinbar(new Date(e.zeit.getTime() + 60000)))); e.art = `Sonne tritt in ${z.name}`; e.symbol = z.bild; e.zeichen = z; }
    return liste.sort((a, b) => a.zeit - b.zeit);
  }
  return { tag, ZEICHEN, phase, ereignisse, deklination, mondLaenge: (date) => mond(tage(date)).lon };
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
function chrVermutlichLebend(p) {   // v435/v436: gleiche Regel wie in der App – ab 1920 geboren, ohne Sterbedatum
  if (typeof personVermutlichLebend === "function") return personVermutlichLebend(p);
  if (!p || p.sterbedatum || p.sterbejahr) return false;
  const j = chrGebJahr(p);
  return !!j && j >= (typeof LEBEND_AB_JAHR !== "undefined" ? LEBEND_AB_JAHR : 1920);
}
const chrUhr = (d) => d ? d.toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" }) : "–";
function mondZeileHtml(m, ereignisse = []) {   // v420: Symbole wie im Vorarlberger Kalender, jeweils mit Text; v464: Ereignisse mit Uhrzeit
  const ph = ereignisse.find((e) => e.typ === "phase");
  const phase = ph ? [ph.symbol + (ph.symbol.length === 1 && ph.symbol !== "●" && ph.symbol !== "○" ? "\uFE0E" : ""), `${ph.art === "erstes Viertel" ? "Erstes Viertel" : ph.art === "letztes Viertel" ? "Letztes Viertel" : ph.art} um ${chrUhr(ph.zeit)} Uhr`]
    : m.ereignis === "Neumond" ? ["●", "Neumond"] : m.ereignis === "Vollmond" ? ["○", "Vollmond"] : m.zunehmend ? ["☽\uFE0E", "zunehmender Mond"] : ["☾\uFE0E", "abnehmender Mond"];
  const weitere = ereignisse.filter((e) => e.typ !== "phase").map((e) => {
    const text = e.typ === "bahn" ? `Mond geht <strong>${e.art}</strong> (Wendepunkt) um ${chrUhr(e.zeit)} Uhr`
      : e.typ === "sonne" ? `<strong>${chrEsc(e.art)}</strong> um ${chrUhr(e.zeit)} Uhr`
      : e.typ === "knoten" ? `Mond im ${chrEsc(e.art.replace("der Knoten", "den Knoten"))}`
      : `${chrEsc(e.art)}`;
    return `<div class="tb-mz tb-mz--klein"><span class="tb-mz__sym" aria-hidden="true">${e.symbol || "•"}</span><span>${text}</span></div>`;
  }).join("");
  const bahn = m.aufsteigend ? ["◡", "aufsteigender Mond (obsigend)"] : ["⌒", "absteigender Mond (nidsigend)"];
  const zeile = (sym, text, klasse = "") => `<div class="tb-mz ${klasse}"><span class="tb-mz__sym" aria-hidden="true">${sym}</span><span>${text}</span></div>`;
  const wechsel = m.wechsel ? `<br><span class="tb-klein">ab ${chrUhr(m.wechsel.zeit)} Uhr im <strong>${chrEsc(m.wechsel.nach.name)}</strong> ${m.wechsel.nach.bild} – ${chrEsc(m.wechsel.nach.art)}</span>` : "";
  return `<div class="tb-mond">
    ${zeile(phase[0], `<strong>${phase[1]}</strong>`)}
    ${zeile(bahn[0], bahn[1])}
    ${zeile(m.zeichen.bild, `Mond im <strong>${chrEsc(m.zeichen.name)}</strong> <span class="tb-glyph">${m.zeichen.symbol}</span> – ${chrEsc(m.zeichen.art)}${wechsel}`)}
    ${weitere}
    ${zeile("🌙", `Mondaufgang ${chrUhr(m.mondAuf)} · Monduntergang ${chrUhr(m.mondUnter)}`, "tb-mz--klein")}
    ${zeile("☀️", `Sonnenaufgang ${chrUhr(m.sonneAuf)} · Sonnenuntergang ${chrUhr(m.sonneUnter)} <span class="tb-ort">(Bartholomäberg)</span>`, "tb-mz--klein")}
  </div>`;
}
// Ganzes Tagesblatt. opt: { leser: bool, ich: {id,name}|null, beziehung: (personId) => "Urgroßmutter"|null }
function tagesblattAuswerten(d, opt = {}) {
  const heute = tagesMonatTag(opt.datum || new Date());   // v468: opt.datum zum Blättern
  const istHeute = heute.md === tagesMonatTag().md && heute.jahr === tagesMonatTag().jahr;
  const r = { datum: heute, istHeute, mond: MOND.tag(heute.jahr, heute.monat, heute.tag) };
  try { r.mondEreignisse = MOND.ereignisse(heute.jahr, heute.monat, heute.tag); } catch { r.mondEreignisse = []; }   // v464
  r.kirche = kirchenjahrTag(heute.jahr, heute.monat, heute.tag);
  r.hundert = hundertjaehrigerFuer(heute.jahr, heute.monat);
  const nt = namenstagFuer(heute.md);
  if (nt) {
    const namen = new Set(nt.namen.flatMap((n) => [n, n.split(/\s+/)[0]]));   // v464: „Franz v. Sales“ zählt auch für Franz
    const traeger = d.personen.filter((p) => String(p.vorname || "").split(/[\s-]+/).some((t) => namen.has(t)));
    r.namenstag = { patron: nt.patron, namen: nt.namen, anzahl: traeger.length,
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
    return `<li><span class="tb-icon" aria-hidden="true">${icon}</span><span><strong>${art}</strong> · ${r.istHeute === false ? "an diesem Tag" : "heute"} vor ${x.jahre} Jahren (${x.jahr}): ${wer}</span></li>`;
  };
  const nt = r.namenstag;
  return `<p class="tb-datum">${chrEsc(datum)}</p>
    ${kirchenZeileHtml(r.kirche)}
    ${mondZeileHtml(r.mond, r.mondEreignisse || [])}
    ${namenstagZeileHtml(nt)}
    ${r.regel ? `<p class="tb-regel">🌾 <em>${chrEsc(r.regel)}</em></p>` : ""}
    ${r.hundert ? `<p class="tb-hundert">🌦️ <strong>Hundertjähriger Kalender (${chrEsc(new Date(Date.UTC(r.datum.jahr, r.datum.monat - 1, 1)).toLocaleDateString("de-AT", { month: "long", timeZone: "UTC" }))}):</strong> ${chrEsc(r.hundert)}</p>` : ""}
    <h3 class="tb-titel">${r.istHeute === false ? "An diesem Tag vor … Jahren" : "Heute vor … Jahren"}</h3>
    ${r.ereignisse.length ? `<ul class="heute-liste tb-liste">${r.ereignisse.map(zeile).join("")}</ul>` : `<p class="tb-klein">${r.istHeute === false ? "An diesem Tag" : "Heute"} gibt es im Bestand keinen Geburts-, Todes- oder Hochzeitstag.</p>`}
    <p class="tb-hinweis">Mondangaben berechnet nach altem Mondkalender (Tierkreis wie im Vorarlberger Kalender), Zeiten abgeglichen mit dem Bauernkalender 2027; Namenstage und Feste nach dem Bauernkalender. Hundertjähriger Kalender und Mondregeln sind überliefertes Brauchtum – keine Wettervorhersage und keine Empfehlung.</p>`;
}
const TAGESNAMEN = {"01-01": "Maria, Wilhelm","01-02": "Basilius, Dietmar, Gregor","01-03": "Genoveva, Odilo","01-04": "Angela, Marius, Rüdiger, Titus","01-05": "Emilia, Johann","01-06": "Kaspar, Melchior, Balthasar, Erminold","01-07": "Raimund, Valentin","01-08": "Erhard, Gudula, Severin","01-09": "Adrian, Alice, Eberhard, Julian","01-10": "Leonie, Paulus","01-11": "Paulin, Paulinus, Theodosius","01-12": "Ernst, Tatjana, Xenia","01-13": "Hilarius, Hilmar, Jutta, Remigius","01-14": "Engelmar, Felix, Rainer","01-15": "Arnold, Maurus, Romedius","01-16": "Dietwald, Marcel, Tilman","01-17": "Antonius, Beatrix","01-18": "Margitta, Ulfried, Uwe","01-19": "Agritius, Marius, Martha, Pia","01-20": "Fabian, Sebastian, Ursula, Ute","01-21": "Agnes, Ines, Meinrad","01-22": "Vinzenz","01-23": "Hartmut, Heinrich, Nikolaus","01-24": "Franz, Thurid, Vera","01-25": "Paulus, Wolfram","01-26": "Paula, Timotheus, Titus","01-27": "Angela, Julian","01-28": "Karoline, Manfred, Thomas","01-29": "Gerhard, Gerd, Josef, Valerius","01-30": "Adelgunde, Martina","01-31": "Johannes, Marcella","02-01": "Brigitta, Katharina, Reginald, Severus","02-02": "Bodo, Mariä Lichtmess","02-03": "Ansgar, Blasius, Oskar","02-04": "Andreas, Rabanus, Veronika","02-05": "Agatha, Albuin","02-06": "Dorothea, Doris, Paul","02-07": "Ava, Richard","02-08": "Hieronymus, Josefina, Josefine","02-09": "Alto, Anna Katharina, Apollonia","02-10": "Scholastika, Siegmar","02-11": "Anselm","02-12": "Benedikt, Eulalia, Gregor","02-13": "Adolf, Christina, Irmhild","02-14": "Cyrill, Method, Valentin","02-15": "Georgia, Siegfried","02-16": "Adalbert, Juliana, Liane, Philippa","02-17": "Alexius, Benignus, Bonosus","02-18": "Constanze, Simon, Simone","02-19": "Hadwig, Irmgard, Irma","02-20": "Corona, Falko, Jacinta","02-21": "Enrica, Gunthild, Petrus","02-22": "Isabella","02-23": "Raffaela, Romana","02-24": "Matthias","02-25": "Walburga","02-26": "Edigna, Gerlinde, Ottokar","02-27": "Baldur, Marko, Markward, Gabriel","02-28": "Oswald, Roman, Silvana","02-29": "Hilarius, Oswald","03-01": "Albin, Leontina, Roger","03-02": "Agnes, Karl","03-03": "Friedrich, Camilla, Kunigunde","03-04": "Edwin, Humbert, Kasimir","03-05": "Dietmar, Jeremia, Olivia","03-06": "Fridolin, Nicola, Rosa","03-07": "Felicitas, Perpetua, Reinhard","03-08": "Gerhard, Johannes","03-09": "Bruno, Franziska","03-10": "Emil, Gustav","03-11": "Alram, Rosina","03-12": "Almut, Beatrix, Serafina","03-13": "Judith, Leander, Pauline","03-14": "Eva, Evelyn, Mathilde","03-15": "Klemens Maria, Luise","03-16": "Eduard, Herbert","03-17": "Gertraud, Gertrud, Patrick","03-18": "Cyrill, Edward, Sibylle","03-19": "Josef, Josefa, Josefine","03-20": "Claudia, Wolfram","03-21": "Alexandra, Axel, Christian, Emilia","03-22": "Klemens, Elmar, Lea","03-23": "Otto, Rebekka, Toribio","03-24": "Elias, Karin, Katharina","03-25": "Judith, Lucia","03-26": "Lara, Ludger","03-27": "Ernst, Frowin, Heimo","03-28": "Guntram, Ingbert","03-29": "Berthold, Helmut, Ludolf","03-30": "Amadeus, Dodo","03-31": "Benjamin, Cornelia","04-01": "Hugo, Irene, Irina","04-02": "Franz, Mirjam, Sandra","04-03": "Richard, Sixtus","04-04": "Isidor, Konrad","04-05": "Crescentia, Vinzenz","04-06": "Notker, Wilhelm","04-07": "Johann","04-08": "Beate, Rose-Marie, Walter","04-09": "Casilda, Waltraud","04-10": "Ezechiel, Gernot, Holda","04-11": "Hildebrand, Stanislaus","04-12": "Herta, Julius, Zeno","04-13": "Hermenegild, Ida, Martin","04-14": "Elmo, Erna, Ernestine","04-15": "Anastasia, Damian","04-16": "Bernadette, Magnus","04-17": "Eberhard, Rudolph","04-18": "Werner, Wigbert","04-19": "Gerold, Leo, Marcel","04-20": "Hildegund, Odetta, Wilhelm","04-21": "Anselm, Konrad","04-22": "Alfred, Kaj, Leonidas","04-23": "Adalbert, Georg, Jörg, Jürgen","04-24": "Egbert, Fidelis, Wilfried","04-25": "Erwin, Markus","04-26": "Helene, Trudpert","04-27": "Petrus, Zita","04-28": "Hugo, Ludwig, Pierre","04-29": "Katharina, Roswitha","04-30": "Pauline, Pius, Silvio","05-01": "Josef","05-02": "Athanasius, Boris, Siegmund","05-03": "Jakob, Philipp, Viola","05-04": "Florian, Guido, Valeria","05-05": "Godehard, Jutta, Sigrid","05-06": "Antonia, Britto, Gundula","05-07": "Gisela, Helga, Notker, Silke","05-08": "Ida, Klara, Ulla, Ulrike","05-09": "Beatus, Caroline, Volkmar","05-10": "Gordian, Isidor, Liliana","05-11": "Gangolf, Joachim, Mamertus","05-12": "Pankraz, Pankratius","05-13": "Servatius","05-14": "Bonifatius, Christian","05-15": "Hertraud, Rupert, Sonja, Sophie","05-16": "Adolf, Johann","05-17": "Dietmar, Pascal, Walter","05-18": "Erich, Erika, Felix, Johannes","05-19": "Ivo, Kuno, Yvonne","05-20": "Bernhardin, Elfriede, Mira","05-21": "Christoph, Constantin, Josef","05-22": "Julia, Ortwin, Rita","05-23": "Alma, Desiree, Renate","05-24": "Dagmar, Esther","05-25": "Beda, Gregor, Magdalena","05-26": "Alwin, Philipp","05-27": "August, Bruno, Randolph","05-28": "German, Wilhelm","05-29": "Erwin, Irmtraud, Maximin","05-30": "Ferdinand, Johanna, Otto","05-31": "Helma, Mechthild, Petra","06-01": "Justin, Silvana, Simeon","06-02": "Armin, Erasmus, Marcel, Petrus","06-03": "Hildburg, Karl, Silvia","06-04": "Christa, Klothilde","06-05": "Erika, Winfried","06-06": "Bertrand, Kevin, Norbert","06-07": "Anita, Gottlieb, Robert","06-08": "Elga, Maria, Medardus","06-09": "Annamaria, Ephraim, Grazia","06-10": "Bardo, Diana, Heinrich, Heinz","06-11": "Alice, Barnabas, Paula","06-12": "Florinda, Guido, Leo","06-13": "Antonius, Bernhard","06-14": "Hartwig, Meinrad","06-15": "Gebhard, Lothar, Veit","06-16": "Benno, Luitgard, Quirin","06-17": "Adolf, Alena, Volker","06-18": "Elisabeth, Ilsa, Marina","06-19": "Juliana, Romuald","06-20": "Adalbert, Florentina","06-21": "Alban, Alois, Aloisia, Ralf","06-22": "Paulinus, Thomas","06-23": "Edeltraud, Marion, Ortrud","06-24": "Johannes, Reingard","06-25": "Dorothea, Eleonora, Ella","06-26": "Anthelm, Vigilius","06-27": "Cyrill, Heimo, Hemma, Maxim","06-28": "Ekkehard, Harald, Irenäus","06-29": "Gero, Paul, Peter","06-30": "Bertram, Ehrentrud, Otto","07-01": "Aaron, Dietrich, Otto, Theobald","07-02": "Wiltrud","07-03": "Günther, Ramona, Thomas","07-04": "Berta, Elisabeth, Ulrich","07-05": "Albrecht, Antonius, Letizia","07-06": "Goar, Isaias, Marietta","07-07": "Edda, Firmin, Willibald","07-08": "Amalia, Edgar, Kilian","07-09": "Augustin","07-10": "Engelbert, Knud, Raphael","07-11": "Benedikt, Olga, Oliver","07-12": "Felix, Henriette, Siegbert","07-13": "Arno, Heinrich, Kunigunde","07-14": "Goswin, Kamillus, Roland","07-15": "Bonaventura, Egon, Waldemar","07-16": "Irmgard","07-17": "Charlotte, Donata, Gabriella","07-18": "Arnulf, Friedrich","07-19": "Bernulf, Marina, Poppo, Reto","07-20": "Apollinaris, Bernhard, Margaretha","07-21": "Daniel, Daniela, Julia, Laurentius","07-22": "Maria Magdalena","07-23": "Birgitta, Birgit, Liborius","07-24": "Christoph","07-25": "Jakobus, Thomas, Valentina","07-26": "Anna, Gloria, Joachim","07-27": "Berthold, Natalie, Pantaleon","07-28": "Adele, Beatus, Innozenz","07-29": "Ladislaus, Martha, Olaf","07-30": "Ingeborg, Inga, Petrus","07-31": "Hermann, Ignatius, Justinus","08-01": "Alfons, Peter","08-02": "Eusebius, Julian, Petrus","08-03": "August, Lydia, Nikodemus","08-04": "Johannes, Rainer","08-05": "Oswald","08-06": "Gilbert","08-07": "Afra, Albert, Cajetan","08-08": "Cyriak, Dominik, Elgar","08-09": "Edith","08-10": "Astrid, Laurenz, Lorenz","08-11": "Klara, Susanna","08-12": "Karl, Radegunde","08-13": "Cassian, Hippolyt, Marko, Pontianus","08-14": "Maximilian, Meinhard","08-15": "Mariä Himmelfahrt, Tarsitius","08-16": "Alfried, Rochus, Stefan","08-17": "Gudrun, Hyazinth, Janine","08-18": "Claudia, Helena","08-19": "Johann, Julius, Sebald","08-20": "Bernhard, Bernd, Ronald","08-21": "Maximilian, Pius","08-22": "Regina","08-23": "Isolde, Rosa, Zachäus","08-24": "Bartholomäus, Michaela","08-25": "Elvira, Josef, Ludwig","08-26": "Gregor, Miriam, Teresa","08-27": "Gebhard, Monika, Vivian","08-28": "Adelinde, Aline, Augustin","08-29": "Johannes","08-30": "Felix, Heribert, Rebekka","08-31": "Paulinus, Raimund","09-01": "Ägidius, Ruth, Verena","09-02": "Ingrid, René, Salomon","09-03": "Gregor, Silvia, Sophie","09-04": "Ida, Iris, Irmgard, Rosalia","09-05": "Roswitha, Teresa","09-06": "Bertram, Gundolf, Magnus","09-07": "Otto, Ralph, Regina","09-08": "Adrian, Mariä Geburt","09-09": "Edgar, Otmar","09-10": "Carlo, Diethard, Isabella","09-11": "Felix, Maternus, Regula","09-12": "Gerfried, Maria","09-13": "Johann, Notburga, Tobias","09-14": "Albert, Cornelius","09-15": "Dolores, Melitta","09-16": "Edith, Ludmilla, Mechthild","09-17": "Ariane, Hildegard, Robert","09-18": "Herlinde, Lambert","09-19": "Igor, Januarius","09-20": "Susanne","09-21": "Deborah, Jonas, Matthäus","09-22": "Emmeram, Mauritius","09-23": "Gerhild, Linus, Thekla","09-24": "Gerhard, Hermann, Rupert, Virgil","09-25": "Irmfried, Serge","09-26": "Cosima, Damian, Kosmas","09-27": "Dietrich, Hiltrud, Vinzenz","09-28": "Giselher, Lioba, Thekla, Wenzel","09-29": "Gabriel, Michael, Michaela, Rafael","09-30": "Hieronymus, Urs, Viktor","10-01": "Remigius","10-02": "Gideon","10-03": "Bianca, Ewald, Udo","10-04": "Aurea, Edwin, Franz","10-05": "Herwig, Meinolf","10-06": "Adalbero, Bruno, Melanie","10-07": "Jörg, Justina, Rosa Maria","10-08": "Felix, Günther, Simeon","10-09": "Dionys, Günter, Sara, Johannes","10-10": "Gereon, Samuel, Viktor","10-11": "Bruno, Jakob","10-12": "Edwin, Gottfried, Maximilian","10-13": "Eduard, Gerald","10-14": "Burkhard, Kallixtus","10-15": "Aurelia, Theresia","10-16": "Gallus, Hedwig, Margareta","10-17": "Anselm, Ignatius","10-18": "Justus, Lukas","10-19": "Isaak, Johannes, Paul, Petrus","10-20": "Irina, Vitalis, Wendelin","10-21": "Karl, Ursula, Ulla","10-22": "Cordula, Ingbert, Salome","10-23": "Johannes, Severin, Uta","10-24": "Alois, Aloisia, Anton, Armella","10-25": "Krispin, Krispinian","10-26": "Albin, Amand, Wigand","10-27": "Christa, Sabina, Wolfhard","10-28": "Simon, Thaddäus","10-29": "Ermelinda, Melinda","10-30": "Alfons, Angelo, Dieter","10-31": "Quentin, Wolfgang","11-01": "Allerheiligen, Arthur, Harald, Otmar, Rupert","11-02": "Allerseelen, Angela, Margarethe, Tobias","11-03": "Hubert, Martin, Pirmin, Rupert","11-04": "Karl, Karla, Modesta","11-05": "Bernhard, Berthild, Emmerich","11-06": "Christine, Leonhard, Rudolf","11-07": "Carina, Engelbert, Willibrord","11-08": "Gottfried, Willehad","11-09": "Herfried, Roland, Theodor","11-10": "Andrea, Andreas, Jens, Leo","11-11": "Martin, Menas, Senta","11-12": "Emil, Josaphat, Kunibert","11-13": "Eugen, Livia, Stanislaus","11-14": "Nikolaus, Sidonia","11-15": "Albert, Leopold, Leopoldine","11-16": "Margareta, Otmar","11-17": "Gertrud, Hilda, Florin","11-18": "Odo, Philippine","11-19": "Elisabeth, Bettina, Lisa","11-20": "Bernward, Edmund, Korbinian","11-21": "Amalie","11-22": "Cäcilia, Salvator","11-23": "Klemens, Columban, Detlef","11-24": "Albert, Flora","11-25": "Katharina, Kathrin, Katja","11-26": "Anneliese, Gebhard, Konrad","11-27": "Albrecht, Brunhilde, Uta","11-28": "Berta, Gunther, Jakob","11-29": "Christine, Friedrich, Friederike","11-30": "Andreas, Andrea, Volkert","12-01": "Blanka, Eligius, Natalie","12-02": "Bibiana, Jan, Lucius","12-03": "Emma, Franz Xaver","12-04": "Adolf, Barbara, Johannes","12-05": "Anno, Gerald, Niels, Reinhard","12-06": "Denise, Henrike, Nikolaus","12-07": "Ambrosius, Benedikte","12-08": "Mariä Empfängnis, Edith, Elfriede","12-09": "Liborius, Reinmar, Valerie","12-10": "Angelina, Bruno, Emma, Herbert","12-11": "Arthur, Damasus, Tassilo","12-12": "Johanna","12-13": "Jodok, Lucia, Odilia, Ottilie","12-14": "Berthold, Johannes","12-15": "Christiane, Nina","12-16": "Adelheid, Heidi, Elke","12-17": "Jolanda, Lazarus, Viviana","12-18": "Philipp, Wunibald","12-19": "Benjamin, Susanne","12-20": "Eike, Holger, Julius, Regina","12-21": "Hagar, Peter","12-22": "Jutta","12-23": "Viktoria","12-24": "Adam, Eva","12-25": "Christtag, Anastasia, Eugenia, Natalis","12-26": "Stephan, Stephanie","12-27": "Fabiola, Johannes","12-28": "Unschuldige Kinder","12-29": "David, Jonathan, Thomas","12-30": "Felix, Lothar","12-31": "Melanie, Silvester"};   // v421: Namenstage aller Tage (Übersicht meinbezirk.at, ergänzt um Hochfeste)
// v421: Namenstag für jeden Tag – Tagesliste + Bestandsnamen (NAMENSTAGE) zusammengeführt
function namenstagFuer(md) {
  const alt = NAMENSTAGE[md];
  const namen = [];
  const dazu = (n) => { n = String(n || "").trim(); if (n && !namen.includes(n)) namen.push(n); };
  String(typeof KALENDER_NAMEN !== "undefined" && KALENDER_NAMEN[md] || "").split(",").forEach(dazu);   // v464: zuerst der Bauernkalender
  String(TAGESNAMEN[md] || "").split(",").forEach(dazu);
  if (alt) alt[1].forEach(dazu);
  if (!namen.length) return null;
  return { patron: alt ? alt[0] : "", namen };
}
function namenstagZeileHtml(nt) {
  if (!nt) return "";
  return `<p class="tb-namenstag">😇 <strong>Namenstag:</strong> ${chrEsc(nt.namen.slice(0, 6).join(", "))}${nt.patron ? ` <span class="tb-klein">(${chrEsc(nt.patron)})</span>` : ""}${nt.anzahl ? ` · ${chrZahl(nt.anzahl)} ${nt.anzahl === 1 ? "Person" : "Personen"} im Bestand` : ""}</p>`;
}

/* ===================== v464: Bauernkalender – Namenstage, Kirchenjahr, Hundertjähriger ===================== */
// Namenstage und feste Feiertage nach dem Bauernkalender (gelten jedes Jahr am selben Tag).
// Bewegliche Feste (Ostern, Pfingsten, Quatember …) und Sonntagsnamen werden pro Jahr berechnet.
const KALENDER_NAMEN = {"01-01":"Wilhelm","01-02":"Basilius, Gregor, Adalhard, Dietmar","01-03":"Jesus, Genoveva, Daniel, Hermine","01-04":"Angela, Rigobert, Angelika, Isabella","01-05":"Emilie, Roger, Simeon, Gerlach","01-06":"Wiltrud","01-07":"Raimund, Valentin, Tilman, Reinhold","01-08":"Severin, Erhard, Gudrun, Gudula","01-09":"Julian, Alexia, Adrian, Eberhard","01-10":"Wilhelm, Thekla, Aldo, Florida","01-11":"Tasso, Egwin, Harald, Erhard","01-12":"Ernst, Tatjana, Xenia, Benedikt","01-13":"Hilarius, Jutta, Veronika, Ivette","01-14":"Felix, Gottfried, Rainer, Julius","01-15":"Maurus, Makarius, Romedius, Ida","01-16":"Marcellus, Theobald, Roland, Ulrich","01-17":"Antonius Abt, Rosalinde, Leonie","01-18":"Priska, Regina, Leonhard, Susanne","01-19":"Heinrich, Dagobert, Knud, Mario, Pia","01-20":"Fabian, Sebastian, Ursula, Ute","01-21":"Meinrad, Agnes, Patroklus, Dietrich","01-22":"Vinzenz, Dietlinde, Dominik, Irene","01-23":"Heinrich Seuse, Hartmut, Raimund","01-24":"Franz v. Sales, Vera, Bertram, Arno","01-25":"Emanuel, Wolfram","01-26":"Timotheus, Titus, Alberich, Paula, Robert","01-27":"Angela v. M., Dietrich, Elvira, Julian","01-28":"Thomas v. A., Amadeus, Manfred","01-29":"Franz, Valerius, Rüdiger, Gerhard","01-30":"Martina, Adelgunde, Diethild, Xaver","01-31":"Johannes Bosco, Luise, Julius, Peter","02-01":"Brigitte, Sigbert, Radolf, Sabine","02-02":"Bodo","02-03":"Blasius, Ansgar, Oskar, Belinda","02-04":"Rabanus Maurus, Andreas, Veronika","02-05":"Agatha, Albuin, Adelheid, Hildegard","02-06":"Paul Miki, Dorothea, Amanda, Titus","02-07":"Richard, Fidelis, Lukas, Jakob, Nivard","02-08":"Hieronymus, Josefine Bakhita, Paulus","02-09":"Ansbert, Erich, Anke, Antje","02-10":"Scholastika, Wilhelm","02-11":"Adolf, Benedikt","02-12":"Reginald, Sigmar, Eulalia, Gosbert","02-13":"Christina, Gerlinde, Beatrix, Reinhild","02-14":"Cyrill und Method, Valentin, Bruno","02-15":"Siegfried, Jordan, Erich, Jovita","02-16":"Juliana, Elias, Liane, Alfred, Simeon","02-18":"Susanna, Engelbert, Bernadette","02-19":"Konrad, Arnold, Hadwig, Friedrich","02-20":"Jordan, Amata, Falko, Sadoth","02-21":"Petrus Damiani, Eleonore, Felix, German","02-22":"Margarete, Isabella","02-23":"Polykarp, Romana, Otto, Peter, Martha","02-24":"Matthias, Edelbert, Ida, Sergius","02-25":"Walpurga, Adeltrud, Konstantin, Adam","02-26":"Alexander, Gerlinde, Paul, Viktor","02-27":"Leander, Basil, Baldur, Gabriel, Julian","02-28":"Oswald, Silvana, Antonia, Roman","03-01":"Albin, David, Roger, Rüdiger","03-02":"Axel, Karl, Agnes, Volker, Ines","03-03":"Friedrich, Camilla, Anselm, Liberat","03-04":"Kasimir, Humbert, Rupert, Lucius","03-05":"Gerda, Olivia, Theophil, Zacharias","03-06":"Fridolin, Colette, Kuno, Nicole, Jordan","03-07":"Perpetua, Felicitas, Volker, Reinhard","03-08":"Johannes v. Gott, Beate, Julian","03-09":"Bruno, Franziska, Barbara, Dominik","03-10":"Emil, Gustav, 40 Märtyrer, Henriette","03-11":"Theresia, Rosina, Wolfram, Konstantin","03-12":"Engelhard, Maximilian, Almut, Beatrix","03-13":"Gerald, Roderich, Judith, Leander","03-14":"Mathilde, Pauline, Evelyne, Einhard","03-15":"Klemens Maria Hofbauer, Luise, Lukretia, Diedo","03-16":"Heribert, Julian, Abraham, Rüdiger","03-17":"Gertrud, Patrick, Gerda, Gertraud","03-18":"Cyrill, Eduard, Sibylle, Anselm","03-19":"Gernot, Ida, Gero","03-20":"Wolfram, Claudia, Irmgard, Irma","03-21":"Alexandra, Elias, Raimund, Cassian","03-22":"Katharina, Herlinde, Elmar, Lea","03-23":"Turibio, Marbot, Rebecca, Otto","03-24":"Katharina v. Schweden, Diego, Simon","03-26":"Ludger, Vera, Emmanuel","03-27":"Frowin, Haimo, Rupert","03-28":"Guntram, Ingo, Janine, Elfriede","03-29":"Ludolf, Berthold","03-30":"Roswitha, Amadeus, Bodo, Diemut","03-31":"Cornelia, Balbina, Benjamin, Traugott","04-01":"Hugo, Valerie, Viktor, Gilbert, Thomas","04-02":"Franz v. Paola, Werner, Mirjam","04-03":"Richard, Irene, Benno, Gandolf","04-04":"Isidor, Platon, Heidrun, Ambros","04-05":"Vinzenz Ferrer, Juliana","04-06":"Sixtus, Isolde, Ruthilde, Cölestin","04-07":"Johannes Bapt. de la Salle, Irmtraud, Hermann","04-08":"Walter, Notker, Beate, Albert","04-09":"Waltraud, Hugo, Konrad, Marcellus","04-10":"Hulda, Gerold, Engelbert, Daniel","04-11":"Stanislaus, Leo, Rainer, Isaak","04-12":"Julius, Konstantin, Hertha, Ingeborg","04-13":"Martin, Ida, Jakob, Albert","04-14":"Lambert, Hadwig, Tibor, Laurin","04-15":"Anastasia, Waldo, Hunna, Damian","04-16":"Benedikt, Jochen, Herwig, Magnus","04-17":"Rudolf, Gerwin, Elias, Wanda","04-18":"Werner, Mechthild, Florian, Wigbert","04-19":"Leo IX., Gerold, Kuno, Otbert, Emma","04-20":"Adalar, Cornelia, Ute, Oda, Hildegund","04-21":"Konrad v. Parzham, Alexandra, Anselm","04-22":"Wolfhelm, Nathanael, Alfred, Kaj","04-23":"Adalbert, Georg, Jürgen, Jörg","04-24":"Fidelis, Wilfried, Helmut, Marion","04-25":"Markus Ev., Erwin, Franka, Hanibald","04-26":"Cletus, Trudbert, Radbert, Valentina","04-27":"Petrus Canisius, Marianne, Zita, Tutilo","04-28":"Pierre Chanel, Ludwig, Vitalis, Valerie","04-29":"Katharina v. Siena, Robert, Dietger, Odo","04-30":"Pius V., Rosamunde, Haimo, Tamara","05-01":"Josef der Arbeiter, Sigismund","05-02":"Athanasius, Boris, Gerhild, Zoe","05-03":"Philipp, Jakob, Emilie, Violetta, Viola","05-04":"Florian, Valeria, Guido, Monika","05-05":"Godehard, Angelus, Pius, Sigrid","05-06":"Gundula, Edbert","05-07":"Gisela, Gernot, Olga, Silke","05-08":"Ida, Cäcilia, Rachel, Desiré, Ulrike","05-09":"Beatus, Volkmar, Caroline","05-10":"Antonin, Isidor, Beatrix, Gordian","05-11":"Joachim, Jakob, Philipp, Waldbert","05-12":"Pankratius, Nereus, Achilleus","05-13":"Servatius, Imelda, Robert","05-14":"Bonifatius, Corona, Isolde, Aglaja","05-15":"Sophie, Rupert, Sonja, Isidor, Gerbert","05-16":"Johannes Nepomuk, Simon","05-17":"Bruno, Dietmar, Jodok","05-18":"Johannes I., Erika, Alexandra, Erich","05-19":"Ivo, Cölestin, Yvonne, Kuno","05-20":"Bernhardin v. Siena, Elfriede, Roland","05-21":"Hermann Josef, Christophorus, Wiltrud","05-22":"Rita, Julia, Emil, Helma, Goswin","05-23":"Renate, Wigbert, Anno, Krispin","05-24":"Esther, Vinzenz, Dagmar, Simeon","05-25":"Maria Magdalena, Beda, Gregor VII.","05-26":"Philipp Neri, Alwin, Eva, Godo","05-27":"Augustinus v. Canterbury","05-28":"Wilhelm, German, Theodul, Liane","05-29":"Erwin, Bona, Kanon, Irmtrud","05-30":"Ferdinand, Johanna v. Orléans, Reinhilde","05-31":"Angela, Helmtrud, Aldo, Mechthild","06-01":"Justin, Konrad, Albert, Silke","06-02":"Marcellinus, Petrus, Armin, Erasmus","06-03":"Karl Lwanga, Klothilde, Hildburg","06-04":"Christa, Walter, Franz","06-05":"Bonifatius, Winfried","06-06":"Norbert v. Xanten, Claudius, Falko, Kevin","06-07":"Gottlieb, Robert, Adolar, Dietger","06-08":"Medardus, Helga, Ilga, Isabella","06-09":"Diana, Ephräm, Grazia, Felizian","06-10":"Heinrich, Rimbert, Amalia, Olivia","06-11":"Barnabas, Adelheid, Paula, Roselina","06-12":"Alice, Leo, Isaak, Guido","06-13":"Antonius v. Padua, Tobias, Gerhard","06-14":"Hartwig, Burkhard, Basilius, Meinrad","06-15":"Vitus, Lothar, Bardo, Jolanda","06-16":"Benno, Luitgard, Guido, Franz","06-17":"Gregor, Rainer, Adolf, Gundolf","06-18":"Elisabeth, Dolores, Markus, Gerland","06-19":"Romuald, Juliana, Harald, Hildegrim","06-20":"Adalbert, Ludwig, Florentine, Marga","06-21":"Alois, Alban, Alice, Radolf, Ralph","06-22":"Paulinus, Thomas Morus, John Fisher, Eberhard","06-23":"Edeltraud, Marion, Josef, Basilius","06-24":"Iwan, Reingard","06-25":"Wilhelm, Dorothea, Adalbert, Emil","06-26":"David, Vigil, Jeremias, Anthelm, Paul","06-27":"Hemma, Cyrill, Harald, Ladislaus","06-28":"Irenäus, Eckhart, Diethild, Haimo","06-29":"Peter, Paul, Judith, Salome, Beate","06-30":"Otto v. Bamberg, Ehrentraud","07-01":"Theobald, Dieter, Dietrich, Regina","07-02":"Herwig, Otto","07-03":"Thomas Ap., Anatol, Elgar, Leo","07-04":"Ulrich, Elisabeth, Berta, Odo, Werner","07-05":"Anton Maria Zaccaria, Charlotte, Albrecht","07-06":"Maria Goretti, Mechthild, Dominik","07-07":"Willibald, Prosper, Hedda, Edelburg","07-08":"Kilian, Edgar, Eugen, Hadrian, Prokop","07-09":"Gottfried, Veronika, Hermine, Dietrich","07-10":"Knud, Erich, Olaf, Amalia","07-11":"Benedikt v. Nursia, Olga, Oliver, Helga","07-12":"Ansbald, Andreas, Theodor, Hermagor","07-13":"Heinrich, Kunigunde, Arno, Sarah","07-14":"Kamillus v. Lellis, Goswin, Roland, Ulrich","07-15":"Bonaventura, Egon, Balduin, Donald","07-16":"Carmen, Reinelde","07-17":"Alexis, Charlotte, Gabriele, Marina","07-18":"Arnold, Arnulf, Friedrich, Robert","07-19":"Bernulf, Justa, Vinzenz, Rufina","07-20":"Margaretha, Apollinaris, Elias, Wilmar","07-21":"Laurentius v. Brindisi, Julia, Daniel, Hermann","07-22":"Maria Magdalena, Verena, Benno","07-23":"Birgitta, Alberta, Liborius, Sidonie","07-24":"Christophorus, Christina, Sieglinde","07-25":"Jakobus Ap., Thea, Valentina, Urs","07-26":"Anna, Joachim, Christiane, Gloria","07-27":"Berthold, Rudolf, Pantaleon, Natalie","07-28":"Celsus, Viktor, Ada, Diethild, Beatus","07-29":"Martha, Beatrix, Olaf, Felix, Lucilla","07-30":"Petrus Chrysologus, Ingeborg, Julitta","07-31":"Ignatius v. Loyola, German, Helene, Erna","08-01":"Alfons v. Liguori, Peter, Rigobert, Caritas","08-02":"Eusebius, Stefan, Gustav, Elfriede","08-03":"Lydia, August, Benno, Burkhard","08-04":"Johannes Maria Vianney, Dominik, Rainer, Sigrid","08-05":"Oswald","08-06":"Hermann, Gilbert","08-07":"Sixtus, Kajetan, Afra, Konrad, Juliana","08-08":"Dominikus, Hedwig, Hartwig, Koloman","08-09":"Theresia Benedicta vom Kreuz, Roman","08-10":"Laurentius, Astrid, Philomena, Erich","08-11":"Klara v. Assisi, Luise, Susanna, Donald","08-12":"Hilaria, Eusebius, Radegund","08-13":"Pontian, Hippolyt, Kassian, Ludolf","08-14":"Maximilian Kolbe, Wernfried, Eberhard","08-15":"Alfred, Rupert","08-16":"Stephan v. Ungarn, Rochus, Serena, Arnulf","08-17":"Liberat, Emilie, Jutta, Gudrun, Bertram","08-18":"Helene, Paula, Rainald, Claudia","08-19":"Johannes Eudes, Sebald, Ludwig","08-20":"Bernhard v. Clairvaux, Oswin, Ronald, Samuel","08-21":"Pius X., Balduin, Maximilian, Alban, Pia","08-22":"Regina, Siegfried","08-23":"Rosa v. Lima, Philipp, Nikodemus, Richildis","08-24":"Bartholomäus, Isolde, Michaela","08-25":"Ludwig IX., Josef v. Calasanz, Elvira, Patricia","08-26":"Margareta, Gregor, Alexander, Hadrian","08-27":"Monika, Gebhard, Cäsar, Wernfried","08-28":"Augustinus, Elmar, Adelinde, Hermes","08-29":"Sabine, Verona","08-30":"Ingeborg, Benjamin, Rebecca, Felix","08-31":"Paulinus, Raimund, Albert, Anja","09-01":"Ägidius, Ruth, Verena, Artur, Isabella","09-02":"Ingrid, René, Stefan, Oliver, Emmerich","09-03":"Gregor der Große, Egon, Degenhard, Sonja","09-04":"Rosalia, Rosa, Ida, Irma, Iris, Moses","09-05":"Albert, Roswitha, David, Roman","09-06":"Beate, Magnus, Gundolf, Bertrand","09-07":"Regina, Ralph, Stefan, Dietrich, Otto","09-08":"Hadrian, Sergius, Alain","09-09":"Petrus Claver, Korbinian, Othmar, Peter","09-10":"Diethard, Isabella, Edgar, Jodok","09-11":"Helga, Ilga, Merbod, Regula, Felix","09-12":"Guido, Gerfried","09-13":"Johannes Chrysostomus, Tobias, Amatus","09-14":"Notburga, Irmgard","09-15":"Eckehart, Melitta, Dolores, Roland","09-16":"Kornelius, Cyprian, Edith, Ludmilla","09-17":"Hildegard, Robert Bellarmin, Ariadne, Emanuel","09-18":"Lambert, Reinfried, Ricarda, Corona","09-19":"Januarius, Wilma, Arnulf, Igor, Emilie","09-20":"Fausta, Hanno, Traugott, Andreas","09-21":"Matthäus Ev., Jonas, Maura, Deborah","09-22":"Mauritius, Moritz, Viktor, Gunthild","09-23":"Pio v. Pietrelcina, Thekla, Rotrud, Linus","09-24":"Rupert, Virgil, Mercedes, Giselher","09-25":"Nikolaus v. der Flüe, Aurelia, Kleophas","09-26":"Kosmas, Damian, Justina, Eugenia","09-27":"Vinzenz v. Paul, Hiltrud, Gotthelf, Florentin","09-28":"Lioba, Wenzel, Lorenzo Ruiz, Dietmar","09-29":"Michael, Gabriel, Raphael, Gudelia","09-30":"Hieronymus, Viktor, Hedwig, Ursula","10-01":"Theresia v. Lisieux, Remigius, Roman","10-02":"Theophil, Jakob","10-03":"Ewald, Gerhard, Bianca, Udo, Gerd","10-04":"Franz v. Assisi, Edwin, Herwig, Marsus","10-05":"Meinulf, Attila, Flavia, Helmut, Maurus","10-06":"Bruno, Adalbert, René","10-07":"Markus, Gerold, Amalia","10-08":"Benedikt, Brigitta, Laura, Simeon","10-09":"Dionysius, Johannes Leonardi, Günther","10-10":"Viktor, Daniel, Samuel, Cassius","10-11":"Bruno, Edelburg, Guntmar, German","10-12":"Maximilian, Horst, Seraphin, Wilfried","10-13":"Eduard, Gerald, Koloman, Isabella","10-14":"Kalixtus, Burkhard, Hildegund, Herta","10-15":"Theresia v. Avila, Aurelia, Herfried, Roger","10-16":"Hedwig, Gallus, Margareta Maria Alacoque","10-17":"Ignatius v. Antiochien, Rudolf, Auguste","10-18":"Lukas Ev., Heinrich, Justus, Florian","10-19":"Paul vom Kreuz, Laura, Isaak, Frieda","10-20":"Wendelin, Vitalis, Iris, Adeline","10-21":"Ursula, Clementine, Irmtraud, Celine","10-22":"Cordula, Ingobert, Corinna, Salome","10-23":"Johannes v. Capestrano, Roman, Severin, Ute","10-24":"Antonius Maria Claret, Gilbert, Thaddäus, Gisbert","10-25":"Krispin, Margarete, Daria, Ludwig","10-26":"Albuin, Sigibald","10-27":"Sabine, Wolfhart, Galfard, Kerstin","10-28":"Simon und Judas, Alfred, Faro, Luzian","10-29":"Jolanda, Narziss, Hermelinde, Melinda","10-30":"Claudia, Gerard, Alfons, Dieter, German","10-31":"Wolfgang, Christoph, Notburga, Jutta","11-01":"Harald, Sigurd, Luitpold","11-02":"Tobias, Viktoria, Margot","11-03":"Martin v. Porres, Pirmin, Hubert, Berthold","11-04":"Karl Borromäus, Emmerich, Franziska","11-05":"Berthild, Zacharias, Elisabeth, Sibylle","11-06":"Leonhard, Christine, Margarete, Rudolf","11-07":"Willibrord, Karin, Brunhilde, Engelbert","11-08":"Gottfried, Claudius, Gregor, Severus","11-09":"Theodor, Roland","11-10":"Leo der Große, Andreas, Noe, Justus","11-11":"Martin, Hadmund, Heinrich, Bodo","11-12":"Josaphat, Christian, Kunibert, Emil","11-13":"Stanislaus, Eugen, Diego, Sighard","11-14":"Alberich, Waldemar, Sidonie, Lorenz","11-15":"Leopold v. Österreich, Albert der Große, Ilona","11-16":"Margareta, Edmund, Othmar, Walter","11-17":"Gertrud v. Helfta, Gregor, Hilda, Salome","11-18":"Odo, Roman","11-19":"Elisabeth v. Thüringen, Mechthild, Egbert, Toto","11-20":"Edmund, Humbert, Bernward, Felix","11-21":"Rufus, Alma","11-22":"Cäcilia, Ava, Sibylle, Rüdiger, Markus","11-23":"Kolumban, Klemens, Felicitas, Detlev","11-24":"Andreas Dung-Lac, Flora, Modestus, Emilie","11-25":"Katharina, Moses, Egbert, Imma","11-26":"Konrad, Gebhard, Sebald, Silvester","11-27":"Severin, Virgil, Oda, Günther, Birgit","11-28":"Gerhard, Gunther, Gunnar, Jakob","11-29":"Jutta, Jolanda, Radbod, Waldrich","11-30":"Andreas Ap., Benjamin, Andrea, Kerstin","12-01":"Natalie, Edmund, Arnold","12-02":"Luzius, Herta, Bianca, Bibiana","12-03":"Franz Xaver, Gerlinde, Radfried","12-04":"Barbara, Johannes v. Damaskus, Osmund","12-05":"Anno, Gerald, Hartwig, Reinhard","12-06":"Nikolaus, Denise, Heike, Asella","12-07":"Ambrosius, Josefa, Agathon, Farah","12-08":"Elfriede, Edith","12-09":"Valerie, Anastasia, Abel, Delphina","12-10":"Herbert, Diethard, Witgar, Angelina","12-11":"Damasus, Daniel, Ida, David, Wilburg","12-12":"Johanna Franziska v. Chantal, Hartmann, Amicus","12-13":"Luzia, Ottilie, Jodok, Edda, Otbert","12-14":"Johannes vom Kreuz, Konrad, Berthold","12-15":"Christiana, Reinhold, Silva, Valerian","12-16":"Adelheid, Ado, Elke, Alice, Eusebius","12-17":"Lazarus, Olympia, Jolanda, Gisela","12-18":"Wunibald, Philipp, Hildbert, Judas","12-19":"Urban V., Thea, Friedbert, Konrad","12-20":"Eugen, Dominik, Regina, Holger","12-21":"Ingomar, Anastasius, Richard, Kaspar","12-22":"Jutta, Franziska, Zeno, Judith, Marian","12-23":"Johannes v. Krakau, Dagobert, Viktoria","12-24":"Adam, Eva, Adele, Hanno","12-25":"Anastasia, Eugenie","12-26":"Stephan, Gerlinde, Senta","12-27":"Johannes Ev., Fabiola, Rüdiger, Hugo","12-28":"Theodor, Otto","12-29":"Thomas Becket, David, Tamara, Jonathan","12-30":"Rainer, Eugen, Lothar, Hermine, Egwin","12-31":"Silvester, Melanie, Gottlob, Hermes"};
const KALENDER_FESTE = {"02-17":"Sieben Gründer des Servitenordens","01-01":"Neujahr – Hochfest der Gottesmutter Maria","01-06":"Heilige Drei Könige (Epiphanie)","01-25":"Pauli Bekehrung","02-02":"Darstellung des Herrn (Mariä Lichtmess)","02-11":"Gedenktag Unserer Lieben Frau in Lourdes","02-22":"Kathedra Petri (Petri Stuhlfeier)","03-19":"Hl. Josef, Bräutigam der Gottesmutter","03-25":"Verkündigung des Herrn","05-01":"Staatsfeiertag","06-24":"Geburt Johannes des Täufers","06-29":"Petrus und Paulus","07-02":"Mariä Heimsuchung","07-16":"Unsere Liebe Frau auf dem Berge Karmel","08-05":"Weihetag der Basilika Santa Maria Maggiore","08-06":"Verklärung des Herrn","08-15":"Mariä Himmelfahrt","08-22":"Maria Königin","08-29":"Enthauptung Johannes des Täufers","09-08":"Mariä Geburt","09-12":"Mariä Namen","09-14":"Kreuzerhöhung","09-15":"Gedächtnis der Schmerzen Mariens","10-02":"Schutzengelfest","10-07":"Rosenkranzfest","10-26":"Nationalfeiertag","11-01":"Allerheiligen","11-02":"Allerseelen","11-09":"Weihetag der Lateranbasilika","11-18":"Weihetag der Basiliken St. Peter und St. Paul","11-21":"Unsere Liebe Frau in Jerusalem","12-08":"Mariä Empfängnis","12-24":"Heiliger Abend","12-25":"Christtag – Hochfest der Geburt des Herrn","12-26":"Stephanitag","12-28":"Unschuldige Kinder"};
// Österreichische gesetzliche Feiertage (fest); bewegliche kommen aus kirchenjahrTag()
const FEIERTAGE_FEST = new Set(["01-01", "01-06", "05-01", "08-15", "10-26", "11-01", "12-08", "12-25", "12-26"]);
function osterSonntag(jahr) {   // Gauß/Meeus, gregorianisch
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(jahr, monat - 1, tag);
}
// Liefert { feste: [..], sonntag: "..."|null, feiertag: bool } für einen Tag
function kirchenjahrTag(jahr, monat, tag) {
  const T = 86400000, t = Date.UTC(jahr, monat - 1, tag), wt = new Date(t).getUTCDay();
  const md = `${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
  const ostern = osterSonntag(jahr), diff = Math.round((t - ostern) / T);
  const feste = [];
  let feiertag = FEIERTAGE_FEST.has(md);
  if (KALENDER_FESTE[md]) feste.push(KALENDER_FESTE[md]);
  const beweglich = { "-47": "Fastnacht", "-46": "Aschermittwoch", "-3": "Gründonnerstag", "-2": "Karfreitag", "-1": "Karsamstag", "1": "Ostermontag",
    "39": "Christi Himmelfahrt", "50": "Pfingstmontag", "60": "Fronleichnam", "68": "Heiligstes Herz Jesu", "69": "Unbeflecktes Herz Mariä" };
  if (beweglich[diff]) feste.push(beweglich[diff]);
  if ([1, 39, 50, 60].includes(diff)) feiertag = true;
  // Advent: 1. Advent = vierter Sonntag vor dem Christtag
  const advent = (j) => { const w = Date.UTC(j, 11, 25), wd = new Date(w).getUTCDay(); return w - (wd === 0 ? 7 : wd) * T - 21 * T; };
  const advent1 = advent(jahr);
  // Quatember: Mittwoch nach dem 1. Fastensonntag, vor Pfingsten, in der ersten Oktoberwoche, nach dem 1. Advent
  const okt1 = Date.UTC(jahr, 9, 1), oktMi = okt1 + ((3 - new Date(okt1).getUTCDay() + 7) % 7) * T;
  if ([ostern - 39 * T, ostern + 45 * T, oktMi, advent1 + 3 * T].includes(t)) feste.push("Quatember");
  if (wt === 0 && monat === 5 && tag >= 8 && tag <= 14) feste.push("Muttertag");
  if (monat === 12 && tag === 30 && new Date(Date.UTC(jahr, 11, 25)).getUTCDay() === 0) feste.push("Fest der Heiligen Familie");
  let sonntag = null;
  if (wt === 0) {
    const taufe = Date.UTC(jahr, 0, 6) + (7 - new Date(Date.UTC(jahr, 0, 6)).getUTCDay()) * T;   // Sonntag nach dem 6. Jänner
    const asche = ostern - 46 * T, christkoenig = advent1 - 7 * T;
    if (t >= advent1) sonntag = monat === 12 && tag >= 26 ? "Fest der Heiligen Familie" : `${Math.round((t - advent1) / (7 * T)) + 1}. Adventsonntag`;
    else if (monat === 1 && tag >= 2 && tag <= 5) sonntag = "2. Sonntag nach Weihnachten";
    else if (t === taufe) sonntag = "Taufe des Herrn";
    else if (t > taufe && t < asche) sonntag = `${Math.round((t - taufe) / (7 * T)) + 1}. Sonntag im Jahreskreis`;
    else if (diff >= -42 && diff <= -14) sonntag = `${Math.round((diff + 49) / 7)}. Fastensonntag`;
    else if (diff === -7) sonntag = "Palmsonntag";
    else if (diff === 0) sonntag = "Ostersonntag";
    else if (diff >= 7 && diff <= 42) sonntag = `${diff / 7 + 1}. Sonntag der Osterzeit`;
    else if (diff === 49) sonntag = "Pfingstsonntag";
    else if (diff === 56) sonntag = "Dreifaltigkeitssonntag";
    else if (t === christkoenig) sonntag = "Christkönigssonntag";
    else if (diff > 56 && t < christkoenig) sonntag = `${34 - Math.round((christkoenig - t) / (7 * T))}. Sonntag im Jahreskreis`;
  }
  return { feste, sonntag, feiertag: feiertag || wt === 0 };
}
// Hundertjähriger Kalender – Wettervorhersage je Monat (sinngemäß nach dem Bauernkalender, keine echte Prognose)
const HUNDERTJAEHRIGER = {
  2027: [
    "Der ganze Monat sehr kalt, trocken und windstill; erst gegen Monatsende milder mit etwas Niederschlag.",
    "In der ersten Hälfte unfreundlich und wechselhaft, aber sehr mild; danach Schnee und Kälte.",
    "Bis über die Monatsmitte kalt mit Regen und Schnee; dann milder, aber windig und regnerisch.",
    "Meist trüb und regnerisch; um die Monatsmitte einige schöne Tage.",
    "Die erste Hälfte schön und warm; danach bis Monatsende regnerisch und kühl.",
    "Überwiegend schön; um die Monatsmitte und am Ende einige Regentage.",
    "Die erste Hälfte unbeständig und regnerisch; dann bis Monatsende schön und warm.",
    "Anfangs schön und warm; danach wochenweise Wechsel zwischen Regen und schönem, heißem Wetter.",
    "Die erste Woche schön; dann kalt und regnerisch; die zweite Hälfte sehr wechselhaft.",
    "Der ganze Monat unbeständig, regnerisch und kalt; gegen Ende sogar Schnee.",
    "Anfangs regnerisch; um die Monatsmitte schön, aber kalt; im letzten Drittel mild; zum Monatsende Schnee und Kälte.",
    "Bis über die Monatsmitte mild mit viel Regen; erst im letzten Drittel Schnee und Kälte."
  ]
};
function hundertjaehrigerFuer(jahr, monat) { const j = HUNDERTJAEHRIGER[jahr]; return j ? j[monat - 1] : null; }
function kirchenZeileHtml(k) {
  if (!k || (!k.feste.length && !k.sonntag)) return "";
  const teile = [k.sonntag, ...k.feste].filter((x, i, a) => x && a.indexOf(x) === i);
  return `<p class="tb-kirche${k.feiertag ? " tb-kirche--fest" : ""}">⛪ ${teile.map((x, i) => i === 0 ? `<strong>${chrEsc(x)}</strong>` : chrEsc(x)).join(" · ")}</p>`;
}

/* ===================== v429: Allgemeine Suche („Alles durchsuchen“) ===================== */
// Durchsucht Namen, Todesumstand, Notizen, Häuser, Lebensjahre und das Zeitgeschehen.
// Intelligent: Umlaute/Groß-Klein egal, verwandte Begriffe (gefallen → Krieg, vermisst …),
// Jahre („1910“), Jahrzehnte („1910er“), Zeiträume („1914-1918“), „geboren 1880“, „gestorben 1954“, „Frauen“/„Männer“.
const ALLG_BEGRIFFE = [
  ["gefallen", "gefallen", "gefall", "krieg", "weltkrieg", "front", "soldat", "kaiserjager", "kriegsopfer", "vermisst", "verschollen", "gefangenschaft"],
  ["vermisst", "vermisst", "verschollen", "abgangig"],
  ["lawine", "lawine", "lawinen", "verschuttet", "schneebrett"],
  ["verunglückt", "verunglu", "unfall", "abgesturzt", "absturz", "todlich", "ertrunken", "ertrank", "erfroren", "blitz"],
  ["ertrunken", "ertrunken", "ertrank", "hochwasser"],
  ["hochwasser", "hochwasser", "uberschwemmung", "mure", "murgang"],
  ["ausgewandert", "ausgewandert", "auswanderung", "amerika", "usa", "kanada", "argentinien", "brasilien", "zog nach"],
  ["krankheit", "krankheit", "pest", "cholera", "typhus", "grippe", "seuche", "pocken", "tuberkulose"],
  ["kirche", "pfarrer", "priester", "kaplan", "pater", "kloster", "ordensschwester", "mesmer"],
  ["schule", "schule", "lehrer", "lehrerin", "schulhaus"],
  ["hochzeit", "getraut", "hochzeit", "oo", "trauung", "geheiratet", "heiratete"],
  ["ledig", "ledig", "unverheiratet"]
].map((g) => g.map((w) => (typeof PersonSuche !== "undefined" ? PersonSuche.normalisiere(w) : w.toLowerCase())));

function allgVarianten(t) {
  const v = new Set([t]);
  if (t.length >= 4) for (const g of ALLG_BEGRIFFE) if (g.some((w) => w.startsWith(t) || (w.length >= 4 && t.startsWith(w)))) g.forEach((w) => v.add(w));
  return [...v];
}
const allgNorm = (x) => PersonSuche.normalisiere(x);

// Normalisiert vergleichen („Frauen“ wird durch die ue→u-Regel zu „fraun“)
const ALLG_FRAU = new Set(["frau", "frauen", "weiblich", "tochter", "tochtern", "töchter"].map((w) => PersonSuche.normalisiere(w)));
const ALLG_MANN = new Set(["mann", "männer", "männlich", "sohn", "söhne", "buben"].map((w) => PersonSuche.normalisiere(w)));
function allgemeineSuche(d, eingabe, { leser = false } = {}) {
  let roh = String(eingabe || "").trim();
  const erg = { personen: [], haeuser: [], ereignisse: [], hinweise: [] };
  if (!roh) return erg;
  // Zeiträume und Jahrzehnte vor dem Normalisieren erkennen
  let von = null, bis = null;
  roh = roh.replace(/\b(1[0-9]{3}|20[0-9]{2})\s*[-–]\s*(1[0-9]{3}|20[0-9]{2})\b/, (_, a, b) => { von = +a; bis = +b; return " "; });
  roh = roh.replace(/\b(1[0-9]{3}|20[0-9]{2})(?:er|er jahre)\b/i, (_, a) => { von = +a - (+a % 10); bis = von + 9; return " "; });
  let tokens = allgNorm(roh).split(" ").filter(Boolean);
  let nur = null; // "geb" | "gest"
  let geschlecht = null;
  tokens = tokens.filter((t) => {
    if (/^(geb|geboren|geburt|geburtsjahr)$/.test(t)) { nur = "geb"; return false; }
    if (/^(gest|gestorben|tod|todesjahr|starb|verstorben)$/.test(t)) { nur = "gest"; return false; }
    if (ALLG_FRAU.has(t)) { geschlecht = "w"; return false; }
    if (ALLG_MANN.has(t)) { geschlecht = "m"; return false; }
    if (/^(im|in|am|von|der|die|das|und|mit|jahr|jahre)$/.test(t)) return false;
    return true;
  });
  // einzelnes Jahr als Zeitraum behandeln
  tokens = tokens.filter((t) => { if (/^(1[0-9]{3}|20[0-9]{2})$/.test(t) && von === null) { von = bis = +t; return false; } return true; });
  if (!tokens.length && von === null && !geschlecht) return erg;

  const imZeitraum = (j) => j && von !== null && j >= von && j <= bis;
  const haus = new Map(d.haeuser.map((h) => [h.id, h]));
  const hausText = (h) => [h.ort, h.nummer, h.name].filter(Boolean).join(" ");
  const hausVon = new Map();
  for (const st of d.stationen) { const h = haus.get(st.haus_id); if (!h) continue; if (!hausVon.has(st.personen_id)) hausVon.set(st.personen_id, []); hausVon.get(st.personen_id).push(h); }
  const variantenListe = tokens.map(allgVarianten);
  const trifftWort = (text, v) => v.some((w) => (/^\d{1,3}$/.test(w) ? new RegExp(`(^|\\D)${w}(\\D|$)`).test(text) : w.length <= 3 ? new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(text) : text.includes(w)));   // kurze Wörter nur als ganzes Wort

  for (const p of d.personen) {
    if (geschlecht && String(p.geschlecht || "").charAt(0).toLowerCase() !== geschlecht) continue;   // „weiblich“ / „männlich“
    const gj = chrGebJahr(p), tj = chrTodJahr(p);
    const gebZaehlt = !(leser && chrVermutlichLebend(p));
    if (von !== null) {
      const ok = nur === "geb" ? (gebZaehlt && imZeitraum(gj)) : nur === "gest" ? imZeitraum(tj) : ((gebZaehlt && imZeitraum(gj)) || imZeitraum(tj));
      if (!ok) continue;
    }
    const felder = [
      ["Name", allgNorm([p.vorname, p.nachname, p.Ledigenname].filter(Boolean).join(" ")), [p.vorname, p.nachname, p.Ledigenname && `geb. ${p.Ledigenname}`].filter(Boolean).join(" "), 3],
      ["Todesumstand", allgNorm(typeof todesumstandText === "function" ? todesumstandText(p) : [p.todesumstand, p.todesumstand_text].join(" ")), typeof todesumstandText === "function" ? todesumstandText(p) : "", 3],
      ["Notiz", allgNorm(p.Notiz || ""), String(p.Notiz || ""), 2],
      ["Haus", allgNorm((hausVon.get(p.id) || []).map(hausText).join(" · ")), (hausVon.get(p.id) || []).map(hausText).join(" · "), 2]
    ];
    let punkte = 0; const fundstellen = [];
    let alle = true;
    for (const v of variantenListe) {
      let gefunden = false;
      for (const [lab, norm, orig, gew] of felder) {
        if (norm && trifftWort(norm, v)) { gefunden = true; punkte += gew + (v[0] && norm.includes(v[0]) ? 1 : 0); if (!fundstellen.some((f) => f.lab === lab)) fundstellen.push({ lab, orig, v }); }
      }
      if (!gefunden) { alle = false; break; }
    }
    if (!alle) continue;
    if (von !== null) { punkte += 1; if (!tokens.length) fundstellen.push({ lab: nur === "gest" || (!imZeitraum(gj) && imZeitraum(tj)) ? "gestorben" : "geboren", orig: String(nur === "gest" || (!imZeitraum(gj) && imZeitraum(tj)) ? tj : gj), v: [] }); }
    erg.personen.push({ p, punkte, fundstellen, gj, tj });
  }
  erg.personen.sort((a, b) => b.punkte - a.punkte || (a.gj || a.tj || 9999) - (b.gj || b.tj || 9999));

  if (!nur && !geschlecht) {
    for (const [j, text, q] of ZEITGESCHEHEN) {
      if (von !== null && !imZeitraum(j)) continue;
      const n = allgNorm(text);
      if (variantenListe.every((v) => trifftWort(n, v))) erg.ereignisse.push({ jahr: j, text, quelle: q });
    }
    if (tokens.length) for (const h of d.haeuser) {
      const n = allgNorm([hausText(h), h.notiz].join(" "));
      if (variantenListe.every((v) => trifftWort(n, v))) erg.haeuser.push(h);
    }
  }
  const erkannt = [];
  if (von !== null) erkannt.push(von === bis ? `Jahr ${von}` : `${von}–${bis}`);
  if (nur) erkannt.push(nur === "geb" ? "nur Geburt" : "nur Tod");
  if (geschlecht) erkannt.push(geschlecht === "w" ? "nur Frauen" : "nur Männer");
  variantenListe.forEach((v) => { if (v.length > 1) erkannt.push(`„${v[0]}“ inkl. ${v.slice(1, 5).join(", ")}${v.length > 5 ? " …" : ""}`); });
  erg.hinweise = erkannt;
  return erg;
}

function allgAusschnitt(orig, v) {
  const text = String(orig || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const norm = allgNorm(text);
  let pos = -1, len = 0;
  for (const w of v) { const i = norm.indexOf(w); if (i >= 0 && (pos < 0 || i < pos)) { pos = i; len = w.length; } }
  // Normalisierung kann Längen ändern (ß→ss, ae→a); Ausschnitt deshalb großzügig und ohne exakte Markierung, wenn unsicher
  if (pos < 0 || norm.length !== text.length) return chrEsc(text.length > 120 ? text.slice(0, 117) + " …" : text);
  const a = Math.max(0, pos - 45), b = Math.min(text.length, pos + len + 60);
  return `${a > 0 ? "… " : ""}${chrEsc(text.slice(a, pos))}<mark>${chrEsc(text.slice(pos, pos + len))}</mark>${chrEsc(text.slice(pos + len, b))}${b < text.length ? " …" : ""}`;
}

function allgSucheRendern(erg, ziel, eingabe) {
  if (!String(eingabe || "").trim()) { ziel.innerHTML = ""; return; }
  const n = erg.personen.length, e = erg.ereignisse.length, h = erg.haeuser.length;
  const teile = [n && `${chrZahl(n)} ${n === 1 ? "Person" : "Personen"}`, h && `${h} ${h === 1 ? "Haus" : "Häuser"}`, e && `${e} ${e === 1 ? "Ereignis" : "Ereignisse"}`].filter(Boolean);
  const MAX = 150;
  ziel.innerHTML = `
    <p class="chr-suche-summe">${teile.length ? teile.join(" · ") : "Nichts gefunden."}${erg.hinweise.length ? `<br><small>Gesucht: ${chrEsc(erg.hinweise.join(" · "))}</small>` : ""}</p>
    ${n ? `<ul class="chr-suche-liste">${erg.personen.slice(0, MAX).map((r) => `<li>${chrLink(r.p)}${r.fundstellen.filter((f) => f.lab !== "Name").map((f) => `<div class="chr-suche-fund"><span>${chrEsc(f.lab)}:</span> ${f.v.length ? allgAusschnitt(f.orig, f.v) : chrEsc(f.orig)}</div>`).join("")}</li>`).join("")}</ul>${n > MAX ? `<p class="chr-suche-summe"><small>Die ersten ${MAX} von ${chrZahl(n)} – Suche genauer eingrenzen, z. B. mit einem Jahr.</small></p>` : ""}` : ""}
    ${h ? `<h4>Häuser</h4><ul class="chr-suche-liste">${erg.haeuser.map((x) => `<li>🏠 ${chrEsc([x.ort, x.nummer].filter(Boolean).join(" "))}${x.name ? ` – ${chrEsc(x.name)}` : ""}</li>`).join("")}</ul>` : ""}
    ${e ? `<h4>Zeitgeschehen</h4><ul class="chr-suche-liste">${erg.ereignisse.map((x) => `<li><b>${x.jahr}</b> ${x.quelle === "B" ? "⛪ " : ""}${chrEsc(x.text)}</li>`).join("")}</ul>` : ""}`;
}

(function allgSucheEinrichten() {
  const feld = document.getElementById("chr-suche-feld");
  const ziel = document.getElementById("chr-suche-ergebnis");
  const inhalt = document.getElementById("chronik-inhalt");
  if (!feld || !ziel) return;
  let timer = null, lauf = 0;
  const suchen = async () => {
    const q = feld.value, nr = ++lauf;
    if (inhalt) inhalt.hidden = !!q.trim();
    if (!q.trim()) { ziel.innerHTML = ""; return; }
    try {
      const d = await chronikDatenLaden(false);
      if (nr !== lauf) return;
      allgSucheRendern(allgemeineSuche(d, q, { leser: typeof zugang !== "undefined" && zugang?.rolle === "leser" }), ziel, q);
    } catch (err) { ziel.innerHTML = `<p class="chr-suche-summe">Suche nicht möglich: ${chrEsc(err.message || err)}</p>`; }
  };
  feld.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(suchen, feld.value ? 220 : 0); });
  document.querySelectorAll(".chr-suche-chip").forEach((b) => b.addEventListener("click", () => { feld.value = b.dataset.q; feld.dispatchEvent(new Event("input", { bubbles: true })); }));
})();
