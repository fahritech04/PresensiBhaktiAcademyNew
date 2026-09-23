# 🏀 Sistem Presensi — Bhakti Sebatung Academy

> ## 📢 Backend sudah dimigrasikan ke Supabase
> Proyek ini sekarang menggunakan **Supabase (Postgres + Edge Function)**
> sebagai backend, menggantikan Google Apps Script + Google Sheets.
> **Semua logic/aturan bisnis tetap sama persis** — hanya tempat jalannya
> yang pindah. Ikuti **[`MIGRASI_SUPABASE.md`](./MIGRASI_SUPABASE.md)** untuk
> setup dari nol. Bagian "🚀 Langkah Instalasi" di bawah ini (Google
> Sheets/Apps Script) sudah **usang**, dibiarkan hanya sebagai arsip/referensi
> sejarah proyek.

Web presensi latihan basket berbasis **scan kode QR**, dibangun dengan HTML/CSS/JavaScript
native (tanpa framework) + **Supabase** (Postgres + Edge Function) sebagai backend.
Cocok dihosting gratis di **GitHub Pages**.

### ✨ Pembaruan Terbaru

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
  penuh) selagi menunggu respons dari Google Apps Script.

---

## 📁 Struktur Proyek

> ℹ️ **URL bersih (tanpa `.html`)**: setiap halaman (kecuali `index.html` di root)
> disimpan sebagai `nama-folder/index.html`, sehingga otomatis bisa diakses tanpa
> ekstensi (mis. `dashboard/` bukan `dashboard.html`). Semua path asset memakai
> path absolut (diawali `/`) supaya tetap berfungsi walau halaman dipindah ke
> subfolder. Kalau menambah halaman baru, ikuti pola yang sama: buat folder baru
> berisi `index.html`, dan pakai `/assets/...` (bukan `assets/...`) untuk semua
> `src`/`href`.

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
├── assets/
│   ├── code.gs             # Backend Google Apps Script (tempel ke Apps Script editor)
│   ├── data-template.xlsx  # Template struktur spreadsheet (Siswa/Presensi/Jadwal/Iuran/Admin)
│   ├── css/
│   │   └── style.css       # Semua styling (design system "Bold Court")
│   ├── favicon/            # Icon website & Web Manifest
│   ├── img/                # Asset gambar (logo, foto academy)
│   └── js/
│       ├── core/           # Pondasi aplikasi (konfigurasi, auth, API, UI, head injector)
│       │   ├── head.js     # Injeksi favicon & Google Fonts terpusat
│       │   ├── config.js   # ⚠️ Isi URL Apps Script kamu di sini
│       │   ├── api.js      # Wrapper komunikasi ke backend
│       │   ├── auth.js     # Sesi login & guard halaman
│       │   └── ui.js       # Komponen bersama (nav atas/bawah, toast, modal, skeleton loader)
│       ├── pages/          # Logika per halaman
│       │   ├── login.js
│       │   ├── dashboard.js
│       │   ├── siswa.js
│       │   ├── scan.js
│       │   ├── presensi.js
│       │   ├── iuran.js
│       │   └── cetak-barcode.js
│       └── vendor/         # Library pihak ketiga di-bundle lokal (tanpa CDN)
│           ├── qrcode.min.js
│           └── html5-qrcode.min.js
└── README.md               # Dokumen ini
```

---

## 🚀 Langkah Instalasi (⚠️ USANG — arsip cara lama, lihat MIGRASI_SUPABASE.md)

### 1) Siapkan Google Spreadsheet

1. Upload `data-template.xlsx` ke Google Drive.
2. Klik kanan file → **Buka dengan → Google Spreadsheet** (otomatis dikonversi).
   _(Alternatif: buat Spreadsheet baru lalu File → Import → Upload → pilih file ini,
   opsi "Ganti spreadsheet".)_
3. Pastikan ada 6 sheet: `Petunjuk`, `Siswa`, `Presensi`, `Jadwal`, `Iuran`, `Admin`.
4. Sheet `Siswa`, `Jadwal`, dan `Iuran` sudah berisi contoh data — silakan ganti/hapus
   sesuai data akademi kamu. Sheet `Presensi` dibiarkan kosong karena akan terisi
   otomatis.

### 2) Deploy Backend (Google Apps Script)

1. Di Spreadsheet tadi, buka **Extensions/Ekstensi → Apps Script**.
2. Hapus kode default (`Code.gs`), lalu **tempel seluruh isi file `code.gs`** dari proyek ini.
3. Di dropdown fungsi (atas editor), pilih `setupSpreadsheet`, klik **Run/Jalankan**.
   - Fungsi ini aman dijalankan berkali-kali (hanya membuat header bila belum ada).
   - Saat pertama kali, Google akan meminta izin akses — klik **Lanjutkan/Advanced → Buka**.
4. Klik **Deploy → New deployment**.
   - Pilih tipe **Web app**.
   - **Execute as**: _Me (akun kamu)_.
   - **Who has access**: _Anyone_.
   - Klik **Deploy**, lalu salin **Web app URL** (diakhiri `/exec`).

> Setiap kali kamu mengubah isi `code.gs`, buat **New deployment** lagi (atau
> gunakan "Manage deployments → Edit → New version") supaya perubahan aktif.

### 3) Hubungkan Web ke Backend

Buka `assets/js/core/config.js`, ganti baris berikut dengan URL hasil deploy:

```js
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec',
```

### 4) Hosting ke GitHub Pages

1. Buat repository baru di GitHub (bisa publik/privat, tapi GitHub Pages gratis
   memerlukan repo publik atau akun berbayar untuk repo privat).
2. Upload seluruh isi folder `bhakti-basketball-attendance/` (bukan folder itu sendiri,
   isinya) ke root repo tsb.
3. Buka **Settings → Pages**, pilih branch `main` dan folder `/ (root)`, simpan.
4. Proyek memakai path dari root domain (`/assets/...`, `/dashboard/`). Gunakan
   situs `https://username.github.io/` atau custom domain yang diarahkan ke repo.
   Hosting langsung di `https://username.github.io/nama-repo/` membutuhkan
   penyesuaian base path; konfigurasi saat ini tidak memakai prefix nama repo.

