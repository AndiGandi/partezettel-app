// ==========================================================
// Partezettel Archiv – App-Logik
// ==========================================================

// ---------- Sichtbares Debug-Log (funktioniert ohne Mac/Web-Inspector) ----------
function todesjahrAnzeige(person) {
  if (!person) return "";
  if (person.sterbejahr) return String(person.sterbejahr);
  const raw = person.sterbedatum || person.todesdatum || "";
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : String(d.getFullYear());
}

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
    .select("id, vorname, nachname, geschlecht, Ledigenname, geburtsdatum, sterbedatum, Notiz")
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
  const list = document.getElementById("personen-list");
  list.innerHTML = "";
  await ladeSchluesselfotos(personen);
  personen.forEach((p) => {
    const li = document.createElement("li");
    li.className = "person-card";
    const jahre = [p.geburtsdatum, p.sterbedatum].filter(Boolean).map((d) => d.split("-")[0]).join(" – ");
    const fotoUrl = schluesselfotoCache.get(p.id);
    li.innerHTML = `
      ${fotoUrl ? `<img class="person-card__photo" src="${fotoUrl}" alt="Schlüsselfoto von ${p.vorname} ${p.nachname}">` : `<div class="person-card__photo-placeholder" aria-hidden="true">👤</div>`}
      <div class="person-card__content">
        <div class="person-card__name">${p.vorname} ${p.nachname}</div>
        ${jahre ? `<div class="person-card__years">${jahre}</div>` : ""}
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
  setDetailFamilieMessage("");
  document.getElementById("d-delete-message").textContent = "";

  await loadDetailFotos(personId);
  await loadDetailAudio(personId);
  // Für die Familienansicht immer aktuelle Personennamen verwenden.
  try { await loadPersonen(); } catch (_) {}
  await loadDetailFamilie(personId);

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
  msg.textContent = "Lade hoch …";
  const ext = edited.type.includes("png") ? "png" : "jpg";
  const path = `${currentDetailPersonId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error: uploadError } = await sb.storage.from(BUCKET_FOTOS).upload(path, edited);
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
    const { data } = await sb.from("familien").select("*").in("id", parentFamilyIds);
    parentFamilies = data || [];
  }

  const potentialParents = [];
  for (const f of parentFamilies) {
    for (const id of [f.partner_a_id, f.partner_b_id]) {
      if (id && id !== personId && !potentialParents.some((x) => x.id === id)) {
        const p = personenCache.find((x) => x.id === id);
        if (p) potentialParents.push(p);
      }
    }
  }

  [parentSelectVater, parentSelectMutter].forEach((select) => {
    select.innerHTML = '<option value="">— nicht angegeben —</option>';
    personenCache.filter((p) => p.id !== personId).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.vorname} ${p.nachname}`;
      select.appendChild(opt);
    });
  });

  parentSelectVater.value = potentialParents.find((p) => p.geschlecht === "männlich")?.id || "";
  parentSelectMutter.value = potentialParents.find((p) => p.geschlecht === "weiblich")?.id || "";
  if (!parentSelectVater.value && potentialParents.length === 1) parentSelectVater.value = potentialParents[0].id;

  partnerList.innerHTML = "";
  for (const f of partnerFamilies || []) {
    const otherId = familiePartnerIds(f, personId)[0];
    if (!otherId) continue;
    const div = document.createElement("div");
    div.className = "detail-media-item familie-item";
    const typ = f.familientyp || "Partnerschaft";
    const zeitraum = [f.beginn, f.ende].filter(Boolean).map((d) => d.split("-").reverse().join(".")).join(" – ");
    div.innerHTML = `<span class="beziehung-text">${personNameById(otherId)}${typ ? ` — ${typ}` : ""}${zeitraum ? ` — ${zeitraum}` : ""}</span><button class="del-btn" title="Partnerschaft löschen">🗑️</button>`;
    div.querySelector(".del-btn").addEventListener("click", async () => {
      if (!confirm("Diese Partnerschaft mit allen zugehörigen Kinder-Verknüpfungen löschen?")) return;
      const { error } = await sb.from("familien").delete().eq("id", f.id);
      if (error) setDetailFamilieMessage(`Fehler: ${error.message}`);
      else await loadDetailFamilie(personId);
    });
    partnerList.appendChild(div);
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
      div.innerHTML = `<span class="beziehung-text">${personNameById(otherId)} — ${b.beziehungstyp}</span><button class="del-btn" title="Partnerschaft löschen">🗑️</button>`;
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

  const partnerFamilyIds = (partnerFamilies || []).map((f) => f.id);
  let childLinksForPerson = [];
  if (partnerFamilyIds.length) {
    const { data } = await sb.from("familien_kinder").select("id, familie_id, kind_id, beziehungstyp").in("familie_id", partnerFamilyIds);
    childLinksForPerson = data || [];
  }
  childList.innerHTML = "";
  for (const link of childLinksForPerson) {
    const child = personenCache.find((p) => p.id === link.kind_id);
    if (!child) continue;
    const div = document.createElement("div");
    div.className = "detail-media-item familie-item";
    div.innerHTML = `<span class="beziehung-text">${child.vorname} ${child.nachname}${link.beziehungstyp && link.beziehungstyp !== "biologisch" ? ` — ${link.beziehungstyp}` : ""}</span><button class="del-btn" title="Kind-Verknüpfung löschen">🗑️</button>`;
    div.querySelector(".del-btn").addEventListener("click", async () => {
      const { error } = await sb.from("familien_kinder").delete().eq("id", link.id);
      if (error) setDetailFamilieMessage(`Fehler: ${error.message}`);
      else await loadDetailFamilie(personId);
    });
    childList.appendChild(div);
  }
  if (!childList.children.length) childList.innerHTML = '<span class="capture-status">Keine Kinder erfasst</span>';

  fillFamilienPersonSelect("d-partner-person", personId);
  const partnerAddBtn = document.getElementById("d-add-partner-btn");
  if (partnerAddBtn) {
    const hatPartnerschaft = !!partnerList.querySelector(".familie-item");
    partnerAddBtn.hidden = !hatPartnerschaft;
    partnerAddBtn.textContent = hatPartnerschaft ? "Weitere Partnerschaft hinzufügen" : "Partnerschaft hinzufügen";
  }
  fillFamilienPersonSelect("d-kind-person", personId);
  const familySelect = document.getElementById("d-kind-partner-family");
  familySelect.innerHTML = '<option value="">automatisch auswählen</option>';
  for (const f of partnerFamilies || []) {
    const otherId = familiePartnerIds(f, personId)[0];
    if (!otherId) continue;
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = `${personNameById(otherId)} — ${f.familientyp || "Partnerschaft"}`;
    familySelect.appendChild(opt);
  }
}

function fillFamilienPersonSelect(selectId, excludePersonId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">— auswählen —</option>';
  personenCache.filter((p) => p.id !== excludePersonId).forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.vorname} ${p.nachname}`;
    select.appendChild(opt);
  });
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

