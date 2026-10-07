/**
 * BACKEND MONITORING & EVALUASI — Google Apps Script + Sheets.
 * BUKAN bagian dari website (tidak di-deploy ke GitHub Pages). Setup:
 * README.md "Backend Monitoring & Evaluasi" (tempel file ini ke Apps Script,
 * isi Script Properties APP_KEY, deploy sebagai Web App).
 *
 * Kontrak: POST { action, key, payload } -> { ok, data } / { ok:false, message }.
 * Auth: `key` dicocokkan dengan APP_KEY (gerbang sederhana — bukan pengganti
 * hardening Supabase; halaman frontend sudah digerbang auth sesi Supabase).
 */

const SHEET_PENILAIAN = "Penilaian";
const SHEET_EVALUASI = "Evaluasi";

// Urutan HARUS sama dengan kolom skor di sheet Penilaian (F..M) dan sinkron
// dengan SKILLS di monitoring.js/evaluasi.js.
const SKILL_COLS = {
  dribbling: "Dribbling",
  layup: "LayUp",
  shooting: "Shooting",
  passing: "Passing",
  footwork: "Footwork",
  fundamentalTeam: "FundamentalTeam",
  teamwork: "TeamWork",
  situasional: "Situasional",
};
const SKILL_KEYS = Object.keys(SKILL_COLS);

// TTL cache server-side (detik). Aman 60s karena tiap tulis selalu invalidateCache.
const CACHE_TTL_SEC = 60;

/* ------------------------------- ENTRY POINT ------------------------------- */

function doGet() {
  return jsonOut({ ok: true, data: { message: "GAS Monitoring BSA aktif. Gunakan POST." } });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return jsonOut({ ok: false, message: "Body request tidak valid (bukan JSON)." });
  }

  const action = body.action;
  const payload = body.payload || {};
  const key = body.key || "";
  const validKey = PropertiesService.getScriptProperties().getProperty("APP_KEY") || "";

  if (!validKey) {
    return jsonOut({ ok: false, message: "APP_KEY belum diatur di Script Properties. Lihat README.md bagian 'Backend Monitoring & Evaluasi'." });
  }
  if (key !== validKey) {
    return jsonOut({ ok: false, message: "Tidak diotorisasi.", code: "UNAUTHORIZED" });
  }

  // Lock: dua tulis barengan tidak saling menimpa baris.
  const lock = LockService.getScriptLock();
  const needsLock = action.indexOf("save") === 0 || action.indexOf("delete") === 0;
  try {
    if (needsLock) lock.waitLock(5000);

    let data;
    switch (action) {
      case "getPenilaianByTanggal":
        data = getPenilaianByTanggal(payload);
        break;
      case "getPenilaianBySiswaBulan":
        data = getPenilaianBySiswaBulan(payload);
        break;
      case "savePenilaian":
        data = savePenilaian(payload);
        break;
      case "deletePenilaian":
        data = deletePenilaian(payload);
        break;
      case "getRekapBulanan":
        data = getRekapBulanan(payload);
        break;
      case "getRekapEvaluasiBulanan":
        data = getRekapEvaluasiBulanan(payload);
        break;
      case "getEvaluasi":
        data = getEvaluasi(payload);
        break;
      case "getEvaluasiStatusBulanan":
        data = getEvaluasiStatusBulanan(payload);
        break;
      case "saveEvaluasi":
        data = saveEvaluasi(payload);
        break;
      default:
        throw new Error("Aksi tidak dikenali: " + action);
    }
    return jsonOut({ ok: true, data });
  } catch (err) {
    return jsonOut({ ok: false, message: err.message || "Terjadi kesalahan pada server." });
  } finally {
    if (needsLock) lock.releaseLock();
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------- HELPERS -------------------------------- */

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" tidak ditemukan. Jalankan setup di README.md bagian "Backend Monitoring & Evaluasi".');
  return sh;
}

