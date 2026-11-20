// Familienspuren – Stammbaum: Ansichten, Verwandtschaft (Gebirge), Cousins, Lücken & Inseln, Plausibilität, 3D
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 445

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
    <span class="tree-node__name">${pruefPunktHtml(person)}${escTree(treeAnzeigeName(person).name)}${maidenLabel}${linienBadgesHtml(person.id)}</span>
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
      return sortierVergleicher(nameA, nameB);
    });
}

function treeParentFamiliesForPerson(id) {
  return treeData.kinder.filter((k) => k.kind_id === id).map((k) => treeData.familien.find((f) => f.id === k.familie_id)).filter(Boolean);
}

async function loadStammbaumData(optionen = {}) {
  await ensureSession();
  const [{ data: personen, error: personenError }, { data: familien, error: familienError }, { data: kinder, error: kinderError }] = await Promise.all([
    personenMitPruefSpalten("id, vorname, nachname, Ledigenname, geschlecht, geburtsdatum, geburtsjahr, sterbedatum, sterbejahr", (sp) => alleZeilenLaden(() => sb.from("personen").select(sp).order("nachname", { ascending: true }).order("id", { ascending: true }))),
    alleZeilenLaden(() => sb.from("familien").select("*").order("id")),
    alleZeilenLaden(() => sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp").order("id"))
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
    // v395: Früher wurden alle Personen-IDs in die Abfrage gepackt (.in mit ~1500 IDs) – die Adresse wurde zu lang
    // und die Abfrage schlug still fehl, deshalb fehlten die Fotos. Jetzt: alle Schlüsselfotos seitenweise laden und lokal filtern.
    const idSet = new Set(ids);
    const { data: alleFotos, error: fotoError } = await alleZeilenLaden(() => sb.from("fotos")
      .select("id, personen_id, dateipfad, ist_schluesselfoto")
      .eq("ist_schluesselfoto", true)
      .order("id"));
    if (fotoError) debugLog(`❌ Stammbaum-Schlüsselfotos: ${fotoError.message}`);
    const fotos = (alleFotos || []).filter((f) => f.personen_id && idSet.has(f.personen_id));
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

// v384: Ehepaare innerhalb einer Generation nebeneinander als Paar (∞ mit Jahr), dazu „Eltern von …“
function treeGenerationRow(personIds, rootId, stammlinie, label, extraClass = "", naechsteIds = null) {
  const people = treeUniquePeople(personIds);
  if (!people.length) return null;
  const section = document.createElement("div");
  section.className = `tree-deep-generation ${extraClass}`.trim();

  const title = document.createElement("div");
  title.className = "tree-deep-generation__label";
  title.textContent = label;
  section.appendChild(title);

  const imRow = new Set(people.map((p) => p.id));
  const naechste = naechsteIds ? new Set(naechsteIds) : null;
  const benutzt = new Set();
  const teile = [];
  for (const person of people) {
    if (benutzt.has(person.id)) continue;
    benutzt.add(person.id);
    const fam = (treeFamiliesForPerson(person.id) || []).find((f) => {
      const o = f.partner_a_id === person.id ? f.partner_b_id : f.partner_a_id;
      return o && imRow.has(o) && !benutzt.has(o);
    });
    if (!fam) { teile.push(`<div class="tree-gen-einzel">${treePersonCard(person, rootId, "", stammlinie)}</div>`); continue; }
    const partnerId = fam.partner_a_id === person.id ? fam.partner_b_id : fam.partner_a_id;
    benutzt.add(partnerId);
    const partner = treePerson(partnerId);
    const jahr = fam.beginn ? String(fam.beginn).slice(0, 4) : (fam.beginn_jahr ? String(fam.beginn_jahr) : "");
    const kinder = naechste ? treeChildrenForFamily(fam.id).map((k) => k.person?.id || k.kind_id).filter((id) => id && naechste.has(id)) : [];
    const elternVon = kinder.length ? `<div class="tree-gen-paar__von">Eltern von ${kinder.map((id) => escTree(treePersonLabel(id))).join(" und ")}</div>` : "";
    // Mann links, Frau rechts – in jeder Zeile gleich
    const frau = (x) => String(x?.geschlecht || "").toLowerCase().startsWith("w");
    const [links, rechts] = partner && frau(person) && !frau(partner) ? [partner, person] : [person, partner];
    teile.push(`<div class="tree-gen-paar">
      <div class="tree-gen-paar__karten">${treePersonCard(links, rootId, "", stammlinie)}
        <div class="tree-gen-paar__ehe" aria-label="verheiratet${jahr ? ` ${jahr}` : ""}"><span>∞</span>${jahr ? `<small>${escTree(jahr)}</small>` : ""}</div>
        ${rechts ? treePersonCard(rechts, rootId, "", stammlinie) : ""}</div>${elternVon}</div>`);
  }
  const row = document.createElement("div");
  row.className = "tree-generation tree-deep-generation__row tree-gen-zeile";
  row.innerHTML = teile.join("");
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
  if (!k.person) return "";   // v411: unbekannte Vorfahren werden nicht angezeigt
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
// v385: Antippen / Doppelklick im Stammbaum – einheitlich für alle Ansichten.
// Maus: Klick wählt die Person als Mitte, Doppelklick öffnet die Personenansicht.
// iPad/iPhone: einmal tippen wählt (kurz verzögert), zweimal schnell tippen öffnet die Personenansicht.
// Tippen auf die bereits gewählte Mitte öffnet sie sofort. Der Zustand gilt über das Neuzeichnen hinweg.
let treeTippTimer = null, treeTippId = null, treeLetzteBeruehrung = 0;
function treeAktuelleMitte() { return document.getElementById("tree-person-select")?.value || ""; }
function treeWaehlen(id) { const a = document.getElementById("tree-person-select"); if (a) a.value = id; renderStammbaum(id); treeLinieMittigZeigen(id, { seite: false }); }
async function treeOeffnen(id) { const a = document.getElementById("tree-person-select"); if (a) a.value = id; await openPersonDetail(id, { fromTree: true }); }
function treeTippVerarbeiten(id) {
  // erster Tipp/Klick: kurz warten, ob ein zweiter folgt; zweiter: Personenansicht öffnen
  if (treeTippTimer && treeTippId === id) { clearTimeout(treeTippTimer); treeTippTimer = null; treeTippId = null; void treeOeffnen(id); return; }
  if (treeTippTimer) clearTimeout(treeTippTimer);
  treeTippId = id;
  const istMitte = id === treeAktuelleMitte();
  treeTippTimer = setTimeout(() => { treeTippTimer = null; treeTippId = null; if (istMitte) void treeOeffnen(id); else treeWaehlen(id); }, istMitte ? 260 : 300);
}
function treePersonEreignisse(el, id) {
  el.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    treeLetzteBeruehrung = Date.now();
    event.preventDefault();
    treeTippVerarbeiten(id);
  });
  el.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation();
    if (Date.now() - treeLetzteBeruehrung < 800) return; // schon über die Berührung behandelt
    treeTippVerarbeiten(id);
  });
}
function treeBindPersonInteractions(container) {
  container.querySelectorAll("[data-tree-person]").forEach((el) => {
    const id = el.dataset.treePerson;
    if (id) treePersonEreignisse(el, id);
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
    stage.innerHTML = treeLeerHtml();
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
    // v411: Linien nur zu erfassten Eltern
    const bekannte = [vater, mutter].filter((e) => e?.person);
    if (!bekannte.length) continue;
    const x1 = k.gen * (m.cardW + m.gap) + m.cardW;
    const x2 = (k.gen + 1) * (m.cardW + m.gap);
    const xm = x1 + m.gap / 2;
    const y1 = mitteY(k);
    const ys = bekannte.map(mitteY);
    const yTop = Math.min(y1, ...ys), yBot = Math.max(y1, ...ys);
    pfade.push(`M${x1} ${y1}H${xm}M${xm} ${yTop}V${yBot}` + ys.map((y) => `M${xm} ${y}H${x2}`).join(""));
  }

  const bekannt = knoten.filter((k) => k.person && k.gen > 0).length;
  const moeglich = 2 ** gens - 2;
  const spaltenKopf = Array.from({ length: gens }, (_, g) =>
    `<div class="tree-ped-colhead" style="left:${g * (m.cardW + m.gap)}px;top:${m.head - 26}px;width:${m.cardW}px">${g === 0 ? "Ausgangsperson" : escTree(treeGenerationName(g, "up"))}</div>`).join("");
  const karten = knoten.map((k) => treePedigreeNodeHtml(k, m, mitteY(k), rootId)).join("");

  // v390: links neben der Ausgangsperson eine Spalte „Kinder“ – antippen macht das Kind zur Mitte (eine Generation nach links)
  const kinderIds = [];
  for (const f of treeFamiliesForPerson(rootId) || []) for (const k of treeChildrenForFamily(f.id) || []) if (k.kind_id && !kinderIds.includes(k.kind_id) && treePerson(k.kind_id)) kinderIds.push(k.kind_id);
  kinderIds.sort((a, b) => String(treePerson(a)?.geburtsdatum || treePerson(a)?.geburtsjahr || "9999").localeCompare(String(treePerson(b)?.geburtsdatum || treePerson(b)?.geburtsjahr || "9999")));
  const kw = Math.round(m.cardW * 0.8), kh = 52, kAbstand = 60;
  const ox = kinderIds.length ? kw + m.gap : 0;
  const wurzelY = mitteY(knoten.find((k) => k.gen === 0) || { idx: 0, gen: 0 });
  let kinderTop = Math.max(m.head, wurzelY - (kinderIds.length * kAbstand - (kAbstand - kh)) / 2);
  const gesamtHoehe = Math.max(hoehe, kinderTop + kinderIds.length * kAbstand + 10);
  const kinderHtml = kinderIds.map((id, i) => {
    const p = treePerson(id); const y = kinderTop + i * kAbstand;
    const jahre = treeYearsText(p);
    return `<button type="button" class="tree-ped-kind" data-tree-person="${escTree(id)}" style="left:0;top:${y}px;width:${kw}px;height:${kh}px" title="${escTree(treePersonLabel(id))} – antippen: zur Mitte machen, zweimal: Personenansicht">`
      + `<strong>${escTree(treeAnzeigeName(p).name)}</strong>${jahre ? `<small>${escTree(jahre)}</small>` : ""}</button>`;
  }).join("");
  const kinderLinien = kinderIds.map((id, i) => {
    const y = kinderTop + i * kAbstand + kh / 2, xm = kw + m.gap / 2;
    return `M${kw} ${y}H${xm}V${wurzelY}H${ox}`;
  }).join("");
  const kinderKopf = kinderIds.length ? `<div class="tree-ped-colhead" style="left:0;top:${m.head - 26}px;width:${kw}px">Kinder</div>` : "";

  stage.style.width = `${breite + ox}px`;
  stage.style.height = `${gesamtHoehe}px`;
  stage.innerHTML = `<div class="tree-ped-caption" style="max-width:${Math.max(380, Math.min(breite + ox, 640))}px">Ahnentafel von <strong>${escTree(treePersonLabel(rootId))}</strong> · ${bekannt} von ${moeglich} Vorfahren in ${gens} Generationen erfasst${treeActivePreset?.label ? ` · Linie: ${escTree(treeActivePreset.label)}` : ""}</div>`
    + kinderKopf
    + (kinderIds.length ? `<svg class="tree-ped-lines" width="${ox}" height="${gesamtHoehe}" viewBox="0 0 ${ox} ${gesamtHoehe}" aria-hidden="true" style="left:0"><path d="${kinderLinien}"/></svg>` : "")
    + kinderHtml
    + `<div class="tree-ped-ahnen" style="position:absolute;left:${ox}px;top:0;width:${breite}px;height:${hoehe}px">`
    + spaltenKopf
    + `<svg class="tree-ped-lines" width="${breite}" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}" aria-hidden="true"><path d="${pfade.join("")}"/></svg>`
    + karten + `</div>`;
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
    + `<span class="tree-desc__text"><span class="tree-desc__name">${treeDescNameHtml(p)}${linienBadgesHtml(p.id)}</span>${jahre ? `<span class="tree-desc__years">${escTree(jahre)}</span>` : ""}</span>`
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
    stage.innerHTML = treeLeerHtml();
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

// v411: Verlauf der Stammbaum-Ansichten – „← Zurück“ führt zur vorigen Ansicht
// v418: Verlauf mit Zeiger – „←“ zurück und „→“ wieder vor (wie im Browser)
let treeVerlauf = [];
let treeVerlaufPos = -1;
let treeVerlaufWiederherstellen = false;
const TREE_ANSICHT_NAMEN = { classic: "Familie", cards: "Generationen", pedigree: "Ahnentafel", descendants: "Nachkommen", tree3d: "3D-Baum" };
function treeVerlaufMerken(rootId) {
  if (treeVerlaufWiederherstellen || !rootId) return;
  const z = { root: rootId, mode: treeViewMode, preset: document.getElementById("tree-line-preset")?.value || "", presetObj: treeActivePreset };
  const l = treeVerlauf[treeVerlaufPos];
  if (l && l.root === z.root && l.mode === z.mode && l.preset === z.preset) return;
  treeVerlauf = treeVerlauf.slice(0, treeVerlaufPos + 1);   // neue Ansicht verwirft den „Vor“-Teil
  treeVerlauf.push(z);
  if (treeVerlauf.length > 40) treeVerlauf.shift();
  treeVerlaufPos = treeVerlauf.length - 1;
  treeZurueckKnopfAktualisieren();
}
function treeZurueckKnopfAktualisieren() {
  const b = document.getElementById("tree-zurueck"), f = document.getElementById("tree-vor");
  const v = treeVerlauf[treeVerlaufPos - 1], n = treeVerlauf[treeVerlaufPos + 1];
  if (b) { b.disabled = !v; b.title = v ? `Zurück zu: ${TREE_ANSICHT_NAMEN[v.mode] || ""} · ${treePersonLabel(v.root)}` : "Keine vorige Ansicht"; }
  if (f) { f.disabled = !n; f.title = n ? `Wieder vor zu: ${TREE_ANSICHT_NAMEN[n.mode] || ""} · ${treePersonLabel(n.root)}` : "Keine weitere Ansicht"; }
}
function treeVerlaufGehe(pos) {
  const v = treeVerlauf[pos];
  if (!v) return;
  treeVerlaufPos = pos;
  treeVerlaufWiederherstellen = true;
  try {
    const sel = document.getElementById("tree-person-select"), such = document.getElementById("tree-person-search"), pre = document.getElementById("tree-line-preset");
    if (sel) { if (![...sel.options].some((o) => o.value === v.root)) sel.appendChild(new Option(treePersonLabel(v.root), v.root)); sel.value = v.root; }
    if (such) such.value = treePersonLabel(v.root);
    if (pre) pre.value = v.preset;
    treeActivePreset = v.presetObj || null;
    setTreeViewMode(v.mode, v.root);
    renderStammbaum(v.root);
    try { treeLinieMittigZeigen(v.root); } catch {}
  } finally { treeVerlaufWiederherstellen = false; }
  treeZurueckKnopfAktualisieren();
}
function treeZurueck() { if (treeVerlaufPos > 0) treeVerlaufGehe(treeVerlaufPos - 1); }
function treeVor() { if (treeVerlaufPos < treeVerlauf.length - 1) treeVerlaufGehe(treeVerlaufPos + 1); }
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tree-zurueck")?.addEventListener("click", treeZurueck);
  document.getElementById("tree-vor")?.addEventListener("click", treeVor);
});

function renderStammbaum(rootId) {
  if (!treeFilterAktiv) treeVerlaufMerken(rootId);
  // v417: Suchfeld zeigt immer die aktuell dargestellte Person (vorher blieb dort der Name der vorigen Person stehen)
  if (!treeFilterAktiv && rootId) {
    const such = document.getElementById("tree-person-search");
    if (such && document.activeElement !== such) { const t = treePersonLabel(rootId); if (t && such.value !== t) such.value = t; }
  }
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
    stage.innerHTML = treeLeerHtml();
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
      "tree-deep-generation--ancestor",
      i === 0 ? [rootId] : ancestorLevels[i - 1]
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
          ${partner ? `<div class="tree-relationship ${isMarriage ? "tree-relationship--marriage" : ""}" aria-label="${escTree(relationType)}">
            <span class="tree-marriage__label">${escTree(relationType)}</span>
            ${isMarriage ? `<span class="tree-marriage__rings" aria-hidden="true">◯◯</span>` : `<span class="tree-partner-link" aria-hidden="true"></span>`}
          </div>
          ${partnerCard}` : ""}
        </div>`;   // v411: ohne bekannten Partner keine Platzhalter-Karte
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

  treeBindPersonInteractions(stage);
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

// v419: „Ururgroßmutter“ statt „UrUrgroßmutter“
function treeUrVorsilbe(n) { return n > 0 ? "Ur" + "ur".repeat(n - 1) : ""; }

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
    return `${treeUrVorsilbe(bDistance - 2)}groß${sourceWord("vater", "mutter")}`;
  }

  // A ist direkter Nachkomme von B.
  if (bDistance === 0) {
    if (aDistance === 1) return sourceWord("Sohn", "Tochter");
    if (aDistance === 2) return sourceWord("Enkel", "Enkelin");
    return `${treeUrVorsilbe(aDistance - 2)}enkel${sourceGender === "w" ? "in" : ""}`;
  }

  // Seitenlinie: gleicher gemeinsamer Vorfahr.
  if (aDistance === 1 && bDistance >= 2) {
    const grade = bDistance - 2;
    if (grade === 0) return sourceWord("Onkel", "Tante");
    if (grade === 1) return sourceWord("Großonkel (1. Grades)", "Großtante (1. Grades)");
    return sourceWord(`${treeUrVorsilbe(grade - 1)}großonkel (${grade}. Grades)`, `${treeUrVorsilbe(grade - 1)}großtante (${grade}. Grades)`);
  }

  if (bDistance === 1 && aDistance >= 2) {
    const grade = aDistance - 2;
    if (grade === 0) return sourceWord("Neffe", "Nichte");
    if (grade === 1) return sourceWord("Großneffe (1. Grades)", "Großnichte (1. Grades)");
    return sourceWord(`${treeUrVorsilbe(grade - 1)}großneffe (${grade}. Grades)`, `${treeUrVorsilbe(grade - 1)}großnichte (${grade}. Grades)`);
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

// v380: zum Elternteil im Verwandtschaftsweg auch den anderen Elternteil des betreffenden Kindes nennen
function treeAndererElternteil(elternId, kindId) {
  if (!elternId || !kindId) return null;
  const fam = (treeData.kinder || []).filter((k) => k.kind_id === kindId)
    .map((k) => (treeData.familien || []).find((f) => f.id === k.familie_id))
    .find((f) => f && (f.partner_a_id === elternId || f.partner_b_id === elternId));
  if (!fam) return null;
  const anderer = fam.partner_a_id === elternId ? fam.partner_b_id : fam.partner_a_id;
  return anderer && treePerson(anderer) ? anderer : null;
}
function treeGemeinsameEltern(aId, bId) {
  const famA = (treeData.kinder || []).filter((k) => k.kind_id === aId).map((k) => k.familie_id);
  const fid = (treeData.kinder || []).find((k) => k.kind_id === bId && famA.includes(k.familie_id))?.familie_id;
  const f = fid ? (treeData.familien || []).find((x) => x.id === fid) : null;
  return f ? [f.partner_a_id, f.partner_b_id].filter((id) => id && treePerson(id)) : [];
}
function treeWegPartner(aId, path) {
  // liefert je Person im Weg den Ehepartner, mit dem das Kind im Weg gemeinsam ist
  const ids = [aId, ...path.map((e) => e.to)];
  const partner = new Map();
  path.forEach((e, i) => {
    const von = ids[i], zu = ids[i + 1];
    if (e.type === "parent") { const o = treeAndererElternteil(zu, von); if (o && !ids.includes(o)) partner.set(zu, o); }
    if (e.type === "child") { const o = treeAndererElternteil(von, zu); if (o && !ids.includes(o)) partner.set(von, o); }
  });
  return partner;
}
function treeHumanRelationshipPath(aId, path) {
  if (!path || !path.length) return "";
  const partner = treeWegPartner(aId, path);
  const mitPartner = (id) => partner.has(id) ? `${treePersonLabel(id)} und ${treePersonLabel(partner.get(id))}` : treePersonLabel(id);
  const steps = [];
  let currentId = aId;
  for (const e of path) {
    let ziel = (e.type === "parent") ? mitPartner(e.to) : treePersonLabel(e.to);
    if (e.type === "sibling") {
      const ge = treeGemeinsameEltern(currentId, e.to);
      if (ge.length) ziel += ` (beide Kinder von ${ge.map(treePersonLabel).join(" und ")})`;
    }
    steps.push(`${treeRelationshipStepWord(currentId, e.type, e.to)} ${ziel}`);
    currentId = e.to;
  }
  return steps.join(" → ");
}

// v386: Verwandtschaftsweg als „Gebirge“: Höhe = Generation, links Person 1, rechts Person 2,
// Gipfel = gemeinsame Vorfahren, waagrechte ∞-Brücke = Ehe, gestrichelt = Geschwister.
function treeRelationshipMountain(aId, path) {
  if (!path?.length) return "";
  const partner = treeWegPartner(aId, path);
  // Geschwister-Schritt: die gemeinsamen Eltern als Gipfel dazwischen einfügen (klassisches „V“).
  // v391: Sind die Eltern nicht erfasst, steht dort eine gestrichelte Karte „Eltern nicht erfasst“.
  const weg = [];
  let vorher = aId, platzhalter = 0;
  const halbGipfel = new Set();
  for (const e of path) {
    if (e.type === "sibling") {
      let ge = treeGemeinsameEltern(vorher, e.to);
      let halb = false;
      if (!ge.length) { // Halbgeschwister: gemeinsamer Elternteil aus verschiedenen Ehen
        const elternVon = (id) => new Set((treeData.kinder || []).filter((k) => k.kind_id === id).flatMap((k) => { const f = (treeData.familien || []).find((x) => x.id === k.familie_id); return f ? [f.partner_a_id, f.partner_b_id].filter(Boolean) : []; }));
        const ea = elternVon(vorher), eb = elternVon(e.to);
        const gemeinsam = [...ea].filter((x) => eb.has(x) && treePerson(x));
        if (gemeinsam.length) { ge = [gemeinsam[0]]; halb = true; }
      }
      const gipfelId = ge.length ? ge[0] : `__eltern_${platzhalter++}`;
      weg.push({ from: vorher, to: gipfelId, type: "parent" }, { from: gipfelId, to: e.to, type: "child" });
      if (ge[1]) partner.set(ge[0], ge[1]);
      if (halb) { halbGipfel.add(gipfelId); partner.delete(gipfelId); }
      vorher = e.to; continue;
    }
    weg.push(e); vorher = e.to;
  }
  path = weg;
  const ids = [aId, ...path.map((e) => e.to)];
  const stufe = [0];
  path.forEach((e, i) => stufe.push(stufe[i] + (e.type === "parent" ? 1 : e.type === "child" ? -1 : 0)));
  const maxL = Math.max(...stufe), minL = Math.min(...stufe);
  const W = 134, CW = 118, CH = 92, VS = 116, PAD = 14;
  const breite = ids.length * W + PAD * 2 - (W - CW), hoehe = (maxL - minL) * VS + CH + PAD * 2 + 18;
  const pos = ids.map((id, i) => ({ id, x: PAD + i * W, y: PAD + (maxL - stufe[i]) * VS, l: stufe[i] }));
  const gipfel = new Set(pos.filter((p, i) => i > 0 && i < pos.length - 1 && stufe[i] > stufe[i - 1] && stufe[i] > stufe[i + 1]).map((p) => p.id));
  const linien = path.map((e, i) => {
    const a = pos[i], b = pos[i + 1];
    if (a.l === b.l) {
      const y = a.y + CH / 2;
      return `<line x1="${a.x + CW}" y1="${y}" x2="${b.x}" y2="${y}" class="tree-mtn-ehe"/><text x="${(a.x + CW + b.x) / 2}" y="${y - 7}" class="tree-mtn-zeichen">∞</text>`;
    }
    const oben = a.l > b.l ? a : b, unten = a.l > b.l ? b : a;
    return `<line x1="${oben.x + CW / 2}" y1="${oben.y + CH}" x2="${unten.x + CW / 2}" y2="${unten.y}" class="tree-mtn-linie"/>`;
  }).join("");
  const basisY = pos[0].y + CH + 9;
  const jj = (d, j) => j || (d ? String(d).slice(0, 4) : "");
  const karten = pos.map((p, i) => {
    if (String(p.id).startsWith("__eltern_")) {
      return `<div class="tree-mtn-karte tree-mtn-karte--gipfel tree-mtn-karte--leer" style="left:${p.x}px;top:${p.y}px;width:${CW}px;height:${CH}px"><span class="tree-mtn-rolle">gemeinsam</span><strong>Eltern</strong><small>nicht erfasst</small></div>`;
    }
    const person = treePerson(p.id);
    const jahre = person ? [jj(person.geburtsdatum, person.geburtsjahr), jj(person.sterbedatum, person.sterbejahr)].filter(Boolean).join("–") : "";
    const p2 = partner.get(p.id);
    const p2p = p2 ? treePerson(p2) : null;
    const rolle = i === 0 ? "Person 1" : i === pos.length - 1 ? "Person 2" : gipfel.has(p.id) ? (halbGipfel.has(p.id) ? "gemeinsam · Halbgeschw." : "gemeinsam") : "";
    const klasse = i === 0 || i === pos.length - 1 ? " tree-mtn-karte--person" : gipfel.has(p.id) ? " tree-mtn-karte--gipfel" : "";
    const geb = (x) => x?.Ledigenname ? ` geb. ${escTree(x.Ledigenname)}` : "";
    const partnerZeile = p2p ? (gipfel.has(p.id)
      ? `<em class="tree-mtn-gipfelpartner">& ${escTree(String(p2p.vorname || "").split(/\s+/)[0])}${geb(p2p)}</em>`
      : `<em class="tree-mtn-partner">∞ ${escTree([String(p2p.vorname || "").split(/\s+/)[0], p2p.nachname].filter(Boolean).join(" "))}${p2p.Ledigenname && p2p.Ledigenname !== p2p.nachname ? geb(p2p) : ""}</em>`) : "";
    return `<button type="button" class="tree-mtn-karte${klasse}" data-rel-person="${escTree(p.id)}" style="left:${p.x}px;top:${p.y}px;width:${CW}px;height:${CH}px" title="${escTree(treePersonLabel(p.id))}${p2 ? ` ∞ ${escTree(treePersonLabel(p2))}` : ""}">
      ${rolle ? `<span class="tree-mtn-rolle">${rolle}</span>` : ""}<strong>${escTree(person ? [person.vorname, person.nachname].filter(Boolean).join(" ") : treePersonLabel(p.id))}</strong>
      ${person?.Ledigenname ? `<em class="tree-mtn-geb">geb. ${escTree(person.Ledigenname)}</em>` : ""}
      <small>${escTree(String(jahre))}</small>${partnerZeile}</button>`;
  }).join("");
  let zoom = 1, mitPartner = true;
  try { zoom = Number(localStorage.getItem("fs-mtn-zoom")) || 1; mitPartner = localStorage.getItem("fs-mtn-partner") !== "0"; } catch {}
  return `<div class="tree-mtn-rahmen${mitPartner ? "" : " ohne-partner"}">
    <div class="tree-mtn-werkzeug"><button type="button" data-mtn-zoom="-" aria-label="Verkleinern">−</button><span class="tree-mtn-zoomwert">${Math.round(zoom * 100)} %</span><button type="button" data-mtn-zoom="+" aria-label="Vergrößern">+</button>
      <button type="button" data-mtn-partner class="tree-mtn-partnerknopf${mitPartner ? " is-active" : ""}" aria-pressed="${mitPartner}">∞ Ehepartner</button></div>
    <div class="tree-mtn-scroll"><div class="tree-mtn-skala" data-b="${breite}" data-h="${hoehe}" style="width:${breite * zoom}px;height:${hoehe * zoom}px">
    <div class="tree-mtn" style="width:${breite}px;height:${hoehe}px;transform:scale(${zoom})">
    <svg class="tree-mtn-svg" width="${breite}" height="${hoehe}" aria-hidden="true">
      <line x1="${PAD - 6}" y1="${basisY}" x2="${breite - PAD + 6}" y2="${basisY}" class="tree-mtn-basis"/>${linien}</svg>${karten}</div></div></div>
    <div class="tree-mtn-legende"><span><i class="tree-mtn-l tree-mtn-l--gipfel"></i>gemeinsame Vorfahren</span><span><i class="tree-mtn-l tree-mtn-l--ehe"></i>∞ Ehe</span><span>Höhe = Generation · gestrichelt = Generation von Person 1</span></div></div>`;
}
// v424: Gebirge-Zoom gemeinsam für + / − und Zwei-Finger-Geste
function mtnZoomLesen() { let z = 1; try { z = Number(localStorage.getItem("fs-mtn-zoom")) || 1; } catch {} return z; }
function mtnZoomSetzen(rahmen, zoom, { merken = true } = {}) {
  zoom = Math.min(1.6, Math.max(0.4, +(+zoom).toFixed(2)));
  const skala = rahmen?.querySelector(".tree-mtn-skala"), mtn = rahmen?.querySelector(".tree-mtn");
  if (merken) { try { localStorage.setItem("fs-mtn-zoom", String(zoom)); } catch {} }
  if (skala && mtn) { mtn.style.transform = `scale(${zoom})`; skala.style.width = `${skala.dataset.b * zoom}px`; skala.style.height = `${skala.dataset.h * zoom}px`; }
  const w = rahmen?.querySelector(".tree-mtn-zoomwert"); if (w) w.textContent = `${Math.round(zoom * 100)} %`;
  return zoom;
}
document.addEventListener("click", (e) => {
  const k = e.target.closest?.("[data-rel-person]");
  if (k) { e.preventDefault(); openPersonDetail(k.dataset.relPerson, { fromTree: true }); return; }
  const z = e.target.closest?.("[data-mtn-zoom]");
  if (z) {
    const rahmen = z.closest(".tree-mtn-rahmen"), skala = rahmen?.querySelector(".tree-mtn-skala"), mtn = rahmen?.querySelector(".tree-mtn");
    mtnZoomSetzen(rahmen, Math.round((mtnZoomLesen() + (z.dataset.mtnZoom === "+" ? 0.1 : -0.1)) * 10) / 10);
    return;
  }
  const pk = e.target.closest?.("[data-mtn-partner]");
  if (pk) {
    const rahmen = pk.closest(".tree-mtn-rahmen"); const an = rahmen.classList.toggle("ohne-partner") === false;
    pk.classList.toggle("is-active", an); pk.setAttribute("aria-pressed", String(an));
    try { localStorage.setItem("fs-mtn-partner", an ? "1" : "0"); } catch {}
    return;
  }
  const t = e.target.closest?.("[data-rel-ansicht]");
  if (t) {
    const wahl = t.dataset.relAnsicht;
    try { localStorage.setItem("fs-rel-ansicht", wahl); } catch {}
    const box = t.closest(".tree-rel-ergebnis");
    box?.querySelectorAll("[data-rel-ansicht]").forEach((b) => b.classList.toggle("is-active", b.dataset.relAnsicht === wahl));
    box?.querySelector(".tree-mtn-rahmen")?.toggleAttribute("hidden", wahl !== "gebirge");
    box?.querySelector(".tree-relationship-graphic")?.toggleAttribute("hidden", wahl !== "liste");
  }
});
function treeRelationshipDarstellung(aId, path) {
  if (!path?.length) return "";
  let wahl = "gebirge";
  try { wahl = localStorage.getItem("fs-rel-ansicht") || "gebirge"; } catch {}
  const liste = treeRelationshipPathGraphic(aId, path).replace('<div class="tree-relationship-graphic"', `<div class="tree-relationship-graphic"${wahl === "liste" ? "" : " hidden"}`);
  const gebirge = treeRelationshipMountain(aId, path).replace(/<div class="tree-mtn-rahmen([^"]*)">/, (m0, k) => `<div class="tree-mtn-rahmen${k}"${wahl === "gebirge" ? "" : " hidden"}>`);
  return `<div class="tree-rel-ergebnis"><div class="tree-rel-umschalter" role="group" aria-label="Darstellung"><button type="button" data-rel-ansicht="gebirge" class="${wahl === "gebirge" ? "is-active" : ""}">Gebirge</button><button type="button" data-rel-ansicht="liste" class="${wahl === "liste" ? "is-active" : ""}">Liste</button></div>${gebirge}${liste}</div>`;
}

function treeRelationshipPathGraphic(aId, path) {
  if (!path || !path.length) return "";
  const items = [{ id: aId, label: treePersonLabel(aId) }];
  let currentId = aId;
  for (const edge of path) {
    const relationLabel = treeRelationshipStepWord(currentId, edge.type, edge.to);
    const ge = edge.type === "sibling" ? treeGemeinsameEltern(currentId, edge.to) : [];
    items.push({ id: edge.to, label: treePersonLabel(edge.to), relationLabel, elternHinweis: ge.length ? `beide Kinder von ${ge.map(treePersonLabel).join(" und ")}` : "" });
    currentId = edge.to;
  }
  const partner = treeWegPartner(aId, path);
  return `<div class="tree-relationship-graphic" aria-label="Grafischer Verwandtschaftspfad">${items.map((item, index) => {
    const person = treePerson(item.id);
    const dates = person ? [person.geburtsjahr, person.sterbejahr].filter(Boolean).join("–") : "";
    const p2 = partner.get(item.id);
    const p2Person = p2 ? treePerson(p2) : null;
    const p2Daten = p2Person ? [p2Person.geburtsjahr, p2Person.sterbejahr].filter(Boolean).join("–") : "";
    const partnerZeile = p2 ? `<span class="tree-relationship-partner">∞ ${escTree(treePersonLabel(p2))}${p2Daten ? ` <small>${escTree(String(p2Daten))}</small>` : ""}</span>` : "";
    const card = `<div class="tree-relationship-node" data-tree-relation-node="${escTree(item.id)}"><strong>${escTree(item.label)}</strong>${dates ? `<small>${escTree(String(dates))}</small>` : ""}${partnerZeile}</div>`;
    if (index === 0) return card;
    return `<div class="tree-relationship-arrow" aria-hidden="true"><span>${escTree(item.relationLabel)}</span>${item.elternHinweis ? `<small class="tree-relationship-eltern">${escTree(item.elternHinweis)}</small>` : ""}<b>↓</b></div>${card}`;
  }).join("")}</div>`;
}

function treeRelationshipSentence(aId, bId, relation) {
  const a = treePersonLabel(aId);
  const b = treePersonLabel(bId);
  if (!relation || relation === "dieselbe Person") return relation ? `${a} und ${b} sind dieselbe Person.` : "";
  // v425: Hauptwörter (Großmutter, Cousine …) groß lassen; Eigenschaftswörter als „ist mit … angeheiratet verwandt“
  if (/^[a-zäöü]/.test(relation)) return `${a} ist mit ${b} ${relation.replace(/\s+(mit|von)$/, "")}.`;
  return `${a} ist ${relation} von ${b}.`;
}

// ---------- v440: Angeheiratete Verwandtschaft in Worten (Ehemann der Tante, Tante der Ehefrau …) ----------
// Nur für nähere Verwandtschaft: der Blutsverwandte auf dem Weg ist höchstens Cousin/Cousine (seitlich)
// und höchstens 6 Generationen entfernt – also „nicht über 100 Ecken“.
const TREE_WEIBLICH_WORT = /(mutter|tante|nichte|schwester|tochter|enkelin|cousine|ehefrau|schwägerin)/i;
function treeWortNachGeschlecht(wort, id) {
  const g = treePersonGender(treePerson(id));
  return String(wort || "").replace("Cousin/Cousine", g === "w" ? "Cousine" : "Cousin");
}
// „Tante“ → „der Tante“, „Onkel“ → „des Onkels“, „Neffe“ → „des Neffen“, „Cousin 2. Grades“ → „des Cousins 2. Grades“
function treeGenitiv(wort, possessiv = false) {
  const teile = String(wort).split(" ");
  const kopf = teile[0];
  if (TREE_WEIBLICH_WORT.test(kopf)) return `${possessiv ? "deiner" : "der"} ${wort}`;
  let g = kopf;
  if (/e$/.test(kopf)) g = kopf + "n";
  else if (/sohn$/i.test(kopf)) g = kopf + "es";
  else if (!/s$/.test(kopf)) g = kopf + "s";
  return `${possessiv ? "deines" : "des"} ${[g, ...teile.slice(1)].join(" ")}`;
}
function treeBlutNah(blood) {
  if (!blood?.relation) return false;
  return Math.min(blood.aDistance, blood.bDistance) <= 2 && Math.max(blood.aDistance, blood.bDistance) <= 6;
}
function treePartnerVon(id) {
  const ids = new Set();
  for (const f of treeData.familien || []) {
    if (f.partner_a_id === id && f.partner_b_id) ids.add(f.partner_b_id);
    if (f.partner_b_id === id && f.partner_a_id) ids.add(f.partner_a_id);
  }
  return [...ids].filter((x) => treePerson(x));
}
function treePersonKurzname(id) {
  const p = treePerson(id);
  return p ? [p.vorname, p.nachname].filter(Boolean).join(" ") : "";
}
function treeAngeheiratet(aId, bId, model) {
  const aW = (m, w) => treeGenderWord(aId, m, w, m);
  const kandidaten = [];
  // A ist Ehepartner von B
  if (treePartnerVon(aId).includes(bId)) return { relation: aW("Ehemann", "Ehefrau"), path: [{ from: aId, to: bId, type: "spouse" }] };
  // 1) A ist Ehepartner von R, R ist blutsverwandt mit B
  for (const r of treePartnerVon(aId)) {
    if (r === bId) continue;
    const blood = treeBloodRelationship(r, bId, model);
    if (!treeBlutNah(blood)) continue;
    const rel = treeWortNachGeschlecht(blood.relation, r);
    let relation, satz = null;
    if (/^(Vater|Mutter)$/.test(rel)) relation = aW("Stiefvater", "Stiefmutter");
    else if (/^(Ur)*(ur)*[Gg]roß(vater|mutter)$|^Urgroß|^Ur+.*groß(vater|mutter)$/.test(rel) && /(vater|mutter)$/.test(rel)) {
      // Ehepartner eines direkten Vorfahren (zweite Ehe): Stiefgroßvater, Stief-Urgroßmutter …
      const w = rel.replace(/(vater|mutter)$/, aW("vater", "mutter"));
      relation = /^Groß/.test(w) ? `Stief${w.toLowerCase()}` : `Stief-${w}`;
    }
    else if (/^(Sohn|Tochter)$/.test(rel)) relation = aW("Schwiegersohn", "Schwiegertochter");
    else if (/^(Bruder|Schwester)$/.test(rel)) relation = aW("Schwager", "Schwägerin");
    else { relation = `${aW("Ehemann", "Ehefrau")} ${treeGenitiv(rel)}`; satz = { art: aW("Ehemann", "Ehefrau"), rolle: rel, ueber: r }; }
    const blutPfad = treeBuildBloodPath(r, bId, model, blood) || [];
    kandidaten.push({ relation, satz, gewicht: blood.aDistance + blood.bDistance, path: [{ from: aId, to: r, type: "spouse" }, ...blutPfad] });
  }
  // 2) A ist blutsverwandt mit S, S ist Ehepartner von B
  for (const sp of treePartnerVon(bId)) {
    if (sp === aId) continue;
    const blood = treeBloodRelationship(aId, sp, model);
    if (!treeBlutNah(blood)) continue;
    const rel = treeWortNachGeschlecht(blood.relation, aId);
    const spW = treeGenderWord(sp, "Ehemann", "Ehefrau", "Ehepartner");
    let relation, satz = null;
    if (/^(Vater|Mutter)$/.test(rel)) relation = aW("Schwiegervater", "Schwiegermutter");
    else if (/^(Bruder|Schwester)$/.test(rel)) relation = aW("Schwager", "Schwägerin");
    else if (/^(Sohn|Tochter)$/.test(rel)) relation = aW("Stiefsohn", "Stieftochter");
    else { relation = `${rel} ${treeGenitiv(spW)}`; satz = { art: rel, rolle: spW, ueber: sp }; }
    const blutPfad = treeBuildBloodPath(aId, sp, model, blood) || [];
    kandidaten.push({ relation, satz, gewicht: blood.aDistance + blood.bDistance, path: [...blutPfad, { from: sp, to: bId, type: "spouse" }] });
  }
  // 3) Schwager über Ehepartner: A ist Ehepartner eines Geschwisters von B's Ehepartner
  for (const r of treePartnerVon(aId)) for (const sp of treePartnerVon(bId)) {
    const blood = treeBloodRelationship(r, sp, model);
    if (blood?.aDistance === 1 && blood?.bDistance === 1) kandidaten.push({ relation: aW("Schwager", "Schwägerin"), satz: null, gewicht: 3, path: [{ from: aId, to: r, type: "spouse" }, { from: r, to: sp, type: "sibling" }, { from: sp, to: bId, type: "spouse" }] });
  }
  if (!kandidaten.length) return null;
  kandidaten.sort((x, y) => x.gewicht - y.gewicht);
  return kandidaten[0];
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

  // v440: nähere angeheiratete Verwandtschaft in Worten
  const ang = treeAngeheiratet(aId, bId, model);
  if (ang) {
    const satzRel = ang.satz ? `${ang.satz.art} ${treeGenitiv(ang.satz.rolle)} (${treePersonKurzname(ang.satz.ueber)})` : ang.relation;
    return {
      relation: ang.relation,
      angeheiratet: ang.satz,
      path: ang.path,
      sentence: treeRelationshipSentence(aId, bId, satzRel),
      pathText: treeHumanRelationshipPath(aId, ang.path)
    };
  }

  // Sonst: bisherige allgemeine Ermittlung über beliebige Wege
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
  // v445: Listen nur neu aufbauen, wenn sich der Personenbestand geändert hat (sonst je ~2500 Einträge pro Aufruf).
  const quelle = treeData.personen || [];
  const neuBauen = fillTreeRelationshipSelects.gebautFuer !== quelle || fillTreeRelationshipSelects.anzahl !== quelle.length
    || selects.some(s => s.options.length !== quelle.length + 1);
  if (neuBauen) {
    const personen = [...quelle].sort(personenAuswahlSortierung);
    const texte = personen.map(p => [p.id, treePersonSearchText(p)]);
    for (const select of selects) {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(new Option("— Person auswählen —", ""));
      for (const [id, text] of texte) fragment.appendChild(new Option(text, id));
      select.replaceChildren(fragment);
    }
    fillTreeRelationshipSelects.gebautFuer = quelle;
    fillTreeRelationshipSelects.anzahl = quelle.length;
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
    || sortierVergleicher(nachName(x), nachName(y));

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
  // v399: Listen sortierbar (Nachname, Vorname, Geburtsdatum) + Liste aller erfassten Namen
  const gebSchluessel = (p) => { const d = String(p?.geburtsdatum || "").slice(0, 10); return d || (p?.geburtsjahr ? `${p.geburtsjahr}-99-99` : "9999-99-99"); };
  const gebText = (p) => { const d = String(p?.geburtsdatum || "").slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, m, t] = d.split("-"); return `${t}.${m}.${y}`; } return p?.geburtsjahr ? String(p.geburtsjahr) : ""; };
  const zeileSortierbar = (id, mitGeburt) => {
    const p = byId.get(id) || {};
    const nach = String(p.nachname || p.Ledigenname || "").toLocaleLowerCase("de") || "\uffff"; // ohne Nachname ans Ende
    const vor = String(p.vorname || "").toLocaleLowerCase("de");
    const geb = gebText(p);
    return `<li data-nach="${escTree(nach)}" data-vor="${escTree(vor)}" data-geb="${escTree(gebSchluessel(p))}">${nameKnopf(id)}${mitGeburt && geb ? ` <span class="tree-cousins__years">* ${escTree(geb)}</span>` : jahre(p)}</li>`;
  };
  const liste = (titel, ids, mitGeburt = false, offen = false) => ids.length ? `<details class="tree-luecken__details"${offen ? " open" : ""}><summary>${titel} (${ids.length})</summary><ul class="tree-luecken__liste tree-luecken__sortierbar">${ids.map((id) => zeileSortierbar(id, mitGeburt)).join("")}</ul></details>` : "";
  html += `<div class="tree-luecken__sortierung"><span>Listen sortieren nach</span>
    <button type="button" data-luecken-sort="nach" class="is-active">Nachname</button><button type="button" data-luecken-sort="vor">Vorname</button><button type="button" data-luecken-sort="geb">Geburtsdatum</button></div>`;
  html += liste("Alle Personen ohne Eltern", analyse.ohneEltern) + liste("Alle Personen ohne Kinder", analyse.ohneKinder)
    + liste("Alle erfassten Namen", [...byId.keys()], true);
  ziel.innerHTML = html;
  treeLueckenSortieren(ziel, "nach");
}
function treeLueckenSortieren(ziel, nach) {
  const vgl = (a, b, k) => String(a.dataset[k] || "").localeCompare(String(b.dataset[k] || ""), "de");
  const reihen = { nach: ["nach", "vor", "geb"], vor: ["vor", "nach", "geb"], geb: ["geb", "nach", "vor"] }[nach] || ["nach", "vor", "geb"];
  ziel.querySelectorAll(".tree-luecken__sortierbar").forEach((ul) => {
    const lis = [...ul.children];
    lis.sort((a, b) => { for (const k of reihen) { const r = vgl(a, b, k); if (r) return r; } return 0; });
    ul.append(...lis);
  });
  ziel.querySelectorAll("[data-luecken-sort]").forEach((b) => b.classList.toggle("is-active", b.dataset.lueckenSort === nach));
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
      const { data, error } = await alleZeilenLaden(() => sb.from("beziehung").select("id, personen_a_id, personen_b_id, beziehungstyp").order("id"));
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
    const sortKnopf = e.target.closest("[data-luecken-sort]");
    if (sortKnopf) { treeLueckenSortieren(e.currentTarget, sortKnopf.dataset.lueckenSort); return; }
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
  const beginn = plausZeit(fam?.beginn || (fam?.beginn_jahr ? String(fam.beginn_jahr) : null)), ende = plausZeit(fam?.ende || (fam?.ende_jahr ? String(fam.ende_jahr) : null));
  const art = String(fam?.familientyp || "Partnerschaft") === "Ehe" ? "Die Ehe" : "Die Partnerschaft";
  if (beginn && ende && beginn.von > ende.bis) f.push(plausF("fehler", `${art} endet (${personViewDatum(familieEndeWert(fam))}) vor ihrem Beginn (${personViewDatum(familieBeginnWert(fam))}).`, ids));
  for (const p of [a, b]) {
    if (!p) continue;
    const g = plausGeb(p), t = plausTod(p);
    if (beginn && g) {
      if (beginn.bis < g.von) f.push(plausF("fehler", `${art} beginnt (${personViewDatum(familieBeginnWert(fam))}) vor der Geburt von ${plausName(p)}.`, ids));
      else if ((plausMitte(beginn) - plausMitte(g)) / PLAUS_JAHR < PLAUS.heiratMin && (beginn.bis - g.von) / PLAUS_JAHR < PLAUS.heiratMin) f.push(plausF("warnung", `${plausName(p)} wäre bei Beginn ${art === "Die Ehe" ? "der Ehe" : "der Partnerschaft"} erst ca. ${plausJ(plausMitte(beginn) - plausMitte(g))} Jahre alt.`, ids));
    }
    if (beginn && t && beginn.von > t.bis) f.push(plausF("fehler", `${art} beginnt (${personViewDatum(familieBeginnWert(fam))}) nach dem Tod von ${plausName(p)}.`, ids));
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
      sb.from("familien").select("*").or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`)
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
    select.dataset.nutzerAuswahl = "1"; // v375: echte Auswahl durch den Nutzer (nicht beim Befüllen)
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
    select.dataset.nutzerAuswahl = "1";
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
    result.innerHTML = `<strong>${escTree(found.relation)}</strong>${found.sentence ? `<div class="tree-relationship-sentence">${escTree(found.sentence)}</div>` : ""}${found.pathText ? `<div class="tree-relationship-path"><span class="tree-relationship-path-title">So ergibt sich die Beziehung:</span>${escTree(found.pathText)}</div>` : ""}${found.path?.length ? treeRelationshipDarstellung(a.value, found.path) : ""}`;
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
  return sortierVergleicher(`${a?.nachname||""} ${a?.vorname||""}`, `${b?.nachname||""} ${b?.vorname||""}`);
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
// v383: Positionen in Canvas-Koordinaten (offsetLeft/-Top), unabhängig vom Zoom (CSS scale).
// Vorher kamen die Bildschirm-Koordinaten (bereits verkleinert) in die SVG – bei 60 % saßen die Linien daneben.
function treeClassicPositions(canvas){
  const m=new Map();
  canvas.querySelectorAll("[data-classic-key]").forEach(e=>{
    const left=e.offsetLeft, top=e.offsetTop, w=e.offsetWidth, h=e.offsetHeight;
    m.set(e.dataset.classicKey,{left,right:left+w,top,bottom:top+h,centerX:left+w/2});
  });
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
  const r=pos.get(`family:${f.id}:root`),s=pos.get(`family:${f.id}:spouse`),cs=f.childIds.map(id=>pos.get(`family:${f.id}:child:${id}`)).filter(Boolean); if(!r)return;
  if(!s){ if(!cs.length)return; const by=r.bottom+Math.max(22,Math.min(46,(Math.min(...cs.map(p=>p.top))-r.bottom)*.42)); treeClassicLine(svg,r.centerX,r.bottom,r.centerX,by); const xs=cs.map(p=>p.centerX); if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by); cs.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top)); return; }
  const l=r.centerX<s.centerX?r:s, q=l===r?s:r, y=(Math.max(r.top,s.top)+Math.min(r.bottom,s.bottom))/2;
  treeClassicLine(svg,l.right,y,q.left,y,"tree-classic-spouse"); if(!cs.length)return;
  const by0=Math.max(r.bottom,s.bottom), ct=Math.min(...cs.map(p=>p.top)), by=by0+Math.max(22,Math.min(46,(ct-by0)*.42)), j=(l.right+q.left)/2;
  treeClassicLine(svg,j,by0,j,by); const xs=cs.map(p=>p.centerX); if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by); cs.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top));
}

