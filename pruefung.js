// Familienspuren – Datenprüfung (nur Eigentümer), ab Version 443
// Sucht mögliche Dubletten und unwahrscheinliche Angaben. Was als „stimmt so“ oder „verschiedene Personen“
// markiert ist (Tabelle pruef_ausnahmen, Supabase Paket 12), erscheint bei späteren Prüfungen nicht mehr.
// Dubletten lassen sich zusammenführen (Funktion fs_personen_zusammenfuehren, Paket 12). Version 443

const PRUEF_REGELN = {
  dublette:             { sym: "👥", titel: "Mögliche Dubletten", text: "Gleicher Vorname, gleicher Familienname und gleiches Geburts- oder Sterbedatum.", ok: "✓ Verschiedene Personen" },
  tod_vor_geburt:       { sym: "⛔", titel: "Tod vor der Geburt", text: "Das Sterbedatum liegt vor dem Geburtsdatum." },
  kind_nach_tod_mutter: { sym: "🕯️", titel: "Kind nach dem Tod der Mutter geboren", text: "Ein Kind ist nach dem Sterbedatum der Mutter geboren." },
  kind_nach_tod_vater:  { sym: "🕯️", titel: "Kind lange nach dem Tod des Vaters geboren", text: "Ein Kind ist mehr als 10 Monate nach dem Tod des Vaters geboren." },
  vater_alter:          { sym: "👴", titel: "Ungewöhnliches Alter des Vaters", text: "Vater bei der Geburt jünger als 16 oder älter als 65." },
  mutter_alter:         { sym: "👵", titel: "Ungewöhnliches Alter der Mutter", text: "Mutter bei der Geburt jünger als 15 oder älter als 48." },
  ehe_jung:             { sym: "💍", titel: "Sehr junge Heirat", text: "Ein Partner war bei der Heirat jünger als 15." },
  ueber_105:            { sym: "🎂", titel: "Über 105 Jahre alt geworden", text: "Lebensdauer über 105 Jahre." },
  ohne_sterbedatum:     { sym: "❔", titel: "Vor 1900 geboren, ohne Sterbedatum", text: "Gilt als verstorben; das Sterbedatum fehlt noch.", hinweis: true }
};
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
  const passt = (a, b) => { const A = nachnamen(a), B = nachnamen(b); if (!A.size || !B.size) return true; for (const x of A) if (B.has(x)) return true; return false; };
  // „Anna“ und „Anna Maria“ passen zusammen, „Maria Franziska“ und „Maria Berta“ nicht (oft Zwillinge)
  const vornamePasst = (a, b) => { const A = n(a.vorname).split(" ").filter(Boolean), B = n(b.vorname).split(" ").filter(Boolean); const [k, g] = A.length <= B.length ? [A, B] : [B, A]; return k.every((t) => g.includes(t)); };
  const gruppen = new Map();
  const merke = (k, p) => { if (!gruppen.has(k)) gruppen.set(k, []); gruppen.get(k).push(p); };
  for (const p of d.personen) {
    const vn = n(p.vorname).split(" ")[0];
    if (!vn) continue;
    if (vollDatum(p.sterbedatum)) merke(`t|${vn}|${vollDatum(p.sterbedatum)}`, p);
    if (vollDatum(p.geburtsdatum)) merke(`g|${vn}|${vollDatum(p.geburtsdatum)}`, p);
    const gj = chrGebJahr(p), tj = chrTodJahr(p);
    if (gj && tj) for (const nn of nachnamen(p)) merke(`j|${vn}|${nn}|${gj}|${tj}`, p);
  }
  const partnerVon = new Map();
  for (const f of d.familien) { for (const [x, y] of [[f.partner_a_id, f.partner_b_id], [f.partner_b_id, f.partner_a_id]]) if (x && y) { if (!partnerVon.has(x)) partnerVon.set(x, new Set()); partnerVon.get(x).add(y); } }
  const wurzel = new Map(); const finde = (x) => { while (wurzel.get(x) !== x) { wurzel.set(x, wurzel.get(wurzel.get(x))); x = wurzel.get(x); } return x; };
  for (const liste of gruppen.values()) {
    if (liste.length < 2) continue;
    for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i], b = liste[j];
      if (a.id === b.id || !passt(a, b) || !vornamePasst(a, b) || partnerVon.get(a.id)?.has(b.id)) continue;
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
    pruefLetzte = { d, funde: datenPruefen(d) };
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
          <div class="pruef-personen">${f.personen.slice(0, f.regel === "dublette" ? 10 : 1).map((p) => chrLink(p)).join(f.regel === "dublette" ? "<br>" : "")}</div>
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
document.querySelector('.tab-btn[data-tab="verlauf"]')?.addEventListener("click", () => { if (rolleIstEigentuemer()) void datenpruefungZeigen(false); });

// ---------- Zusammenführen ----------
function zusammenfuehrenDialog(ids) {
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
  const FELDER = [["vorname", "Vorname"], ["nachname", "Nachname"], ["Ledigenname", "Ledigenname"], ["geschlecht", "Geschlecht"], ["geburtsdatum", "Geburt"], ["geburtsjahr", "Geburtsjahr"], ["sterbedatum", "Tod"], ["sterbejahr", "Sterbejahr"], ["herkunft_quelle", "Quelle"], ["taufbuch_link", "Taufbuch"], ["sterbebuch_link", "Sterbebuch"], ["Notiz", "Notiz"]];
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
      komfortFensterZu();
      await personenNachSpeichern();
      await datenpruefungZeigen(true);
      document.getElementById("pruef-meldung").textContent = `Zusammengeführt ✓ – ${weg.length + 1} Einträge sind jetzt einer. ` + document.getElementById("pruef-meldung").textContent;
    } catch (err) {
      m.textContent = /fs_personen_zusammenfuehren|function|schema cache/i.test(err.message || "") ? "Das Zusammenführen ist in der Datenbank noch nicht eingerichtet (Supabase Paket 12)." : `Fehler: ${err.message || err}`;
      e.currentTarget.disabled = false;
    }
  });
}