/** Baca semua baris sheet → array {NamaKolom: nilai}, skip baris kosong.
 *  Di-cache CacheService (TTL 60s) supaya pembacaan beruntun tidak baca sheet
 *  penuh berulang-ulang (sumber utama "lemot" Apps Script + Sheets). */
function readRows(sh) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "rows:" + sh.getName();
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      /* cache korup, lanjut baca langsung dari sheet */
    }
  }

  const values = sh.getDataRange().getValues();
  const headers = values.shift() || [];
  const rows = values.filter((r) => r.some((c) => c !== "" && c !== null)).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i]));
    return o;
  });

  try {
    cache.put(cacheKey, JSON.stringify(rows), CACHE_TTL_SEC);
  } catch (e) {
    // Cache entry >100KB (sheet besar) — lewati cache, data tetap benar.
  }
  return rows;
}

/** Hapus cache baca 1 sheet — WAJIB setelah tulis (save/delete). */
function invalidateCache(sheetName) {
  CacheService.getScriptCache().remove("rows:" + sheetName);
}

/** Cari nomor baris (1-based, sesuai sheet) berdasarkan kolom ID (kolom A). */
function findRowIndexById(sh, id) {
  const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function fmtDate(d) {
  if (Object.prototype.toString.call(d) === "[object Date]") {
    return Utilities.formatDate(d, Session.getScriptTimeZone() || "Asia/Makassar", "yyyy-MM-dd");
  }
  return String(d || "").slice(0, 10);
}

function newId(prefix) {
  return prefix + "-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function clampSkor(n) {
  n = Number(n) || 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function avgSkor(skor) {
  const nums = SKILL_KEYS.map((k) => clampSkor(skor && skor[k])).filter((n) => n > 0);
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/* ------------------------------- PENILAIAN -------------------------------- */
// Kolom sheet Penilaian:
// A:ID  B:Tanggal  C:SiswaID  D:NamaSiswa  E:Kelompok
// F:Dribbling G:LayUp H:Shooting I:Passing J:Footwork
// K:FundamentalTeam L:TeamWork M:Situasional
// N:RataRata  O:Catatan  P:DicatatOleh  Q:Timestamp

function mapPenilaianRow(r) {
  const skor = {};
  SKILL_KEYS.forEach((k) => (skor[k] = clampSkor(r[SKILL_COLS[k]])));
  return {
    id: r.ID,
    tanggal: fmtDate(r.Tanggal),
    siswaId: String(r.SiswaID),
    namaSiswa: r.NamaSiswa,
    kelompok: r.Kelompok || "",
    skor,
    rataRata: Number(r.RataRata) || 0,
    catatan: r.Catatan || "",
    dicatatOleh: r.DicatatOleh || "",
  };
}

function getPenilaianByTanggal(payload) {
  const tanggal = String(payload.tanggal || "").slice(0, 10);
  if (!tanggal) throw new Error("Tanggal wajib diisi.");
  return readRows(getSheet(SHEET_PENILAIAN))
    .filter((r) => fmtDate(r.Tanggal) === tanggal)
    .map(mapPenilaianRow);
}

function getPenilaianBySiswaBulan(payload) {
  const { siswaId, bulan, tahun } = payload;
  if (!siswaId || !bulan || !tahun) throw new Error("siswaId, bulan, dan tahun wajib diisi.");
  return readRows(getSheet(SHEET_PENILAIAN))
    .filter((r) => {
      const d = fmtDate(r.Tanggal);
      if (!d) return false;
      const [y, m] = d.split("-");
      return String(r.SiswaID) === String(siswaId) && Number(m) === Number(bulan) && Number(y) === Number(tahun);
    })
    .map(mapPenilaianRow)
    .sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
}

function rowValuesFromPayload(payload, rataRata, now) {
  const skor = payload.skor || {};
  return [
    payload.tanggal,
    payload.siswaId,
    payload.namaSiswa || "",
    payload.kelompok || "",
    clampSkor(skor.dribbling),
    clampSkor(skor.layup),
    clampSkor(skor.shooting),
    clampSkor(skor.passing),
    clampSkor(skor.footwork),
    clampSkor(skor.fundamentalTeam),
    clampSkor(skor.teamwork),
    clampSkor(skor.situasional),
    rataRata,
    payload.catatan || "",
    payload.dicatatOleh || "Admin",
    now,
  ];
}

/** Upsert: 1 siswa = 1 catatan per tanggal. payload.id → update baris itu;
 *  kalau sudah ada baris (tanggal, siswaId) → ditimpa (bukan dobel).
 *  Tulis 1 batch (B..Q + Timestamp), tanpa panggilan sheet ekstra. */
function savePenilaian(payload) {
  if (!payload.tanggal || !payload.siswaId) throw new Error("Tanggal & siswa wajib diisi.");
  const today = fmtDate(new Date());
  if (String(payload.tanggal) > today) throw new Error("Tanggal latihan tidak boleh di masa depan.");

  const sh = getSheet(SHEET_PENILAIAN);
  const rataRata = avgSkor(payload.skor);
  const now = new Date();

  let id = payload.id || "";
  let rowIdx = payload.id ? findRowIndexById(sh, payload.id) : -1;
  if (rowIdx === -1) {
    const dup = readRows(sh).find((r) => fmtDate(r.Tanggal) === String(payload.tanggal).slice(0, 10) && String(r.SiswaID) === String(payload.siswaId));
    if (dup) {
      rowIdx = findRowIndexById(sh, dup.ID);
      id = dup.ID;
    }
  }

  if (rowIdx > -1) {
    sh.getRange(rowIdx, 2, 1, 16).setValues([rowValuesFromPayload(payload, rataRata, now)]);
    invalidateCache(SHEET_PENILAIAN);
    return { id, rataRata };
  }

  id = newId("PN");
  sh.appendRow([id].concat(rowValuesFromPayload(payload, rataRata, now)));
  invalidateCache(SHEET_PENILAIAN);
  return { id, rataRata };
}

function deletePenilaian(payload) {
  if (!payload.id) throw new Error("id wajib diisi.");
  const sh = getSheet(SHEET_PENILAIAN);
  const rowIdx = findRowIndexById(sh, payload.id);
  if (rowIdx === -1) throw new Error("Data penilaian tidak ditemukan (mungkin sudah dihapus).");
  sh.deleteRow(rowIdx);
  invalidateCache(SHEET_PENILAIAN);
  return { deleted: true };
}

/* ----------------------------- REKAP BULANAN ------------------------------ */

/** Gabungan getRekapBulanan + getEvaluasiStatusBulanan — 1 round-trip utk halaman Evaluasi. */
function getRekapEvaluasiBulanan(payload) {
  const rekap = getRekapBulanan(payload);
  const status = getEvaluasiStatusBulanan(payload);
  return { rekap, status };
}

function getRekapBulanan(payload) {
  const { bulan, tahun } = payload;
  if (!bulan || !tahun) throw new Error("bulan dan tahun wajib diisi.");

  const rows = readRows(getSheet(SHEET_PENILAIAN)).filter((r) => {
    const d = fmtDate(r.Tanggal);
    if (!d) return false;
    const [y, m] = d.split("-");
    return Number(m) === Number(bulan) && Number(y) === Number(tahun);
  });

  const bySiswa = {};
  rows.forEach((r) => {
    const id = String(r.SiswaID);
    if (!bySiswa[id]) {
      bySiswa[id] = { siswaId: id, namaSiswa: r.NamaSiswa, kelompok: r.Kelompok || "", jumlahSesi: 0, total: {} };
      SKILL_KEYS.forEach((k) => (bySiswa[id].total[k] = 0));
    }
    const b = bySiswa[id];
    b.jumlahSesi++;
    SKILL_KEYS.forEach((k) => (b.total[k] += clampSkor(r[SKILL_COLS[k]])));
  });

  return Object.keys(bySiswa)
    .map((id) => {
      const b = bySiswa[id];
      const rataRata = {};
      SKILL_KEYS.forEach((k) => (rataRata[k] = b.jumlahSesi ? Math.round((b.total[k] / b.jumlahSesi) * 10) / 10 : 0));
      const overall = SKILL_KEYS.reduce((a, k) => a + rataRata[k], 0) / SKILL_KEYS.length;
      return { siswaId: b.siswaId, namaSiswa: b.namaSiswa, kelompok: b.kelompok, jumlahSesi: b.jumlahSesi, rataRata, overall: Math.round(overall * 10) / 10 };
    })
    .sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, "id"));
}

/* -------------------------------- EVALUASI --------------------------------- */
// Kolom sheet Evaluasi:
// A:ID B:Bulan C:Tahun D:SiswaID E:NamaSiswa F:Kelompok G:Kelebihan
// H:Kekurangan I:Rekomendasi J:DicatatOleh K:Timestamp

function mapEvaluasiRow(r) {
  return {
    id: r.ID,
    bulan: Number(r.Bulan),
    tahun: Number(r.Tahun),
    siswaId: String(r.SiswaID),
    namaSiswa: r.NamaSiswa,
    kelompok: r.Kelompok || "",
    kelebihan: r.Kelebihan || "",
    kekurangan: r.Kekurangan || "",
    rekomendasi: r.Rekomendasi || "",
    dicatatOleh: r.DicatatOleh || "",
  };
}

function getEvaluasi(payload) {
  const { siswaId, bulan, tahun } = payload;
  if (!siswaId || !bulan || !tahun) throw new Error("siswaId, bulan, dan tahun wajib diisi.");
  const row = readRows(getSheet(SHEET_EVALUASI)).find((r) => String(r.SiswaID) === String(siswaId) && Number(r.Bulan) === Number(bulan) && Number(r.Tahun) === Number(tahun));
  return row ? mapEvaluasiRow(row) : null;
}

/** Batch getEvaluasi: 1 pembacaan sheet utk SEMUA siswa (badge Sudah/Belum di tabel). */
function getEvaluasiStatusBulanan(payload) {
  const { bulan, tahun } = payload;
  if (!bulan || !tahun) throw new Error("bulan dan tahun wajib diisi.");
  const rows = readRows(getSheet(SHEET_EVALUASI)).filter((r) => Number(r.Bulan) === Number(bulan) && Number(r.Tahun) === Number(tahun));
  const map = {};
  rows.forEach((r) => (map[String(r.SiswaID)] = true));
  return map;
}

function saveEvaluasi(payload) {
  const { siswaId, bulan, tahun } = payload;
  if (!siswaId || !bulan || !tahun) throw new Error("siswaId, bulan, dan tahun wajib diisi.");

  const sh = getSheet(SHEET_EVALUASI);
  const now = new Date();
  const existing = readRows(sh).find((r) => String(r.SiswaID) === String(siswaId) && Number(r.Bulan) === Number(bulan) && Number(r.Tahun) === Number(tahun));

  const values = [
    bulan,
    tahun,
    siswaId,
    payload.namaSiswa || "",
    payload.kelompok || "",
    payload.kelebihan || "",
    payload.kekurangan || "",
    payload.rekomendasi || "",
    payload.dicatatOleh || "Admin",
    now,
  ];

  if (existing) {
    const rowIdx = findRowIndexById(sh, existing.ID);
    sh.getRange(rowIdx, 2, 1, 10).setValues([values]);
    invalidateCache(SHEET_EVALUASI);
    return { id: existing.ID };
  }

  const id = newId("EV");
  sh.appendRow([id].concat(values));
  invalidateCache(SHEET_EVALUASI);
  return { id };
}
