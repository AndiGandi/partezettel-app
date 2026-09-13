// ==========================================================
// Partezettel Archiv – App-Logik
// ==========================================================

// ---------- Sichtbares Debug-Log (funktioniert ohne Mac/Web-Inspector) ----------
function debugLog(msg) {
  const el = document.getElementById("debug-log");
  const zeit = new Date().toLocaleTimeString("de-DE");
  console.log("[Partezettel]", msg);
  if (el) {
    el.textContent += `[${zeit}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
  }
}

window.addEventListener("error", (e) => {
  debugLog(`❌ JS-FEHLER: ${e.message} (${e.filename}:${e.lineno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  debugLog(`❌ UNBEHANDELTER FEHLER: ${e.reason && e.reason.message ? e.reason.message : e.reason}`);
});

debugLog("App-Skript gestartet.");

document.addEventListener("DOMContentLoaded", () => {
  const clearBtn = document.getElementById("debug-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      document.getElementById("debug-log").textContent = "";
    });
  }
});

let sb = null;
try {
  if (!window.supabase || typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
    throw new Error("Supabase-Konfiguration fehlt.");
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("HIER_DEINEN_ANON_PUBLIC_KEY_EINFÜGEN")) {
    throw new Error("Supabase-Anon-Key fehlt in config.js.");
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  debugLog("Supabase-Client initialisiert.");
} catch (err) {
  debugLog(`⚠️ Supabase nicht initialisiert: ${err.message}`);
}

let currentFotoBlobs = [];
let currentAudioBlob = null;
let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = null;
let isRecording = false;
let personenCache = []; // {id, vorname, nachname, ...}

// ---------- Anonyme Anmeldung sicherstellen ----------
async function ensureSession() {
  if (!sb) throw new Error("Supabase ist nicht verfügbar. Bitte config.js prüfen.");
  const { data: { session }, error: getSessionError } = await sb.auth.getSession();
  if (getSessionError) throw getSessionError;
  if (!session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw error; // vorher wurde das hier nur geloggt und ignoriert
  }
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("is-active");
    if (btn.dataset.tab === "liste") loadPersonen();
  });
});

// ---------- Foto-Aufnahme + Bearbeitung ----------
const fotoInput = document.getElementById("foto-input");
const fotoInputGalerie = document.getElementById("foto-input-galerie");
const fotoStatus = document.getElementById("foto-status");
const fotoPreview = document.getElementById("foto-preview");

let fotoEditorQueue = [];
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
  return new Promise(resolve => out.toBlob(blob => resolve(blob ? new File([blob], "partezettel.jpg", {type:"image/jpeg"}) : null), "image/jpeg", .92));
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
  fotoStatus.textContent = currentFotoBlobs.length === 1 ? "1 Foto ausgewählt ✓" : `${currentFotoBlobs.length} Fotos ausgewählt ✓`;
  if (fotoWeiterBtn) fotoWeiterBtn.hidden = false;
  const url = URL.createObjectURL(currentFotoBlobs[0]);
  fotoPreview.src = url;
  fotoPreview.hidden = false;
}

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
        mediaRecorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
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
  if (!tag) return;
  // Der Tag bleibt IMMER sichtbar und enthält 1–31. Er wird niemals beim Jahrwechsel verändert.
  tag.innerHTML='<option value="">Tag</option>';
  for(let i=1;i<=31;i++) tag.insertAdjacentHTML("beforeend",`<option value="${String(i).padStart(2,"0")}">${i}</option>`);
  monat.innerHTML='<option value="">Monat</option>';
  MONATE.forEach((m,i)=>monat.insertAdjacentHTML("beforeend",`<option value="${String(i+1).padStart(2,"0")}">${m}</option>`));
  jahr.innerHTML='<option value="">Jahr</option>';
  for(let y=new Date().getFullYear();y>=1600;y--) jahr.insertAdjacentHTML("beforeend",`<option value="${y}">${y}</option>`);
}
function getDatum(prefix) {
  const t=document.getElementById(prefix+"-tag")?.value, m=document.getElementById(prefix+"-monat")?.value, y=document.getElementById(prefix+"-jahr")?.value;
  return t&&m&&y ? `${y}-${m}-${t}` : null;
}
function setDatum(prefix, value) {
  const t=document.getElementById(prefix+"-tag"),m=document.getElementById(prefix+"-monat"),y=document.getElementById(prefix+"-jahr");
  if(!t||!m||!y) return;
  if(!value){t.value="";m.value="";y.value="";return;}
  const [yy,mm,dd]=String(value).slice(0,10).split("-");
  // Keine Neuberechnung/Filterung des Tages beim Setzen des Monats oder Jahres.
  y.value=yy||""; m.value=mm||""; t.value=dd||"";
}
["geburtsdatum","sterbedatum","d-geburtsdatum","d-sterbedatum"].forEach(initDatum);

