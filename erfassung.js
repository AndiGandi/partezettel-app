// Familienspuren – Reiter, Ersteingabe (Foto, Sprachaufnahme, Datum, Verwandtschaft), Senden, Offline-Warteschlange
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 442

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    // Beim Verlassen des Stammbaums die letzte Verwandtschaftsanfrage verwerfen,
    // damit beim nächsten Öffnen keine alte Anfrage oder Ergebnisanzeige stehen bleibt.
    const aktiverTab = document.querySelector(".tab-btn.is-active")?.dataset.tab;
    if (aktiverTab === "stammbaum" && btn.dataset.tab !== "stammbaum") {
      const relationA = document.getElementById("tree-relation-person-a");
      const relationB = document.getElementById("tree-relation-person-b");
      const relationResult = document.getElementById("tree-relationship-result");
      const relationPanel = document.getElementById("tree-relationship-panel");
      if (relationA) relationA.value = "";
      if (relationB) relationB.value = "";
      if (relationResult) relationResult.innerHTML = "";
      if (relationPanel) relationPanel.hidden = true;
      treeRelationshipSelection = { personAId: null, personBId: null };
    }
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
    // Falls die Personenbearbeitung offen ist, beim Wechsel des Hauptreiters schließen.
    const overlay = document.getElementById("detail-overlay");
    if (overlay) overlay.hidden = true;

    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("is-active");
    // Beim Wechsel des Hauptbereichs immer an den Anfang der Ansicht springen.
    // So startet jede Ansicht oben und nicht an der zuletzt gespeicherten
    // Scrollposition der vorherigen Ansicht.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (btn.dataset.tab === "liste") await loadPersonen();
    if (btn.dataset.tab === "verlauf") { void papierkorbLaden(); await ladeVerlaufTab(false); }
    if (btn.dataset.tab === "fotos") {
      // Beim direkten Wechsel auf „Fotos“ zuerst die Personen laden,
      // damit die Auswahl nicht leer bleibt, wenn der Cache noch nicht gefüllt ist.
      if (!Array.isArray(personenCache) || personenCache.length === 0) {
        try { await loadPersonen(); } catch (err) {
          debugLog(`⚠️ Personen für Gruppenfotos: ${err.message || err}`);
        }
      }
      fuelleGruppenfotoPersonen();
      await ladeGruppenfotoListe();
    }
    if (btn.dataset.tab === "stammbaum") {
      // Wenn der Stammbaum aus der Bestand-Detailansicht geöffnet wird,
      // übernimmt er die dort zuletzt ausgewählte Person als Ausgangspunkt.
      await loadStammbaum();
      if (currentDetailPersonId && treePerson(currentDetailPersonId)) {
        setTreePersonSelection(currentDetailPersonId);
      }
    }
  });
});

// ---------- Foto-Aufnahme + Bearbeitung ----------
const fotoInput = document.getElementById("foto-input");
const fotoInputGalerie = document.getElementById("foto-input-galerie");
const fotoStatus = document.getElementById("foto-status");
const fotoPreview = document.getElementById("foto-preview");

let fotoEditorResolve = null;
let fotoEditorImage = null;
let fotoEditorRotation = 0;
let fotoEditorCrop = { x: 0, y: 0, w: 1, h: 1 };
let fotoEditorDragging = false;
let fotoEditorDragStart = null;

const photoEditor = document.getElementById("photo-editor");
const photoCanvas = document.getElementById("photo-editor-canvas");
const photoCtx = photoCanvas.getContext("2d");
const fotoEditorBaseCanvas = document.createElement("canvas");
let fotoEditorResize = false;
let fotoEditorResizeX = 0;
let fotoEditorResizeY = 0;

function bildZuDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawPhotoEditor() {
  if (!fotoEditorImage) return;
  const img = fotoEditorImage;
  const maxW = 1200;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const rotated = Math.abs(fotoEditorRotation % 180) === 90;
  photoCanvas.width = rotated ? h : w;
  photoCanvas.height = rotated ? w : h;

  // Erst das unverdeckte Bild in ein eigenes Canvas zeichnen.
  fotoEditorBaseCanvas.width = photoCanvas.width;
  fotoEditorBaseCanvas.height = photoCanvas.height;
  const bctx = fotoEditorBaseCanvas.getContext("2d");
  bctx.clearRect(0, 0, fotoEditorBaseCanvas.width, fotoEditorBaseCanvas.height);
  bctx.save();
  bctx.translate(fotoEditorBaseCanvas.width / 2, fotoEditorBaseCanvas.height / 2);
  bctx.rotate(fotoEditorRotation * Math.PI / 180);
  bctx.drawImage(img, -w / 2, -h / 2, w, h);
  bctx.restore();

  photoCtx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
  photoCtx.drawImage(fotoEditorBaseCanvas, 0, 0);

  const cw = photoCanvas.width * fotoEditorCrop.w;
  const ch = photoCanvas.height * fotoEditorCrop.h;
  const cx = photoCanvas.width * fotoEditorCrop.x;
  const cy = photoCanvas.height * fotoEditorCrop.y;
  photoCtx.save();
  photoCtx.fillStyle = "rgba(0,0,0,.50)";
  photoCtx.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
  photoCtx.globalCompositeOperation = "destination-out";
  photoCtx.fillRect(cx, cy, cw, ch);
  photoCtx.globalCompositeOperation = "source-over";
  photoCtx.strokeStyle = "white";
  photoCtx.lineWidth = Math.max(3, photoCanvas.width / 300);
  photoCtx.strokeRect(cx, cy, cw, ch);
  // Ecken als sichtbare Griffe
  const r = Math.max(12, photoCanvas.width / 45);
  photoCtx.fillStyle = "white";
  [[cx,cy],[cx+cw,cy],[cx,cy+ch],[cx+cw,cy+ch]].forEach(([x,y]) => photoCtx.fillRect(x-r/2,y-r/2,r,r));
  photoCtx.restore();
}

function openPhotoEditor(file) {
  return new Promise(async resolve => {
    fotoEditorResolve = resolve;
    fotoEditorRotation = 0;
    fotoEditorCrop = { x: 0, y: 0, w: 1, h: 1 };
    fotoEditorImage = await loadImage(await bildZuDataURL(file));
    photoEditor.hidden = false;
    syncCropControls();
    drawPhotoEditor();
  });
}

function closePhotoEditor(result) {
  photoEditor.hidden = true;
  const resolve = fotoEditorResolve;
  fotoEditorResolve = null;
  fotoEditorImage = null;
  if (resolve) resolve(result);
}

async function blobZuJPEGUnter200KB(blob, maxKB = 200) {
  if (!blob) return null;
  const MAX_BYTES = maxKB * 1024;   // v404: beim Austauschen von Gruppenfotos darf es größer sein (bessere Qualität)
  if (blob.size <= MAX_BYTES && blob.type === "image/jpeg") return new File([blob], "partezettel.jpg", { type: "image/jpeg" });

  const img = await loadImage(await bildZuDataURL(blob));
  let scale = 1;
  let quality = 0.82;

  const encode = (width, height, q) => new Promise(resolve => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, "image/jpeg", q);
  });

  // Zuerst nur die JPEG-Qualität reduzieren. Erst wenn das nicht reicht,
  // wird die Auflösung schrittweise reduziert. Dadurch bleiben kleine Bilder
  // und bereits gut komprimierte Fotos unverändert bzw. möglichst groß.
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = await encode(img.naturalWidth * scale, img.naturalHeight * scale, quality);
    if (candidate && candidate.size <= MAX_BYTES) {
      return new File([candidate], "partezettel.jpg", { type: "image/jpeg" });
    }
    if (quality > 0.42) {
      quality -= 0.08;
    } else {
      scale *= 0.88;
      quality = 0.76;
    }
  }

  // Letzter Versuch mit stärkerer Reduzierung, damit das Ziel auch bei
  // sehr detailreichen Bildern möglichst zuverlässig erreicht wird.
  while (scale > 0.25) {
    const candidate = await encode(img.naturalWidth * scale, img.naturalHeight * scale, 0.68);
    if (candidate && candidate.size <= MAX_BYTES) {
      return new File([candidate], "partezettel.jpg", { type: "image/jpeg" });
    }
    scale *= 0.82;
  }
  const fallback = await encode(img.naturalWidth * scale, img.naturalHeight * scale, 0.60);
  return fallback ? new File([fallback], "partezettel.jpg", { type: "image/jpeg" }) : null;
}

