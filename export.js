// Familienspuren – Export und Sicherung: PDF, JSON, GEDCOM, Backup
// Teil der App-Logik (früher app.js). Reihenfolge der Dateien siehe index.html. Version 447

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
    // v374: eindeutige Reihenfolge (zusätzlich nach id), sonst können beim seitenweisen Laden
    // Zeilen mit gleichem Nachnamen doppelt kommen oder fehlen.
    let abfrage = sb.from(table).select("*").order(orderColumn);
    if (orderColumn !== "id") abfrage = abfrage.order("id");
    const { data, error } = await abfrage.range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchAllExportData() {
  const [personen, familien, familien_kinder, fotos, foto_personen, sprachnotizen] = await Promise.all([
    fetchAllTableRows("personen", "nachname"),
    fetchAllTableRows("familien", "id"),
    fetchAllTableRows("familien_kinder", "id"),
    fetchAllTableRows("fotos", "id"),
    fetchAllTableRows("foto_personen", "id"),
    fetchAllTableRows("sprachnotizen", "id"),
  ]);
  // v363: Häuser, Stationen und Importe (Paket 3) mitsichern; fehlen die Tabellen, bleiben sie leer
  const optional = async (t) => { try { return await fetchAllTableRows(t, "id"); } catch (err) { debugLog(`ℹ️ Backup ohne ${t}: ${err.message || err}`); return []; } };
  const [importe, haeuser, person_stationen] = rolleIstEigentuemer()
    ? await Promise.all([optional("importe"), optional("haeuser"), optional("person_stationen")])
    : [[], await optional("haeuser"), await optional("person_stationen")];
  // v442: Trauungsbuch-Quellen je Ehe und Beziehungen mitsichern (fehlten bisher in der JSON-Sicherung)
  const optionalSortiert = async (t, spalte) => {
    try {
      const rows = []; let from = 0;
      while (true) {
        const { data, error } = await sb.from(t).select("*").order(spalte).range(from, from + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < 500) break;
        from += 500;
      }
      return rows;
    } catch (err) { debugLog(`ℹ️ Backup ohne ${t}: ${err.message || err}`); return []; }
  };
  const [familien_trauungsbuch_quellen, beziehung] = await Promise.all([
    optionalSortiert("familien_trauungsbuch_quellen", "familie_id"),
    optionalSortiert("beziehung", "id")
  ]);
  return { personen, familien, familien_kinder, fotos, foto_personen, sprachnotizen, importe, haeuser, person_stationen, familien_trauungsbuch_quellen, beziehung };
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
  if (!darfLoeschen("ein vollständiges Backup erstellen")) return;
  const msg = document.getElementById("backup-message");
  msg.textContent = "Backup wird vorbereitet …";
  try {
    await ensureSession();
    const data = await fetchAllExportData();
    const gesammelt = await sammleMedien(data, msg);
    const media = gesammelt.media;

    // Fehlende Mediendateien werden nur im Backup übersprungen.
    // Das Backup darf niemals automatisch Datensätze in Supabase löschen.
    if (gesammelt.fehlendeFotos.length) {
      const fehlendeSet = new Set(gesammelt.fehlendeFotos);
      data.fotos = (data.fotos || []).filter(row => !fehlendeSet.has(row.dateipfad));
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
      tables: ["personen", "familien", "familien_kinder", "fotos", "foto_personen", "sprachnotizen", "importe", "haeuser", "person_stationen", "familien_trauungsbuch_quellen", "beziehung"],
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

    const upsertBatch = async (table, rows, label, konflikt = "id") => {
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        if (!batch.length) continue;
        const { error } = await sb.from(table).upsert(batch, { onConflict: konflikt });
        if (error) throw new Error(`${label}: ${error.message}`);
      }
    };

    // v363: Importe und Häuser vor den Personen, Stationen danach (nur wenn Paket 3 eingespielt ist)
    if ((data.importe || []).length) await upsertBatch("importe", data.importe, "Importe");
    if ((data.haeuser || []).length) await upsertBatch("haeuser", data.haeuser, "Häuser");
    await upsertBatch("personen", data.personen, "Personen");
    await upsertBatch("familien", data.familien || [], "Familien");
    await upsertBatch("familien_kinder", data.familien_kinder || [], "Kinder-Verknüpfungen");
    await upsertBatch("fotos", data.fotos || [], "Foto-Daten");
    await upsertBatch("foto_personen", data.foto_personen || [], "Foto-Personen-Verknüpfungen");
    await upsertBatch("sprachnotizen", data.sprachnotizen || [], "Sprachnotizen");
    if ((data.person_stationen || []).length) await upsertBatch("person_stationen", data.person_stationen, "Stationen");
    // v442: Trauungsbuch-Quellen (eine je Ehe) und Beziehungen
    if ((data.familien_trauungsbuch_quellen || []).length) await upsertBatch("familien_trauungsbuch_quellen", data.familien_trauungsbuch_quellen, "Trauungsbuch-Quellen", "familie_id");
    if ((data.beziehung || []).length) await upsertBatch("beziehung", data.beziehung, "Beziehungen");

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
        // Die Existenzprüfung lädt die Datei NICHT mehr herunter (früher .download()),
        // sondern fragt nur per exists() (HEAD-Anfrage, keine Dateidaten) nach. Ist exists()
        // in der geladenen Supabase-Version nicht verfügbar oder schlägt es fehl, wird direkt
        // hochgeladen; ein 409 "already exists" zählt dann als "vorhanden beibehalten".
        const bucketApi = sb.storage.from(item.bucket);
        let existiertBereits = false;
        if (typeof bucketApi.exists === "function") {
          const { data: existiert, error: existsError } = await bucketApi.exists(item.path);
          if (!existsError && existiert === true) existiertBereits = true;
        }
        if (existiertBereits) {
          skippedMedia++;
          continue;
        }
        const blob = new Blob([bytes], { type: item.mimeType || "application/octet-stream" });
        const { error } = await bucketApi.upload(item.path, blob, {
          upsert: false,
          contentType: item.mimeType || "application/octet-stream",
        });
        if (error) {
          const status = String(error.statusCode || error.status || "");
          if (status === "409" || /already exists|duplicate/i.test(error.message || "")) {
            skippedMedia++;
            continue;
          }
          throw new Error(`Mediendatei ${item.path}: ${error.message}`);
        }
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

const backupBtn = document.getElementById("backup-icloud-btn");
if (backupBtn) backupBtn.addEventListener("click", erstelleICloudBackup);
const backupInput = document.getElementById("backup-restore-input");
if (backupInput) backupInput.addEventListener("change", async (event) => {
  if (!darfLoeschen("ein Backup wiederherstellen")) { event.target.value = ""; return; }
  const file = event.target.files?.[0];
  await stelleBackupWiederHer(file);
  event.target.value = "";
});

document.getElementById("export-json-btn").addEventListener("click", async () => {
  if (!darfLoeschen("Daten als JSON exportieren")) return;
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle JSON …";
  const data = await fetchAllExportData();
  downloadFile("partezettel-export.json", JSON.stringify(data, null, 2), "application/json");
  msg.textContent = "JSON-Datei heruntergeladen ✓";
});

document.getElementById("export-gedcom-btn").addEventListener("click", async () => {
  if (!darfLoeschen("Daten als GEDCOM exportieren")) return;
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
    if (p.Ledigenname) lines.push(`1 NOTE Geburtsname: ${clean(p.Ledigenname)}`);
    if (p.geburtsdatum || p.geburtsjahr) {
      lines.push("1 BIRT");
      lines.push(`2 DATE ${p.geburtsdatum ? gedcomDate(p.geburtsdatum) : String(p.geburtsjahr)}`);
    }
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
    // GEDCOM-Rollen werden nicht mehr aus einem Geschlechtsfeld abgeleitet.
    // Für den Export werden vorhandene Partner in der gespeicherten Reihenfolge ausgegeben.
    if (a) lines.push(`1 HUSB ${gidById.get(a.id)}`);
    if (b) lines.push(`1 WIFE ${gidById.get(b.id)}`);
    if (!f.beginn && f.beginn_jahr) {
      lines.push("1 MARR");
      lines.push(`2 DATE ${f.beginn_jahr}`);
    } else if (f.beginn) {
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

// ---------- v350: PDF-Export im Familienspuren-Design ----------
// Aufbau: Kopf mit Logo und „Familienspuren“ wie auf der Startseite, Personen nach Buchstaben,
// danach Familien mit Kindern, Fußzeile mit Vertraulichkeitshinweis und Seitenzahl.
const PDF_FARBEN = {
  wald: [23, 79, 59], waldTief: [16, 61, 46], gold: [139, 112, 71], creme: [248, 246, 239],
  salbei: [237, 241, 233], linie: [216, 223, 212], text: [43, 42, 40], grau: [92, 87, 78], hell: [140, 136, 126]
};

async function holePdfDaten() {
  const [personen, familien, familien_kinder] = await Promise.all([
    fetchAllTableRows("personen", "nachname"),
    fetchAllTableRows("familien", "id"),
    fetchAllTableRows("familien_kinder", "id")
  ]);
  return { personen, familien, familien_kinder };
}

// Das Logo der Startseite als PNG (aus dem SVG der Kopfzeile), damit es im PDF identisch aussieht.
async function pdfLogoPng() {
  try {
    const quelle = document.querySelector(".app-header__logo svg");
    if (!quelle) return null;
    let svg = new XMLSerializer().serializeToString(quelle).replace(/currentColor/g, "#174f3b");
    if (!/xmlns=/.test(svg)) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    svg = svg.replace("<svg", '<svg width="640" height="520"');
    const bild = new Image();
    await new Promise((ok, fehler) => {
      bild.onload = ok;
      bild.onerror = () => fehler(new Error("Logo konnte nicht gezeichnet werden"));
      bild.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    const leinwand = document.createElement("canvas");
    leinwand.width = 640; leinwand.height = 520;
    leinwand.getContext("2d").drawImage(bild, 0, 0, 640, 520);
    return leinwand.toDataURL("image/png");
  } catch (err) {
    debugLog(`⚠️ PDF-Logo: ${err.message || err} (PDF wird ohne Logo erstellt)`);
    return null;
  }
}

function pdfDatum(wert) {
  const m = String(wert || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

// Geboren und gestorben stehen im PDF in zwei festen Spalten (lebende Personen: nur die erste Spalte).
function pdfLebensdaten(p) {
  const geboren = pdfDatum(p.geburtsdatum) || (p.geburtsjahr ? String(p.geburtsjahr) : "");
  const gestorben = pdfDatum(p.sterbedatum) || (p.sterbejahr ? String(p.sterbejahr) : "");
  return { geboren: geboren ? `* ${geboren}` : "", gestorben: gestorben ? `\u2020 ${gestorben}` : "" };
}

function baueFamilienPdf(jsPDF, daten, logo) {
  const F = PDF_FARBEN;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const B = 210, H = 297, R = 16, INNEN = B - 2 * R, UNTEN = H - 20;
  const X_GEB = B - R - 60;    // linke Datumsspalte: geboren
  const X_TOT = B - R - 30;    // rechte Datumsspalte: gestorben
  const personen = [...daten.personen].sort(PersonSuche.sort);
  const byId = new Map(daten.personen.map((p) => [p.id, p]));
  const familien = daten.familien || [];
  const kinder = daten.familien_kinder || [];
  let y = 0;

  const setzeText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setzeFuell = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setzeLinie = (c, w) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); };

  function kopfGross() {
    setzeFuell(F.creme); doc.rect(0, 0, B, 44, "F");
    setzeFuell(F.wald); doc.rect(0, 0, B, 2.2, "F");
    setzeLinie(F.linie, 0.3); doc.line(0, 44, B, 44);
    if (logo) doc.addImage(logo, "PNG", R, 11, 25, 20.3);
    const tx = logo ? R + 31 : R;
    doc.setFont("helvetica", "bold"); doc.setFontSize(27); setzeText(F.wald);
    doc.text("Familienspuren", tx, 25);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); setzeText(F.gold);
    doc.text("Menschen. Generationen. Geschichten.", tx, 32);
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); setzeText(F.waldTief);
    doc.text("Familienübersicht", R, 59);
    const datum = new Date().toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); setzeText(F.grau);
    doc.text(`Stand: ${datum}   ·   ${personen.length} Personen   ·   ${familien.length} Familien`, R, 66);
    setzeLinie(F.gold, 0.8); doc.line(R, 70, R + 22, 70);
    y = 80;
  }

  function kopfKlein() {
    setzeFuell(F.creme); doc.rect(0, 0, B, 15, "F");
    setzeFuell(F.wald); doc.rect(0, 0, B, 1.4, "F");
    setzeLinie(F.linie, 0.3); doc.line(0, 15, B, 15);
    if (logo) doc.addImage(logo, "PNG", R, 3.6, 9.4, 7.6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); setzeText(F.wald);
    doc.text("Familienspuren", logo ? R + 12.5 : R, 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setzeText(F.gold);
    doc.text("Familienübersicht", B - R, 10, { align: "right" });
    y = 24;
  }

  function neueSeite() { doc.addPage(); kopfKlein(); }
  function platz(hoehe) { if (y + hoehe > UNTEN) neueSeite(); }

  function buchstabe(b) {
    platz(29);
    if (y > 30) y += 3;
    setzeFuell(F.wald); doc.roundedRect(R, y, 8.5, 8.5, 1.6, 1.6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); setzeText([255, 255, 255]);
    doc.text(b, R + 4.25, y + 6.3, { align: "center" });
    setzeLinie(F.linie, 0.4); doc.line(R + 11.5, y + 4.25, X_GEB - 3, y + 4.25);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setzeText(F.hell);
    doc.text("geboren", X_GEB, y + 5.6);
    doc.text("gestorben", X_TOT, y + 5.6);
    y += 12.5;
  }

  function person(p) {
    const vorname = String(p.vorname || "").trim();
    const nachname = String(p.nachname || "").trim();
    const ledig = String(p.Ledigenname || p.ledigenname || p.geburtsname || "").trim();
    let haupt = [vorname, nachname].filter(Boolean).join(" ") || (ledig ? "" : "Unbekannte Person");
    const lebens = pdfLebensdaten(p);
    const notiz = String(p.Notiz || "").replace(/\s+/g, " ").trim();
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    let notizZeilen = notiz ? doc.splitTextToSize(notiz, INNEN - 6) : [];
    if (notizZeilen.length > 3) { notizZeilen = notizZeilen.slice(0, 3); notizZeilen[2] = notizZeilen[2].replace(/\s*\S{0,3}$/, "") + " …"; }
    const hoehe = 7.2 + notizZeilen.length * 3.9 + 2;
    platz(hoehe);
    // Name (bei Platzmangel gekürzt), Mädchenname in Grau
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); setzeText(F.text);
    const maxName = INNEN - 6 - 62;
    if (doc.getTextWidth(haupt) > maxName) haupt = doc.splitTextToSize(haupt, maxName)[0].replace(/\s*\S?$/, "") + " …";
    doc.text(haupt, R + 3, y + 4.6);
    if (ledig) {
      doc.setFont("helvetica", "normal"); setzeText(F.grau);
      doc.text(`${haupt ? "   " : ""}geb. ${ledig}`, R + 3 + (haupt ? doc.getTextWidth(haupt) : 0), y + 4.6);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setzeText(F.gold);
    if (lebens.geboren) doc.text(lebens.geboren, X_GEB, y + 4.6);
    if (lebens.gestorben) doc.text(lebens.gestorben, X_TOT, y + 4.6);
    if (notizZeilen.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setzeText(F.grau);
      doc.text(notizZeilen, R + 3, y + 9.2);
    }
    y += hoehe;
    setzeLinie([232, 228, 218], 0.15); doc.line(R, y - 1.1, B - R, y - 1.1);
  }

  function abschnitt(titel) {
    platz(34);
    setzeFuell(F.salbei); doc.roundedRect(R, y, INNEN, 10.5, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); setzeText(F.waldTief);
    doc.text(titel, R + 4, y + 7.1);
    y += 16;
  }

  function name(id) {
    const p = byId.get(id);
    return p ? PersonSuche.name(p) : "(unbekannte Person)";
  }

  function familie(f) {
    const partner = [f.partner_a_id, f.partner_b_id].filter(Boolean).map(name).join("  +  ") || "Familie";
    const typ = String(f.familientyp || "Partnerschaft");
    const kids = kinder.filter((k) => k.familie_id === f.id).map((k) =>
      `${name(k.kind_id)}${k.beziehungstyp && k.beziehungstyp !== "biologisch" ? ` (${k.beziehungstyp})` : ""}`);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    const partnerZeilen = doc.splitTextToSize(partner, INNEN - 34);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const kinderZeilen = kids.length ? doc.splitTextToSize(kids.join("  ·  "), INNEN - 22) : [];
    const hoehe = 6 + (partnerZeilen.length - 1) * 4.6 + (kinderZeilen.length ? 1.2 + kinderZeilen.length * 4.2 : 0) + 3.4;
    platz(hoehe);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); setzeText(F.text);
    doc.text(partnerZeilen, R + 3, y + 4.4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setzeText(F.gold);
    doc.text(typ, B - R, y + 4.4, { align: "right" });
    let zy = y + 4.4 + (partnerZeilen.length - 1) * 4.6;
    if (kinderZeilen.length) {
      zy += 5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); setzeText(F.grau);
      doc.text("Kinder", R + 3, zy);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); setzeText(F.text);
      doc.text(kinderZeilen, R + 19, zy);
    }
    y += hoehe;
    setzeLinie([232, 228, 218], 0.15); doc.line(R, y - 1.1, B - R, y - 1.1);
  }

  kopfGross();
  let aktuell = null;
  for (const p of personen) {
    const schluessel = String(PersonSuche.sortSchluessel(p) || "").trim();
    // Ä, Ö, Ü gehören zu A, O, U (wie in der Sortierung)
    let b = schluessel ? schluessel.charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("de") : "…";
    if (!/\p{L}/u.test(b) && b !== "…") b = "#";
    if (b !== aktuell) { buchstabe(b); aktuell = b; }
    person(p);
  }
  if (familien.length) {
    y += 6;
    abschnitt("Familien und Kinder");
    const schluesselFam = (f) => PersonSuche.sortSchluessel(byId.get(f.partner_a_id) || byId.get(f.partner_b_id)) || "~";
    for (const f of [...familien].sort((x, y2) => String(schluesselFam(x)).localeCompare(String(schluesselFam(y2)), "de"))) familie(f);
  }

  // Fußzeile auf jeder Seite
  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    setzeLinie(F.linie, 0.3); doc.line(R, H - 14, B - R, H - 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); setzeText(F.hell);
    doc.text("Familienspuren  ·  Vertraulich, nur für den Familienkreis", R, H - 9);
    doc.text(`Seite ${i} von ${seiten}`, B - R, H - 9, { align: "right" });
  }
  doc.setProperties({ title: "Familienspuren – Familienübersicht", subject: "Personen und Familien", author: "Familienspuren", creator: "Familienspuren" });
  return doc;
}

document.getElementById("export-pdf-btn").addEventListener("click", async () => {
  const msg = document.getElementById("export-message");
  msg.textContent = "Erstelle PDF …";
  try {
    if (!window.jspdf) { msg.textContent = "PDF-Bibliothek konnte nicht geladen werden."; return; }
    const daten = await holePdfDaten();
    const logo = await pdfLogoPng();
    const doc = baueFamilienPdf(window.jspdf.jsPDF, daten, logo);
    const heute = new Date().toISOString().slice(0, 10);
    doc.save(`Familienspuren_Familienuebersicht_${heute}.pdf`);
    msg.textContent = `PDF heruntergeladen ✓ (${daten.personen.length} Personen, ${doc.getNumberOfPages()} Seiten)`;
  } catch (err) {
    msg.textContent = `PDF konnte nicht erstellt werden: ${err.message || err}`;
    debugLog(`❌ PDF-Export: ${err.message || err}`);
  }
});
