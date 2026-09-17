// v95 Kinderliste: Kinderdatensätze werden separat nachgeladen.
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
// Nur für die Auswahlfilter. Diese Daten werden ausschließlich gelesen und
// verändern keine bestehenden Familien- oder Kinderverknüpfungen.
let familienAuswahlCache = [];
let partnerIdsAuswahlCache = new Set();

// ---------- Anmeldung ----------
async function ensureSession() {
  if (!sb) throw new Error("Supabase ist nicht verfügbar. Bitte config.js prüfen.");
  const { data: { session }, error: getSessionError } = await sb.auth.getSession();
  if (getSessionError) throw getSessionError;
  if (!session) throw new Error("Nicht angemeldet.");
  return session;
}

async function anmelden(email, password) {
  if (!sb) throw new Error("Supabase ist nicht verfügbar. Bitte config.js prüfen.");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function zeigeAppWennAngemeldet() {
  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app-shell");
  const loginMessage = document.getElementById("login-message");
  if (!loginScreen || !appShell) return;
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    if (session) {
      loginScreen.hidden = true;
      appShell.hidden = false;
      debugLog("Angemeldet.");
    } else {
      loginScreen.hidden = false;
      appShell.hidden = true;
    }
  } catch (err) {
    loginScreen.hidden = false;
    appShell.hidden = true;
    if (loginMessage) loginMessage.textContent = err.message;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const logoutBtn = document.getElementById("logout-btn");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginMessage.textContent = "Anmeldung …";
      try {
        await anmelden(loginEmail.value.trim(), loginPassword.value);
        loginPassword.value = "";
        loginMessage.textContent = "";
        await zeigeAppWennAngemeldet();
        try { await flushQueue(); } catch (err) { debugLog(`⚠️ Warteschlange nach Anmeldung: ${err.message}`); }
        try { await loadPersonen(); } catch (err) { debugLog(`⚠️ Laden nach Anmeldung: ${err.message}`); }
      } catch (err) {
        loginMessage.textContent = `Anmeldung fehlgeschlagen: ${err.message}`;
      }
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
      await zeigeAppWennAngemeldet();
    });
  }
  if (sb) {
    sb.auth.onAuthStateChange((_event, session) => {
      const loginScreen = document.getElementById("login-screen");
      const appShell = document.getElementById("app-shell");
      if (session) {
        loginScreen.hidden = true;
        appShell.hidden = false;
      } else {
        loginScreen.hidden = false;
        appShell.hidden = true;
      }
    });
    await zeigeAppWennAngemeldet();
  }
});

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
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
    if (btn.dataset.tab === "liste") loadPersonen();
    if (btn.dataset.tab === "stammbaum") loadStammbaum();
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

