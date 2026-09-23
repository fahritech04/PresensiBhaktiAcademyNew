document.addEventListener("DOMContentLoaded", () => {
  Auth.redirectIfLoggedIn();

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
});
