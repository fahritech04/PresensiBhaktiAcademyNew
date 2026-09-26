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

  function hasOAuthCallback() {
    const h = window.location.hash || "";
    const s = window.location.search || "";
    return h.includes("access_token=") || h.includes("error=") || s.includes("code=") || s.includes("error=");
  }

  function getOAuthAccessTokenFromUrl() {
    try {
      if (window.location.hash) {
        const hash = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : window.location.hash;
        const params = new URLSearchParams(hash);
        const token = params.get("access_token");
        if (token) return token;
      }
    } catch (e) {}
    return null;
  }

  async function resolveOAuthToken() {
    const directToken = getOAuthAccessTokenFromUrl();
    if (directToken) return directToken;
    try {
      const mod = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
      const client = mod.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data } = await client.auth.getSession();
      return (data && data.session && data.session.access_token) || null;
    } catch (e) {
      return null;
    }
  }

  async function handleOAuthLogin() {
    if (!hasOAuthCallback()) return null;
    const token = await resolveOAuthToken();
    if (!token) {
      const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
      const queryParams = new URLSearchParams(window.location.search || "");
      const errorDesc = hashParams.get("error_description") || queryParams.get("error_description");
      if (errorDesc) throw new Error(decodeURIComponent(errorDesc).replace(/\+/g, " "));
      throw new Error("Token autentikasi Google tidak ditemukan.");
    }
    const session = await loginGoogle(token);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    return session;
  }

  /** Panggil di paling atas setiap halaman terproteksi. */
  function guardPage() {
    if (!isLoggedIn()) {
      if (hasOAuthCallback()) {
        return; // Callback OAuth sedang diproses di halaman ini
      }
      window.location.replace("/login/");
    }
  }

  /** Panggil di halaman login: jika sudah login, langsung ke dashboard atau scan. */
  function redirectIfLoggedIn() {
    if (isLoggedIn()) {
      const session = getSession();
      if (session && session.role === "Pelatih") {
        window.location.replace("/scan/");
      } else {
        window.location.replace("/dashboard/");
      }
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

  return {
    saveSession,
    getSession,
    isLoggedIn,
    logout,
    guardPage,
    redirectIfLoggedIn,
    login,
    loginGoogle,
    hasOAuthCallback,
    getOAuthAccessTokenFromUrl,
    handleOAuthLogin,
  };
})();
