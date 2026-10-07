/**
 * ApiGas — wrapper ke Google Apps Script (Web App) untuk Monitoring & Evaluasi.
 * Terpisah total dari `Api` (Supabase): backend fitur ini murni GAS + Spreadsheet.
 * Cache localStorage TTL pendek + retry 1x utk error transient.
 * Setup lengkap: README.md bagian "Backend Monitoring & Evaluasi".
 */
const ApiGas = (() => {
  const CACHE_PREFIX = "__bsa_gas_cache__";
  // Cache pendek saja (bukan seperti Api.cached yg 300-600 detik) karena data
  // penilaian & evaluasi berubah sepanjang hari latihan.
  const CACHE_TTL_SEC = {
    getPenilaianByTanggal: 20,
    getPenilaianBySiswaBulan: 20,
    getRekapBulanan: 60,
    getRekapEvaluasiBulanan: 60,
    getEvaluasiStatusBulanan: 60,
    getEvaluasi: 20,
  };
  const MUTATING_ACTIONS = new Set(["savePenilaian", "deletePenilaian", "saveEvaluasi"]);

  function cacheGet(key, ttlSec) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return Date.now() - o.t > ttlSec * 1000 ? null : o.data;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data }));
    } catch (e) {
      /* kuota localStorage penuh => lewati, tetap benar cuma tidak dipercepat */
    }
  }

  function clearCache() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      /* abaikan */
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function rawCall(action, payload) {
    const session = Auth.getSession();
    const body = JSON.stringify({
      action,
      key: APP_CONFIG.GAS_KEY,
      payload: {
        ...payload,
        dicatatOleh: (session && session.nama) || "Admin",
      },
    });

    const res = await fetch(APP_CONFIG.GAS_URL, {
      method: "POST",
      // text/plain: hindari preflight OPTIONS (Apps Script tidak handle CORS preflight).
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });

    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.message || "Terjadi kesalahan pada server monitoring.");
      err.code = json.code || "UNKNOWN";
      throw err;
    }
    return json.data;
  }

  async function attemptCall(action, payload) {
    try {
      return await rawCall(action, payload);
    } catch (err) {
      if (err.code) throw err; // error server (ok:false) — jangan retry
      const wrapped = new Error(
        err instanceof SyntaxError
          ? "Respon server monitoring tidak valid. Pastikan Web App GAS sudah dideploy dengan benar (akses: Siapa saja)."
          : "Tidak bisa terhubung ke server monitoring (Google Apps Script). Cek koneksi internet kamu.",
      );
      wrapped.transient = true;
      throw wrapped;
    }
  }

  /** Panggil GAS + retry 1x untuk error transient (bukan ok:false). */
  async function call(action, payload = {}) {
    if (!APP_CONFIG.GAS_URL || APP_CONFIG.GAS_URL.includes("GANTI_DENGAN")) {
      throw new Error("GAS_URL belum diatur. Buka assets/js/core/config.js lalu isi URL Web App Google Apps Script (lihat README.md bagian 'Backend Monitoring & Evaluasi').");
    }

    let data;
    try {
      data = await attemptCall(action, payload);
    } catch (err) {
      if (err.transient) {
        await sleep(600);
        data = await attemptCall(action, payload); // percobaan ke-2
      } else {
        throw err;
      }
    }

    if (MUTATING_ACTIONS.has(action)) clearCache();
    return data;
  }

  /** call() + cache localStorage (hanya aksi baca get*). */
  async function cached(action, payload = {}) {
    const ttl = CACHE_TTL_SEC[action] ?? 15;
    const key = action + ":" + JSON.stringify(payload);
    const hit = cacheGet(key, ttl);
    if (hit !== null) return hit;
    const data = await call(action, payload);
    cacheSet(key, data);
    return data;
  }

  return { call, cached, clearCache };
})();
