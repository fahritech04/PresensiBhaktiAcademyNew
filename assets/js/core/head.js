/**
 * head.js — Injeksi elemen <head> yang sama di semua halaman.
 * Dipanggil tanpa defer agar berjalan sebelum style.css diproses.
 * Font & favicon cukup didefinisikan di SATU tempat (file ini saja),
 * dipakai oleh SEMUA halaman — tanpa pengulangan di HTML.
 */
(function () {
  const h = document.head;

  // Keamanan: tidak sampa path halaman ke situs luar (Google Fonts, wa.me, dst.)
  // supaya informasi navigasi/internal tidak tampil di network public (Referer).
  const referrer = document.createElement("meta");
  referrer.name = "referrer";
  referrer.content = "no-referrer";
  h.appendChild(referrer);

  // Webfonts SELF-HOSTED (assets/fonts, latin subset) — preload supaya
  // font jadi secepat mungkin + no flash berantakan (FOUT). Tidak lagi
  // depend Google Fonts / gstatic (1 roundtrip kurang, nol referrer leak
  // ke situs luar). Regras @font-face di assets/css/style.css.
  [
    { href: "/assets/fonts/inter-latin.woff2" },
    { href: "/assets/fonts/bebas-latin.woff2" },
    { href: "/assets/fonts/spacemono-400.woff2" },
    { href: "/assets/fonts/spacemono-700.woff2" },
  ].forEach(function (opt) {
    const l = document.createElement("link");
    l.rel = "preload";
    l.as = "font";
    l.type = "font/woff2";
    l.crossOrigin = "anonymous";
    l.href = opt.href;
    h.appendChild(l);
  });

  // Favicons — injection via JS supaya hanya 1 tempat simpan (DRY).
  // ?v= cache-busting: browser caches favicon per-origin sangat intens;
  // URL versiyon baru biar re-fetch, jadi cukup update VCACHE di sini saja.
  const VCACHE = "20260923-1";
  [
    { rel: "icon", type: "image/png", href: `/assets/favicon/favicon-96x96.png?v=${VCACHE}`, sizes: "96x96" },
    { rel: "icon", type: "image/svg+xml", href: `/assets/favicon/favicon.svg?v=${VCACHE}` },
    { rel: "shortcut icon", href: `/assets/favicon/favicon.ico?v=${VCACHE}` },
  ].forEach(function (opt) {
    const l = document.createElement("link");
    l.rel = opt.rel;
    if (opt.type) l.type = opt.type;
    l.href = opt.href;
    if (opt.sizes) l.sizes = opt.sizes;
    h.appendChild(l);
  });
})();
