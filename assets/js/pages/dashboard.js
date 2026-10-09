(async function () {
  UI.renderPage({ active: "dashboard", title: "Dashboard", desc: "Ringkasan Tampilan Presensi", allowPublic: true });

  let trendTip = null,
    trendTipTimer = null;

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
    const plotH = 140;
    const max = Math.max(1, ...rows.map((r) => (r.hadir || 0) + (r.telat || 0)));

    const bars = rows
      .map((r, i) => {
        const hadir = r.hadir || 0;
        const telat = r.telat || 0;
        const hHadir = hadir > 0 ? Math.max(4, Math.round((hadir / max) * plotH)) : 0;
        const hTelat = telat > 0 ? Math.max(4, Math.round((telat / max) * plotH)) : 0;
        const short = UI.formatTanggal(r.tanggal).slice(0, 6);
        const full = UI.formatTanggal(r.tanggal, true);
        const delay = i * 60;
        const seg =
          (hTelat > 0 ? `<span class="bar-seg seg-telat" style="height:${hTelat}px;animation-delay:${delay}ms"></span>` : "") +
          (hHadir > 0 ? `<span class="bar-seg seg-hadir" style="height:${hHadir}px;animation-delay:${delay + 40}ms"></span>` : "");
        return `
        <div class="trend-bar" tabindex="0" role="img"
             aria-label="${full}: hadir ${hadir}, telat ${telat}"
             data-tip-label="${full}" data-tip-hadir="${hadir}" data-tip-telat="${telat}">
          <div class="bar-stack">${seg}</div>
          <span class="trend-xlabel">${short}</span>
        </div>`;
      })
      .join("");

    box.innerHTML = `
      <div class="trend-legend">
        <span class="legend-item"><i class="dot dot-hadir"></i>Hadir</span>
        <span class="legend-item"><i class="dot dot-telat"></i>Telat</span>
      </div>
      <div class="trend-scroll">
        <div class="trend-plot">${bars}</div>
      </div>`;

    box.querySelectorAll(".bar-seg").forEach((el) => el.classList.add("grow"));
    bindTrendTooltip(box.querySelector(".trend-scroll"));
  }

  /* Tooltip tunggal (fixed) supaya tidak terpotong container scroll. */
  function bindTrendTooltip(scroller) {
    if (!scroller) return;
    if (!trendTip) {
      trendTip = document.createElement("div");
      trendTip.className = "trend-tip";
      trendTip.setAttribute("role", "tooltip");
      document.body.appendChild(trendTip);
    }
    const show = (bar) => {
      clearTimeout(trendTipTimer);
      const rect = bar.querySelector(".bar-stack").getBoundingClientRect();
      trendTip.innerHTML = `<strong>${bar.dataset.tipLabel}</strong>Hadir <b>${bar.dataset.tipHadir}</b> &middot; Telat <b>${bar.dataset.tipTelat}</b>`;
      trendTip.style.left = `${rect.left + rect.width / 2}px`;
      trendTip.style.top = `${rect.top}px`;
      trendTip.classList.add("is-show");
    };
    const hide = () => {
      trendTipTimer = setTimeout(() => trendTip.classList.remove("is-show"), 60);
    };
    const fromEvent = (e) => (e.target.closest(".trend-bar") || null);

    scroller.addEventListener("mouseover", (e) => {
      const bar = fromEvent(e);
      if (bar) show(bar);
    });
    scroller.addEventListener("mouseout", (e) => {
      const bar = fromEvent(e);
      const next = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(".trend-bar") : null;
      if (bar && bar !== next) hide();
    });
    scroller.addEventListener("focusin", (e) => {
      const bar = fromEvent(e);
      if (bar) show(bar);
    });
    scroller.addEventListener("focusout", hide);
    scroller.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
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
