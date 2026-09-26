const Auth = (() => {
  function saveSession(session) {
    localStorage.setItem(APP_CONFIG.SESSION_KEY, JSON.stringify(session));
  }

  function getSession() {
    const raw = localStorage.getItem(APP_CONFIG.SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function logout() {
    localStorage.removeItem(APP_CONFIG.SESSION_KEY);
    // Hapus juga sesi Supabase Auth (login Google) — supaya tidak auto-login
    // lagi saat diarahkan ke /login/ (handleOAuthCallback baca sesi ini).
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
    Api.clearCache();
    window.location.href = "/login/";
  }

  /** Panggil di paling atas setiap halaman terproteksi. */
  function guardPage() {
    if (!isLoggedIn()) {
      window.location.href = "/login/";
    }
  }

  /** Panggil di halaman login: jika sudah login, langsung ke dashboard. */
  function redirectIfLoggedIn() {
    if (isLoggedIn()) {
      window.location.href = "/dashboard/";
    }
  }

  async function login(username, password) {
    const data = await Api.call("login", { username, password });
    Api.clearCache();
    saveSession({ token: data.token, nama: data.nama, username: data.username, role: data.role });
    return data;
  }

  /** Login pelatih via Google: kirim access_token Supabase Auth ke Edge Function
   *  `loginGoogle`, lalu simpan session custom (role Pelatih). */
  async function loginGoogle(accessToken) {
    const data = await Api.call("loginGoogle", { accessToken });
    Api.clearCache();
    saveSession({ token: data.token, nama: data.nama, username: data.username, role: data.role });
    return data;
  }

  return { saveSession, getSession, isLoggedIn, logout, guardPage, redirectIfLoggedIn, login, loginGoogle };
})();
