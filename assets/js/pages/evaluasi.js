(function () {
  UI.renderPage({ active: "evaluasi", title: "Evaluasi Bulanan", desc: "Rekap perkembangan & evaluasi kelebihan/kekurangan tiap anak per bulan" });

  // Khusus tampilan Admin (bukan Pelatih) — sesuai permintaan.
  const session = Auth.getSession();
  if (session && session.role === "Pelatih") {
    window.location.replace("/scan/");
    return;
  }

  const now = new Date();
  // Sinkron dgn SKILLS di monitoring.js & SKILL_COLS di Code.gs.
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

  let selectedBulan = now.getMonth() + 1;
  let selectedTahun = now.getFullYear();
  let allSiswa = [];
  let jenisKelaminMap = new Map(); // siswaId -> jenis kelamin dari Supabase
  let rekapList = []; // hasil getRekapBulanan bulan terpilih
  let evaluasiStatusMap = new Map(); // siswaId -> sudah dievaluasi bulan ini (1 panggilan batch)

  const filterBulan = document.getElementById("filterBulan");
  const filterTahun = document.getElementById("filterTahun");
  const filterKelompok = document.getElementById("filterKelompok");
  const searchInput = document.getElementById("searchInput");
  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const statSudah = document.getElementById("statSudah");
  const statBelum = document.getElementById("statBelum");
  const statRata = document.getElementById("statRata");

  const form = document.getElementById("evaluasiForm");
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");
  const skillBarsRoot = document.getElementById("skillBarsRoot");
  const riwayatSesiRoot = document.getElementById("riwayatSesiRoot");
  const btnSimpan = document.getElementById("btnSimpan");

  init();

  async function init() {
    fillBulanTahunOptions();
    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(6, 6);
    try {
      const data = await Api.cached("getSiswaList");
      allSiswa = (data.siswa || []).filter((s) => s.status === "Aktif");
      jenisKelaminMap = new Map(allSiswa.map((s) => [String(s.id), s.jenisKelamin]));
      UI.fillSelect(filterKelompok, data.kelompok || [], "Semua");
    } catch (err) {
      UI.toast(err.message || "Gagal memuat data siswa.", "error");
    }
    await loadRekap();
  }

  function fillBulanTahunOptions() {
    const { bulan, tahun } = UI.fillBulanTahun(filterBulan, filterTahun, now);
    selectedBulan = bulan;
    selectedTahun = tahun;
  }

  function bindEvents() {
    filterBulan.addEventListener("change", () => {
      selectedBulan = Number(filterBulan.value);
      loadRekap();
    });
    filterTahun.addEventListener("change", () => {
      selectedTahun = Number(filterTahun.value);
      loadRekap();
    });
    filterKelompok.addEventListener("change", render);
    searchInput.addEventListener("input", render);

    document.getElementById("btnCloseModal").addEventListener("click", () => UI.closeModal("evaluasiModal"));
    document.getElementById("btnBatal").addEventListener("click", () => UI.closeModal("evaluasiModal"));
    form.addEventListener("submit", onSubmit);
  }

  async function loadRekap() {
    tableBody.innerHTML = UI.skeletonRows(6, 6);
    try {
      const data = await ApiGas.cached("getRekapEvaluasiBulanan", { bulan: selectedBulan, tahun: selectedTahun });
      rekapList = data.rekap;
      evaluasiStatusMap = new Map(Object.keys(data.status || {}).map((id) => [id, !!data.status[id]]));
    } catch (err) {
      rekapList = [];
      evaluasiStatusMap = new Map();
      UI.toast(err.message || "Gagal memuat rekap bulanan.", "error");
    }
    render();
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const kelompok = filterKelompok.value;

    let list = rekapList
      .filter((r) => !kelompok || r.kelompok === kelompok)
      .filter((r) => !q || r.namaSiswa.toLowerCase().includes(q));

    list.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, "id"));

    const sudah = list.filter((r) => evaluasiStatusMap.get(String(r.siswaId))).length;
    statSudah.textContent = String(sudah);
    statBelum.textContent = String(list.length - sudah);
    const overallAvgList = list.map((r) => r.overall).filter((n) => n > 0);
    statRata.textContent = overallAvgList.length ? (overallAvgList.reduce((a, b) => a + b, 0) / overallAvgList.length).toFixed(1) : "\u2013";

    emptyState.classList.toggle("hidden", rekapList.length > 0);

    if (!list.length) {
      tableBody.innerHTML = rekapList.length ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px;">Tidak ada siswa yang cocok dengan filter.</td></tr>` : "";
      return;
    }

    tableBody.innerHTML = list
      .map((r) => {
        const done = !!evaluasiStatusMap.get(String(r.siswaId));
        const ovInfo = r.overall > 0 ? levelInfo(r.overall) : null;
        return `
        <tr>
          <td><b>${UI.escapeHtml(r.namaSiswa)}</b></td>
          <td>${UI.escapeHtml(jenisKelaminMap.get(String(r.siswaId)) || "-")}</td>
          <td>${r.jumlahSesi}</td>
          <td><span class="pill-badge ${ovInfo ? `lvl-${ovInfo.lvl}` : "empty"}">${r.overall.toFixed(1)}</span></td>
          <td><span class="eval-status ${done ? "done" : "pending"}">${done ? "Sudah Dievaluasi" : "Belum Dievaluasi"}</span></td>
          <td><button type="button" class="btn btn-sm btn-ghost" data-open="${r.siswaId}">Lihat &amp; Evaluasi</button></td>
        </tr>`;
      })
      .join("");

    tableBody.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openDetail(btn.dataset.open));
    });
  }

  function levelInfo(val) {
    if (val >= 4.5) return { lvl: 5, word: "Sangat Baik" };
    if (val >= 3.5) return { lvl: 4, word: "Baik" };
    if (val >= 2.5) return { lvl: 3, word: "Cukup" };
    if (val >= 1.5) return { lvl: 2, word: "Kurang" };
    return { lvl: 1, word: "Sangat Kurang" };
  }

  function renderSkillBars(rataRata) {
    skillBarsRoot.innerHTML = SKILLS.map((s) => {
      const val = (rataRata && rataRata[s.key]) || 0;
      const pct = Math.max(0, Math.min(100, (val / 5) * 100));
      const info = val > 0 ? levelInfo(val) : null;
      return `
        <div class="skill-bar-row${info ? ` lvl-${info.lvl}` : ""}">
          <span class="lbl">${UI.escapeHtml(s.label)}</span>
          <span class="skill-bar-track"><span class="skill-bar-fill" style="width:${pct}%"></span></span>
          <span class="val pill-badge${info ? "" : " empty"}">${val ? val.toFixed(1) : "-"}</span>
          <span class="status">${info ? info.word : "\u2013"}</span>
        </div>`;
    }).join("");
  }

  function renderRiwayatSesi(sesiList) {
    if (!sesiList.length) {
      riwayatSesiRoot.innerHTML = `<div class="riwayat-kosong">Belum ada catatan sesi bulan ini.</div>`;
      return;
    }
    riwayatSesiRoot.innerHTML = sesiList
      .slice()
      .reverse()
      .map(
        (s) => `
        <div class="item">
          <span class="avg">Rata-rata ${s.rataRata.toFixed(1)}</span>
          <span class="tgl">${UI.formatTanggal(s.tanggal)}</span>
          <p>${s.catatan ? UI.escapeHtml(s.catatan) : '<span class="muted">Tidak ada catatan.</span>'}</p>
        </div>`,
      )
      .join("");
  }

  async function openDetail(siswaId) {
    const rekap = rekapList.find((r) => String(r.siswaId) === String(siswaId));
    if (!rekap) return;

    modalTitle.textContent = "Evaluasi Bulanan";
    modalDesc.textContent = `${rekap.namaSiswa} \u00b7 ${UI.BULAN_NAMA[selectedBulan]} ${selectedTahun}`;
    document.getElementById("fId").value = "";
    document.getElementById("fSiswaId").value = rekap.siswaId;
    document.getElementById("fNamaSiswa").value = rekap.namaSiswa;
    document.getElementById("fKelompok").value = rekap.kelompok || "";
    document.getElementById("fKelebihan").value = "";
    document.getElementById("fKekurangan").value = "";
    document.getElementById("fRekomendasi").value = "";

    renderSkillBars(rekap.rataRata);
    riwayatSesiRoot.innerHTML = `<div class="riwayat-kosong">Memuat riwayat...</div>`;
    UI.openModal("evaluasiModal");

    try {
      const [sesiList, evaluasi] = await Promise.all([
        ApiGas.cached("getPenilaianBySiswaBulan", { siswaId: rekap.siswaId, bulan: selectedBulan, tahun: selectedTahun }),
        ApiGas.cached("getEvaluasi", { siswaId: rekap.siswaId, bulan: selectedBulan, tahun: selectedTahun }),
      ]);
      renderRiwayatSesi(sesiList);
      if (evaluasi) {
        document.getElementById("fId").value = evaluasi.id;
        document.getElementById("fKelebihan").value = evaluasi.kelebihan || "";
        document.getElementById("fKekurangan").value = evaluasi.kekurangan || "";
        document.getElementById("fRekomendasi").value = evaluasi.rekomendasi || "";
      }
    } catch (err) {
      UI.toast(err.message || "Gagal memuat detail evaluasi.", "error");
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const siswaId = document.getElementById("fSiswaId").value;
    UI.setButtonLoading(btnSimpan, true);
    try {
      await ApiGas.call("saveEvaluasi", {
        siswaId,
        namaSiswa: document.getElementById("fNamaSiswa").value,
        kelompok: document.getElementById("fKelompok").value,
        bulan: selectedBulan,
        tahun: selectedTahun,
        kelebihan: document.getElementById("fKelebihan").value.trim(),
        kekurangan: document.getElementById("fKekurangan").value.trim(),
        rekomendasi: document.getElementById("fRekomendasi").value.trim(),
      });
      UI.toast("Evaluasi tersimpan.", "success");
      UI.closeModal("evaluasiModal");
      evaluasiStatusMap.set(String(siswaId), true); // update lokal, tanpa perlu reload penuh
      render();
    } catch (err) {
      UI.toast(err.message || "Gagal menyimpan evaluasi.", "error");
    } finally {
      UI.setButtonLoading(btnSimpan, false, "Simpan Evaluasi");
    }
  }
})();
