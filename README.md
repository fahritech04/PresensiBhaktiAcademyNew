# 🏀 Sistem Presensi — Bhakti Sebatung Academy

> ## 📢 Backend menggunakan Supabase
> Proyek ini menggunakan **Supabase (Postgres + Edge Function)** sebagai backend.
> Setup dari nol ada di **[`MIGRASI_SUPABASE.md`](./MIGRASI_SUPABASE.md)**.
> Backend lama Google Apps Script + Google Sheets sudah **dipensiunkan dan
> dihapus** dari repo (riwayat lengkap tetap ada di git).

Web presensi latihan basket berbasis **scan kode QR**, dibangun dengan HTML/CSS/JavaScript
native (tanpa framework) + **Supabase** (Postgres + Edge Function) sebagai backend.
Cocok dihosting gratis di **GitHub Pages**.

### ✨ Pembaruan Terbaru

- **Optimasi free tier** — riwayat presensi memakai pagination (500 baris/halaman),
  dashboard menghitung agregat iuran langsung di database (tanpa menarik seluruh baris),
  index tambahan untuk scan barcode, dan cache `localStorage` untuk data statis
  (daftar kelompok/siswa) dengan invalidasi otomatis saat login/logout/mutasi.
- **Fitur baru: Iuran Bulanan** — catat status bayar iuran latihan tiap siswa per
  bulan (Lunas/Belum Bayar), lengkap dengan riwayat pembayaran & ringkasan di
  Dashboard. Lihat menu **Iuran** di navigasi.
- **URL bersih tanpa `.html`** — semua halaman kini diakses tanpa akhiran `.html`
  (mis. `/dashboard/`, `/iuran/`) untuk tampilan yang lebih rapi & profesional.
- **Desain dirombak total** — gaya "Bold Court": warna flat, garis outline tegas,
  bayangan solid (bukan gradient/soft-shadow generik), navigasi berubah dari sidebar
  jadi **top bar (desktop) + bottom tab bar dengan tombol Scan menonjol (mobile)**.
  Sudah responsif penuh dari HP kecil sampai layar desktop.
- **Kode barcode 1D diganti kode QR (2D)** — lebih mudah dipindai kamera HP dari
  berbagai sudut/jarak dibanding barcode garis-garis biasa.
- **Loading lebih terasa cepat** — font dimuat lebih optimal, semua script pakai
  `defer`, dan tampilan memakai _skeleton shimmer_ per bagian (bukan layar putih
  penuh) selagi menunggu respons backend.

---

## 📁 Struktur Proyek

> ℹ️ **URL bersih (tanpa `.html`)**: setiap halaman kecuali `index.html` di root
> disimpan sebagai `nama-folder/index.html`, sehingga otomatis bisa diakses tanpa
> ekstensi (mis. `dashboard/` bukan `dashboard.html`). Semua path asset memakai
> path absolut (diawali `/`) supaya tetap berfungsi walau halaman dipindah ke
> subfolder. Kalau menambah halaman baru, ikuti pola yang sama: buat folder baru
> berisi `index.html`, dan pakai `/assets/...` untuk semua `src`/`href`.

```
bhakti-basketball-attendance/
├── index.html              # Halaman login admin (diakses di "/")
├── dashboard/index.html    # Ringkasan & statistik kehadiran (diakses di "/dashboard/")
├── siswa/index.html        # CRUD data siswa (diakses di "/siswa/")
├── scan/index.html         # Scan presensi (alat scanner / kamera HP) — kode QR (diakses di "/scan/")
├── presensi/index.html     # Riwayat & rekap presensi (diakses di "/presensi/")
├── iuran/index.html        # CRUD status bayar iuran bulanan (diakses di "/iuran/")
├── cetak-barcode/index.html # Cetak kartu kode QR siswa (diakses di "/cetak-barcode/")
├── maintenance.html        # Halaman pemeliharaan (opsional, tetap di root)
├── supabase/
│   ├── schema.sql          # MASTER skema: tabel, RLS, & seluruh fungsi rpc_ (logic backend)
│   ├── hardening.sql       # DELTA keamanan: bcrypt, token hash, anti brute-force IP
│   ├── backdate_presensi.sql # DELTA: scan telat / latihan hari lama (p_tanggal)
│   ├── import_siswa_pendataan.sql ⚠️ PII — diuntrack, JANGAN commit (lihat 🔐)
│   ├── config.toml         # Konfigurasi project Supabase (CLI)
│   └── functions/api/      # Edge Function router tipis (memanggil rpc_* sesuai action)
└── assets/
    ├── css/
    │   └── style.css       # Semua styling (design system "Bold Court")
    ├── favicon/            # Icon website & Web Manifest
    ├── img/                # Asset gambar (logo, foto academy)
    └── js/
        ├── core/           # Pondasi aplikasi (konfigurasi, auth, API, UI, head injector)
        │   ├── head.js     # Injeksi favicon & Google Fonts terpusat
        │   ├── config.js   # ⚠️ Kredensial Supabase obfuscate (lihat catatan 🔐)
        │   ├── api.js      # Wrapper komunikasi ke Edge Function (+ cache data statis)
        │   ├── auth.js     # Sesi login & guard halaman
        │   └── ui.js       # Komponen bersama (nav atas/bawah, toast, modal, skeleton loader)
        ├── pages/          # Logika per halaman
        │   ├── login.js
        │   ├── dashboard.js
        │   ├── siswa.js
        │   ├── scan.js
        │   ├── presensi.js
        │   ├── iuran.js
        │   └── cetak-barcode.js
        └── vendor/         # Library pihak ketiga di-bundle lokal (tanpa CDN)
            ├── qrcode.min.js
            └── html5-qrcode.min.js
└── README.md               # Dokumen ini
```

