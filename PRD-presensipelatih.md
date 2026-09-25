# PRD — Fitur Presensi Pelatih

## 1. Latar belakang & tujuan

- Siswa sudah punya presensi (scan QR → tabel `presensi`). Pelatih belum.
- Tujuan sekarang: catat **kehadiran pelatih** per latihan, data seminimal mungkin
  (nama + barcode).
- Tujuan ke depan (belum implementasi): kehadiran pelatih jadi dasar **pembagian
  honor pelatih**, dana dari iuran siswa.

## 2. Ruang lingkup

**Masuk (sekarang):**

- CRUD data pelatih (nama + barcode otomatis).
- Scan presensi pelatih (reuse halaman Scan, mode Siswa/Pelatih).
- Halaman riwayat presensi pelatih terpisah (`/presensi-pelatih/`).
- Cetak kartu QR pelatih.

**Keluar (sekarang, siap skema):**

- Hitung honor pelatih (lihat §11).
- Jadwal telat khusus pelatih.

## 3. Aktor

- Admin/Pengurus (semua aksi, role sama seperti fitur siswa).

## 4. Kebutuhan fungsional (FR)

| ID | Kebutuhan |
|---|---|
| FR-1 | Admin tambah pelatih: input nama, barcode `PLT-xxxx` dibuat otomatis |
| FR-2 | Admin edit nama/status pelatih |
| FR-3 | Admin nonaktifkan pelatih (status `Nonaktif`) — bukan hapus fisik |
| FR-4 | Scan QR pelatih → tercatat hadir, 1 pelatih maks 1× per hari |
| FR-5 | Pelatih nonaktif tidak bisa scan |
| FR-6 | Riwayat presensi pelatih: filter rentang tanggal + status, pagination |
| FR-7 | Cetak kartu QR pelatih |
| FR-8 | Hapus pelatih → riwayat presensi tetap tersimpan (denormalisasi nama) |

## 5. Kebutuhan non-fungsional (NFR)

- **Free tier Supabase**: hemat baris, hemat invoke, agregasi di DB, tidak tarik
  seluruh baris.
- Pakai pola yang sudah ada: `rpc_*` di Postgres, Edge Function cuma router,
  RLS tertutup.
- Zona waktu `Asia/Jakarta` (konsisten `app_config()`).

## 6. Desain data — keputusan "perlu id?"

**Keputusan: `pelatih.barcode` = PRIMARY KEY. Tidak perlu kolom `id` surrogate
terpisah.**

Alasan:

- Pelatih sedikit (±5–20), stabil, jarang dihapus/ganti.
- Barcode unik & jarang berubah. Kartu hilang → cetak ulang QR dengan **kode
  sama**, identitas tidak berubah → tidak butuh id.
- Hemat 1 kolom + 1 join (ekonomi free tier).
- Honor nanti cukup link via `barcode` + `nama` terdenormalisasi.

`ponytail:` kalau kelak butuh re-issue nomor baru tanpa ubah identitas (kode
harus berubah), tambah kolom `id` lewat migrasi kecil. Tidak sekarang.

Beda dari `siswa` (yang punya `id` SIS-xxx + `barcode` BSA-xxx dua nilai): siswa
memang butuh dua kode karena jumlah besar & data PII banyak. Pelatih cukup satu
kode.

### Tabel baru

```sql
create table pelatih (
  barcode     text primary key,           -- PLT-0001, ...
  nama        text not null,
  status      text not null default 'Aktif',
  created_at  timestamptz not null default now()
);
create index if not exists idx_pelatih_barcode_lower on pelatih (lower(barcode));

create sequence if not exists barcode_pelatih_seq;

create table presensi_pelatih (
  id              text primary key,       -- next_sequence_id('ABS-PLT-')
  pelatih_barcode text references pelatih(barcode) on delete set null,
  nama            text,                   -- snapshot (denormalisasi)
  waktu           timestamptz not null,
  tanggal         date not null,
  status          text not null default 'Hadir',
  keterangan      text default '',
  unique (pelatih_barcode, tanggal)       -- 1 pelatih 1× per hari (atomik)
);
create index if not exists idx_presensi_pelatih_tanggal on presensi_pelatih (tanggal);
```

Catatan:

- `pelatih_barcode` nullable + `on delete set null` → hapus pelatih, riwayat
  tetap ada (nama tersimpan).
- Kolom `status` tetap ada walau sekarang selalu `Hadir` — forward-compatible
  untuk telat/honor.
- `unique (pelatih_barcode, tanggal)` = pengganti `unique (siswa_id, tanggal)`.

### Perubahan `app_config()`

Tambahkan `'barcode_prefix_pelatih', 'PLT'`.

⚠️ **Gotcha**: `app_config()` di-`create or replace` di 3 file (`schema.sql`,
`hardening.sql`, `backdate_presensi.sql`) dengan key set yang beda. Delta pelatih
harus **redefine `app_config()` berisi SELURUH key terkini + key baru**, atau
langsung merge ke `schema.sql`. Kalau tidak, re-run file lama bisa menghapus
`barcode_prefix_pelatih`.

## 7. API / RPC baru

Fungsi Postgres (masuk `schema.sql` + delta pelatih):

