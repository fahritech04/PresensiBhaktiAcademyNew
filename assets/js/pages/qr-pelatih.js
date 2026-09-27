(function () {
  const session = Auth.getSession();
  if (!session) {
    Auth.guardPage();
    return;
  }
  if (session.role !== "Pelatih") {
    window.location.replace("/dashboard/");
    return;
  }

  UI.renderPage({ active: "qr-pelatih", title: "Kode QR Saya", desc: "Kartu kode QR presensi untuk akun pelatih ini" });

  const qrCard = document.getElementById("qrCard");
  const headActions = document.getElementById("viewHeadActions");

  init();

  async function init() {
    headActions.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btnCetak" disabled>Cetak</button>
      <button class="btn btn-secondary btn-sm" id="btnDownload" disabled>Download PNG</button>`;
    document.getElementById("btnCetak").addEventListener("click", () => window.print());
    document.getElementById("btnDownload").addEventListener("click", downloadPNG);

    try {
      const pelatih = await Api.call("getPelatihSelf");
      renderCard(pelatih);
    } catch (err) {
      qrCard.innerHTML = `<div class="empty-state"><h3>Data tidak ditemukan</h3><p>${UI.escapeHtml(err.message)}</p></div>`;
      setActionsEnabled(false);
    }
  }

  function setActionsEnabled(enabled) {
    const btnCetak = document.getElementById("btnCetak");
    const btnDownload = document.getElementById("btnDownload");
    if (btnCetak) btnCetak.disabled = !enabled;
    if (btnDownload) btnDownload.disabled = !enabled;
  }

  function renderCard(p) {
    if (typeof QRCode === "undefined") {
      qrCard.innerHTML = '<div class="empty-state"><h3>Library QR gagal dimuat</h3><p>Cek koneksi internet lalu muat ulang halaman.</p></div>';
      setActionsEnabled(false);
      return;
    }

    const verified = p.verifikasi === true;
    setActionsEnabled(verified);

    qrCard.innerHTML = `
      <div class="qr-self-wrap">
        <div class="ticket ticket-putra">
          <div class="ticket-top">
            <div>
              <div class="brand">Bhakti Sebatung Academy</div>
              <div class="name"><span>${UI.escapeHtml(p.nama)}</span></div>
            </div>
            <div class="ticket-num">${extractNumber(p.barcode)}</div>
          </div>
          <div class="ticket-bottom">
            <div class="qr-box"><canvas data-code="${UI.escapeHtml(p.barcode)}"></canvas></div>
            <div class="meta">
              <div class="code">${UI.escapeHtml(p.barcode)} &middot; Pelatih</div>
              <div class="club">Kartu Presensi Pelatih.<br>Tunjukkan kode QR ini saat scan.</div>
            </div>
          </div>
        </div>
        <div class="qr-self-meta">
          <span class="tag ${verified ? "tag-aktif" : "tag-nonaktif"}">${verified ? "Terverifikasi" : "Belum Diverifikasi"}</span>
          ${verified ? "" : '<p class="muted">Akun belum diverifikasi. Hubungi pengurus untuk verifikasi agar bisa cetak/download/scan presensi.</p>'}
        </div>
      </div>`;

    QRCode.toCanvas(qrCard.querySelector("canvas[data-code]"), p.barcode, { width: 96, margin: 0, color: { dark: "#14181F", light: "#FFFFFF" } }, (err) => {
      if (err) console.error(err);
    });
    window.pelatihData = p;
  }

  function extractNumber(code) {
    const m = String(code).match(/(\d+)$/);
    return m ? m[1] : "";
  }

  async function downloadPNG() {
    if (!window.pelatihData) return;
    const p = window.pelatihData;
    if (typeof QRCode === "undefined") {
      UI.toast("Library QR gagal dimuat.", "error");
      return;
    }

    const W = 620, H = 800, QR = 320;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

    const qr = document.createElement("canvas");
    try {
      await QRCode.toCanvas(qr, p.barcode, { width: QR, margin: 0, color: { dark: "#14181F", light: "#FFFFFF" } });
    } catch (e) { UI.toast("Gagal membuat QR code.", "error"); return; }

    ctx.textAlign = "center";
    ctx.fillStyle = "#64748B"; ctx.font = "600 18px 'Bebas Neue', Arial, sans-serif"; ctx.fillText("Bhakti Sebatung Academy", W / 2, 66);
    ctx.fillStyle = "#14181F"; ctx.font = "700 46px 'Bebas Neue', Arial, sans-serif"; ctx.fillText(p.nama, W / 2, 150);
    ctx.fillStyle = "#F49F04"; ctx.font = "600 22px 'Bebas Neue', Arial, sans-serif"; ctx.fillText("PELATIH", W / 2, 192);
    ctx.drawImage(qr, (W - QR) / 2, 236, QR, QR);
    ctx.fillStyle = "#14181F"; ctx.font = "500 24px 'Space Mono', monospace"; ctx.fillText(p.barcode, W / 2, 620);
    ctx.fillStyle = "#64748B"; ctx.font = "400 16px Arial, sans-serif"; ctx.fillText("Tunjukkan kode QR ini saat scan presensi", W / 2, 668);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `QR-Pelatih-${p.nama.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || p.barcode}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    UI.toast("PNG tersimpan.", "success");
  }
})();