async function blobZuJPEGUnter200KB(blob) {
  if (!blob) return null;
  const MAX_BYTES = 200 * 1024;
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
  fotoStatus.textContent = currentFotoBlobs.length === 1 ? "1 Foto ausgewählt ✓" : `${currentFotoBlobs.length} Fotos ausgewählt ✓`;
  if (fotoWeiterBtn) fotoWeiterBtn.hidden = false;
  const url = URL.createObjectURL(currentFotoBlobs[0]);
  fotoPreview.src = url;
  fotoPreview.hidden = false;
  fotoPreview.style.display = "block";
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
function getDatumElemente(tag, monat, jahr) {
  const t = tag?.value || "";
  const m = monat?.value || "";
  const y = jahr?.value || "";
  return t && m && y ? `${y}-${m}-${t}` : null;
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
function setDatumJahr(prefix, jahr) {
  const t=document.getElementById(prefix+"-tag"),m=document.getElementById(prefix+"-monat"),y=document.getElementById(prefix+"-jahr");
  if(!t||!m||!y) return;
  setDatumJahrElemente(t,m,y,jahr);
}
function setDatumJahrElemente(t,m,y,jahr) {
  t.value="";
  m.value="";
  y.value=/^\d{4}$/.test(String(jahr||"")) ? String(jahr) : "";
}
["geburtsdatum","sterbedatum","d-geburtsdatum","d-sterbedatum","d-partner-beginn","d-partner-ende"].forEach(initDatum);

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
    sterbejahr: getDatum("sterbedatum") ? null : (document.getElementById("sterbejahr").value.trim() ? Number(document.getElementById("sterbejahr").value.trim()) : null),
    taufbuch_link: document.getElementById("taufbuch-link").value.trim() || null,
    trauungsbuch_link: document.getElementById("trauungsbuch-link").value.trim() || null,
    sterbebuch_link: document.getElementById("sterbebuch-link").value.trim() || null,
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
  document.getElementById("sterbejahr").value = "";
  document.getElementById("taufbuch-link").value = "";
  document.getElementById("trauungsbuch-link").value = "";
  document.getElementById("sterbebuch-link").value = "";
  document.getElementById("ledigenname").value = "";

  // Neue Person beginnt nach dem Speichern garantiert ohne alte Medien.
  currentFotoBlobs = [];
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
    const { error: personError } = await mitTimeout(
      sb.from("personen").upsert({
        id: eintrag.id,
        vorname: eintrag.vorname,
        nachname: eintrag.nachname,
        geschlecht: eintrag.geschlecht,
        "Ledigenname": eintrag.ledigenname,
        geburtsdatum: eintrag.geburtsdatum,
        sterbedatum: eintrag.sterbedatum,
        sterbejahr: eintrag.sterbejahr,
        taufbuch_link: eintrag.taufbuch_link,
        trauungsbuch_link: eintrag.trauungsbuch_link,
        sterbebuch_link: eintrag.sterbebuch_link,
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


let personenSortierung = "name";
let personenSortRichtung = 1;
function sortierJahr(person, feld) {
  if (feld === "geburtsjahr") return person.geburtsdatum ? Number(String(person.geburtsdatum).slice(0,4)) : null;
  if (feld === "sterbejahr") return person.sterbedatum ? Number(String(person.sterbedatum).slice(0,4)) : (person.sterbejahr ? Number(person.sterbejahr) : null);
  return null;
}
function lebensalterInTagen(person) {
  if (!person?.geburtsdatum) return null;
  const geburt = new Date(`${person.geburtsdatum}T00:00:00`);
  if (Number.isNaN(geburt.getTime())) return null;

  // Ein Sterbejahr ohne genaues Sterbedatum wird ebenfalls berücksichtigt.
  // Fehlen Sterbedatum UND Sterbejahr, darf kein aktuelles Datum als Todestag
  // angenommen werden – sonst entstehen bei historischen Personen falsche
  // Altersangaben von weit über 100 Jahren.
  let ende = null;
  if (person.sterbedatum) {
    ende = new Date(`${person.sterbedatum}T00:00:00`);
  } else if (person.sterbejahr) {
    const jahr = Number(person.sterbejahr);
    if (!Number.isInteger(jahr) || jahr < 1000 || jahr > 3000) return null;
    ende = new Date(`${jahr}-12-31T00:00:00`);
  } else {
    return null;
  }
  if (Number.isNaN(ende.getTime()) || ende < geburt) return null;
  return Math.floor((ende - geburt) / 86400000);
}
function lebensalterAnzeige(person) {
  const tage = lebensalterInTagen(person);
  if (tage === null) return "";
  const jahre = Math.floor(tage / 365.2425);
  // Nur das Sterbejahr bekannt -> Alter ist nur ungefähr bestimmbar.
  const nurSterbejahr = !person.sterbedatum && !!person.sterbejahr;
  return `${nurSterbejahr ? "ca. " : ""}${jahre} Jahre`;
}
function personenVergleich(a,b) {
  if (personenSortierung === "alter") {
    const aa=lebensalterInTagen(a), ab=lebensalterInTagen(b);
    if (aa===null && ab!==null) return 1; if (aa!==null && ab===null) return -1;
    if (aa!==null && ab!==null && aa!==ab) return aa-ab;
  } else if (personenSortierung === "geburtsjahr" || personenSortierung === "sterbejahr") {
    const ay=sortierJahr(a,personenSortierung), by=sortierJahr(b,personenSortierung);
    if (ay===null && by!==null) return 1; if (ay!==null && by===null) return -1;
    if (ay!==null && by!==null && ay!==by) return ay-by;
  } else if (personenSortierung === "erstellt") {
    const at=new Date(a.created_at||a.erstellt_am||0).getTime(), bt=new Date(b.created_at||b.erstellt_am||0).getTime();
    if (at!==bt) return bt-at;
  } else if (personenSortierung === "familie") {
    const af=String(a._familienSortKey||a.nachname||"").toLocaleLowerCase("de"), bf=String(b._familienSortKey||b.nachname||"").toLocaleLowerCase("de");
    const fc=af.localeCompare(bf,"de"); if(fc) return fc;
  }
  const nc=String(a.nachname||"").localeCompare(String(b.nachname||""),"de",{sensitivity:"base"});
  return nc || String(a.vorname||"").localeCompare(String(b.vorname||""),"de",{sensitivity:"base"});
}
function sortierePersonen(personen) { return [...personen].sort((a,b)=>personenVergleich(a,b)*personenSortRichtung); }
function personenAuswahlText(person) {
  if (!person) return "(unbekannte Person)";
  const name = `${person.vorname || ""} ${person.nachname || ""}`.trim() || "(unbekannte Person)";
  const ledigenname = (person.Ledigenname || "").trim();
  let text = name;
  if (ledigenname && ledigenname.toLocaleLowerCase("de") !== (person.nachname || "").trim().toLocaleLowerCase("de")) {
    text += ` (geb. ${ledigenname})`;
  }
  const geburtsjahr = person.geburtsdatum ? String(person.geburtsdatum).slice(0, 4) : "";
  const sterbejahr = person.sterbedatum ? String(person.sterbedatum).slice(0, 4) : (person.sterbejahr ? String(person.sterbejahr) : "");
  if (/^\d{4}$/.test(geburtsjahr)) text += ` — geb. ${geburtsjahr}`;
  if (/^\d{4}$/.test(sterbejahr)) text += ` — gest. ${sterbejahr}`;
  return text;
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
    .select("id, partner_a_id, partner_b_id, familientyp, ende")
    .or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`);

  if (error) throw error;

  const typErlaubt = (typ) => {
    const t = String(typ || "").trim().toLocaleLowerCase("de");
    return t === "ehe" || t === "partnerschaft";
  };

  for (const familie of familien || []) {
    if (!typErlaubt(familie.familientyp) || familie.ende) continue;

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

// ---------- Partnerschaftslogik ----------
function datumAnzeige(datum) {
  if (!datum) return "";
  const teile = String(datum).split("-");
  return teile.length === 3 ? teile.reverse().join(".") : String(datum);
}

function personAusLookup(lookup, id) {
  if (!id) return null;
  if (lookup instanceof Map) return lookup.get(id) || null;
  return (lookup || []).find((p) => p.id === id) || null;
}

// Eine Partnerschaft gilt auch ohne gespeichertes Ende als beendet,
// wenn einer der beiden Partner bereits verstorben ist. Dabei wird nichts
// automatisch in der Datenbank überschrieben; die Information wird nur für
// Auswahl und Anzeige verwendet.
function partnerschaftTodesende(familie, lookup = personenCache, bezugsPersonId = null) {
  // Der Tod eines der beiden Partner beendet die Ehe/Partnerschaft.
  // bezugsPersonId wird aus Kompatibilitätsgründen weiter akzeptiert, darf
  // aber den Tod des aktuell geöffneten Partners nicht ausblenden.
  const totePartner = [familie?.partner_a_id, familie?.partner_b_id]
    .filter(Boolean)
    .map((id) => personAusLookup(lookup, id))
    .filter((p) => p && (p.sterbedatum || p.sterbejahr));
  if (!totePartner.length) return null;

  const exakt = totePartner
    .map((p) => p.sterbedatum)
    .filter(Boolean)
    .sort()[0];
  if (exakt) return { datum: exakt, jahr: exakt.slice(0, 4), exakt: true };

  const jahr = totePartner
    .map((p) => Number(p.sterbejahr))
    .filter((y) => Number.isFinite(y) && y > 0)
    .sort((a, b) => a - b)[0];
  return jahr ? { datum: null, jahr: String(jahr), exakt: false } : null;
}

function partnerschaftIstBeendet(familie, lookup = personenCache) {
  return !!familie?.ende || !!partnerschaftTodesende(familie, lookup);
}

function ehejahreAnzeige(familie, lookup = personenCache) {
  if (String(familie?.familientyp || "").trim().toLocaleLowerCase("de") !== "ehe") return "";
  const beginn = familie?.beginn ? String(familie.beginn).slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginn)) return "";

  let ende = familie?.ende ? String(familie.ende).slice(0, 10) : "";
  if (!ende) {
    const tod = partnerschaftTodesende(familie, lookup);
    if (tod?.exakt && tod.datum) ende = String(tod.datum).slice(0, 10);
    else if (tod?.jahr) {
      const startJahr = Number(beginn.slice(0, 4));
      const endeJahr = Number(tod.jahr);
      if (Number.isFinite(startJahr) && Number.isFinite(endeJahr) && endeJahr >= startJahr) {
        return `${endeJahr - startJahr} Jahre`;
      }
      return "";
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ende)) return "";

  const start = new Date(`${beginn}T00:00:00`);
  const end = new Date(`${ende}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";

  let jahre = end.getFullYear() - start.getFullYear();
  const monatsTagEnde = end.getMonth() * 100 + end.getDate();
  const monatsTagStart = start.getMonth() * 100 + start.getDate();
  if (monatsTagEnde < monatsTagStart) jahre--;
  return jahre >= 0 ? `${jahre} Jahre` : "";
}

function partnerschaftEndeAnzeige(familie, lookup = personenCache) {
  if (familie?.ende) return `Ende: ${datumAnzeige(familie.ende)}`;
  const tod = partnerschaftTodesende(familie, lookup);
  if (!tod) return "Ende: offen";
  return tod.exakt ? `Ende: ${datumAnzeige(tod.datum)} · Tod` : `Ende: Tod ${tod.jahr}`;
}

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
    .select("id, vorname, nachname, geschlecht, Ledigenname, geburtsdatum, sterbedatum, sterbejahr, Notiz, created_at, erstellt_am")
    .order("nachname", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  personenCache = data || [];
  try {
    const [{ data: familien }, { data: familienKinder }, { data: beziehungen }] = await Promise.all([
      sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende"),
      sb.from("familien_kinder").select("familie_id, kind_id"),
      sb.from("beziehung").select("personen_a_id, personen_b_id, beziehungstyp")
    ]);
    familienAuswahlCache = familien || [];
    partnerIdsAuswahlCache = new Set();
    for (const f of familienAuswahlCache) {
      const typ = String(f.familientyp || "").toLowerCase();
      // Nur laufende Ehe/Partnerschaft sperrt die Person in der Auswahl.
      // Beendete Beziehungen bleiben für eine spätere Ehe/Partnerschaft auswählbar.
      if ((typ === "ehe" || typ === "partnerschaft") && !partnerschaftIstBeendet(f, personenCache)) {
        if (f.partner_a_id) partnerIdsAuswahlCache.add(f.partner_a_id);
        if (f.partner_b_id) partnerIdsAuswahlCache.add(f.partner_b_id);
      }
    }
    // Ältere Daten können noch ausschließlich in "beziehung" stehen.
    // Diese werden ebenfalls nur dann als belegte Partnerschaft behandelt,
    // wenn sie ausdrücklich Ehe oder Partnerschaft sind.
    for (const b of beziehungen || []) {
      if (b.beziehungstyp === "Ehe" || b.beziehungstyp === "Partnerschaft") {
        if (b.personen_a_id) partnerIdsAuswahlCache.add(b.personen_a_id);
        if (b.personen_b_id) partnerIdsAuswahlCache.add(b.personen_b_id);
      }
    }
    const kinderByFamilie = new Map();
    for (const k of familienKinder || []) { if (!kinderByFamilie.has(k.familie_id)) kinderByFamilie.set(k.familie_id, []); kinderByFamilie.get(k.familie_id).push(k.kind_id); }
    for (const f of familien || []) f._kinder=kinderByFamilie.get(f.id)||[];
    berechneFamilienSortKeys(personenCache,familien||[]);
  } catch (familyErr) { debugLog(`⚠️ Familien-Sortierung: ${familyErr.message}`); }
  if (banner) banner.hidden = true;
  renderPersonenList(personenCache);
  empty.hidden = personenCache.length > 0;
}

const schluesselfotoCache = new Map();

async function ladeSchluesselfotos(personen) {
  schluesselfotoCache.clear();
  if (!personen.length) return;
  const ids = personen.map(p => p.id);
  const { data, error } = await sb.from("fotos").select("id, personen_id, dateipfad, ist_schluesselfoto").in("personen_id", ids).eq("ist_schluesselfoto", true);
  if (error) { debugLog(`❌ Schlüsselfotos laden: ${error.message}`); return; }
  for (const foto of data || []) {
    const { data: signed } = await sb.storage.from(BUCKET_FOTOS).createSignedUrl(foto.dateipfad, 3600);
    if (signed?.signedUrl) schluesselfotoCache.set(foto.personen_id, signed.signedUrl);
  }
}

async function renderPersonenList(personen) {
  personen = sortierePersonen(personen);
  const list = document.getElementById("personen-list");
  list.innerHTML = "";
  await ladeSchluesselfotos(personen);
  personen.forEach((p) => {
    const li = document.createElement("li");
    li.className = "person-card";
    const sterbeJahrAnzeige = p.sterbedatum
      ? p.sterbedatum.split("-")[0]
      : (p.sterbejahr ? String(p.sterbejahr) : "");
    const jahre = [p.geburtsdatum ? p.geburtsdatum.split("-")[0] : "", sterbeJahrAnzeige]
      .filter(Boolean)
      .join(" – ");
    const alterAnzeige = lebensalterAnzeige(p);
    const fotoUrl = schluesselfotoCache.get(p.id);
    li.innerHTML = `
      ${fotoUrl ? `<img class="person-card__photo" src="${fotoUrl}" alt="Schlüsselfoto von ${p.vorname} ${p.nachname}">` : `<div class="person-card__photo-placeholder" aria-hidden="true">👤</div>`}
      <div class="person-card__content">
        <div class="person-card__name">${p.vorname} ${p.nachname}</div>
        ${jahre || alterAnzeige ? `<div class="person-card__years">${jahre}${jahre && alterAnzeige ? " · " : ""}${alterAnzeige}</div>` : ""}
        ${p.Notiz ? `<div class="person-card__note">${p.Notiz}</div>` : ""}
      </div>
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


const personenSortSelect=document.getElementById("personen-sortierung");
const personenSortButton=document.getElementById("personen-sort-richtung");
function aktualisierePersonenSortierung(){const q=(document.getElementById("search-input")?.value||"").toLowerCase();renderPersonenList(personenCache.filter(p=>`${p.vorname} ${p.nachname}`.toLowerCase().includes(q)));}
if(personenSortSelect)personenSortSelect.addEventListener("change",()=>{personenSortierung=personenSortSelect.value;aktualisierePersonenSortierung();});
if(personenSortButton)personenSortButton.addEventListener("click",()=>{personenSortRichtung*=-1;personenSortButton.textContent=personenSortRichtung===1?"↑":"↓";aktualisierePersonenSortierung();});

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
let autoPartnerSave = false;
let detailAudioMediaRecorder = null;
let detailAudioChunks = [];
let detailAudioStart = null;
let detailIsRecording = false;

const detailOverlay = document.getElementById("detail-overlay");
const detailFamilieMessage = document.getElementById("d-familie-message");

function setDetailFamilieMessage(text) {
  if (detailFamilieMessage) detailFamilieMessage.textContent = text || "";
}

function aktualisiereLinkButton(id, wert) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const link = String(wert || "").trim();
  if (link) {
    btn.href = link;
    btn.hidden = false;
    btn.classList.add("btn--link-present");
  } else {
    btn.href = "#";
    btn.hidden = true;
    btn.classList.remove("btn--link-present");
  }
}

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
  document.getElementById("d-sterbejahr").value = person.sterbejahr ? String(person.sterbejahr) : "";
  document.getElementById("d-taufbuch-link").value = person.taufbuch_link || "";
  document.getElementById("d-trauungsbuch-link").value = person.trauungsbuch_link || "";
  document.getElementById("d-sterbebuch-link").value = person.sterbebuch_link || "";
  aktualisiereLinkButton("d-taufbuch-open", person.taufbuch_link);
  aktualisiereLinkButton("d-trauungsbuch-open", person.trauungsbuch_link);
  aktualisiereLinkButton("d-sterbebuch-open", person.sterbebuch_link);
  document.getElementById("d-notiz").value = person.Notiz || "";
  document.getElementById("d-person-message").textContent = "";
  document.getElementById("d-foto-message").textContent = "";
  document.getElementById("d-audio-message").textContent = "";
  setDetailFamilieMessage("");
  document.getElementById("d-delete-message").textContent = "";

  // Personendaten sofort öffnen. Nachgelagerte Medien/Familien dürfen das
  // Öffnen der Detailansicht nicht blockieren.
  detailOverlay.hidden = false;

  try { await loadDetailFotos(personId); } catch (err) { debugLog(`⚠️ Fotos der Person konnten nicht geladen werden: ${err.message || err}`); }
  try { await loadDetailAudio(personId); } catch (err) { debugLog(`⚠️ Sprachnotizen der Person konnten nicht geladen werden: ${err.message || err}`); }
  // Für die Familienansicht immer aktuelle Personennamen verwenden.
  try { await loadPersonen(); } catch (_) {}
  try { await loadDetailFamilie(personId); } catch (err) { debugLog(`⚠️ Familienangaben konnten nicht geladen werden: ${err.message || err}`); }
}

document.getElementById("detail-close-btn").addEventListener("click", () => {
  detailOverlay.hidden = true;
  loadPersonen();
});

// Trauungsbuch-Link bei Ehepartnern synchronisieren.
// Es wird ausschließlich das Trauungsbuch-Feld behandelt. Bereits vorhandene
// Links werden nicht überschrieben; nur ein fehlender Link wird ergänzt.
async function synchronisiereTrauungsbuchEhepartner(personId, link) {
  const eigenerLink = String(link || "").trim();
  if (!personId || !eigenerLink) return;

  const { data: familien, error: familienError } = await sb.from("familien")
    .select("id, partner_a_id, partner_b_id, familientyp")
    .or(`partner_a_id.eq.${personId},partner_b_id.eq.${personId}`)
    .eq("familientyp", "Ehe");
  if (familienError) throw familienError;

  const partnerIds = [...new Set((familien || [])
    .map((f) => familiePartnerIds(f, personId)[0])
    .filter(Boolean))];
  if (!partnerIds.length) return;

  const { data: partnerPersonen, error: partnerError } = await sb.from("personen")
    .select("id, trauungsbuch_link")
    .in("id", partnerIds);
  if (partnerError) throw partnerError;

  for (const partner of partnerPersonen || []) {
    // Bestehende Daten des Partners niemals überschreiben.
    if (String(partner.trauungsbuch_link || "").trim()) continue;
    const { error } = await sb.from("personen")
      .update({ trauungsbuch_link: eigenerLink })
      .eq("id", partner.id);
    if (error) throw error;
  }
}

// Bei einer neu angelegten Ehe kann der Link bereits beim anderen Ehepartner
// vorhanden sein. In diesem Fall wird nur die fehlende Seite ergänzt.
async function synchronisiereTrauungsbuchBeiEhe(personAId, personBId) {
  if (!personAId || !personBId) return;

  const { data: personen, error } = await sb.from("personen")
    .select("id, trauungsbuch_link")
    .in("id", [personAId, personBId]);
  if (error) throw error;

  const a = (personen || []).find((p) => p.id === personAId);
  const b = (personen || []).find((p) => p.id === personBId);
  const linkA = String(a?.trauungsbuch_link || "").trim();
  const linkB = String(b?.trauungsbuch_link || "").trim();
  const gemeinsamerLink = linkA || linkB;
  if (!gemeinsamerLink) return;

  if (!linkA) {
    const { error: e } = await sb.from("personen")
      .update({ trauungsbuch_link: gemeinsamerLink })
      .eq("id", personAId);
    if (e) throw e;
  }
  if (!linkB) {
    const { error: e } = await sb.from("personen")
      .update({ trauungsbuch_link: gemeinsamerLink })
      .eq("id", personBId);
    if (e) throw e;
  }
}

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
    sterbejahr: getDatum("d-sterbedatum") ? null : (document.getElementById("d-sterbejahr").value.trim() ? Number(document.getElementById("d-sterbejahr").value.trim()) : null),
    taufbuch_link: document.getElementById("d-taufbuch-link").value.trim() || null,
    trauungsbuch_link: document.getElementById("d-trauungsbuch-link").value.trim() || null,
    sterbebuch_link: document.getElementById("d-sterbebuch-link").value.trim() || null,
    Notiz: document.getElementById("d-notiz").value.trim() || null,
  }).eq("id", currentDetailPersonId);
  if (error) {
    msg.textContent = `Fehler: ${error.message}`;
    return;
  }

  // Wird ein Todesdatum nachträglich eingetragen, ein bisher offenes
  // Ehe-/Partnerschaftsende automatisch übernehmen. Ein vorhandenes
  // manuelles Ende wird dabei niemals verändert.
  try {
    await synchronisierePartnerschaftsEndeBeiTod(
      currentDetailPersonId,
      getDatum("d-sterbedatum"),
      document.getElementById("d-sterbejahr").value.trim()
        ? Number(document.getElementById("d-sterbejahr").value.trim())
        : null
    );
  } catch (err) {
    debugLog(`⚠️ Partnerschaftsende durch Tod: ${err.message || err}`);
  }

  // Lokalen Cache sofort aktualisieren, damit die Partnerschaftsanzeige
  // unmittelbar nach dem Speichern den neuen Tod berücksichtigt.
  const cachePerson = personenCache.find((p) => p.id === currentDetailPersonId);
  if (cachePerson) {
    cachePerson.sterbedatum = getDatum("d-sterbedatum");
    cachePerson.sterbejahr = cachePerson.sterbedatum ? null : (
      document.getElementById("d-sterbejahr").value.trim()
        ? Number(document.getElementById("d-sterbejahr").value.trim())
        : null
    );
  }

  // Nur das Trauungsbuch darf bei einer Ehe auf den Partner ergänzt werden.
  // Leere Partnerfelder werden gefüllt; bestehende Partner-Links bleiben unangetastet.
  try {
    await synchronisiereTrauungsbuchEhepartner(
      currentDetailPersonId,
      document.getElementById("d-trauungsbuch-link").value.trim()
    );
  } catch (err) {
    debugLog(`⚠️ Trauungsbuch-Synchronisierung: ${err.message || err}`);
  }

  msg.textContent = "Gespeichert ✓";
  aktualisiereLinkButton("d-taufbuch-open", document.getElementById("d-taufbuch-link").value.trim());
  aktualisiereLinkButton("d-trauungsbuch-open", document.getElementById("d-trauungsbuch-link").value.trim());
  aktualisiereLinkButton("d-sterbebuch-open", document.getElementById("d-sterbebuch-link").value.trim());
  await loadDetailFamilie(currentDetailPersonId);
});

document.getElementById("d-taufbuch-link")?.addEventListener("input", (e) => {
  aktualisiereLinkButton("d-taufbuch-open", e.target.value);
});
document.getElementById("d-trauungsbuch-link")?.addEventListener("input", (e) => {
  aktualisiereLinkButton("d-trauungsbuch-open", e.target.value);
});
document.getElementById("d-sterbebuch-link")?.addEventListener("input", (e) => {
  aktualisiereLinkButton("d-sterbebuch-open", e.target.value);
});

// ---- Fotos im Detail ----
async function loadDetailFotos(personId) {
  const container = document.getElementById("d-fotos-list");
  container.innerHTML = "";
  const { data, error } = await sb.from("fotos").select("*").eq("personen_id", personId);
  if (error) { debugLog(`❌ Fotos laden: ${error.message}`); return; }
  const fotos = [...(data || [])].sort((a, b) => Number(!!b.ist_schluesselfoto) - Number(!!a.ist_schluesselfoto));
  for (const foto of fotos) {
    const { data: signed } = await sb.storage.from(BUCKET_FOTOS).createSignedUrl(foto.dateipfad, 3600);
    const div = document.createElement("div");
    div.className = "detail-media-item";
    div.innerHTML = `<img src="${signed ? signed.signedUrl : ""}" alt="Foto"><span class="beziehung-text">${foto.ist_schluesselfoto ? "⭐ Schlüsselfoto" : "Foto"}</span><button class="key-photo-btn" type="button" title="Als Schlüsselfoto festlegen" ${foto.ist_schluesselfoto ? "disabled" : ""}>⭐ Schlüssel</button><button class="del-btn" title="Löschen">🗑️</button>`;
    const fotoImg = div.querySelector("img");
    const openFoto = (event) => {
      if (event) event.stopPropagation();
      const viewer = document.getElementById("detail-photo-viewer");
      const viewerImg = document.getElementById("detail-photo-viewer-img");
      if (!viewer || !viewerImg || !fotoImg.src) return;
      viewerImg.src = fotoImg.src;
      viewer.hidden = false;
    };
    fotoImg.addEventListener("click", openFoto);
    fotoImg.addEventListener("pointerup", openFoto);
    div.addEventListener("click", (event) => {
      if (event.target.closest(".del-btn")) return;
      openFoto(event);
    });
    div.querySelector(".key-photo-btn").addEventListener("click", async () => {
      const msg = document.getElementById("d-foto-message");
      msg.textContent = "Schlüsselfoto wird gesetzt …";
      const { error: resetError } = await sb.from("fotos").update({ ist_schluesselfoto: false }).eq("personen_id", personId);
      if (resetError) { msg.textContent = `Fehler: ${resetError.message}`; return; }
      const { error: keyError } = await sb.from("fotos").update({ ist_schluesselfoto: true }).eq("id", foto.id);
      if (keyError) { msg.textContent = `Fehler: ${keyError.message}`; return; }
      msg.textContent = "Schlüsselfoto gesetzt ✓";
      await loadDetailFotos(personId);
      await loadPersonen();
    });
    div.querySelector(".del-btn").addEventListener("click", async () => {
      await sb.storage.from(BUCKET_FOTOS).remove([foto.dateipfad]);
      await sb.from("fotos").delete().eq("id", foto.id);
      loadDetailFotos(personId);
      loadPersonen();
    });
    container.appendChild(div);
  }
}

async function uploadDetailFoto(file) {
  const msg = document.getElementById("d-foto-message");
  msg.textContent = "Foto anpassen …";
  const edited = await openPhotoEditor(file);
  if (!edited) { msg.textContent = "Foto nicht übernommen."; return; }
  const optimiert = await blobZuJPEGUnter200KB(edited);
  if (!optimiert) { msg.textContent = "Foto konnte nicht optimiert werden."; return; }
  msg.textContent = `Lade hoch … (${Math.round(optimiert.size / 1024)} KB)`;
  const path = `${currentDetailPersonId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const { error: uploadError } = await sb.storage.from(BUCKET_FOTOS).upload(path, optimiert, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploadError) { msg.textContent = `Fehler: ${uploadError.message}`; return; }
  const { error: insertError } = await sb.from("fotos").insert({ personen_id: currentDetailPersonId, dateipfad: path, ist_schluesselfoto: false });
  msg.textContent = insertError ? `Fehler: ${insertError.message}` : "Foto hinzugefügt ✓";
  loadDetailFotos(currentDetailPersonId);
}

const detailPhotoViewer = document.getElementById("detail-photo-viewer");
const detailPhotoViewerImg = document.getElementById("detail-photo-viewer-img");
const detailPhotoViewerClose = document.getElementById("detail-photo-viewer-close");

function closeDetailPhotoViewer() {
  if (!detailPhotoViewer) return;
  detailPhotoViewer.hidden = true;
  if (detailPhotoViewerImg) detailPhotoViewerImg.src = "";
}

detailPhotoViewerClose?.addEventListener("click", closeDetailPhotoViewer);
detailPhotoViewer?.addEventListener("click", (event) => {
  if (event.target === detailPhotoViewer || event.target === detailPhotoViewerImg) closeDetailPhotoViewer();
});

// Auch das gerade ausgewählte Foto bei „Neu erfassen“ kann vergrößert werden.
function openPreviewFoto() {
  if (!fotoPreview?.src || fotoPreview.hidden) return;
  if (detailPhotoViewerImg) detailPhotoViewerImg.src = fotoPreview.src;
  if (detailPhotoViewer) detailPhotoViewer.hidden = false;
}
fotoPreview?.addEventListener("click", openPreviewFoto);
fotoPreview?.addEventListener("pointerup", openPreviewFoto);

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

// ---- Familie im Detail ----
function personNameById(id) {
  const p = personenCache.find((x) => x.id === id);
  return p ? `${p.vorname} ${p.nachname}` : "(unbekannte Person)";
}

function familiePartnerIds(familie, personId) {
  return [familie.partner_a_id, familie.partner_b_id].filter((id) => id && id !== personId);
}

async function loadDetailFamilie(personId) {
  const parentSelectVater = document.getElementById("d-vater");
  const parentSelectMutter = document.getElementById("d-mutter");
  const partnerList = document.getElementById("d-partner-list");
  const childList = document.getElementById("d-kinder-list");
  if (!parentSelectVater || !parentSelectMutter || !partnerList || !childList) return;

  // Die Familienansicht darf nicht davon abhängen, ob die globale Personenliste
  // vorher geladen wurde. Das Stammbaum-Fenster lädt Personen separat.
  // Deshalb wird hier sichergestellt, dass die Auswahl und die Kinderliste
  // einen vollständigen Personenbestand haben.
  if (personenCache.length < 2) {
    const { data: familienPersonen, error: familienPersonenError } = await sb
      .from("personen")
      .select("id, vorname, nachname, Ledigenname, geburtsdatum, sterbedatum, sterbejahr, geschlecht, Notiz")
      .order("nachname", { ascending: true });
    if (familienPersonenError) {
      debugLog(`❌ Personen für Familienauswahl laden: ${familienPersonenError.message}`);
    } else if (Array.isArray(familienPersonen)) {
      personenCache = familienPersonen;
    }
  }

  const [{ data: childLinks, error: childError }, partnerAResult, partnerBResult] = await Promise.all([
    sb.from("familien_kinder").select("id, familie_id, beziehungstyp").eq("kind_id", personId),
    sb.from("familien").select("*").eq("partner_a_id", personId),
    sb.from("familien").select("*").eq("partner_b_id", personId),
  ]);
  if (childError) debugLog(`❌ Eltern laden: ${childError.message}`);
  if (partnerAResult.error) debugLog(`❌ Familien laden (A): ${partnerAResult.error.message}`);
  if (partnerBResult.error) debugLog(`❌ Familien laden (B): ${partnerBResult.error.message}`);
  const partnerFamilies = [
    ...(partnerAResult.data || []),
    ...(partnerBResult.data || []),
  ].filter((f, index, arr) => arr.findIndex((x) => x.id === f.id) === index);

  const parentFamilyIds = (childLinks || []).map((x) => x.familie_id);
  let parentFamilies = [];
  if (parentFamilyIds.length) {
    const { data, error } = await sb.from("familien")
      .select("*")
      .in("id", parentFamilyIds);
    if (error) {
      debugLog(`❌ Elternfamilien laden: ${error.message}`);
    } else {
      // Jede Familienverknüpfung eines Kindes definiert seine Elternfamilie.
      // Der Familientyp kann "Partnerschaft", "Ehe" oder "Eltern" sein.
      parentFamilies = data || [];
    }
  }

  const detailPersonIds = new Set([personId]);
  for (const f of partnerFamilies) {
    for (const id of [f.partner_a_id, f.partner_b_id]) if (id) detailPersonIds.add(id);
  }
  for (const f of parentFamilies) {
    for (const id of [f.partner_a_id, f.partner_b_id]) if (id) detailPersonIds.add(id);
  }
  const detailPersonMap = new Map(personenCache.map((p) => [p.id, p]));
  if (detailPersonIds.size) {
    const { data: detailPersons, error: detailPersonsError } = await sb
      .from("personen")
      .select("id, vorname, nachname, Ledigenname, geburtsdatum, sterbedatum, sterbejahr, geschlecht")
      .in("id", Array.from(detailPersonIds));
    if (detailPersonsError) {
      debugLog(`❌ Personendaten für Familienanzeige: ${detailPersonsError.message}`);
    } else {
      for (const p of detailPersons || []) detailPersonMap.set(p.id, p);
    }
  }
  const detailPerson = (id) => detailPersonMap.get(id) || personenCache.find((p) => p.id === id) || null;

  // Nur eine Elternfamilie ist die aktive Elternbeziehung des Kindes.
  // Bei alten, fehlerhaften Mehrfachverknüpfungen wird die erste vollständige
  // Familie bevorzugt; beim Speichern werden alle alten Links bereinigt.
  const aktuelleElternfamilie = parentFamilies.find((f) =>
    f.partner_a_id && f.partner_b_id
  ) || parentFamilies[0] || null;

  let vaterId = null;
  let mutterId = null;
  if (aktuelleElternfamilie) {
    const a = detailPerson(aktuelleElternfamilie.partner_a_id);
    const b = detailPerson(aktuelleElternfamilie.partner_b_id);

    for (const p of [a, b]) {
      if (!p) continue;
      if (p.geschlecht === "männlich") vaterId = p.id;
      if (p.geschlecht === "weiblich") mutterId = p.id;
    }

    // Legacy-Daten ohne Geschlecht: A=Vater, B=Mutter.
    if (a && b && !vaterId && !mutterId) {
      vaterId = a.id;
      mutterId = b.id;
    } else if (a && b && !vaterId) {
      vaterId = a.id === mutterId ? b.id : a.id;
    } else if (a && b && !mutterId) {
      mutterId = a.id === vaterId ? b.id : a.id;
    }
  }

  [parentSelectVater, parentSelectMutter].forEach((select) => {
    select.innerHTML = '<option value="">— nicht angegeben —</option>';
    personenCache.filter((p) => p.id !== personId).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = personenAuswahlText(p);
      select.appendChild(opt);
    });
  });

  parentSelectVater.value = vaterId || "";
  parentSelectMutter.value = mutterId || "";

  partnerList.innerHTML = "";
  for (const f of partnerFamilies || []) {
    const otherId = familiePartnerIds(f, personId)[0];
    if (!otherId) continue;
    const div = document.createElement("div");
    div.className = "detail-media-item familie-item";
    const typ = f.familientyp || "Partnerschaft";
    const tod = partnerschaftTodesende(f, detailPersonMap, personId);
    div.innerHTML = `
      <div class="beziehung-text familie-edit-block">
        <strong>${personenAuswahlText(detailPerson(otherId))}</strong>
        <div class="familie-edit-fields">
          <label class="field"><span>Art</span>
            <select class="familie-typ-edit">
              <option value="Partnerschaft">Partnerschaft</option>
              <option value="Ehe">Ehe</option>
            </select>
          </label>
          <label class="field"><span>Beginn</span>
            <div class="date-parts familie-beginn-edit">
              <select class="familie-beginn-tag"><option value="">Tag</option></select>
              <select class="familie-beginn-monat"><option value="">Monat</option></select>
              <select class="familie-beginn-jahr"><option value="">Jahr</option></select>
            </div>
          </label>
          <label class="field"><span>Ende</span>
            <div class="date-parts familie-ende-edit">
              <select class="familie-ende-tag"><option value="">Tag</option></select>
              <select class="familie-ende-monat"><option value="">Monat</option></select>
              <select class="familie-ende-jahr"><option value="">Jahr</option></select>
            </div>
          </label>
          <label class="field familie-jahre-field"><span>Ehejahre</span>
            <div class="familie-jahre">${ehejahreAnzeige({ ...f, familientyp: typ }, detailPersonMap) || "–"}</div>
          </label>
          <div class="familie-actions">
            <button class="del-btn" title="Partnerschaft löschen">🗑️</button>
          </div>
          <div class="familie-auto-ende"></div>
          <button type="button" class="btn btn--secondary familie-save-btn">Partnerschaft speichern</button>
        </div>
      </div>`;

    const typEdit = div.querySelector(".familie-typ-edit");
    const beginnEdit = div.querySelector(".familie-beginn-edit");
    const endeEdit = div.querySelector(".familie-ende-edit");
    const beginnPrefix = `familie-${f.id}-beginn`;
    const endePrefix = `familie-${f.id}-ende`;
    beginnEdit.querySelector(".familie-beginn-tag").id = `${beginnPrefix}-tag`;
    beginnEdit.querySelector(".familie-beginn-monat").id = `${beginnPrefix}-monat`;
    beginnEdit.querySelector(".familie-beginn-jahr").id = `${beginnPrefix}-jahr`;
    endeEdit.querySelector(".familie-ende-tag").id = `${endePrefix}-tag`;
    endeEdit.querySelector(".familie-ende-monat").id = `${endePrefix}-monat`;
    endeEdit.querySelector(".familie-ende-jahr").id = `${endePrefix}-jahr`;
    // Die dynamischen Selects direkt initialisieren. Das ist robuster als eine
    // Suche über dynamisch erzeugte IDs und stellt sicher, dass Tag/Monat/Jahr
    // immer vollständig als Auswahl vorhanden sind.
    const beginnTag = beginnEdit.querySelector(".familie-beginn-tag");
    const beginnMonat = beginnEdit.querySelector(".familie-beginn-monat");
    const beginnJahr = beginnEdit.querySelector(".familie-beginn-jahr");
    const endeTag = endeEdit.querySelector(".familie-ende-tag");
    const endeMonat = endeEdit.querySelector(".familie-ende-monat");
    const endeJahr = endeEdit.querySelector(".familie-ende-jahr");
    initDatumElemente(beginnTag, beginnMonat, beginnJahr);
    initDatumElemente(endeTag, endeMonat, endeJahr);
    const autoEndeEl = div.querySelector(".familie-auto-ende");
    typEdit.value = typ;
    setDatumElemente(beginnTag, beginnMonat, beginnJahr, f.beginn || null);
    if (f.ende) {
      // Ein tatsächlich gespeichertes Ende hat immer Vorrang.
      setDatumElemente(endeTag, endeMonat, endeJahr, f.ende);
    } else if (tod?.exakt) {
      // Exaktes Sterbedatum des zuerst verstorbenen Partners als Anzeige.
      // Es wird erst beim ausdrücklichen Speichern in die Familienbeziehung übernommen.
      setDatumElemente(endeTag, endeMonat, endeJahr, tod.datum);
    } else if (tod?.jahr) {
      // Nur Sterbejahr bekannt: ausschließlich das Jahr anzeigen.
      // Kein künstliches Datum (z. B. 01.01.) in der Datenbank.
      setDatumJahrElemente(endeTag, endeMonat, endeJahr, tod.jahr);
    } else {
      setDatumElemente(endeTag, endeMonat, endeJahr, null);
    }
    // Der Hinweis gehört dauerhaft zur Partnerschaft, wenn ihr Ende durch den
    // Tod des ANDEREN Partners bestimmt wurde. Ein manuelles Ende (z. B.
    // Scheidung) bleibt davon unberührt. Bei nur bekanntem Sterbejahr kann das
    // Jahr angezeigt werden, ohne ein künstliches Datum zu speichern.
    if (tod && (!f.ende || (tod.exakt && f.ende === tod.datum))) {
      autoEndeEl.textContent = tod.exakt
        ? `Ende automatisch durch Tod: ${datumAnzeige(tod.datum)}`
        : `Ende automatisch durch Tod: ${tod.jahr}`;
      autoEndeEl.className = "familie-auto-ende capture-status";
    }

    div.querySelector(".familie-save-btn").addEventListener("click", async () => {
      let eingegebenesEnde = getDatum(endePrefix);
      // Ist kein manuelles Ende eingegeben und ist der Todestag des anderen
      // Partners bekannt, wird dieser beim Speichern als Partnerschaftsende
      // übernommen. Bei nur bekanntem Sterbejahr bleibt das Ende absichtlich
      // NULL; der Hinweis bleibt trotzdem erhalten.
      if (!eingegebenesEnde && tod?.exakt) eingegebenesEnde = tod.datum;
      const updates = {
        familientyp: typEdit.value || "Partnerschaft",
        beginn: getDatum(beginnPrefix),
        ende: eingegebenesEnde,
      };
      const msg = document.getElementById("d-familie-message");
      msg.textContent = "Partnerschaft wird gespeichert …";
      const { error } = await sb.from("familien").update(updates).eq("id", f.id);
      if (error) {
        msg.textContent = `Fehler: ${error.message}`;
      } else {
        msg.textContent = "Partnerschaft gespeichert ✓";
        await loadDetailFamilie(personId);
      }
    });

    div.querySelector(".del-btn").addEventListener("click", async () => {
      if (!confirm("Diese Partnerschaft mit allen zugehörigen Kinder-Verknüpfungen löschen?")) return;
      const { error } = await sb.from("familien").delete().eq("id", f.id);
      if (error) setDetailFamilieMessage(`Fehler: ${error.message}`);
      else await loadDetailFamilie(personId);
    });
    partnerList.appendChild(div);

    // Dauer der Ehe immer direkt nach dem Einfügen berechnen. Die Anzeige
    // hängt damit nicht davon ab, ob die vorherige HTML-Erzeugung den
    // Familientyp bereits korrekt normalisiert hat.
    const jahreEl = div.querySelector(".familie-jahre");
    const aktualisiereEhejahre = () => {
      const start = getDatumElemente(beginnTag, beginnMonat, beginnJahr);
      const end = getDatumElemente(endeTag, endeMonat, endeJahr);
      let text = "";
      if (String(typEdit.value || "").trim().toLocaleLowerCase("de") === "ehe" && start) {
        let endeDatum = end;
        if (!endeDatum && tod?.exakt) endeDatum = tod.datum;
        if (endeDatum) {
          const a = new Date(`${start}T00:00:00`);
          const b = new Date(`${String(endeDatum).slice(0,10)}T00:00:00`);
          if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && b >= a) {
            let j = b.getFullYear() - a.getFullYear();
            if ((b.getMonth() * 100 + b.getDate()) < (a.getMonth() * 100 + a.getDate())) j--;
            if (j >= 0) text = `${j} Jahre`;
          }
        } else if (tod?.jahr) {
          const sj = Number(String(start).slice(0,4));
          const ej = Number(tod.jahr);
          if (Number.isFinite(sj) && Number.isFinite(ej) && ej >= sj) text = `${ej-sj} Jahre`;
        }
      }
      jahreEl.textContent = text;
    };
    [beginnTag, beginnMonat, beginnJahr, endeTag, endeMonat, endeJahr, typEdit].forEach((el) => el.addEventListener("change", aktualisiereEhejahre));
    aktualisiereEhejahre();
  }
  // Kompatibilitäts-Fallback: Falls der neue Familien-Datensatz nicht verfügbar ist,
  // lesen wir Partnerschaften aus der seit v9/v10 bewährten Tabelle beziehung.
  let kompatPartner = [];
  if (!partnerFamilies.length) {
    const { data: beziehungen, error: beziehungsError } = await sb
      .from("beziehung")
      .select("id, personen_a_id, personen_b_id, beziehungstyp")
      .or(`personen_a_id.eq.${personId},personen_b_id.eq.${personId}`);
    if (beziehungsError) {
      debugLog(`❌ Partnerschaften-Fallback: ${beziehungsError.message}`);
    } else {
      kompatPartner = (beziehungen || []).filter((b) =>
        b.beziehungstyp === "Ehe" || b.beziehungstyp === "Partnerschaft"
      );
    }
  }

  if (!partnerList.children.length) {
    for (const b of kompatPartner) {
      const otherId = b.personen_a_id === personId ? b.personen_b_id : b.personen_a_id;
      if (!otherId) continue;
      const div = document.createElement("div");
      div.className = "detail-media-item familie-item";
      div.innerHTML = `<span class="beziehung-text">${personenAuswahlText(detailPerson(otherId))} — ${b.beziehungstyp}</span><button class="del-btn" title="Partnerschaft löschen">🗑️</button>`;
      div.querySelector(".del-btn").addEventListener("click", async () => {
        if (!confirm("Diese Partnerschaft löschen?")) return;
        const { error } = await sb.from("beziehung").delete().eq("id", b.id);
        if (error) setDetailFamilieMessage(`Fehler: ${error.message}`);
        else await loadDetailFamilie(personId);
      });
      partnerList.appendChild(div);
    }
  }
  if (!partnerList.children.length) partnerList.innerHTML = '<span class="capture-status">Keine Partnerschaft erfasst</span>';

  // Kinder ausschließlich über die Familien dieses konkreten Paares laden.
  // Zuerst werden die Familien des aktuellen Elternteils ermittelt. Die
  // Kinderverknüpfungen werden danach über genau diese Familien gelesen.
  const partnerFamilyIds = (partnerFamilies || []).map((f) => f.id).filter(Boolean);
  let childLinksForPerson = [];
  if (partnerFamilyIds.length) {
    const { data, error } = await sb.from("familien_kinder")
      .select("id, familie_id, kind_id, beziehungstyp")
      .in("familie_id", partnerFamilyIds);
    if (error) {
      debugLog(`❌ Kinder laden: ${error.message}`);
    } else {
      childLinksForPerson = data || [];
    }
  }

  // Kinder immer direkt aus personen holen. Falls diese Abfrage scheitert,
  // wird der bereits geladene vollständige Personen-Cache verwendet.
  const childIds = [...new Set(childLinksForPerson.map((x) => x.kind_id).filter(Boolean))];
  let childPersons = [];
  if (childIds.length) {
    const { data, error } = await sb.from("personen").select("*").in("id", childIds);
    if (error) {
      debugLog(`❌ Kinderdaten direkt laden: ${error.message}`);
      childPersons = (personenCache || []).filter((p) => childIds.includes(p.id));
    } else {
      childPersons = data || [];
    }
  }
  const childPersonMap = new Map((childPersons || []).map((p) => [p.id, p]));

  childList.innerHTML = "";
  childLinksForPerson.sort((a, b) => {
    const childA = childPersonMap.get(a.kind_id);
    const childB = childPersonMap.get(b.kind_id);
    const dateA = String(childA?.geburtsdatum || "");
    const dateB = String(childB?.geburtsdatum || "");
    // Wie früher: Kinder chronologisch nach Geburtsdatum. Unbekannte Daten
    // stehen danach; bei Gleichstand entscheidet der Name.
    if (dateA && dateB) {
      const cmp = dateA.localeCompare(dateB);
      if (cmp !== 0) return cmp;
    } else if (dateA) return -1;
    else if (dateB) return 1;
    return personenAuswahlText(childA || { vorname: "", nachname: "" })
      .localeCompare(personenAuswahlText(childB || { vorname: "", nachname: "" }), "de", { sensitivity: "base" });
  });

  for (const link of childLinksForPerson) {
    const child = childPersonMap.get(link.kind_id);
    if (!child) {
      debugLog(`⚠️ Kind ${link.kind_id} ist verknüpft, aber der Personendatensatz konnte nicht geladen werden.`);
      continue;
    }
    const div = document.createElement("div");
    div.className = "detail-media-item familie-item";
    div.innerHTML = `<span class="beziehung-text" role="button" tabindex="0" title="Personendaten öffnen">${personenAuswahlText(child)}${link.beziehungstyp && link.beziehungstyp !== "biologisch" ? ` — ${link.beziehungstyp}` : ""}</span><button class="del-btn" title="Kind-Verknüpfung löschen">🗑️</button>`;
    const childNameEl = div.querySelector(".beziehung-text");
    const openChild = async (event) => { if (event) event.stopPropagation(); await openPersonDetail(child.id); };
    childNameEl.addEventListener("click", openChild);
    childNameEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openChild(event); }
    });
    div.querySelector(".del-btn").addEventListener("click", async (event) => {
      event.stopPropagation();
      const childName = personenAuswahlText(child);
      if (!confirm(`Möchtest du die Kinder-Verknüpfung von „${childName}“ wirklich löschen?`)) return;
      const { error } = await sb.from("familien_kinder").delete().eq("id", link.id);
      if (error) { setDetailFamilieMessage(`Fehler: ${error.message}`); return; }
      try {
        await loescheElternfamilieWennLeer(link.familie_id);
        await loadDetailFamilie(personId);
      } catch (err) { setDetailFamilieMessage(`Fehler: ${err.message}`); }
    });
    childList.appendChild(div);
  }
  if (!childList.children.length) childList.innerHTML = '<span class="capture-status">Keine Kinder erfasst</span>';

  await fillFamilienPersonSelect("d-partner-person", personId);
  const partnerAddBtn = document.getElementById("d-add-partner-btn");
  if (partnerAddBtn) {
    const hatPartnerschaft = !!partnerList.querySelector(".familie-item");
    partnerAddBtn.hidden = !hatPartnerschaft;
    partnerAddBtn.textContent = hatPartnerschaft ? "Weitere Partnerschaft hinzufügen" : "Partnerschaft hinzufügen";
  }
  await fillFamilienPersonSelect("d-kind-person", personId);
  const familySelect = document.getElementById("d-kind-partner-family");
  familySelect.innerHTML = "";
  const validPartnerFamilies = (partnerFamilies || []).filter((f) => {
    const otherId = familiePartnerIds(f, personId)[0];
    return !!otherId;
  });
  if (!validPartnerFamilies.length) {
    familySelect.appendChild(new Option("— keine Partnerschaft vorhanden —", ""));
    familySelect.disabled = true;
  } else {
    familySelect.disabled = false;
    familySelect.appendChild(new Option(
      validPartnerFamilies.length === 1 ? "— diese Partnerschaft —" : "— Partnerschaft auswählen —",
      ""
    ));
    for (const f of validPartnerFamilies) {
      const otherId = familiePartnerIds(f, personId)[0];
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = `${personenAuswahlText(detailPerson(otherId))} — ${f.familientyp || "Partnerschaft"}`;
      familySelect.appendChild(opt);
    }
    // Bei genau einem Paar ist dieses Paar eindeutig und wird automatisch
    // ausgewählt. Bei mehreren Partnerschaften muss der Benutzer das Paar
    // ausdrücklich auswählen. Andere Personen/Familien erscheinen hier nie.
    if (validPartnerFamilies.length === 1) familySelect.value = validPartnerFamilies[0].id;
  }
}

async function fillFamilienPersonSelect(selectId, excludePersonId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">— auswählen —</option>';

  // Die Auswahl darf nie von einem unvollständigen Cache abhängen.
  // "select *" ist absichtlich gewählt, damit zusätzliche/ältere Spalten
  // in der Tabelle nicht dazu führen, dass die gesamte Personenabfrage fehlschlägt.
  let personenFuerAuswahl = [];
  try {
    const { data, error } = await sb.from("personen")
      .select("*")
      .order("nachname", { ascending: true });
    if (error) throw error;
    personenFuerAuswahl = Array.isArray(data) ? data : [];
    if (personenFuerAuswahl.length) personenCache = personenFuerAuswahl;
  } catch (err) {
    debugLog(`⚠️ Personen für Auswahl direkt laden: ${err.message || err}`);
    personenFuerAuswahl = Array.isArray(personenCache) ? personenCache : [];
  }

  let kandidaten = personenFuerAuswahl.filter((p) => p.id !== excludePersonId);

  // Partnerauswahl: eine Person mit einer laufenden Ehe/Partnerschaft
  // steht nicht nochmals als laufender Partner zur Verfügung.
  if (selectId === "d-partner-person") {
    kandidaten = kandidaten.filter((p) => !partnerIdsAuswahlCache.has(p.id));
  }

  // Kinder: Eine Person, die bereits als Kind einer Familie eingetragen ist,
  // soll nicht ein zweites Mal ein Elternpaar bekommen. Außerdem darf ein
  // Elternteil der aktuell bearbeiteten Person nicht gleichzeitig als deren
  // Kind ausgewählt werden. Das ist nur ein Auswahlfilter und verändert keine
  // bestehenden Daten.
  if (selectId === "d-kind-person") {
    try {
      const [{ data: kinderLinks, error: kinderError }, { data: eigeneFamilien, error: familienError }] = await Promise.all([
        sb.from("familien_kinder").select("kind_id"),
        sb.from("familien").select("partner_a_id, partner_b_id").or(`partner_a_id.eq.${excludePersonId},partner_b_id.eq.${excludePersonId}`)
      ]);
      if (kinderError) throw kinderError;
      if (familienError) throw familienError;

      const hatBereitsEltern = new Set((kinderLinks || []).map((k) => k.kind_id).filter(Boolean));
      const eigeneElternteile = new Set();
      for (const f of eigeneFamilien || []) {
        if (f.partner_a_id && f.partner_a_id !== excludePersonId) eigeneElternteile.add(f.partner_a_id);
        if (f.partner_b_id && f.partner_b_id !== excludePersonId) eigeneElternteile.add(f.partner_b_id);
      }

      kandidaten = kandidaten.filter((p) =>
        !hatBereitsEltern.has(p.id) && !eigeneElternteile.has(p.id)
      );
    } catch (err) {
      debugLog(`⚠️ Kinder-Auswahlfilter: ${err.message || err}`);
      // Bei einem Filterfehler keine Daten verstecken. Die Auswahl bleibt
      // wie bisher funktionsfähig.
    }
  }

  kandidaten.sort((a, b) => {
    const name = personenAuswahlText(a).localeCompare(personenAuswahlText(b), "de", { sensitivity: "base" });
    return name;
  });

  for (const p of kandidaten) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = personenAuswahlText(p);
    select.appendChild(opt);
  }
}

async function findeOderErstelleFamilie(partnerAId, partnerBId, typ = "Partnerschaft", beginn = null, ende = null) {
  if (!partnerAId) throw new Error("Partner A fehlt.");

  // Partnerschaft: bewusst nur EIN einfacher INSERT.
  // Keine gegenseitige Prüfung, keine Vorab-Suche, kein RETURNING/SELECT.
  if (partnerBId) {
    // Exakt derselbe einfache INSERT wie der erfolgreiche SQL-Test.
    // Die Datenbank erzeugt die UUID selbst.
    const datensatz = {
      partner_a_id: partnerAId,
      partner_b_id: partnerBId,
      familientyp: typ || "Partnerschaft",
      beginn: beginn || null,
      ende: ende || null,
    };

    debugLog(`Familien-INSERT: ${partnerAId} ↔ ${partnerBId}`);
    const { error } = await sb.from("familien").insert(datensatz);
    if (error) throw error;

    debugLog("Familien-INSERT erfolgreich.");
    return datensatz;
  }

  // Ein Eltern-/Einzel-Eltern-Familieneintrag.
  const neueId = crypto.randomUUID();
  const datensatz = {
    id: neueId,
    partner_a_id: partnerAId,
    partner_b_id: null,
    familientyp: typ || "Partnerschaft",
    beginn: beginn || null,
    ende: ende || null,
  };

  const { error } = await sb.from("familien").insert(datensatz);
  if (error) throw error;
  return datensatz;
}

async function addKindZuFamilie(familieId, kindId, beziehungstyp = "biologisch") {
  const { error } = await sb.from("familien_kinder").upsert({
    familie_id: familieId,
    kind_id: kindId,
    beziehungstyp,
  }, { onConflict: "familie_id,kind_id" });
  if (error) throw error;
}

async function speichereElternZuKind(kindId, vaterId, mutterId) {
  if (vaterId && mutterId && vaterId === mutterId) {
    throw new Error("Vater und Mutter dürfen nicht dieselbe Person sein.");
  }

  // Alle Familienverknüpfungen dieses Kindes laden.
  const { data: links, error: linksError } = await sb
    .from("familien_kinder")
    .select("id, familie_id, kind_id, beziehungstyp")
    .eq("kind_id", kindId);
  if (linksError) throw linksError;

  const familyIds = [...new Set((links || []).map((l) => l.familie_id))];
  let families = [];
  if (familyIds.length) {
    const { data, error } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
      .in("id", familyIds);
    if (error) throw error;
    // Eine vorhandene Familie kann gleichzeitig Partnerschaft/Ehe und Elternfamilie sein.
    families = data || [];
  }

  const oldParentLinks = (links || []).filter((l) =>
    families.some((f) => f.id === l.familie_id)
  );

  // Ziel-Familie: A=Vater (oder einziger Elternteil), B=Mutter.
  const zielA = vaterId || mutterId || null;
  const zielB = vaterId && mutterId ? mutterId : null;

  // Keine Eltern gewählt: alle Elternlinks dieses Kindes entfernen.
  if (!zielA) {
    for (const link of oldParentLinks) {
      const { error } = await sb.from("familien_kinder").delete().eq("id", link.id);
      if (error) throw error;
      await loescheElternfamilieWennLeer(link.familie_id);
    }
    return;
  }

  // Eine vorhandene Familie mit genau diesen Eltern wiederverwenden.
  // Wichtig: Bei zwei Eltern muss auch die umgekehrte Reihenfolge gefunden werden,
  // weil der Unique-Index die beiden Personen unabhängig von der Reihenfolge behandelt.
  let zielFamilie = null;
  if (zielB) {
    const { data, error } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
      .or(`and(partner_a_id.eq.${zielA},partner_b_id.eq.${zielB}),and(partner_a_id.eq.${zielB},partner_b_id.eq.${zielA})`)
      .limit(1);
    if (error) throw error;
    zielFamilie = (data || [])[0] || null;
  } else {
    const { data, error } = await sb.from("familien")
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
      .eq("partner_a_id", zielA)
      .is("partner_b_id", null)
      .limit(1);
    if (error) throw error;
    zielFamilie = (data || [])[0] || null;
  }

  if (!zielFamilie) {
    const { data, error } = await sb.from("familien")
      .insert({
        partner_a_id: zielA,
        partner_b_id: zielB,
        familientyp: "Eltern"
      })
      .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
      .single();
    if (error) throw error;
    zielFamilie = data;
  }

  // Alle bisherigen Elternlinks dieses Kindes entfernen. Das ist wichtig:
  // dadurch können alte falsche Vater/Mutter-Kombinationen nicht bestehen bleiben.
  for (const link of oldParentLinks) {
    if (link.familie_id === zielFamilie.id) continue;
    const { error } = await sb.from("familien_kinder").delete().eq("id", link.id);
    if (error) throw error;
    await loescheElternfamilieWennLeer(link.familie_id);
  }

  const existingTarget = oldParentLinks.find((l) => l.familie_id === zielFamilie.id);
  if (!existingTarget) {
    const { error } = await sb.from("familien_kinder").insert({
      familie_id: zielFamilie.id,
      kind_id: kindId,
      beziehungstyp: "biologisch"
    });
    if (error) throw error;
  }
}

async function loescheElternfamilieWennLeer(familieId) {
  const { data, error } = await sb.from("familien_kinder")
    .select("id")
    .eq("familie_id", familieId)
    .limit(1);
  if (error) throw error;

  if (!data || data.length === 0) {
    const { error: delError } = await sb.from("familien")
      .delete()
      .eq("id", familieId);
    if (delError) throw delError;
  }
}

document.getElementById("d-save-eltern-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-familie-message");
  const vater = document.getElementById("d-vater").value || null;
  const mutter = document.getElementById("d-mutter").value || null;

  msg.textContent = "Speichere Eltern …";
  try {
    await speichereElternZuKind(currentDetailPersonId, vater, mutter);
    msg.textContent = "Eltern gespeichert ✓";
    await loadDetailFamilie(currentDetailPersonId);
  } catch (err) {
    msg.textContent = `Fehler: ${err.message}`;
    debugLog(`❌ Eltern speichern: ${err.message}`);
  }
});

