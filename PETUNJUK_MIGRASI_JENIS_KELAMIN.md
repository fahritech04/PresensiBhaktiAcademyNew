# 📋 Panduan Update CRUD Jenis Kelamin (Putra & Putri)

Dokumen ini menjelaskan langkah mudah untuk mengaktifkan fitur **Jenis Kelamin (Putra & Putri)** di website dan database Supabase Anda **tanpa menghapus data atau database yang sudah ada**.

---

## 🔒 Jaminan Keamanan Data
> [!IMPORTANT]
> Script migrasi ini menggunakan perintah `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` dan `CREATE OR REPLACE FUNCTION`.
> **Data siswa, riwayat presensi, jadwal, dan iuran yang sudah ada saat ini TIDAK AKAN HILANG atau terhapus sama sekali.**
> Siswa yang saat ini sudah terdaftar akan otomatis memiliki jenis kelamin default **Putra**, dan Anda dapat langsung mengeditnya menjadi **Putri** melalui website.

---

## Langkah 1: Jalankan Migrasi di Supabase SQL Editor (Wajib)

1. Buka dashboard Supabase: **[https://supabase.com/dashboard](https://supabase.com/dashboard)**
2. Pilih project Supabase Anda.
3. Pada menu navigasi sebelah kiri, klik **SQL Editor** (ikon `>_`).
4. Klik **New Query** (atau tanda `+`).
5. Buka file **`MIGRASI_JENIS_KELAMIN.sql`** di proyek ini, **salin (copy) semua isinya**, lalu **tempel (paste)** ke dalam SQL Editor Supabase.
6. Klik tombol **Run** (atau tekan `Ctrl + Enter`).
7. Pastikan muncul notifikasi **"Success. No rows returned"**.

*Selesai! Database Anda sekarang sudah mendukung kolom `jenis_kelamin`.*

---

## Langkah 2: Deploy / Update Edge Function (Opsional tapi Direkomendasikan)

> [!NOTE]
> Sistem sudah dilengkapi mekanisme *smart fallback*, sehingga fitur CRUD jenis kelamin sebenarnya **sudah langsung berfungsi** setelah Anda menjalankan Langkah 1 di atas!
> Namun, agar Edge Function Anda di Supabase selalu up-to-date, Anda dapat memperbarui function `raihanfahrifi` (atau `api`):

### Cara A: Melalui Dashboard Supabase (Tanpa CLI)
1. Di Supabase Dashboard, klik menu **Edge Functions** (ikon petir ⚡).
2. Klik fungsi Anda (`raihanfahrifi` atau `api`).
3. Buka tab **Code** / Edit.
4. Salin seluruh isi file **`supabase/functions/api/index.ts`** dan gantikan kode di editor tersebut.
5. Klik **Save & Deploy**.

### Cara B: Melalui Supabase CLI (Jika menggunakan terminal)
```bash
supabase functions deploy raihanfahrifi --no-verify-jwt
```

---

## Langkah 3: Uji Coba di Web

1. Buka halaman **Data Siswa** (`/siswa/`):
   - Kolom **Jenis Kelamin** akan muncul di tabel dengan badge biru muda (**Putra**) atau pink (**Putri**).
   - Gunakan dropdown **Filter Jenis Kelamin** di toolbar untuk memfilter tampilan (Semua Gender, Putra, Putri).
2. **Edit Siswa**:
   - Klik tombol **Edit** (ikon pensil) pada salah satu siswa putri (misalnya *Alya*, *Amelia*, dll).
   - Ubah pilihan **Jenis Kelamin** menjadi **Putri**, lalu klik **Simpan Siswa**.
   - Periksa tabel: badge siswa tersebut kini berubah menjadi **Putri** berwarna pink.
3. **Tambah Siswa Baru**:
   - Klik **+ Tambah Siswa**, isi data siswa dan pilih Jenis Kelamin (Putra/Putri), lalu simpan.
4. **Cetak QR Code** (`/cetak-barcode/`):
   - Tabel pemilihan kartu sekarang memiliki filter gender dan menampilkan jenis kelamin siswa.
   - Kartu presensi yang dicetak juga menampilkan label jenis kelamin.

---

## Catatan Git
Perubahan file di komputer Anda ini **hanya tersimpan secara lokal** dan **TIDAK di-push ke GitHub**.
Jika setelah dites Anda sudah puas dan ingin menyimpannya ke git, Anda bisa menjalankan:
```bash
git status
git add .
git commit -m "feat: tambah CRUD jenis kelamin Putra dan Putri serta migrasi aman Supabase"
git push
```
*(Lakukan push hanya jika Anda sudah siap)*.