---

## 🚀 Instalasi

Ikuti **[`MIGRASI_SUPABASE.md`](./MIGRASI_SUPABASE.md)** untuk setup lengkap dari nol:
1. Buat project Supabase.
2. Jalankan `supabase/schema.sql` di SQL Editor.
3. Jalankan `supabase/hardening.sql` di SQL Editor (hardening keamanan).
4. Deploy Edge Function `api` (`supabase functions deploy api --no-verify-jwt`).
5. Set secret origin domain: `supabase secrets set ALLOWED_ORIGIN=https://bhaktisebatung.web.id`.
6. Set kredensial di `assets/js/core/config.js` (nilai diobfuscate, lihat di bawah).
7. Deploy ke GitHub Pages.

- **Username**: `admin`
- **Password default** (seed di `schema.sql`): `Bsacademy135*` → ⚠️ **segera ganti** (lihat `MIGRASI_SUPABASE.md` bagian "Uji coba").

---

## 🖥️ Cara Pakai

### Dashboard

Ringkasan jumlah siswa aktif, hadir/telat hari ini, grafik tren 7 hari, dan daftar
siswa yang sudah scan hari ini. Statistik iuran bulan ini (lunas/belum/terkumpul)
dihitung langsung di database — dashboard tidak menarik seluruh baris iuran.

### Data Siswa

Tambah, edit, dan hapus data siswa. **Kode QR dibuat otomatis** (kode unik format
`BSA-0001`, `BSA-0002`, dst. yang di-encode jadi QR) begitu siswa baru disimpan —
tidak perlu diisi manual.

### Scan Presensi

Ada dua mode, bisa dipilih sesuai alat yang tersedia di lapangan:

- **Alat Scanner / Manual** — Kolom input akan selalu fokus. Cocok dipakai dengan
  alat _scanner_ fisik 2D/QR (USB/Bluetooth) yang berperilaku seperti keyboard, atau
  untuk mengetik kode secara manual lalu tekan Enter.
- **Kamera HP** — Memakai kamera perangkat (laptop/HP/tablet) untuk memindai kode QR
  langsung, memakai library open-source `html5-qrcode` (dibatasi hanya mendeteksi
  format QR supaya proses pemindaian lebih cepat & akurat).

Sistem otomatis menentukan **Hadir** atau **Telat** berdasarkan jadwal di tabel
`jadwal`, dan mencegah siswa yang sama tercatat dua kali di hari yang sama
(constraint `UNIQUE(siswa_id, tanggal)` di database).

**Backdate (scan telat / latihan hari lama)** — kolom **"Tanggal latihan"** di
halaman Scan (default: hari ini). Admin bisa ganti ke tanggal latihan sebelumnya
(maks 7 hari, diatur `scan_backdate_max_days` di `app_config()`), lalu scan kode
QR — presensi dicatat di **tanggal latihan yang benar**, status Hadir/Telat sesuai
jadwal **hari latihan tersebut** (bukan hari scan), dan `keterangan` dicatat
`Backdate` untuk audit. Duplikat tetap diblock. Tanggal di masa depan di-kick.

### Riwayat Presensi

Filter berdasarkan rentang tanggal, kelompok, dan status, serta bisa diunduh
sebagai laporan HTML mandiri. Tabel menampilkan **500 data per halaman** dengan
tombol sebelumnya/berikutnya (pagination); ekspor laporan selalu mengambil dataset
lengkap sesuai filter sehingga laporan tidak terpotong. File laporan tetap memiliki
pencarian, filter, pengurutan, dan tombol cetak tanpa memuat asset aplikasi.

