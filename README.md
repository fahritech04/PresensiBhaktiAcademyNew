# 🏀 Sistem Presensi — Bhakti Sebatung Academy

Web presensi latihan basket berbasis **scan kode QR**, dibangun dengan HTML/CSS/JavaScript
native (tanpa framework) + **Supabase** (Postgres + Edge Function) sebagai backend utama,
dan **Google Apps Script + Spreadsheet** khusus untuk fitur Monitoring & Evaluasi.
Cocok dihosting gratis di **GitHub Pages**.

### ✨ Pembaruan Terbaru

- **Kolom Jenis Kelamin** — tabel Monitoring & Evaluasi menampilkan **Jenis Kelamin**
  (bukan Kelompok), diambil langsung dari Supabase (`siswa.jenis_kelamin`). Kolom
  Kelompok tetap tersimpan di data & sheet GAS sebagai snapshot riwayat.
- **Menu desktop 2 baris** — header (≥1200px) menampilkan brand + user di baris satu,
  seluruh menu di baris kedua full-width (auto wrap) — tidak pernah berdesakan walau
  menu bertambah. Mobile (drawer + bottom tab) tetap seperti sebelumnya.
- **Header solid** — background topbar/drawer kini warna solid (sebelumnya alpha 98%
  yang terlihat transparan saat konten scroll di belakangnya).
- **Pagination reusable** — satu modul `assets/js/core/pager.js` dipakai semua halaman
  bertabel (Siswa, Iuran, Pelatih, Presensi, Presensi Pelatih). Dua mode: client-side
  slice & server-side offset/limit. Riwayat Presensi default **50 data/halaman**.
- **Optimasi backend Monitoring (GAS)** — action gabungan `getRekapEvaluasiBulanan`
  (1 round-trip, dulu 2), tulis batch `setValues` tunggal (dulu 2–3 panggilan sheet),
  cache server 60s (tulis selalu invalidate), lock timeout 5s, load siswa+penilaian
  paralel di frontend.
- **Optimasi free tier** — riwayat presensi memakai pagination, dashboard menghitung
  agregat iuran langsung di database, index untuk scan barcode, dan cache `localStorage`.
- **Fitur: Iuran Bulanan** — catat status bayar iuran per siswa per bulan (Lunas/Belum
  Bayar) lengkap riwayat & ringkasan di Dashboard.
- **URL bersih tanpa `.html`** — semua halaman diakses tanpa akhiran `.html`.
- **Desain "Bold Court"** — warna flat, garis outline tegas, bayangan solid; navigasi
  top bar (desktop) + bottom tab bar dengan tombol Scan menonjol (mobile).
- **Kode QR (2D)** — menggantikan barcode 1D, lebih mudah dipindai dari berbagai sudut.
- **Loading cepat** — script `defer`, skeleton shimmer per bagian, font dioptimalkan.

---

## 📁 Struktur Proyek

> **URL bersih (tanpa `.html`)**: setiap halaman kecuali `index.html` di root disimpan
> sebagai `nama-folder/index.html` sehingga bisa diakses tanpa ekstensi (mis.
> `/dashboard/`). Semua path asset absolut (diawali `/`).

