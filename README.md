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
        │   ├── config.js   # ⚠️ Isi SUPABASE_URL & SUPABASE_ANON_KEY kamu di sini
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
3. Deploy Edge Function `api` (`supabase functions deploy api --no-verify-jwt`).
4. Isi `SUPABASE_URL` & `SUPABASE_ANON_KEY` di `assets/js/core/config.js`.
5. Deploy ke GitHub Pages.

- **Username**: `admin`
- **Password default**: `admin123` → ⚠️ **segera ganti** (lihat `MIGRASI_SUPABASE.md` bagian "Uji coba").

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

- **"SUPABASE_URL belum diatur"** → isi `SUPABASE_URL` & `SUPABASE_ANON_KEY` di `assets/js/core/config.js`.
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

**Kenapa `SUPABASE_ANON_KEY` & URL Edge Function terlihat di Inspect Element/Network tab?**
Ini normal dan berlaku untuk _semua_ website (client-side), bukan celah keamanan
khusus di proyek ini. Yang penting bukan menyembunyikan URL/key-nya, tapi memastikan
tidak berguna tanpa otorisasi yang sah. Karena itu:

- **Hanya aksi `login` yang bersifat publik di Edge Function.** Semua aksi lain
  wajib menyertakan token sesi valid (tabel `sessions`), didapat hanya setelah
  login berhasil — token diverifikasi lewat `rpc_verify_token` di setiap request.
- **RLS aktif tanpa policy** di semua tabel (hanya `service_role` yang bisa akses),
  dan seluruh fungsi `rpc_*` hanya bisa dieksekusi oleh `service_role`. Satu-satunya
  jalan masuk ke data adalah lewat Edge Function.
- **Proteksi brute-force login aktif**: setelah 5 kali percobaan password salah
  berturut-turut untuk 1 username, akun tsb otomatis terkunci sementara selama
  15 menit (diatur di `app_config()` → `max_login_attempts` / `login_lockout_minutes`).
- Password admin di-hash (SHA-256 + pepper dari `app_config()`) sebelum disimpan —
  tidak pernah disimpan sebagai teks polos.

Sistem ini dirancang untuk kebutuhan internal klub/akademi kecil-menengah, bukan
aplikasi enterprise. Hal paling penting yang **wajib** kamu lakukan: **ganti
password default `admin123`** sesegera mungkin — lewat SQL:

```sql
select reset_admin('admin', 'password-baru-kamu');
```