function exportEditedPhoto() {
  if (!fotoEditorImage || !fotoEditorBaseCanvas.width) return null;
  const src = fotoEditorBaseCanvas;
  const x = Math.max(0, Math.round(src.width * fotoEditorCrop.x));
  const y = Math.max(0, Math.round(src.height * fotoEditorCrop.y));
  const w = Math.max(1, Math.min(src.width - x, Math.round(src.width * fotoEditorCrop.w)));
  const h = Math.max(1, Math.min(src.height - y, Math.round(src.height * fotoEditorCrop.h)));
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  out.getContext("2d").drawImage(src, x, y, w, h, 0, 0, w, h);
  return new Promise(resolve => out.toBlob(async blob => resolve(blob ? await blobZuJPEGUnter200KB(blob) : null), "image/jpeg", .92));
}

async function bearbeiteFotos(files) {
  const result = [];
  for (const file of Array.from(files || [])) {
    const edited = await openPhotoEditor(file);
    if (edited) result.push(edited);
  }
  return result;
}

async function handleFotoAuswahl(files) {
  const auswahl = Array.from(files || []).filter(Boolean);
  if (!auswahl.length) return;
  const bearbeitet = await bearbeiteFotos(auswahl);
  if (!bearbeitet.length) return;
  currentFotoBlobs.push(...bearbeitet);
  aktualisiereSchluesselfotoAuswahl();
  fotoStatus.textContent = currentFotoBlobs.length === 1 ? "1 Foto ausgewählt ✓" : `${currentFotoBlobs.length} Fotos ausgewählt ✓`;
  if (fotoWeiterBtn) fotoWeiterBtn.hidden = false;
  const url = URL.createObjectURL(currentFotoBlobs[0]);
  fotoPreview.src = url;
  fotoPreview.hidden = false;
  fotoPreview.style.display = "block";
}

