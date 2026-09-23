(function () {
  UI.renderPage({ active: "cetak", title: "Cetak Kode QR", desc: "Buat kartu kode QR untuk dibagikan ke siswa" });

  let allSiswa = [];
  const selected = new Set();

  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const filterKelompok = document.getElementById("filterKelompok");
  const filterJenisKelamin = document.getElementById("filterJenisKelamin");
  const checkAll = document.getElementById("checkAll");

  init();

  async function init() {
    document.getElementById("viewHeadActions").innerHTML = '<button class="btn btn-primary btn-sm" id="btnPrint" disabled>Cetak (<span id="countSelected">0</span> Terpilih)</button>';
    document.getElementById("btnPrint").addEventListener("click", printSelected);

    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(4, 5);

    try {
      const data = await Api.cached("getSiswaList");
      allSiswa = (data.siswa || []).filter((s) => s.status === "Aktif");
      UI.fillSelect(filterKelompok, data.kelompok || [], "Semua Kelompok");
      renderTable();
    } catch (err) {
      UI.toast(err.message, "error");
      tableBody.innerHTML = "";
    }
  }

  function bindEvents() {
    searchInput.addEventListener("input", renderTable);
    filterKelompok.addEventListener("change", renderTable);
    if (filterJenisKelamin) filterJenisKelamin.addEventListener("change", renderTable);
    checkAll.addEventListener("change", () => {
      getVisibleRows().forEach((s) => (checkAll.checked ? selected.add(s.id) : selected.delete(s.id)));
      renderTable();
    });
  }

  function getVisibleRows() {
    const q = searchInput.value.trim().toLowerCase();
    const kel = filterKelompok.value;
    const jk = filterJenisKelamin ? filterJenisKelamin.value : "";
    return allSiswa.filter((s) => {
      const matchQ = !q || s.nama.toLowerCase().includes(q) || s.barcode.toLowerCase().includes(q);
      const matchKel = !kel || s.kelompok === kel;
      const matchJk = !jk || s.jenisKelamin === jk;
      return matchQ && matchKel && matchJk;
    });
  }

  function renderTable() {
    const rows = getVisibleRows();
    if (!rows.length) {
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
      updateCount();
      return;
    }
    emptyState.classList.add("hidden");

    tableBody.innerHTML = rows
      .map(
        (s) => `
      <tr>
        <td><input type="checkbox" class="rowCheck" data-id="${s.id}" ${selected.has(s.id) ? "checked" : ""}></td>
        <td class="mono">${UI.escapeHtml(s.barcode)}</td>
        <td class="cell-name">${UI.escapeHtml(s.nama)}</td>
        <td style="display: none">${UI.escapeHtml(s.kelompok || "-")}</td>
        <td>
          <span class="tag ${s.jenisKelamin === "Putri" ? "tag-putri" : "tag-putra"}">${UI.escapeHtml(s.jenisKelamin || "Putra")}</span>
        </td>
      </tr>`,
      )
      .join("");

    tableBody.querySelectorAll(".rowCheck").forEach((cb) =>
      cb.addEventListener("change", () => {
        cb.checked ? selected.add(cb.dataset.id) : selected.delete(cb.dataset.id);
        updateCount();
      }),
    );
    updateCount();
  }

  function updateCount() {
    const countEl = document.getElementById("countSelected");
    const btnPrint = document.getElementById("btnPrint");
    if (countEl) countEl.textContent = selected.size;
    if (btnPrint) btnPrint.disabled = selected.size === 0;
  }

  async function printSelected() {
    const list = allSiswa.filter((s) => selected.has(s.id));
    if (!list.length) return;

    if (typeof QRCode === "undefined") {
      UI.toast("Library QR Code gagal dimuat. Cek koneksi internet lalu coba lagi.", "error");
      return;
    }

    const previewCard = document.getElementById("previewCard");
    const printArea = document.getElementById("print-area");
    previewCard.style.display = "block";

    printArea.innerHTML = list
      .map(
        (s) => `
      <div class="ticket">
        <div class="ticket-top">
          <div>
            <div class="brand">Bhakti Sebatung Academy</div>
            <div class="name"><span>${UI.escapeHtml(s.nama)}</span></div>
            <div class="grp" style="display: none">${UI.escapeHtml(s.kelompok || "-")}</div>
          </div>
          <div class="ticket-num">${extractNumber(s.barcode)}</div>
        </div>
        <div class="ticket-bottom">
          <div class="qr-box"><canvas data-code="${UI.escapeHtml(s.barcode)}"></canvas></div>
          <div class="meta">
            <div class="code">${UI.escapeHtml(s.barcode)} &middot; ${UI.escapeHtml(s.jenisKelamin || "Putra")}</div>
            <div class="club">Kartu Presensi Latihan.<br>Tunjukkan kode QR ini saat scan.</div>
          </div>
        </div>
      </div>`,
      )
      .join("");

    printArea.querySelectorAll("canvas[data-code]").forEach((canvas) => {
      QRCode.toCanvas(canvas, canvas.dataset.code, { width: 96, margin: 0, color: { dark: "#14181F", light: "#FFFFFF" } }, (err) => {
        if (err) console.error(err);
      });
    });

    await document.fonts.ready;
    // Fit long names inside the reserved space without cutting off any text.
    printArea.querySelectorAll(".name").forEach((name) => {
      const text = name.firstElementChild;
      if (text.scrollHeight > name.clientHeight) {
        const fontSize = parseFloat(getComputedStyle(name).fontSize);
        name.style.fontSize = `${fontSize * name.clientHeight / text.scrollHeight}px`;
      }
    });

    previewCard.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => window.print(), 350);
  }

  function extractNumber(code) {
    const m = String(code).match(/(\d+)$/);
    return m ? m[1] : "";
  }
})();