function renderKlassischerStammbaum(rootId){
  treeCousinsRefreshIfOpen(rootId);
  const stage=document.getElementById("tree-classic-stage"); if(!stage)return; stage.innerHTML="";
  const info=treeClassicFamilyInfo(rootId); if(!info){stage.innerHTML=treeLeerHtml();return;}
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

  if(false){ // v383: auch bei einer Ehe das Paar nebeneinander zeigen (siehe unten)
    label("Eigener Familienzweig",yf);
    const f=families[0],re=canvas.querySelector(`[data-classic-key="person:${rootId}:middle"]`);
    // Der eigene Familienzweig liegt bewusst unterhalb der Geschwisterzeile.
    if(f.spouseId&&re){const rx=parseFloat(re.style.left),right=rx+card+gap,left=rx-card-gap,sx=right+card<=width-24?right:left;node(f.spouseId,`family:${f.id}:spouse`,sx,yf,"tree-classic-node--spouse");}
    if(f.childIds.length){label("Kinder",ycSingle);const total=rowW(f.childIds);let x=(width-total)/2;f.childIds.forEach(id=>{node(id,`family:${f.id}:child:${id}`,x,ycSingle,"tree-classic-node--children");x+=card+gap;});}
  } else if(families.length>=1){
    label(families.length===1?"Ehe / Partnerschaft":"Partnerschaften",yf);let x=(width-familyW)/2;
    families.forEach((f,i)=>{const bw=blocks[i],pair=f.spouseId?2*card+gap:card,px=x+(bw-pair)/2;node(rootId,`family:${f.id}:root`,px,yf,"tree-classic-node--family-root");if(f.spouseId)node(f.spouseId,`family:${f.id}:spouse`,px+card+gap,yf,"tree-classic-node--spouse");if(f.childIds.length){const total=rowW(f.childIds);let cx=x+(bw-total)/2;f.childIds.forEach(id=>{node(id,`family:${f.id}:child:${id}`,cx,ycMulti,"tree-classic-node--children");cx+=card+gap;});}x+=bw+28;});
    label(families.length===1?"Kinder":"Kinder je Partnerschaft",ycMulti);
  }
  stage.appendChild(canvas);
  requestAnimationFrame(()=>{
    const pos=treeClassicPositions(canvas);svg.innerHTML="";svg.setAttribute("viewBox",`0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);svg.setAttribute("width",canvas.clientWidth);svg.setAttribute("height",canvas.clientHeight);
    for(const f of info.parentFamilies){f.rootId=rootId;f.targetIds=info.siblingIds;treeClassicConnectParents(svg,pos,f);}
    if(false){const f=families[0],r=pos.get(`person:${rootId}:middle`),s=pos.get(`family:${f.id}:spouse`),cs=f.childIds.map(id=>pos.get(`family:${f.id}:child:${id}`)).filter(Boolean);if(r&&s){const l=r.centerX<s.centerX?r:s,q=l===r?s:r,y=(Math.max(r.top,s.top)+Math.min(r.bottom,s.bottom))/2;treeClassicLine(svg,l.right,y,q.left,y,"tree-classic-spouse");const j=(r.centerX+s.centerX)/2;treeClassicLine(svg,r.centerX,r.bottom,r.centerX,y);if(cs.length){const pb=Math.max(r.bottom,s.bottom),ct=Math.min(...cs.map(p=>p.top)),by=pb+Math.max(22,Math.min(46,(ct-pb)*.42));treeClassicLine(svg,j,y,j,by);const xs=cs.map(p=>p.centerX);if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by);cs.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top));}}else if(families.length===1&&f.childIds.length){const r=pos.get(`person:${rootId}:middle`),cs=f.childIds.map(id=>pos.get(`family:${f.id}:child:${id}`)).filter(Boolean);if(r&&cs.length){const by=r.bottom+Math.max(22,Math.min(46,(Math.min(...cs.map(p=>p.top))-r.bottom)*.42));treeClassicLine(svg,r.centerX,r.bottom,r.centerX,by);const xs=cs.map(p=>p.centerX);if(xs.length>1)treeClassicLine(svg,Math.min(...xs),by,Math.max(...xs),by);cs.forEach(p=>treeClassicLine(svg,p.centerX,by,p.centerX,p.top));}}}
    if(families.length>=1)families.forEach(f=>treeClassicConnectFamily(svg,pos,f));
    // v383: gestrichelte Linie von der Ausgangsperson zu ihrem Platz in jeder Ehe
    const rm=pos.get(`person:${rootId}:middle`);
    if(rm)families.forEach(f=>{const fr=pos.get(`family:${f.id}:root`);if(!fr)return;const my=rm.bottom+(fr.top-rm.bottom)/2;treeClassicLine(svg,rm.centerX,rm.bottom,rm.centerX,my,"tree-classic-self");treeClassicLine(svg,rm.centerX,my,fr.centerX,my,"tree-classic-self");treeClassicLine(svg,fr.centerX,my,fr.centerX,fr.top,"tree-classic-self");});
  });
  canvas.querySelectorAll("[data-classic-person]").forEach(el=>{const id=el.dataset.classicPerson;if(id)treePersonEreignisse(el,id);}); // v385
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
    stage.innerHTML = treeLeerHtml();
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
      treeModul3D = await import("./tree3d.js?v=445");
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
  if (zugang?.rolle === "leser" && (mode === "descendants" || mode === "tree3d")) mode = "classic";   // v418: Leser – nur Familie, Generationen, Ahnentafel
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
    if (!select.value && current) {
      if (![...select.options].some((o) => o.value === current)) select.appendChild(new Option(treePersonLabel(current), current));
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
function treeLeerHtml() {   // v416: freundlicher Startzustand
  return `<div class="tree-empty tree-start">
    <div class="tree-start__icon" aria-hidden="true">🌳</div>
    <p class="tree-start__titel">Noch keine Person gewählt</p>
    <p class="tree-start__text">Oben einen Namen eingeben, Vorschlag antippen und <strong>„Auswahl bestätigen“</strong>.<br>
    Oder im <strong>Bestand</strong> eine Person öffnen und <strong>„🌳 Im Stammbaum anzeigen“</strong> tippen.</p>
    <button type="button" class="btn btn--primary tree-start__suche" onclick="const f=document.getElementById('tree-person-search'); f?.scrollIntoView({block:'center',behavior:'smooth'}); setTimeout(()=>f?.focus(),300);">🔍 Person suchen</button>
  </div>`;
}
function treeStandardPerson() {
  // v416: Der Stammbaum startet leer – man sucht eine Person (oben oder im Bestand → „Im Stammbaum anzeigen“).
  return "";
}

function treeFindPresetPerson(tokens, surname, geburtsjahr = null) {
  const normalizedSurname = treeNormalizeName(surname);
  const normalizedTokens = tokens.map(treeNormalizeName);
  let candidates = treeData.personen.filter(person => {
    const full = treeNormalizeName(`${person.vorname || ""} ${person.nachname || ""}`);
    const last = treeNormalizeName(person.nachname || "");
    return last === normalizedSurname && normalizedTokens.every(token => full.includes(token));
  });
  // v400: inzwischen gibt es z. B. zwei „Luise Ganahl“ und zwei „Hubert Ganahl“ – das Geburtsjahr entscheidet
  if (candidates.length > 1 && geburtsjahr) candidates = candidates.filter((p) => String(p.geburtsdatum || p.geburtsjahr || "").startsWith(String(geburtsjahr)));
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
  treeLinieMittigZeigen(roots[0]);
}
// v400: Nach der Wahl einer Stammlinie den Stammbaum sofort in den sichtbaren Bereich holen und die Linie mittig zeigen.
// Mehrere Versuche, weil die Ansicht (und Fotos) etwas später fertig gezeichnet sein können.
function treeLinieMittigZeigen(rootId, { seite = true } = {}) {
  const viewport = document.getElementById("tree-viewport");
  const versuch = (n) => {
    const stage = document.getElementById(treeStageIdFuerAnsicht());
    if (treeViewMode === "descendants" || treeViewMode === "tree3d") { viewport?.scrollTo({ top: 0 }); }
    else {
      const rootCard = stage?.querySelector(`[data-tree-person="${CSS.escape(rootId)}"], [data-classic-person="${CSS.escape(rootId)}"]`);
      if (!rootCard && n < 6) { setTimeout(() => versuch(n + 1), 120); return; }
      centerTreeViewport(rootCard || stage);
    }
    // den Stammbaum selbst ins Bild holen (die Auswahl steht weiter oben auf der Seite)
    if (!seite) return;
    const r = viewport?.getBoundingClientRect();
    const reiter = document.querySelector(".tabs")?.offsetHeight || 0;
    if (r && (r.top < reiter || r.top > window.innerHeight * 0.45)) window.scrollBy({ top: r.top - reiter - 12, behavior: "smooth" });
  };
  requestAnimationFrame(() => requestAnimationFrame(() => versuch(0)));
}

function applyTreeLinePreset(value) {
  const message = document.getElementById("tree-message");
  const select = document.getElementById("tree-person-select");
  const search = document.getElementById("tree-person-search");
  const presets = {
    "gawatsch-linie": { personType: "mangeng-couple", direction: "both", label: "Gawatsch Linie" },
    "reinhard-linie": { tokens: ["hubert"], geb: "1930", direction: "both", label: "Reinhard Linie" },
    "fall-linie": { tokens: ["luise"], geb: "1933", direction: "maternal", label: "Fall Linie" }
  };
  // v409: Stammlinien – Nachkommen-Ansicht ab dem Gründer
  const linie = STAMMLINIEN.find((l) => `stammlinie-${l.key}` === value);
  if (linie) {
    const g = (treeData.personen || []).find((p) => p.vorname === linie.gruender.vorname && p.nachname === linie.gruender.nachname && String(p.geburtsdatum || "").slice(0, 10) === linie.gruender.geb);
    if (!g) { if (message) message.textContent = `Gründer der ${linie.name} nicht gefunden.`; return; }
    treeActivePreset = null;
    if (select) { if (![...select.options].some((o) => o.value === g.id)) { const o = document.createElement("option"); o.value = g.id; o.textContent = treePersonLabel(g.id); select.appendChild(o); } select.value = g.id; }
    if (search) search.value = treePersonLabel(g.id);
    setTreeViewMode("descendants", g.id);
    renderStammbaum(g.id);
    treeLinieMittigZeigen(g.id);
    if (message) message.textContent = `${linie.name}: Nachkommen von ${treePersonLabel(g.id)}. Personen mit Kürzel ${linie.kurz} gehören zur Linie (umrandet = über eine Tochter).`;
    return;
  }
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
    : treeFindPresetPerson(preset.tokens, "Ganahl", preset.geb);
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
  treeLinieMittigZeigen(id);
  if (confirmed) {
    const message = document.getElementById("tree-message");
    if (message) message.textContent = `Auswahl bestätigt: ${treePersonSearchText(treePerson(id))}`;
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
// v393: Schlüsselfotos im Stammbaum ein-/ausblenden (Einstellung bleibt gespeichert)
(function treeFotoSchalter() {
  const btn = document.getElementById("tree-fotos-toggle");
  const anwenden = (an) => {
    document.body.classList.toggle("tree-ohne-fotos", !an);
    if (btn) { btn.classList.toggle("is-active", an); btn.setAttribute("aria-pressed", String(an)); btn.title = an ? "Schlüsselfotos ausblenden" : "Schlüsselfotos einblenden"; }
  };
  let an = true;
  try { an = localStorage.getItem("fs-tree-fotos") !== "0"; } catch {}
  anwenden(an);
  btn?.addEventListener("click", () => { an = !an; try { localStorage.setItem("fs-tree-fotos", an ? "1" : "0"); } catch {} anwenden(an); });
})();
const treeZoomIn = document.getElementById("tree-zoom-in");
const treeZoomOut = document.getElementById("tree-zoom-out");
const treeReset = document.getElementById("tree-reset");
if (treeZoomIn) treeZoomIn.addEventListener("click", () => { treeZoom = Math.min(1.5, +(treeZoom + 0.1).toFixed(2)); updateTreeZoom(); });
if (treeZoomOut) treeZoomOut.addEventListener("click", () => { treeZoom = Math.max(0.6, +(treeZoom - 0.1).toFixed(2)); updateTreeZoom(); });
if (treeReset) treeReset.addEventListener("click", () => { treeZoom = 1; updateTreeZoom(); });
const treeViewCards = document.getElementById("tree-view-cards");
const treeViewClassic = document.getElementById("tree-view-classic");
if (treeViewCards) treeViewCards.addEventListener("click", () => { setTreeViewMode("cards"); const _id = document.getElementById("tree-person-select")?.value; if (_id) treeLinieMittigZeigen(_id, { seite: false }); });
if (treeViewClassic) treeViewClassic.addEventListener("click", () => { setTreeViewMode("classic"); const _id = document.getElementById("tree-person-select")?.value; if (_id) treeLinieMittigZeigen(_id, { seite: false }); });
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
if (treeViewPedigree) treeViewPedigree.addEventListener("click", () => { setTreeViewMode("pedigree"); const _id = document.getElementById("tree-person-select")?.value; if (_id) treeLinieMittigZeigen(_id, { seite: false }); });
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