| Fungsi | Aksi | Catatan |
|---|---|---|
| `rpc_get_pelatih_list()` | baca semua | cache-able |
| `rpc_add_pelatih(p_nama, p_status)` | tambah | auto `PLT-xxxx` |
| `rpc_update_pelatih(p_barcode, p_nama, p_status)` | edit | |
| `rpc_delete_pelatih(p_barcode)` | hapus | set null di presensi |
| `rpc_scan_presensi_pelatih(p_barcode)` | scan | cek Aktif + duplikat, status `Hadir` |
| `rpc_get_presensi_pelatih_list(p_dari, p_sampai, p_status, p_limit, p_offset)` | riwayat | pagination + total |

Edge Function (`ACTIONS`) tambah: `getPelatihList`, `addPelatih`, `updatePelatih`,
`deletePelatih`, `scanPresensiPelatih`, `getPresensiPelatihList`. Kontrak
`{ action, token, payload }` → `{ ok, data }` tidak berubah.

Aturan bisnis **terpisah** dari siswa (sesuai aturan proyek: jangan gabung aturan
mirip). Scan pelatih TIDAK cek tabel `jadwal` (pelatih tidak punya jadwal → selalu
`Hadir`).

## 8. Frontend & alur

| File | Perubahan |
|---|---|
| `pelatih/index.html` + `assets/js/pages/pelatih.js` | CRUD pelatih (mirror `siswa/`) |
| `assets/js/pages/scan.js` | tambah toggle mode Siswa/Pelatih → panggil `scanPresensi` atau `scanPresensiPelatih` |
| `presensi-pelatih/index.html` + `assets/js/pages/presensi-pelatih.js` | halaman riwayat terpisah |
| `assets/js/pages/cetak-barcode.js` | tab Pelatih |
| `assets/js/core/api.js` | tambah action pelatih ke `MUTATING_ACTIONS` + TTL cache `getPelatihList` |

Alur scan: pindai `PLT-0001` → auto-route ke pelatih (deteksi prefix) →
`rpc_scan_presensi_pelatih` → toast "Hadir".

## 9. Aturan bisnis

- Barcode pelatih prefix `PLT`, counter terpisah (`barcode_pelatih_seq`), format
  `PLT-0001`.
- 1 pelatih 1× per hari (constraint `unique`).
- Pelatih nonaktif → tolak scan.
- Status selalu `Hadir` (belum ada jadwal pelatih).
- Riwayat denormalisasi `nama` → honor/riwayat tidak rusak saat pelatih dihapus.

## 10. Optimasi free tier

- Baris: ±10 pelatih, presensi ±10 × 4 latihan × 4 minggu ≈ **160 baris/bulan**
  → diabaikan.
- Denormalisasi `nama` → honor report tanpa join.
- Index `tanggal` + `lower(barcode)` → scan pakai index, bukan full scan.
- `getPelatihList` di-cache `localStorage` (TTL 300s) seperti `getSiswaList`.
- Riwayat pakai pagination (offset) + count terpisah, sama `rpc_get_presensi_list`.
- Tidak ada invoke/edge baru yang boros — scan reuse endpoint yang sama.

## 11. Rancangan masa depan: honor pelatih dari iuran (belum implementasi)

Skema di atas sudah siap. Honor **per kehadiran** (flat rate per pelatih per
kehadiran).

**Rencana integrasi GAS:** perhitungan/rekap honor nantinya diarahkan ke
**Google Apps Script + Spreadsheet** (bukan Supabase) untuk menghemat kuota
Supabase — Supabase hanya simpan data presensi mentah, rekap honor dihitung di
GAS. Detail (tarik data Supabase → GAS, atau sebaliknya) ditentukan belakangan.
**Tidak memengaruhi skema sekarang** — `presensi_pelatih.tanggal` + `status` +
`nama` terdenormalisasi sudah cukup jadi sumber data rekap GAS.

**Yang perlu ditambah nanti (tidak sekarang):**

- Kolom `pelatih.honor_per_hadir numeric` (nullable, fallback ke
  `app_config()->>'honor_per_hadir_default'`).
- Rekap honor (di GAS): group `presensi_pelatih` by `pelatih_barcode`, filter
  `tanggal` dalam bulan → `jumlah_hadir` → `honor = jumlah_hadir × honor_per_hadir`.
- Halaman/honor report (atau output dari GAS).

Dasar dana: `rpc_get_iuran_bulan().totalTerkumpul` sudah ada — tinggal dipakai.

**Kenapa desain sekarang sudah benar untuk honor:**

- `presensi_pelatih.tanggal` (date) → group per bulan murah.
- `status` ada → nanti bisa bedakan Hadir/Telat (mis. Telat = setengah honor).
- `nama` denormalisasi → honor tetap terhitung walau pelatih dihapus.

## 12. Langkah deploy (saat implementasi)

1. Tambah tabel + fungsi ke `schema.sql` (atau delta `pelatih.sql`).
2. Pastikan `app_config()` merge semua key.
3. Re-run SQL: `schema.sql` → `hardening.sql` → `backdate_presensi.sql` →
   `pelatih.sql`.
4. Tambah action di `index.ts`, deploy Edge Function.
5. Buat `pelatih/index.html` + `pelatih.js`, `presensi-pelatih/index.html` +
   `presensi-pelatih.js`, patch `scan.js`/`api.js`.
6. Deploy GitHub Pages.

## 13. Kriteria terima

- Tambah pelatih → barcode `PLT-0001` otomatis, muncul di daftar.
- Scan QR pelatih → "Hadir", scan 2× di hari sama ditolak.
- Pelatih nonaktif ditolak scan.
- Halaman `/presensi-pelatih/` tampil riwayat, pagination jalan.
- Hapus pelatih → riwayat lama tetap tampil (nama tersimpan).
