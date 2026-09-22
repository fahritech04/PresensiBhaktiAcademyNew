-- =============================================================================
-- MIGRASI: Penambahan Kolom & Fitur Jenis Kelamin (Putra & Putri)
-- Sistem Presensi Bhakti Sebatung Academy
--
-- CARA PENGGUNAAN DI SUPABASE:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Masuk ke menu "SQL Editor"
-- 3. Buka "New query", salin seluruh isi file ini, lalu klik "Run"
--
-- AMAN & NON-DESTRUKTIF:
-- Script ini TIDAK AKAN MENGHAPUS tabel ataupun data siswa, presensi, maupun iuran.
-- Data siswa yang sudah ada otomatis diset dengan nilai default 'Putra',
-- dan selanjutnya dapat diedit menjadi 'Putri' melalui web.
-- =============================================================================

-- 1. Tambahkan kolom jenis_kelamin ke tabel siswa jika belum ada
ALTER TABLE siswa 
ADD COLUMN IF NOT EXISTS jenis_kelamin text NOT NULL DEFAULT 'Putra';

-- Tambahkan constraint check jika belum ada agar nilainya hanya 'Putra' atau 'Putri'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'siswa_jenis_kelamin_check'
  ) THEN
    ALTER TABLE siswa 
    ADD CONSTRAINT siswa_jenis_kelamin_check CHECK (jenis_kelamin IN ('Putra', 'Putri'));
  END IF;
END $$;

-- 2. Hapus versi lama rpc_add_siswa dan rpc_update_siswa agar tidak terjadi konflik signature
DROP FUNCTION IF EXISTS rpc_add_siswa(text, text, date, text, text, text);
DROP FUNCTION IF EXISTS rpc_update_siswa(text, text, text, date, text, text, text);

-- 3. Perbarui rpc_get_siswa_list agar menyertakan field jenisKelamin
CREATE OR REPLACE FUNCTION rpc_get_siswa_list()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_tz text := app_config()->>'timezone';
  v_siswa jsonb;
  v_kelompok jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'barcode', s.barcode,
           'nama', s.nama,
           'jenisKelamin', coalesce(s.jenis_kelamin, 'Putra'),
           'tanggalLahir', case when s.tanggal_lahir is not null then to_char(s.tanggal_lahir, 'YYYY-MM-DD') else '' end,
           'kelompok', coalesce(s.kelompok, ''),
           'namaOrtu', coalesce(s.nama_ortu, ''),
           'hpOrtu', normalize_hp(s.hp_ortu),
           'tanggalDaftar', to_char(s.tanggal_daftar at time zone v_tz, 'YYYY-MM-DD'),
           'status', coalesce(nullif(s.status, ''), 'Aktif')
         ) ORDER BY s.nama), '[]'::jsonb)
    INTO v_siswa
    FROM siswa s;

  SELECT coalesce(to_jsonb(array_agg(distinct k order by k)), '[]'::jsonb)
    INTO v_kelompok
    FROM (
      SELECT kelompok as k FROM siswa WHERE kelompok is not null and kelompok <> ''
      UNION
      SELECT kelompok as k FROM jadwal WHERE kelompok is not null and kelompok <> ''
    ) t;

  RETURN jsonb_build_object('siswa', v_siswa, 'kelompok', v_kelompok);
END;
$$;