### 5) Login Pertama Kali

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Segera ganti password** setelah login pertama dengan mengedit hash di sheet
`Admin`. Cara paling mudah: jalankan fungsi sekali pakai berikut di Apps Script
editor (ganti `"password_baru"` sesuai keinginan), lalu hapus lagi kodenya:

```js
function gantiPasswordAdmin() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Admin");
  sheet.getRange(2, 2).setValue(hashPassword_("password_baru"));
}
```

---

## 🖥️ Cara Pakai

### Dashboard

Ringkasan jumlah siswa aktif, hadir/telat hari ini, grafik tren 7 hari, dan daftar
siswa yang sudah scan hari ini.

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

Sistem otomatis menentukan **Hadir** atau **Telat** berdasarkan jadwal di sheet
`Jadwal`, dan mencegah siswa yang sama tercatat dua kali di hari yang sama.

### Riwayat Presensi

Filter berdasarkan rentang tanggal, kelompok, dan status, serta bisa diunduh
sebagai laporan HTML mandiri. File laporan tetap memiliki pencarian, filter,
pengurutan, dan tombol cetak tanpa memuat asset aplikasi.

### Cetak Kode QR

Pilih siswa (bisa banyak sekaligus), lalu cetak kartu berbentuk _player ticket
card_ berisi kode QR untuk dibagikan dan ditempel/dilaminating oleh siswa.

### Iuran Bulanan

Pantau & catat status bayar iuran latihan tiap siswa, per bulan:

- Pilih **Bulan** & **Tahun** di bagian atas untuk melihat status seluruh siswa
  aktif pada periode tersebut. Siswa yang belum punya catatan pembayaran otomatis
  tampil sebagai **Belum Bayar** — tidak perlu di-generate manual di muka.