### Cetak Kode QR

Pilih siswa (bisa banyak sekaligus), lalu cetak kartu berbentuk _player ticket
card_ berisi kode QR untuk dibagikan dan ditempel/dilaminating oleh siswa.

### Iuran Bulanan

Pantau & catat status bayar iuran latihan tiap siswa, per bulan:

- Pilih **Bulan** & **Tahun** di bagian atas untuk melihat status seluruh siswa
  aktif pada periode tersebut. Siswa yang belum punya catatan pembayaran otomatis
  tampil sebagai **Belum Bayar** — tidak perlu di-generate manual di muka.
- Klik **Tandai Lunas** untuk mencatat pembayaran (nominal, tanggal bayar,
  keterangan opsional). Nominal default diatur di fungsi `app_config()` pada
  `supabase/schema.sql`.
- Sudah tercatat Lunas tapi salah input? Klik ikon **Edit** untuk mengoreksi, atau
  ikon **Hapus** untuk membatalkan (siswa kembali berstatus Belum Bayar).
- Ikon **Riwayat** menampilkan histori pembayaran siswa tsb di semua bulan.
- Ringkasan **Lunas / Belum Bayar / Total Terkumpul** bulan berjalan juga tampil
  otomatis di **Dashboard**.

---

## 🗂️ Struktur Data (Supabase)

Skema lengkap & semua fungsi backend ada di `supabase/schema.sql`. Frontend **tidak
boleh** membaca tabel langsung — semua akses lewat Edge Function yang memanggil
fungsi `rpc_*` (akses tabel hanya untuk `service_role`).

| Tabel | Kolom utama |
|---|---|
| `admin` | username, password_hash, nama, role, status |
| `siswa` | id, barcode, nama, jenis_kelamin, tanggal_lahir, kelompok, nama_ortu, hp_ortu, tanggal_daftar, status |
| `presensi` | id, siswa_id, barcode, nama, kelompok, waktu, tanggal, status, keterangan |
| `jadwal` | kelompok, hari, jam_mulai, jam_selesai, toleransi_menit |
| `iuran` | id, siswa_id, bulan, tahun, nominal, status, tanggal_bayar, keterangan, dicatat_oleh |
| `sessions` | token, username, nama, role, exp |
| `login_attempts` | username_key, count, window_start, locked_until |

**Mengatur jadwal & toleransi telat**: tambahkan satu baris di tabel `jadwal` untuk
setiap kombinasi kelompok + hari latihan. Jika kombinasi tersebut tidak ditemukan,
siswa yang scan pada hari itu otomatis berstatus **Hadir** (tanpa pengecekan telat).

> ℹ️ **Cara kerja tabel `iuran`**: TIDAK ADA baris untuk kombinasi siswa + bulan +
> tahun tertentu berarti **Belum Bayar**. Baris baru hanya dibuat sistem saat admin
> menandai "Lunas" lewat halaman web — tidak perlu di-generate di muka untuk tiap
> siswa × tiap bulan.

> ℹ️ **Kenapa kolom `presensi.barcode` / `siswa.barcode` namanya "barcode"?**
> Secara teknis, kode QR hanyalah tampilan dari kode teks yang sama (mis.
> `BSA-0001`) — bedanya cuma bentuk gambarnya (kotak 2D, bukan garis-garis 1D).
> Nama kolom sengaja dibiarkan `barcode` untuk kesinambungan dengan skema lama.

---

## 🔧 Troubleshooting

- **`SUPABASE_URL belum diatur`** → nilai kredensial di `config.js` tidak valid / kosong. Re-obfuscate kredensial project kamu (baca catatan 🔐 "Ganti kredensial").
- **Backdate tidak berfungsi / "p_tanggal tidak dikenali"** → `rpc_scan_presensi` di-reset ke versi lama (mis. setelah re-run `schema.sql`). Re-run `supabase/backdate_presensi.sql` (dan `supabase/hardening.sql` kalau baru) — **urutan wajib: `schema.sql` → `hardening.sql` → `backdate_presensi.sql`**.
- **"Respon server tidak valid"** → pastikan Edge Function sudah dideploy dan CORS
  mengizinkan domain situsmu.
- **Data tidak tampil / "Sesi berakhir"** → Edge Function harus di-deploy dengan
  `--no-verify-jwt` dan token sesi valid (login ulang).
