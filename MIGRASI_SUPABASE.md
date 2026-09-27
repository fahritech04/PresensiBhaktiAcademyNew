# 🔄 Migrasi Backend: Google Apps Script + Sheets → Supabase

Dokumen ini menjelaskan cara memasang backend baru berbasis **Supabase**
(Postgres + Edge Function) sebagai pengganti **Google Apps Script + Google
Sheets**. **Tidak ada satu pun logic/aturan bisnis yang berubah** — hanya
tempat jalannya yang pindah. Semua halaman di `assets/js/pages/*.js` (siswa,
scan, presensi, iuran, dashboard, cetak-barcode, login) **tidak disentuh
sama sekali**.

## Apa yang berubah, apa yang tidak

| | Sebelum | Sesudah |
|---|---|---|
| Database | Google Sheets (`Siswa`, `Presensi`, `Jadwal`, `Iuran`, `Admin`) | Tabel Postgres Supabase dengan nama & kolom setara (lihat `supabase/schema.sql`) |
| Backend logic | `assets/code.gs` (Apps Script, fungsi `actionXxx`) | Fungsi Postgres `rpc_xxx` di `supabase/schema.sql` — port 1:1 dari `actionXxx` |
| Endpoint API | Web App Apps Script (`/exec`) | Supabase Edge Function `supabase/functions/api/index.ts` (router tipis saja) |
| Kontrak API dari browser | `POST { action, token, payload }` → `{ ok, data }` | **Sama persis**, cuma alamat URL & header yang beda |
| Frontend (`pages/*.js`, `ui.js`, `auth.js`) | — | **Tidak diubah** |
| Yang diubah di frontend | — | `assets/js/core/config.js` & `assets/js/core/api.js` saja |
| Login default | `admin` / `Bsacademy135*` (seed `schema.sql`) | Tetap sama, segera ganti setelah login pertama |

File `assets/code.gs` lama (Google Apps Script) sudah **dihapus** dari repo setelah
migrasi ini rampung — backend lama sudah tidak dipakai. Isi aslinya bisa diambil
kembali kapan saja dari riwayat git bila diperlukan.

---

## 1) Buat project Supabase

1. Daftar/masuk ke <https://supabase.com/dashboard>.
2. **New project** → pilih organisasi, kasih nama (mis. `presensi-bhakti`),
   set password database, pilih region terdekat (mis. Singapore).
3. Tunggu sampai project selesai di-provision (~2 menit).

## 2) Jalankan skema database

1. Di dashboard project, buka **SQL Editor → New query**.
2. Buka file `supabase/schema.sql` dari proyek ini, **copy semua isinya**,
   tempel ke SQL Editor, lalu **Run**.
3. Kalau sukses, cek di **Table Editor**: harus ada tabel `siswa`,
   `presensi`, `jadwal`, `iuran`, `admin`, `sessions`, `login_attempts` —
   dan tabel `admin` sudah otomatis terisi 1 baris akun default
   (`admin` / `Bsacademy135*`).

> Skema ini aman dijalankan ulang (`create or replace function`, `create
> table if not exists`) kalau suatu saat kamu update logic-nya.

## 3) Deploy Edge Function

Edge Function di sini **tidak berisi logic bisnis** — dia cuma menerima
request dari browser, memverifikasi token sesi, lalu memanggil fungsi
`rpc_xxx` yang sesuai di database. Ada 2 cara deploy:

