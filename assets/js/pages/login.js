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
      window.location.href = "/dashboard/";
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
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/login/" },
      });
      if (error) throw error;
    } catch (err) {
      btn.disabled = false;
      UI.toast(err.message || "Gagal memulai login Google.", "error");
    }
  });
}

async function handleOAuthCallback() {
  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data && data.session && data.session.access_token;
    if (!accessToken) return; // bukan halaman callback OAuth
    await Auth.loginGoogle(accessToken);
    window.location.href = "/scan/";
  } catch (err) {
    /* bukan callback / token tidak valid: biarkan halaman login tetap tampil */
  }
}
