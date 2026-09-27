-- =============================================================================
-- FEATURE: VERIFIKASI AKUN PELATIH (Google) + QR PELATIH — Bhakti Sebatung Academy
-- File DELTA: jalan di SQL Editor. Aman dijalankan ulang (idempotent).
--
-- Isi:
--   1. pelatih + kolom verifikasi (boolean, default false)
--   2. rpc_get_pelatih_list()  — sertakan email & verifikasi (untuk halaman admin)
--   3. rpc_set_pelatih_verifikasi() — admin tandai/batalkan verifikasi
--   4. rpc_get_pelatih_self() — baca data pelatih login (untuk scan gate + QR sendiri)
--   5. REVOKE akses anon/authenticated (ikut pola schema.sql)
--
-- Pelatih Google belum terverifikasi TIDAK boleh scan presensi siswa — gate
-- dilakukan di Edge Function (scanPresensi) lewat rpc_get_pelatih_self().verifikasi.
--
-- URUTAN WAJIB deploy: schema.sql -> hardening.sql -> backdate_presensi.sql ->
-- pelatih.sql -> pelatih_google.sql -> pelatih_verifikasi.sql.
-- =============================================================================

-- =============================================================================
-- 1) TABEL PELATIH — tambah kolom verifikasi (ADITIF, tidak ubah data lama).
--    Default false: semua pelatih (lama & google baru) mulai "belum terverifikasi"
--    sampai admin menandai lewat halaman Data Pelatih.
-- =============================================================================
alter table pelatih
  add column if not exists verifikasi boolean not null default false;

-- =============================================================================
-- 2) GET PELATIH LIST — tambah email & verifikasi (untuk kolom di halaman admin).
-- =============================================================================
create or replace function rpc_get_pelatih_list()
returns jsonb language plpgsql as $$
declare
  v_pelatih jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'barcode', p.barcode,
           'nama', p.nama,
           'status', coalesce(nullif(p.status, ''), 'Aktif'),
           'email', coalesce(p.email, ''),
           'verifikasi', coalesce(p.verifikasi, false)
         ) order by p.nama), '[]'::jsonb)
    into v_pelatih
    from pelatih p;

  return jsonb_build_object('pelatih', v_pelatih);
end;
$$;

-- =============================================================================
-- 3) SET VERIFIKASI — admin tandai (true) / batalkan (false) verifikasi pelatih.
-- =============================================================================
create or replace function rpc_set_pelatih_verifikasi(p_barcode text, p_verifikasi boolean)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_barcode is null then
    raise exception 'Barcode pelatih tidak ditemukan.';
  end if;

  update pelatih set verifikasi = coalesce(p_verifikasi, false)
  where barcode = p_barcode;

  if not found then
    raise exception 'Data pelatih tidak ditemukan.';
  end if;

  return jsonb_build_object('barcode', p_barcode, 'verifikasi', coalesce(p_verifikasi, false));
end;
$$;

-- =============================================================================
-- 4) GET PELATIH SELF — cari pelatih by email (session.username) atau auth_uid.
--    Dipakai: (a) scan gate verifikasi di Edge Function, (b) halaman QR sendiri.
-- =============================================================================
create or replace function rpc_get_pelatih_self(p_email text)
returns jsonb language plpgsql as $$
declare
  v_pelatih pelatih%rowtype;
begin
  select * into v_pelatih from pelatih
    where auth_uid = trim(coalesce(p_email, ''))
       or lower(email) = lower(trim(coalesce(p_email, '')))
    limit 1;

  if not found then
    raise exception 'Akun pelatih tidak ditemukan.';
  end if;

  return jsonb_build_object(
    'barcode', v_pelatih.barcode,
    'nama', v_pelatih.nama,
    'email', coalesce(v_pelatih.email, ''),
    'verifikasi', coalesce(v_pelatih.verifikasi, false)
  );
end;
$$;

-- =============================================================================
-- 5) HAK AKSES: revoke anon/authenticated, hanya service_role (ikut schema.sql).
-- =============================================================================
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated;', f.sig);
    execute format('grant execute on function %s to service_role;', f.sig);
  end loop;
end;
$$;
