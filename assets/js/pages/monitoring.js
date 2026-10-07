(function () {
  UI.renderPage({ active: "monitoring", title: "Monitoring Latihan", desc: "Catat penilaian kemampuan & catatan perkembangan tiap sesi latihan" });

  // Admin & Pelatih sama-sama bisa isi penilaian; dicatatOleh = session.nama.

  // Kategori skill (1–5), sinkron dengan SKILL_COLS di Code.gs & SKILLS di evaluasi.js.
  const SKILLS = [
    { key: "dribbling", label: "Dribbling" },
    { key: "layup", label: "Lay Up" },
    { key: "shooting", label: "Shooting" },
    { key: "passing", label: "Passing" },
    { key: "footwork", label: "Footwork / Agility" },
    { key: "fundamentalTeam", label: "Fundamental Team" },
    { key: "teamwork", label: "Team Work" },
    { key: "situasional", label: "Game / Situasional" },
  ];
  const RATING_LABEL = { 1: "Kurang", 2: "Cukup", 3: "Baik", 4: "Sangat Baik", 5: "Istimewa" };

  let allSiswa = [];
  let penilaianByTanggal = new Map(); // siswaId -> record penilaian tanggal terpilih
  let currentSkor = {};

  const filterTanggal = document.getElementById("filterTanggal");
  const filterKelompok = document.getElementById("filterKelompok");
  const filterStatus = document.getElementById("filterStatus");
  const searchInput = document.getElementById("searchInput");
  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const emptyTitle = document.getElementById("emptyTitle");
  const emptyDesc = document.getElementById("emptyDesc");
  const statSudah = document.getElementById("statSudah");
  const statBelum = document.getElementById("statBelum");
  const statRata = document.getElementById("statRata");

  const form = document.getElementById("penilaianForm");
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");
  const skillFieldsRoot = document.getElementById("skillFieldsRoot");
  const btnHapus = document.getElementById("btnHapus");
  const btnSimpan = document.getElementById("btnSimpan");

  init();

  async function init() {
    filterTanggal.value = UI.todayISO();
    filterTanggal.max = UI.todayISO();
    buildSkillFields();
    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(6, 6);
    let rows = [];
    try {
      const data = await Api.cached("getSiswaList");
      allSiswa = (data.siswa || []).filter((s) => s.status === "Aktif");
      UI.fillSelect(filterKelompok, data.kelompok || [], "Semua");
    } catch (err) {
      UI.toast(err.message || "Gagal memuat data siswa.", "error");
    }
    try {
      rows = await ApiGas.cached("getPenilaianByTanggal", { tanggal: filterTanggal.value });
    } catch (err) {
      UI.toast(err.message || "Gagal memuat data monitoring.", "error");
    }
    penilaianByTanggal = new Map(rows.map((r) => [String(r.siswaId), r]));
    render();
  }

  function bindEvents() {
    filterTanggal.addEventListener("change", loadPenilaian);
    filterKelompok.addEventListener("change", render);
    filterStatus.addEventListener("change", render);
    searchInput.addEventListener("input", render);

    document.getElementById("btnCloseModal").addEventListener("click", () => UI.closeModal("penilaianModal"));
    document.getElementById("btnBatal").addEventListener("click", () => UI.closeModal("penilaianModal"));
    form.addEventListener("submit", onSubmit);
    btnHapus.addEventListener("click", onHapus);
  }

  /** Form rating 1–5 per kategori — dibangun sekali, dipakai ulang tiap buka modal. */
  function buildSkillFields() {
    skillFieldsRoot.innerHTML = SKILLS.map(
      (s) => `
      <div class="skill-field">
        <div class="skill-field-head">
          <label>${UI.escapeHtml(s.label)}</label>
          <span class="skill-val" id="val-${s.key}">&ndash;</span>
        </div>
        <div class="pill-rating" role="group" aria-label="${UI.escapeHtml(s.label)}" data-skill="${s.key}">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-val="${n}">${n}</button>`).join("")}
        </div>
      </div>`,
    ).join("");

    skillFieldsRoot.querySelectorAll(".pill-rating").forEach((group) => {
      const key = group.dataset.skill;
      group.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => setSkorValue(key, Number(btn.dataset.val)));
      });
    });
  }

  function setSkorValue(key, val) {
    currentSkor[key] = val;
    const group = skillFieldsRoot.querySelector(`.pill-rating[data-skill="${key}"]`);
    group.querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.val) === val));
    document.getElementById(`val-${key}`).textContent = RATING_LABEL[val] || "\u2013";
  }

  async function loadPenilaian() {
    tableBody.innerHTML = UI.skeletonRows(6, 6);
    try {
      const rows = await ApiGas.cached("getPenilaianByTanggal", { tanggal: filterTanggal.value });
      penilaianByTanggal = new Map(rows.map((r) => [String(r.siswaId), r]));
    } catch (err) {
      penilaianByTanggal = new Map();
      UI.toast(err.message || "Gagal memuat data monitoring.", "error");
    }
    render();
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const kelompok = filterKelompok.value;
    const status = filterStatus.value;

    let list = allSiswa
      .filter((s) => !kelompok || s.kelompok === kelompok)
      .filter((s) => !q || s.nama.toLowerCase().includes(q))
      .map((s) => ({ siswa: s, nilai: penilaianByTanggal.get(String(s.id)) || null }));

    if (status === "sudah") list = list.filter((r) => r.nilai);
    if (status === "belum") list = list.filter((r) => !r.nilai);

    list.sort((a, b) => a.siswa.nama.localeCompare(b.siswa.nama, "id"));

    const sudahCount = list.filter((r) => r.nilai).length;
    statSudah.textContent = String(list.filter((r) => r.nilai).length || 0);
    statBelum.textContent = String(list.length - sudahCount);
    const semuaNilai = list.filter((r) => r.nilai).map((r) => r.nilai.rataRata).filter((n) => n > 0);
    statRata.textContent = semuaNilai.length ? (semuaNilai.reduce((a, b) => a + b, 0) / semuaNilai.length).toFixed(1) : "\u2013";

    emptyState.classList.toggle("hidden", allSiswa.length > 0);
    if (!allSiswa.length) {
      emptyTitle.textContent = "Belum ada siswa aktif";
      emptyDesc.textContent = "Tambahkan siswa dulu di menu Siswa untuk mulai mencatat monitoring latihan.";
    }

    if (!list.length && allSiswa.length) {
      tableBody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px;">Tidak ada siswa yang cocok dengan filter.</td></tr>`;
      return;
    }

    tableBody.innerHTML = list
      .map(({ siswa, nilai }) => {
        const done = !!nilai;
        return `
        <tr>
          <td><b>${UI.escapeHtml(siswa.nama)}</b></td>
          <td>${UI.escapeHtml(siswa.jenisKelamin || "-")}</td>
          <td><span class="status-dot ${done ? "done" : "pending"}">${done ? "Sudah Dinilai" : "Belum Dinilai"}</span></td>
          <td>${done ? nilai.rataRata.toFixed(1) : "-"}</td>
          <td style="max-width:260px;white-space:normal;">${done && nilai.catatan ? UI.escapeHtml(nilai.catatan) : '<span class="muted">-</span>'}</td>
          <td>
            <button type="button" class="btn btn-sm ${done ? "btn-ghost" : "btn-primary"}" data-open="${siswa.id}">${done ? "Edit" : "Isi Penilaian"}</button>
          </td>
        </tr>`;
      })
      .join("");

    tableBody.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openForm(btn.dataset.open));
    });
  }

  function openForm(siswaId) {
    const siswa = allSiswa.find((s) => String(s.id) === String(siswaId));
    if (!siswa) return;
    const existing = penilaianByTanggal.get(String(siswaId)) || null;

    form.reset();
    document.getElementById("fId").value = existing ? existing.id : "";
    document.getElementById("fSiswaId").value = siswa.id;
    document.getElementById("fNamaSiswa").value = siswa.nama;
    document.getElementById("fKelompok").value = siswa.kelompok || "";
    document.getElementById("fCatatan").value = existing ? existing.catatan || "" : "";

    currentSkor = {};
    SKILLS.forEach((s) => {
      const val = existing ? existing.skor[s.key] : 0;
      setSkorValue(s.key, val || 0);
      if (!val) {
        const group = skillFieldsRoot.querySelector(`.pill-rating[data-skill="${s.key}"]`);
        group.querySelectorAll("button").forEach((btn) => btn.classList.remove("active"));
        document.getElementById(`val-${s.key}`).textContent = "\u2013";
        delete currentSkor[s.key];
      }
    });

    modalTitle.textContent = existing ? "Edit Penilaian" : "Isi Penilaian";
    modalDesc.textContent = `${siswa.nama} \u00b7 ${UI.formatTanggal(filterTanggal.value, true)}`;
    btnHapus.style.display = existing ? "" : "none";
    UI.openModal("penilaianModal");
  }

  async function onSubmit(e) {
    e.preventDefault();
    const missing = SKILLS.filter((s) => !currentSkor[s.key]);
    if (missing.length) {
      UI.toast(`Isi dulu penilaian: ${missing.map((s) => s.label).join(", ")}.`, "error");
      return;
    }

    UI.setButtonLoading(btnSimpan, true);
    try {
      await ApiGas.call("savePenilaian", {
        id: document.getElementById("fId").value || undefined,
        tanggal: filterTanggal.value,
        siswaId: document.getElementById("fSiswaId").value,
        namaSiswa: document.getElementById("fNamaSiswa").value,
        kelompok: document.getElementById("fKelompok").value,
        skor: currentSkor,
        catatan: document.getElementById("fCatatan").value.trim(),
      });
      UI.toast("Penilaian tersimpan.", "success");
      UI.closeModal("penilaianModal");
      await loadPenilaian();
    } catch (err) {
      UI.toast(err.message || "Gagal menyimpan penilaian.", "error");
    } finally {
      UI.setButtonLoading(btnSimpan, false, "Simpan");
    }
  }

  async function onHapus() {
    const id = document.getElementById("fId").value;
    if (!id) return;
    const ok = await UI.confirmDialog("Hapus penilaian sesi ini? Catatan & skor untuk tanggal ini akan hilang.", { title: "Hapus Penilaian", okLabel: "Ya, Hapus" });
    if (!ok) return;
    try {
      await ApiGas.call("deletePenilaian", { id });
      UI.toast("Penilaian dihapus.", "success");
      UI.closeModal("penilaianModal");
      await loadPenilaian();
    } catch (err) {
      UI.toast(err.message || "Gagal menghapus penilaian.", "error");
    }
  }
})();