document.getElementById("d-save-eltern-btn").addEventListener("click", async () => {
  const msg = document.getElementById("d-familie-message");
  const vater = document.getElementById("d-vater").value || null;
  const mutter = document.getElementById("d-mutter").value || null;
  if (!vater && !mutter) { msg.textContent = "Keine Eltern ausgewählt."; return; }
  msg.textContent = "Speichere Eltern …";
  try {
    const familie = await findeOderErstelleFamilie(vater || mutter, vater && mutter ? mutter : null, "Eltern");
    await addKindZuFamilie(familie.id, currentDetailPersonId, "biologisch");
    msg.textContent = "Eltern gespeichert ✓";
    await loadDetailFamilie(currentDetailPersonId);
  } catch (err) {
    msg.textContent = `Fehler: ${err.message}`;
  }
});

// Partner/in auswählen löst KEIN automatisches Speichern aus.
// Zuerst Partner/in, Art (Partnerschaft/Ehe) und optional die Daten auswählen,
// anschließend ausdrücklich auf „Partner/in hinzufügen“ tippen.
document.getElementById("d-partner-person").addEventListener("change", () => {
  const msg = document.getElementById("d-familie-message");
  if (msg) msg.textContent = "";
});

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
    const beginn = document.getElementById("d-partner-beginn").value || null;
    const ende = document.getElementById("d-partner-ende").value || null;

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
        msg.textContent = `✅ INSERT erfolgreich – Beziehung + Familie gespeichert`;
      }
    } catch (familyErr) {
      const detail = familyErr?.message || String(familyErr);
      debugLog(`⚠️ FAMILIEN-INSERT AUSNAHME: ${detail}`);
      msg.textContent = `✅ Beziehung gespeichert. ⚠️ Familien-INSERT Fehler: ${detail}`;
    }

    if (!wasAutoPartnerSave) {
      document.getElementById("d-partner-person").value = "";
      document.getElementById("d-partner-beginn").value = "";
      document.getElementById("d-partner-ende").value = "";
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
    const preferredPartnerId = document.getElementById("d-kind-partner-family").value || null;
    if (preferredPartnerId) familie = (partnerFamilies.data || []).find((f) => f.id === preferredPartnerId);
    if (!familie) familie = (partnerFamilies.data || [])[0] || await findeOderErstelleFamilie(currentDetailPersonId, null, "Eltern");
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

async function fetchAllExportData() {
  const [{ data: personen }, { data: familien }, { data: familien_kinder }, { data: fotos }, { data: sprachnotizen }] = await Promise.all([
    sb.from("personen").select("*").order("nachname"),
    sb.from("familien").select("*"),
    sb.from("familien_kinder").select("*"),
    sb.from("fotos").select("*"),
    sb.from("sprachnotizen").select("*"),
  ]);
  return {
    personen: personen || [], familien: familien || [], familien_kinder: familien_kinder || [],
    fotos: fotos || [], sprachnotizen: sprachnotizen || []
  };
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
    if (p.sterbedatum) { lines.push("1 DEAT"); lines.push(`2 DATE ${gedcomDate(p.sterbedatum)}`); }
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
    const jahre = [p.geburtsdatum, p.sterbedatum].filter(Boolean).map((d) => d.split("-")[0]).join(" – ");
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
  return treeData.kinder.filter((k) => k.familie_id === familyId).map((k) => ({ ...k, person: treePerson(k.kind_id) })).filter((k) => k.person);
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

  // Eltern des Mittelpunktes – alle vorhandenen Elternfamilien werden berücksichtigt.
  const parentFamilies = treeParentFamiliesForPerson(rootId);
  if (parentFamilies.length) {
    const parentGeneration = document.createElement("div");
    parentGeneration.className = "tree-generation";
    const uniqueParents = [];
    for (const f of parentFamilies) {
      for (const id of [f.partner_a_id, f.partner_b_id]) {
        if (id && id !== rootId && treePerson(id) && !uniqueParents.some((p) => p.id === id)) uniqueParents.push(treePerson(id));
      }
    }
    if (uniqueParents.length) {
      parentGeneration.innerHTML = uniqueParents.map((p) => treePersonCard(p, rootId)).join('<div class="tree-parent-join"></div>');
      stage.appendChild(parentGeneration);
      const label = document.createElement("div");
      label.className = "tree-label";
      label.textContent = uniqueParents.length > 2 ? "Eltern / weitere Elternverknüpfungen" : "Eltern";
      stage.appendChild(label);
    }
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
        children.innerHTML = kids.map((k) => treePersonCard(k.person, rootId)).join("");
        block.appendChild(children);
      }
      familyWrap.appendChild(block);
    }
    stage.appendChild(familyWrap);
  }

  stage.querySelectorAll("[data-tree-person]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.treePerson;
      const select = document.getElementById("tree-person-select");
      if (select) select.value = id;
      renderStammbaum(id);
    });
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
