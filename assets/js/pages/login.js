let supabaseClientPromise = null;
function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("https://esm.sh/@supabase/supabase-js@2.45.4")
      .then((mod) =>
        mod.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        }),
      )
      .catch((err) => {
        supabaseClientPromise = null;
        throw new Error("Gagal memuat library login Google. Cek koneksi internet.");
      });
  }
  return supabaseClientPromise;
}

document.addEventListener("DOMContentLoaded", () => {
  Auth.redirectIfLoggedIn();
  bindAdminForm();
  bindGoogleLogin();
  handleOAuthCallback();
});

function bindAdminForm() {
  const form = document.getElementById("loginForm");
  const errBox = document.getElementById("loginError");
  const btn = document.getElementById("btnLogin");
  const btnText = document.getElementById("btnLoginText");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.classList.remove("show");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      errBox.textContent = "Username dan password wajib diisi.";
      errBox.classList.add("show");
      return;
    }

    btn.disabled = true;
    btnText.innerHTML = '<span class="spin-sm"></span> Memeriksa...';

    try {
      await Auth.login(username, password);
      window.location.replace("/dashboard/");
    } catch (err) {
      errBox.textContent = err.message || "Username atau password salah.";
      errBox.classList.add("show");
      btn.disabled = false;
      btnText.textContent = "Masuk";
    }
  });
}

function bindGoogleLogin() {
  const btn = document.getElementById("btnGoogleLogin");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const btnGoogleText = document.getElementById("btnGoogleText");
    if (btnGoogleText) btnGoogleText.innerHTML = '<span class="spin-sm"></span> Menghubungkan...';
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/scan/" },
      });
      if (error) throw error;
    } catch (err) {
      btn.disabled = false;
      if (btnGoogleText) btnGoogleText.textContent = "Masuk dengan Google";
      UI.toast(err.message || "Gagal memulai login Google.", "error");
    }
  });
}

async function handleOAuthCallback() {
  if (!Auth.hasOAuthCallback()) return;

  const errBox = document.getElementById("loginError");

  try {
    await Auth.handleOAuthLogin();
    window.location.replace("/scan/");
  } catch (err) {
    document.documentElement.classList.remove("oauth-processing");
    if (errBox) {
      errBox.textContent = err.message || "Gagal masuk dengan Google. Silakan coba lagi.";
      errBox.classList.add("show");
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }
}
