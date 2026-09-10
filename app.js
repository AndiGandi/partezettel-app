// ==========================================================
// Partezettel Archiv – App-Logik
// ==========================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentFotoBlob = null;
let currentAudioBlob = null;
let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = null;
let isRecording = false;
let personenCache = []; // {id, vorname, nachname, ...}

// ---------- Anonyme Anmeldung sicherstellen ----------
async function ensureSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) console.error("Anonyme Anmeldung fehlgeschlagen:", error.message);
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

// ---------- Foto-Aufnahme ----------
const fotoInput = document.getElementById("foto-input");
const fotoInputGalerie = document.getElementById("foto-input-galerie");
const fotoStatus = document.getElementById("foto-status");
const fotoPreview = document.getElementById("foto-preview");

function handleFotoAuswahl(file) {
  if (!file) return;
  currentFotoBlob = file;
  fotoStatus.textContent = "Foto ausgewählt ✓";
  const url = URL.createObjectURL(file);
  fotoPreview.src = url;
  fotoPreview.hidden = false;
}

fotoInput.addEventListener("change", () => handleFotoAuswahl(fotoInput.files[0]));
fotoInputGalerie.addEventListener("change", () => handleFotoAuswahl(fotoInputGalerie.files[0]));

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
  return ""; // Browser-Standard verwenden, falls keiner der obigen unterstützt wird
}

let currentAudioMimeType = "audio/webm";
let currentAudioExt = "webm";

audioBtn.addEventListener("click", async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosenType = pickAudioMimeType();
      mediaRecorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        // tatsächlich verwendeten Typ nehmen, nicht den gewünschten – manche Browser weichen ab
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
      console.error(err);
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    audioBtn.textContent = "🎙️ Aufnahme starten";
  }
});

// ---------- Formular absenden ----------
const form = document.getElementById("person-form");
const formMessage = document.getElementById("form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "Speichere …";

  const eintrag = {
    id: crypto.randomUUID(),
    vorname: document.getElementById("vorname").value.trim(),
    nachname: document.getElementById("nachname").value.trim(),
    geburtsdatum: document.getElementById("geburtsdatum").value || null,
    sterbedatum: document.getElementById("sterbedatum").value || null,
    notiz: document.getElementById("notiz").value.trim() || null,
    beziehung_person_id: document.getElementById("beziehung-person").value || null,
    beziehung_typ: document.getElementById("beziehung-typ").value.trim() || null,
    foto: currentFotoBlob,
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
  currentFotoBlob = null;
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
  const step = (msg) => { if (onProgress) onProgress(msg); console.log("[Partezettel]", msg); };
  try {
    step("Schritt 1/4: Anmelden …");
    await mitTimeout(
      ensureSession(),
      15000,
      "Zeitüberschreitung bei der Anmeldung (Netzwerk antwortet nicht)"
    );

    step("Schritt 2/4: Person speichern …");
    const { error: personError } = await mitTimeout(
      sb.from("personen").insert({
        id: eintrag.id,
        vorname: eintrag.vorname,
        nachname: eintrag.nachname,
        geburtsdatum: eintrag.geburtsdatum,
        sterbedatum: eintrag.sterbedatum,
        notiz: eintrag.notiz,
      }),
      15000,
      "Zeitüberschreitung beim Speichern der Person (Netzwerk antwortet nicht)"
    );
    if (personError) throw personError;

    // 2. Foto hochladen
    if (eintrag.foto) {
      step("Schritt 3/4: Foto hochladen …");
      const path = `${eintrag.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await mitTimeout(
        sb.storage.from(BUCKET_FOTOS).upload(path, eintrag.foto),
        20000,
        "Zeitüberschreitung beim Foto-Upload (Netzwerk antwortet nicht)"
      );
      if (uploadError) throw uploadError;
      await sb.from("fotos").insert({ person_id: eintrag.id, dateipfad: path });
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

    // 4. Beziehung anlegen
    if (eintrag.beziehung_person_id && eintrag.beziehung_typ) {
      await sb.from("beziehungen").insert({
        person_a_id: eintrag.id,
        person_b_id: eintrag.beziehung_person_id,
        beziehungstyp: eintrag.beziehung_typ,
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("Senden fehlgeschlagen:", err);
    const meldung = (err && (err.message || err.error_description || err.msg)) || "Unbekannter Fehler";
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
  await ensureSession();
  const list = document.getElementById("personen-list");
  const empty = document.getElementById("list-empty");
  const { data, error } = await sb
    .from("personen")
    .select("id, vorname, nachname, geburtsdatum, sterbedatum, notiz")
    .order("nachname", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  personenCache = data || [];
  renderPersonenList(personenCache);
  fillBeziehungSelect(personenCache);

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
      ${p.notiz ? `<div class="person-card__note">${p.notiz}</div>` : ""}
    `;
    list.appendChild(li);
  });
}

function fillBeziehungSelect(personen) {
  const select = document.getElementById("beziehung-person");
  const current = select.value;
  select.innerHTML = '<option value="">— keine —</option>';
  personen.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.vorname} ${p.nachname}`;
    select.appendChild(opt);
  });
  select.value = current;
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
  await ensureSession();
  await flushQueue();
  await loadPersonen();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.error("SW-Fehler:", e));
  }
})();