// Partner/in auswählen löst KEIN automatisches Speichern aus.
// Zuerst Partner/in, Art (Partnerschaft/Ehe) und optional die Daten auswählen,
// anschließend ausdrücklich auf „Partner/in hinzufügen“ tippen.
function aktualisiereNeueEhejahre() {
  const el = document.getElementById("d-partner-ehejahre");
  if (!el) return;
  const typ = document.getElementById("d-partner-typ")?.value || "";
  if (typ.toLocaleLowerCase("de") !== "ehe") { el.textContent = "–"; return; }
  const start = getDatum("d-partner-beginn");
  let end = getDatum("d-partner-ende");
  if (!start || !end) { el.textContent = "–"; return; }
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) { el.textContent = "–"; return; }
  let jahre = b.getFullYear() - a.getFullYear();
  if ((b.getMonth() * 100 + b.getDate()) < (a.getMonth() * 100 + a.getDate())) jahre--;
  el.textContent = jahre >= 0 ? `${jahre} Jahre` : "–";
}

document.getElementById("d-partner-person").addEventListener("change", () => {
  const msg = document.getElementById("d-familie-message");
  if (msg) msg.textContent = "";
  aktualisiereNeueEhejahre();
});
["d-partner-typ","d-partner-beginn-tag","d-partner-beginn-monat","d-partner-beginn-jahr","d-partner-ende-tag","d-partner-ende-monat","d-partner-ende-jahr"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", aktualisiereNeueEhejahre);
});
aktualisiereNeueEhejahre();

