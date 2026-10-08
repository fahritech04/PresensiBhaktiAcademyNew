/**
 * head.js — Injeksi elemen <head> yang sama di semua halaman (tanpa defer,
 * berjalan sebelum CSS diproses). Font & favicon cukup di SATU tempat.
 */
(function () {
  const h = document.head;

  // No-referrer: jangan bocorkan path halaman ke situs luar.
  const referrer = document.createElement("meta");
  referrer.name = "referrer";
  referrer.content = "no-referrer";
  h.appendChild(referrer);

  // Font self-hosted (assets/fonts) — preload biar cepat & tanpa FOUT.
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

  // Favicon — 1 tempat simpan. ?v= cache-buster: naikkan VCACHE saat rilis.
  const VCACHE = "fe3ec19f";
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
