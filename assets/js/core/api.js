const Api = (() => {
  const CACHE_PREFIX = "__bsa_cache__";
  const CACHE_TTL_SEC = { getKelompokList: 600, getSiswaList: 300 };
  const MUTATING_ACTIONS = new Set([
    "addSiswa", "updateSiswa", "deleteSiswa",
    "scanPresensi", "tandaiIuran", "batalkanIuran", "updateIuran",
  ]);

  function getToken() {
    const session = Auth.getSession();
    return session === null ? null : session.token;
  }

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
      /* kuota localStorage penuh => lewati, fetch tetap jalan */
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

  async function call(action, payload = {}) {
    if (APP_CONFIG.SUPABASE_URL.includes("GANTI_DENGAN_PROJECT_ID")) {
      throw new Error("SUPABASE_URL belum diatur. Buka assets/js/core/config.js lalu isi URL & anon key project Supabase kamu.");
    }

    const endpoint = `${APP_CONFIG.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${APP_CONFIG.SUPABASE_FUNCTION}`;

    const body = JSON.stringify({
      action,
      token: getToken(),
      payload: {
        ...payload,
        clientTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Edge Function di-deploy dengan --no-verify-jwt (autentikasi
          // dipegang sendiri lewat token sesi kustom di atas), tapi header
          // ini tetap wajib dikirim supaya lolos gateway Supabase.
          apikey: APP_CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${APP_CONFIG.SUPABASE_ANON_KEY}`,
        },
        body,
      });
    } catch (networkErr) {
      throw new Error("Tidak bisa terhubung ke server. Cek koneksi internet kamu.");
    }

    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      throw new Error("Respon server tidak valid. Pastikan Edge Function sudah dideploy dengan benar.");
    }

    if (!json.ok) {
      const err = new Error(json.message || "Terjadi kesalahan pada server.");
      err.code = json.code || "UNKNOWN";
      throw err;
    }

    // Data statis berubah setelah mutasi => buang cache supaya tidak basi.
    if (MUTATING_ACTIONS.has(action)) clearCache();
    return json.data;
  }

  /** Versi call() dengan cache localStorage TTL (default 300 detik).
   *  Hanya untuk aksi baca data jarang berubah (getKelompokList/getSiswaList). */
  async function cached(action, payload = {}) {
    const ttl = CACHE_TTL_SEC[action] ?? 300;
    const key = action + ":" + JSON.stringify(payload);
    const hit = cacheGet(key, ttl);
    if (hit !== null) return hit;
    const data = await call(action, payload);
    cacheSet(key, data);
    return data;
  }

  return { call, cached, clearCache };
})();