document.getElementById("d-add-partner-btn").addEventListener("click", async () => {
  const wasAutoPartnerSave = autoPartnerSave;
  const msg = document.getElementById("d-familie-message");
  const partnerId = document.getElementById("d-partner-person").value;
  if (!partnerId) { msg.textContent = "Bitte Partner/in auswählen."; return; }

  msg.textContent = "INSERT Partnerschaft: wird gespeichert …";
  try {
    await ensureSession();
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData?.session?.user?.id || "keine Session-ID";
    debugLog(`Partnerschaftstest: Session ${userId}`);

    const typ = document.getElementById("d-partner-typ").value;
    if (!typ) {
      msg.textContent = "Bitte zuerst Partnerschaft oder Ehe auswählen.";
      return;
    }
    const beginn = getDatum("d-partner-beginn");
    const ende = getDatum("d-partner-ende");

    const beziehungsDatensatz = {
      personen_a_id: currentDetailPersonId,
      personen_b_id: partnerId,
      beziehungstyp: typ,
    };

    debugLog(`BEZIEHUNG-INSERT: ${JSON.stringify(beziehungsDatensatz)}`);

    const { data: beziehungData, error: beziehungsError } = await sb
      .from("beziehung")
      .insert(beziehungsDatensatz)
      .select("id, personen_a_id, personen_b_id, beziehungstyp")
      .single();

    if (beziehungsError) {
      const detail = [
        beziehungsError.message,
        beziehungsError.details,
        beziehungsError.hint,
        beziehungsError.code ? `Code: ${beziehungsError.code}` : ""
      ].filter(Boolean).join(" | ");
      debugLog(`❌ BEZIEHUNG-INSERT FEHLER: ${detail}`);
      msg.textContent = `❌ INSERT FEHLER: ${detail}`;
      return;
    }

    debugLog(`✅ BEZIEHUNG-INSERT ERFOLGREICH: ${JSON.stringify(beziehungData)}`);
    msg.textContent = `✅ INSERT erfolgreich – ID: ${beziehungData.id}`;

    // Zusätzlich Familien-Datensatz versuchen. Ein Fehler hier wird separat angezeigt.
    try {
      const familienDatensatz = {
        partner_a_id: currentDetailPersonId,
        partner_b_id: partnerId,
        familientyp: typ,
        beginn,
        ende,
      };
      debugLog(`FAMILIEN-INSERT: ${JSON.stringify(familienDatensatz)}`);
      const { data: familienData, error: familyErr } = await sb
        .from("familien")
        .insert(familienDatensatz)
        .select("id, partner_a_id, partner_b_id, familientyp, beginn, ende")
        .single();

      if (familyErr) {
        const detail = [familyErr.message, familyErr.details, familyErr.hint, familyErr.code ? `Code: ${familyErr.code}` : ""]
          .filter(Boolean).join(" | ");
        debugLog(`⚠️ FAMILIEN-INSERT FEHLER: ${detail}`);
        msg.textContent = `✅ Beziehung gespeichert. ⚠️ Familien-INSERT Fehler: ${detail}`;
      } else {
        debugLog(`✅ FAMILIEN-INSERT ERFOLGREICH: ${JSON.stringify(familienData)}`);
        // Nur bei einer Ehe: derselbe Trauungsbuch-Link darf beim anderen
        // Ehepartner ergänzt werden. Andere Buch-Links werden nicht angefasst.
        if (typ === "Ehe") {
          try {
            await synchronisiereTrauungsbuchBeiEhe(currentDetailPersonId, partnerId);
          } catch (syncErr) {
            debugLog(`⚠️ Trauungsbuch-Synchronisierung bei Ehe: ${syncErr.message || syncErr}`);
          }
        }
        msg.textContent = `✅ INSERT erfolgreich – Beziehung + Familie gespeichert`;
      }
    } catch (familyErr) {
      const detail = familyErr?.message || String(familyErr);
      debugLog(`⚠️ FAMILIEN-INSERT AUSNAHME: ${detail}`);
      msg.textContent = `✅ Beziehung gespeichert. ⚠️ Familien-INSERT Fehler: ${detail}`;
    }

    if (!wasAutoPartnerSave) {
      document.getElementById("d-partner-person").value = "";
      setDatum("d-partner-beginn", null);
      setDatum("d-partner-ende", null);
    }
    await loadDetailFamilie(currentDetailPersonId);
    if (wasAutoPartnerSave) {
      const partnerSelect = document.getElementById("d-partner-person");
      if (partnerSelect) partnerSelect.value = partnerId;
    }
  } catch (err) {
    const detail = err?.message || String(err);
    debugLog(`❌ Partnerschaftstest AUSNAHME: ${detail}`);
    msg.textContent = `❌ INSERT FEHLER: ${detail}`;
  }
});

