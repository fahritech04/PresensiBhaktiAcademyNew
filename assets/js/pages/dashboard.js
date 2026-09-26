(async function () {
  UI.renderPage({ active: "dashboard", title: "Dashboard", desc: "Ringkasan Tampilan Presensi", allowPublic: true });

  const session = Auth.getSession();
  const isPublic = !session;
  const isPelatih = !!(session && session.role === "Pelatih");
  // Pelatih: tanpa card iuran (data keuangan), tapi tetap boleh lihat tombol scan.
  if (isPublic || isPelatih) {
    const iuranCard = document.getElementById("iuranCard");
    if (iuranCard) iuranCard.classList.add("hidden");
  }
  if (isPublic) {
    const btnScan = document.getElementById("btnScanSekarang");
    if (btnScan) btnScan.classList.add("hidden");
  }

  document.getElementById("todayDateLabel").textContent = UI.formatTanggal(new Date(), true);
  document.getElementById("todayTableBody").innerHTML = UI.skeletonRows(4, 3);

  try {
    const data = await Api.call("getDashboardStats");
    renderRing(data);
    renderStats(data);
    renderIuran(data.iuranBulanIni || {});
    renderTrend(data.tren7Hari || []);
    renderTodayTable(data.riwayatHariIni || []);
  } catch (err) {
    UI.toast(err.message, "error");
    document.getElementById("ringHeadline").textContent = "Gagal memuat data";
  }

  function renderIuran(d) {
    document.getElementById("iuranCardDesc").textContent = d.namaBulan ? `Status pembayaran ${d.namaBulan} ${d.tahun}` : "Belum ada data";
    document.getElementById("iuranLunas").textContent = d.lunas ?? 0;
    document.getElementById("iuranBelum").textContent = d.belum ?? 0;
    document.getElementById("iuranTerkumpul").textContent = UI.formatRupiah(d.totalTerkumpul);
  }

  function renderRing(d) {
    const total = d.totalSiswaAktif || 0;
    const hadirTotal = (d.hadirHariIni || 0) + (d.telatHariIni || 0);
    const pct = total ? Math.round((hadirTotal / total) * 100) : 0;
    const r = 52,
      circumference = 2 * Math.PI * r;
    const dash = (pct / 100) * circumference;

    const ring = document.getElementById("ringProgress");
    ring.setAttribute("stroke-dasharray", `${dash} ${circumference}`);
    document.getElementById("ringPct").textContent = pct + "%";
    document.getElementById("ringHeadline").textContent = `${hadirTotal} dari ${total} siswa`;
  }

  function renderStats(d) {
    document.getElementById("statHadir").textContent = d.hadirHariIni ?? 0;
    document.getElementById("statTelat").textContent = d.telatHariIni ?? 0;
    document.getElementById("statBelum").textContent = d.belumPresensiHariIni ?? 0;
    document.getElementById("statTotalFoot").textContent = `Dari ${d.totalSiswaAktif ?? 0} siswa aktif`;
  }

  function renderTrend(rows) {
    const box = document.getElementById("trendChart");
    if (!rows.length) {
      box.innerHTML = '<div class="empty-state"><h3>Belum ada data</h3><p>Grafik akan muncul setelah ada riwayat presensi.</p></div>';
      return;
    }
    const max = Math.max(1, ...rows.map((r) => (r.hadir || 0) + (r.telat || 0)));
    const barW = 30,
      gap = 20,
      chartH = 140;
    const width = rows.length * (barW + gap);

    let bars = "";
    rows.forEach((r, i) => {
      const total = (r.hadir || 0) + (r.telat || 0);
      const hHadir = total ? (r.hadir / max) * chartH : 0;
      const hTelat = total ? (r.telat / max) * chartH : 0;
      const x = i * (barW + gap) + gap / 2;
      const yTelat = chartH - hTelat;
      const yHadir = yTelat - hHadir;
      const label = UI.formatTanggal(r.tanggal).slice(0, 6);
      bars += `
        <g>
          <rect x="${x}" y="${yHadir}" width="${barW}" height="${Math.max(hHadir, 0)}" fill="#1E8F76"></rect>
          <rect x="${x}" y="${yTelat}" width="${barW}" height="${Math.max(hTelat, 0)}" fill="#E0402B"></rect>
          <rect x="${x}" y="${yHadir}" width="${barW}" height="${Math.max(hHadir + hTelat, 0)}" fill="none" stroke="#14181F" stroke-width="1.5"></rect>
          <text x="${x + barW / 2}" y="${chartH + 16}" text-anchor="middle" font-size="9.5" fill="#6B7280" font-family="Space Mono, monospace">${label}</text>
        </g>`;
    });

    box.innerHTML = `
      <div class="flex items-center gap-12" style="margin-bottom:10px;">
        <span class="tag tag-hadir">Hadir</span>
        <span class="tag tag-telat">Telat</span>
      </div>
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${chartH + 26}" width="${Math.max(width, 300)}" height="${chartH + 26}">${bars}</svg>
      </div>`;
  }

  function renderTodayTable(rows) {
    const tbody = document.getElementById("todayTableBody");
    const empty = document.getElementById("todayEmpty");
    if (!rows.length) {
      tbody.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td class="cell-name">${UI.escapeHtml(r.nama)}</td>
        <td style="display: none">${UI.escapeHtml(r.kelompok || "-")}</td>
        <td class="mono">${UI.formatJam(r.waktu)}</td>
        <td><span class="tag ${r.status === "Telat" ? "tag-telat" : "tag-hadir"}">${r.status}</span></td>
      </tr>`,
      )
      .join("");
  }
})();
