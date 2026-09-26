(function () {
  UI.renderPage({ active: "siswa", title: "Data Siswa", desc: "Kelola anggota & kode QR", allowPublic: true });

  const session = Auth.getSession();
  const isPublic = !session;
  const isPelatih = !!(session && session.role === "Pelatih");
  const readOnly = isPublic || isPelatih; // pelatih = read-only (tanpa tambah/edit/hapus)
  if (readOnly) {
    document.getElementById("viewHeadActions").innerHTML = "";
    const thHp = document.getElementById("thHpOrtu");
    const thAksi = document.getElementById("thAksi");
    if (thHp) thHp.classList.add("hidden");
    if (thAksi) thAksi.classList.add("hidden");
  } else {
    document.getElementById("viewHeadActions").innerHTML = `
    <button class="btn btn-primary btn-sm" id="btnTambah">+ Tambah Siswa</button>`;
  }

  let allSiswa = [];
  let kelompokOptions = [];
  let page = 1;
  let pageSize = 25;
  let filteredCount = 0;

  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const emptyTitle = document.getElementById("emptyTitle");
  const emptyDesc = document.getElementById("emptyDesc");
  const searchInput = document.getElementById("searchInput");
  const filterKelompok = document.getElementById("filterKelompok");
  const filterStatus = document.getElementById("filterStatus");
  const filterJenisKelamin = document.getElementById("filterJenisKelamin");
  const paginationBar = document.getElementById("paginationBar");
  const rowInfo = document.getElementById("rowInfo");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const btnFirst = document.getElementById("btnFirst");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnLast = document.getElementById("btnLast");

  const form = document.getElementById("siswaForm");
  const modalTitle = document.getElementById("modalTitle");

  init();

  async function init() {
    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(6, readOnly ? 4 : 6);
    await loadData();
  }

  function bindEvents() {
    if (!readOnly) {
      document.getElementById("btnTambah").addEventListener("click", () => openForm());
      document.getElementById("btnCloseModal").addEventListener("click", () => UI.closeModal("siswaModal"));
      document.getElementById("btnBatal").addEventListener("click", () => UI.closeModal("siswaModal"));
      form.addEventListener("submit", onSubmit);
    }
    searchInput.addEventListener("input", () => {
      page = 1;
      renderTable();
    });
    filterKelompok.addEventListener("change", resetPage);
    filterStatus.addEventListener("change", resetPage);
    if (filterJenisKelamin) filterJenisKelamin.addEventListener("change", resetPage);

    pageSizeSelect.addEventListener("change", () => {
      pageSize = Number(pageSizeSelect.value) || 25;
      page = 1;
      renderTable();
    });
    btnFirst.addEventListener("click", () => goToPage(1));
    btnPrev.addEventListener("click", () => goToPage(page - 1));
    btnNext.addEventListener("click", () => goToPage(page + 1));
    btnLast.addEventListener("click", () => goToPage(totalPages()));
  }

  function resetPage() {
    page = 1;
    renderTable();
  }

  function totalPages() {
    return Math.max(1, Math.ceil(filteredCount / pageSize));
  }

  function goToPage(next) {
    const target = Math.min(Math.max(1, next), totalPages());
    if (target === page) return;
    page = target;
    renderTable();
    const wrap = document.querySelector(".table-wrap");
    if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function loadData() {
    try {
      const data = await Api.call("getSiswaList");
      allSiswa = data.siswa || [];
      kelompokOptions = data.kelompok || [];
      fillKelompokFilters();
      renderTable();
    } catch (err) {
      UI.toast(err.message, "error");
      tableBody.innerHTML = "";
      allSiswa = [];
      filteredCount = 0;
      updateEmptyState();
      emptyState.classList.remove("hidden");
      updatePager();
    }
  }

  function fillKelompokFilters() {
    const opts = UI.optionsHtml(kelompokOptions);
    UI.fillSelect(filterKelompok, kelompokOptions, "Semua Kelompok");
    document.getElementById("kelompokList").innerHTML = opts;
  }

  // Urutan tampil tetap ascending dari BSA-0001 (barcode dibuat sequence saat
  // pendaftaran, jadi urutan angka = urutan input terbaru di akhir).
  function compareBarcode(a, b) {
    const na = Number.parseInt(String(a.barcode || "").replace(/\D+/g, ""), 10);
    const nb = Number.parseInt(String(b.barcode || "").replace(/\D+/g, ""), 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a.barcode || "").localeCompare(String(b.barcode || ""), "id");
  }

  function getFiltered() {
    const q = searchInput.value.trim().toLowerCase();
    const kel = filterKelompok.value;
    const status = filterStatus.value;
    const jk = filterJenisKelamin ? filterJenisKelamin.value : "";

    return allSiswa
      .filter((s) => {
        const matchQ = !q || s.nama.toLowerCase().includes(q) || s.barcode.toLowerCase().includes(q);
        const matchKel = !kel || s.kelompok === kel;
        const matchStatus = !status || s.status === status;
        const matchJk = !jk || s.jenisKelamin === jk;
        return matchQ && matchKel && matchStatus && matchJk;
      })
      .sort(compareBarcode);
  }

  function updatePager() {
    const pages = totalPages();
    if (!filteredCount) {
      paginationBar.classList.add("hidden");
      return;
    }
    paginationBar.classList.remove("hidden");
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, filteredCount);
    rowInfo.textContent = `${from}-${to} dari ${filteredCount} siswa · hal. ${page}/${pages}`;
    btnFirst.disabled = page === 1;
    btnPrev.disabled = page === 1;
    btnNext.disabled = page >= pages;
    btnLast.disabled = page >= pages;
  }

  function updateEmptyState() {
    if (!allSiswa.length) {
      emptyTitle.textContent = "Belum ada data siswa";
      emptyDesc.textContent = readOnly
        ? "Data siswa akan tampil di sini setelah admin mendaftarkan anggota."
        : 'Klik "Tambah Siswa" untuk mendaftarkan anggota baru.';
      return;
    }
    emptyTitle.textContent = "Tidak ada siswa yang cocok";
    emptyDesc.textContent = "Coba ubah kata kunci, kelompok, status, atau jenis kelamin.";
  }

  function renderTable() {
    const filtered = getFiltered();
    filteredCount = filtered.length;
    if (page > totalPages()) page = totalPages();

    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize);

    if (!rows.length) {
      tableBody.innerHTML = "";
      updateEmptyState();
      emptyState.classList.remove("hidden");
      updatePager();
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = rows
      .map(
        (s) => `
      <tr>
        <td class="mono">${UI.escapeHtml(s.barcode)}</td>
        <td>
          <div class="cell-name">${UI.escapeHtml(s.nama)}</div>
          <div class="cell-sub">Daftar ${UI.formatTanggal(s.tanggalDaftar)}</div>
        </td>
        <td style="display: none">${UI.escapeHtml(s.kelompok || "-")}</td>
        <td>
          <span class="tag ${s.jenisKelamin === "Putri" ? "tag-putri" : "tag-putra"}">${UI.escapeHtml(s.jenisKelamin || "Putra")}</span>
        </td>
        ${readOnly ? "" : `<td>${s.hpOrtu ? `<a href="https://wa.me/${s.hpOrtu}" target="_blank" rel="noopener" class="wa-link">${UI.escapeHtml(s.hpOrtu)}</a>` : "<span class='muted'>-</span>"}</td>`}
        <td><span class="tag ${s.status === "Aktif" ? "tag-aktif" : "tag-nonaktif"}">${s.status}</span></td>
        ${readOnly ? "" : `<td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${s.id}">${UI.ICONS.edit}</button>
            <button class="btn btn-ghost btn-icon" title="Hapus" data-delete="${s.id}">${UI.ICONS.trash}</button>
          </div>
        </td>`}
      </tr>`,
      )
      .join("");

    if (!readOnly) {
      tableBody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openForm(allSiswa.find((s) => s.id === btn.dataset.edit))));
      tableBody.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => onDelete(btn.dataset.delete)));
    }

    updatePager();
  }

  function openForm(siswa) {
    form.reset();
    document.getElementById("fId").value = siswa ? siswa.id : "";
    document.getElementById("fNama").value = siswa ? siswa.nama : "";
    document.getElementById("fJenisKelamin").value = siswa && siswa.jenisKelamin ? siswa.jenisKelamin : "Putra";
    document.getElementById("fKelompok").value = siswa ? siswa.kelompok : "";
    document.getElementById("fTglLahir").value = siswa && siswa.tanggalLahir ? siswa.tanggalLahir.substring(0, 10) : "";
    document.getElementById("fNamaOrtu").value = siswa ? siswa.namaOrtu : "";
    document.getElementById("fHpOrtu").value = siswa ? siswa.hpOrtu : "";
    document.getElementById("fStatus").value = siswa ? siswa.status : "Aktif";
    modalTitle.textContent = siswa ? "Edit Siswa" : "Tambah Siswa";
    UI.openModal("siswaModal");
    document.getElementById("fNama").focus();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("fId").value;
    const jenisKelamin = document.getElementById("fJenisKelamin").value || "Putra";
    const rawKelompok = document.getElementById("fKelompok").value.trim();
    // Fallback otomatis [JK:...] pada kelompok jika Edge Function belum dideploy ulang
    const fallbackKelompok = `[JK:${jenisKelamin}]${rawKelompok}`;

    const payload = {
      nama: document.getElementById("fNama").value.trim(),
      jenisKelamin,
      kelompok: fallbackKelompok,
      tanggalLahir: document.getElementById("fTglLahir").value,
      namaOrtu: document.getElementById("fNamaOrtu").value.trim(),
      hpOrtu: document.getElementById("fHpOrtu").value.trim(),
      status: document.getElementById("fStatus").value,
    };
    if (!payload.nama) {
      UI.toast("Nama wajib diisi.", "error");
      return;
    }

    const btn = document.getElementById("btnSimpan");
    UI.setButtonLoading(btn, true, "Simpan Siswa");

    try {
      if (id) {
        await Api.call("updateSiswa", { id, ...payload });
        UI.toast("Data siswa berhasil diperbarui.", "success");
      } else {
        await Api.call("addSiswa", payload);
        UI.toast("Siswa baru berhasil ditambahkan.", "success");
      }
      UI.closeModal("siswaModal");
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    } finally {
      UI.setButtonLoading(btn, false, "Simpan Siswa");
    }
  }

  async function onDelete(id) {
    const siswa = allSiswa.find((s) => s.id === id);
    const ok = await UI.confirmDialog(`Data "${siswa ? siswa.nama : ""}" beserta kode QR-nya akan dihapus permanen. Riwayat presensi lama tetap tersimpan.`, { title: "Hapus Siswa?", okLabel: "Ya, Hapus" });
    if (!ok) return;

    try {
      await Api.call("deleteSiswa", { id });
      UI.toast("Data siswa dihapus.", "success");
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }
})();