document.getElementById("d-add-kind-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-familie-message");
  const kindId = document.getElementById("d-kind-person").value;
  if (!kindId) { msg.textContent = "Bitte Kind auswählen."; return; }
  try {
    let familie = null;
    const partnerFamilies = await sb.from("familien").select("*").or(`partner_a_id.eq.${currentDetailPersonId},partner_b_id.eq.${currentDetailPersonId}`);
    const validPartnerFamilies = (partnerFamilies.data || []).filter((f) =>
      familiePartnerIds(f, currentDetailPersonId)[0]
    );
    const preferredPartnerId = document.getElementById("d-kind-partner-family").value || null;
    if (preferredPartnerId) familie = validPartnerFamilies.find((f) => f.id === preferredPartnerId) || null;
    if (!familie && validPartnerFamilies.length === 1) familie = validPartnerFamilies[0];
    if (!familie && validPartnerFamilies.length > 1) {
      msg.textContent = "Bitte die Partnerschaft auswählen, zu der das Kind gehört.";
      return;
    }
    if (!familie) {
      // Keine Partnerschaft vorhanden: Einzel-Elternfamilie anlegen, wie bisher.
      familie = await findeOderErstelleFamilie(currentDetailPersonId, null, "Eltern");
    }
    await addKindZuFamilie(familie.id, kindId, document.getElementById("d-kind-typ").value || "biologisch");
    msg.textContent = "Kind hinzugefügt ✓";
    document.getElementById("d-kind-person").value = "";
    await loadDetailFamilie(currentDetailPersonId);
  } catch (err) { msg.textContent = `Fehler: ${err.message}`; }
});