- **Kamera tidak bisa dibuka** → pastikan situs diakses lewat **HTTPS** (GitHub Pages
  sudah HTTPS) dan izin kamera browser diaktifkan.
- **Kode QR susah terbaca kamera** → pastikan pencahayaan cukup, kartu tidak kusut/silau
  terkena cahaya, dan jarak kamera sekitar 10–20 cm dari kartu.
- **"Library QR Code gagal dimuat"** → pastikan folder `assets/js/vendor/` ikut
  ter-upload ke GitHub Pages (bisa dicek lewat `https://username.github.io/nama-repo/assets/js/vendor/qrcode.min.js`).
- **Perubahan di `schema.sql` tidak muncul** → jalankan ulang file SQL di SQL Editor
  (semua `create or replace` / `create ... if not exists` aman dijalankan ulang),
  lalu redeploy Edge Function.

---

## 🧰 Teknologi & Pustaka

- HTML, CSS, JavaScript native (tanpa build tool/framework)
- **Supabase**: Postgres + RLS + fungsi `rpc_*` (backend & database) + Edge Function
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) — pemindaian kode QR via kamera
- [qrcode](https://github.com/soldair/node-qrcode) — pembuatan gambar kode QR

Kedua library QR **di-bundle langsung** di `assets/js/vendor/` (bukan dimuat dari
CDN luar) — supaya fitur scan & cetak kode QR tetap berfungsi normal walau koneksi
ke CDN pihak ketiga sedang diblokir/bermasalah di jaringan tertentu.

- Font: Bebas Neue, Inter, Space Mono (Google Fonts, dimuat via `<link preconnect>` untuk kecepatan)

---

## ✅ Optimasi Free Tier Supabase

Untuk data ±100+ siswa & presensi harian, kuota free tier tidak masalah bila pola
berikut dipertahankan:

- **Storage (500 MB)**: presensi tumbuh ±1.200 baris/bulan (±4 MB/tahun) → aman
  puluhan tahun. Tidak perlu arsip/hapus otomatis.

  > **Estimasi aktual 80 siswa × 4 latihan/seminggu**: 320 scan/seminggu →
  > **±1.280 baris/bulan** → ±16.600 baris/tahun → **±2,5 MB/tahun** storage.
  > Cuma ±0,5% dari kuota 500 MB per tahun. Edge Function untuk scan ±1.300
  > invoke/bulan (+ ~5–10K untuk halaman admin) vs kuota **500K/bulan** → baik
  > margin kuota aman.
- **Edge Function (±500K invoke/bulan)**: pemakaian riil < 5K/bulan (halaman admin +
  scan). Data statis (kelompok/siswa) di-*cache* `localStorage` (TTL 5-10 menit)
  di `assets/js/core/api.js` sehingga membuka halaman berulang tidak membakar kuota.
- **Query besar**: riwayat presensi memakai pagination (500/halaman) + hitung total
  terpisah; dashboard menghitung iuran via `count`/`sum` agregat tanpa mengirim
  seluruh baris; scan barcode memakai index `lower(barcode)`.
- **Bandwidth**: payload tetap kecil karena agregasi dilakukan di database.

Pagination saat ini berbasis offset (sederhana, cukup untuk < 100rb baris). Ganti
ke keyset pagination (`WHERE (tanggal, waktu) < (?, ?)`) jika data melebihi itu.

---

## Maintenance

- Pertahankan logika khusus halaman di `assets/js/pages/`. Markup pilihan select
  dan status tombol simpan yang dipakai beberapa halaman tersedia di `UI`.
- Pertahankan urutan script `config`, `api`, `auth`, `ui`, lalu script halaman
  dengan `defer`. API membaca sesi melalui `Auth` ketika request dijalankan.
  `head.js` tetap tanpa `defer`.
- URL asset aplikasi memakai penanda rilis `?v=...` untuk menghindari cache versi
  lama. Saat merilis perubahan, naikkan penanda pada setiap referensi asset yang
  berubah. Deploy HTML dan seluruh file terkait bersama-sama.
- Backend logic hidup di **Postgres** (`supabase/schema.sql`, fungsi `rpc_*`);
  Edge Function `supabase/functions/api/index.ts` hanya router (tidak ada logic
  bisnis di sana). Frontend memakai kontrak `POST { action, token, payload }` →
  `{ ok, data }`.
- Aturan bisnis berada di fungsi `rpc_*` terkait: jangan menyatukan aturan yang
  hanya terlihat mirip (filter siswa dan iuran, default status, zona waktu dari
  `app_config()->>'timezone'`, dan penentuan duplikat presensi).

---

## 🔐 Catatan Keamanan

**Kenapa endpoint API tetap terlihat di Inspect Element/Network tab?**
Proyek ini 100% client-side (GitHub Pages static — tanpa server). Karena itu
endpoint & kunci anon **tidak bisa fisikal dihapus** dari tampilan browser:
browser harus tahu URL supaya bisa fetch. Yang aman adalah **pemakaian tidak
berguna tanpa otorisasi** — bukan kerahasiaan string.

Layer proteksi yang diaktifkan (versi hardening, = `supabase/hardening.sql`
+ Edge Function versi hardened):

| Layer | Mekanisme |
|---|---|
| 1. Struktur akses | RLS aktif tanpa policy di semua tabel; hanya `service_role` bisa akses; semua jalan lewat Edge Function |
| 2. Autentikasi sesi | Token kustom (UUID) wajib per request, diverifikasi `rpc_verify_token`; expire 12 jam |
| 3. Token at rest | Token sesi **disimpan sebagai SHA-256 hash** — dump database tidak leak token valid |
| 4. Password at rest | **bcrypt (cost 11)**; hash SHA-256 peppered lama auto-upgrade saat login sukses |
| 5. Brute force user | ≥5 gagal berturut-turut → lock 15 menit (tabel `login_attempts`) |
| 6. Brute force IP | ≥10 gagal per-IP → lock 15 menit (tabel `login_attempts_ip`, `supabase/hardening.sql`) |
| 7. Slowing | Delay jitter 350–1200 ms per login gagal + burst limiter memory di Edge Function |
| 8. Origin allowlist | Edge Function cek `Origin` vs `ALLOWED_ORIGIN` — blok request dari domain lain |
| 9. Info leak | Fingerprint endpoint diperha; aksi tidak dikenali → pesan generik (no hacecho); token tidak pernah di URL GET (GET sengaja diperha) |
| 10. Headers | `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, CORS dipepersempit ke origin situs |
| 11. Konfig frontend | URL/key/function diobfuscate (`config.js`) supaya tidak plaintext dalam source; referrer `no-referrer` di semua halaman |
| 12. XSS | Semua data dinamis di-render lewat `UI.escapeHtml`, tidak `document.write` |

Password default admin **wajib** diganti sesegera (hash lama SHA-256 akan
auto-upgrade ke bcrypt saat login pertama):

```sql
select reset_admin('admin', 'password-baru-kamu');
```

### 🔑 Ganti kredensial Supabase dalam config.js (obfuscate)

Kredensial di `config.js` tidak diisi plaintext. Untuk ganti project:

1. Buka `assets/js/core/config.js`, dulu nilai taked diobfuscate:
   ```js
   // decode manual untuk dicek nilai lama (browser console):
   const K = [0xa7, 0x3c, 0xd1, 0x09];
   const d = (s) => { const r = atob(s); let o = ""; for (let i = 0; i < r.length; i++) o += String.fromCharCode(r.charCodeAt(i) ^ K[i % 4]); return o; };
   console.log(d(APP_CONFIG.SUPABASE_URL), d(APP_CONFIG.SUPABASE_ANON_KEY), d(APP_CONFIG.SUPABASE_FUNCTION));
   ```
2. Ganti nilai di project Supabase, lalu obfuscate nilai baru (alat online
   base64/xor, key `[0xa7,0x3c,0xd1,0x09]`, muten per byte) dan tempel hasil
   ke `deobf(...)`.

> ⚠️ Obfuscation bukan keamanan riil — kunci anon memang public by design.
> Proteksi sesungguhnya ada di layer 1–8, bukan di string config.

### 🚫 Purge data siswa dari git (PII)

`supabase/import_siswa_pendataan.sql` berisi PII riil (nama aluno, HP ortu,
tanggal lahir) dan **belum ini sudah ter-push ke GitHub** (commit `998ee5c`).
File sudah diuntrack + di-gitignore. Kalau repo **public**, PII sudah terleak —
wajib **purge riwayat git** supaya tidak bisa dibaca dari history:

```bash
# Baca: tidak bisa undelele — backup repo dulu (clone --mirror).
# Option A: git filter-repo (rekomendasi)
git filter-repo --path supabase/import_siswa_pendataan.sql --invert-paths
# Option B: BFG
bfg --delete-files import_siswa_pendataan.sql
# lalu force-push SEMUA branch + tag:
git push origin --force --all
```

Plus deaktivasi GitHub caching (Settings → Pages) dan consider Deactivate /
re-create repo kalau data sangat sensitif. Data PII yang sudah terleak tidak
bisa "diuntrack" — kemungkinan besar perlu inform yang tersa.