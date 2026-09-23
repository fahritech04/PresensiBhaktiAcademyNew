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
    window.location.href = "/";
  }

  /** Panggil di paling atas setiap halaman terproteksi. */
  function guardPage() {
    if (!isLoggedIn()) {
      window.location.href = "/";
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
    saveSession({ token: data.token, nama: data.nama, username: data.username, role: data.role });
    return data;
  }

  return { saveSession, getSession, isLoggedIn, logout, guardPage, redirectIfLoggedIn, login };
})();