// ---- Person vollständig löschen ----
document.getElementById("d-delete-person-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-delete-message");
  if (!confirm("Diese Person inkl. aller Fotos, Sprachnotizen und Beziehungen unwiderruflich löschen?")) return;
  msg.textContent = "Lösche …";

  try {
    await ensureSession();

    // Zuerst abhängige Datensätze löschen. Dadurch blockieren alte
    // Beziehungen die Löschung der Person nicht mehr.
    const { error: beziehungError } = await sb.from("beziehung")
      .delete()
      .or(`personen_a_id.eq.${currentDetailPersonId},personen_b_id.eq.${currentDetailPersonId}`);
    if (beziehungError) throw beziehungError;

    // Familienzuordnungen explizit entfernen; vorhandene CASCADEs bleiben zusätzlich wirksam.
    const { data: familien, error: familienFetchError } = await sb.from("familien")
      .select("id")
      .or(`partner_a_id.eq.${currentDetailPersonId},partner_b_id.eq.${currentDetailPersonId}`);
    if (familienFetchError) throw familienFetchError;

    const familienIds = (familien || []).map(f => f.id);
    if (familienIds.length) {
      const { error: kinderError } = await sb.from("familien_kinder")
        .delete()
        .in("familie_id", familienIds);
      if (kinderError) throw kinderError;

      const { error: familienError } = await sb.from("familien")
        .delete()
        .in("id", familienIds);
      if (familienError) throw familienError;
    }

    const { data: fotos, error: fotoFetchError } = await sb.from("fotos")
      .select("*").eq("personen_id", currentDetailPersonId);
    if (fotoFetchError) throw fotoFetchError;

    for (const f of fotos || []) {
      if (f.dateipfad) await sb.storage.from(BUCKET_FOTOS).remove([f.dateipfad]);
      const { error } = await sb.from("fotos").delete().eq("id", f.id);
      if (error) throw error;
    }

    const { data: audios, error: audioFetchError } = await sb.from("sprachnotizen")
      .select("*").eq("person_id", currentDetailPersonId);
    if (audioFetchError) throw audioFetchError;

    for (const a of audios || []) {
      if (a.dateipfad) await sb.storage.from(BUCKET_AUDIO).remove([a.dateipfad]);
      const { error } = await sb.from("sprachnotizen").delete().eq("id", a.id);
      if (error) throw error;
    }

    const { error: personError } = await sb.from("personen")
      .delete()
      .eq("id", currentDetailPersonId);
    if (personError) throw personError;

    detailOverlay.hidden = true;
    currentDetailPersonId = null;
    msg.textContent = "";
    await loadPersonen();
  } catch (err) {
    const detail = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
    msg.textContent = `Fehler: ${detail}`;
    debugLog(`❌ Person löschen: ${detail}`);
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

async function fetchAllTableRows(table, orderColumn = "id") {
  const rows = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select("*").order(orderColumn).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function optimiereBestehendeFotos() {
  const msg = document.getElementById("foto-optimieren-message");
  if (!msg) return;
  msg.textContent = "Fotos werden geprüft …";
  try {
    await ensureSession();
    const { data: fotos, error } = await sb.from("fotos").select("id, dateipfad");
    if (error) throw error;
    const eintraege = (fotos || []).filter(f => f.dateipfad);
    let gesamtAlt = 0;
    let ueberLimit = 0;
    const kandidaten = [];

    for (let i = 0; i < eintraege.length; i++) {
      const foto = eintraege[i];
      msg.textContent = `Fotos prüfen … ${i + 1}/${eintraege.length}`;
      const { data: blob, error: downloadError } = await sb.storage.from(BUCKET_FOTOS).download(foto.dateipfad);
      if (downloadError || !blob) continue;
      gesamtAlt += blob.size;
      if (blob.size > 200 * 1024) {
        ueberLimit++;
        kandidaten.push(foto);
      }
    }

    const altMB = gesamtAlt / 1024 / 1024;
    if (!kandidaten.length) {
      msg.textContent = `Keine Optimierung nötig. ${eintraege.length} Fotos · ${altMB.toFixed(2)} MB.`;
      return;
    }

    const ok = confirm(`${eintraege.length} Fotos · ${altMB.toFixed(2)} MB\n\n${ueberLimit} Fotos sind größer als 200 KB und werden optimiert.\n\nDie Originale auf deinem Gerät bleiben unverändert. Nur die Dateien in Supabase werden ersetzt.\n\nOptimierung starten?`);
    if (!ok) {
      msg.textContent = "Optimierung abgebrochen.";
      return;
    }

    let verarbeitet = 0;
    let altKandidaten = 0;
    let neuKandidaten = 0;
    let fehler = 0;

    for (let i = 0; i < kandidaten.length; i++) {
      const foto = kandidaten[i];
      msg.textContent = `Foto optimieren … ${i + 1}/${kandidaten.length}`;
      try {
        const { data: original, error: downloadError } = await sb.storage.from(BUCKET_FOTOS).download(foto.dateipfad);
        if (downloadError || !original) throw new Error(downloadError?.message || "Foto konnte nicht geladen werden");
        const optimiert = await blobZuJPEGUnter200KB(original);
        if (!optimiert) throw new Error("Optimierung fehlgeschlagen");
        altKandidaten += original.size;
        neuKandidaten += optimiert.size;

        const { error: updateError } = await sb.storage.from(BUCKET_FOTOS).update(foto.dateipfad, optimiert, {
          contentType: "image/jpeg",
          cacheControl: "3600",
        });
        if (updateError) throw updateError;
        verarbeitet++;
      } catch (err) {
        fehler++;
        debugLog(`❌ Fotooptimierung ${foto.dateipfad}: ${err.message || err}`);
      }
    }

    const altMB2 = altKandidaten / 1024 / 1024;
    const neuMB2 = neuKandidaten / 1024 / 1024;
    msg.textContent = `${verarbeitet} Fotos optimiert ✓ · ${altMB2.toFixed(2)} MB → ${neuMB2.toFixed(2)} MB${fehler ? ` · ${fehler} Fehler` : ""}`;
  } catch (err) {
    msg.textContent = `Fehler: ${err.message || err}`;
    debugLog(`❌ Fotooptimierung: ${err.message || err}`);
  }
}

async function fetchAllExportData() {
  const [personen, familien, familien_kinder, fotos, sprachnotizen] = await Promise.all([
    fetchAllTableRows("personen", "nachname"),
    fetchAllTableRows("familien", "id"),
    fetchAllTableRows("familien_kinder", "id"),
    fetchAllTableRows("fotos", "id"),
    fetchAllTableRows("sprachnotizen", "id"),
  ]);
  return { personen, familien, familien_kinder, fotos, sprachnotizen };
}

function backupDateiname() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `Partezettel_Backup_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}

function u16(value) {
  const a = new Uint8Array(2);
  new DataView(a.buffer).setUint16(0, value, true);
  return a;
}

function u32(value) {
  const a = new Uint8Array(4);
  new DataView(a.buffer).setUint32(0, value >>> 0, true);
  return a;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// CRC-32 für ZIP-Dateien. Wir verwenden bewusst STORE (keine Kompression),
// damit das Backup ohne zusätzliche Bibliothek auf iPad/iPhone erzeugt werden kann.
const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = ZIP_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipEncodeName(name) {
  return new TextEncoder().encode(name);
}

function erstelleZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = zipEncodeName(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const crc = crc32(data);
    const local = concatBytes([
      new Uint8Array([0x50,0x4B,0x03,0x04]),
      u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), nameBytes, data
    ]);
    locals.push(local);

    const central = concatBytes([
      new Uint8Array([0x50,0x4B,0x01,0x02]),
      u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      nameBytes
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralBytes = concatBytes(centrals);
  const localBytes = concatBytes(locals);
  const count = entries.length;
  const eocd = concatBytes([
    new Uint8Array([0x50,0x4B,0x05,0x06]),
    u16(0), u16(0), u16(count), u16(count),
    u32(centralBytes.length), u32(centralOffset), u16(0)
  ]);
  return concatBytes([localBytes, centralBytes, eocd]);
}

function zipReadDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Keine gültige ZIP-Datei.");

  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (centralOffset + centralSize > bytes.length) throw new Error("ZIP-Datei ist beschädigt.");

  const decoder = new TextDecoder();
  const entries = new Map();
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014B50) throw new Error("Ungültiger ZIP-Verzeichniseintrag.");
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    if (flags & 0x08) throw new Error("ZIP mit Daten-Deskriptor wird nicht unterstützt.");
    if (method !== 0) throw new Error("Dieses Backup verwendet eine nicht unterstützte Kompression.");

    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    const local = localOffset;
    if (view.getUint32(local, true) !== 0x04034B50) throw new Error("Ungültiger ZIP-Dateikopf.");
    const localNameLength = view.getUint16(local + 26, true);
    const localExtraLength = view.getUint16(local + 28, true);
    const dataStart = local + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length || uncompressedSize !== compressedSize) throw new Error("ZIP-Datei ist beschädigt.");
    entries.set(name, bytes.slice(dataStart, dataEnd));
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function sichereDateiname(name) {
  return String(name || "datei").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function mediaZipPath(bucket, path) {
  const parts = String(path || "").split("/").filter(Boolean).map(sichereDateiname);
  return `media/${bucket === BUCKET_FOTOS ? "fotos" : "sprachnotizen"}/${parts.join("/")}`;
}

async function sammleMedien(backupData, msg) {
  const media = [];
  const fehlendeFotos = [];
  const fehlendeAudio = [];
  const seen = new Set();
  const quellen = [
    ...(backupData.fotos || []).map((row) => ({ bucket: BUCKET_FOTOS, path: row.dateipfad, type: "foto" })),
    ...(backupData.sprachnotizen || []).map((row) => ({ bucket: BUCKET_AUDIO, path: row.dateipfad, type: "audio" })),
  ];

  let index = 0;
  for (const quelle of quellen) {
    if (!quelle.path || seen.has(`${quelle.bucket}|${quelle.path}`)) continue;
    seen.add(`${quelle.bucket}|${quelle.path}`);
    index++;
    msg.textContent = `Medien sichern … ${index}/${quellen.length}`;
    const { data, error } = await sb.storage.from(quelle.bucket).download(quelle.path);
    if (error || !data) {
      if (quelle.type === "foto") fehlendeFotos.push(quelle.path);
      else fehlendeAudio.push(quelle.path);
      debugLog(`⚠️ Mediendatei fehlt und wird im Backup übersprungen: ${quelle.bucket}/${quelle.path}`);
      continue;
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    media.push({
      bucket: quelle.bucket,
      path: quelle.path,
      zipPath: mediaZipPath(quelle.bucket, quelle.path),
      mimeType: data.type || (quelle.type === "foto" ? "image/jpeg" : "audio/mp4"),
      size: bytes.length,
      bytes,
    });
  }
  return { media, fehlendeFotos, fehlendeAudio };
}

async function teileOderLadeDateiHerunter(file) {
  if (navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "Partezettel Backup", text: "Vollständiges Partezettel-Backup", files: [file] });
        return "geteilt";
      }
    } catch (err) {
      if (err && err.name === "AbortError") return "abgebrochen";
      debugLog(`⚠️ Teilen nicht möglich, verwende Download: ${err.message || err}`);
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "download";
}

async function erstelleICloudBackup() {
  const msg = document.getElementById("backup-message");
  msg.textContent = "Backup wird vorbereitet …";
  try {
    await ensureSession();
    const data = await fetchAllExportData();
    const gesammelt = await sammleMedien(data, msg);
    const media = gesammelt.media;

    // Verwaiste Foto-Einträge werden beim Backup ebenfalls bereinigt.
    // Das verhindert, dass ein bereits gelöschtes Storage-Objekt später
    // beim Backup oder Restore wieder als defekter Foto-Datensatz auftaucht.
    if (gesammelt.fehlendeFotos.length) {
      const fehlendeSet = new Set(gesammelt.fehlendeFotos);
      data.fotos = (data.fotos || []).filter(row => !fehlendeSet.has(row.dateipfad));
      for (const path of gesammelt.fehlendeFotos) {
        const { error: deleteError } = await sb.from("fotos").delete().eq("dateipfad", path);
        if (deleteError) debugLog(`⚠️ Verwaister Fotoeintrag konnte nicht gelöscht werden: ${path} – ${deleteError.message}`);
      }
    }
    if (gesammelt.fehlendeAudio.length) {
      const fehlendeSet = new Set(gesammelt.fehlendeAudio);
      data.sprachnotizen = (data.sprachnotizen || []).filter(row => !fehlendeSet.has(row.dateipfad));
    }

    const manifest = {
      format: "partezettel-complete-backup",
      version: 2,
      createdAt: new Date().toISOString(),
      app: "Partezettel Archiv",
      tables: ["personen", "familien", "familien_kinder", "fotos", "sprachnotizen"],
      media: media.map(({ bucket, path, zipPath, mimeType, size }) => ({ bucket, path, zipPath, mimeType, size })),
    };
    const daten = { ...data };
    const entries = [
      { name: "backup.json", data: new TextEncoder().encode(JSON.stringify({ manifest, data: daten }, null, 2)) },
    ];
    for (const item of media) entries.push({ name: item.zipPath, data: item.bytes });

    msg.textContent = `ZIP-Backup wird erstellt … (${entries.length} Dateien)`;
    const zipBytes = erstelleZip(entries);
    const file = new File([zipBytes], backupDateiname(), { type: "application/zip" });
    const result = await teileOderLadeDateiHerunter(file);
    const bereinigt = gesammelt.fehlendeFotos.length + gesammelt.fehlendeAudio.length;
    const hinweis = bereinigt ? ` · ${bereinigt} verwaiste Medieneinträge übersprungen` : "";
    if (result === "abgebrochen") msg.textContent = "Backup nicht gespeichert.";
    else if (result === "geteilt") msg.textContent = `Vollständiges Backup erstellt ✓ (${media.length} Mediendateien). Über „Dateien“ kannst du es in iCloud Drive speichern.${hinweis}`;
    else msg.textContent = `Vollständiges Backup erstellt ✓ (${media.length} Mediendateien).${hinweis}`;
  } catch (err) {
    msg.textContent = `Fehler: ${err.message || err}`;
    debugLog(`❌ Vollständiges Backup: ${err.message || err}`);
  }
}

async function stelleBackupWiederHer(file) {
  const msg = document.getElementById("backup-message");
  if (!file) return;
  if (!confirm("Dieses vollständige Backup in Supabase einspielen? Vorhandene Datensätze mit gleicher ID werden überschrieben; vorhandene Mediendateien bleiben unverändert.")) return;
  msg.textContent = "Backup wird geprüft …";
  try {
    await ensureSession();
    let backup;
    let zipEntries = null;
    if (file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      zipEntries = zipReadDirectory(bytes);
      const backupBytes = zipEntries.get("backup.json");
      if (!backupBytes) throw new Error("backup.json fehlt im Backup.");
      backup = JSON.parse(new TextDecoder().decode(backupBytes));
    } else {
      backup = JSON.parse(await file.text());
    }

    const data = backup.data || backup;
    if (!data || (backup.manifest?.format !== "partezettel-complete-backup" && backup.format !== "partezettel-backup") || !Array.isArray(data.personen) || !Array.isArray(data.familien) || !Array.isArray(data.familien_kinder)) {
      throw new Error("Keine gültige Partezettel-Backup-Datei.");
    }

    const upsertBatch = async (table, rows, label) => {
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        if (!batch.length) continue;
        const { error } = await sb.from(table).upsert(batch, { onConflict: "id" });
        if (error) throw new Error(`${label}: ${error.message}`);
      }
    };

    await upsertBatch("personen", data.personen, "Personen");
    await upsertBatch("familien", data.familien || [], "Familien");
    await upsertBatch("familien_kinder", data.familien_kinder || [], "Kinder-Verknüpfungen");
    await upsertBatch("fotos", data.fotos || [], "Foto-Daten");
    await upsertBatch("sprachnotizen", data.sprachnotizen || [], "Sprachnotizen");

    let restoredMedia = 0;
    let skippedMedia = 0;
    const media = backup.manifest?.media || [];
    if (zipEntries && media.length) {
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        msg.textContent = `Mediendateien wiederherstellen … ${i + 1}/${media.length}`;
        const bytes = zipEntries.get(item.zipPath);
        if (!bytes) throw new Error(`Mediendatei fehlt im ZIP: ${item.zipPath}`);

        // Bestehende Datei nicht überschreiben. So benötigt der Restore keine UPDATE-Rechte
        // und ein vorhandenes Original bleibt unangetastet.
        const { data: vorhanden } = await sb.storage.from(item.bucket).download(item.path);
        if (vorhanden) {
          skippedMedia++;
          continue;
        }
        const blob = new Blob([bytes], { type: item.mimeType || "application/octet-stream" });
        const { error } = await sb.storage.from(item.bucket).upload(item.path, blob, {
          upsert: false,
          contentType: item.mimeType || "application/octet-stream",
        });
        if (error) throw new Error(`Mediendatei ${item.path}: ${error.message}`);
        restoredMedia++;
      }
    }

    await loadPersonen();
    if (zipEntries) {
      msg.textContent = `Vollständiges Backup wiederhergestellt ✓ (${data.personen.length} Personen, ${restoredMedia} Mediendateien ergänzt, ${skippedMedia} vorhandene beibehalten).`;
    } else {
      msg.textContent = `Datenbank-Backup wiederhergestellt ✓ (${data.personen.length} Personen).`;
    }
  } catch (err) {
    msg.textContent = `Fehler beim Wiederherstellen: ${err.message || err}`;
    debugLog(`❌ Backup wiederherstellen: ${err.message || err}`);
  }
}

const fotoOptimierenBtn = document.getElementById("foto-optimieren-btn");
if (fotoOptimierenBtn) fotoOptimierenBtn.addEventListener("click", optimiereBestehendeFotos);

const backupBtn = document.getElementById("backup-icloud-btn");
if (backupBtn) backupBtn.addEventListener("click", erstelleICloudBackup);
const backupInput = document.getElementById("backup-restore-input");
if (backupInput) backupInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  await stelleBackupWiederHer(file);
  event.target.value = "";
});

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
  const { personen, familien, familien_kinder } = await fetchAllExportData();

  const gedcomDate = (d) => {
    if (!d) return null;
    const [y, m, day] = String(d).slice(0, 10).split("-");
    const monate = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${parseInt(day, 10)} ${monate[parseInt(m, 10) - 1]} ${y}`;
  };
  const clean = (v) => String(v || "").replace(/[\r\n]+/g, " ").trim();
  const personById = new Map(personen.map((p) => [p.id, p]));
  const gidById = new Map();
  personen.forEach((p, i) => gidById.set(p.id, `@I${i + 1}@`));
  const fidById = new Map();
  familien.forEach((f, i) => fidById.set(f.id, `@F${i + 1}@`));

  const famsByPerson = new Map();
  const famcByPerson = new Map();
  for (const f of familien) {
    for (const pid of [f.partner_a_id, f.partner_b_id].filter(Boolean)) {
      if (!famsByPerson.has(pid)) famsByPerson.set(pid, []);
      famsByPerson.get(pid).push(f.id);
    }
  }
  for (const fk of familien_kinder) {
    if (!famcByPerson.has(fk.kind_id)) famcByPerson.set(fk.kind_id, []);
    famcByPerson.get(fk.kind_id).push(fk.familie_id);
  }

  const lines = [
    "0 HEAD",
    "1 SOUR PartezettelArchiv",
    "2 NAME Partezettel Archiv",
    "1 GEDC",
    "2 VERS 5.5.1",
    "1 CHAR UTF-8",
  ];

  for (const p of personen) {
    lines.push(`0 ${gidById.get(p.id)} INDI`);
    lines.push(`1 NAME ${clean(p.vorname)} /${clean(p.nachname)}/`);
    if (p.geschlecht === "männlich") lines.push("1 SEX M");
    else if (p.geschlecht === "weiblich") lines.push("1 SEX F");
    else lines.push("1 SEX U");
    if (p.Ledigenname) lines.push(`1 NOTE Geburtsname: ${clean(p.Ledigenname)}`);
    if (p.geburtsdatum) { lines.push("1 BIRT"); lines.push(`2 DATE ${gedcomDate(p.geburtsdatum)}`); }
    if (p.sterbedatum || p.sterbejahr) { lines.push("1 DEAT"); lines.push(`2 DATE ${p.sterbedatum ? gedcomDate(p.sterbedatum) : String(p.sterbejahr)}`); }
    if (p.Notiz) lines.push(`1 NOTE ${clean(p.Notiz)}`);
    for (const fid of famsByPerson.get(p.id) || []) lines.push(`1 FAMS ${fidById.get(fid)}`);
    for (const fid of famcByPerson.get(p.id) || []) lines.push(`1 FAMC ${fidById.get(fid)}`);
  }

  for (const f of familien) {
    const fid = fidById.get(f.id);
    lines.push(`0 ${fid} FAM`);
    const a = personById.get(f.partner_a_id);
    const b = f.partner_b_id ? personById.get(f.partner_b_id) : null;
    const partners = [a, b].filter(Boolean);
    const male = partners.find((p) => p.geschlecht === "männlich");
    const female = partners.find((p) => p.geschlecht === "weiblich");
    if (male) lines.push(`1 HUSB ${gidById.get(male.id)}`);
    if (female && (!male || female.id !== male.id)) lines.push(`1 WIFE ${gidById.get(female.id)}`);
    if (!male && a) lines.push(`1 HUSB ${gidById.get(a.id)}`);
    if (!female && b && (!male || b.id !== male.id)) lines.push(`1 WIFE ${gidById.get(b.id)}`);
    if (f.beginn) {
      lines.push("1 MARR");
      lines.push(`2 DATE ${gedcomDate(f.beginn)}`);
    }
    if (f.ende) {
      if ((f.familientyp || "").toLowerCase() === "ehe") {
        lines.push("1 DIV");
        lines.push(`2 DATE ${gedcomDate(f.ende)}`);
      } else {
        lines.push(`1 NOTE Ende der ${clean(f.familientyp || "Partnerschaft")}: ${gedcomDate(f.ende)}`);
      }
    }
    if (f.familientyp && f.familientyp.toLowerCase() !== "ehe" && !f.beginn) {
      lines.push(`1 NOTE ${clean(f.familientyp)}`);
    }
    if (f.notiz) lines.push(`1 NOTE ${clean(f.notiz)}`);
    for (const fk of familien_kinder.filter((x) => x.familie_id === f.id)) {
      if (gidById.has(fk.kind_id)) {
        lines.push(`1 CHIL ${gidById.get(fk.kind_id)}`);
        if (fk.beziehungstyp && fk.beziehungstyp !== "biologisch") lines.push(`2 NOTE ${clean(fk.beziehungstyp)}`);
      }
    }
  }

  lines.push("0 TRLR");
  downloadFile("partezettel-export.ged", lines.join("\n"), "text/plain;charset=utf-8");
  msg.textContent = "GEDCOM-Datei heruntergeladen ✓";
});

