/**
 * Pager — pagination reusable (Siswa, Iuran, Pelatih, Presensi, Presensi Pelatih).
 * Dua mode:
 *  - Client (default, 1-based): slice daftar lokal → `pager.slice(filtered)`.
 *  - Server (zeroBased: true, 0-based): offset/limit → pindah halaman memicu
 *    `onPageChange` (biasanya loadData), total via `pager.setTotal(n)`.
 * ID elemen HTML default: #paginationBar #rowInfo #pageSizeSelect #btnFirst
 * #btnPrev #btnNext #btnLast (bisa di-override lewat opts).
 */
const Pager = (() => {
  function create(opts = {}) {
    const zeroBased = !!opts.zeroBased;
    const firstPage = () => (zeroBased ? 0 : 1);
    let page = firstPage();
    let pageSize = opts.pageSize || (zeroBased ? 500 : 25);
    let total = 0;

    const bar = document.getElementById(opts.barId || "paginationBar");
    const rowInfo = document.getElementById(opts.rowInfoId || "rowInfo");
    const sizeSelect = document.getElementById(opts.sizeSelectId || "pageSizeSelect");
    const btnFirst = document.getElementById(opts.btnFirstId || "btnFirst");
    const btnPrev = document.getElementById(opts.btnPrevId || "btnPrev");
    const btnNext = document.getElementById(opts.btnNextId || "btnNext");
    const btnLast = document.getElementById(opts.btnLastId || "btnLast");

    function totalPages() {
      return Math.max(1, Math.ceil(total / pageSize));
    }

    function clamp() {
      if (zeroBased) page = Math.min(Math.max(0, page), totalPages() - 1);
      else page = Math.min(Math.max(1, page), totalPages());
    }

    /** Sinkronkan teks info + state tombol dengan state saat ini. */
    function sync() {
      const pages = totalPages();
      const isFirst = zeroBased ? page === 0 : page === 1;
      const isLast = zeroBased ? (page + 1) * pageSize >= total : page >= pages;
      if (btnFirst) btnFirst.disabled = isFirst;
      if (btnPrev) btnPrev.disabled = isFirst;
      if (btnNext) btnNext.disabled = isLast;
      if (btnLast) btnLast.disabled = isLast;

      if (!total) {
        if (opts.hideWhenEmpty !== false && bar) {
          bar.classList.add("hidden");
          return;
        }
        if (rowInfo) rowInfo.textContent = "0 data";
        return;
      }
      if (bar) bar.classList.remove("hidden");
      if (!rowInfo) return;
      const shown = zeroBased ? page + 1 : page;
      const from = (zeroBased ? page * pageSize : (page - 1) * pageSize) + 1;
      const to = Math.min((zeroBased ? page + 1 : page) * pageSize, total);
      rowInfo.textContent = `${from}-${to} dari ${total} ${opts.itemLabel || "data"} \u00b7 hal. ${shown}/${pages}`;
    }

    /** Pindah ke halaman (auto-clamp). Klik tombol nav / pageSize ganti. */
    function goToPage(next) {
      const target = zeroBased
        ? Math.min(Math.max(0, next), totalPages() - 1)
        : Math.min(Math.max(1, next), totalPages());
      if (target === page) return;
      page = target;
      sync();
      if (opts.onPageChange) opts.onPageChange(page);
      const wrap = document.querySelector(".table-wrap");
      if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function changePageSize(n) {
      pageSize = Number(n) || pageSize;
      page = firstPage();
      sync();
      if (opts.onPageChange) opts.onPageChange(page);
    }

    /** Kembali ke halaman pertama (tanpa memicu onPageChange). */
    function reset() {
      page = firstPage();
      sync();
    }

    /** Set total data (server-side) — clamp halaman + sinkron UI. */
    function setTotal(n) {
      total = Number(n) || 0;
      clamp();
      sync();
    }

    /** Potong daftar untuk halaman aktif (client-side) + sinkron UI. */
    function slice(list) {
      setTotal(list.length);
      const start = (page - firstPage()) * pageSize;
      return list.slice(start, start + pageSize);
    }

    function bind() {
      if (btnFirst) btnFirst.addEventListener("click", () => goToPage(firstPage()));
      if (btnPrev) btnPrev.addEventListener("click", () => goToPage(page - 1));
      if (btnNext) btnNext.addEventListener("click", () => goToPage(page + 1));
      if (btnLast) btnLast.addEventListener("click", () => goToPage(totalPages()));
      if (sizeSelect) sizeSelect.addEventListener("change", () => changePageSize(sizeSelect.value));
    }

    return {
      bind,
      goToPage,
      changePageSize,
      reset,
      setTotal,
      slice,
      sync,
      currentPage: () => page,
      pageSize: () => pageSize,
      totalPages,
      total: () => total,
    };
  }

  return { create };
})();