- Klik **Tandai Lunas** untuk mencatat pembayaran (nominal, tanggal bayar,
  keterangan opsional). Nominal default bisa diubah lewat `CONFIG.IURAN_NOMINAL_DEFAULT`
  di `code.gs`.
- Sudah tercatat Lunas tapi salah input? Klik ikon **Edit** untuk mengoreksi, atau
  ikon **Hapus** untuk membatalkan (siswa kembali berstatus Belum Bayar).
- Ikon **Riwayat** menampilkan histori pembayaran siswa tsb di semua bulan.
- Ringkasan **Lunas / Belum Bayar / Total Terkumpul** bulan berjalan juga tampil
  otomatis di **Dashboard**.

---

## 🗂️ Struktur Data (Google Sheets)

| Sheet      | Kolom                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| `Siswa`    | ID, Barcode, Nama, TanggalLahir, Kelompok, NamaOrtu, HPOrtu, TanggalDaftar, Status |
| `Presensi` | ID, SiswaID, Barcode, Nama, Kelompok, Waktu, Status, Keterangan                    |
| `Jadwal`   | Kelompok, Hari, JamMulai, JamSelesai, ToleransiMenit                               |
| `Iuran`    | ID, SiswaID, Bulan, Tahun, Nominal, Status, TanggalBayar, Keterangan, DicatatOleh  |
| `Admin`    | Username, PasswordHash, Nama, Role, Status                                         |

**Mengatur jadwal & toleransi telat**: tambahkan satu baris di sheet `Jadwal` untuk
setiap kombinasi kelompok + hari latihan. Jika kombinasi tersebut tidak ditemukan,
siswa yang scan pada hari itu otomatis berstatus **Hadir** (tanpa pengecekan telat).

> ℹ️ **Cara kerja sheet `Iuran`**: TIDAK ADA baris untuk kombinasi siswa + bulan +
> tahun tertentu berarti **Belum Bayar**. Baris baru hanya dibuat sistem saat admin
> menandai "Lunas" lewat halaman web — jadi sheet ini tidak perlu diisi manual atau
> di-generate di muka untuk tiap siswa x tiap bulan. Kalau perlu ubah data lama
> secara massal, boleh diedit langsung di sheet ini selama nama kolom (baris 1)
> tidak diubah.

> ℹ️ **Kenapa nama kolomnya masih "Barcode"?** Secara teknis, kode QR hanyalah cara
> lain untuk _menampilkan_ kode teks yang sama (mis. `BSA-0001`) — bedanya cuma
> bentuk gambarnya (kotak 2D, bukan garis-garis 1D). Supaya struktur data tidak perlu
> diubah dan tetap sederhana, nama kolom di sheet & `code.gs` sengaja dibiarkan
> `Barcode`. Ini aman diabaikan; yang tampil ke siswa & di kartu cetak tetap kode QR.

---

## 🔧 Troubleshooting

- **"APPS_SCRIPT_URL belum diatur"** → isi URL deployment di `assets/js/core/config.js`.
- **"Respon server tidak valid"** → pastikan deployment Apps Script diset
  _Who has access: Anyone_, dan gunakan URL yang diakhiri `/exec` (bukan `/dev`).
- **Perubahan di code.gs tidak muncul** → buat deployment versi baru
  (Deploy → Manage deployments → Edit → New version).
- **Kamera tidak bisa dibuka** → pastikan situs diakses lewat **HTTPS** (GitHub Pages
  sudah HTTPS) dan izin kamera browser diaktifkan.
- **"Sesi berakhir, silakan login kembali"** → sesi admin berlaku 12 jam, cukup login ulang.
- **Kode QR susah terbaca kamera** → pastikan pencahayaan cukup, kartu tidak kusut/silau
  terkena cahaya, dan jarak kamera sekitar 10–20 cm dari kartu.