document.getElementById("export-pdf-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle PDF …";
  const { personen, familien, familien_kinder } = await fetchAllExportData();

  if (!window.jspdf) {
    msg.textContent = "PDF-Bibliothek konnte nicht geladen werden.";
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 15;
  const personById = new Map(personen.map((p) => [p.id, p]));
  const name = (id) => {
    const p = personById.get(id);
    return p ? `${p.vorname} ${p.nachname}` : "(unbekannte Person)";
  };
  const addLine = (text, size = 10, bold = false) => {
    if (y > 275) { doc.addPage(); y = 15; }
    doc.setFontSize(size);
    doc.setFont(undefined, bold ? "bold" : "normal");
    const wrapped = doc.splitTextToSize(String(text), 180);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 5 + 1;
  };

  addLine("Partezettel Archiv — Familienübersicht", 16, true);
  y += 3;
  for (const p of personen) {
    addLine(`${p.vorname} ${p.nachname}${p.Ledigenname ? ` geb. ${p.Ledigenname}` : ""}`, 11, true);
    const sterbeJahrAnzeige = p.sterbedatum
      ? p.sterbedatum.split("-")[0]
      : (p.sterbejahr ? String(p.sterbejahr) : "");
    const jahre = [p.geburtsdatum ? p.geburtsdatum.split("-")[0] : "", sterbeJahrAnzeige]
      .filter(Boolean)
      .join(" – ");
    if (jahre) addLine(jahre);
    if (p.Notiz) addLine(p.Notiz);
    y += 2;
  }
  if (familien.length) {
    addLine("Familien", 13, true);
    for (const f of familien) {
      const partner = [f.partner_a_id, f.partner_b_id].filter(Boolean).map(name).join(" + ");
      addLine(`${partner} — ${f.familientyp || "Partnerschaft"}`, 10, true);
      const kids = familien_kinder.filter((k) => k.familie_id === f.id);
      for (const k of kids) addLine(`  Kind: ${name(k.kind_id)}${k.beziehungstyp && k.beziehungstyp !== "biologisch" ? ` — ${k.beziehungstyp}` : ""}`);
    }
  }
  doc.save("partezettel-export.pdf");
  msg.textContent = "PDF heruntergeladen ✓";
});

