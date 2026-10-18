// Familienspuren – 3D-Wurzelbaum (v342)
// Die gewählte Person bildet den Stamm, die Vorfahren verzweigen sich nach oben wie die Krone eines Baumes.
// three.js wird erst beim ersten Öffnen der 3D-Ansicht geladen (CDN, feste Version) und im Service Worker gespeichert.
// Es werden keine Fotos aus Supabase geladen: Die Ansicht nutzt nur bereits vorhandene Namen und Jahreszahlen.

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

let THREE = null;
let ansicht = null;

export async function baumZeigen(container, daten, rueckrufe = {}) {
  if (!THREE) THREE = await import(THREE_URL);
  if (!ansicht || ansicht.container !== container) {
    if (ansicht) ansicht.zerstoeren();
    ansicht = erzeugeAnsicht(container);
  }
  ansicht.setzeDaten(daten, rueckrufe);
}

export function pausieren() { if (ansicht) ansicht.pausieren(); }
export function fortsetzen() { if (ansicht) ansicht.fortsetzen(); }
export function pruefInfo() { return ansicht ? ansicht.pruefInfo() : null; }

function erzeugeAnsicht(container) {
  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "3D-Wurzelbaum der Vorfahren");
  canvas.tabIndex = 0;
  container.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    container.innerHTML = "";
    throw new Error("WebGL ist auf diesem Gerät oder in diesem Browser nicht verfügbar.");
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  szene.add(new THREE.HemisphereLight(0xffffff, 0xc9d3c3, 1.15));
  const sonne = new THREE.DirectionalLight(0xffffff, 1.25);
  sonne.position.set(6, 14, 8);
  szene.add(sonne);

  // ---------- Bedienoberfläche über der Zeichenfläche ----------
  const hud = document.createElement("div");
  hud.className = "tree3d__hud";
  const hinweis = document.createElement("div");
  hinweis.className = "tree3d__hint";
  const grob = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  hinweis.textContent = grob
    ? "Ziehen: drehen · Zwei Finger: zoomen, drehen, schieben · Antippen: Person wählen · Doppeltippen: Personendaten öffnen"
    : "Ziehen: drehen · Mausrad: zoomen · Umschalt + Ziehen: schieben · Klicken: Person wählen · Doppelklick: Personendaten öffnen";
  const werkzeuge = document.createElement("div");
  werkzeuge.className = "tree3d__tools";
  const knopfAuto = document.createElement("button");
  knopfAuto.type = "button";
  knopfAuto.className = "tree3d__tool";
  const knopfReset = document.createElement("button");
  knopfReset.type = "button";
  knopfReset.className = "tree3d__tool";
  knopfReset.textContent = "↺ Ansicht";
  knopfReset.title = "Ansicht zurücksetzen";
  const knopfVollbild = document.createElement("button");
  knopfVollbild.type = "button";
  knopfVollbild.className = "tree3d__tool";
  knopfVollbild.textContent = "⤢ Vollbild";
  knopfVollbild.title = "Vollbild ein/aus";
  const knopfHilfe = document.createElement("button");
  knopfHilfe.type = "button";
  knopfHilfe.className = "tree3d__tool";
  knopfHilfe.textContent = "?";
  knopfHilfe.title = "Bedienung anzeigen";
  knopfHilfe.setAttribute("aria-label", "Bedienung anzeigen");
  werkzeuge.append(knopfAuto, knopfReset, knopfVollbild, knopfHilfe);
  hud.append(hinweis, werkzeuge);
  const leiste = document.createElement("div");
  leiste.className = "tree3d__bar";
  leiste.hidden = true;
  container.append(hud, leiste);
  let hinweisTimer = setTimeout(() => hinweis.classList.add("is-weg"), 9000);
  // „?“ zeigt die Bedienhinweise jederzeit wieder an
  knopfHilfe.addEventListener("click", () => {
    hinweis.classList.remove("is-weg");
    clearTimeout(hinweisTimer);
    hinweisTimer = setTimeout(() => hinweis.classList.add("is-weg"), 14000);
  });

  // ---------- Zustand ----------
  const z = { ziel: new THREE.Vector3(0, 5, 0), radius: 18, phi: 1.2, theta: 0.6 };
  let standard = { ziel: z.ziel.clone(), radius: z.radius, phi: z.phi, theta: z.theta };
  let autoDrehung = true;
  let laeuft = true;
  let schmutzig = true;
  let rahmen = 0;
  let baum = null;            // { gruppe, kugeln, labels, gens }
  let auswahl = null;         // userData des gewählten Knotens
  let aktuelleRueckrufe = {};
  let letzterTipp = { id: null, zeit: 0 };

  const aktualisiereAutoKnopf = () => {
    knopfAuto.textContent = autoDrehung ? "⏸ Drehung" : "▶ Drehung";
    knopfAuto.title = autoDrehung ? "Automatische Drehung anhalten" : "Automatisch drehen";
  };
  aktualisiereAutoKnopf();

  const kameraSetzen = () => {
    const s = Math.sin(z.phi);
    kamera.position.set(
      z.ziel.x + z.radius * s * Math.sin(z.theta),
      z.ziel.y + z.radius * Math.cos(z.phi),
      z.ziel.z + z.radius * s * Math.cos(z.theta)
    );
    kamera.lookAt(z.ziel);
  };
  const begrenzen = () => {
    const hoehe = baum ? baum.gens * 2.4 : 12;
    z.phi = Math.min(1.72, Math.max(0.15, z.phi));
    z.radius = Math.min(hoehe * 4 + 30, Math.max(4, z.radius));
    z.ziel.y = Math.min(hoehe + 3, Math.max(-1.5, z.ziel.y));
    z.ziel.x = Math.min(14, Math.max(-14, z.ziel.x));
    z.ziel.z = Math.min(14, Math.max(-14, z.ziel.z));
  };
  const anfordern = () => {
    schmutzig = true;
    if (laeuft && !rahmen) rahmen = requestAnimationFrame(zeichnen);
  };

  const groesse = () => {
    const r = container.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    kamera.aspect = r.width / r.height;
    kamera.updateProjectionMatrix();
    anfordern();
  };
  const beobachter = typeof ResizeObserver !== "undefined" ? new ResizeObserver(groesse) : null;
  if (beobachter) beobachter.observe(container);
  window.addEventListener("resize", groesse);

  // ---------- Zeichnen ----------
  const aktualisiereLabels = () => {
    if (!baum) return;
    for (const eintrag of baum.labels) {
      const d = kamera.position.distanceTo(eintrag.sprite.position);
      const grenze = 17 + (baum.gens - eintrag.gen) * 6;
      let deckung = eintrag.gen <= 1 ? 1 : Math.min(1, Math.max(0, (grenze - d) / 6));
      if (auswahl && auswahl.id === eintrag.id) deckung = 1;
      eintrag.sprite.material.opacity = deckung;
      eintrag.sprite.visible = deckung > 0.03;
    }
  };
  function zeichnen() {
    rahmen = 0;
    if (!laeuft) return;
    if (autoDrehung) { z.theta += 0.0035; schmutzig = true; }
    if (schmutzig) {
      begrenzen();
      kameraSetzen();
      aktualisiereLabels();
      renderer.render(szene, kamera);
      schmutzig = false;
    }
    if (autoDrehung || schmutzig) rahmen = requestAnimationFrame(zeichnen);
  }

  // ---------- Steuerung ----------
  const drehen = (dx, dy) => { z.theta -= dx * 0.008; z.phi -= dy * 0.006; anfordern(); };
  const schieben = (dx, dy) => {
    const faktor = z.radius * 0.0016;
    z.ziel.y += dy * faktor;
    z.ziel.x -= Math.cos(z.theta) * dx * faktor;
    z.ziel.z += Math.sin(z.theta) * dx * faktor;
    anfordern();
  };
  const stoppeAuto = () => {
    if (autoDrehung) { autoDrehung = false; aktualisiereAutoKnopf(); }
    hinweis.classList.add("is-weg");
  };

  const zeiger = new Map();
  let startZeit = 0;
  let startPos = { x: 0, y: 0 };
  let bewegt = false;
  let zweiLetzt = null;
  const zweiWerte = () => {
    const [a, b] = [...zeiger.values()];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, abstand: Math.hypot(a.x - b.x, a.y - b.y) || 1, winkel: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  canvas.addEventListener("pointerdown", (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetische Ereignisse */ }
    zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stoppeAuto();
    if (zeiger.size === 1) { startZeit = performance.now(); startPos = { x: e.clientX, y: e.clientY }; bewegt = false; }
    if (zeiger.size === 2) { zweiLetzt = zweiWerte(); bewegt = true; }
  });
  canvas.addEventListener("pointermove", (e) => {
    const alt = zeiger.get(e.pointerId);
    if (!alt) return;
    const neu = { x: e.clientX, y: e.clientY };
    zeiger.set(e.pointerId, neu);
    if (zeiger.size === 1) {
      if (!bewegt && Math.hypot(neu.x - startPos.x, neu.y - startPos.y) > 6) bewegt = true;
      if (!bewegt) return;
      const dx = neu.x - alt.x;
      const dy = neu.y - alt.y;
      if ((e.buttons & 2) || e.shiftKey) schieben(dx, dy); else drehen(dx, dy);
    } else if (zeiger.size === 2 && zweiLetzt) {
      const jetzt = zweiWerte();
      z.radius *= Math.min(1.6, Math.max(0.6, zweiLetzt.abstand / jetzt.abstand));   // Spreizen = näher
      let dw = jetzt.winkel - zweiLetzt.winkel;
      if (dw > Math.PI) dw -= 2 * Math.PI;
      if (dw < -Math.PI) dw += 2 * Math.PI;
      z.theta -= dw;                                                                   // Drehen mit zwei Fingern
      schieben(jetzt.mx - zweiLetzt.mx, jetzt.my - zweiLetzt.my);
      zweiLetzt = jetzt;
      anfordern();
    }
  });
  const loslassen = (e) => {
    if (!zeiger.has(e.pointerId)) return;
    const war = zeiger.size;
    zeiger.delete(e.pointerId);
    if (war === 1 && e.type === "pointerup" && !bewegt && performance.now() - startZeit < 600) tippen(e.clientX, e.clientY);
    if (zeiger.size === 1) {
      const rest = [...zeiger.values()][0];
      startPos = { x: rest.x, y: rest.y };
      bewegt = true;
    }
    zweiLetzt = null;
  };
  canvas.addEventListener("pointerup", loslassen);
  canvas.addEventListener("pointercancel", loslassen);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    stoppeAuto();
    z.radius *= Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.0014);
    anfordern();
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("keydown", (e) => {
    const schritt = e.shiftKey ? 30 : 12;
    if (e.key === "ArrowLeft") { drehen(-schritt, 0); stoppeAuto(); }
    else if (e.key === "ArrowRight") { drehen(schritt, 0); stoppeAuto(); }
    else if (e.key === "ArrowUp") { drehen(0, -schritt); stoppeAuto(); }
    else if (e.key === "ArrowDown") { drehen(0, schritt); stoppeAuto(); }
    else if (e.key === "+" || e.key === "=") { z.radius *= 0.9; anfordern(); }
    else if (e.key === "-") { z.radius *= 1.1; anfordern(); }
  });

  // Vollbild: Die Zeichenfläche füllt den ganzen Bildschirm (kein versehentliches Scrollen der Seite beim Drehen).
  let vollbild = false;
  const setzeVollbild = (an) => {
    vollbild = !!an;
    container.classList.toggle("is-vollbild", vollbild);
    document.body.classList.toggle("tree3d-vollbild", vollbild);
    knopfVollbild.textContent = vollbild ? "✕ Vollbild beenden" : "⤢ Vollbild";
    groesse();
  };
  knopfVollbild.addEventListener("click", () => setzeVollbild(!vollbild));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && vollbild) setzeVollbild(false); });
  knopfAuto.addEventListener("click", () => { autoDrehung = !autoDrehung; aktualisiereAutoKnopf(); anfordern(); });
  knopfReset.addEventListener("click", () => {
    z.ziel.copy(standard.ziel); z.radius = standard.radius; z.phi = standard.phi; z.theta = standard.theta;
    anfordern();
  });

  // ---------- Auswahl ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const waehle = (daten) => {
    if (auswahl && auswahl.kugel) auswahl.kugel.scale.setScalar(1);
    auswahl = daten || null;
    if (auswahl && auswahl.kugel) auswahl.kugel.scale.setScalar(1.4);
    if (!auswahl) { leiste.hidden = true; leiste.innerHTML = ""; anfordern(); return; }
    leiste.hidden = false;
    leiste.innerHTML = "";
    const text = document.createElement("div");
    text.className = "tree3d__bar-text";
    const name = document.createElement("strong");
    name.textContent = auswahl.name;
    const sub = document.createElement("span");
    sub.textContent = auswahl.jahre || "";
    text.append(name, sub);
    const aktionen = document.createElement("div");
    aktionen.className = "tree3d__bar-actions";
    const mitte = document.createElement("button");
    mitte.type = "button"; mitte.dataset.aktion = "mitte"; mitte.textContent = "Als Mitte";
    const oeffnen = document.createElement("button");
    oeffnen.type = "button"; oeffnen.dataset.aktion = "oeffnen"; oeffnen.textContent = "Personendaten";
    aktionen.append(mitte, oeffnen);
    leiste.append(text, aktionen);
    anfordern();
  };
  leiste.addEventListener("click", (e) => {
    const knopf = e.target.closest("button[data-aktion]");
    if (!knopf || !auswahl) return;
    const id = auswahl.id;
    if (knopf.dataset.aktion === "mitte" && aktuelleRueckrufe.alsMitte) aktuelleRueckrufe.alsMitte(id);
    if (knopf.dataset.aktion === "oeffnen" && aktuelleRueckrufe.oeffnen) aktuelleRueckrufe.oeffnen(id);
  });
  // Kugeln und sichtbare Namensschilder sind anklickbar
  const trefferZiele = () => [...baum.kugeln, ...baum.labels.filter((l) => l.sprite.visible).map((l) => l.sprite)];
  let letzteOeffnung = 0;
  function oeffnePerson(id) {
    letzteOeffnung = performance.now();
    if (aktuelleRueckrufe.oeffnen) aktuelleRueckrufe.oeffnen(id);
  }
  // Doppelklick mit der Maus (Geschwindigkeit nach Systemeinstellung): Personendaten öffnen
  canvas.addEventListener("dblclick", (e) => {
    if (!baum || performance.now() - letzteOeffnung < 700) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, kamera);
    const treffer = raycaster.intersectObjects(trefferZiele(), false);
    const daten = treffer.length ? treffer[0].object.userData : null;
    if (daten && daten.id) oeffnePerson(daten.id);
  });
  function tippen(x, y) {
    if (!baum) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, kamera);
    const treffer = raycaster.intersectObjects(trefferZiele(), false);
    if (!treffer.length) { waehle(null); return; }
    const daten = treffer[0].object.userData;
    if (!daten.id) { waehle(null); return; }
    const jetzt = performance.now();
    if (letzterTipp.id === daten.id && jetzt - letzterTipp.zeit < 450) {
      letzterTipp = { id: null, zeit: 0 };
      oeffnePerson(daten.id);
      return;
    }
    letzterTipp = { id: daten.id, zeit: jetzt };
    waehle(daten);
  }

  // ---------- Baum aufbauen ----------
  const FARBE = { m: 0x7d9fc0, w: 0xc79aa7, u: 0xb8c4b6 };
  const ABSTAND = 2.4;

  function entsorge(gruppe) {
    gruppe.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  function position(gen, idx) {
    if (gen === 0) return new THREE.Vector3(0, 0, 0);
    const n = 2 ** gen;
    const winkel = ((idx + 0.5) / n) * Math.PI * 2;
    const radius = 1.7 * Math.pow(gen, 0.95);
    const stufe = ((idx % 4) - 1.5) * 0.16;
    return new THREE.Vector3(Math.cos(winkel) * radius, gen * ABSTAND + stufe, Math.sin(winkel) * radius);
  }

  function rundesRechteck(x, ctx, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
  }

  function macheLabel(name, jahre) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = jahre ? 150 : 100;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(248,246,239,0.95)";
    rundesRechteck(null, x, c.width, c.height, 26);
    x.fill();
    x.strokeStyle = "#b9cdb9";
    x.lineWidth = 5;
    x.stroke();
    let groesseSchrift = 40;
    x.font = `700 ${groesseSchrift}px Georgia, "Times New Roman", serif`;
    while (x.measureText(name).width > c.width - 40 && groesseSchrift > 22) {
      groesseSchrift -= 2;
      x.font = `700 ${groesseSchrift}px Georgia, "Times New Roman", serif`;
    }
    let text = name;
    while (x.measureText(text).width > c.width - 40 && text.length > 4) text = text.slice(0, -2);
    if (text !== name) text = `${text.trimEnd()}…`;
    x.fillStyle = "#263d30";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, c.width / 2, jahre ? c.height * 0.36 : c.height / 2);
    if (jahre) {
      x.font = '500 29px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
      x.fillStyle = "#6c746d";
      x.fillText(jahre, c.width / 2, c.height * 0.76);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sprite.scale.set(3.4, (3.4 * c.height) / c.width, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  function ast(von, nach, gen, nurKnospe) {
    const mitte = new THREE.Vector3(von.x + (nach.x - von.x) * 0.18, von.y + (nach.y - von.y) * 0.7, von.z + (nach.z - von.z) * 0.18);
    const kurve = new THREE.QuadraticBezierCurve3(von, mitte, nach);
    const dicke = Math.max(0.03, 0.17 * Math.pow(0.72, gen)) * (nurKnospe ? 0.55 : 1);
    const geo = new THREE.TubeGeometry(kurve, 14, dicke, 6, false);
    const mat = new THREE.MeshStandardMaterial({ color: nurKnospe ? 0xb5a98f : 0x8b7047, roughness: 0.85, metalness: 0 });
    return new THREE.Mesh(geo, mat);
  }

  function baueBaum(daten) {
    const gens = daten.gens;
    const gruppe = new THREE.Group();
    const kugeln = [];
    const labels = [];
    const knoten = daten.knoten.map((k) => ({ ...k, pos: position(k.gen, k.idx) }));
    const nachSchluessel = new Map(knoten.map((k) => [`${k.gen}:${k.idx}`, k]));

    // Boden, Stamm und Wurzeln
    const bodenRadius = 6 + gens * 1.7;
    const boden = new THREE.Mesh(
      new THREE.CircleGeometry(bodenRadius, 72),
      new THREE.MeshBasicMaterial({ color: 0xe3e8da, transparent: true, opacity: 0.55, depthWrite: false })
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.y = -1.3;
    gruppe.add(boden);
    const stamm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.46, 1.4, 14),
      new THREE.MeshStandardMaterial({ color: 0x7b6340, roughness: 0.9 })
    );
    stamm.position.y = -0.62;
    gruppe.add(stamm);
    for (let i = 0; i < 7; i += 1) {
      const w = (i / 7) * Math.PI * 2 + 0.3;
      const ende = new THREE.Vector3(Math.cos(w) * 3.2, -2.7 - (i % 3) * 0.3, Math.sin(w) * 3.2);
      const kurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -1.2, 0), new THREE.Vector3(Math.cos(w) * 1.1, -1.9, Math.sin(w) * 1.1), ende);
      gruppe.add(new THREE.Mesh(new THREE.TubeGeometry(kurve, 12, 0.07, 5, false), new THREE.MeshStandardMaterial({ color: 0x6f5d43, roughness: 0.9 })));
    }

    // Äste: vom Kind zu Vater und Mutter
    for (const k of knoten) {
      if (!k.id || k.gen >= gens - 1) continue;
      for (const c of [k.idx * 2, k.idx * 2 + 1]) {
        const eltern = nachSchluessel.get(`${k.gen + 1}:${c}`);
        if (eltern) gruppe.add(ast(k.pos, eltern.pos, k.gen, !eltern.id));
      }
    }

    // Personen als Blätter, dazu Beschriftungen
    for (const k of knoten) {
      const wurzel = k.gen === 0;
      if (!k.id) {
        const knospe = new THREE.Mesh(
          new THREE.SphereGeometry(0.17, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xc8d2c4, transparent: true, opacity: 0.5, roughness: 0.9 })
        );
        knospe.position.copy(k.pos);
        knospe.userData = { id: null, kugel: knospe };
        gruppe.add(knospe);
        continue;
      }
      const r = wurzel ? 0.72 : Math.max(0.2, 0.56 * Math.pow(0.9, k.gen));
      const farbe = wurzel ? 0x174f3b : (FARBE[k.geschlecht] || FARBE.u);
      const kugel = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 18),
        new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.55, metalness: 0.05 })
      );
      kugel.position.copy(k.pos);
      kugel.userData = { id: k.id, name: k.name, jahre: k.jahre, gen: k.gen, kugel };
      gruppe.add(kugel);
      kugeln.push(kugel);
      if (wurzel) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r * 1.45, 0.06, 10, 48),
          new THREE.MeshStandardMaterial({ color: 0x2f7d5b, emissive: 0x174f3b, emissiveIntensity: 0.35 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(k.pos);
        gruppe.add(ring);
      }
      const sprite = macheLabel(k.name, k.jahre);
      const faktor = wurzel ? 1.15 : Math.max(0.62, 1 - k.gen * 0.075);
      sprite.scale.multiplyScalar(faktor);
      sprite.position.set(k.pos.x, k.pos.y + r + sprite.scale.y * 0.55 + 0.08, k.pos.z);
      sprite.userData = kugel.userData;   // Klick auf den Namen wählt die Person wie ein Klick auf die Kugel
      gruppe.add(sprite);
      labels.push({ sprite, gen: k.gen, id: k.id });
    }
    return { gruppe, kugeln, labels, gens };
  }

  function setzeDaten(daten, rueckrufe) {
    aktuelleRueckrufe = rueckrufe || {};
    if (baum) { szene.remove(baum.gruppe); entsorge(baum.gruppe); }
    waehle(null);
    baum = baueBaum(daten);
    szene.add(baum.gruppe);
    const hoehe = daten.gens * ABSTAND;
    standard = { ziel: new THREE.Vector3(0, hoehe * 0.46, 0), radius: hoehe * 1.55 + 9, phi: 1.2, theta: 0.6 };
    z.ziel.copy(standard.ziel); z.radius = standard.radius; z.phi = standard.phi; z.theta = standard.theta;
    groesse();
    anfordern();
  }

  function pausieren() { if (vollbild) setzeVollbild(false); laeuft = false; if (rahmen) { cancelAnimationFrame(rahmen); rahmen = 0; } }
  function fortsetzen() { laeuft = true; groesse(); anfordern(); }
  function zerstoeren() {
    pausieren();
    clearTimeout(hinweisTimer);
    if (beobachter) beobachter.disconnect();
    window.removeEventListener("resize", groesse);
    if (baum) entsorge(baum.gruppe);
    renderer.dispose();
    container.innerHTML = "";
    document.body.classList.remove("tree3d-vollbild");
  }
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); pausieren(); });
  canvas.addEventListener("webglcontextrestored", () => { fortsetzen(); });
  function pruefInfo() {
    const r = canvas.getBoundingClientRect();
    const positionen = {};
    if (baum) {
      for (const kugel of baum.kugeln) {
        const p = kugel.position.clone().project(kamera);
        positionen[kugel.userData.id] = { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, vorne: p.z < 1 };
      }
    }
    const labelPositionen = {};
    if (baum) {
      for (const l of baum.labels) {
        const p = l.sprite.position.clone().project(kamera);
        labelPositionen[l.id] = { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, sichtbar: l.sprite.visible };
      }
    }
    return {
      positionen,
      labelPositionen,
      kugeln: baum ? baum.kugeln.length : 0,
      beschriftungen: baum ? baum.labels.length : 0,
      sichtbareBeschriftungen: baum ? baum.labels.filter((l) => l.sprite.visible).length : 0,
      radius: z.radius, phi: z.phi, theta: z.theta, ziel: { x: z.ziel.x, y: z.ziel.y, z: z.ziel.z },
      autoDrehung, auswahl: auswahl ? auswahl.id : null
    };
  }

  return { container, setzeDaten, pausieren, fortsetzen, zerstoeren, pruefInfo };
}
