(function () {
  UI.renderPage({ active: "presensi", title: "Riwayat Presensi", desc: "Rekap kehadiran latihan" });

  let currentRows = [];
  let total = 0;
  let page = 0;
  const PAGE_SIZE = 500;

  const dari = document.getElementById("filterDari");
  const sampai = document.getElementById("filterSampai");
  const kelompok = document.getElementById("filterKelompok");
  const status = document.getElementById("filterStatus");
  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");

  init();

  async function init() {
    const today = UI.todayISO();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    dari.value = UI.dateToISO(weekAgo);
    sampai.value = today;

    tableBody.innerHTML = UI.skeletonRows(5, 5);
    document.getElementById("btnFilter").addEventListener("click", () => {
      page = 0;
      loadData();
    });
    if (btnPrev) btnPrev.addEventListener("click", () => { if (page > 0) { page--; loadData(); } });
    if (btnNext) btnNext.addEventListener("click", () => { page++; loadData(); });
    document.getElementById("btnExport").addEventListener("click", exportHTML);
    await Promise.all([fillKelompok(), loadData()]);
  }



  async function fillKelompok() {
    try {
      const data = await Api.cached("getKelompokList");
      UI.fillSelect(kelompok, data.kelompok || [], "Semua");
    } catch (e) {
      /* biarkan default jika gagal */
    }
  }

  async function loadData() {
    tableBody.innerHTML = UI.skeletonRows(5, 5);
    try {
      const data = await Api.call("getPresensiList", {
        dari: dari.value,
        sampai: sampai.value,
        kelompok: kelompok.value,
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
    document.getElementById("rowInfo").textContent = `${page * PAGE_SIZE + currentRows.length} dari ${total} data`;
  }

  function renderTable() {
    const empty = document.getElementById("emptyState");

    if (!currentRows.length) {
      tableBody.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    tableBody.innerHTML = currentRows
      .map(
        (r) => `
      <tr>
        <td>${UI.formatTanggal(r.waktu)}</td>
        <td class="cell-name">${UI.escapeHtml(r.nama)}</td>
        <td style="display: none">${UI.escapeHtml(r.kelompok || "-")}</td>
        <td class="mono">${UI.formatJam(r.waktu)}</td>
        <td><span class="tag ${r.status === "Telat" ? "tag-telat" : "tag-hadir"}">${r.status}</span></td>
      </tr>`,
      )
      .join("");
  }

  async function exportHTML() {
    if (!total) {
      UI.toast("Tidak ada data untuk diunduh.", "error");
      return;
    }

    UI.toast("Menyiapkan laporan...", "success");
    const periodeLabel = `${dari.value} s/d ${sampai.value}`;
    const printDate = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

    // Ekspor selalu ambil SELURUH data sesuai filter (tanpa limit), supaya
    // laporan tidak terpotong pagination.
    let rows = currentRows;
    try {
      const data = await Api.call("getPresensiList", {
        dari: dari.value,
        sampai: sampai.value,
        kelompok: kelompok.value,
        status: status.value,
      });
      if (data.rows && data.rows.length) rows = data.rows;
    } catch (err) {
      UI.toast("Gagal memuat data lengkap: " + err.message, "error");
      return;
    }

    const html = buildPresensiReport(rows, periodeLabel, printDate);

    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan_presensi_${dari.value}_${sampai.value}.html`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast("Laporan berhasil dibuat! Buka file .html di browser, lalu cetak.", "success");
  }

  function buildPresensiReport(currentRows, periodeLabel, printDate) {
    const rows = currentRows
      .map((r, i) => {
        const tgl = UI.formatTanggal(r.waktu);
        const jam = UI.formatJam(r.waktu);
        const nama = r.nama || "-";
        const statusClass = r.status === "Telat" ? "tag-telat" : "tag-hadir";
        return `<tr>
          <td>${i + 1}</td>
          <td data-val="${tgl}">${tgl}</td>
          <td data-val="${jam}">${jam}</td>
          <td>${UI.escapeHtml(nama)}</td>
          <td><span class="tag ${statusClass}">${UI.escapeHtml(r.status)}</span></td>
        </tr>`;
      })
      .join("");

    const cntHadir = currentRows.filter((r) => r.status === "Hadir").length;
    const cntTelat = currentRows.filter((r) => r.status === "Telat").length;

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Laporan Presensi — Bhakti Sebatung Academy</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f8; color: #1a202c; font-size: 14px; }
  .wrapper { max-width: 960px; margin: 0 auto; padding: 32px 16px; }
  .header { margin-bottom: 24px; }
  .header h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
  .header p { color: #64748b; font-size: 13px; margin-top: 4px; }
  .meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  .meta-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; }
  .meta-item .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .meta-item .value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .controls { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
  .controls input, .controls select { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; font-size: 13px; outline: none; background: #fff; }
  .controls input:focus, .controls select:focus { border-color: #3b82f6; }
  .controls .btn-print { margin-left: auto; background: #1e40af; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; cursor: pointer; font-weight: 600; }
  .controls .btn-print:hover { background: #1d4ed8; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  thead { background: #0f172a; color: #fff; }
  th { padding: 11px 14px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; user-select: none; white-space: nowrap; }
  th:hover { background: #1e293b; }
  th .sort-icon { opacity: .45; margin-left: 4px; font-style: normal; }
  th.asc .sort-icon::after { content: ' ↑'; opacity: 1; }
  th.desc .sort-icon::after { content: ' ↓'; opacity: 1; }
  th:not(.asc):not(.desc) .sort-icon::after { content: ' ↕'; }
  td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }
  tr.hidden-row { display: none; }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
  .tag-hadir { background: #d1fae5; color: #065f46; }
  .tag-telat { background: #fee2e2; color: #991b1b; }
  .footer { margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
  @media print {
    body { background: #fff; }
    .controls { display: none !important; }
    .wrapper { padding: 0; max-width: 100%; }
    table { box-shadow: none; border: 1px solid #ddd; }
    tr.hidden-row { display: none !important; }
    thead { background: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .tag { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>&#128203; Laporan Presensi Latihan</h1>
    <p>Bhakti Sebatung Academy &mdash; Dicetak pada ${UI.escapeHtml(printDate)}</p>
  </div>
  <div class="meta">
    <div class="meta-item"><div class="label">Periode</div><div class="value" style="font-size:15px">${UI.escapeHtml(periodeLabel)}</div></div>
    <div class="meta-item"><div class="label">Total Data</div><div class="value">${currentRows.length}</div></div>
    <div class="meta-item"><div class="label">Hadir</div><div class="value" style="color:#065f46">${cntHadir}</div></div>
    <div class="meta-item"><div class="label">Telat</div><div class="value" style="color:#991b1b">${cntTelat}</div></div>
  </div>
  <div class="controls">
    <input type="text" id="searchBox" placeholder="&#128269;  Cari nama siswa..." oninput="applyFilter()" />
    <select id="filterStatus" onchange="applyFilter()">
      <option value="">Semua Status</option>
      <option value="Hadir">Hadir</option>
      <option value="Telat">Telat</option>
    </select>
    <span id="countInfo" style="color:#64748b;font-size:13px"></span>
    <button class="btn-print" onclick="window.print()">&#128424; Cetak</button>
  </div>
  <table id="mainTable">
    <thead>
      <tr>
        <th onclick="sortTable(0)">#<i class="sort-icon"></i></th>
        <th onclick="sortTable(1)">Tanggal<i class="sort-icon"></i></th>
        <th onclick="sortTable(2)">Jam<i class="sort-icon"></i></th>
        <th onclick="sortTable(3)">Nama Siswa<i class="sort-icon"></i></th>
        <th onclick="sortTable(4)">Status<i class="sort-icon"></i></th>
      </tr>
    </thead>
    <tbody id="tableBody">${rows}</tbody>
  </table>
  <div class="footer">Laporan ini dibuat otomatis oleh sistem Bhakti Sebatung Academy.</div>
</div>
<script>
  var sortCol = -1, sortAsc = true;
  function applyFilter() {
    var q = document.getElementById('searchBox').value.toLowerCase();
    var st = document.getElementById('filterStatus').value;
    var trs = document.querySelectorAll('#tableBody tr');
    var vis = 0;
    trs.forEach(function(tr) {
      var nama = (tr.cells[3] ? tr.cells[3].textContent : '').toLowerCase();
      var status = tr.cells[4] ? tr.cells[4].textContent.trim() : '';
      var ok = (!q || nama.includes(q)) && (!st || status === st);
      tr.classList.toggle('hidden-row', !ok);
      if (ok) vis++;
    });
    document.getElementById('countInfo').textContent = vis + ' dari ' + trs.length + ' data';
  }
  function sortTable(col) {
    var tbody = document.getElementById('tableBody');
    var ths = document.querySelectorAll('th');
    ths.forEach(function(th) { th.classList.remove('asc','desc'); });
    if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = true; }
    ths[col].classList.add(sortAsc ? 'asc' : 'desc');
    var rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort(function(a, b) {
      var av = (a.cells[col].dataset.val || a.cells[col].textContent).trim();
      var bv = (b.cells[col].dataset.val || b.cells[col].textContent).trim();
      var n = isNaN(+av - +bv) ? av.localeCompare(bv, 'id') : +av - +bv;
      return sortAsc ? n : -n;
    });
    rows.forEach(function(r) { tbody.appendChild(r); });
  }
  applyFilter();
<\/script>
</body>
</html>`;
  }

})();