### Opsi A — pakai Supabase CLI (direkomendasikan)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>   # lihat di Project Settings > General
supabase functions deploy api --no-verify-jwt
```

`--no-verify-jwt` **wajib** dipakai, karena autentikasi dipegang sendiri
lewat tabel `sessions` + token kustom (setara `PropertiesService` di Apps
Script lama), bukan lewat sistem Auth bawaan Supabase.

> ⚠️ **Nama function wajib sama di config.js**: deploy `api` → nama function
> = `api`. Buka `assets/js/core/config.js`, cek `SUPABASE_FUNCTION` diobfuscate
> = `"api"` (`deobf("xky4")`). Kalau nama function beda → ganti nilai obfuscate
> (lihat video/alat di README → 🔐 "Ganti kredensial").

### Opsi B — lewat Dashboard (tanpa install apa pun)

1. Buka **Edge Functions → Create a new function**, beri nama `api`.
2. Tempel seluruh isi `supabase/functions/api/index.ts`.
3. Di pengaturan function, **matikan "Enforce JWT Verification"**.
4. Deploy.

### Secrets (opsional)

Edge Function otomatis punya akses ke `SUPABASE_URL` dan
`SUPABASE_SERVICE_ROLE_KEY` tanpa perlu diset manual — keduanya disediakan
otomatis oleh runtime Supabase untuk tiap Edge Function.

**`ALLOWED_ORIGIN` (wajib untuk versi hardened)** — domain situs kamu,
supaya Edge Function blok request dari origin lain:

```bash
supabase secrets set ALLOWED_ORIGIN=https://bhaktisebatung.web.id
```

## 3.5) Hardening keamanan (wajib)

Jalankan **`supabase/hardening.sql`** di SQL Editor (dapat setelah
`schema.sql`). File ini tidak mengubah aturan bisnis, hanya diamankan:

- Anti brute-force **per-IP** (`login_attempts_ip`) di sampung lockout
  per-username yang sudah ada.
- Password admin → **bcrypt** (hash SHA-256 lama tetap bisa login, lalu
  auto-upgrade saat sukses).
- Token sesi disimpan sebagai **SHA-256 hash** (tidak plaintext di database).

Jangan ikut jalanan ini di deploy pertama kali atau update security:
jalankan `hardening.sql` sekali setelah schema jalan.

## 3.6) Feature backdate presensi (opsional)

Jalankan **`supabase/backdate_presensi.sql`** di SQL Editor. Menambahkan
param `p_tanggal` optional ke `rpc_scan_presensi` supaya admin bisa scan
telat kode QR dan dicatat presensi di **tanggal latihan yang benar**
(latihan Senin, scan Selasa/Rabu dengan tanggal Senin → hadir Senin).

**Urutan wajib deploy SQL**: `schema.sql` → `hardening.sql` →
`backdate_presensi.sql` → `pelatih.sql` → `pelatih_google.sql` →
`pelatih_verifikasi.sql`. Re-run `schema.sql` (mis. saat update logic)
resets fungsi `rpc_*` ke versi lama → re-run semua delta di atas sesegera sesudah.

## 4) Hubungkan frontend ke Supabase

Buka `assets/js/core/config.js`, isi 2 baris ini (ambil dari **Project
Settings → Data API**):

```js
SUPABASE_URL: "https://xxxxxxxxxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...", // kunci "anon / public", BUKAN service_role
```

> `SUPABASE_ANON_KEY` aman ditaruh di kode frontend (memang didesain
> public-facing) — persis seperti URL Web App Apps Script lama yang juga
> tertanam di `config.js` dan bisa dilihat siapa saja lewat DevTools.
> Proteksi sesungguhnya ada di token sesi kustom & RLS di database, bukan
> di kerahasiaan key ini.

Setelah itu, deploy ulang ke GitHub Pages seperti biasa (push ke repo).

## 5) (Opsional) Pindahkan data lama dari Google Sheets

Kalau kamu sudah punya data siswa/jadwal/iuran di Spreadsheet lama:

1. Di Google Sheets, **File → Download → CSV** untuk tiap sheet (`Siswa`,
   `Jadwal`, `Iuran`) yang datanya mau dipindah. Sheet `Presensi` biasanya
   tidak perlu dipindah (riwayat lama), tapi boleh juga kalau mau.
2. Di Supabase Dashboard, **Table Editor → (pilih tabel) → Insert →
   Import data from CSV**.
3. Karena nama kolom sheet lama (mis. `TanggalLahir`, `NamaOrtu`, `HPOrtu`)
   beda dengan nama kolom tabel baru (`tanggal_lahir`, `nama_ortu`,
   `hp_ortu`), **ganti header di baris pertama CSV** sebelum upload,
   sesuai pemetaan berikut:

   **Siswa** → tabel `siswa`
   | Kolom sheet lama | Kolom Supabase |
   |---|---|
   | ID | id |
   | Barcode | barcode |
   | Nama | nama |
   | TanggalLahir | tanggal_lahir |
   | Kelompok | kelompok |
   | NamaOrtu | nama_ortu |
   | HPOrtu | hp_ortu |
   | TanggalDaftar | tanggal_daftar |
   | Status | status |

   **Jadwal** → tabel `jadwal`: `Kelompok→kelompok`, `Hari→hari`,
   `JamMulai→jam_mulai`, `JamSelesai→jam_selesai`,
   `ToleransiMenit→toleransi_menit`.

   **Iuran** → tabel `iuran`: `ID→id`, `SiswaID→siswa_id`, `Bulan→bulan`,
   `Tahun→tahun`, `Nominal→nominal`, `Status→status`,
   `TanggalBayar→tanggal_bayar`, `Keterangan→keterangan`,
   `DicatatOleh→dicatat_oleh`.

4. **Setelah** import data `siswa` lama selesai, jalankan sekali di SQL
   Editor supaya nomor barcode berikutnya melanjutkan (bukan mulai dari
   `BSA-0001` lagi):

   ```sql
   select sync_barcode_seq();
   ```

## 6) Uji coba

1. Buka website kamu (atau jalankan lokal), login dengan `admin` / `Bsacademy135*`.
2. Coba tambah siswa baru, scan barcode-nya di halaman **Scan**, cek
   **Dashboard** & **Riwayat Presensi**, tandai **Iuran** Lunas untuk 1
   siswa.
3. Kalau semua jalan seperti sebelumnya — migrasi selesai. Segera ganti
   password admin default lewat SQL Editor:

   ```sql
   select reset_admin('admin', 'password-baru-kamu');
   ```

---

## Catatan teknis (kenapa beberapa hal ditulis begini)

- **Timezone**: batas Hadir/Telat & pembagian "hari ini" dulu mengikuti
  *timezone project Apps Script* (`File → Project Settings → Time zone`),
  bukan timezone browser pengguna. Nilai ini sekarang ada di
  `app_config()->>'timezone'` di `supabase/schema.sql` (default
  `Asia/Jakarta`, sesuai label "WIB" yang sudah ditulis di `scan.js`).
  **Cek & sesuaikan** nilai ini kalau timezone project Apps Script lama
  kamu berbeda, supaya jam potong Hadir/Telat tetap identik.
- **Kunci "sudah presensi hari ini"**: dulu dicek manual (baca semua baris
  lalu bandingkan tanggal) dan diamankan lewat 1 lock global
  (`LockService`) untuk SEMUA aksi tulis. Sekarang diamankan lewat
  `UNIQUE(siswa_id, tanggal)` di tabel `presensi` + advisory lock per
  transaksi — hasil akhirnya sama (tidak bisa presensi 2x sehari), tapi
  jaminannya lebih kuat karena level database, bukan asumsi 1 proses.
- **Nomor barcode**: dulu dihitung dengan mencari angka terbesar di kolom
  Barcode tiap kali ada siswa baru. Sekarang pakai `sequence` Postgres
  (`barcode_seq`) yang atomik — hasil formatnya tetap sama (`BSA-0001`,
  `BSA-0002`, ...), cuma cara hitungnya lebih aman dari race condition.
- **Keamanan tabel**: RLS diaktifkan tanpa policy apa pun di semua tabel,
  dan semua fungsi `rpc_*`/helper hanya bisa dipanggil oleh `service_role`.
  Artinya satu-satunya jalan masuk ke data adalah lewat Edge Function —
  persis seperti dulu satu-satunya jalan masuk ke Spreadsheet adalah lewat
  Web App Apps Script.

## Kalau ingin kembali ke Apps Script

`assets/code.gs` sudah dihapus, tetapi bisa diambil dari riwayat git (commit
sebelum penghapusan). Untuk rollback: kembalikan isi `assets/js/core/config.js`
& `assets/js/core/api.js` ke versi sebelum migrasi ini, deploy ulang Web App
Apps Script dari `code.gs` lama, lalu pasang URL deployment-nya di `config.js`.