```
bhakti-basketball-attendance/
├── index.html                # Halaman login admin (diakses di "/")
├── dashboard/index.html      # Ringkasan & statistik kehadiran
├── siswa/index.html          # CRUD data siswa
├── scan/index.html           # Scan presensi (scanner / kamera) — kode QR
├── presensi/index.html       # Riwayat & rekap presensi (default 50/halaman)
├── iuran/index.html          # CRUD status bayar iuran bulanan
├── cetak-barcode/index.html  # Cetak kartu kode QR siswa
├── monitoring/index.html     # Penilaian skill per sesi latihan
├── evaluasi/index.html       # Evaluasi bulanan per siswa
├── pelatih/index.html        # CRUD data pelatih
├── presensi-pelatih/index.html # Riwayat presensi pelatih
├── qr-pelatih/index.html     # Kode QR login pelatih
├── maintenance.html          # Halaman pemeliharaan (opsional)
├── gas-backend/
│   ├── Code.gs               # Source Apps Script (tempel ke GAS saat setup)
│   └── Sistem_Monitoring_Latihan_Basket.xlsx  # Template spreadsheet GAS
├── supabase/
│   ├── schema.sql            # MASTER skema: tabel, RLS, seluruh fungsi rpc_
│   ├── hardening.sql         # DELTA keamanan: bcrypt, token hash, anti brute-force IP
│   ├── backdate_presensi.sql # DELTA: scan telat / latihan hari lama (p_tanggal)
│   ├── pelatih.sql / pelatih_google.sql / pelatih_verifikasi.sql / public_access.sql
│   ├── config.toml           # Konfigurasi project Supabase (CLI)
│   └── functions/api/        # Edge Function router tipis (memanggil rpc_* sesuai action)
└── assets/
    ├── css/style.css         # Semua styling (design system "Bold Court")
    ├── favicon/              # Icon website & Web Manifest
    ├── img/                  # Asset gambar (logo, foto academy)
    └── js/
        ├── core/             # Pondasi aplikasi
        │   ├── head.js       # Injeksi favicon & Google Fonts terpusat
        │   ├── config.js     # ⚠️ Kredensial Supabase & GAS (lihat Setup)
        │   ├── api.js        # Wrapper ke Edge Function Supabase (+ cache statis)
        │   ├── api-gas.js    # Wrapper ke Google Apps Script (monitoring/evaluasi)
        │   ├── auth.js       # Sesi login & guard halaman
        │   ├── ui.js         # Komponen bersama (nav, toast, modal, skeleton)
        │   └── pager.js      # Pagination reusable (client & server mode)
        ├── pages/            # Logika per halaman
        └── vendor/           # qrcode.min.js & html5-qrcode.min.js (bundle lokal)
```

---

## 🚀 Instalasi

### A. Backend Supabase (presensi, siswa, iuran, dll)

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan `supabase/schema.sql`.
3. Jalankan `supabase/hardening.sql`, lalu `supabase/backdate_presensi.sql`
   (urutan wajib: **schema → hardening → backdate**). Skema delta lain
   (`pelatih*.sql`, `public_access.sql`) sesuai fitur yang dipakai.
4. Deploy Edge Function: `supabase functions deploy api --no-verify-jwt`.
5. Set secret origin: `supabase secrets set ALLOWED_ORIGIN=https://namadomain.web.id`.
6. Isi kredensial di `assets/js/core/config.js` (nilai diobfuscate — baca bagian
   "Ganti kredensial Supabase" di bawah).
7. Deploy ke GitHub Pages.

- **Username**: `admin` · **Password default** (seed di `schema.sql`):
  `Bsacademy135*` → ⚠️ **segera ganti**:
  ```sql
  select reset_admin('admin', 'password-baru-kamu');
  ```

### B. Backend Monitoring & Evaluasi (Google Apps Script)

Fitur Monitoring & Evaluasi **terpisah total dari Supabase** — datanya di Google
Spreadsheet, dipanggil lewat Web App GAS. Template spreadsheet siap pakai:
`gas-backend/Sistem_Monitoring_Latihan_Basket.xlsx` (2 sheet: `Penilaian` 17 kolom,
`Evaluasi` 11 kolom — struktur persis kontrak `Code.gs`).

1. Upload `.xlsx` ke Google Drive, buka dengan Google Sheets (auto-convert).
2. **Extensions → Apps Script** → hapus isi `Code.gs` default → tempel seluruh isi
   `gas-backend/Code.gs`.
3. **Project Settings → Script Properties → Add**: property `APP_KEY`, value string
   rahasia acak (24+ karakter).
4. **Deploy → New deployment → Web app**: Execute as `Me`, Who has access `Anyone`.
   Salin Web app URL.
5. Di `assets/js/core/config.js` isi:
   ```js
   GAS_URL: "https://script.google.com/macros/s/XXXXX/exec", // URL dari langkah 4
   GAS_KEY: "kunci-yang-sama-persis-dengan-APP_KEY",
   ```
6. Setiap ubah kode `Code.gs` → **New deployment** ulang (Apps Script tidak
   auto-update deployment lama).

> ⚠️ `GAS_KEY`/`APP_KEY` wajib **sama persis** (huruf besar/kecil & spasi
> berpengaruh) — beda → error `Tidak diotorisasi`.

---

## 🖥️ Cara Pakai

### Dashboard
Ringkasan jumlah siswa aktif, hadir/telat hari ini, grafik tren 7 hari, daftar siswa
yang sudah scan, dan statistik iuran bulan ini.

### Data Siswa
Tambah/edit/hapus siswa. **Kode QR dibuat otomatis** (kode `BSA-0001`, `BSA-0002`, dst).