- **"Library QR Code gagal dimuat"** → seharusnya sudah tidak muncul lagi karena
  library kini di-bundle lokal di `assets/js/vendor/`. Kalau masih muncul, pastikan
  folder `assets/js/vendor/` ikut ter-upload ke GitHub Pages (cek lewat
  `https://username.github.io/nama-repo/assets/js/vendor/qrcode.min.js` — harus bisa
  dibuka, bukan halaman 404).
- **Halaman terasa lambat saat pertama dibuka** → ini biasanya karena Google Apps Script
  perlu waktu "bangun" beberapa saat (wajar, di luar kendali front-end). Selama proses ini
  akan selalu tampil animasi shimmer/loading, bukan layar kosong — jadi bukan tanda error.

---

## 🧰 Teknologi & Pustaka

- HTML, CSS, JavaScript native (tanpa build tool/framework)
- Google Apps Script + Google Sheets (backend & database, gratis)
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) — pemindaian kode QR via kamera
- [qrcode](https://github.com/soldair/node-qrcode) — pembuatan gambar kode QR

Kedua library di atas **sudah di-bundle langsung** di `assets/js/vendor/` (bukan
dimuat dari CDN luar) — supaya fitur scan & cetak kode QR tetap berfungsi normal
walau koneksi ke CDN pihak ketiga sedang diblokir/bermasalah di jaringan tertentu.
Satu-satunya request ke luar yang masih dipakai halaman ini adalah Google Fonts
(untuk tipografi) dan tentu saja ke Apps Script (untuk data).

- Font: Bebas Neue, Inter, Space Mono (Google Fonts, dimuat via `<link preconnect>` untuk kecepatan)

---

## Maintenance

- Pertahankan logika khusus halaman di `assets/js/pages/`. Markup pilihan select
  dan status tombol simpan yang dipakai beberapa halaman tersedia di `UI`.
- Pertahankan urutan script `config`, `api`, `auth`, `ui`, lalu script halaman
  dengan `defer`. API membaca sesi melalui `Auth` ketika request dijalankan,
  setelah script bersama selesai dimuat. `head.js` tetap tanpa `defer`.
- URL asset aplikasi memakai penanda rilis `?v=...` untuk menghindari cache
  versi lama. Saat merilis perubahan, naikkan penanda pada setiap referensi
  asset yang berubah. Deploy HTML dan seluruh file terkait bersama-sama;
  penanda versi tidak menggantikan upload file terbaru.
- Backend tetap satu file `assets/code.gs` agar alur deployment Apps Script
  tidak berubah. Penulisan kolom berdasarkan header memakai helper bersama;
  aturan bisnis dan format spreadsheet tetap berada di fungsi aksi terkait.
- Jangan menyatukan aturan yang hanya terlihat mirip: filter siswa dan iuran,
  default status, zona waktu, serta pemilihan baris duplikat memiliki perilaku
  masing-masing. Perubahan aturan tersebut memerlukan pengujian terpisah.

---

## Performa Google Apps Script

Optimasi mengikuti [panduan praktik terbaik Google](https://developers.google.com/apps-script/guides/support/best-practices?hl=id):

- Header dan isi sheet dibaca bersama dengan satu `getValues()`, lalu diproses
  dalam array JavaScript. Handle spreadsheet/sheet dipakai ulang selama satu
  request dan dibuang setelah request selesai.
- Dashboard membaca Siswa sekali untuk statistik siswa dan iuran. Riwayat
  dikelompokkan per tanggal dalam satu iterasi, bukan dipindai delapan kali.
- Update memakai `setValues()` hanya untuk kolom berubah yang bersebelahan.
  Kolom lain, termasuk formula, tidak ditulis ulang. Pada susunan header standar,
  update siswa memakai dua operasi tulis (sebelumnya enam), tandai iuran yang
  sudah ada satu (sebelumnya lima), dan edit seluruh detail iuran dua (sebelumnya
  tiga). Pembuatan satu catatan tetap memakai `appendRow()` satu kali.
- Halaman Iuran dan Riwayat mengambil daftar kelompok dan data utama secara
  paralel. Jumlah request tetap dua, tetapi tabel tidak menunggu respons kelompok.
- Tidak ditambahkan library GAS atau request API eksternal. Library QR frontend
  tetap diperlukan dan hanya dimuat pada halaman scan/cetak masing-masing.

### Cache dan Kesegaran Data

`CacheService.getScriptCache()` menyimpan hanya metadata konversi timestamp ke
tanggal tanpa hubungan ke record asal, bukan record siswa/presensi/iuran,
nama, ID, jadwal, password, atau sesi. Timestamp dapat berasal dari tanggal
lahir, pembayaran, atau kehadiran. Kunci memakai versi format dan timezone
skrip; isi memetakan timestamp ke
`yyyy-MM-dd`. Timestamp atau timezone baru tidak memakai hasil konversi lama.
Karena sumber spreadsheet selalu dibaca ulang, edit langsung di Google Sheets
tetap terlihat pada request berikutnya tanpa trigger invalidasi.

Cache dibatasi 1.000 pasangan timestamp/tanggal (di bawah batas 100 KB), dengan
masa simpan `CONFIG.DATE_CACHE_SECONDS` selama 6 jam. Pembacaan dan penyimpanan
cache masing-masing maksimal sekali per request, bukan per baris. Cache miss,
eviction, data cache rusak, atau gangguan layanan tidak menggagalkan request;
konversi dihitung kembali. Cache ini tidak menjamin hit dan tidak menghilangkan
waktu startup GAS maupun latensi jaringan.

### Batas dan Deployment

Aturan status, nominal, filter, duplikat, dan format respons dipertahankan.
Batch bukan transaksi: jika layanan Sheets menolak suatu penulisan, hasil
parsial bisa berbeda dari penulisan sel satu per satu. Tidak ada retry otomatis
untuk mutasi, agar pembayaran/presensi tidak tercatat ulang. Verifikasi range
yang diproteksi, merged cells, dan validasi khusus pada spreadsheet uji sebelum
deployment jika fitur tersebut digunakan.

Deploy versi baru `assets/code.gs` melalui **Manage deployments > Edit > New
version**, lalu publikasikan file frontend yang berubah. Tidak perlu menjalankan
ulang `setupSpreadsheet()` atau mengubah format sheet. Ukur waktu sebenarnya
melalui panel Network browser dan **Executions** di Apps Script; pengurangan
jumlah panggilan layanan tidak otomatis sama dengan persentase waktu respons.

---

## 🔐 Catatan Keamanan

**Kenapa URL Apps Script & source code terlihat di Inspect Element/Network tab?**
Ini normal dan berlaku untuk _semua_ website (client-side), bukan celah keamanan
khusus di proyek ini — browser memang butuh HTML/CSS/JS asli untuk menjalankan
halaman, jadi otomatis bisa dibuka siapa saja. Yang penting bukan menyembunyikan
URL-nya (memang tidak mungkin), tapi memastikan URL itu tidak berguna tanpa
otorisasi yang sah. Karena itu:

- **Hanya aksi `login` yang bisa dipanggil publik.** Semua aksi lain (lihat/ubah/
  hapus data siswa, Presensi, dsb.) di `code.gs` wajib menyertakan token sesi yang
  valid — didapat hanya setelah login berhasil.
- **Proteksi brute-force sudah aktif**: setelah 5 kali percobaan password salah
  berturut-turut untuk 1 username, akun tsb otomatis terkunci sementara selama
  15 menit (bisa diubah lewat `CONFIG.MAX_LOGIN_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES`
  di `code.gs`).
- Password admin di-hash (SHA-256 + pepper) sebelum disimpan — tidak pernah
  disimpan sebagai teks polos.

Sistem ini dirancang untuk kebutuhan internal klub/akademi kecil-menengah, bukan
aplikasi enterprise. Hal paling penting yang **wajib** kamu lakukan: **ganti
password default `admin123`** sesegera mungkin (lihat bagian Login Pertama Kali
di atas) — ini jauh lebih krusial daripada mencoba menyembunyikan kode/URL.