// ---------- Formular absenden ----------
const form = document.getElementById("person-form");
const formMessage = document.getElementById("form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  debugLog("Formular abgeschickt – Verarbeitung startet.");
  formMessage.textContent = "Speichere …";

  const eintrag = {
    id: crypto.randomUUID(),
    vorname: document.getElementById("vorname").value.trim(),
    nachname: document.getElementById("nachname").value.trim(),
    geschlecht: document.getElementById("geschlecht").value || null,
    ledigenname: document.getElementById("ledigenname").value.trim() || null,
    geburtsdatum: getDatum("geburtsdatum"),
    sterbedatum: getDatum("sterbedatum"),
    notiz: document.getElementById("notiz").value.trim() || null,
    fotos: currentFotoBlobs,
    audio: currentAudioBlob,
    audio_dauer: audioPreview.hidden ? null : Math.round((audioPreview.duration || 0)),
  };

  if (!eintrag.vorname || !eintrag.nachname) {
    formMessage.textContent = "Bitte Vor- und Nachname eintragen.";
    return;
  }

  if (navigator.onLine) {
    const result = await sendEintrag(eintrag, (msg) => { formMessage.textContent = msg; });
    if (result.ok) {
      formMessage.textContent = "Gespeichert ✓";
      resetForm();
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
  document.getElementById("ledigenname").value = "";
  currentFotoBlobs = [];
  if (fotoWeiterBtn) fotoWeiterBtn.hidden = true;
  currentAudioBlob = null;
  fotoPreview.hidden = true;
  fotoStatus.textContent = "Kein Foto ausgewählt";
  audioPreview.hidden = true;
  audioStatus.textContent = "Keine Aufnahme";
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
    const { error: personError } = await mitTimeout(
      sb.from("personen").upsert({
        id: eintrag.id,
        vorname: eintrag.vorname,
        nachname: eintrag.nachname,
        geschlecht: eintrag.geschlecht,
        "Ledigenname": eintrag.ledigenname,
        geburtsdatum: eintrag.geburtsdatum,
        sterbedatum: eintrag.sterbedatum,
        Notiz: eintrag.notiz,
      }, { onConflict: "id" }),
      15000,
      "Zeitüberschreitung beim Speichern der Person (Netzwerk antwortet nicht)"
    );
    if (personError) throw personError;

    // 2. Fotos hochladen
    if (eintrag.fotos && eintrag.fotos.length) {
      step(`Schritt 3/4: ${eintrag.fotos.length} Foto${eintrag.fotos.length === 1 ? "" : "s"} hochladen …`);
      for (const foto of eintrag.fotos) {
        const ext = foto.type && foto.type.includes("png") ? "png" : foto.type && foto.type.includes("webp") ? "webp" : "jpg";
        const path = `${eintrag.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await mitTimeout(
          sb.storage.from(BUCKET_FOTOS).upload(path, foto),
          20000,
          "Zeitüberschreitung beim Foto-Upload (Netzwerk antwortet nicht)"
        );
        if (uploadError) throw uploadError;
        const { error: insertError } = await sb.from("fotos").insert({ personen_id: eintrag.id, dateipfad: path });
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
    if (result.ok) await removeFromQueue(eintrag.id);
  }

  const remaining = await getQueue();
  if (remaining.length === 0) {
    banner.hidden = true;
  } else {
    banner.textContent = `${remaining.length} Einträge warten noch auf Verbindung.`;
  }
}

window.addEventListener("online", flushQueue);

// ---------- Personenliste laden ----------
async function loadPersonen() {
  const banner = document.getElementById("pending-banner");
  try {
    await ensureSession();
  } catch (err) {
    const msg = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    if (banner) { banner.hidden = false; banner.textContent = `Fehler beim Laden: ${msg}`; }
    debugLog(`❌ Personen laden: ${msg}`);
    return;
  }
  const list = document.getElementById("personen-list");
  const empty = document.getElementById("list-empty");
  const { data, error } = await sb
    .from("personen")
    .select("id, vorname, nachname, geburtsdatum, sterbedatum, Notiz")
    .order("nachname", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  personenCache = data || [];
  if (banner) banner.hidden = true;
  renderPersonenList(personenCache);

  empty.hidden = personenCache.length > 0;
}

function renderPersonenList(personen) {
  const list = document.getElementById("personen-list");
  list.innerHTML = "";
  personen.forEach((p) => {
    const li = document.createElement("li");
    li.className = "person-card";
    const jahre = [p.geburtsdatum, p.sterbedatum].filter(Boolean).map((d) => d.split("-")[0]).join(" – ");
    li.innerHTML = `
      <div class="person-card__name">${p.vorname} ${p.nachname}</div>
      ${jahre ? `<div class="person-card__years">${jahre}</div>` : ""}
      ${p.Notiz ? `<div class="person-card__note">${p.Notiz}</div>` : ""}
    `;
    li.addEventListener("click", () => openPersonDetail(p.id));
    list.appendChild(li);
  });
}


document.getElementById("search-input").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = personenCache.filter((p) =>
    `${p.vorname} ${p.nachname}`.toLowerCase().includes(q)
  );
  renderPersonenList(filtered);
});

document.getElementById("refresh-btn").addEventListener("click", loadPersonen);

// ---------- Init ----------
(async function init() {
  try {
    await ensureSession();
    await flushQueue();
  } catch (err) {
    const msg = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    debugLog(`⚠️ ${msg}`);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.error("SW-Fehler:", e));
  }
})();

// ==========================================================
// PERSON-DETAIL / BEARBEITEN
// ==========================================================

let currentDetailPersonId = null;
let detailAudioMediaRecorder = null;
let detailAudioChunks = [];
let detailAudioStart = null;
let detailIsRecording = false;

const detailOverlay = document.getElementById("detail-overlay");

async function openPersonDetail(personId) {
  currentDetailPersonId = personId;
  await ensureSession();

  const { data: person, error } = await sb.from("personen").select("*").eq("id", personId).single();
  if (error) { debugLog(`❌ Fehler beim Laden der Person: ${error.message}`); return; }

  document.getElementById("d-vorname").value = person.vorname || "";
  document.getElementById("d-nachname").value = person.nachname || "";
  document.getElementById("d-geschlecht").value = person.geschlecht || "";
  document.getElementById("d-ledigenname").value = person.Ledigenname || "";
  setDatum("d-geburtsdatum", person.geburtsdatum);
  setDatum("d-sterbedatum", person.sterbedatum);
  document.getElementById("d-notiz").value = person.Notiz || "";
  document.getElementById("d-person-message").textContent = "";
  document.getElementById("d-foto-message").textContent = "";
  document.getElementById("d-audio-message").textContent = "";
  document.getElementById("d-beziehung-message").textContent = "";
  document.getElementById("d-delete-message").textContent = "";

  await loadDetailFotos(personId);
  await loadDetailAudio(personId);
  await loadDetailBeziehungen(personId);
  fillDetailBeziehungSelect(personId);

  detailOverlay.hidden = false;
}

document.getElementById("detail-close-btn").addEventListener("click", () => {
  detailOverlay.hidden = true;
  loadPersonen();
});

// ---- Person-Felder speichern ----
document.getElementById("d-save-person-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-person-message");
  msg.textContent = "Speichere …";
  const vorname = document.getElementById("d-vorname").value.trim();
  const nachname = document.getElementById("d-nachname").value.trim();
  if (!vorname || !nachname) {
    msg.textContent = "Vor- und Nachname dürfen nicht leer sein.";
    return;
  }
  const { error } = await sb.from("personen").update({
    vorname,
    nachname,
    geschlecht: document.getElementById("d-geschlecht").value || null,
    "Ledigenname": document.getElementById("d-ledigenname").value.trim() || null,
    geburtsdatum: getDatum("d-geburtsdatum"),
    sterbedatum: getDatum("d-sterbedatum"),
    Notiz: document.getElementById("d-notiz").value.trim() || null,
  }).eq("id", currentDetailPersonId);
  msg.textContent = error ? `Fehler: ${error.message}` : "Gespeichert ✓";
});

// ---- Fotos im Detail ----
async function loadDetailFotos(personId) {
  const container = document.getElementById("d-fotos-list");
  container.innerHTML = "";
  const { data, error } = await sb.from("fotos").select("*").eq("personen_id", personId);
  if (error) { debugLog(`❌ Fotos laden: ${error.message}`); return; }
  for (const foto of data || []) {
    const { data: signed } = await sb.storage.from(BUCKET_FOTOS).createSignedUrl(foto.dateipfad, 3600);
    const div = document.createElement("div");
    div.className = "detail-media-item";
    div.innerHTML = `<img src="${signed ? signed.signedUrl : ""}" alt="Foto"><span class="beziehung-text">Foto</span><button class="del-btn" title="Löschen">🗑️</button>`;
    div.querySelector(".del-btn").addEventListener("click", async () => {
      await sb.storage.from(BUCKET_FOTOS).remove([foto.dateipfad]);
      await sb.from("fotos").delete().eq("id", foto.id);
      loadDetailFotos(personId);
    });
    container.appendChild(div);
  }
}

async function uploadDetailFoto(file) {
  const msg = document.getElementById("d-foto-message");
  msg.textContent = "Foto anpassen …";
  const edited = await openPhotoEditor(file);
  if (!edited) { msg.textContent = "Foto nicht übernommen."; return; }
  msg.textContent = "Lade hoch …";
  const ext = edited.type.includes("png") ? "png" : "jpg";
  const path = `${currentDetailPersonId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error: uploadError } = await sb.storage.from(BUCKET_FOTOS).upload(path, edited);
  if (uploadError) { msg.textContent = `Fehler: ${uploadError.message}`; return; }
  const { error: insertError } = await sb.from("fotos").insert({ personen_id: currentDetailPersonId, dateipfad: path });
  msg.textContent = insertError ? `Fehler: ${insertError.message}` : "Foto hinzugefügt ✓";
  loadDetailFotos(currentDetailPersonId);
}

document.getElementById("d-foto-input").addEventListener("change", async (e) => {
  if (e.target.files.length) {
    for (const file of Array.from(e.target.files)) await uploadDetailFoto(file);
    e.target.value = "";
  }
});
document.getElementById("d-foto-input-galerie").addEventListener("change", async (e) => {
  if (e.target.files.length) {
    for (const file of Array.from(e.target.files)) await uploadDetailFoto(file);
    e.target.value = "";
  }
});

// ---- Sprachnotizen im Detail ----
async function loadDetailAudio(personId) {
  const container = document.getElementById("d-audio-list");
  container.innerHTML = "";
  const { data, error } = await sb.from("sprachnotizen").select("*").eq("person_id", personId);
  if (error) { debugLog(`❌ Sprachnotizen laden: ${error.message}`); return; }
  for (const note of data || []) {
    const { data: signed } = await sb.storage.from(BUCKET_AUDIO).createSignedUrl(note.dateipfad, 3600);
    const div = document.createElement("div");
    div.className = "detail-media-item";
    div.innerHTML = `<audio controls src="${signed ? signed.signedUrl : ""}"></audio><button class="del-btn" title="Löschen">🗑️</button>`;
    div.querySelector(".del-btn").addEventListener("click", async () => {
      await sb.storage.from(BUCKET_AUDIO).remove([note.dateipfad]);
      await sb.from("sprachnotizen").delete().eq("id", note.id);
      loadDetailAudio(personId);
    });
    container.appendChild(div);
  }
}

document.getElementById("d-audio-record-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-audio-message");
  const btn = document.getElementById("d-audio-record-btn");
  if (!detailIsRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosenType = pickAudioMimeType();
      detailAudioMediaRecorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
      detailAudioChunks = [];
      detailAudioMediaRecorder.ondataavailable = (e) => detailAudioChunks.push(e.data);
      detailAudioMediaRecorder.onstop = async () => {
        const mimeType = detailAudioMediaRecorder.mimeType || chosenType || "audio/webm";
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(detailAudioChunks, { type: mimeType });
        const dauer = Math.round((Date.now() - detailAudioStart) / 1000);
        stream.getTracks().forEach((t) => t.stop());
        msg.textContent = "Lade hoch …";
        const path = `${currentDetailPersonId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await sb.storage.from(BUCKET_AUDIO).upload(path, blob);
        if (uploadError) { msg.textContent = `Fehler: ${uploadError.message}`; return; }
        const { error: insertError } = await sb.from("sprachnotizen").insert({
          person_id: currentDetailPersonId, dateipfad: path, dauer_sekunden: dauer,
        });
        msg.textContent = insertError ? `Fehler: ${insertError.message}` : "Sprachnotiz hinzugefügt ✓";
        loadDetailAudio(currentDetailPersonId);
      };
      detailAudioMediaRecorder.start();
      detailAudioStart = Date.now();
      detailIsRecording = true;
      btn.textContent = "⏹️ Aufnahme stoppen";
    } catch (err) {
      msg.textContent = "Mikrofonzugriff fehlgeschlagen";
    }
  } else {
    detailAudioMediaRecorder.stop();
    detailIsRecording = false;
    btn.textContent = "🎙️ Neue Aufnahme hinzufügen";
  }
});

// ---- Beziehungen im Detail ----
function fillDetailBeziehungSelect(excludePersonId) {
  const select = document.getElementById("d-beziehung-person");
  select.innerHTML = '<option value="">— wählen —</option>';
  personenCache.filter((p) => p.id !== excludePersonId).forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.vorname} ${p.nachname}`;
    select.appendChild(opt);
  });
}

async function loadDetailBeziehungen(personId) {
  const container = document.getElementById("d-beziehungen-list");
  container.innerHTML = "";
  const { data, error } = await sb.from("beziehung").select("*")
    .or(`personen_a_id.eq.${personId},personen_b_id.eq.${personId}`);
  if (error) { debugLog(`❌ Beziehungen laden: ${error.message}`); return; }
  for (const b of data || []) {
    const andereId = b.personen_a_id === personId ? b.personen_b_id : b.personen_a_id;
    const andere = personenCache.find((p) => p.id === andereId);
    const name = andere ? `${andere.vorname} ${andere.nachname}` : "(unbekannte Person)";
    const div = document.createElement("div");
    div.className = "detail-media-item";
    div.innerHTML = `<span class="beziehung-text">${b.beziehungstyp} — ${name}</span><button class="del-btn" title="Löschen">🗑️</button>`;
    div.querySelector(".del-btn").addEventListener("click", async () => {
      await sb.from("beziehung").delete().eq("id", b.id);
      loadDetailBeziehungen(personId);
    });
    container.appendChild(div);
  }
}

document.getElementById("d-add-beziehung-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-beziehung-message");
  const andereId = document.getElementById("d-beziehung-person").value;
  const typ = document.getElementById("d-beziehung-typ").value;
  if (!andereId || !typ) { msg.textContent = "Bitte Person und Beziehungstyp angeben."; return; }
  const { error } = await sb.from("beziehung").insert({
    personen_a_id: currentDetailPersonId, personen_b_id: andereId, beziehungstyp: typ,
  });
  msg.textContent = error ? `Fehler: ${error.message}` : "Hinzugefügt ✓";
  document.getElementById("d-beziehung-typ").value = "";
  loadDetailBeziehungen(currentDetailPersonId);
});

// ---- Person vollständig löschen ----
document.getElementById("d-delete-person-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-delete-message");
  if (!confirm("Diese Person inkl. aller Fotos, Sprachnotizen und Beziehungen unwiderruflich löschen?")) return;
  msg.textContent = "Lösche …";

  const { data: fotos } = await sb.from("fotos").select("*").eq("personen_id", currentDetailPersonId);
  for (const f of fotos || []) {
    await sb.storage.from(BUCKET_FOTOS).remove([f.dateipfad]);
    await sb.from("fotos").delete().eq("id", f.id);
  }

  const { data: audios } = await sb.from("sprachnotizen").select("*").eq("person_id", currentDetailPersonId);
  for (const a of audios || []) {
    await sb.storage.from(BUCKET_AUDIO).remove([a.dateipfad]);
    await sb.from("sprachnotizen").delete().eq("id", a.id);
  }

  await sb.from("beziehung").delete().or(`personen_a_id.eq.${currentDetailPersonId},personen_b_id.eq.${currentDetailPersonId}`);
  const { error } = await sb.from("personen").delete().eq("id", currentDetailPersonId);

  if (error) {
    msg.textContent = `Fehler: ${error.message}`;
  } else {
    detailOverlay.hidden = true;
    loadPersonen();
  }
});

