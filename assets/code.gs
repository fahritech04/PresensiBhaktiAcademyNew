// ============================================================================
// KONFIGURASI
// ============================================================================
const CONFIG = {
  SHEET_SISWA: "Siswa",
  SHEET_PRESENSI: "Presensi",
  SHEET_ADMIN: "Admin",
  SHEET_JADWAL: "Jadwal",
  SHEET_IURAN: "Iuran",
  SESSION_HOURS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MINUTES: 15,
  TOLERANSI_DEFAULT_MENIT: 15,
  PASSWORD_PEPPER: "bsa-2026-kotabaru", // boleh diganti, tidak wajib
  BARCODE_PREFIX: "BSA-",
  IURAN_NOMINAL_DEFAULT: 50000, // nominal default iuran bulanan, boleh diganti sesuai akademi
  DATE_CACHE_SECONDS: 21600, // hanya konversi tanggal, bukan data spreadsheet/sesi

  // PERFORMANCE V2 — cache lintas-request untuk data yang relatif stabil.
  CACHE_SECONDS: {
    SISWA: 60,
    JADWAL: 300,
    IURAN: 30,
    KELOMPOK: 300,
    DASHBOARD: 15,
    SESSION: 300,
    BARCODE: 60
  },
  CACHE_MAX_ROWS: 5000
};

const BULAN_LIST = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const HARI_LIST = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

let requestContext_ = null;

// ============================================================================
// ENTRY POINT
// ============================================================================
function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  // Memudahkan cek cepat lewat browser bahwa Web App sudah aktif.
  if (e && e.parameter && e.parameter.action) return handleRequest(e, true);
  return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "Bhakti Sebatung Academy API is running." })).setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(e, isGet) {
  requestContext_ = {
    spreadsheet: null,
    sheets: Object.create(null),
    data: Object.create(null),
    timezone: null,
    dates: null,
    dateCache: null,
    datesChanged: false
  };
  let action = "",
    payload = {},
    token = null;
  try {
    if (isGet) {
      action = e.parameter.action;
      payload = JSON.parse(e.parameter.payload || "{}");
      token = e.parameter.token || null;
    } else {
      const body = JSON.parse(e.postData.contents || "{}");
      action = body.action;
      payload = body.payload || {};
      token = body.token || null;
    }

    const PUBLIC_ACTIONS = ["login"];
    let session = null;
    if (!PUBLIC_ACTIONS.includes(action)) {
      session = verifyToken(token);
      if (!session) return jsonError("Sesi berakhir, silakan login kembali.", "AUTH_EXPIRED");
    }

    const MUTATING_ACTIONS = new Set([
      "addSiswa",
      "updateSiswa",
      "deleteSiswa",
      "scanPresensi",
      "tandaiIuran",
      "batalkanIuran",
      "updateIuran"
    ]);

    let lock = null;

    if (MUTATING_ACTIONS.has(action)) {
      lock = LockService.getScriptLock();
      lock.waitLock(10000);
    }

    try {
      const result = routeAction(action, payload, session);
      return jsonSuccess(result);
    } finally {
      if (lock) lock.releaseLock();
    }
  } catch (err) {
    return jsonError(err && err.message ? err.message : "Terjadi kesalahan tak terduga.");
  } finally {
    saveDateCache_();
    requestContext_ = null;
  }
}

function routeAction(action, payload, session) {
  switch (action) {
    case "login":
      return actionLogin(payload);
    case "getDashboardStats":
      return actionGetDashboardStats();
    case "getSiswaList":
      return actionGetSiswaList();
    case "addSiswa":
      return actionAddSiswa(payload);
    case "updateSiswa":
      return actionUpdateSiswa(payload);
    case "deleteSiswa":
      return actionDeleteSiswa(payload);
    case "getKelompokList":
      return actionGetKelompokList();
    case "scanPresensi":
      return actionscanPresensi(payload);
    case "getPresensiList":
      return actionGetPresensiList(payload);
    case "getIuranBulan":
      return actionGetIuranBulan(payload);
    case "tandaiIuran":
      return actionTandaiIuran(payload, session);
    case "batalkanIuran":
      return actionBatalkanIuran(payload);
    case "updateIuran":
      return actionUpdateIuran(payload);
    case "getRiwayatIuranSiswa":
      return actionGetRiwayatIuranSiswa(payload);
    default:
      throw new Error("Aksi tidak dikenali: " + action);
  }
}

