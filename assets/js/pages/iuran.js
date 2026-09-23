(function () {
  Auth.guardPage();
  UI.renderShell({ active: "iuran", title: "Iuran Bulanan", desc: "Kelola status pembayaran iuran latihan tiap bulan" });

  const BULAN_NAMA = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  let allRows = [];
  let nominalDefault = 0;
  const now = new Date();
  let selectedBulan = now.getMonth() + 1;
  let selectedTahun = now.getFullYear();

  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const filterBulan = document.getElementById("filterBulan");
  const filterTahun = document.getElementById("filterTahun");
  const filterKelompok = document.getElementById("filterKelompok");
  const filterStatus = document.getElementById("filterStatus");

  const form = document.getElementById("iuranForm");
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");

  init();

  async function init() {
    fillBulanTahunOptions();
    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(7, 5);
    await Promise.all([loadKelompok(), loadData()]);
  }

  function fillBulanTahunOptions() {
    filterBulan.innerHTML = BULAN_NAMA.slice(1)
      .map((nama, i) => `<option value="${i + 1}">${nama}</option>`)
      .join("");
    filterBulan.value = String(selectedBulan);

    const tahunSekarang = now.getFullYear();
    const tahunOpts = [];
    for (let y = tahunSekarang - 2; y <= tahunSekarang + 1; y++) tahunOpts.push(y);
    filterTahun.innerHTML = UI.optionsHtml(tahunOpts);
    filterTahun.value = String(selectedTahun);
  }

  function bindEvents() {
    filterBulan.addEventListener("change", () => {
      selectedBulan = Number(filterBulan.value);
      loadData();
    });
    filterTahun.addEventListener("change", () => {
      selectedTahun = Number(filterTahun.value);
      loadData();
    });
    filterKelompok.addEventListener("change", loadData);
    filterStatus.addEventListener("change", renderTable);
    searchInput.addEventListener("input", renderTable);

    document.getElementById("btnCloseModal").addEventListener("click", () => UI.closeModal("iuranModal"));
    document.getElementById("btnBatal").addEventListener("click", () => UI.closeModal("iuranModal"));
    form.addEventListener("submit", onSubmit);

    document.getElementById("btnCloseRiwayat").addEventListener("click", () => UI.closeModal("riwayatModal"));
  }

  async function loadKelompok() {
    try {
      const data = await Api.cached("getKelompokList");
      const opts = UI.optionsHtml(data.kelompok || []);
      filterKelompok.innerHTML = '<option value="">Semua</option>' + opts;
    } catch (err) {
      // Non-fatal: filter kelompok saat ini disembunyikan di UI, jadi aman diabaikan.
    }
  }

  async function loadData() {
    tableBody.innerHTML = UI.skeletonRows(7, 5);
    try {
      const data = await Api.call("getIuranBulan", { bulan: selectedBulan, tahun: selectedTahun, kelompok: filterKelompok.value });
      allRows = data.rows || [];
      nominalDefault = data.nominalDefault || 0;
      renderStats(data);
      renderTable();
    } catch (err) {
      UI.toast(err.message, "error");
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
    }
  }

  function renderStats(d) {
    document.getElementById("statLunas").textContent = d.totalLunas ?? 0;
    document.getElementById("statLunasFoot").textContent = `Dari ${d.totalSiswa ?? 0} siswa aktif`;
    document.getElementById("statBelum").textContent = d.totalBelum ?? 0;
    document.getElementById("statTerkumpul").textContent = UI.formatRupiah(d.totalTerkumpul);
  }

  function renderTable() {
    const q = searchInput.value.trim().toLowerCase();
    const status = filterStatus.value;

    const filtered = allRows.filter((r) => {
      const matchQ = !q || r.nama.toLowerCase().includes(q);
      const matchStatus = !status || r.status === status;
      return matchQ && matchStatus;
    });

    if (!filtered.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = filtered
      .map((r) => {
        const isLunas = r.status === "Lunas";
        return `
      <tr>
        <td class="cell-name">${UI.escapeHtml(r.nama)}</td>
        <td style="display: none">${UI.escapeHtml(r.kelompok || "-")}</td>
        <td><span class="tag ${isLunas ? "tag-hadir" : "tag-belum"}">${r.status}</span></td>
        <td>${isLunas ? UI.formatRupiah(r.nominal) : "<span class='muted'>-</span>"}</td>
        <td>${isLunas ? UI.formatTanggal(r.tanggalBayar) : "<span class='muted'>-</span>"}</td>
        <td>${r.keterangan ? UI.escapeHtml(r.keterangan) : "<span class='muted'>-</span>"}</td>
        <td>
          <div class="row-actions">
            ${
              isLunas
                ? `<button class="btn btn-ghost btn-icon" title="Edit" data-edit="${r.siswaId}">${UI.ICONS.edit}</button>
                   <button class="btn btn-ghost btn-icon" title="Batalkan Lunas" data-batal="${r.siswaId}">${UI.ICONS.trash}</button>`
                : `<button class="btn btn-primary btn-sm" data-lunas="${r.siswaId}">Tandai Lunas</button>`
            }
            <button class="btn btn-ghost btn-icon" title="Riwayat" data-riwayat="${r.siswaId}">${UI.ICONS.history}</button>
          </div>
        </td>
      </tr>`;
      })
      .join("");

    tableBody.querySelectorAll("[data-lunas]").forEach((btn) => btn.addEventListener("click", () => openForm(findRow(btn.dataset.lunas))));
    tableBody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openForm(findRow(btn.dataset.edit))));
    tableBody.querySelectorAll("[data-batal]").forEach((btn) => btn.addEventListener("click", () => onBatalkan(findRow(btn.dataset.batal))));
    tableBody.querySelectorAll("[data-riwayat]").forEach((btn) => btn.addEventListener("click", () => openRiwayat(findRow(btn.dataset.riwayat))));
  }

  function findRow(siswaId) {
    return allRows.find((r) => String(r.siswaId) === String(siswaId));
  }

  function openForm(row) {
    if (!row) return;
    form.reset();
    document.getElementById("fSiswaId").value = row.siswaId;
    document.getElementById("fNominal").value = row.nominal || nominalDefault;
    document.getElementById("fTanggalBayar").value = row.tanggalBayar || UI.todayISO();
    document.getElementById("fKeterangan").value = row.keterangan || "";
    modalTitle.textContent = row.status === "Lunas" ? "Edit Pembayaran" : "Tandai Lunas";
    modalDesc.textContent = `${row.nama} \u2014 ${BULAN_NAMA[selectedBulan]} ${selectedTahun}`;
    UI.openModal("iuranModal");
    document.getElementById("fNominal").focus();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const siswaId = document.getElementById("fSiswaId").value;
    const row = findRow(siswaId);
    const payload = {
      siswaId,
      bulan: selectedBulan,
      tahun: selectedTahun,
      nominal: document.getElementById("fNominal").value,
      tanggalBayar: document.getElementById("fTanggalBayar").value,
      keterangan: document.getElementById("fKeterangan").value.trim(),
    };

    const btn = document.getElementById("btnSimpan");
    UI.setButtonLoading(btn, true, "Simpan");

    try {
      if (row && row.status === "Lunas" && row.iuranId) {
        await Api.call("updateIuran", { id: row.iuranId, nominal: payload.nominal, tanggalBayar: payload.tanggalBayar, keterangan: payload.keterangan });
        UI.toast("Data pembayaran berhasil diperbarui.", "success");
      } else {
        await Api.call("tandaiIuran", payload);
        UI.toast("Pembayaran ditandai Lunas.", "success");
      }
      UI.closeModal("iuranModal");
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    } finally {
      UI.setButtonLoading(btn, false, "Simpan");
    }
  }

  async function onBatalkan(row) {
    if (!row) return;
    const ok = await UI.confirmDialog(`Status "Lunas" untuk ${row.nama} bulan ${BULAN_NAMA[selectedBulan]} ${selectedTahun} akan dibatalkan dan kembali menjadi "Belum Bayar".`, {
      title: "Batalkan Status Lunas?",
      okLabel: "Ya, Batalkan",
    });
    if (!ok) return;

    try {
      await Api.call("batalkanIuran", { siswaId: row.siswaId, bulan: selectedBulan, tahun: selectedTahun });
      UI.toast("Status dikembalikan ke Belum Bayar.", "success");
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }

  async function openRiwayat(row) {
    if (!row) return;
    document.getElementById("riwayatNamaSiswa").textContent = row.nama;
    const body = document.getElementById("riwayatBody");
    const empty = document.getElementById("riwayatEmpty");
    body.innerHTML = UI.skeletonRows(4, 3);
    empty.classList.add("hidden");
    UI.openModal("riwayatModal");

    try {
      const data = await Api.call("getRiwayatIuranSiswa", { siswaId: row.siswaId });
      const rows = data.rows || [];
      if (!rows.length) {
        body.innerHTML = "";
        empty.classList.remove("hidden");
        return;
      }
      body.innerHTML = rows
        .map(
          (r) => `
        <tr>
          <td>${r.namaBulan} ${r.tahun}</td>
          <td>${UI.formatRupiah(r.nominal)}</td>
          <td>${UI.formatTanggal(r.tanggalBayar)}</td>
          <td>${r.keterangan ? UI.escapeHtml(r.keterangan) : "<span class='muted'>-</span>"}</td>
        </tr>`,
        )
        .join("");
    } catch (err) {
      UI.toast(err.message, "error");
      UI.closeModal("riwayatModal");
    }
  }
})();