### Scan Presensi
Dua mode: **Alat Scanner/Manual** (input selalu fokus) atau **Kamera HP**
(`html5-qrcode`). Sistem menentukan **Hadir/Telat** dari tabel `jadwal`, duplikat
per hari diblokir (constraint `UNIQUE(siswa_id, tanggal)`).

**Backdate** — kolom "Tanggal latihan" (maks 7 hari, `scan_backdate_max_days` di
`app_config()`): scan bisa dicatat ke tanggal latihan lama, status sesuai jadwal hari
itu, keterangan `Backdate` untuk audit.

### Riwayat Presensi
Filter rentang tanggal/kelompok/status, pagination default **50 data/halaman**,
bisa diunduh sebagai laporan HTML mandiri.

### Monitoring Latihan
Penilaian skill 1–5 per sesi (Dribbling, Lay Up, Shooting, Passing, Footwork,
Fundamental Team, Team Work, Game/Situasional) + catatan. Admin **dan** Pelatih bisa
input. Tabel menampilkan **Jenis Kelamin** siswa (dari Supabase).

### Evaluasi Bulanan
Khusus **Admin** — rata-rata tiap kategori dari seluruh sesi bulan itu + evaluasi
naratif (Kelebihan/Kekurangan/Rekomendasi), 1 kali per anak per bulan. Tabel
menampilkan **Jenis Kelamin** (di-join dari Supabase).

### Iuran Bulanan
Pilih Bulan/Tahun → status seluruh siswa aktif otomatis **Belum Bayar** sampai
ditandai Lunas. Edit/batalkan lewat ikon. Ringkasan tampil di Dashboard.

### Cetak Kode QR
Pilih siswa (bisa banyak), cetak kartu *player ticket card* berisi QR.

---

## 🗂️ Struktur Data

Semua akses frontend lewat Edge Function yang memanggil fungsi `rpc_*`
(tabel hanya bisa diakses `service_role`).

| Tabel | Kolom utama |
|---|---|
| `admin` | username, password_hash, nama, role, status |
| `siswa` | id, barcode, nama, **jenis_kelamin**, tanggal_lahir, kelompok, nama_ortu, hp_ortu, tanggal_daftar, status |
| `presensi` | id, siswa_id, barcode, nama, kelompok, waktu, tanggal, status, keterangan |
| `jadwal` | kelompok, hari, jam_mulai, jam_selesai, toleransi_menit |
| `iuran` | id, siswa_id, bulan, tahun, nominal, status, tanggal_bayar, keterangan, dicatat_oleh |
| `sessions` | token, username, nama, role, exp |
| `login_attempts` | username_key, count, window_start, locked_until |

> `iuran`: TIDAK ADA baris = **Belum Bayar**. Baris dibuat sistem saat admin menandai
> Lunas.

> `monitoring` & `evaluasi` TIDAK ada di Supabase — hidup di Google Spreadsheet
> (sheet `Penilaian` & `Evaluasi`), snapshot nama/kelompok saat diisi.

---

## 🧩 Arsitektur & Maintenance

- **Pagination**: satu modul `assets/js/core/pager.js`. Halaman baru yang butuh
  pagination tinggal `Pager.create({...}).bind()` lalu `pager.slice(filtered)`
  (client) atau `pager.setTotal(total)` (server). Jangan copy-paste logic pagination.
- **Backend monitoring** (`gas-backend/Code.gs`): kontrak `POST { action, key, payload }`
  → `{ ok, data }`. Data penilaian/evaluasi hanya di spreadsheet; daftar siswa &
  kelompok tetap dari Supabase (read-only).
- Logika khusus halaman di `assets/js/pages/`; urutan script
  `config → api → auth → ui → (pager jika perlu) → script halaman`, semua `defer`,
  `head.js` tanpa `defer`.
- Backend logic utama hidup di **Postgres** (`rpc_*` di `supabase/schema.sql`);
  Edge Function hanya router. Kontrak: `POST { action, token, payload }` →
  `{ ok, data }`.
- Asset pakai penanda rilis `?v=...` — saat deploy perubahan, naikkan penanda pada
  setiap referensi asset yang berubah.

---

## 🔧 Troubleshooting

- **`SUPABASE_URL belum diatur`** → kredensial di `config.js` kosong/tidak valid
  (re-obfuscate, lihat "Ganti kredensial").
