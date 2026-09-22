const Api = (() => {
  function getToken() {
    const session = Auth.getSession();
    return session === null ? null : session.token;
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
    return json.data;
  }

  return { call };
})();