// ==========================================================
// EXPORT
// ==========================================================

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchAllExportData() {
  const [{ data: personen }, { data: beziehungen }, { data: fotos }, { data: sprachnotizen }] = await Promise.all([
    sb.from("personen").select("*"),
    sb.from("beziehung").select("*"),
    sb.from("fotos").select("*"),
    sb.from("sprachnotizen").select("*"),
  ]);
  return { personen: personen || [], beziehungen: beziehungen || [], fotos: fotos || [], sprachnotizen: sprachnotizen || [] };
}

document.getElementById("export-json-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle JSON …";
  const data = await fetchAllExportData();
  downloadFile("partezettel-export.json", JSON.stringify(data, null, 2), "application/json");
  msg.textContent = "JSON-Datei heruntergeladen ✓";
});

document.getElementById("export-gedcom-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle GEDCOM …";
  const { personen, beziehungen } = await fetchAllExportData();

  const gedcomDate = (d) => {
    if (!d) return null;
    const [y, m, day] = d.split("-");
    const monate = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${parseInt(day, 10)} ${monate[parseInt(m, 10) - 1]} ${y}`;
  };

  let lines = ["0 HEAD", "1 SOUR PartezettelArchiv", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];

  personen.forEach((p, i) => {
    const gid = `@I${i + 1}@`;
    p._gid = gid;
    lines.push(`0 ${gid} INDI`);
    lines.push(`1 NAME ${p.vorname} /${p.nachname}/`);
    if (p.Ledigenname) lines.push(`2 _MARNM ${p.Ledigenname}`);
    if (p.geburtsdatum) { lines.push("1 BIRT"); lines.push(`2 DATE ${gedcomDate(p.geburtsdatum)}`); }
    if (p.sterbedatum) { lines.push("1 DEAT"); lines.push(`2 DATE ${gedcomDate(p.sterbedatum)}`); }
    if (p.Notiz) lines.push(`1 NOTE ${p.Notiz.replace(/\n/g, " ")}`);
  });

  beziehungen.forEach((b) => {
    const a = personen.find((p) => p.id === b.personen_a_id);
    const bb = personen.find((p) => p.id === b.personen_b_id);
    if (a && bb) {
      lines.push(`1 NOTE Beziehung: ${a.vorname} ${a.nachname} — ${b.beziehungstyp} — ${bb.vorname} ${bb.nachname}`);
    }
  });

  lines.push("0 TRLR");
  downloadFile("partezettel-export.ged", lines.join("\n"), "text/plain");
  msg.textContent = "GEDCOM-Datei heruntergeladen ✓ (vereinfachtes Format: Beziehungen als Notizen, keine automatische Familienstruktur)";
});

document.getElementById("export-pdf-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle PDF …";
  const { personen, beziehungen } = await fetchAllExportData();

  if (!window.jspdf) {
    msg.textContent = "PDF-Bibliothek konnte nicht geladen werden.";
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 15;
  doc.setFontSize(16);
  doc.text("Partezettel Archiv — Übersicht", 14, y);
  y += 10;
  doc.setFontSize(10);

  personen.forEach((p) => {
    if (y > 270) { doc.addPage(); y = 15; }
    doc.setFont(undefined, "bold");
    doc.text(`${p.vorname} ${p.nachname}${p.Ledigenname ? " geb. " + p.Ledigenname : ""}`, 14, y);
    doc.setFont(undefined, "normal");
    y += 5;
    if (p.geburtsdatum || p.sterbedatum) {
      doc.text(`${p.geburtsdatum || "?"} – ${p.sterbedatum || "?"}`, 14, y);
      y += 5;
    }
    if (p.Notiz) {
      const lines = doc.splitTextToSize(p.Notiz, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5;
    }
    const beziehungenZuP = beziehungen.filter((b) => b.personen_a_id === p.id || b.personen_b_id === p.id);
    beziehungenZuP.forEach((b) => {
      const andereId = b.personen_a_id === p.id ? b.personen_b_id : b.personen_a_id;
      const andere = personen.find((pp) => pp.id === andereId);
      if (andere) {
        doc.text(`  ${b.beziehungstyp}: ${andere.vorname} ${andere.nachname}`, 14, y);
        y += 5;
      }
    });
    y += 4;
  });

  doc.save("partezettel-export.pdf");
  msg.textContent = "PDF heruntergeladen ✓";
});