- **`GAS_URL belum diatur`** → isi `GAS_URL` di `config.js` (Setup bagian B).
- **`Tidak diotorisasi` (GAS)** → `GAS_KEY` di config.js tidak sama persis dengan
  `APP_KEY` di Script Properties.
- **`APP_KEY belum diatur`** → Script Properties belum terisi / salah project /
  nama property bukan `APP_KEY`.
- **`Sheet Penilaian tidak ditemukan`** → nama tab spreadsheet harus persis `Penilaian`
  dan `Evaluasi`.
- **Backdate tidak berfungsi / `p_tanggal tidak dikenali`** → re-run
  `schema.sql → hardening.sql → backdate_presensi.sql` (urutan wajib), lalu redeploy
  Edge Function.
- **"Respon server tidak valid"** → Edge Function belum dideploy / CORS origin belum
  diizinkan.
- **Kamera tidak terbuka** → situs harus HTTPS + izin kamera browser aktif.
- **Header tampak transparan / CSS lama** → hard refresh (`Ctrl+Shift+R`), marker
  asset `?v=` harus naik.
- **Perubahan SQL tidak muncul** → jalankan ulang file SQL (semua `create or replace`
  aman), redeploy Edge Function.

---

## 🔐 Keamanan

Proyek 100% client-side — endpoint & kunci anon **tidak bisa disembunyikan** dari
browser; keamanan ada di **pemakaian yang tidak berguna tanpa otorisasi**.

| Layer | Mekanisme |
|---|---|
| 1. Struktur akses | RLS tanpa policy di semua tabel; hanya `service_role`; semua lewat Edge Function |
| 2. Sesi | Token kustom (UUID) wajib per request, `rpc_verify_token`, expire 12 jam |
| 3. Token at rest | Disimpan sebagai SHA-256 hash |
| 4. Password | bcrypt (cost 11); hash lama auto-upgrade saat login sukses |
| 5. Brute force | Lock 15 menit per user/IP (tabel `login_attempts*`) |
| 6. Slowing | Delay jitter + burst limiter di Edge Function |
| 7. Origin allowlist | Edge Function cek `Origin` vs `ALLOWED_ORIGIN` |
| 8. Headers | `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, CORS dibatasi |
| 9. Frontend | Kredensial diobfuscate (`config.js`), `no-referrer`, semua render via `UI.escapeHtml` |

### 🔑 Ganti kredensial Supabase di config.js (obfuscate)

1. Buka `assets/js/core/config.js`. Decode nilai lama (console browser):
   ```js
   const K = [0xa7, 0x3c, 0xd1, 0x09];
   const d = (s) => { const r = atob(s); let o = ""; for (let i = 0; i < r.length; i++) o += String.fromCharCode(r.charCodeAt(i) ^ K[i % 4]); return o; };
   console.log(d(APP_CONFIG.SUPABASE_URL), d(APP_CONFIG.SUPABASE_ANON_KEY), d(APP_CONFIG.SUPABASE_FUNCTION));
   ```
2. Obfuscate nilai baru (base64/xor key `[0xa7,0x3c,0xd1,0x09]`, xor per byte),
   tempel hasil ke `deobf(...)`.

> ⚠️ Obfuscation bukan keamanan riil — kunci anon memang public by design.
> Proteksi sesungguhnya di layer 1–8.

### 🚫 Purge data siswa dari git (PII)

`supabase/import_siswa_pendataan.sql` berisi PII riil dan pernah ter-push ke GitHub
(commit `998ee5c`) — file sudah diuntrack + di-gitignore. Kalau repo **public**,
wajib purge riwayat:

```bash
# Backup dulu: clone --mirror
git filter-repo --path supabase/import_siswa_pendataan.sql --invert-paths
git push origin --force --all
```

Plus deaktivasi GitHub caching (Settings → Pages), pertimbangkan re-create repo
kalau data sangat sensitif.

---

## 🧰 Teknologi

- HTML, CSS, JavaScript native (tanpa build tool/framework)
- **Supabase**: Postgres + RLS + `rpc_*` + Edge Function
- **Google Apps Script** + Spreadsheet: fitur Monitoring & Evaluasi
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) & [qrcode](https://github.com/soldair/node-qrcode) — di-bundle lokal di `assets/js/vendor/`
- Font: Bebas Neue, Inter, Space Mono (Google Fonts)