function jsonSuccess(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data })).setMimeType(ContentService.MimeType.JSON);
}
function jsonError(message, code) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, message, code: code || "ERROR" })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// SETUP AWAL (jalankan manual sekali dari editor Apps Script)
// ============================================================================
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet_(ss, CONFIG.SHEET_SISWA, ["ID", "Barcode", "Nama", "TanggalLahir", "Kelompok", "NamaOrtu", "HPOrtu", "TanggalDaftar", "Status"]);
  ensureSheet_(ss, CONFIG.SHEET_PRESENSI, ["ID", "SiswaID", "Barcode", "Nama", "Kelompok", "Waktu", "Status", "Keterangan"]);
  ensureSheet_(ss, CONFIG.SHEET_JADWAL, ["Kelompok", "Hari", "JamMulai", "JamSelesai", "ToleransiMenit"]);
  ensureSheet_(ss, CONFIG.SHEET_IURAN, ["ID", "SiswaID", "Bulan", "Tahun", "Nominal", "Status", "TanggalBayar", "Keterangan", "DicatatOleh"]);
  const adminSheet = ensureSheet_(ss, CONFIG.SHEET_ADMIN, ["Username", "PasswordHash", "Nama", "Role", "Status"]);

  if (adminSheet.getLastRow() < 2) {
    adminSheet.appendRow(["admin", hashPassword_("admin123"), "Admin Academy", "Pengurus", "Aktif"]);
    Logger.log("Akun admin default dibuat -> username: admin | password: admin123. SEGERA GANTI setelah login pertama.");
  }

  invalidateAllDataCaches_();
  Logger.log("Setup selesai. Sheet Siswa/Presensi/Jadwal/Admin sudah siap.");
}

