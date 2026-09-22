(function () {
  Auth.guardPage();
  UI.renderShell({ active: "siswa", title: "Data Siswa", desc: "Kelola anggota & kode QR" });
  document.getElementById("viewHeadActions").innerHTML = `
    <a href="/cetak-barcode/" class="btn btn-ghost btn-sm">${UI.ICONS.cetak} Cetak QR</a>
    <button class="btn btn-primary btn-sm" id="btnTambah">+ Tambah Siswa</button>`;

  let allSiswa = [];
  let kelompokOptions = [];

  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const filterKelompok = document.getElementById("filterKelompok");
  const filterStatus = document.getElementById("filterStatus");

  const form = document.getElementById("siswaForm");
  const modalTitle = document.getElementById("modalTitle");

  init();

  async function init() {
    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(6, 5);
    await loadData();
  }

  function bindEvents() {
    document.getElementById("btnTambah").addEventListener("click", () => openForm());
    document.getElementById("btnCloseModal").addEventListener("click", () => UI.closeModal("siswaModal"));
    document.getElementById("btnBatal").addEventListener("click", () => UI.closeModal("siswaModal"));
    form.addEventListener("submit", onSubmit);
    searchInput.addEventListener("input", renderTable);
    filterKelompok.addEventListener("change", renderTable);
    filterStatus.addEventListener("change", renderTable);
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
      emptyState.classList.remove("hidden");
    }
  }

  function fillKelompokFilters() {
    const opts = UI.optionsHtml(kelompokOptions);
    filterKelompok.innerHTML = '<option value="">Semua Kelompok</option>' + opts;
    document.getElementById("kelompokList").innerHTML = opts;
  }

  function renderTable() {
    const q = searchInput.value.trim().toLowerCase();
    const kel = filterKelompok.value;
    const status = filterStatus.value;

    const filtered = allSiswa.filter((s) => {
      const matchQ = !q || s.nama.toLowerCase().includes(q) || s.barcode.toLowerCase().includes(q);
      const matchKel = !kel || s.kelompok === kel;
      const matchStatus = !status || s.status === status;
      return matchQ && matchKel && matchStatus;
    });

    if (!filtered.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = filtered
      .map(
        (s) => `
      <tr>
        <td class="mono">${UI.escapeHtml(s.barcode)}</td>
        <td>
          <div class="cell-name">${UI.escapeHtml(s.nama)}</div>
          <div class="cell-sub">Daftar ${UI.formatTanggal(s.tanggalDaftar)}</div>
        </td>
        <td style="display: none">${UI.escapeHtml(s.kelompok || "-")}</td>
        <td>${s.hpOrtu ? `<a href="https://wa.me/${s.hpOrtu}" target="_blank" rel="noopener" class="wa-link">${UI.escapeHtml(s.hpOrtu)}</a>` : "<span class='muted'>-</span>"}</td>
        <td><span class="tag ${s.status === "Aktif" ? "tag-aktif" : "tag-nonaktif"}">${s.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${s.id}">${UI.ICONS.edit}</button>
            <button class="btn btn-ghost btn-icon" title="Hapus" data-delete="${s.id}">${UI.ICONS.trash}</button>
          </div>
        </td>
      </tr>`,
      )
      .join("");

    tableBody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openForm(allSiswa.find((s) => s.id === btn.dataset.edit))));
    tableBody.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => onDelete(btn.dataset.delete)));
  }

  function openForm(siswa) {
    form.reset();
    document.getElementById("fId").value = siswa ? siswa.id : "";
    document.getElementById("fNama").value = siswa ? siswa.nama : "";
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
    const payload = {
      nama: document.getElementById("fNama").value.trim(),
      kelompok: document.getElementById("fKelompok").value.trim(),
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
