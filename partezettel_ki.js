// Familienspuren – Partezettel automatisch auswerten (nur Eigentümer). Version 466
// Ablauf: Foto der Todesanzeige → KI liest Namen, Daten, Angehörige und findet Porträt/Anzeige
// (Supabase Edge Function „partezettel-lesen“) → passende Person im Bestand suchen (Name, Geburtsdatum,
// Ehepartner, Kinder) → Vorschlag prüfen → erst nach Bestätigung speichern.

const PZKI = {
  bild: null,          // Originalbild (HTMLImageElement)
  datei: null,         // Originaldatei (für den Zuschneide-Editor)
  ergebnis: null,      // Antwort der KI
  kandidaten: [],
  gewaehlt: null,      // Personen-ID oder "neu"
  portraet: null,      // { crop, blob }
  anzeige: null,       // { crop, blob }
  angehoerige: {},     // v452: je Personen-ID { kinder: [Namen], partner: [Namen] } aus dem Bestand
};

// ---------- kleine Helfer ----------
const pzkiNorm = (s) => PersonSuche.normalisiere(s || "");
const pzkiWoerter = (s) => pzkiNorm(s).split(" ").filter((w) => w.length > 1);
function pzkiLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let vorher = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    for (let j = 1; j <= b.length; j++) {
      jetzt[j] = Math.min(vorher[j] + 1, jetzt[j - 1] + 1, vorher[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    vorher = jetzt;
  }
  return vorher[b.length];
}
// Ähnlichkeit zweier Einzelwörter 0…1 (Schreibvarianten wie Josef/Joseph, Mathis/Mattis)
function pzkiWortAehnlich(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const kurz = Math.min(a.length, b.length);
  if (kurz >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.8;
  const d = pzkiLevenshtein(a, b);
  if (d === 1 && kurz >= 4) return 0.8;
  if (d === 2 && kurz >= 6) return 0.6;
  return 0;
}
// bestes Paar aus zwei Wortlisten
function pzkiNamenAehnlich(a, b) {
  const wa = pzkiWoerter(a), wb = pzkiWoerter(b);
  let best = 0;
  for (const x of wa) for (const y of wb) best = Math.max(best, pzkiWortAehnlich(x, y));
  return best;
}
// v452: gebräuchliche Rufnamen, damit z. B. „Seppl“ nicht als fehlendes Kind gilt, wenn „Josef“ im Bestand ist
const PZKI_RUFNAMEN = {
  seppl: "josef", sepp: "josef", sepl: "josef", pepi: "josef", toni: "anton", hansi: "johann", hans: "johann", hannes: "johann",
  conny: "kornelia", konny: "kornelia", fredy: "alfred", freddy: "alfred", fritz: "friedrich", mandi: "manfred", liesi: "elisabeth",
  lisl: "elisabeth", annelies: "elisabeth", gretl: "margareta", resi: "theresia", vroni: "veronika", fini: "josefine", rosl: "rosa",
  burgi: "walburga", christl: "christine", christel: "christine", gerti: "gertrud", wolfi: "wolfgang", heini: "heinrich", lothi: "lothar",
};
function pzkiNameBekannt(name, liste) {
  const ruf = (n) => pzkiWoerter(n).map((w) => PZKI_RUFNAMEN[w] || w.replace(/ph/g, "f").replace(/th/g, "t").replace(/ck/g, "k")).join(" ");
  return liste.some((x) => pzkiNamenAehnlich(name, x) >= 0.8 || pzkiNamenAehnlich(ruf(name), ruf(x)) >= 0.8);
}
// v452: Ehepartner und Kinder einer Person aus dem Bestand (mit Datenblatt und „Namen ohne Datenblatt“)
async function pzkiAngehoerigeLaden(personId) {
  if (!personId || personId === "neu" || PZKI.angehoerige[personId]) return;
  const nachId = new Map((personenCache || []).map((p) => [p.id, p]));
  const p = nachId.get(personId) || {};
  const erg = { kinder: [], partner: [], partnerVornamen: [], kinderOhne: partnerOhneListe(p.kinder_ohne_datenblatt), partnerOhne: partnerOhneListe(p.partner_ohne_datenblatt) };
  try {
    const { data: f } = await sb.from("familien").select("id, partner_a_id, partner_b_id").or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`);
    const fam = f || [];
    for (const x of fam) { const o = nachId.get(x.partner_a_id === personId ? x.partner_b_id : x.partner_a_id); if (o) { erg.partner.push(`${o.vorname || ""} ${o.nachname || ""}`.trim()); erg.partnerVornamen.push(o.vorname || ""); } }
    if (fam.length) {
      const { data: k } = await sb.from("familien_kinder").select("kind_id").in("familie_id", fam.map((x) => x.id));
      for (const x of k || []) { const c = nachId.get(x.kind_id); if (c) erg.kinder.push(c.vorname || ""); }
    }
    const { data: frisch } = await sb.from("personen").select("kinder_ohne_datenblatt, partner_ohne_datenblatt").eq("id", personId).maybeSingle();
    if (frisch) { erg.kinderOhne = partnerOhneListe(frisch.kinder_ohne_datenblatt); erg.partnerOhne = partnerOhneListe(frisch.partner_ohne_datenblatt); }
  } catch (e) { debugLog(`⚠️ Partezettel: Angehörige von ${personId} nicht geladen: ${e.message || e}`); erg.fehler = true; }
  for (const o of erg.kinderOhne) erg.kinder.push(o.name || "");
  for (const o of erg.partnerOhne) { erg.partner.push(o.name || ""); erg.partnerVornamen.push(o.name || ""); }
  PZKI.angehoerige[personId] = erg;
}

const pzkiJahr = (datum, jahr) => {
  const m = String(datum || "").match(/^(\d{4})/);
  return m ? Number(m[1]) : (Number(jahr) || null);
};
const pzkiIstDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const pzkiDe = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : ""; };
const pzkiDatumText = (datum, jahr) => pzkiDe(datum) || (jahr ? String(jahr) : "");
const pzkiH = (s) => escapeHtml(s ?? "");

// Bereich der KI (Pixel des gesendeten Bildes) → Anteile 0…1, mit etwas Rand
function pzkiBereich(b, breite, hoehe, rand = 0) {
  if (!b || !breite || !hoehe) return null;
  let x = Number(b.x) / breite, y = Number(b.y) / hoehe, w = Number(b.breite) / breite, h = Number(b.hoehe) / hoehe;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0.02 || h <= 0.02) return null;
  x -= w * rand; y -= h * rand; w *= 1 + 2 * rand; h *= 1 + 2 * rand;
  x = Math.max(0, Math.min(0.98, x)); y = Math.max(0, Math.min(0.98, y));
  w = Math.min(1 - x, w); h = Math.min(1 - y, h);
  return { x, y, w, h };
}

// Ausschnitt aus dem Originalbild in voller Auflösung
function pzkiAusschneiden(img, crop, maxKB) {
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const f = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
  const sx = Math.round(img.naturalWidth * c.x), sy = Math.round(img.naturalHeight * c.y);
  const sw = Math.max(1, Math.round(img.naturalWidth * c.w)), sh = Math.max(1, Math.round(img.naturalHeight * c.h));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * f)); out.height = Math.max(1, Math.round(sh * f));
  const ctx = out.getContext("2d", { alpha: false });
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob(async (blob) => resolve(blob ? await blobZuJPEGUnter200KB(blob, maxKB) : null), "image/jpeg", 0.92));
}

// Bild für die KI: längste Seite höchstens 1568 px (mehr nutzt die KI nicht), JPEG
function pzkiFuerKi(img) {
  const f = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
  const ctx = c.getContext("2d", { alpha: false });
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.88);
  return { bild: url.slice(url.indexOf(",") + 1), breite: c.width, hoehe: c.height };
}

// ---------- Abgleich mit dem Bestand ----------
function pzkiGrundbewertung(p, v, alterHinweis) {
  const gruende = [];
  let punkte = 0;
  // Vorname (auch Rufname)
  const vorKi = [v.vorname, v.rufname].filter(Boolean).join(" ");
  const vor = pzkiNamenAehnlich(vorKi, p.vorname);
  if (vor >= 1) { punkte += 4; gruende.push("Vorname gleich"); }
  else if (vor > 0) { punkte += 2.5; gruende.push("Vorname ähnlich"); }
  // Nachname bzw. Ledigenname (Frauen stehen oft mit Ehe- und Geburtsnamen im Bestand)
  const nachDb = [p.nachname, p.Ledigenname].filter(Boolean).join(" ");
  const nach = pzkiNamenAehnlich(v.nachname, nachDb);
  if (nach >= 1) { punkte += 4; gruende.push("Nachname gleich"); }
  else if (nach > 0) { punkte += 2.5; gruende.push("Nachname ähnlich"); }
  if (v.ledigenname) {
    const led = pzkiNamenAehnlich(v.ledigenname, [p.Ledigenname, p.nachname].filter(Boolean).join(" "));
    if (led >= 0.8) { punkte += 2.5; gruende.push(`geb. ${v.ledigenname} passt`); }
  }
  // Geburt
  const gebKi = v.geburtsdatum, gebKiJ = pzkiJahr(v.geburtsdatum, v.geburtsjahr);
  const gebDbJ = pzkiJahr(p.geburtsdatum, p.geburtsjahr);
  if (pzkiIstDatum(gebKi) && pzkiIstDatum(p.geburtsdatum)) {
    if (gebKi === p.geburtsdatum) { punkte += 7; gruende.push("Geburtsdatum gleich"); }
    else if (gebKiJ === gebDbJ) { punkte += 1; gruende.push("Geburtsjahr gleich, Tag abweichend"); }
    else { punkte -= Math.abs(gebKiJ - gebDbJ) > 1 ? 5 : 2; gruende.push("Geburtsdatum abweichend"); }
  } else if (gebKiJ && gebDbJ) {
    const d = Math.abs(gebKiJ - gebDbJ);
    if (d === 0) { punkte += 3; gruende.push("Geburtsjahr gleich"); }
    else if (d === 1) { punkte += 0.5; gruende.push("Geburtsjahr ±1"); }
    else if (d > 2) { punkte -= 4; gruende.push(`Geburtsjahr abweichend (${gebDbJ})`); }
  } else if (alterHinweis && gebDbJ) {
    const d = Math.abs(alterHinweis - gebDbJ);
    if (d <= 1) { punkte += 2; gruende.push("Alter passt zum Geburtsjahr"); }
    else if (d > 3) { punkte -= 2; gruende.push("Alter passt nicht"); }
  }
  // Tod
  const todKi = v.sterbedatum, todKiJ = pzkiJahr(v.sterbedatum, v.sterbejahr);
  const todDbJ = pzkiJahr(p.sterbedatum, p.sterbejahr);
  if (pzkiIstDatum(todKi) && pzkiIstDatum(p.sterbedatum)) {
    if (todKi === p.sterbedatum) { punkte += 7; gruende.push("Sterbedatum gleich"); }
    else { punkte -= 6; gruende.push(`im Bestand anderes Sterbedatum (${pzkiDe(p.sterbedatum)})`); }
  } else if (todKiJ && todDbJ) {
    if (todKiJ === todDbJ) { punkte += 2.5; gruende.push("Sterbejahr gleich"); }
    else { punkte -= 5; gruende.push(`im Bestand anderes Sterbejahr (${todDbJ})`); }
  }
  if (todKiJ && gebDbJ && (gebDbJ > todKiJ || todKiJ - gebDbJ > 112)) { punkte -= 8; gruende.push("Lebensdaten unmöglich"); }
  return { punkte, gruende, nameGut: vor > 0 && nach > 0 };
}

async function pzkiKandidatenSuchen(erg) {
  const v = erg.verstorbene || {};
  const todJ = pzkiJahr(v.sterbedatum, v.sterbejahr) || erg.sterbejahr_abgeleitet?.jahr || null;
  const alterHinweis = v.alter && todJ ? todJ - v.alter : null;   // ungefähres Geburtsjahr aus dem Alter
  const liste = [];
  for (const p of personenCache || []) {
    const b = pzkiGrundbewertung(p, v, alterHinweis);
    const gebGleich = pzkiIstDatum(v.geburtsdatum) && v.geburtsdatum === p.geburtsdatum;
    if ((b.nameGut && b.punkte >= 5) || (gebGleich && b.punkte >= 8)) liste.push({ person: p, ...b });
  }
  liste.sort((a, b) => b.punkte - a.punkte);
  const top = liste.slice(0, 8);
  if (!top.length) return [];

  // Ehepartner und Kinder der besten Kandidaten aus der Datenbank holen
  const ids = top.map((k) => k.person.id);
  const nachId = new Map((personenCache || []).map((p) => [p.id, p]));
  let familien = [], kinder = [];
  try {
    const liste = ids.join(",");
    const { data: f } = await sb.from("familien").select("id, partner_a_id, partner_b_id").or(`partner_a_id.in.(${liste}),partner_b_id.in.(${liste})`);
    familien = f || [];
    const famIds = familien.map((x) => x.id);
    if (famIds.length) {
      const { data: k } = await sb.from("familien_kinder").select("familie_id, kind_id").in("familie_id", famIds);
      kinder = k || [];
    }
  } catch (e) { debugLog(`⚠️ Partezettel: Angehörige nicht geladen: ${e.message || e}`); }

  const kiPartner = (erg.ehepartner || []).filter((x) => x?.vorname);
  const kiKinder = (erg.kinder || []).filter((x) => x?.vorname);
  for (const k of top) {
    const id = k.person.id;
    const eigeneFam = familien.filter((f) => f.partner_a_id === id || f.partner_b_id === id);
    const partnerNamen = eigeneFam.map((f) => nachId.get(f.partner_a_id === id ? f.partner_b_id : f.partner_a_id)).filter(Boolean)
      .map((p) => `${p.vorname || ""} ${p.nachname || ""}`);
    for (const o of (typeof partnerOhneListe === "function" ? partnerOhneListe(k.person.partner_ohne_datenblatt) : [])) partnerNamen.push(o.name || "");
    const famSet = new Set(eigeneFam.map((f) => f.id));
    const kindNamen = kinder.filter((x) => famSet.has(x.familie_id)).map((x) => nachId.get(x.kind_id)).filter(Boolean).map((p) => p.vorname || "");
    for (const o of (typeof partnerOhneListe === "function" ? partnerOhneListe(k.person.kinder_ohne_datenblatt) : [])) kindNamen.push(o.name || "");
    k.partnerNamen = partnerNamen; k.kindNamen = kindNamen;

    for (const kp of kiPartner) {
      const s = Math.max(0, ...partnerNamen.map((n) => pzkiNamenAehnlich(kp.vorname, n)));
      if (s >= 0.8) { k.punkte += 4; k.gruende.push(`Ehepartner ${kp.vorname} passt`); }
      else if (partnerNamen.length && s === 0) { k.punkte -= 1.5; k.gruende.push(`Ehepartner ${kp.vorname} nicht gefunden`); }
    }
    let kindTreffer = 0;
    for (const kk of kiKinder) if (kindNamen.some((n) => pzkiNamenAehnlich(kk.vorname, n) >= 0.8)) kindTreffer++;
    if (kindTreffer) { k.punkte += Math.min(6, kindTreffer * 1.5); k.gruende.push(`${kindTreffer} von ${kiKinder.length} Kindern passen`); }
    else if (kiKinder.length >= 2 && kindNamen.length >= 2) { k.punkte -= 1.5; k.gruende.push("keine Kinder passen"); }
  }
  top.sort((a, b) => b.punkte - a.punkte);
  return top;
}

function pzkiStufe(k, zweiter) {
  const vorsprung = k.punkte - (zweiter?.punkte ?? 0);
  if (k.punkte >= 12 && vorsprung >= 4) return ["sicher", "sehr wahrscheinlich"];
  if (k.punkte >= 9) return ["moeglich", "möglich"];   // nur Name gleich (8) = unsicher
  return ["unsicher", "unsicher"];
}

// ---------- Oberfläche ----------
function pzkiOverlay() {
  let o = document.getElementById("pzki-overlay");
  if (o) return o;
  o = document.createElement("div");
  o.id = "pzki-overlay";
  o.className = "pzki-overlay";
  o.hidden = true;
  o.innerHTML = `<div class="pzki-sheet" role="dialog" aria-modal="true" aria-labelledby="pzki-titel">
    <div class="pzki-kopf"><h2 id="pzki-titel">🕊️ Partezettel auswerten</h2><button type="button" class="btn btn--ghost" id="pzki-schliessen">Schließen</button></div>
    <div id="pzki-inhalt"></div></div>`;
  document.body.appendChild(o);
  o.querySelector("#pzki-schliessen").addEventListener("click", pzkiSchliessen);
  return o;
}
function pzkiSchliessen() {
  const o = document.getElementById("pzki-overlay");
  if (o) o.hidden = true;
  document.body.classList.remove("pzki-offen");
  for (const t of [PZKI.portraet, PZKI.anzeige]) if (t?.url) URL.revokeObjectURL(t.url);
}
function pzkiStatus(text, fehler = false) {
  const s = document.getElementById("pzki-status");
  if (s) { s.textContent = text; s.classList.toggle("pzki-fehler", !!fehler); }
}

async function pzkiStarten(datei) {
  if (!datei) return;
  if (!document.body.classList.contains("rolle-eigentuemer")) { pzkiStatus("Nur für den Eigentümer.", true); return; }
  try {
    pzkiStatus("Foto wird vorbereitet …");
    await ensureSession();
    PZKI.datei = datei;
    PZKI.bild = await loadImage(await bildZuDataURL(datei));
    const senden = pzkiFuerKi(PZKI.bild);
    pzkiStatus("Die KI liest den Partezettel … (meist 10–40 Sekunden)");
    const { data, error } = await sb.functions.invoke("partezettel-lesen", { body: { ...senden, typ: "image/jpeg" } });
    if (error) {
      let grund = error.message || String(error);
      try { const j = await error.context?.json?.(); if (j?.fehler) grund = j.fehler; } catch {}
      if (/not found|404/i.test(grund)) grund = "Die Funktion „partezettel-lesen“ ist in Supabase noch nicht eingerichtet.";
      throw new Error(grund);
    }
    if (!data?.ergebnis) throw new Error(data?.fehler || "Keine Antwort erhalten.");
    PZKI.paket = null;
    await pzkiAuswerten(data.ergebnis, senden.breite, senden.hoehe, null);
  } catch (err) {
    pzkiStatus(`⚠️ ${err.message || err}`, true);
    debugLog(`⚠️ Partezettel auswerten: ${err.message || err}`);
  }
}

// Gemeinsamer Teil für KI-Antwort und Partezettel-Paket: Bestand durchsuchen, Ausschnitte erzeugen, anzeigen
async function pzkiAuswerten(e, breite, hoehe, vorschlag) {
  PZKI.ergebnis = e;
  const pb = pzkiBereich(e.portraet, breite, hoehe, e.bereiche_genau ? 0 : 0.02);
  const ab = pzkiBereich(e.anzeige, breite, hoehe, e.bereiche_genau ? 0 : 0.01) || { x: 0, y: 0, w: 1, h: 1 };
  pzkiStatus("Bestand wird durchsucht …");
  PZKI.kandidaten = await pzkiKandidatenSuchen(e);
  const [erster, zweiter] = PZKI.kandidaten;
  if (vorschlag === "neu") PZKI.gewaehlt = "neu";
  else if (vorschlag && (personenCache || []).some((p) => p.id === vorschlag)) {
    PZKI.gewaehlt = vorschlag;
    if (!PZKI.kandidaten.some((k) => k.person.id === vorschlag)) {   // Vorschlag aus dem Paket immer mit anzeigen
      PZKI.kandidaten.unshift({ person: personenCache.find((x) => x.id === vorschlag), punkte: 0, gruende: ["vorgeschlagen im Paket"], partnerNamen: [] });
    }
  } else PZKI.gewaehlt = erster && pzkiStufe(erster, zweiter)[0] === "sicher" ? erster.person.id : null;
  // Kein Porträt erkannt: trotzdem einen Rahmen anbieten, den man selbst auf das Foto zieht
  const pc = pb || { x: 0.3, y: 0.08, w: 0.4, h: 0.3 };
  for (const t of [PZKI.portraet, PZKI.anzeige]) if (t?.url) URL.revokeObjectURL(t.url);
  PZKI.portraet = { crop: pc, gefunden: !!pb, blob: await pzkiAusschneiden(PZKI.bild, pc, 200) };
  PZKI.anzeige = { crop: ab, blob: await pzkiAusschneiden(PZKI.bild, ab, 700) };
  for (const t of [PZKI.portraet, PZKI.anzeige]) if (t?.blob) t.url = URL.createObjectURL(t.blob);
  PZKI.angehoerige = {};
  await pzkiAngehoerigeLaden(PZKI.gewaehlt);
  pzkiStatus("");
  const o = pzkiOverlay();
  o.hidden = false;
  document.body.classList.add("pzki-offen");
  pzkiZeichnen();
  o.scrollTop = 0;
}

// ---------- Partezettel-Paket (im Chat mit Claude vorbereitet: Bilder + gelesene Angaben) ----------
async function pzkiPaketLaden(datei) {
  if (!datei) return;
  if (!document.body.classList.contains("rolle-eigentuemer")) { pzkiStatus("Nur für den Eigentümer.", true); return; }
  try {
    pzkiStatus("Paket wird gelesen …");
    const daten = JSON.parse(await datei.text());
    const eintraege = Array.isArray(daten) ? daten : daten.anzeigen;
    if (!Array.isArray(eintraege) || !eintraege.length) throw new Error("Im Paket sind keine Anzeigen.");
    await ensureSession();
    PZKI.paket = eintraege;
    await pzkiPaketEintrag(0);
  } catch (err) {
    pzkiStatus(`⚠️ Paket: ${err.message || err}`, true);
  }
}
async function pzkiPaketEintrag(i) {
  const x = PZKI.paket?.[i];
  if (!x) { const n = PZKI.paket?.length || 0; PZKI.paket = null; pzkiSchliessen(); pzkiStatus(`✓ Alle ${n} Anzeigen des Pakets durchgesehen.`); return; }
  try {
    PZKI.paketIndex = i;
    pzkiStatus(`Anzeige ${i + 1} von ${PZKI.paket.length} wird vorbereitet …`);
    PZKI.datei = await (await fetch(x.bild)).blob();
    PZKI.bild = await loadImage(x.bild);
    await pzkiAuswerten({ ...x.ergebnis, bereiche_genau: true }, PZKI.bild.naturalWidth, PZKI.bild.naturalHeight, x.vorschlag || null);
  } catch (err) {
    pzkiStatus(`⚠️ Anzeige ${i + 1}: ${err.message || err}`, true);
  }
}

function pzkiZeile(label, wert) { return wert ? `<div class="pzki-zeile"><span>${pzkiH(label)}</span><strong>${pzkiH(wert)}</strong></div>` : ""; }

function pzkiZeichnen() {
  const e = PZKI.ergebnis || {};
  const v = e.verstorbene || {};
  const artText = { todesanzeige: "Todesanzeige", sterbebild: "Sterbebild", danksagung: "Danksagung", jahresgedenken: "Jahresgedenken", sonstiges: "Anzeige" }[e.art] || "Anzeige";
  const name = [v.vorname, v.rufname ? `„${v.rufname}“` : "", v.nachname].filter(Boolean).join(" ") + (v.ledigenname ? ` (geb. ${v.ledigenname})` : "");
  const partner = (e.ehepartner || []).map((x) => [x.bezeichnung, x.vorname, x.nachname].filter(Boolean).join(" ") + (x.bereits_verstorben ? " †" : "")).join(", ");
  const kinder = (e.kinder || []).map((x) => [x.vorname, x.nachname].filter(Boolean).join(" ") + (x.partner ? ` mit ${x.partner}` : "") + (x.bereits_verstorben ? " †" : "")).join(", ");
  const abgeleitet = e.sterbejahr_abgeleitet?.jahr ? `${e.sterbejahr_abgeleitet.jahr} (abgeleitet: ${e.sterbejahr_abgeleitet.begruendung || "Jahresgedenken"})` : "";

  const [erster, zweiter] = PZKI.kandidaten;
  const kandHtml = PZKI.kandidaten.map((k, i) => {
    const [stufe, stufeText] = pzkiStufe(k, i === 0 ? zweiter : erster);
    const p = k.person;
    const daten = [pzkiDatumText(p.geburtsdatum, p.geburtsjahr) && `* ${pzkiDatumText(p.geburtsdatum, p.geburtsjahr)}`, pzkiDatumText(p.sterbedatum, p.sterbejahr) && `† ${pzkiDatumText(p.sterbedatum, p.sterbejahr)}`].filter(Boolean).join("  ");
    return `<label class="pzki-kandidat pzki-${stufe}">
      <input type="radio" name="pzki-person" value="${pzkiH(p.id)}" ${PZKI.gewaehlt === p.id ? "checked" : ""}>
      <span class="pzki-k-text"><strong>${pzkiH(PersonSuche.name(p))}</strong> <small>${pzkiH(daten)}</small>
      <span class="pzki-k-gruende">${pzkiH(k.gruende.join(" · "))}</span>
      ${k.partnerNamen?.length ? `<span class="pzki-k-gruende">Partner im Bestand: ${pzkiH(k.partnerNamen.join(", "))}</span>` : ""}</span>
      <span class="pzki-badge">${pzkiH(stufeText)}</span></label>`;
  }).join("");

  const inhalt = document.getElementById("pzki-inhalt");
  const aktuell = PZKI.paket ? PZKI.paket[PZKI.paketIndex] : null;
  const paketKopf = aktuell ? `<div class="pzki-nav"><span>Anzeige <strong>${PZKI.paketIndex + 1}</strong> von ${PZKI.paket.length}${aktuell.hinweis ? " · " + pzkiH(aktuell.hinweis) : ""}</span>
      <button type="button" class="btn btn--ghost" id="pzki-ueberspringen">Überspringen →</button></div>` : "";
  inhalt.innerHTML = `${paketKopf}
    <section class="pzki-block">
      <h3>Erkannt (${pzkiH(artText)})</h3>
      ${pzkiZeile("Name", name)}
      ${pzkiZeile("Geboren", [pzkiDatumText(v.geburtsdatum, v.geburtsjahr), v.geburtsort].filter(Boolean).join(", "))}
      ${pzkiZeile("Gestorben", [pzkiDatumText(v.sterbedatum, v.sterbejahr), v.sterbeort].filter(Boolean).join(", "))}
      ${pzkiZeile("Sterbejahr", !pzkiJahr(v.sterbedatum, v.sterbejahr) ? abgeleitet : "")}
      ${pzkiZeile("Alter", v.alter ? `${v.alter} Jahre` : "")}
      ${pzkiZeile("Wohnort", v.wohnort)}
      ${pzkiZeile("Ehepartner", partner)}
      ${pzkiZeile("Kinder", kinder)}
      ${pzkiZeile("Todesumstand", v.todesumstand)}
      ${e.unsicher ? `<p class="pzki-hinweis">⚠️ ${pzkiH(e.unsicher)}</p>` : ""}
      <details><summary>Gelesener Text</summary><pre class="pzki-text">${pzkiH(e.volltext || "")}</pre></details>
    </section>
    <section class="pzki-block">
      <h3>Wer ist es im Bestand?</h3>
      ${kandHtml || `<p class="pzki-hinweis">Keine passende Person gefunden.</p>`}
      <label class="pzki-kandidat"><input type="radio" name="pzki-person" value="neu" ${PZKI.gewaehlt === "neu" ? "checked" : ""}>
        <span class="pzki-k-text"><strong>Keine davon – als neue Person anlegen</strong></span></label>
    </section>
    <section class="pzki-block" id="pzki-aenderungen"></section>`;
  inhalt.querySelector("#pzki-ueberspringen")?.addEventListener("click", () => pzkiPaketEintrag(PZKI.paketIndex + 1));
  inhalt.querySelectorAll('input[name="pzki-person"]').forEach((r) => r.addEventListener("change", async () => {
    PZKI.gewaehlt = r.value;
    await pzkiAngehoerigeLaden(r.value);
    if (PZKI.gewaehlt === r.value) pzkiAenderungenZeichnen();
  }));
  pzkiAenderungenZeichnen();
}

// Vorschläge, was bei der gewählten Person eingetragen wird
function pzkiVorschlaege(p) {
  const v = PZKI.ergebnis?.verstorbene || {};
  const e = PZKI.ergebnis || {};
  const vs = [];
  const add = (schluessel, label, neu, bisher, an, felder, warnung = "") => vs.push({ schluessel, label, neu, bisher, an, felder, warnung });
  // Geburt
  if (pzkiIstDatum(v.geburtsdatum)) {
    if (!pzkiIstDatum(p.geburtsdatum)) {
      const jahrDb = pzkiJahr(p.geburtsdatum, p.geburtsjahr);
      const passt = !jahrDb || Math.abs(jahrDb - Number(v.geburtsdatum.slice(0, 4))) <= 1;
      add("geb", "Geburtsdatum", pzkiDe(v.geburtsdatum), jahrDb ? `nur Jahr ${jahrDb}` : "fehlt", passt, { geburtsdatum: v.geburtsdatum, geburtsjahr: null }, passt ? "" : "Jahr weicht ab");
    } else if (p.geburtsdatum !== v.geburtsdatum) {
      add("geb", "Geburtsdatum", pzkiDe(v.geburtsdatum), pzkiDe(p.geburtsdatum), false, { geburtsdatum: v.geburtsdatum, geburtsjahr: null }, "abweichend – bitte prüfen");
    }
  } else if (v.geburtsjahr && !pzkiJahr(p.geburtsdatum, p.geburtsjahr)) {
    add("geb", "Geburtsjahr", String(v.geburtsjahr), "fehlt", true, { geburtsjahr: v.geburtsjahr });
  }
  // Tod
  if (pzkiIstDatum(v.sterbedatum)) {
    if (!pzkiIstDatum(p.sterbedatum)) {
      const jahrDb = pzkiJahr(p.sterbedatum, p.sterbejahr);
      const passt = !jahrDb || jahrDb === Number(v.sterbedatum.slice(0, 4));
      add("tod", "Sterbedatum", pzkiDe(v.sterbedatum), jahrDb ? `nur Jahr ${jahrDb}` : "fehlt", passt, { sterbedatum: v.sterbedatum, sterbejahr: null }, passt ? "" : "Jahr weicht ab");
    } else if (p.sterbedatum !== v.sterbedatum) {
      add("tod", "Sterbedatum", pzkiDe(v.sterbedatum), pzkiDe(p.sterbedatum), false, { sterbedatum: v.sterbedatum, sterbejahr: null }, "abweichend – bitte prüfen");
    }
  } else {
    const j = v.sterbejahr || e.sterbejahr_abgeleitet?.jahr;
    if (j && !pzkiJahr(p.sterbedatum, p.sterbejahr)) {
      const abgel = !v.sterbejahr;
      add("tod", "Sterbejahr", String(j), "fehlt", !abgel, { sterbejahr: j }, abgel ? `nur abgeleitet: ${e.sterbejahr_abgeleitet?.begruendung || "Jahresgedenken"}` : "");
    }
  }
  if (v.ledigenname && !String(p.Ledigenname || "").trim()) add("ledig", "Ledigenname", v.ledigenname, "fehlt", true, { Ledigenname: v.ledigenname });
  if (v.todesumstand && !String(p.todesumstand_text || "").trim()) add("umstand", "Todesumstand", v.todesumstand, "fehlt", true, { todesumstand_text: v.todesumstand });
  // v452: Kinder aus der Anzeige, die im Bestand fehlen → als „Namen ohne Datenblatt“ ergänzen (jedes Kind einzeln abwählbar)
  const ang = PZKI.angehoerige[p.id];
  if (ang && !ang.fehler) {
    const bisher = ang.kinder.filter(Boolean);
    for (const k of (e.kinder || []).filter((x) => x?.vorname)) {
      if (k.bereits_verstorben) continue;
      const name = [k.vorname, k.nachname].filter(Boolean).join(" ");
      if (pzkiNameBekannt(name, bisher)) continue;
      add("kind", "Kind ohne Datenblatt", name + (k.partner ? ` (mit ${k.partner})` : ""), bisher.length ? `Kinder im Bestand: ${bisher.join(", ")}` : "keine Kinder im Bestand", true, { _kind: { name } });
    }
    // v459: Ehepartner aus der Anzeige, der im Bestand fehlt → als „Name ohne Datenblatt“ ergänzen.
    // Verglichen wird nur der Vorname (der gemeinsame Nachname würde sonst immer „passen“).
    // Ist schon ein anderer Ehepartner eingetragen (z. B. zweite Ehe), ist der Vorschlag abgewählt.
    const partnerBisher = (ang.partnerVornamen || []).filter(Boolean);
    for (const k of (e.ehepartner || []).filter((x) => x?.vorname)) {
      if (pzkiNameBekannt(k.vorname, partnerBisher)) continue;
      const name = [k.vorname, k.nachname].filter(Boolean).join(" ");
      const andere = (ang.partner || []).filter(Boolean);
      add("partner", "Ehepartner ohne Datenblatt", name + (k.bereits_verstorben ? " †" : ""), andere.length ? `Ehepartner im Bestand: ${andere.join(", ")}` : "kein Ehepartner im Bestand", !andere.length,
        { _partner: { name } }, andere.length ? "anderer Ehepartner eingetragen – bitte prüfen" : "");
    }
  }
  return vs;
}

function pzkiAenderungenZeichnen() {
  const box = document.getElementById("pzki-aenderungen");
  if (!box) return;
  const v = PZKI.ergebnis?.verstorbene || {};
  if (!PZKI.gewaehlt) { box.innerHTML = `<p class="pzki-hinweis">Bitte oben die passende Person wählen.</p>`; return; }
  const neu = PZKI.gewaehlt === "neu";
  const p = neu ? null : (personenCache || []).find((x) => x.id === PZKI.gewaehlt);
  const hatSchluessel = !neu && schluesselfotoMetaCache?.has?.(PZKI.gewaehlt);
  const vs = neu ? [] : pzkiVorschlaege(p);
  const fotoHtml = (art, titel, info, an) => {
    const t = PZKI[art];
    if (!t?.url) return "";
    return `<div class="pzki-foto"><label class="pzki-check"><input type="checkbox" data-pzki-foto="${art}" ${an ? "checked" : ""}> <span>${titel}<small>${info}</small></span></label>
      <img src="${t.url}" alt=""><button type="button" class="btn btn--secondary" data-pzki-zuschneiden="${art}">✂️ Ausschnitt anpassen</button></div>`;
  };
  const jahr = pzkiJahr(v.sterbedatum, v.sterbejahr) || PZKI.ergebnis?.sterbejahr_abgeleitet?.jahr || "";
  box.innerHTML = `<h3>${neu ? "Neue Person anlegen" : `Eintragen bei ${pzkiH(PersonSuche.name(p))}`}</h3>
    ${neu ? `<div class="pzki-neu">
        <label class="field"><span>Vorname</span><input type="text" id="pzki-n-vorname" value="${pzkiH(v.vorname || "")}"></label>
        <label class="field"><span>Nachname</span><input type="text" id="pzki-n-nachname" value="${pzkiH(v.nachname || "")}"></label>
        <label class="field"><span>Ledigenname</span><input type="text" id="pzki-n-ledig" value="${pzkiH(v.ledigenname || "")}"></label>
        <label class="field"><span>Geschlecht</span><select id="pzki-n-geschlecht"><option value="">–</option><option ${v.geschlecht === "männlich" ? "selected" : ""}>männlich</option><option ${v.geschlecht === "weiblich" ? "selected" : ""}>weiblich</option></select></label>
        <p class="pzki-hinweis">Geboren ${pzkiH(pzkiDatumText(v.geburtsdatum, v.geburtsjahr) || "unbekannt")}, gestorben ${pzkiH(pzkiDatumText(v.sterbedatum, v.sterbejahr) || "unbekannt")}. ${pzkiNeuHinweis()}</p>
      </div>` : (vs.length ? vs.map((x, i) => `<label class="pzki-check ${x.warnung ? "pzki-warn" : ""}"><input type="checkbox" data-pzki-feld="${i}" ${x.an ? "checked" : ""}>
        <span>${pzkiH(x.label)}: <strong>${pzkiH(x.neu)}</strong><small>bisher: ${pzkiH(x.bisher)}${x.warnung ? ` · ⚠️ ${pzkiH(x.warnung)}` : ""}</small></span></label>`).join("")
        : `<p class="pzki-hinweis">Namen und Daten stimmen bereits mit dem Bestand überein.</p>`)}
    <div class="pzki-fotos">
      ${fotoHtml("portraet", "Porträt als Schlüsselfoto", (PZKI.portraet?.gefunden ? "" : " · kein Porträt erkannt – mit ✂️ selbst ausschneiden") + (hatSchluessel ? " · ersetzt das bisherige Schlüsselfoto" : ""), !!PZKI.portraet?.gefunden)}
      ${fotoHtml("anzeige", `${pzkiFotoTitel()} als Foto speichern`, " · kein Schlüsselfoto", true)}
    </div>
    <div class="capture-row pzki-aktionen"><button type="button" class="btn btn--primary" id="pzki-uebernehmen">✓ Übernehmen</button></div>
    <p id="pzki-meldung" class="capture-status"></p>`;
  box._vorschlaege = vs;
  box._jahr = jahr;
  box.querySelectorAll("[data-pzki-zuschneiden]").forEach((b) => b.addEventListener("click", () => pzkiZuschneiden(b.dataset.pzkiZuschneiden)));
  box.querySelector("#pzki-uebernehmen").addEventListener("click", pzkiUebernehmen);
}

const pzkiFotoTitel = () => ({ jahresgedenken: "Jahresgedenken", danksagung: "Danksagung", sterbebild: "Sterbebild" }[PZKI.ergebnis?.art] || "Partezettel");

function pzkiNeuHinweis() {
  const e = PZKI.ergebnis || {};
  const n = (l) => (l || []).filter((x) => x?.vorname).map((x) => x.vorname).join(", ");
  const teile = [];
  if (n(e.ehepartner)) teile.push(`Ehepartner: ${pzkiH(n(e.ehepartner))}`);
  if (n(e.kinder)) teile.push(`Kinder: ${pzkiH(n(e.kinder))}`);
  return teile.length
    ? `${teile.join(" · ")} – werden als Namen ohne Datenblatt eingetragen; im Datenblatt mit „↗ Datenblatt“ zu eigenen Personen machen oder mit vorhandenen verbinden.`
    : "Eltern, Ehepartner und Kinder bitte danach im Datenblatt verbinden.";
}

async function pzkiZuschneiden(art) {
  const t = PZKI[art];
  if (!t || !PZKI.datei) return;
  const blob = await openPhotoEditor(PZKI.datei, { crop: t.crop, voll: true, maxKB: art === "portraet" ? 200 : 700, titel: art === "portraet" ? "Porträt zuschneiden" : "Partezettel zuschneiden" });
  if (!blob) return;
  t.crop = { ...fotoEditorCrop };
  if (t.url) URL.revokeObjectURL(t.url);
  t.blob = blob; t.url = URL.createObjectURL(blob);
  const img = document.querySelector(`[data-pzki-zuschneiden="${art}"]`)?.parentElement?.querySelector("img");
  if (img) img.src = t.url;
}

async function pzkiFotoHochladen(personId, blob, { schluessel = false, titel = null, jahr = null } = {}) {
  const path = `${personId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await sb.storage.from(BUCKET_FOTOS).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;
  if (schluessel) {
    const { error: resetErr } = await sb.from("fotos").update({ ist_schluesselfoto: false }).eq("personen_id", personId);
    if (resetErr) throw resetErr;
  }
  const zeile = { personen_id: personId, dateipfad: path, ist_schluesselfoto: schluessel };
  if (titel) zeile.titel = titel;
  if (jahr) zeile.aufnahme_jahr = Number(jahr);
  let { error } = await sb.from("fotos").insert(zeile);
  if (error && (titel || jahr)) ({ error } = await sb.from("fotos").insert({ personen_id: personId, dateipfad: path, ist_schluesselfoto: schluessel }));
  if (error) throw error;
}

async function pzkiUebernehmen() {
  const box = document.getElementById("pzki-aenderungen");
  const meldung = document.getElementById("pzki-meldung");
  const knopf = document.getElementById("pzki-uebernehmen");
  const v = PZKI.ergebnis?.verstorbene || {};
  try {
    knopf.disabled = true;
    meldung.textContent = "Wird gespeichert …";
    await ensureSession();
    let personId = PZKI.gewaehlt;
    const erledigt = [];
    if (personId === "neu") {
      const neu = {
        id: crypto.randomUUID(),
        vorname: document.getElementById("pzki-n-vorname").value.trim() || null,
        nachname: document.getElementById("pzki-n-nachname").value.trim() || null,
        Ledigenname: document.getElementById("pzki-n-ledig").value.trim() || null,
        geschlecht: document.getElementById("pzki-n-geschlecht").value || null,
        geburtsdatum: pzkiIstDatum(v.geburtsdatum) ? v.geburtsdatum : null,
        geburtsjahr: pzkiIstDatum(v.geburtsdatum) ? null : (v.geburtsjahr || null),
        sterbedatum: pzkiIstDatum(v.sterbedatum) ? v.sterbedatum : null,
        sterbejahr: pzkiIstDatum(v.sterbedatum) ? null : (v.sterbejahr || null),
        todesumstand_text: v.todesumstand || null,
      };
      if (!neu.vorname && !neu.nachname) throw new Error("Bitte mindestens Vor- oder Nachnamen angeben.");
      // v450: Ehepartner und Kinder als „Namen ohne Datenblatt“, Herkunft und Notiz aus der Anzeige
      const e = PZKI.ergebnis || {};
      const namen = (liste) => (liste || []).filter((x) => x?.vorname).map((x) => ({ name: [x.vorname, x.nachname].filter(Boolean).join(" ") }));
      const zusatz = {
        partner_ohne_datenblatt: namen(e.ehepartner),
        kinder_ohne_datenblatt: namen(e.kinder),
        herkunft_quelle: e.quelle_text || pzkiFotoTitel(),
        Notiz: e.notiz || null,
      };
      const zeile = Object.fromEntries(Object.entries(neu).filter(([, x]) => x !== null && x !== ""));
      let { error } = await sb.from("personen").insert({ ...zeile, ...Object.fromEntries(Object.entries(zusatz).filter(([, x]) => x && (!Array.isArray(x) || x.length))) });
      if (error && /column|spalte|schema/i.test(error.message || "")) ({ error } = await sb.from("personen").insert(zeile));
      if (error) throw error;
      personId = neu.id;
      PZKI.gewaehlt = personId;   // falls danach ein Foto scheitert: erneutes „Übernehmen“ legt die Person nicht doppelt an
      erledigt.push("neue Person angelegt");
    } else {
      const aenderung = {};
      const neueKinder = [], neuePartner = [];
      box.querySelectorAll("[data-pzki-feld]").forEach((c) => {
        if (!c.checked) return;
        const x = box._vorschlaege[Number(c.dataset.pzkiFeld)];
        if (x.felder._kind) { neueKinder.push(x.felder._kind); return; }
        if (x.felder._partner) { neuePartner.push(x.felder._partner); return; }
        Object.assign(aenderung, x.felder);
        erledigt.push(x.label);
      });
      if (neueKinder.length) {   // v452: an die vorhandenen „Kinder ohne Datenblatt“ anhängen (frisch gelesen, nichts überschreiben)
        const { data: frisch, error: lesefehler } = await sb.from("personen").select("kinder_ohne_datenblatt").eq("id", personId).maybeSingle();
        if (lesefehler) throw lesefehler;
        const vorhanden = partnerOhneListe(frisch?.kinder_ohne_datenblatt);
        const dazu = neueKinder.filter((k) => !vorhanden.some((o) => pzkiNorm(o.name) === pzkiNorm(k.name)));
        if (dazu.length) {
          aenderung.kinder_ohne_datenblatt = [...vorhanden, ...dazu];
          erledigt.push(`${dazu.length} ${dazu.length === 1 ? "Kind" : "Kinder"} ergänzt (${dazu.map((k) => k.name).join(", ")})`);
        }
        delete PZKI.angehoerige[personId];
      }
      if (neuePartner.length) {   // v459: an die vorhandenen „Ehepartner ohne Datenblatt“ anhängen (frisch gelesen, nichts überschreiben)
        const { data: frisch, error: lesefehler } = await sb.from("personen").select("partner_ohne_datenblatt").eq("id", personId).maybeSingle();
        if (lesefehler) throw lesefehler;
        const vorhanden = partnerOhneListe(frisch?.partner_ohne_datenblatt);
        const dazu = neuePartner.filter((k) => !vorhanden.some((o) => pzkiNorm(o.name) === pzkiNorm(k.name)));
        if (dazu.length) {
          aenderung.partner_ohne_datenblatt = [...vorhanden, ...dazu];
          erledigt.push(`Ehepartner ergänzt (${dazu.map((k) => k.name).join(", ")})`);
        }
        delete PZKI.angehoerige[personId];
      }
      if (Object.keys(aenderung).length) {
        const { error } = await sb.from("personen").update(aenderung).eq("id", personId);
        if (error) throw error;
      }
    }
    const fotoAn = (art) => box.querySelector(`[data-pzki-foto="${art}"]`)?.checked && PZKI[art]?.blob;
    if (fotoAn("anzeige")) {
      meldung.textContent = "Partezettel wird hochgeladen …";
      await pzkiFotoHochladen(personId, PZKI.anzeige.blob, { titel: pzkiFotoTitel(), jahr: box._jahr });
      erledigt.push(`${pzkiFotoTitel()} gespeichert`);
    }
    if (fotoAn("portraet")) {
      meldung.textContent = "Porträt wird hochgeladen …";
      await pzkiFotoHochladen(personId, PZKI.portraet.blob, { schluessel: true });
      erledigt.push("Schlüsselfoto gesetzt");
    }
    if (typeof invalidierePersonenCache === "function") invalidierePersonenCache();
    try { await loadPersonen(true); } catch {}
    meldung.innerHTML = `✓ ${pzkiH(erledigt.length ? erledigt.join(", ") : "Nichts zu ändern")}. <button type="button" class="btn btn--secondary" id="pzki-oeffnen">Person öffnen</button>`;
    document.getElementById("pzki-oeffnen").addEventListener("click", () => { pzkiSchliessen(); openPersonDetail(personId); });
    if (PZKI.paket) {
      const weiter = document.createElement("button");
      weiter.type = "button"; weiter.className = "btn btn--primary"; weiter.style.marginLeft = ".4rem";
      weiter.textContent = PZKI.paketIndex + 1 < PZKI.paket.length ? "Nächste Anzeige →" : "Fertig";
      weiter.addEventListener("click", () => pzkiPaketEintrag(PZKI.paketIndex + 1));
      meldung.appendChild(weiter);
    }
    knopf.hidden = true;
    pzkiStatus(`✓ ${erledigt.join(", ") || "Fertig"}`);
  } catch (err) {
    knopf.disabled = false;
    meldung.textContent = `⚠️ Fehler: ${err.message || err}`;
  }
}

document.getElementById("pzki-paket")?.addEventListener("change", (e) => {
  const datei = e.target.files?.[0];
  e.target.value = "";
  pzkiPaketLaden(datei);
});
document.getElementById("pzki-input")?.addEventListener("change", (e) => {
  const datei = e.target.files?.[0];
  e.target.value = "";
  pzkiStarten(datei);
});
