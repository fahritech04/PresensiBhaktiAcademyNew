const UI = (() => {
  const ICONS = {
    dashboard:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    siswa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="21" y2="14"/><line x1="14" y1="21" x2="21" y2="21"/><line x1="17.5" y1="14" x2="17.5" y2="21"/></svg>',
    presensi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    cetak:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    logout:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alertTriangle:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    printer:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    wallet:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
    history:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13a9 9 0 1 0 2.13-8.36L3 8"/><path d="M12 7v5l4 2"/></svg>',
  };

  Object.keys(ICONS).forEach((key) => {
    ICONS[key] = ICONS[key].replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
  });

  const NAV_ITEMS = [
    { key: "dashboard", href: "/dashboard/", label: "Dashboard", icon: ICONS.dashboard },
    { key: "siswa", href: "/siswa/", label: "Siswa", icon: ICONS.siswa },
    { key: "scan", href: "/scan/", label: "Scan", icon: ICONS.scan, fab: true },
    { key: "presensi", href: "/presensi/", label: "Riwayat", icon: ICONS.presensi },
    { key: "iuran", href: "/iuran/", label: "Iuran", icon: ICONS.wallet },
    { key: "cetak", href: "/cetak-barcode/", label: "Cetak QR", icon: ICONS.cetak },
  ];

  function renderShell({ active, title, desc }) {
    const session = Auth.getSession() || {};

    const topbarRoot = document.getElementById("topbar-root");
    const tabbarRoot = document.getElementById("tabbar-root");
    if (!topbarRoot || !tabbarRoot) return;

    topbarRoot.outerHTML = `
      <header class="topbar" id="topbar-root">
        <a class="skip-link" href="#mainContent">Lewati ke konten utama</a>
        <a href="/dashboard/" class="brand">
          <img src="/assets/img/bhakti_academy_logo.png" alt="Bhakti Sebatung Academy" class="mark-logo" id="brandLogo" />
          <b>Bhakti Sebatung Academy</b>
        </a>
        <nav class="topnav" aria-label="Navigasi utama">
          ${NAV_ITEMS.map(
            (item) => `
            <a href="${item.href}" class="${item.key === active ? "active" : ""}"${item.key === active ? ' aria-current="page"' : ""}>${item.icon}<span>${item.label}</span></a>`,
          ).join("")}
        </nav>
        <div class="topbar-right">
          <div class="user-chip">
            <div><b>${escapeHtml(session.nama || "Admin")}</b><span>${escapeHtml(session.role || "Pengurus")}</span></div>
          </div>
          <button type="button" class="btn btn-ghost btn-icon topbar-logout" id="btnLogout" title="Keluar" aria-label="Keluar">${ICONS.logout}</button>
        </div>
      </header>`;

    tabbarRoot.outerHTML = `
      <nav class="tabbar" id="tabbar-root" aria-label="Navigasi utama">
        ${NAV_ITEMS.map((item) =>
            item.fab
              ? `
          <a href="${item.href}" class="scan-fab ${item.key === active ? "active" : ""}"${item.key === active ? ' aria-current="page"' : ""}>
            <span class="fab">${item.icon}</span><span>${item.label}</span>
          </a>`
              : `
          <a href="${item.href}" class="${item.key === active ? "active" : ""}"${item.key === active ? ' aria-current="page"' : ""}>${item.icon}<span>${item.label}</span></a>`,
          )
          .join("")}
      </nav>`;

    document.getElementById("btnLogout").addEventListener("click", () => Auth.logout());

    // Fallback: kalau logo belum ada / gagal dimuat, balik ke kotak teks "BB"
    // supaya tidak muncul ikon gambar rusak.
    const brandLogo = document.getElementById("brandLogo");
    if (brandLogo) {
      brandLogo.addEventListener(
        "error",
        () => {
          brandLogo.outerHTML = '<div class="mark">BB</div>';
        },
        { once: true },
      );
    }

    const head = document.getElementById("viewHead");
    if (head) {
      head.innerHTML = `
        <div class="view-head-row">
          <div><span class="view-eyebrow">Bhakti Sebatung Academy</span><h1>${escapeHtml(title)}</h1>${desc ? `<p>${escapeHtml(desc)}</p>` : ""}</div>
          <div id="viewHeadActions"></div>
        </div>`;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
  }

  function optionsHtml(values) {
    return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function setButtonLoading(button, isLoading, idleLabel) {
    button.disabled = isLoading;
    button.setAttribute("aria-busy", String(isLoading));
    if (isLoading) {
      button.innerHTML = '<span class="spin-sm"></span> Menyimpan...';
    } else {
      button.textContent = idleLabel;
    }
  }

  /* ---------------------------- TOAST ---------------------------- */
  function ensureToastStack() {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, type = "info") {
    const stack = ensureToastStack();
    const el = document.createElement("div");
    el.className = `toast ${type === "success" ? "ok" : type === "error" ? "err" : ""}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.setAttribute("aria-atomic", "true");
    const icon = type === "success" ? ICONS.check : type === "error" ? ICONS.alertTriangle : "";
    el.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s, transform .25s";
      el.style.opacity = "0";
      el.style.transform = "translateX(24px)";
      setTimeout(() => el.remove(), 260);
    }, 3600);
  }

  /* --------------------------- LOADING VEIL --------------------------- */
  function showVeil() {
    if (document.querySelector(".veil")) return;
    const veil = document.createElement("div");
    veil.className = "veil";
    veil.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(veil);
  }
  function hideVeil() {
    const veil = document.querySelector(".veil");
    if (veil) veil.remove();
  }

  /* --------------------------- SKELETON LOADER --------------------------- */
  /** Skeleton baris tabel — dipakai saat data sedang di-fetch, terasa lebih cepat drpd veil penuh. */
  function skeletonRows(colCount, rowCount = 4) {
    let html = "";
    for (let r = 0; r < rowCount; r++) {
      html += '<tr class="skel-row">' + `<td><div class="skel" style="height:14px;"></div></td>`.repeat(colCount) + "</tr>";
    }
    return html;
  }
  /** Skeleton block generik, mis. untuk stat tile saat memuat. */
  function skeletonBlock(height = 20, width = "60%") {
    return `<div class="skel" style="height:${height}px;width:${width};"></div>`;
  }

  /* ------------------------- CONFIRM DIALOG ------------------------- */
  function ensureConfirmModal() {
    if (document.getElementById("confirmModal")) return;
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="modal-backdrop" id="confirmModal">
        <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmDesc" tabindex="-1" style="max-width:380px;">
          <div class="modal-head">
            <div>
              <h3 id="confirmTitle">Konfirmasi</h3>
              <p class="desc" id="confirmDesc"></p>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" id="confirmCancel">Batal</button>
            <button type="button" class="btn btn-danger" id="confirmOk">Ya, Lanjutkan</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  function confirmDialog(message, { title = "Konfirmasi", okLabel = "Ya, Lanjutkan" } = {}) {
    ensureConfirmModal();
    const modal = document.getElementById("confirmModal");
    closeModal("confirmModal");
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmDesc").textContent = message;
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");
    okBtn.textContent = okLabel;

    return new Promise((resolve) => {
      let result = false;
      const onOk = () => {
        result = true;
        closeModal("confirmModal");
      };
      const onCancel = () => closeModal("confirmModal");
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      showModal(modal, cancelBtn, () => {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        resolve(result);
      });
    });
  }

  /* ---------------------------- GENERIC MODAL ---------------------------- */
  const modalStates = new Map();

  function focusableElements(dialog) {
    return Array.from(dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]')).filter(
      (element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert]") && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden",
    );
  }

  function showModal(modal, initialFocus, onClose = () => {}) {
    if (modalStates.has(modal)) return;
    const dialog = modal.querySelector(".modal");
    const previousFocus = document.activeElement;
    const title = dialog.querySelector(".modal-head h2, .modal-head h3");
    const desc = dialog.querySelector(".modal-head .desc");
    if (!dialog.hasAttribute("role")) dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("tabindex", "-1");
    if (title && !dialog.hasAttribute("aria-labelledby")) {
      if (!title.id) title.id = `${modal.id}Title`;
      dialog.setAttribute("aria-labelledby", title.id);
    }
    if (desc && !dialog.hasAttribute("aria-describedby")) {
      if (!desc.id) desc.id = `${modal.id}Desc`;
      dialog.setAttribute("aria-describedby", desc.id);
    }

    const isTopModal = () => Array.from(modalStates.keys()).pop() === modal;
    const isSaving = () => !!dialog.querySelector('button[type="submit"]:disabled, input[type="submit"]:disabled');
    const focusFirst = () => {
      const elements = focusableElements(dialog);
      const target = elements.includes(initialFocus) ? initialFocus : elements.find((element) => element.matches("input, select, textarea")) || elements[0] || dialog;
      target.focus({ preventScroll: true });
    };
    const onKeyDown = (event) => {
      if (!isTopModal()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!isSaving()) closeModal(modal.id);
      } else if (event.key === "Tab") {
        const elements = focusableElements(dialog);
        const index = elements.indexOf(document.activeElement);
        if (index === -1 || (event.shiftKey ? index === 0 : index === elements.length - 1)) {
          event.preventDefault();
          (elements[event.shiftKey ? elements.length - 1 : 0] || dialog).focus();
        }
      }
    };
    const onFocusIn = (event) => {
      if (isTopModal() && !dialog.contains(event.target)) focusFirst();
    };
    const onClick = (event) => {
      // Save handlers close programmatically before their finally block re-enables Submit.
      if (isSaving() && event.target.closest(".modal-close, #btnBatal, #confirmCancel")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    modalStates.set(modal, (restoreFocus) => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      modal.removeEventListener("click", onClick, true);
      onClose();
      if (restoreFocus) {
        const remainingModal = Array.from(modalStates.keys()).pop();
        const canRestore = previousFocus && previousFocus.isConnected && previousFocus.getClientRects().length && !previousFocus.matches(":disabled") && (!remainingModal || remainingModal.contains(previousFocus));
        const target = canRestore ? previousFocus : remainingModal ? remainingModal.querySelector(".modal") : document.getElementById("mainContent");
        if (target) target.focus({ preventScroll: true });
      }
    });
    modal.classList.add("show");
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    modal.addEventListener("click", onClick, true);
    focusFirst();
  }

  function openModal(id) {
    showModal(document.getElementById(id));
  }
  function closeModal(id) {
    const modal = document.getElementById(id);
    const cleanup = modalStates.get(modal);
    const restoreFocus = Array.from(modalStates.keys()).pop() === modal;
    modal.classList.remove("show");
    modalStates.delete(modal);
    document.body.classList.toggle("modal-open", !!document.querySelector(".modal-backdrop.show"));
    if (cleanup) cleanup(restoreFocus);
  }

  /* ---------------------------- FORMATTERS ---------------------------- */
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu"];
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  function formatTanggal(dateLike, withHari = false) {
    const d = new Date(dateLike);
    if (isNaN(d)) return "-";
    const s = `${String(d.getDate()).padStart(2, "0")} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
    return withHari ? `${HARI[d.getDay()]}, ${s}` : s;
  }

  function formatJam(dateLike) {
    const d = new Date(dateLike);
    if (isNaN(d)) return "-";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function dateToISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function todayISO() {
    return dateToISO(new Date());
  }

  function initials(name) {
    return String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("");
  }

  function formatRupiah(n) {
    const num = Number(n) || 0;
    return "Rp" + num.toLocaleString("id-ID");
  }

  return {
    ICONS,
    renderShell,
    toast,
    showVeil,
    hideVeil,
    skeletonRows,
    skeletonBlock,
    confirmDialog,
    openModal,
    closeModal,
    formatTanggal,
    formatJam,
    dateToISO,
    todayISO,
    initials,
    formatRupiah,
    escapeHtml,
    optionsHtml,
    setButtonLoading,
  };
})();