/** Reset akun admin ke default: admin / admin123 */
function resetAdmin() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const adminSheet = ss.getSheetByName(CONFIG.SHEET_ADMIN);
  if (!adminSheet) throw new Error("Sheet Admin tidak ditemukan. Jalankan setupSpreadsheet dahulu.");

  // Timpa baris pertama data (baris 2) dengan kredensial default
  adminSheet.getRange(2, 1, 1, 5).setValues([["admin", hashPassword_("admin123"), "Admin Academy", "Pengurus", "Aktif"]]);

  // Clear lockout jika ada
  clearLoginAttempts_("admin");

  Logger.log("Reset Berhasil -> username: admin | password: admin123");
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#12161D").setFontColor("#F6F3EA");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============================================================================
// AUTH
// ============================================================================
function hashPassword_(password) {
  const raw = password + ":" + CONFIG.PASSWORD_PEPPER;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map((b) => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function actionLogin(payload) {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  if (!username || !password) throw new Error("Username dan password wajib diisi.");

  const attemptKey = username.toLowerCase();
  const lockMessage = getLoginLockMessage_(attemptKey);
  if (lockMessage) throw new Error(lockMessage);

  const rows = sheetToObjects_(CONFIG.SHEET_ADMIN);
  const admin = rows.find((r) => String(r.Username).toLowerCase() === attemptKey);
  if (!admin) {
    registerFailedLogin_(attemptKey);
    throw new Error("Username atau password salah.");
  }
  if (String(admin.Status) !== "Aktif") throw new Error("Akun ini tidak aktif. Hubungi pengurus utama.");
  if (admin.PasswordHash !== hashPassword_(password)) {
    registerFailedLogin_(attemptKey);
    throw new Error("Username atau password salah.");
  }

  clearLoginAttempts_(attemptKey);
  const token = Utilities.getUuid();
  saveSession_(token, { username: admin.Username, nama: admin.Nama, role: admin.Role });

  return { token, username: admin.Username, nama: admin.Nama, role: admin.Role };
}

/**
 * Proteksi brute-force: setelah CONFIG.MAX_LOGIN_ATTEMPTS kali gagal berturut-turut
 * untuk 1 username, kunci sementara selama CONFIG.LOGIN_LOCKOUT_MINUTES menit.
 * Ini pertahanan yang SESUNGGUHNYA — bukan menyembunyikan URL, yang memang tidak
 * mungkin dan tidak perlu disembunyikan pada aplikasi client-side.
 */
function getLoginLockMessage_(key) {
  const store = PropertiesService.getScriptProperties();
  const attempts = JSON.parse(store.getProperty("LOGIN_ATTEMPTS") || "{}");
  const entry = attempts[key];
  if (entry && entry.lockedUntil && entry.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.`;
  }
  return null;
}

function registerFailedLogin_(key) {
  const store = PropertiesService.getScriptProperties();
  const attempts = JSON.parse(store.getProperty("LOGIN_ATTEMPTS") || "{}");
  const now = Date.now();
  const windowMs = CONFIG.LOGIN_LOCKOUT_MINUTES * 60000;
  const entry = attempts[key] && now - attempts[key].windowStart < windowMs ? attempts[key] : { count: 0, windowStart: now };

  entry.count += 1;
  if (entry.count >= CONFIG.MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + windowMs;
    entry.count = 0;
    entry.windowStart = now;
  }

  attempts[key] = entry;
  cleanupLoginAttempts_(attempts, windowMs);
  store.setProperty("LOGIN_ATTEMPTS", JSON.stringify(attempts));
}

function clearLoginAttempts_(key) {
  const store = PropertiesService.getScriptProperties();
  const attempts = JSON.parse(store.getProperty("LOGIN_ATTEMPTS") || "{}");
  delete attempts[key];
  store.setProperty("LOGIN_ATTEMPTS", JSON.stringify(attempts));
}

function cleanupLoginAttempts_(attempts, windowMs) {
  const now = Date.now();
  Object.keys(attempts).forEach((k) => {
    const e = attempts[k];
    const stillLocked = e.lockedUntil && e.lockedUntil > now;
    const withinWindow = now - e.windowStart < windowMs;
    if (!stillLocked && !withinWindow) delete attempts[k];
  });
}

function saveSession_(token, sessionData) {
  const store = PropertiesService.getScriptProperties();
  const sessions = JSON.parse(store.getProperty("SESSIONS") || "{}");
  sessions[token] = { ...sessionData, exp: Date.now() + CONFIG.SESSION_HOURS * 3600 * 1000 };
  cleanupSessions_(sessions);
  store.setProperty("SESSIONS", JSON.stringify(sessions));
  cachePutJson_(sessionCacheKey_(token), sessions[token], CONFIG.CACHE_SECONDS.SESSION);
}

function cleanupSessions_(sessions) {
  const now = Date.now();
  Object.keys(sessions).forEach((t) => {
    if (sessions[t].exp < now) delete sessions[t];
  });
}

function verifyToken(token) {
  if (!token) return null;

  const key = sessionCacheKey_(token);
  const cached = cacheGetJson_(key);
  if (cached && cached.exp >= Date.now()) return cached;

  const store = PropertiesService.getScriptProperties();
  const sessions = JSON.parse(store.getProperty("SESSIONS") || "{}");
  const session = sessions[token];

  if (!session || session.exp < Date.now()) {
    clearSessionCache_(token);
    return null;
  }

  const ttl = Math.min(
    CONFIG.CACHE_SECONDS.SESSION,
    Math.max(1, Math.floor((session.exp - Date.now()) / 1000))
  );

  cachePutJson_(key, session, ttl);
  return session;
}

// ============================================================================
// HELPER SHEET <-> OBJECT
// ============================================================================
// ============================================================================
// PERFORMANCE V2 — CACHE / INVALIDATION
// ============================================================================

const CACHE_NS_ = "bsa:v2:";

function scriptCache_() {
  return CacheService.getScriptCache();
}

function cacheGetJson_(key) {
  try {
    const raw = scriptCache_().get(CACHE_NS_ + key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function cachePutJson_(key, value, seconds) {
  try {
    const raw = JSON.stringify(value);
    // Avoid CacheService per-entry size limits.
    if (raw.length > 95000) return false;
    scriptCache_().put(CACHE_NS_ + key, raw, seconds);
    return true;
  } catch (err) {
    return false;
  }
}

function cacheRemove_(key) {
  try { scriptCache_().remove(CACHE_NS_ + key); } catch (err) {}
}

function invalidateDataCache_(names) {
  const list = Array.isArray(names) ? names : [names];

  list.forEach((name) => {
    cacheRemove_("objects:" + name);
    cacheRemove_("sheet:" + name);
  });

  if (list.some((name) => [
    CONFIG.SHEET_SISWA,
    CONFIG.SHEET_JADWAL,
    CONFIG.SHEET_PRESENSI,
    CONFIG.SHEET_IURAN
  ].includes(name))) {
    cacheRemove_("dashboard");
  }

  if (list.includes(CONFIG.SHEET_SISWA) || list.includes(CONFIG.SHEET_JADWAL)) {
    cacheRemove_("kelompok");
  }

  if (list.includes(CONFIG.SHEET_SISWA)) cacheRemove_("barcode");
}

function invalidateAllDataCaches_() {
  [
    CONFIG.SHEET_SISWA,
    CONFIG.SHEET_PRESENSI,
    CONFIG.SHEET_JADWAL,
    CONFIG.SHEET_IURAN,
    CONFIG.SHEET_ADMIN
  ].forEach((name) => {
    cacheRemove_("objects:" + name);
    cacheRemove_("sheet:" + name);
  });

  ["dashboard", "kelompok", "barcode"].forEach(cacheRemove_);
}

function sessionCacheKey_(token) {
  return "session:" + String(token || "");
}

function clearSessionCache_(token) {
  if (token) cacheRemove_(sessionCacheKey_(token));
}

// Cache-aware sheet -> objects.
// Cross-request caching is limited to manageable datasets; request-local
// caching remains active for all datasets.
function sheetToObjects_(name) {
  const context = requestContext_;
  const localKey = "objects:" + name;

  if (context && context.data[localKey]) return context.data[localKey];

  const sheet = getSheet_(name);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    if (context) context.data[localKey] = [];
    return [];
  }

  const rowCount = lastRow - 1;
  let result = null;

  if (rowCount <= CONFIG.CACHE_MAX_ROWS) {
    result = cacheGetJson_(localKey);
  }

  if (!Array.isArray(result)) {
    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0];

    result = values.slice(1)
      .map((row, idx) => {
        const obj = { _row: idx + 2 };
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      })
      .filter((obj) => headers.some((h) => obj[h] !== "" && obj[h] !== null));

    let ttl = 0;
    if (name === CONFIG.SHEET_SISWA) ttl = CONFIG.CACHE_SECONDS.SISWA;
    else if (name === CONFIG.SHEET_JADWAL) ttl = CONFIG.CACHE_SECONDS.JADWAL;
    else if (name === CONFIG.SHEET_IURAN) ttl = CONFIG.CACHE_SECONDS.IURAN;

    if (ttl) cachePutJson_(localKey, result, ttl);
  }

  if (context) context.data[localKey] = result;
  return result;
}

// ============================================================================
// END PERFORMANCE V2 CACHE HELPERS
// ============================================================================

function getSheet_(name) {
  if (requestContext_ && requestContext_.sheets[name]) return requestContext_.sheets[name];
  const ss = requestContext_
    ? (requestContext_.spreadsheet || (requestContext_.spreadsheet = SpreadsheetApp.getActiveSpreadsheet()))
    : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" tidak ditemukan. Jalankan setupSpreadsheet() dahulu.');
  if (requestContext_) requestContext_.sheets[name] = sheet;
  return sheet;
}

function updateRowCells_(sheet, row, updates) {
  const cacheKey = "headers:" + sheet.getName();
  let headers = requestContext_ && requestContext_.data[cacheKey];

  if (!headers) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (requestContext_) requestContext_.data[cacheKey] = headers;
  }

  const cells = [];
  try {
    updates.forEach(([name, getValue]) => {
      const value = getValue();
      const col = headers.indexOf(name) + 1;
      if (col > 0) cells.push({ col, value });
    });
  } finally {
    // Keep earlier edits if a later field conversion fails, as before batching.
    cells.sort((a, b) => a.col - b.col);
    // Batch only adjacent changed columns; never overwrite intervening formulas/data.
    for (let i = 0; i < cells.length;) {
      const start = cells[i].col;
      const values = [cells[i++].value];
      while (i < cells.length && cells[i].col === start + values.length) values.push(cells[i++].value);
      sheet.getRange(row, start, 1, values.length).setValues([values]);
    }
  }
}

function nextSequenceId_(prefix) {
  return prefix + Utilities.getUuid().split("-")[0];
}

// ============================================================================
// SISWA — CRUD
// ============================================================================
function actionGetSiswaList() {
  const siswa = sheetToObjects_(CONFIG.SHEET_SISWA).map(mapSiswaOut_);
  const kelompokSet = new Set(siswa.map((s) => s.kelompok).filter(Boolean));
  getJadwalKelompok_().forEach((k) => kelompokSet.add(k));
  return { siswa, kelompok: Array.from(kelompokSet).sort() };
}

function mapSiswaOut_(r) {
  return {
    id: r.ID,
    barcode: r.Barcode,
    nama: r.Nama,
    tanggalLahir: r.TanggalLahir ? formatDateISO_(r.TanggalLahir) : "",
    kelompok: r.Kelompok,
    namaOrtu: r.NamaOrtu,
    hpOrtu: normalizeHP_(r.HPOrtu),
    tanggalDaftar: r.TanggalDaftar ? formatDateISO_(r.TanggalDaftar) : "",
    status: r.Status || "Aktif",
  };
}

function generateBarcodeCode_(sheet) {
  const localKey = "barcode";
  let codes = requestContext_ && requestContext_.data[localKey];

  if (!codes) {
    codes = cacheGetJson_("barcode");

    if (!Array.isArray(codes)) {
      const lastRow = sheet.getLastRow();
      codes = lastRow >= 2
        ? sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat().map(String)
        : [];

      if (codes.length <= CONFIG.CACHE_MAX_ROWS) {
        cachePutJson_("barcode", codes, CONFIG.CACHE_SECONDS.BARCODE);
      }
    }

    if (requestContext_) requestContext_.data[localKey] = codes;
  }

  let maxNum = 0;

  codes.forEach((c) => {
    const m = String(c).match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });

  return CONFIG.BARCODE_PREFIX + String(maxNum + 1).padStart(4, "0");
}

/** Ambil timezone dari payload client, fallback ke timezone spreadsheet. */
function getClientTz_(payload) {
  return (payload && payload.clientTz) || Session.getScriptTimeZone();
}

/** Format timestamp sekarang sebagai string ISO lokal dengan offset timezone. */
function nowLocalStr_(payload) {
  return Utilities.formatDate(new Date(), getClientTz_(payload), "yyyy-MM-dd'T'HH:mm:ssZ");
}

function actionAddSiswa(payload) {
  const nama = String(payload.nama || "").trim();
  const kelompok = String(payload.kelompok || "").trim();
  // if (!nama || !kelompok) throw new Error("Nama dan kelompok wajib diisi."); // Kelompok sementara dinonaktifkan
  if (!nama) throw new Error("Nama wajib diisi.");

  const sheet = getSheet_(CONFIG.SHEET_SISWA);
  const id = nextSequenceId_("SIS-");
  const barcode = generateBarcodeCode_(sheet);
  const nowStr = nowLocalStr_(payload);

  const hpNormal = normalizeHP_(payload.hpOrtu);
  sheet.appendRow([id, barcode, nama, payload.tanggalLahir || "", kelompok, payload.namaOrtu || "", hpNormal, nowStr, payload.status || "Aktif"]);
  invalidateDataCache_([CONFIG.SHEET_SISWA]);

  return { id, barcode };
}

function actionUpdateSiswa(payload) {
  const id = payload.id;
  if (!id) throw new Error("ID siswa tidak ditemukan.");
  const sheet = getSheet_(CONFIG.SHEET_SISWA);
  const row = findRowById_(sheet, id);
  if (!row) throw new Error("Data siswa tidak ditemukan.");

  updateRowCells_(sheet, row, [
    ["Nama", () => String(payload.nama || "").trim()],
    ["Kelompok", () => String(payload.kelompok || "").trim()],
    ["TanggalLahir", () => payload.tanggalLahir || ""],
    ["NamaOrtu", () => payload.namaOrtu || ""],
    ["HPOrtu", () => normalizeHP_(payload.hpOrtu)],
    ["Status", () => payload.status || "Aktif"],
  ]);

  invalidateDataCache_([CONFIG.SHEET_SISWA]);
  return { id };
}

function actionDeleteSiswa(payload) {
  const id = payload.id;
  if (!id) throw new Error("ID siswa tidak ditemukan.");
  const sheet = getSheet_(CONFIG.SHEET_SISWA);
  const row = findRowById_(sheet, id);
  if (!row) throw new Error("Data siswa tidak ditemukan.");
  sheet.deleteRow(row);
  invalidateDataCache_([CONFIG.SHEET_SISWA]);
  return { id };
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const cell = sheet.getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .matchCase(true)
    .findNext();

  return cell ? cell.getRow() : null;
}

function findSiswaByBarcode_(barcode) {
  const sheet = getSheet_(CONFIG.SHEET_SISWA);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const cell = sheet.getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(String(barcode).trim())
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  if (!cell) return null;

  const row = sheet.getRange(cell.getRow(), 1, 1, 9).getValues()[0];

  return {
    _row: cell.getRow(),
    ID: row[0],
    Barcode: row[1],
    Nama: row[2],
    TanggalLahir: row[3],
    Kelompok: row[4],
    NamaOrtu: row[5],
    HPOrtu: row[6],
    TanggalDaftar: row[7],
    Status: row[8]
  };
}

// ============================================================================
// IURAN BULANAN — CRUD
// ============================================================================
/**
 * Filosofi data: TIDAK ADA baris di sheet Iuran untuk kombinasi siswa+bulan+tahun
 * tertentu berarti "Belum Bayar". Baris baru hanya dibuat saat admin menandai
 * "Lunas" lewat halaman web. Ini menghindari harus generate ribuan baris kosong
 * di muka untuk tiap siswa x tiap bulan.
 */
function findIuranRow_(sheet, siswaId, bulan, tahun) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const matches = sheet.getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(String(siswaId))
    .matchEntireCell(true)
    .matchCase(true)
    .findAll();

  for (const cell of matches) {
    const row = cell.getRow();
    const values = sheet.getRange(row, 2, 1, 3).getValues()[0];

    if (
      String(values[0]) === String(siswaId) &&
      Number(values[1]) === Number(bulan) &&
      Number(values[2]) === Number(tahun)
    ) {
      return row;
    }
  }

  return null;
}

/** Ringkasan status iuran seluruh siswa aktif untuk 1 bulan+tahun tertentu. */
function actionGetIuranBulan(payload, siswaRows) {
  const now = new Date();
  const bulan = Number(payload.bulan) || now.getMonth() + 1;
  const tahun = Number(payload.tahun) || now.getFullYear();
  if (bulan < 1 || bulan > 12) throw new Error("Bulan tidak valid.");

  let siswa = (siswaRows || sheetToObjects_(CONFIG.SHEET_SISWA)).filter((s) => String(s.Status) === "Aktif");
  if (payload.kelompok) siswa = siswa.filter((s) => s.Kelompok === payload.kelompok);

  const iuranBySiswa = {};
  sheetToObjects_(CONFIG.SHEET_IURAN)
    .filter((r) => Number(r.Bulan) === bulan && Number(r.Tahun) === tahun)
    .forEach((r) => (iuranBySiswa[String(r.SiswaID)] = r));

  const rows = siswa
    .map((s) => {
      const rec = iuranBySiswa[String(s.ID)];
      return {
        siswaId: s.ID,
        nama: s.Nama,
        kelompok: s.Kelompok,
        status: rec ? "Lunas" : "Belum Bayar",
        nominal: rec ? Number(rec.Nominal) : null,
        tanggalBayar: rec && rec.TanggalBayar ? formatDateISO_(rec.TanggalBayar) : null,
        keterangan: rec ? rec.Keterangan || "" : "",
        iuranId: rec ? rec.ID : null,
      };
    })
    .sort((a, b) => String(a.nama).localeCompare(String(b.nama)));

  const totalSiswa = rows.length;
  const totalLunas = rows.filter((r) => r.status === "Lunas").length;
  const totalBelum = totalSiswa - totalLunas;
  const totalTerkumpul = rows.reduce((sum, r) => sum + (r.nominal || 0), 0);

  return {
    rows,
    bulan,
    tahun,
    namaBulan: BULAN_LIST[bulan],
    totalSiswa,
    totalLunas,
    totalBelum,
    totalTerkumpul,
    nominalDefault: CONFIG.IURAN_NOMINAL_DEFAULT,
  };
}

/** Tandai (atau perbarui) status Lunas untuk siswa pada 1 bulan+tahun. */
function actionTandaiIuran(payload, session) {
  const siswaId = payload.siswaId;
  const bulan = Number(payload.bulan);
  const tahun = Number(payload.tahun);
  if (!siswaId) throw new Error("Siswa wajib dipilih.");
  if (!bulan || bulan < 1 || bulan > 12) throw new Error("Bulan tidak valid.");
  if (!tahun || tahun < 2000) throw new Error("Tahun tidak valid.");

  const siswaAda = sheetToObjects_(CONFIG.SHEET_SISWA).some((r) => String(r.ID) === String(siswaId));
  if (!siswaAda) throw new Error("Data siswa tidak ditemukan.");

  const nominal = payload.nominal !== undefined && payload.nominal !== "" ? Number(payload.nominal) : CONFIG.IURAN_NOMINAL_DEFAULT;
  if (isNaN(nominal) || nominal < 0) throw new Error("Nominal tidak valid.");
  const tanggalBayar = payload.tanggalBayar || formatDateISO_(new Date());
  const keterangan = String(payload.keterangan || "").trim();
  const dicatatOleh = (session && session.nama) || "";

  const sheet = getSheet_(CONFIG.SHEET_IURAN);
  const existingRow = findIuranRow_(sheet, siswaId, bulan, tahun);

  if (existingRow) {
    updateRowCells_(sheet, existingRow, [
      ["Nominal", () => nominal],
      ["Status", () => "Lunas"],
      ["TanggalBayar", () => tanggalBayar],
      ["Keterangan", () => keterangan],
      ["DicatatOleh", () => dicatatOleh],
    ]);
    invalidateDataCache_([CONFIG.SHEET_IURAN]);
    return { updated: true };
  }

  const id = nextSequenceId_("IUR-");
  sheet.appendRow([id, siswaId, bulan, tahun, nominal, "Lunas", tanggalBayar, keterangan, dicatatOleh]);
  invalidateDataCache_([CONFIG.SHEET_IURAN]);
  return { id };
}

/** Batalkan status Lunas (hapus baris) -> siswa otomatis kembali "Belum Bayar". */
function actionBatalkanIuran(payload) {
  const siswaId = payload.siswaId;
  const bulan = Number(payload.bulan);
  const tahun = Number(payload.tahun);
  if (!siswaId || !bulan || !tahun) throw new Error("Data tidak lengkap.");

  const sheet = getSheet_(CONFIG.SHEET_IURAN);
  const row = findIuranRow_(sheet, siswaId, bulan, tahun);
  if (!row) throw new Error("Belum ada catatan pembayaran untuk bulan ini.");
  sheet.deleteRow(row);
  invalidateDataCache_([CONFIG.SHEET_IURAN]);
  return { ok: true };
}

/** Edit detail 1 catatan pembayaran (nominal/tanggal/keterangan) berdasarkan ID. */
function actionUpdateIuran(payload) {
  const id = payload.id;
  if (!id) throw new Error("ID pembayaran tidak ditemukan.");
  const sheet = getSheet_(CONFIG.SHEET_IURAN);
  const row = findRowById_(sheet, id);
  if (!row) throw new Error("Data pembayaran tidak ditemukan.");

  const updates = [];

  if (payload.nominal !== undefined && payload.nominal !== "") {
    const nominal = Number(payload.nominal);
    if (isNaN(nominal) || nominal < 0) throw new Error("Nominal tidak valid.");
    updates.push(["Nominal", () => nominal]);
  }
  if (payload.tanggalBayar) updates.push(["TanggalBayar", () => payload.tanggalBayar]);
  if (payload.keterangan !== undefined) updates.push(["Keterangan", () => String(payload.keterangan).trim()]);
  updateRowCells_(sheet, row, updates);

  invalidateDataCache_([CONFIG.SHEET_IURAN]);
  return { id };
}

/** Riwayat pembayaran iuran 1 siswa di semua bulan/tahun, terbaru dahulu. */
function actionGetRiwayatIuranSiswa(payload) {
  const siswaId = payload.siswaId;
  if (!siswaId) throw new Error("ID siswa wajib diisi.");

  const rows = sheetToObjects_(CONFIG.SHEET_IURAN)
    .filter((r) => String(r.SiswaID) === String(siswaId))
    .map((r) => ({
      id: r.ID,
      bulan: Number(r.Bulan),
      tahun: Number(r.Tahun),
      namaBulan: BULAN_LIST[Number(r.Bulan)] || "-",
      nominal: Number(r.Nominal),
      status: r.Status,
      tanggalBayar: r.TanggalBayar ? formatDateISO_(r.TanggalBayar) : "",
      keterangan: r.Keterangan || "",
    }))
    .sort((a, b) => b.tahun - a.tahun || b.bulan - a.bulan);

  return { rows };
}

// ============================================================================
// JADWAL / KELOMPOK
// ============================================================================
function getJadwalKelompok_() {
  const localKey = "kelompok-jadwal";

  if (requestContext_ && requestContext_.data[localKey]) {
    return requestContext_.data[localKey];
  }

  const cached = cacheGetJson_("kelompok");
  if (Array.isArray(cached)) {
    if (requestContext_) requestContext_.data[localKey] = cached;
    return cached;
  }

  const rows = sheetToObjects_(CONFIG.SHEET_JADWAL);
  const result = Array.from(new Set(rows.map((r) => r.Kelompok).filter(Boolean)));

  cachePutJson_("kelompok", result, CONFIG.CACHE_SECONDS.KELOMPOK);

  if (requestContext_) requestContext_.data[localKey] = result;
  return result;
}

function actionGetKelompokList() {
  const cached = cacheGetJson_("kelompok");
  if (Array.isArray(cached)) return { kelompok: cached.slice().sort() };

  const siswa = sheetToObjects_(CONFIG.SHEET_SISWA);
  const set = new Set(siswa.map((s) => s.Kelompok).filter(Boolean));
  getJadwalKelompok_().forEach((k) => set.add(k));

  const kelompok = Array.from(set).sort();

  cachePutJson_("kelompok", kelompok, CONFIG.CACHE_SECONDS.KELOMPOK);
  if (requestContext_) requestContext_.data["kelompok-jadwal"] = kelompok;

  return { kelompok };
}

/** Mencari jadwal kelompok pada hari tertentu (nama hari Bahasa Indonesia). */
function findJadwal_(kelompok, hariNama) {
  const rows = sheetToObjects_(CONFIG.SHEET_JADWAL);
  const k = String(kelompok).trim().toLowerCase();
  const h = String(hariNama).trim().toLowerCase();

  return rows.find((r) =>
    String(r.Kelompok).trim().toLowerCase() === k &&
    String(r.Hari).trim().toLowerCase() === h
  );
}

/**
 * Menentukan status Hadir/Telat berdasarkan jadwal kelompok hari ini.
 * Jika tidak ada jadwal terdaftar untuk kelompok & hari tsb, selalu "Hadir".
 */
function determineStatus_(kelompok, waktuScan) {
  const hariNama = HARI_LIST[waktuScan.getDay()];
  const jadwal = findJadwal_(kelompok, hariNama);
  if (!jadwal || !jadwal.JamMulai) return "Hadir";

  const [jam, menit] = String(jadwal.JamMulai).split(":").map(Number);
  if (isNaN(jam)) return "Hadir";

  const batas = new Date(waktuScan);
  batas.setHours(jam, menit || 0, 0, 0);
  const toleransi = Number(jadwal.ToleransiMenit) || CONFIG.TOLERANSI_DEFAULT_MENIT;
  batas.setMinutes(batas.getMinutes() + toleransi);

  return waktuScan > batas ? "Telat" : "Hadir";
}

// ============================================================================
// SCAN PRESENSI
// ============================================================================
function actionscanPresensi(payload) {
  const barcode = String(payload.barcode || "").trim();
  if (!barcode) throw new Error("Kode QR kosong.");

  const siswa = findSiswaByBarcode_(barcode);
  if (!siswa) throw new Error("Kode QR tidak terdaftar. Periksa kembali kartu siswa.");
  if (String(siswa.Status) !== "Aktif") throw new Error(siswa.Nama + " berstatus nonaktif, tidak bisa Presensi.");

  const now = new Date();
  const sudah = sudahPresensiHariIni_(siswa.ID, now);
  if (sudah) {
    throw new Error(siswa.Nama + " sudah tercatat hadir hari ini pukul " + Utilities.formatDate(new Date(sudah.Waktu), Session.getScriptTimeZone(), "HH:mm") + ".");
  }

  const status = determineStatus_(siswa.Kelompok, now);
  const presensiSheet = getSheet_(CONFIG.SHEET_PRESENSI);
  const id = nextSequenceId_("ABS-");
  const nowStr = nowLocalStr_(payload);
  presensiSheet.appendRow([id, siswa.ID, siswa.Barcode, siswa.Nama, siswa.Kelompok, nowStr, status, ""]);
  invalidateDataCache_([CONFIG.SHEET_PRESENSI]);

  return { id, nama: siswa.Nama, kelompok: siswa.Kelompok, waktu: now.toISOString(), status };
}

function sudahPresensiHariIni_(siswaId, now) {
  const sheet = getSheet_(CONFIG.SHEET_PRESENSI);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const todayStr = formatDateISO_(now);

  const matches = sheet.getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(String(siswaId))
    .matchEntireCell(true)
    .matchCase(true)
    .findAll();

  for (const cell of matches) {
    const row = cell.getRow();
    const waktu = sheet.getRange(row, 6).getValue();

    if (waktu && formatDateISO_(new Date(waktu)) === todayStr) {
      return { Waktu: waktu };
    }
  }

  return null;
}

// ============================================================================
// RIWAYAT PRESENSI & DASHBOARD
// ============================================================================
function actionGetPresensiList(payload) {
  let rows = sheetToObjects_(CONFIG.SHEET_PRESENSI);

  if (payload.tanggal) {
    rows = rows.filter((r) => formatDateISO_(new Date(r.Waktu)) === payload.tanggal);
  } else {
    if (payload.dari) rows = rows.filter((r) => formatDateISO_(new Date(r.Waktu)) >= payload.dari);
    if (payload.sampai) rows = rows.filter((r) => formatDateISO_(new Date(r.Waktu)) <= payload.sampai);
  }
  if (payload.kelompok) rows = rows.filter((r) => r.Kelompok === payload.kelompok);
  if (payload.status) rows = rows.filter((r) => r.Status === payload.status);

  rows.sort((a, b) => new Date(b.Waktu) - new Date(a.Waktu));

  return {
    rows: rows.map((r) => ({
      id: r.ID,
      nama: r.Nama,
      kelompok: r.Kelompok,
      waktu: new Date(r.Waktu).toISOString(),
      status: r.Status,
    })),
  };
}

function actionGetDashboardStats() {
  const cached = cacheGetJson_("dashboard");
  if (cached) return cached;

  const siswa = sheetToObjects_(CONFIG.SHEET_SISWA);
  const presensiSheet = getSheet_(CONFIG.SHEET_PRESENSI);
  const lastRow = presensiSheet.getLastRow();

  const now = new Date();
  const todayStr = formatDateISO_(now);
  const totalSiswaAktif = siswa.filter((s) => s.Status === "Aktif").length;

  // Dashboard only needs the last 7 days.
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);

  const perHari = new Map();

  if (lastRow >= 2) {
    const values = presensiSheet.getRange(2, 1, lastRow - 1, 8).getValues();

    values.forEach((row) => {
      const waktu = row[5];
      if (!waktu) return;

      const d = new Date(waktu);
      if (isNaN(d.getTime()) || d < cutoff) return;

      const tanggal = formatDateISO_(d);

      if (!perHari.has(tanggal)) {
        perHari.set(tanggal, { rows: [], hadir: 0, telat: 0 });
      }

      const day = perHari.get(tanggal);
      day.rows.push({
        ID: row[0],
        SiswaID: row[1],
        Barcode: row[2],
        Nama: row[3],
        Kelompok: row[4],
        Waktu: row[5],
        Status: row[6],
        Keterangan: row[7]
      });

      if (row[6] === "Hadir") day.hadir++;
      if (row[6] === "Telat") day.telat++;
    });
  }

  const today = perHari.get(todayStr);
  const todayRows = today ? today.rows : [];
  const hadirHariIni = today ? today.hadir : 0;
  const telatHariIni = today ? today.telat : 0;
  const belumPresensiHariIni = Math.max(0, totalSiswaAktif - todayRows.length);

  const tren7Hari = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    const dStr = formatDateISO_(d);
    const day = perHari.get(dStr);

    tren7Hari.push({
      tanggal: dStr,
      hadir: day ? day.hadir : 0,
      telat: day ? day.telat : 0
    });
  }

  const riwayatHariIni = todayRows
    .slice()
    .sort((a, b) => new Date(b.Waktu) - new Date(a.Waktu))
    .map((r) => ({
      nama: r.Nama,
      kelompok: r.Kelompok,
      waktu: new Date(r.Waktu).toISOString(),
      status: r.Status
    }));

  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();
  const iuranStat = actionGetIuranBulan({
    bulan: bulanIni,
    tahun: tahunIni
  }, siswa);

  const result = {
    totalSiswaAktif,
    hadirHariIni,
    telatHariIni,
    belumPresensiHariIni,
    tren7Hari,
    riwayatHariIni,
    iuranBulanIni: {
      bulan: bulanIni,
      tahun: tahunIni,
      namaBulan: iuranStat.namaBulan,
      lunas: iuranStat.totalLunas,
      belum: iuranStat.totalBelum,
      totalTerkumpul: iuranStat.totalTerkumpul
    }
  };

  cachePutJson_("dashboard", result, CONFIG.CACHE_SECONDS.DASHBOARD);
  return result;
}

// ============================================================================
// UTIL TANGGAL
// ============================================================================
function formatDateISO_(date) {
  const d = new Date(date);
  if (!requestContext_) return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const context = requestContext_;
  const tz = context.timezone || (context.timezone = Session.getScriptTimeZone());
  if (!context.dates) {
    context.dates = Object.create(null);
    // A bounded, deterministic cache: manual sheet edits require no invalidation.
    try {
      context.dateCache = CacheService.getScriptCache();
      const cached = JSON.parse(context.dateCache.get("date-iso:v1:" + tz) || "{}");
      if (cached && typeof cached === "object" && !Array.isArray(cached)) {
        Object.entries(cached).slice(-1000).forEach(([key, value]) => {
          if (!/^-?\d{1,16}$/.test(key) || Math.abs(Number(key)) > 8640000000000000 || typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
          const cachedDate = new Date(value + "T00:00:00Z");
          if (!isNaN(cachedDate) && cachedDate.toISOString().slice(0, 10) === value) context.dates[key] = value;
        });
      }
    } catch (err) {
      context.dateCache = null;
    }
  }

  const key = String(d.getTime());
  if (Object.prototype.hasOwnProperty.call(context.dates, key)) return context.dates[key];
  const result = Utilities.formatDate(d, tz, "yyyy-MM-dd");
  context.dates[key] = result;
  context.datesChanged = true;
  return result;
}

function saveDateCache_() {
  const context = requestContext_;
  if (!context || !context.dateCache || !context.datesChanged) return;
  try {
    const entries = Object.entries(context.dates).slice(-1000);
    context.dateCache.put("date-iso:v1:" + context.timezone, JSON.stringify(Object.fromEntries(entries)), CONFIG.DATE_CACHE_SECONDS);
  } catch (err) {
    // Cache eviction, quota limits or outages must never fail an API request.
  }
}

/**
 * Normalisasi nomor HP ke format internasional tanpa '+' (untuk wa.me link).
 * 08xxx → 628xxx, 8xxx → 628xxx, sudah 62xxx → tetap.
 */
function normalizeHP_(hp) {
  const clean = String(hp || "").replace(/[\s\-().+]/g, "");
  if (!clean) return "";
  if (clean.startsWith("08")) return "62" + clean.slice(1);
  if (clean.startsWith("8") && clean.length >= 9) return "62" + clean;
  return clean;
}