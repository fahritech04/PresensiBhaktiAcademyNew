(function () {
  UI.renderPage({ active: "cetak", title: "Cetak Kode QR", desc: "Buat kartu kode QR untuk dibagikan ke siswa & pelatih" });

  let mode = "siswa";
  let allSiswa = [];
  let allPelatih = [];
  const selected = new Set();

  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const filterKelompok = document.getElementById("filterKelompok");
  const filterJenisKelamin = document.getElementById("filterJenisKelamin");
  const checkAll = document.getElementById("checkAll");
  const thKategori = document.getElementById("thKategori");
  const thNama = document.getElementById("thNama");
  const btnSiswa = document.getElementById("btnSiswa");
  const btnPelatih = document.getElementById("btnPelatih");

  init();

  async function init() {
    document.getElementById("viewHeadActions").innerHTML = '<button class="btn btn-primary btn-sm" id="btnPrint" disabled>Cetak (<span id="countSelected">0</span> Terpilih)</button>';
    document.getElementById("btnPrint").addEventListener("click", printSelected);

    bindEvents();
    tableBody.innerHTML = UI.skeletonRows(4, 5);

    await loadData();
  }

  async function loadData() {
    try {
      if (mode === "siswa") {
        const data = await Api.cached("getSiswaList");
        allSiswa = (data.siswa || []).filter((s) => s.status === "Aktif");
        UI.fillSelect(filterKelompok, data.kelompok || [], "Semua Kelompok");
      } else {
        const data = await Api.cached("getPelatihList");
        allPelatih = (data.pelatih || []).filter((p) => p.status === "Aktif");
      }
      renderTable();
    } catch (err) {
      UI.toast(err.message, "error");
      tableBody.innerHTML = "";
      emptyState.classList.remove("hidden");
    }
  }

  function bindEvents() {
    searchInput.addEventListener("input", renderTable);
    filterKelompok.addEventListener("change", renderTable);
    if (filterJenisKelamin) filterJenisKelamin.addEventListener("change", renderTable);
    checkAll.addEventListener("change", () => {
      getVisibleRows().forEach((s) => (checkAll.checked ? selected.add(s.barcode) : selected.delete(s.barcode)));
      renderTable();
    });
    btnSiswa.addEventListener("click", () => switchMode("siswa"));
    btnPelatih.addEventListener("click", () => switchMode("pelatih"));
  }

  async function switchMode(next) {
    if (mode === next) return;
    mode = next;
    selected.clear();
    // Reset pratinjau kartu lama (siswa/pelatih) saat ganti mode.
    const previewCard = document.getElementById("previewCard");
    const printArea = document.getElementById("print-area");
    if (previewCard) previewCard.style.display = "none";
    if (printArea) printArea.innerHTML = "";
    const isSiswa = mode === "siswa";
    btnSiswa.classList.toggle("btn-primary", isSiswa);
    btnSiswa.classList.toggle("btn-ghost", !isSiswa);
    btnPelatih.classList.toggle("btn-primary", !isSiswa);
    btnPelatih.classList.toggle("btn-ghost", isSiswa);
    // Kolom/filter khusus siswa disembunyikan untuk mode pelatih.
    filterKelompok.style.display = isSiswa ? "" : "none";
    if (filterJenisKelamin) filterJenisKelamin.style.display = isSiswa ? "" : "none";
    if (thKategori) thKategori.textContent = isSiswa ? "Jenis Kelamin" : "Kategori";
    if (thNama) thNama.textContent = isSiswa ? "Nama Siswa" : "Nama Pelatih";
    // Cetak massal hanya untuk siswa. Pelatih = download satu-satu.
    checkAll.style.display = isSiswa ? "" : "none";
    const btnPrint = document.getElementById("btnPrint");
    if (btnPrint) btnPrint.style.display = isSiswa ? "" : "none";
    checkAll.checked = false;
    searchInput.value = "";
    tableBody.innerHTML = UI.skeletonRows(4, 5);
    await loadData();
  }

  function getVisibleRows() {
    const q = searchInput.value.trim().toLowerCase();
    if (mode === "pelatih") {
      return allPelatih.filter((p) => !q || p.nama.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q));
    }
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

    const isSiswa = mode === "siswa";

    tableBody.innerHTML = rows
      .map(
        (s) => `
      <tr>
        ${
          isSiswa
            ? `<td><input type="checkbox" class="rowCheck" data-code="${UI.escapeHtml(s.barcode)}" ${selected.has(s.barcode) ? "checked" : ""}></td>`
            : `<td><button type="button" class="btn btn-ghost btn-icon" title="Download QR" data-download="${UI.escapeHtml(s.barcode)}">${UI.ICONS.download}</button></td>`
        }
        <td class="mono">${UI.escapeHtml(s.barcode)}</td>
        <td class="cell-name">${UI.escapeHtml(s.nama)}</td>
        <td style="display: none">${UI.escapeHtml(s.kelompok || "-")}</td>
        <td>${
          isSiswa
            ? `<span class="tag ${s.jenisKelamin === "Putri" ? "tag-putri" : "tag-putra"}">${UI.escapeHtml(s.jenisKelamin || "Putra")}</span>`
            : '<span class="tag tag-neutral">Pelatih</span>'
        }</td>
      </tr>`,
      )
      .join("");

    if (isSiswa) {
      tableBody.querySelectorAll(".rowCheck").forEach((cb) =>
        cb.addEventListener("change", () => {
          cb.checked ? selected.add(cb.dataset.code) : selected.delete(cb.dataset.code);
          updateCount();
        }),
      );
    } else {
      tableBody.querySelectorAll("[data-download]").forEach((btn) =>
        btn.addEventListener("click", () => downloadPelatihQR(allPelatih.find((p) => p.barcode === btn.dataset.download))),
      );
    }
    updateCount();
  }

  function updateCount() {
    const countEl = document.getElementById("countSelected");
    const btnPrint = document.getElementById("btnPrint");
    if (countEl) countEl.textContent = selected.size;
    if (btnPrint) btnPrint.disabled = selected.size === 0;
  }

  async function printSelected() {
    const list = (mode === "siswa" ? allSiswa : allPelatih).filter((s) => selected.has(s.barcode));
    if (!list.length) return;

    if (typeof QRCode === "undefined") {
      UI.toast("Library QR Code gagal dimuat. Cek koneksi internet lalu coba lagi.", "error");
      return;
    }

    const isSiswa = mode === "siswa";
    const previewCard = document.getElementById("previewCard");
    const printArea = document.getElementById("print-area");
    previewCard.style.display = "block";

    printArea.innerHTML = list
      .map((s) => {
        const ticketClass = isSiswa ? (s.jenisKelamin === "Putri" ? "ticket-putri" : "ticket-putra") : "ticket-putra";
        const metaLine = isSiswa ? `${UI.escapeHtml(s.barcode)} &middot; ${UI.escapeHtml(s.jenisKelamin || "Putra")}` : `${UI.escapeHtml(s.barcode)} &middot; Pelatih`;
        const clubLine = isSiswa ? "Kartu Presensi Latihan.<br>Tunjukkan kode QR ini saat scan." : "Kartu Presensi Pelatih.<br>Tunjukkan kode QR ini saat scan.";
        return `
      <div class="ticket ${ticketClass}">
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
            <div class="code">${metaLine}</div>
            <div class="club">${clubLine}</div>
          </div>
        </div>
      </div>`;
      })
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

  async function downloadPelatihQR(p) {
    if (!p) return;
    if (typeof QRCode === "undefined") {
      UI.toast("Library QR Code gagal dimuat. Cek koneksi internet lalu coba lagi.", "error");
      return;
    }

    const W = 620,
      H = 800,
      QR = 320;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const qr = document.createElement("canvas");
    try {
      await QRCode.toCanvas(qr, p.barcode, { width: QR, margin: 0, color: { dark: "#14181F", light: "#FFFFFF" } });
    } catch (e) {
      UI.toast("Gagal membuat QR code.", "error");
      return;
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#64748B";
    ctx.font = "600 18px 'Bebas Neue', Arial, sans-serif";
    ctx.fillText("Bhakti Sebatung Academy", W / 2, 66);

    ctx.fillStyle = "#14181F";
    ctx.font = "700 46px 'Bebas Neue', Arial, sans-serif";
    ctx.fillText(p.nama, W / 2, 150);

    ctx.fillStyle = "#F49F04";
    ctx.font = "600 22px 'Bebas Neue', Arial, sans-serif";
    ctx.fillText("PELATIH", W / 2, 192);

    ctx.drawImage(qr, (W - QR) / 2, 236, QR, QR);

    ctx.fillStyle = "#14181F";
    ctx.font = "500 24px 'Space Mono', monospace";
    ctx.fillText(p.barcode, W / 2, 620);

    ctx.fillStyle = "#64748B";
    ctx.font = "400 16px Arial, sans-serif";
    ctx.fillText("Tunjukkan kode QR ini saat scan presensi", W / 2, 668);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `QR-Pelatih-${p.nama.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || p.barcode}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function extractNumber(code) {
    const m = String(code).match(/(\d+)$/);
    return m ? m[1] : "";
  }
})();
