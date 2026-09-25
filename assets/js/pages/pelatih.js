(function () {
  UI.renderPage({ active: "pelatih", title: "Data Pelatih", desc: "Kelola pelatih & kode QR" });
  document.getElementById("viewHeadActions").innerHTML = `
    <button class="btn btn-primary btn-sm" id="btnTambah">+ Tambah Pelatih</button>`;

  let allPelatih = [];

  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const filterStatus = document.getElementById("filterStatus");
  const form = document.getElementById("pelatihForm");
  const modalTitle = document.getElementById("modalTitle");

  init();

  async function init() {
    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(4, 4);
    await loadData();
  }

  function bindEvents() {
    document.getElementById("btnTambah").addEventListener("click", () => openForm());
    document.getElementById("btnCloseModal").addEventListener("click", () => UI.closeModal("pelatihModal"));
    document.getElementById("btnBatal").addEventListener("click", () => UI.closeModal("pelatihModal"));
    form.addEventListener("submit", onSubmit);
    searchInput.addEventListener("input", renderTable);
    filterStatus.addEventListener("change", renderTable);
  }

  async function loadData() {
    try {
      const data = await Api.call("getPelatihList");
      allPelatih = data.pelatih || [];
      renderTable();
    } catch (err) {
      UI.toast(err.message, "error");
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
    }
  }

  function renderTable() {
    const q = searchInput.value.trim().toLowerCase();
    const status = filterStatus.value;

    const filtered = allPelatih.filter((p) => {
      const matchQ = !q || p.nama.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
      const matchStatus = !status || p.status === status;
      return matchQ && matchStatus;
    });

    if (!filtered.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = filtered
      .map(
        (p) => `
      <tr>
        <td class="mono">${UI.escapeHtml(p.barcode)}</td>
        <td>
          <div class="cell-name">${UI.escapeHtml(p.nama)}</div>
          <div class="cell-sub">Pelatih</div>
        </td>
        <td><span class="tag ${p.status === "Aktif" ? "tag-aktif" : "tag-nonaktif"}">${p.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${UI.escapeHtml(p.barcode)}">${UI.ICONS.edit}</button>
            <button class="btn btn-ghost btn-icon" title="Hapus" data-delete="${UI.escapeHtml(p.barcode)}">${UI.ICONS.trash}</button>
          </div>
        </td>
      </tr>`,
      )
      .join("");

    tableBody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openForm(allPelatih.find((p) => p.barcode === btn.dataset.edit))));
    tableBody.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => onDelete(btn.dataset.delete)));
  }

  function openForm(pelatih) {
    form.reset();
    document.getElementById("fBarcode").value = pelatih ? pelatih.barcode : "";
    document.getElementById("fNama").value = pelatih ? pelatih.nama : "";
    document.getElementById("fStatus").value = pelatih ? pelatih.status : "Aktif";
    modalTitle.textContent = pelatih ? "Edit Pelatih" : "Tambah Pelatih";
    UI.openModal("pelatihModal");
    document.getElementById("fNama").focus();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const barcode = document.getElementById("fBarcode").value;
    const nama = document.getElementById("fNama").value.trim();
    const status = document.getElementById("fStatus").value;

    if (!nama) {
      UI.toast("Nama pelatih wajib diisi.", "error");
      return;
    }

    const btn = document.getElementById("btnSimpan");
    UI.setButtonLoading(btn, true, "Simpan Pelatih");

    try {
      if (barcode) {
        await Api.call("updatePelatih", { barcode, nama, status });
        UI.toast("Data pelatih berhasil diperbarui.", "success");
      } else {
        await Api.call("addPelatih", { nama, status });
        UI.toast("Pelatih baru berhasil ditambahkan.", "success");
      }
      UI.closeModal("pelatihModal");
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    } finally {
      UI.setButtonLoading(btn, false, "Simpan Pelatih");
    }
  }

  async function onDelete(barcode) {
    const pelatih = allPelatih.find((p) => p.barcode === barcode);
    const ok = await UI.confirmDialog(`Data "${pelatih ? pelatih.nama : ""}" beserta kode QR-nya akan dihapus permanen. Riwayat presensi lama tetap tersimpan.`, { title: "Hapus Pelatih?", okLabel: "Ya, Hapus" });
    if (!ok) return;

    try {
      await Api.call("deletePelatih", { barcode });
      UI.toast("Data pelatih dihapus.", "success");
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }
})();