// ===================== Stammbaum v31 =====================
let treeZoom = 1;
let treeData = { personen: [], familien: [], kinder: [], photos: new Map() };

function escTree(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

function treePersonCard(person, rootId = null, extraClass = "") {
  if (!person) return "";
  const jahre = [person.geburtsdatum, person.sterbedatum].filter(Boolean).map((d) => d.split("-")[0]).join(" – ");
  const foto = treeData.photos.get(person.id);
  return `<button type="button" class="tree-node ${rootId === person.id ? "tree-node--root" : ""} ${extraClass}" data-tree-person="${person.id}">
    ${foto ? `<img class="tree-node__photo" src="${escTree(foto)}" alt="Schlüsselfoto von ${escTree(person.vorname)} ${escTree(person.nachname)}">` : `<span class="tree-node__placeholder" aria-hidden="true">👤</span>`}
    <span class="tree-node__name">${escTree(person.vorname)} ${escTree(person.nachname)}</span>
    ${jahre ? `<span class="tree-node__years">${escTree(jahre)}</span>` : ""}
  </button>`;
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
      return nameA.localeCompare(nameB, "de", { sensitivity: "base" });
    });
}

function treeParentFamiliesForPerson(id) {
  return treeData.kinder.filter((k) => k.kind_id === id).map((k) => treeData.familien.find((f) => f.id === k.familie_id)).filter(Boolean);
}

async function loadStammbaumData() {
  await ensureSession();
  const [{ data: personen, error: personenError }, { data: familien, error: familienError }, { data: kinder, error: kinderError }] = await Promise.all([
    sb.from("personen").select("id, vorname, nachname, geschlecht, geburtsdatum, sterbedatum").order("nachname", { ascending: true }),
    sb.from("familien").select("id, partner_a_id, partner_b_id, familientyp, beginn, ende"),
    sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp")
  ]);
  if (personenError) throw personenError;
  if (familienError) throw familienError;
  if (kinderError) throw kinderError;

  treeData.personen = personen || [];
  treeData.familien = familien || [];
  treeData.kinder = kinder || [];
  treeData.photos = new Map();

  const ids = treeData.personen.map((p) => p.id);
  if (ids.length) {
    const { data: fotos, error: fotoError } = await sb.from("fotos")
      .select("personen_id, dateipfad, ist_schluesselfoto")
      .in("personen_id", ids)
      .eq("ist_schluesselfoto", true);
    if (fotoError) debugLog(`❌ Stammbaum-Schlüsselfotos: ${fotoError.message}`);
    for (const foto of fotos || []) {
      const { data: signed } = await sb.storage.from(BUCKET_FOTOS).createSignedUrl(foto.dateipfad, 3600);
      if (signed?.signedUrl) treeData.photos.set(foto.personen_id, signed.signedUrl);
    }
  }
}

function renderStammbaum(rootId) {
  const stage = document.getElementById("tree-stage");
  const message = document.getElementById("tree-message");
  if (!stage) return;
  stage.innerHTML = "";
  const root = treePerson(rootId);
  if (!root) {
    stage.innerHTML = '<div class="tree-empty">Bitte eine Person auswählen.</div>';
    return;
  }

  // Eltern des Mittelpunktes: Das Elternpaar wird als zusammengehörige
  // Familie dargestellt und mit einer eindeutigen Linie zum Mittelpunkt
  // verbunden. Dadurch ist sofort erkennbar, welches Paar die Eltern sind.
  const parentFamilies = treeParentFamiliesForPerson(rootId);
  if (parentFamilies.length) {
    const parentsSection = document.createElement("div");
    parentsSection.className = "tree-parents-section";

    const parentsLabel = document.createElement("div");
    parentsLabel.className = "tree-label tree-parents-label";
    parentsLabel.textContent = `Eltern von ${root.vorname || ""} ${root.nachname || ""}`.trim();
    parentsSection.appendChild(parentsLabel);

    for (const f of parentFamilies) {
      const parentPair = document.createElement("div");
      parentPair.className = "tree-parent-pair";
      const parentA = treePerson(f.partner_a_id);
      const parentB = treePerson(f.partner_b_id);
      const cards = [];
      if (parentA && parentA.id !== rootId) cards.push(treePersonCard(parentA));
      if (parentB && parentB.id !== rootId) cards.push(treePersonCard(parentB));

      if (cards.length === 2) {
        parentPair.innerHTML = `${cards[0]}<div class="tree-parent-relation" aria-label="Eltern"><span>Eltern</span><i aria-hidden="true"></i></div>${cards[1]}`;
      } else if (cards.length === 1) {
        parentPair.innerHTML = cards[0];
      }
      if (parentPair.innerHTML) {
        parentsSection.appendChild(parentPair);
        const down = document.createElement("div");
        down.className = "tree-parent-downline";
        parentsSection.appendChild(down);
      }
    }
    stage.appendChild(parentsSection);
  }

  const partnerFamilies = treeFamiliesForPerson(rootId);
  const visibleFamilies = partnerFamilies.filter((f) => treeChildrenForFamily(f.id).length || f.partner_a_id === rootId || f.partner_b_id === rootId);

  if (!visibleFamilies.length) {
    const rootArea = document.createElement("div");
    rootArea.className = "tree-root-area";
    rootArea.innerHTML = treePersonCard(root, rootId);
    stage.appendChild(rootArea);
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = "Keine Partnerschaft oder Kinder erfasst.";
    stage.appendChild(empty);
  } else {
    const familyWrap = document.createElement("div");
    familyWrap.className = "tree-generation tree-family-generation";

    for (const f of visibleFamilies) {
      const block = document.createElement("div");
      block.className = "tree-family-block";
      const otherId = [f.partner_a_id, f.partner_b_id].find((id) => id && id !== rootId);
      const partner = treePerson(otherId);
      const kids = treeChildrenForFamily(f.id);
      const isMarriage = String(f.familientyp || "").toLowerCase() === "ehe";

      // Paare werden immer nebeneinander dargestellt. Die Art der Verbindung
      // steht mittig zwischen den beiden Personen; bei einer Ehe zusätzlich mit Ringen.
      const partnerCard = partner
        ? treePersonCard(partner)
        : `<div class="tree-node"><span class="tree-node__placeholder">?</span><span class="tree-node__name">Unbekannter Partner</span></div>`;
      const relationType = f.familientyp || "Partnerschaft";
      block.innerHTML = `
        <div class="tree-couple">
          ${treePersonCard(root, rootId)}
          <div class="tree-relationship ${isMarriage ? "tree-relationship--marriage" : ""}" aria-label="${escTree(relationType)}">
            <span class="tree-marriage__label">${escTree(relationType)}</span>
            ${isMarriage ? `<span class="tree-marriage__rings" aria-hidden="true">◯◯</span>` : `<span class="tree-partner-link" aria-hidden="true"></span>`}
          </div>
          ${partnerCard}
        </div>`;

      if (kids.length) {
        const label = document.createElement("div");
        label.className = "tree-label tree-family-label";
        label.textContent = `${kids.length > 1 ? `${kids.length} Kinder` : "1 Kind"}`;
        block.appendChild(label);
        const children = document.createElement("div");
        children.className = "tree-children";
        children.innerHTML = kids.map((k) => treePersonCard(k.person, rootId, "tree-node--child")).join("");
        children.querySelectorAll("[data-tree-person]").forEach((el) => el.dataset.treeChild = "true");
        block.appendChild(children);
      }
      familyWrap.appendChild(block);
    }
    stage.appendChild(familyWrap);
  }

  stage.querySelectorAll("[data-tree-person]").forEach((el) => {
    const openTreePerson = async (event) => {
      if (event) event.preventDefault();
      const id = el.dataset.treePerson;
      if (!id) return;
      const select = document.getElementById("tree-person-select");
      if (select) select.value = id;
      renderStammbaum(id);
    };
    el.addEventListener("click", openTreePerson);
  });
  if (message) message.textContent = "";
}

async function loadStammbaum() {
  const message = document.getElementById("tree-message");
  const select = document.getElementById("tree-person-select");
  try {
    message.textContent = "Stammbaum wird geladen …";
    await loadStammbaumData();
    if (!treeData.personen.length) {
      select.innerHTML = '<option value="">— keine Personen vorhanden —</option>';
      renderStammbaum("");
      message.textContent = "";
      return;
    }
    const current = select.value && treePerson(select.value) ? select.value : treeData.personen[0].id;
    select.innerHTML = '<option value="">— Person auswählen —</option>';
    treeData.personen.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.nachname}, ${p.vorname}`;
      select.appendChild(opt);
    });
    select.value = current;
    renderStammbaum(current);
    message.textContent = "";
  } catch (err) {
    message.textContent = `Fehler beim Laden des Stammbaums: ${err.message || err}`;
    debugLog(`❌ Stammbaum: ${err.message || err}`);
  }
}

function updateTreeZoom() {
  const stage = document.getElementById("tree-stage");
  const value = document.getElementById("tree-zoom-value");
  if (stage) stage.style.transform = `scale(${treeZoom})`;
  if (value) value.textContent = `${Math.round(treeZoom * 100)} %`;
}

const treeSelect = document.getElementById("tree-person-select");
if (treeSelect) treeSelect.addEventListener("change", () => renderStammbaum(treeSelect.value));
const treeZoomIn = document.getElementById("tree-zoom-in");
const treeZoomOut = document.getElementById("tree-zoom-out");
const treeReset = document.getElementById("tree-reset");
if (treeZoomIn) treeZoomIn.addEventListener("click", () => { treeZoom = Math.min(1.5, +(treeZoom + 0.1).toFixed(2)); updateTreeZoom(); });
if (treeZoomOut) treeZoomOut.addEventListener("click", () => { treeZoom = Math.max(0.6, +(treeZoom - 0.1).toFixed(2)); updateTreeZoom(); });
if (treeReset) treeReset.addEventListener("click", () => { treeZoom = 1; updateTreeZoom(); });
updateTreeZoom();