const schluesselfotoAuswahl = document.getElementById("schluesselfoto-auswahl");
const schluesselfotoAuswahlWrap = document.getElementById("schluesselfoto-auswahl-wrap");
function aktualisiereSchluesselfotoAuswahl() {
  if (!schluesselfotoAuswahl || !schluesselfotoAuswahlWrap) return;
  schluesselfotoAuswahl.innerHTML = "";
  currentFotoBlobs.forEach((foto, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Foto ${index + 1}${index === 0 ? " (erstes Foto)" : ""}`;
    schluesselfotoAuswahl.appendChild(option);
  });
  currentSchluesselfotoIndex = Math.min(currentSchluesselfotoIndex, Math.max(0, currentFotoBlobs.length - 1));
  schluesselfotoAuswahl.value = String(currentSchluesselfotoIndex);
  schluesselfotoAuswahlWrap.hidden = currentFotoBlobs.length === 0;
}
schluesselfotoAuswahl?.addEventListener("change", () => { currentSchluesselfotoIndex = Number(schluesselfotoAuswahl.value) || 0; });
fotoInput.addEventListener("change", async () => { await handleFotoAuswahl(fotoInput.files); fotoInput.value = ""; });
const fotoWeiterBtn = document.getElementById("foto-weiter-btn");
if (fotoWeiterBtn) fotoWeiterBtn.addEventListener("click", () => fotoInput.click());

// ---------- Sprachaufnahme (kein Zeitlimit) ----------
const audioBtn = document.getElementById("audio-record-btn");
const audioStatus = document.getElementById("audio-status");
const audioPreview = document.getElementById("audio-preview");

function pickAudioMimeType() {
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

let currentAudioMimeType = "audio/webm";
let currentAudioExt = "webm";

if (audioBtn && audioStatus && audioPreview) {
  audioBtn.addEventListener("click", async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chosenType = pickAudioMimeType();
        mediaRecorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          currentAudioMimeType = mediaRecorder.mimeType || chosenType || "audio/webm";
          currentAudioExt = currentAudioMimeType.includes("mp4") ? "m4a"
            : currentAudioMimeType.includes("ogg") ? "ogg"
            : "webm";
          currentAudioBlob = new Blob(audioChunks, { type: currentAudioMimeType });
          const url = URL.createObjectURL(currentAudioBlob);
          audioPreview.src = url;
          audioPreview.hidden = false;
          const dauer = Math.round((Date.now() - recordStartTime) / 1000);
          audioStatus.textContent = `Aufnahme: ${dauer}s ✓`;
          stream.getTracks().forEach((t) => t.stop());
        };
        mediaRecorder.start();
        recordStartTime = Date.now();
        isRecording = true;
        audioBtn.textContent = "⏹️ Aufnahme stoppen";
        audioStatus.textContent = "Aufnahme läuft …";
      } catch (err) {
        audioStatus.textContent = "Mikrofonzugriff fehlgeschlagen";
        debugLog(`❌ Mikrofon: ${err.message || err}`);
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      audioBtn.textContent = "🎙️ Aufnahme starten";
    }
  });
}
fotoInputGalerie.addEventListener("change", async () => { await handleFotoAuswahl(fotoInputGalerie.files); fotoInputGalerie.value = ""; });

document.getElementById("photo-rotate-left").addEventListener("click", () => { fotoEditorRotation -= 90; drawPhotoEditor(); });
document.getElementById("photo-rotate-right").addEventListener("click", () => { fotoEditorRotation += 90; drawPhotoEditor(); });
document.getElementById("photo-reset").addEventListener("click", () => { fotoEditorRotation=0; fotoEditorCrop={x:0,y:0,w:1,h:1}; syncCropControls(); drawPhotoEditor(); });
const cropLeft = document.getElementById("crop-left");
const cropRight = document.getElementById("crop-right");
const cropTop = document.getElementById("crop-top");
const cropBottom = document.getElementById("crop-bottom");
function syncCropControls() {
  if (!cropLeft) return;
  cropLeft.value = Math.round(fotoEditorCrop.x * 100);
  cropRight.value = Math.round((1 - (fotoEditorCrop.x + fotoEditorCrop.w)) * 100);
  cropTop.value = Math.round(fotoEditorCrop.y * 100);
  cropBottom.value = Math.round((1 - (fotoEditorCrop.y + fotoEditorCrop.h)) * 100);
}
function updateCropFromControls() {
  if (!cropLeft) return;
  let l=Number(cropLeft.value)/100, r=Number(cropRight.value)/100, t=Number(cropTop.value)/100, b=Number(cropBottom.value)/100;
  if (l+r>0.90) { r=Math.min(r,0.90-l); cropRight.value=Math.round(r*100); }
  if (t+b>0.90) { b=Math.min(b,0.90-t); cropBottom.value=Math.round(b*100); }
  fotoEditorCrop={x:l,y:t,w:1-l-r,h:1-t-b};
  drawPhotoEditor();
}
[cropLeft,cropRight,cropTop,cropBottom].filter(Boolean).forEach(el=>el.addEventListener("input", updateCropFromControls));
document.getElementById("photo-cancel").addEventListener("click", () => closePhotoEditor(null));
document.getElementById("photo-apply").addEventListener("click", async () => closePhotoEditor(await exportEditedPhoto()));

function clampCrop() {
  fotoEditorCrop.w = Math.max(.08, Math.min(1, fotoEditorCrop.w));
  fotoEditorCrop.h = Math.max(.08, Math.min(1, fotoEditorCrop.h));
  fotoEditorCrop.x = Math.max(0, Math.min(1 - fotoEditorCrop.w, fotoEditorCrop.x));
  fotoEditorCrop.y = Math.max(0, Math.min(1 - fotoEditorCrop.h, fotoEditorCrop.y));
}

function photoCanvasPoint(e) {
  const rect = photoCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  };
}

photoCanvas.addEventListener("pointerdown", e => {
  if (!fotoEditorImage) return;
  const p = photoCanvasPoint(e);
  const c = fotoEditorCrop;
  const edge = Math.max(0.025, 18 / Math.max(photoCanvas.width, photoCanvas.height));
  const nearL = Math.abs(p.x - c.x) < edge;
  const nearR = Math.abs(p.x - (c.x + c.w)) < edge;
  const nearT = Math.abs(p.y - c.y) < edge;
  const nearB = Math.abs(p.y - (c.y + c.h)) < edge;
  const nearCorner = (nearL || nearR) && (nearT || nearB);
  const inside = p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
  if (!nearCorner && !inside) return;
  fotoEditorDragging = true;
  fotoEditorResize = nearCorner;
  fotoEditorResizeX = nearR ? 1 : (nearL ? -1 : 0);
  fotoEditorResizeY = nearB ? 1 : (nearT ? -1 : 0);
  photoCanvas.setPointerCapture?.(e.pointerId);
  fotoEditorDragStart = { x:p.x, y:p.y, cx:c.x, cy:c.y, cw:c.w, ch:c.h };
  e.preventDefault();
});

photoCanvas.addEventListener("pointermove", e => {
  if (!fotoEditorDragging) return;
  const p = photoCanvasPoint(e);
  const dx = p.x - fotoEditorDragStart.x;
  const dy = p.y - fotoEditorDragStart.y;
  const s = fotoEditorDragStart;
  if (fotoEditorResize) {
    let nx=s.cx, ny=s.cy, nw=s.cw, nh=s.ch;
    if (fotoEditorResizeX > 0) nw=s.cw+dx;
    if (fotoEditorResizeX < 0) { nx=s.cx+dx; nw=s.cw-dx; }
    if (fotoEditorResizeY > 0) nh=s.ch+dy;
    if (fotoEditorResizeY < 0) { ny=s.cy+dy; nh=s.ch-dy; }
    fotoEditorCrop={x:nx,y:ny,w:nw,h:nh};
  } else {
    fotoEditorCrop.x=s.cx+dx;
    fotoEditorCrop.y=s.cy+dy;
  }
  clampCrop();
  syncCropControls();
  drawPhotoEditor();
  e.preventDefault();
});

photoCanvas.addEventListener("pointerup", () => { fotoEditorDragging=false; fotoEditorResize=false; });
photoCanvas.addEventListener("pointercancel", () => { fotoEditorDragging=false; fotoEditorResize=false; });

// ---------- Datumsauswahl ----------
const MONATE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
function initDatum(prefix) {
  const tag=document.getElementById(prefix+"-tag"), monat=document.getElementById(prefix+"-monat"), jahr=document.getElementById(prefix+"-jahr");
  if (!tag || !monat || !jahr) return;
  initDatumElemente(tag, monat, jahr);
}
function initDatumElemente(tag, monat, jahr) {
  // Dynamische Partnerschaftsblöcke werden direkt über ihre Elemente initialisiert.
  // Dadurch ist die Datumsauswahl unabhängig von dynamisch vergebenen DOM-IDs.
  tag.replaceChildren(new Option("Tag", ""));
  for(let i=1;i<=31;i++) tag.appendChild(new Option(String(i), String(i).padStart(2,"0")));
  monat.replaceChildren(new Option("Monat", ""));
  MONATE.forEach((m,i)=>monat.appendChild(new Option(m, String(i+1).padStart(2,"0"))));
  jahr.replaceChildren(new Option("Jahr", ""));
  for(let y=new Date().getFullYear();y>=1600;y--) jahr.appendChild(new Option(String(y), String(y)));
}
function initJahrOnly(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.replaceChildren(new Option("Jahr", ""));
  for (let y = new Date().getFullYear(); y >= 1600; y--) {
    el.appendChild(new Option(String(y), String(y)));
  }
}

function getDatumElemente(tag, monat, jahr) {
  const t = tag?.value || "";
  const m = monat?.value || "";
  const y = jahr?.value || "";
  return t && m && y ? `${y}-${m}-${t}` : null;
}
// v376: Ehe/Partnerschaft mit nur bekanntem Jahr (Spalten beginn_jahr / ende_jahr, Paket 6)
function nurJahr(prefix) {
  const t=document.getElementById(prefix+"-tag")?.value, m=document.getElementById(prefix+"-monat")?.value, y=document.getElementById(prefix+"-jahr")?.value;
  return y && !(t && m) && /^\d{4}$/.test(y) ? Number(y) : null;
}
const familieBeginnWert = (f) => f?.beginn || (f?.beginn_jahr ? String(f.beginn_jahr) : null);
const familieEndeWert = (f) => f?.ende || (f?.ende_jahr ? String(f.ende_jahr) : null);
let familienJahrSpalten = true;
const ohneFamJahr = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k !== "beginn_jahr" && k !== "ende_jahr"));
async function mitFamJahr(bau) {
  let r = await bau(familienJahrSpalten);
  if (r?.error && familienJahrSpalten && /beginn_jahr|ende_jahr/i.test(`${r.error.message || ""} ${r.error.details || ""}`)) {
    familienJahrSpalten = false;
    debugLog("ℹ️ Spalten beginn_jahr/ende_jahr fehlen (Paket 6) – gespeichert ohne Jahresangabe.");
    r = await bau(false);
  }
  return r;
}

function getDatum(prefix) {
  const t=document.getElementById(prefix+"-tag")?.value, m=document.getElementById(prefix+"-monat")?.value, y=document.getElementById(prefix+"-jahr")?.value;
  return t&&m&&y ? `${y}-${m}-${t}` : null;
}
function setDatum(prefix, value) {
  const t=document.getElementById(prefix+"-tag"),m=document.getElementById(prefix+"-monat"),y=document.getElementById(prefix+"-jahr");
  if(!t||!m||!y) return;
  setDatumElemente(t,m,y,value);
}
function setDatumElemente(t,m,y,value) {
  if(!value){t.value="";m.value="";y.value="";return;}
  const teile=String(value).slice(0,10).split("-");
  const yy=teile[0]||"", mm=teile[1]||"", dd=teile[2]||"";
  // Nur Werte auswählen, die in den jeweiligen Selects tatsächlich vorhanden sind.
  // So bleiben vollständige Daten sichtbar und Teilangaben (z. B. nur Jahr) möglich.
  y.value=/^\d{4}$/.test(yy) ? yy : "";
  m.value=/^\d{2}$/.test(mm) ? mm : "";
  t.value=/^\d{2}$/.test(dd) ? dd : "";
}
function setDatumJahrElemente(t,m,y,jahr) {
  t.value="";
  m.value="";
  y.value=/^\d{4}$/.test(String(jahr||"")) ? String(jahr) : "";
}
["geburtsdatum","sterbedatum","d-geburtsdatum","d-sterbedatum","d-partner-beginn","d-partner-ende"].forEach(initDatum);
["geburtsjahr","sterbejahr","d-geburtsjahr","d-sterbejahr"].forEach(initJahrOnly);

// Vollständiges Datum und "nur Jahr bekannt" schließen sich gegenseitig aus.
// Bei einem vollständigen Datum wird das reine Jahresfeld gesperrt; bei einem
// reinen Jahr werden Tag/Monat/Jahr des vollständigen Datums gesperrt.
function synchronisiereNurJahrFeld(datumPrefix, jahrOnlyId) {
  const tag = document.getElementById(`${datumPrefix}-tag`);
  const monat = document.getElementById(`${datumPrefix}-monat`);
  const jahr = document.getElementById(`${datumPrefix}-jahr`);
  const nurJahr = document.getElementById(jahrOnlyId);
  if (!tag || !monat || !jahr || !nurJahr) return;

  const aktualisieren = () => {
    const vollstaendig = !!(tag.value && monat.value && jahr.value);
    const nurJahrGewaeht = !!nurJahr.value;

    if (vollstaendig) {
      nurJahr.value = "";
      nurJahr.disabled = true;
      tag.disabled = false;
      monat.disabled = false;
      jahr.disabled = false;
    } else if (nurJahrGewaeht) {
      tag.value = "";
      monat.value = "";
      jahr.value = "";
      tag.disabled = true;
      monat.disabled = true;
      jahr.disabled = true;
      nurJahr.disabled = false;
    } else {
      nurJahr.disabled = false;
      tag.disabled = false;
      monat.disabled = false;
      jahr.disabled = false;
    }
  };

  if (!nurJahr.dataset.syncInit) {
    [tag, monat, jahr, nurJahr].forEach((el) => el.addEventListener("change", aktualisieren));
    nurJahr.dataset.syncInit = "1";
  }
  aktualisieren();
}

synchronisiereNurJahrFeld("geburtsdatum", "geburtsjahr");
synchronisiereNurJahrFeld("sterbedatum", "sterbejahr");
synchronisiereNurJahrFeld("d-geburtsdatum", "d-geburtsjahr");
synchronisiereNurJahrFeld("d-sterbedatum", "d-sterbejahr");

// ---------- Verwandtschaft direkt bei der Ersterfassung ----------
const erstRelation = document.getElementById("erstverwandtschaft-typ");
const erstPerson = document.getElementById("erstverwandtschaft-person");
const erstFamilie = document.getElementById("erstverwandtschaft-familie");
const erstElternteil = document.getElementById("erstverwandtschaft-elternteil");
const erstRelationHinweis = document.getElementById("erstverwandtschaft-hinweis");
let erstRelationDaten = { personen: [], familien: [] };
const erstPartnerVorhanden = document.getElementById("erst-partner-vorhanden");
const erstPartnerschaftArt = document.getElementById("erst-partnerschaft-art");
let erstPartnerPersonenGeladen = false;
let erstPartnerFamilienCache = null;
// v340: Eine Datenquelle für alle Personenlisten: der Bestands-Cache (mit Änderungsprüfung).
let personenFrischAm = 0;
async function ensurePersonenFrisch(maxAlterMs = 30000) {
  const veraltet = !personenCacheGeladen || !Array.isArray(personenCache) || personenCache.length < 2 || (Date.now() - personenFrischAm) > maxAlterMs;
  if (veraltet) {
    try { await loadPersonen(); } catch (err) { debugLog(`⚠️ Personenliste aktualisieren: ${err.message || err}`); }
    if (!Array.isArray(personenCache) || personenCache.length < 2) {
      try { await loadPersonen(true); } catch (err) { debugLog(`⚠️ Personenliste vollständig laden: ${err.message || err}`); }
    }
    personenFrischAm = Date.now();
  }
  return Array.isArray(personenCache) ? personenCache : [];
}

async function ladeErstPartnerPersonen() {
  if (!erstPartnerVorhanden || erstPartnerPersonenGeladen) return;
  const data = await ensurePersonenFrisch();

  // Nur die kleinen Beziehungsfelder laden; keine Fotos oder Medien.
  if (!Array.isArray(erstPartnerFamilienCache)) {
    const { data: familien, error: familienError } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, ende, ende_automatik_ignorieren");
    if (familienError) throw familienError;
    erstPartnerFamilienCache = familien || [];
  }
  const personenLookup = new Map([...(personenCache || []), ...(data || [])].map(p => [p.id, p]));
  const belegt = new Set();
  for (const familie of erstPartnerFamilienCache) {
    const typ = String(familie.familientyp || "").trim().toLocaleLowerCase("de");
    if (typ !== "ehe" && typ !== "partnerschaft") continue;
    if (partnerschaftIstBeendet(familie, personenLookup)) continue;
    if (familie.partner_a_id) belegt.add(familie.partner_a_id);
    if (familie.partner_b_id) belegt.add(familie.partner_b_id);
  }

  const aktuell = document.getElementById("erstverwandtschaft-person")?.value || "";
  erstPartnerVorhanden.innerHTML = '<option value="">— keinen Partner auswählen —</option>';
  const kandidaten = (data || []).filter(person => person.id !== aktuell && !belegt.has(person.id))
    .sort(personenAuswahlSortierung);
  for (const person of kandidaten) {
    erstPartnerVorhanden.appendChild(personOption(person));
  }
  const hinweis = document.getElementById("erst-partner-hinweis");
  if (hinweis) hinweis.textContent = kandidaten.length
    ? `${kandidaten.length} verfügbare Personen – bereits verheiratete Personen werden ausgeblendet.`
    : "Keine verfügbaren Personen gefunden. Personen mit laufender Ehe/Partnerschaft werden ausgeblendet.";
  erstPartnerPersonenGeladen = true;
}
if (erstPartnerVorhanden) {
  erstPartnerVorhanden.addEventListener("focus", async () => {
    try { await ladeErstPartnerPersonen(); }
    catch (err) { const msg = document.getElementById("erst-partner-hinweis"); if (msg) msg.textContent = `Personen konnten nicht geladen werden: ${err.message || err}`; }
  });
}
async function ladeErstverwandtschaftPersonen() {
  if (!erstPerson) return;
  erstPerson.innerHTML = '<option value="">— Person auswählen —</option>';
  const personen = await ensurePersonenFrisch();
  erstRelationDaten.personen = personen.slice().sort(PersonSuche.sort);
  for (const person of erstRelationDaten.personen) erstPerson.appendChild(personOption(person));
}
async function aktualisiereErstverwandtschaft() {
  const typ = erstRelation?.value || "keine";
  document.getElementById("erstverwandtschaft-person-wrap").hidden = typ === "keine";
  document.getElementById("erstverwandtschaft-familie-wrap").hidden = typ !== "voll";
  document.getElementById("erstverwandtschaft-elternteil-wrap").hidden = typ !== "halb";
  erstRelationHinweis.textContent = "";
  if (typ === "keine") return;
  try {
    if (!erstRelationDaten.personen.length) await ladeErstverwandtschaftPersonen();
    if (!erstPerson.value) { erstRelationHinweis.textContent = "Bitte eine Bezugsperson auswählen."; return; }
    const { data: links, error: le } = await sb.from("familien_kinder").select("familie_id, kind_id, beziehungstyp").eq("kind_id", erstPerson.value);
    if (le) throw le;
    const ids = [...new Set((links || []).map(x => x.familie_id))];
    let familien = [];
    if (ids.length) {
      const { data, error } = await sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp").in("id", ids);
      if (error) throw error;
      familien = data || [];
    }
    erstRelationDaten.familien = familien.map(f => ({...f, link:(links||[]).find(l=>l.familie_id===f.id)}));
    erstFamilie.innerHTML = '<option value="">— Elternfamilie auswählen —</option>';
    for (const f of erstRelationDaten.familien) {
      const eltern = [f.partner_a_id,f.partner_b_id].filter(Boolean).map(id => personenAuswahlText(erstRelationDaten.personen.find(p=>p.id===id))).join(" + ");
      erstFamilie.appendChild(new Option(eltern || "Unbekannte Eltern", f.id));
    }
    erstElternteil.innerHTML = '<option value="">— gemeinsamen Elternteil auswählen —</option>';
    const elternIds = [...new Set(erstRelationDaten.familien.flatMap(f=>[f.partner_a_id,f.partner_b_id]).filter(Boolean))];
    for (const id of elternIds) erstElternteil.appendChild(new Option(personenAuswahlText(erstRelationDaten.personen.find(p=>p.id===id)), id));
    if (typ === "voll") {
      if (erstRelationDaten.familien.length === 1) erstFamilie.value = erstRelationDaten.familien[0].id;
      erstRelationHinweis.textContent = erstRelationDaten.familien.length ? "Die neue Person wird derselben Elternfamilie zugeordnet." : "Für diese Person ist noch keine Elternfamilie hinterlegt. Bitte zuerst die Eltern erfassen oder eine andere Beziehung wählen.";
    } else {
      erstRelationHinweis.textContent = "Wähle den Elternteil, den beide Personen gemeinsam haben. Für die neue Person wird eine eigene Ein-Eltern-Familie angelegt.";
    }
  } catch (err) { erstRelationHinweis.textContent = `Verwandtschaft konnte nicht geladen werden: ${err.message || err}`; }
}
if (erstRelation) erstRelation.addEventListener("change", () => { erstRelationDaten = { personen: [], familien: [] }; aktualisiereErstverwandtschaft(); });
if (erstPerson) erstPerson.addEventListener("change", aktualisiereErstverwandtschaft);
if (erstFamilie) erstFamilie.addEventListener("change", () => { erstRelationHinweis.textContent = "Diese Elternfamilie wird für die neue Person übernommen."; });
if (erstElternteil) erstElternteil.addEventListener("change", () => { erstRelationHinweis.textContent = "Der ausgewählte Elternteil wird mit der neuen Person verknüpft."; });

async function speichereErstverwandtschaft(eintrag) {
  const typ = eintrag.erstverwandtschaftTyp;
  if (!typ || typ === "keine") return;
  const bezugId = eintrag.erstverwandtschaftPerson;
  if (!bezugId || bezugId === eintrag.id) throw new Error("Bitte eine gültige Bezugsperson auswählen.");
  if (typ === "voll") {
    const familieId = eintrag.erstverwandtschaftFamilie;
    if (!familieId) throw new Error("Für Vollgeschwister bitte die gemeinsame Elternfamilie auswählen.");
    const { error } = await sb.from("familien_kinder").upsert({ familie_id: familieId, kind_id: eintrag.id, beziehungstyp: "biologisch" }, { onConflict: "familie_id,kind_id" });
    if (error) throw error;
    return;
  }
  if (typ === "halb") {
    const elternId = eintrag.erstverwandtschaftElternteil;
    if (!elternId) throw new Error("Bitte den gemeinsamen Elternteil auswählen.");
    const { data: f, error: fe } = await sb.from("familien").insert({ partner_a_id: elternId, partner_b_id: null, familientyp: "Elternfamilie" }).select("id").single();
    if (fe) throw fe;
    const { error: ke } = await sb.from("familien_kinder").insert({ familie_id: f.id, kind_id: eintrag.id, beziehungstyp: "biologisch" });
    if (ke) throw ke;
  }
}

// v329: Fehlendes Pflichtfeld markieren – der Cursor springt direkt in das Feld.
function fokussiereFehlerFeld(feld) {
  if (!feld) return;
  try { feld.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) { /* ältere Browser */ }
  feld.focus({ preventScroll: true });
}

// ---------- Formular absenden ----------
const form = document.getElementById("person-form");
const formMessage = document.getElementById("form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  // Pflichtfelder: nur Vorname und Geschlecht (Nachname kann unbekannt sein, z. B. nur Ledigenname bekannt).
  if (!document.getElementById("vorname").value.trim()) {
    formMessage.textContent = "Bitte den Vornamen eingeben.";
    fokussiereFehlerFeld(document.getElementById("vorname"));
    return;
  }
  if (!document.getElementById("geschlecht").value) {
    formMessage.textContent = "Bitte das Geschlecht auswählen.";
    fokussiereFehlerFeld(document.getElementById("geschlecht"));
    return;
  }
  debugLog("Formular abgeschickt – Verarbeitung startet.");
  formMessage.textContent = "Speichere …";

  const eintrag = {
    id: crypto.randomUUID(),
    vorname: document.getElementById("vorname").value.trim(),
    nachname: document.getElementById("nachname").value.trim(),
    ledigenname: document.getElementById("ledigenname").value.trim() || null,
    geschlecht: document.getElementById("geschlecht").value || null,
    geburtsdatum: getDatum("geburtsdatum"),
    geburtsjahr: getDatum("geburtsdatum") ? null : (document.getElementById("geburtsjahr").value.trim() ? Number(document.getElementById("geburtsjahr").value.trim()) : null),
    sterbedatum: getDatum("sterbedatum"),
    sterbejahr: getDatum("sterbedatum") ? null : (document.getElementById("sterbejahr").value.trim() ? Number(document.getElementById("sterbejahr").value.trim()) : null),
    taufbuch_link: document.getElementById("taufbuch-link").value.trim() || null,
    trauungsbuch_link: document.getElementById("trauungsbuch-link").value.trim() || null,
    sterbebuch_link: document.getElementById("sterbebuch-link").value.trim() || null,
    taufbuch_zeile: document.getElementById("taufbuch-zeile").value.trim() ? Number(document.getElementById("taufbuch-zeile").value) : null,
    trauungsbuch_zeile: document.getElementById("trauungsbuch-zeile").value.trim() ? Number(document.getElementById("trauungsbuch-zeile").value) : null,
    sterbebuch_zeile: document.getElementById("sterbebuch-zeile").value.trim() ? Number(document.getElementById("sterbebuch-zeile").value) : null,
    taufbuch_seite: kbSeiteWert("taufbuch-seite"),
    trauungsbuch_seite: kbSeiteWert("trauungsbuch-seite"),
    sterbebuch_seite: kbSeiteWert("sterbebuch-seite"),
    notiz: document.getElementById("notiz").value.trim() || null,
    fotos: currentFotoBlobs,
    schluesselfotoIndex: currentSchluesselfotoIndex,
    audio: currentAudioBlob,
    audio_dauer: audioPreview.hidden ? null : Math.round((audioPreview.duration || 0)),
    erstverwandtschaftTyp: document.getElementById("erstverwandtschaft-typ")?.value || "keine",
    erstverwandtschaftPerson: document.getElementById("erstverwandtschaft-person")?.value || null,
    erstverwandtschaftFamilie: document.getElementById("erstverwandtschaft-familie")?.value || null,
    erstverwandtschaftElternteil: document.getElementById("erstverwandtschaft-elternteil")?.value || null,
    erstPartnerId: document.getElementById("erst-partner-vorhanden")?.value || null,
    erstPartnerschaftArt: document.getElementById("erst-partnerschaft-art")?.value || "Ehe",
  };

  if (!eintrag.vorname) {
    formMessage.textContent = "Bitte den Vornamen eintragen.";
    return;
  }

  // v360: Plausibilität der Lebensdaten (Fehler blockieren, Warnungen werden nachgefragt)
  {
    const befunde = plausLebensdaten(eintrag);
    if (!(await plausFragen(befunde))) {
      formMessage.textContent = `Nicht gespeichert: ${befunde.find((b) => b.stufe === "fehler")?.text || "bitte die Angaben prüfen."}`;
      fokussiereFehlerFeld(document.getElementById("geburtsdatum-tag") || document.getElementById("vorname"));
      return;
    }
  }

  if (eintrag.erstverwandtschaftTyp !== "keine") {
    if (!eintrag.erstverwandtschaftPerson) { formMessage.textContent = "Bitte die Bezugsperson auswählen."; return; }
    if (eintrag.erstverwandtschaftTyp === "voll" && !eintrag.erstverwandtschaftFamilie) { formMessage.textContent = "Bitte die gemeinsame Elternfamilie auswählen."; return; }
    if (eintrag.erstverwandtschaftTyp === "halb" && !eintrag.erstverwandtschaftElternteil) { formMessage.textContent = "Bitte den gemeinsamen Elternteil auswählen."; return; }
  }

  if (navigator.onLine) {
    const result = await sendEintrag(eintrag, (msg) => { formMessage.textContent = msg; });
    if (result.ok) {
      formMessage.textContent = "Gespeichert ✓";
      resetForm();
      void personenNachSpeichern(eintrag.id);   // v431
    } else {
      await queueEintrag(eintrag);
      formMessage.textContent = `Fehler: ${result.error} — In Warteschlange gespeichert, wird später erneut versucht.`;
      resetForm();
    }
  } else {
    await queueEintrag(eintrag);
    formMessage.textContent = "Offline – Eintrag wird gesendet, sobald wieder Verbindung besteht.";
    resetForm();
  }
});

function resetForm() {
  form.reset();
  ["geburtsdatum","sterbedatum"].forEach(p=>setDatum(p,null));
  document.getElementById("geburtsjahr").value = "";
  document.getElementById("sterbejahr").value = "";
  document.getElementById("taufbuch-link").value = "";
  document.getElementById("trauungsbuch-link").value = "";
  document.getElementById("sterbebuch-link").value = "";
  document.getElementById("taufbuch-zeile").value = "";
  document.getElementById("trauungsbuch-zeile").value = "";
  document.getElementById("sterbebuch-zeile").value = "";
  document.getElementById("ledigenname").value = "";
  document.getElementById("geschlecht").value = "";
  if (erstRelation) erstRelation.value = "keine";
  if (erstPerson) erstPerson.innerHTML = '<option value="">— Person auswählen —</option>';
  if (erstFamilie) erstFamilie.innerHTML = '<option value="">— Elternfamilie auswählen —</option>';
  if (erstElternteil) erstElternteil.innerHTML = '<option value="">— Mutter oder Vater auswählen —</option>';
  if (erstRelationHinweis) erstRelationHinweis.textContent = "";
  if (erstPartnerVorhanden) { erstPartnerVorhanden.value = ""; erstPartnerVorhanden.innerHTML = '<option value="">— keinen Partner auswählen —</option>'; erstPartnerPersonenGeladen = false; erstPartnerFamilienCache = null; }
  const erstPartnerHinweis = document.getElementById("erst-partner-hinweis");
  if (erstPartnerHinweis) erstPartnerHinweis.textContent = "";
  document.getElementById("erstverwandtschaft-person-wrap").hidden = true;
  document.getElementById("erstverwandtschaft-familie-wrap").hidden = true;
  document.getElementById("erstverwandtschaft-elternteil-wrap").hidden = true;
  erstRelationDaten = { personen: [], familien: [] };

  // Neue Person beginnt nach dem Speichern garantiert ohne alte Medien.
  currentFotoBlobs = [];
  currentSchluesselfotoIndex = 0;
  aktualisiereSchluesselfotoAuswahl();
  if (fotoWeiterBtn) fotoWeiterBtn.hidden = true;
  if (fotoPreview) {
    const oldUrl = fotoPreview.src;
    fotoPreview.hidden = true;
    fotoPreview.setAttribute("hidden", "");
    fotoPreview.style.setProperty("display", "none", "important");
    fotoPreview.removeAttribute("src");
    if (oldUrl && oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
  }
  if (fotoInput) fotoInput.value = "";
  if (fotoInputGalerie) fotoInputGalerie.value = "";

  currentAudioBlob = null;
  audioChunks = [];
  if (audioPreview) {
    audioPreview.hidden = true;
    audioPreview.removeAttribute("src");
  }
  if (audioStatus) audioStatus.textContent = "Keine Aufnahme";
  if (fotoStatus) fotoStatus.textContent = "Kein Foto ausgewählt";
}

function mitTimeout(promise, ms, meldung) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(meldung)), ms)),
  ]);
}

// ---------- Eintrag an Supabase senden ----------
async function sendEintrag(eintrag, onProgress) {
  const step = (msg) => { if (onProgress) onProgress(msg); debugLog(msg); };
  try {
    step("Schritt 1/4: Anmelden …");
    await mitTimeout(
      ensureSession(),
      15000,
      "Zeitüberschreitung bei der Anmeldung (Netzwerk antwortet nicht)"
    );

    step("Schritt 2/4: Person speichern …");
    const personZeile = {
        id: eintrag.id,
        vorname: eintrag.vorname,
        nachname: eintrag.nachname,
        "Ledigenname": eintrag.ledigenname,
        ...(eintrag.geschlecht ? { geschlecht: eintrag.geschlecht } : {}),
        geburtsdatum: eintrag.geburtsdatum,
        geburtsjahr: eintrag.geburtsjahr,
        sterbedatum: eintrag.sterbedatum,
        sterbejahr: eintrag.sterbejahr,
        taufbuch_link: eintrag.taufbuch_link,
        trauungsbuch_link: eintrag.trauungsbuch_link,
        sterbebuch_link: eintrag.sterbebuch_link,
        taufbuch_zeile: eintrag.taufbuch_zeile,
        trauungsbuch_zeile: eintrag.trauungsbuch_zeile,
        sterbebuch_zeile: eintrag.sterbebuch_zeile,
        taufbuch_seite: eintrag.taufbuch_seite || null,
        trauungsbuch_seite: eintrag.trauungsbuch_seite || null,
        sterbebuch_seite: eintrag.sterbebuch_seite || null,
        Notiz: eintrag.notiz,
      };
    const { error: personError } = await mitKbSeite((mitSeite) => mitTimeout(
      sb.from("personen").upsert(mitSeite ? personZeile : ohneKbSeite(personZeile), { onConflict: "id" }),
      15000,
      "Zeitüberschreitung beim Speichern der Person (Netzwerk antwortet nicht)"
    ));
    if (personError) throw personError;
    personenFrischAm = 0;   // v340: neue Person soll in allen Auswahllisten sofort verfügbar sein

    // Familienbeziehung nur nach erfolgreichem Personen-INSERT speichern.
    if (eintrag.erstverwandtschaftTyp && eintrag.erstverwandtschaftTyp !== "keine") {
      step("Verwandtschaft speichern …");
      await speichereErstverwandtschaft(eintrag);
    }
    if (eintrag.erstPartnerId) {
      if (eintrag.erstPartnerId === eintrag.id) throw new Error("Die Person kann nicht ihr eigener Partner sein.");
      step("Ehe/Partnerschaft speichern …");
      const { error: partnerError } = await sb.from("familien").insert({
        partner_a_id: eintrag.id,
        partner_b_id: eintrag.erstPartnerId,
        familientyp: eintrag.erstPartnerschaftArt || "Ehe",
        beginn: null,
        ende: null,
      });
      if (partnerError) throw partnerError;
    }

    // 2. Fotos hochladen
    if (eintrag.fotos && eintrag.fotos.length) {
      step(`Schritt 3/4: ${eintrag.fotos.length} Foto${eintrag.fotos.length === 1 ? "" : "s"} hochladen …`);
      for (const foto of eintrag.fotos) {
        const ext = foto.type && foto.type.includes("png") ? "png" : foto.type && foto.type.includes("webp") ? "webp" : "jpg";
        const path = `${eintrag.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        if (!foto || typeof foto.arrayBuffer !== "function") {
          throw new Error("Foto-Daten konnten nicht gelesen werden");
        }
        const fotoDaten = await foto.arrayBuffer();
        if (!fotoDaten || fotoDaten.byteLength === 0) {
          throw new Error("Foto enthält keine Bilddaten");
        }
        const { error: uploadError } = await mitTimeout(
          sb.storage.from(BUCKET_FOTOS).upload(path, fotoDaten, {
            contentType: foto.type || "image/jpeg",
            upsert: false,
          }),
          20000,
          "Zeitüberschreitung beim Foto-Upload (Netzwerk antwortet nicht)"
        );
        if (uploadError) throw uploadError;
        const istSchluesselfoto = eintrag.fotos.indexOf(foto) === eintrag.schluesselfotoIndex;
        const { error: insertError } = await sb.from("fotos").insert({ personen_id: eintrag.id, dateipfad: path, ist_schluesselfoto: istSchluesselfoto });
        if (insertError) throw insertError;
      }
    }

    // 3. Sprachnotiz hochladen
    if (eintrag.audio) {
      step("Schritt 4/4: Sprachnotiz hochladen …");
      const ext = eintrag.audio.type && eintrag.audio.type.includes("mp4") ? "m4a"
        : eintrag.audio.type && eintrag.audio.type.includes("ogg") ? "ogg"
        : "webm";
      const path = `${eintrag.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await mitTimeout(
        sb.storage.from(BUCKET_AUDIO).upload(path, eintrag.audio),
        20000,
        "Zeitüberschreitung beim Audio-Upload (Netzwerk antwortet nicht)"
      );
      if (uploadError) throw uploadError;
      await sb.from("sprachnotizen").insert({
        person_id: eintrag.id,
        dateipfad: path,
        dauer_sekunden: eintrag.audio_dauer,
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("Senden fehlgeschlagen:", err);
    const meldung = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    debugLog(`❌ Fehler: ${meldung}`);
    return { ok: false, error: meldung };
  }
}

// ---------- Offline-Warteschlange (IndexedDB) ----------
const DB_NAME = "partezettel-queue";
const STORE_NAME = "eintraege";

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueEintrag(eintrag) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(eintrag);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueue() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Einmalige Bereinigung der acht bekannten, nie erfolgreich gespeicherten Test-/Fehlversuche.
// Ausschließlich lokale IndexedDB-Warteschlange – Supabase wird dabei nicht verändert.
const BEKANNTE_FEHLER_QUEUE_IDS_V174 = [
  "0ff6f5ca-3011-4ee7-91f7-561c36001dfd",
  "270958b4-a398-462b-8524-04fc0e986b6d",
  "cc8439db-fb5f-40f0-87f5-1905165927cb",
  "d0e233c9-8408-4dd1-9c6b-5f049ae88d03",
  "ef71b0f8-72f7-4474-9a70-e5501223a9d8",
  "f21b831c-cc9e-4196-b3bb-f3887036f42e",
  "f4a3ab05-0578-4704-af35-ee7980c3c7aa",
  "fdbb5a03-c089-4a05-94a6-dcd04064c429"
];

async function bereinigeBekannteFehlerQueueV177() {
  const bekannteIds = new Set(BEKANNTE_FEHLER_QUEUE_IDS_V174);
  const normalisiere = value => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

  const db = await openQueueDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;

      const eintrag = cursor.value || {};
      const id = String(eintrag.id ?? "").trim();
      const vorname = normalisiere(eintrag.vorname);
      const nachname = normalisiere(eintrag.nachname);

      // Neben den bekannten IDs wird der letzte Testeintrag zusätzlich
      // über seinen Inhalt erkannt. Damit ist die Bereinigung unabhängig
      // davon, ob Safari die ID intern anders zurückliefert.
      const istBekannterFehler = bekannteIds.has(id);
      const istAnonymousTest = vorname === "anonymous" && nachname === "test";

      if (istBekannterFehler || istAnonymousTest) {
        cursor.delete();
      }
      cursor.continue();
    };

    cursorReq.onerror = () => reject(cursorReq.error);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB-Transaktion abgebrochen"));
  });

  // Sicherheitsprüfung: falls ein passender Datensatz trotz der ersten
  // Cursor-Runde noch vorhanden ist, wird genau dieser Datensatz nochmals
  // über seinen tatsächlich gespeicherten Schlüssel gelöscht.
  const verbliebene = await getQueue();
  const erneutZuLoeschen = verbliebene.filter(eintrag => {
    const id = String(eintrag?.id ?? "").trim();
    const vorname = normalisiere(eintrag?.vorname);
    const nachname = normalisiere(eintrag?.nachname);
    return bekannteIds.has(id) || (vorname === "anonymous" && nachname === "test");
  });

  for (const eintrag of erneutZuLoeschen) {
    await removeFromQueue(eintrag.id);
  }

  const endkontrolle = await getQueue();
  const nochVorhanden = endkontrolle.some(eintrag => {
    const id = String(eintrag?.id ?? "").trim();
    const vorname = normalisiere(eintrag?.vorname);
    const nachname = normalisiere(eintrag?.nachname);
    return bekannteIds.has(id) || (vorname === "anonymous" && nachname === "test");
  });

  if (nochVorhanden) {
    throw new Error("Die lokale Bereinigung konnte den Anonymous-Testeintrag nicht entfernen.");
  }

  localStorage.setItem("partezettel-v177-final-queue-bereinigung", "1");
  debugLog("🧹 v178: alte Fehlversuche einschließlich Anonymous Test lokal entfernt. Supabase unverändert.");
}

async function zeigeQueueDiagnose() {
  const output = document.getElementById("queue-diagnostic-output");
  if (!output) return;

  try {
    const queue = await getQueue();
    if (queue.length === 0) {
      output.innerHTML = "<p>Keine Einträge in der lokalen Warteschlange.</p>";
      return;
    }

    const rows = queue.map((eintrag, index) => {
      const vorname = String(eintrag.vorname ?? "");
      const nachname = String(eintrag.nachname ?? "");
      const id = escapeHtml(String(eintrag.id ?? ""));
      return `<tr><td>${index + 1}</td><td>${escapeHtml(vorname)}</td><td>${escapeHtml(nachname)}</td><td><code>${id}</code></td></tr>`;
    }).join("");

    output.innerHTML = `<p><strong>${queue.length} Einträge</strong> – nur Anzeige, keine Änderung.</p>
      <table><thead><tr><th>#</th><th>Vorname</th><th>Nachname</th><th>ID</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) {
    output.textContent = `Fehler beim Lesen der lokalen Warteschlange: ${err.message || err}`;
  }
}

async function flushQueue() {
  const queue = await getQueue();
  const banner = document.getElementById("pending-banner");
  if (queue.length === 0) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.textContent = `${queue.length} wartende Einträge werden gesendet …`;

  for (const eintrag of queue) {
    const result = await sendEintrag(eintrag);
    if (result.ok) { await removeFromQueue(eintrag.id); void personenNachSpeichern(eintrag.id); }
  }

  const remaining = await getQueue();
  if (remaining.length === 0) {
    banner.hidden = true;
  } else {
    banner.textContent = `${remaining.length} Einträge warten noch auf Verbindung.`;
  }
}

// v436: Offline gespeicherte Ersteingaben werden wieder automatisch gesendet – beim Start und sobald
// die Verbindung zurück ist. Seit v178 war das abgeschaltet, die Einträge blieben im Gerät liegen.
// Eine Sperre verhindert parallele Läufe (der Grund für die damalige Abschaltung).
let queueLaeuft = false;
async function flushQueueSicher() {
  if (queueLaeuft || !navigator.onLine) return;
  queueLaeuft = true;
  try { await flushQueue(); } catch (e) { debugLog(`⚠️ Warteschlange senden: ${e.message || e}`); }
  finally { queueLaeuft = false; }
}
window.addEventListener("online", () => { void flushQueueSicher(); });

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("queue-diagnostic-btn");
  if (btn) btn.addEventListener("click", zeigeQueueDiagnose);
});


