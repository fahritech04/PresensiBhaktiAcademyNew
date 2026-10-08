(function () {
  UI.renderPage({ active: "honor-pelatih", title: "Honor Pelatih", desc: "Hitung honor pelatih dari kehadiran Riwayat Presensi" });

  let rows = [];
  let selectedBulan = 0;
  let selectedTahun = 0;
  let forceRefresh = false;

  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const filterBulan = document.getElementById("filterBulan");
  const filterTahun = document.getElementById("filterTahun");

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  init();

  async function init() {
    const now = new Date();
    const { bulan, tahun } = UI.fillBulanTahun(filterBulan, filterTahun, now);
    selectedBulan = bulan;
    selectedTahun = tahun;
    filterBulan.addEventListener("change", () => {
      selectedBulan = Number(filterBulan.value);
      loadData();
    });
    filterTahun.addEventListener("change", () => {
      selectedTahun = Number(filterTahun.value);
      loadData();
    });
    tableBody.innerHTML = UI.skeletonRows(8, 4);
    await loadData();
  }

  function rangeBulan() {
    const dari = `${selectedTahun}-${String(selectedBulan).padStart(2, "0")}-01`;
    const sampai = `${selectedTahun}-${String(selectedBulan).padStart(2, "0")}-${new Date(selectedTahun, selectedBulan, 0).getDate()}`;
    return { dari, sampai };
  }

  async function loadData() {
    tableBody.innerHTML = UI.skeletonRows(8, 4);
    try {
      const { dari, sampai } = rangeBulan();
      const honorPayload = { bulan: selectedBulan, tahun: selectedTahun };
      const [rekap, honor] = await Promise.all([
        Api.call("getPresensiPelatihRekap", { dari, sampai }),
        forceRefresh
          ? ApiGas.call("getHonorBulanan", honorPayload)
          : ApiGas.cached("getHonorBulanan", honorPayload),
      ]);
      forceRefresh = false;
      const honorByName = new Map((honor || []).map((h) => [norm(h.nama), h]));
      rows = (rekap.rows || [])
        .map((r) => {
          const saved = honorByName.get(norm(r.nama));
          return {
            nama: r.nama,
            hadir: r.hadir,
            telat: r.telat,
            total: r.total,
            tarif: saved ? saved.tarifPerSesi : 0,
            statusBayar: saved ? saved.statusBayar : "Belum",
            id: saved ? saved.id : "",
          };
        })
        .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
      renderStats();
      renderTable();
    } catch (err) {
      UI.toast(err.message, "error");
      tableBody.innerHTML = "";
      rows = [];
      renderStats();
      emptyState.classList.remove("hidden");
    }
  }

  function renderStats() {
    let total = 0;
    let lunas = 0;
    let belum = 0;
    rows.forEach((r) => {
      total += r.total * r.tarif;
      if (r.statusBayar === "Lunas") lunas++;
      else belum++;
    });
    document.getElementById("statTotal").textContent = UI.formatRupiah(total);
    document.getElementById("statTotalFoot").textContent = `${rows.length} pelatih \u2014 ${UI.BULAN_NAMA[selectedBulan]} ${selectedTahun}`;
    document.getElementById("statLunas").textContent = lunas;
    document.getElementById("statBelum").textContent = belum;
  }

  function renderTable() {
    if (!rows.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = rows
      .map(
        (r, i) => `
      <tr>
        <td class="cell-name">${UI.escapeHtml(r.nama)}</td>
        <td class="mono">${r.hadir}</td>
        <td class="mono">${r.telat}</td>
        <td class="mono">${r.total}</td>
        <td><input class="input honor-tarif" type="number" min="0" step="1000" value="${r.tarif}" data-tarif="${i}" aria-label="Tarif per sesi ${UI.escapeHtml(r.nama)}" /></td>
        <td class="num-currency" data-honor="${i}">${UI.formatRupiah(r.total * r.tarif)}</td>
        <td>
          <select class="input honor-status" data-status="${i}" aria-label="Status pembayaran ${UI.escapeHtml(r.nama)}">
            <option value="Belum"${r.statusBayar === "Belum" ? " selected" : ""}>Belum</option>
            <option value="Lunas"${r.statusBayar === "Lunas" ? " selected" : ""}>Lunas</option>
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn btn-primary btn-sm" data-simpan="${i}">Simpan</button>
            ${r.id ? `<button class="btn btn-ghost btn-icon" title="Hapus honor" data-hapus="${i}">${UI.ICONS.trash}</button>` : ""}
          </div>
        </td>
      </tr>`,
      )
      .join("");

    tableBody.querySelectorAll("[data-tarif]").forEach((input) =>
      input.addEventListener("input", () => {
        const i = Number(input.dataset.tarif);
        const td = tableBody.querySelector(`[data-honor="${i}"]`);
        if (td) td.textContent = UI.formatRupiah(rows[i].total * (Number(input.value) || 0));
      }),
    );
    tableBody.querySelectorAll("[data-simpan]").forEach((btn) => btn.addEventListener("click", () => onSimpan(Number(btn.dataset.simpan))));
    tableBody.querySelectorAll("[data-hapus]").forEach((btn) => btn.addEventListener("click", () => onHapus(Number(btn.dataset.hapus))));
  }

  async function onSimpan(i) {
    const r = rows[i];
    const tarif = Number(tableBody.querySelector(`[data-tarif="${i}"]`).value) || 0;
    const statusBayar = tableBody.querySelector(`[data-status="${i}"]`).value;
    const btn = tableBody.querySelector(`[data-simpan="${i}"]`);
    const label = btn.textContent;
    UI.setButtonLoading(btn, true, "Simpan");
    try {
      await ApiGas.call("saveHonor", {
        bulan: selectedBulan,
        tahun: selectedTahun,
        nama: r.nama,
        hadir: r.hadir,
        telat: r.telat,
        tarifPerSesi: tarif,
        statusBayar,
      });
      UI.toast(`Honor ${r.nama} disimpan.`, "success");
      ApiGas.clearCache();
      forceRefresh = true;
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    } finally {
      btn.textContent = label;
      btn.disabled = false;
    }
  }

  async function onHapus(i) {
    const r = rows[i];
    if (!r.id) return;
    const ok = await UI.confirmDialog(`Data honor ${r.nama} bulan ${UI.BULAN_NAMA[selectedBulan]} ${selectedTahun} akan dihapus. Tarif & status pembayaran hilang.`, {
      title: "Hapus Honor?",
      okLabel: "Ya, Hapus",
    });
    if (!ok) return;
    try {
      await ApiGas.call("deleteHonor", { id: r.id });
      UI.toast("Data honor dihapus.", "success");
      ApiGas.clearCache();
      forceRefresh = true;
      await loadData();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }
})();
