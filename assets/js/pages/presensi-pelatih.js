(function () {
  UI.renderPage({ active: "presensi-pelatih", title: "Riwayat Presensi Pelatih", desc: "Rekap kehadiran pelatih" });

  let currentRows = [];
  let total = 0;
  let page = 0;
  let mode = "detail";
  let rekapRows = [];
  const PAGE_SIZE = 500;

  const dari = document.getElementById("filterDari");
  const sampai = document.getElementById("filterSampai");
  const status = document.getElementById("filterStatus");
  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const rekapBody = document.getElementById("rekapBody");
  const rekapEmpty = document.getElementById("rekapEmpty");
  const detailWrap = document.getElementById("detailWrap");
  const rekapWrap = document.getElementById("rekapWrap");
  const btnDetail = document.getElementById("btnDetail");
  const btnRekap = document.getElementById("btnRekap");
  const rowInfo = document.getElementById("rowInfo");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");

  init();

  async function init() {
    const today = UI.todayISO();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    dari.value = UI.dateToISO(weekAgo);
    sampai.value = today;

    tableBody.innerHTML = UI.skeletonRows(4, 4);
    document.getElementById("btnFilter").addEventListener("click", () => {
      page = 0;
      loadData();
    });
    if (btnPrev) btnPrev.addEventListener("click", () => { if (page > 0) { page--; loadData(); } });
    if (btnNext) btnNext.addEventListener("click", () => { page++; loadData(); });
    btnDetail.addEventListener("click", () => setMode("detail"));
    btnRekap.addEventListener("click", () => setMode("rekap"));
    await loadData();
  }

  async function loadData() {
    if (mode === "rekap") {
      await loadRekap();
      return;
    }
    tableBody.innerHTML = UI.skeletonRows(4, 4);
    try {
      const data = await Api.call("getPresensiPelatihList", {
        dari: dari.value,
        sampai: sampai.value,
        status: status.value,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      currentRows = data.rows || [];
      total = Number(data.total ?? currentRows.length);
      renderTable();
      updatePager();
    } catch (err) {
      UI.toast(err.message, "error");
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
    }
  }

  function updatePager() {
    if (!btnPrev || !btnNext) return;
    btnPrev.disabled = page === 0;
    btnNext.disabled = page * PAGE_SIZE + currentRows.length >= total;
    if (!total) return;
    rowInfo.textContent = `${page * PAGE_SIZE + currentRows.length} dari ${total} data`;
  }

  function renderTable() {
    if (!currentRows.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = currentRows
      .map(
        (r) => `
      <tr>
        <td>${UI.formatTanggal(r.waktu)}</td>
        <td class="cell-name">${UI.escapeHtml(r.nama)}</td>
        <td class="mono">${UI.formatJam(r.waktu)}</td>
        <td><span class="tag ${r.status === "Telat" ? "tag-telat" : "tag-hadir"}">${r.status}</span></td>
      </tr>`,
      )
      .join("");
  }

  function setMode(next) {
    mode = next;
    const isRekap = mode === "rekap";
    btnDetail.classList.toggle("btn-primary", !isRekap);
    btnDetail.classList.toggle("btn-ghost", isRekap);
    btnRekap.classList.toggle("btn-primary", isRekap);
    btnRekap.classList.toggle("btn-ghost", !isRekap);
    detailWrap.style.display = isRekap ? "none" : "";
    rekapWrap.style.display = isRekap ? "" : "none";
    btnPrev.style.display = isRekap ? "none" : "";
    btnNext.style.display = isRekap ? "none" : "";
    rowInfo.style.display = isRekap ? "none" : "";
    page = 0;
    loadData();
  }

  async function loadRekap() {
    rekapBody.innerHTML = UI.skeletonRows(4, 4);
    rekapEmpty.classList.add("hidden");
    try {
      const data = await Api.call("getPresensiPelatihRekap", {
        dari: dari.value,
        sampai: sampai.value,
        status: status.value,
      });
      rekapRows = data.rows || [];
      renderRekap();
    } catch (err) {
      UI.toast(err.message, "error");
      rekapBody.innerHTML = "";
      rekapEmpty.classList.remove("hidden");
    }
  }

  function renderRekap() {
    if (!rekapRows.length) {
      rekapBody.innerHTML = "";
      rekapEmpty.classList.remove("hidden");
      return;
    }
    rekapEmpty.classList.add("hidden");

    rekapBody.innerHTML = rekapRows
      .map(
        (r) => `
      <tr>
        <td class="cell-name">${UI.escapeHtml(r.nama)}</td>
        <td><span class="tag tag-hadir">${r.hadir}</span></td>
        <td><span class="tag tag-telat">${r.telat}</span></td>
        <td class="mono">${r.total}</td>
      </tr>`,
      )
      .join("");
  }
})();