let personenSortierung = "name";
let personenSortRichtung = 1;
function sortierJahr(person, feld) {
  if (feld === "geburtsjahr") return person.geburtsdatum ? Number(String(person.geburtsdatum).slice(0,4)) : (person.geburtsjahr ? Number(person.geburtsjahr) : null);
  if (feld === "sterbejahr") return person.sterbedatum ? Number(String(person.sterbedatum).slice(0,4)) : (person.sterbejahr ? Number(person.sterbejahr) : null);
  return null;
}
// v364: Dauer verständlich anzeigen – ab 1 Jahr in Jahren, darunter in Monaten, darunter in Tagen (nie „0 Jahre“).
// exakt = beide Daten taggenau bekannt; sonst „ca. N Jahre“ bzw. „unter 1 Jahr“.
function dauerText(start, ende, exakt = true) {
  if (!(start instanceof Date) || !(ende instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime()) || ende < start) return "";
  const vorTag = (a, b) => a.getMonth() < b.getMonth() || (a.getMonth() === b.getMonth() && a.getDate() < b.getDate());
  let j = ende.getFullYear() - start.getFullYear();
  if (vorTag(ende, start)) j--;
  if (j >= 1) return `${exakt ? "" : "ca. "}${j} ${j === 1 ? "Jahr" : "Jahre"}`;
  if (!exakt) return "unter 1 Jahr";
  let m = (ende.getFullYear() - start.getFullYear()) * 12 + ende.getMonth() - start.getMonth();
  if (ende.getDate() < start.getDate()) m--;
  if (m >= 1) return `${m} ${m === 1 ? "Monat" : "Monate"}`;
  const t = Math.round((Date.UTC(ende.getFullYear(), ende.getMonth(), ende.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
  if (t >= 1) return `${t} ${t === 1 ? "Tag" : "Tage"}`;
  return "unter 1 Tag";
}
function lebensalterInTagen(person) {
  if (!person?.geburtsdatum && !person?.geburtsjahr) return null;
  const geburt = person.geburtsdatum ? new Date(`${person.geburtsdatum}T00:00:00`) : new Date(`${String(person.geburtsjahr).padStart(4, "0")}-07-01T00:00:00`);
  if (Number.isNaN(geburt.getTime())) return null;
  let ende = null;
  if (person.sterbedatum) {
    ende = new Date(`${person.sterbedatum}T00:00:00`);
  } else if (person.sterbejahr) {
    const jahr = Number(person.sterbejahr);
    if (!Number.isInteger(jahr) || jahr < 1000 || jahr > 3000) return null;
    ende = new Date(`${String(jahr).padStart(4, "0")}-12-31T00:00:00`);
  } else {
    return null;
  }
  if (Number.isNaN(ende.getTime()) || ende < geburt) return null;
  return Math.floor((ende - geburt) / 86400000);
}
function lebensalterSortierungInTagen(person) {
  if (!person?.geburtsdatum && !person?.geburtsjahr) return null;
  const geburt = person.geburtsdatum ? new Date(`${person.geburtsdatum}T12:00:00`) : new Date(`${String(person.geburtsjahr).padStart(4, "0")}-07-01T12:00:00`);
  if (Number.isNaN(geburt.getTime())) return null;
  let ende = null;
  if (person.sterbedatum) ende = new Date(`${person.sterbedatum}T12:00:00`);
  else if (person.sterbejahr) {
    const jahr = Number(person.sterbejahr);
    if (!Number.isInteger(jahr) || jahr < 1000 || jahr > 3000) return null;
    ende = new Date(`${String(jahr).padStart(4, "0")}-12-31T12:00:00`);
  } else {
    // Ohne bekanntes Sterbedatum oder Sterbejahr ist das Lebensalter
    // für diese genealogische Sortierung nicht verlässlich und bleibt außen vor.
    return null;
  }
  if (Number.isNaN(ende.getTime()) || ende < geburt) return null;
  return Math.floor((ende - geburt) / 86400000);
}
function lebensalterAnzeige(person) {
  const tage = lebensalterInTagen(person);
  if (tage === null) return "";
  const exakt = !!(person.geburtsdatum && person.sterbedatum);
  if (exakt) return dauerText(new Date(`${person.geburtsdatum}T00:00:00`), new Date(`${person.sterbedatum}T00:00:00`), true);
  const jahre = Math.floor(tage / 365.2425);
  return jahre >= 1 ? `ca. ${jahre} ${jahre === 1 ? "Jahr" : "Jahre"}` : "unter 1 Jahr";
}
function sortierNachnameSchluessel(p) {
  return PersonSuche.sortSchluessel(p);
}
function sortierNameVergleich(a, b) {
  const ka = sortierNachnameSchluessel(a), kb = sortierNachnameSchluessel(b);
  if (!ka && kb) return 1;
  if (ka && !kb) return -1;
  const nc = ka.localeCompare(kb, "de", { sensitivity: "base" });
  return nc || String(a.vorname || "").localeCompare(String(b.vorname || ""), "de", { sensitivity: "base" }) || String(a.id || "").localeCompare(String(b.id || ""));
}
// Zeitstempel robust lesen (Safari/WebKit verträgt "2026-09-28 06:16:42+00" nicht).
function sortierZeitstempel(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(" ", "T").replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d{2})$/, "$1:00");
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}
function personenVergleich(a, b) {
  let av = null, bv = null, cmp = 0;
  if (personenSortierung === "name") {
    // Personen ganz ohne Namen stehen in beiden Richtungen am Ende.
    const ka = sortierNachnameSchluessel(a), kb = sortierNachnameSchluessel(b);
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    return sortierNameVergleich(a, b) * personenSortRichtung;
  }
  if (personenSortierung === "alter") {
    av = lebensalterSortierungInTagen(a); bv = lebensalterSortierungInTagen(b);
  } else if (personenSortierung === "geburtsjahr" || personenSortierung === "sterbejahr") {
    av = sortierJahr(a, personenSortierung); bv = sortierJahr(b, personenSortierung);
  } else if (personenSortierung === "erstellt") {
    const aRaw = a.erstellt_am || a.created_at;
    const bRaw = b.erstellt_am || b.created_at;
    av = sortierZeitstempel(aRaw);
    bv = sortierZeitstempel(bRaw);
  } else if (personenSortierung === "familie") {
    av = String(a._familienSortKey || a.nachname || "").trim();
    bv = String(b._familienSortKey || b.nachname || "").trim();
    if (!av) av = null;
    if (!bv) bv = null;
  }

  // Fehlende Werte bleiben immer am Ende – unabhängig von der Sortierrichtung.
  const aMissing = av === null || av === undefined || av === "" || (typeof av === "number" && !Number.isFinite(av));
  const bMissing = bv === null || bv === undefined || bv === "" || (typeof bv === "number" && !Number.isFinite(bv));
  if (aMissing && !bMissing) return 1;
  if (!aMissing && bMissing) return -1;
  if (!aMissing && !bMissing) {
    if (personenSortierung === "familie") cmp = String(av).localeCompare(String(bv), "de", { sensitivity: "base" });
    else cmp = av < bv ? -1 : av > bv ? 1 : 0;
    if (cmp) return cmp * personenSortRichtung;
  }
  // Bei gleichen/fehlenden Sortierwerten bleibt eine nachvollziehbare Namensreihenfolge.
  return sortierNameVergleich(a, b);
}
function sortierePersonen(personen) { return [...personen].sort(personenVergleich); }
function personenAuswahlText(person) {
  return PersonSuche.label(person);
}

function personenAuswahlSortierung(a, b) {
  return PersonSuche.sort(a, b);
}

function berechneFamilienSortKeys(personen,familien) {
  const ids=new Set(personen.map(p=>p.id)), adj=new Map(personen.map(p=>[p.id,new Set()]));
  for(const f of familien||[]) { const a=f.partner_a_id,b=f.partner_b_id; if(ids.has(a)&&ids.has(b)){adj.get(a).add(b);adj.get(b).add(a);} for(const k of f._kinder||[]){if(!ids.has(k))continue;if(ids.has(a)){adj.get(a).add(k);adj.get(k).add(a);}if(ids.has(b)){adj.get(b).add(k);adj.get(k).add(b);}}}
  const byId=new Map(personen.map(p=>[p.id,p])),seen=new Set();
  for(const p of personen){if(seen.has(p.id))continue;const stack=[p.id],comp=[];seen.add(p.id);while(stack.length){const id=stack.pop();comp.push(id);for(const n of adj.get(id)||[]){if(!seen.has(n)){seen.add(n);stack.push(n);}}}const key=comp.map(id=>byId.get(id)?.nachname||"").filter(Boolean).sort((x,y)=>x.localeCompare(y,"de",{sensitivity:"base"}))[0]||p.nachname||"";for(const id of comp)byId.get(id)._familienSortKey=key; }
}


// Wenn ein Todesdatum nachträglich erfasst wird, wird ein noch offenes
// Ehe-/Partnerschaftsende automatisch mit diesem Datum befüllt.
// Ein bereits vorhandenes Ende (z. B. Scheidung) wird niemals überschrieben.
// Bei ausschließlich bekanntem Sterbejahr bleibt das Datenbankfeld "ende"
// leer; die bestehende Anzeige kennzeichnet die Partnerschaft dennoch als
// durch den Tod beendet.
async function synchronisierePartnerschaftsEndeBeiTod(personId, sterbedatum, sterbejahr) {
  if (!personId || (!sterbedatum && !sterbejahr)) return;

  const { data: familien, error } = await sb
    .from("familien")
    .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende, ende_automatik_ignorieren")
    .or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`);

  if (error) throw error;

  const typErlaubt = (typ) => {
    const t = String(typ || "").trim().toLocaleLowerCase("de");
    return t === "ehe" || t === "partnerschaft";
  };

  for (const familie of familien || []) {
    if (!typErlaubt(familie.familientyp) || familie.ende || familie.ende_automatik_ignorieren) continue;

    if (sterbedatum) {
      const { error: updateError } = await sb
        .from("familien")
        .update({ ende: sterbedatum })
        .eq("id", familie.id)
        .is("ende", null);

      if (updateError) throw updateError;
    }
    // Bei einem reinen Sterbejahr kein künstliches Datum speichern.
    // partnerschaftTodesende() liefert das Jahr weiterhin für die Anzeige.
  }
}