-- 4. Perbarui rpc_add_siswa untuk menyimpan jenis_kelamin
-- Mendukung p_jenis_kelamin langsung, serta fallback tag [JK:Putra/Putri] dari frontend
CREATE OR REPLACE FUNCTION rpc_add_siswa(
  p_nama text,
  p_kelompok text,
  p_tanggal_lahir date,
  p_nama_ortu text,
  p_hp_ortu text,
  p_status text,
  p_jenis_kelamin text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_lock CONSTANT bigint := hashtext('bsa_mutating_lock');
  v_id text;
  v_barcode text;
  v_jk text;
  v_kelompok text;
BEGIN
  PERFORM pg_advisory_xact_lock(v_lock);

  IF trim(coalesce(p_nama, '')) = '' THEN
    RAISE EXCEPTION 'Nama wajib diisi.';
  END IF;

  -- Penentuan Jenis Kelamin: prioritas p_jenis_kelamin, fallback ekstrak dari format [JK:Putra|Putri]
  IF p_jenis_kelamin IS NOT NULL AND trim(p_jenis_kelamin) <> '' THEN
    v_jk := CASE WHEN trim(p_jenis_kelamin) IN ('Putri', 'Perempuan') THEN 'Putri' ELSE 'Putra' END;
    v_kelompok := trim(coalesce(p_kelompok, ''));
  ELSIF p_kelompok ~ '^\[JK:(Putra|Putri)\]' THEN
    v_jk := (regexp_match(p_kelompok, '^\[JK:(Putra|Putri)\]'))[1];
    v_kelompok := regexp_replace(coalesce(p_kelompok, ''), '^\[JK:(Putra|Putri)\]', '');
  ELSE
    v_jk := 'Putra';
    v_kelompok := trim(coalesce(p_kelompok, ''));
  END IF;

  v_id := next_sequence_id('SIS-');
  v_barcode := next_barcode();

  INSERT INTO siswa (id, barcode, nama, jenis_kelamin, tanggal_lahir, kelompok, nama_ortu, hp_ortu, tanggal_daftar, status)
  VALUES (v_id, v_barcode, trim(p_nama), v_jk, p_tanggal_lahir, v_kelompok,
          coalesce(p_nama_ortu, ''), normalize_hp(p_hp_ortu), now(), coalesce(nullif(p_status, ''), 'Aktif'));

  RETURN jsonb_build_object('id', v_id, 'barcode', v_barcode);
END;
$$;

-- 5. Perbarui rpc_update_siswa untuk mengubah jenis_kelamin
CREATE OR REPLACE FUNCTION rpc_update_siswa(
  p_id text,
  p_nama text,
  p_kelompok text,
  p_tanggal_lahir date,
  p_nama_ortu text,
  p_hp_ortu text,
  p_status text,
  p_jenis_kelamin text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_lock CONSTANT bigint := hashtext('bsa_mutating_lock');
  v_jk text;
  v_kelompok text;
BEGIN
  PERFORM pg_advisory_xact_lock(v_lock);

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'ID siswa tidak ditemukan.';
  END IF;

  IF p_jenis_kelamin IS NOT NULL AND trim(p_jenis_kelamin) <> '' THEN
    v_jk := CASE WHEN trim(p_jenis_kelamin) IN ('Putri', 'Perempuan') THEN 'Putri' ELSE 'Putra' END;
    v_kelompok := trim(coalesce(p_kelompok, ''));
  ELSIF p_kelompok ~ '^\[JK:(Putra|Putri)\]' THEN
    v_jk := (regexp_match(p_kelompok, '^\[JK:(Putra|Putri)\]'))[1];
    v_kelompok := regexp_replace(coalesce(p_kelompok, ''), '^\[JK:(Putra|Putri)\]', '');
  ELSE
    -- Pertahankan jenis kelamin yang ada bila tidak disediakan
    SELECT jenis_kelamin INTO v_jk FROM siswa WHERE id = p_id;
    v_jk := coalesce(v_jk, 'Putra');
    v_kelompok := trim(coalesce(p_kelompok, ''));
  END IF;

  UPDATE siswa SET
    nama = trim(coalesce(p_nama, '')),
    jenis_kelamin = v_jk,
    kelompok = v_kelompok,
    tanggal_lahir = p_tanggal_lahir,
    nama_ortu = coalesce(p_nama_ortu, ''),
    hp_ortu = normalize_hp(p_hp_ortu),
    status = coalesce(nullif(p_status, ''), 'Aktif')
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data siswa tidak ditemukan.';
  END IF;

  RETURN jsonb_build_object('id', p_id);
END;
$$;

-- 6. Beri hak akses execute ke role service_role
GRANT EXECUTE ON FUNCTION rpc_get_siswa_list() TO service_role;
GRANT EXECUTE ON FUNCTION rpc_add_siswa(text, text, date, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_update_siswa(text, text, text, date, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION rpc_get_siswa_list() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION rpc_add_siswa(text, text, date, text, text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION rpc_update_siswa(text, text, text, date, text, text, text, text) FROM public, anon, authenticated;
