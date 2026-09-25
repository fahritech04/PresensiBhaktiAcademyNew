-- =============================================================================
-- FEATURE: PRESENSI PELATIH — Bhakti Sebatung Academy
-- File DELTA: jalan di SQL Editor. Aman dijalankan ulang (idempotent).
--
-- Isi:
--   1. app_config() — key lama + barcode_prefix_pelatih
--   2. Tabel pelatih (barcode = PK, TANPA id surrogate) + barcode_pelatih_seq
--   3. Tabel presensi_pelatih (denormalisasi nama; 1 pelatih 1x/hari)
--   4. Helper next_barcode_pelatih()
--   5. Fungsi rpc_*: get/add/update/delete pelatih, scan, list presensi pelatih
--   6. REVOKE akses anon/authenticated (ikut pola schema.sql)
--
-- URUTAN WAJIB deploy: schema.sql -> hardening.sql -> backdate_presensi.sql
-- -> pelatih.sql. Re-run schema.sql mengreset fungsi rpc_ -> re-run semua delta.
-- =============================================================================

-- =============================================================================
-- 1) KONFIGURASI — key lama + barcode_prefix_pelatih
-- =============================================================================
create or replace function app_config()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'session_hours', 12,
    'max_login_attempts', 5,
    'login_lockout_minutes', 15,
    'ip_max_login_attempts', 10,
    'ip_lockout_minutes', 15,
    'login_min_delay_ms', 350,
    'login_max_delay_ms', 1200,
    'scan_backdate_max_days', 7,
    'toleransi_default_menit', 15,
    'password_pepper', 'bsa-2026-kotabaru',
    'barcode_prefix', 'BSA-',
    'barcode_prefix_pelatih', 'PLT-',
    'iuran_nominal_default', 50000,
    'timezone', 'Asia/Jakarta'
  );
$$;

-- =============================================================================
-- 2) TABEL PELATIH + SEQUENCE BARCODE
-- =============================================================================
create table if not exists pelatih (
  barcode     text primary key,           -- PLT-0001, ...
  nama        text not null,
  status      text not null default 'Aktif',
  created_at  timestamptz not null default now()
);
create index if not exists idx_pelatih_barcode_lower on pelatih (lower(barcode));

-- Sumber nomor urut barcode pelatih (PLT-0001, PLT-0002, ...). Atomik by design.
create sequence if not exists barcode_pelatih_seq;

-- =============================================================================
-- 3) TABEL PRESENSI PELATIH
-- =============================================================================
create table if not exists presensi_pelatih (
  id              text primary key,       -- next_sequence_id('ABS-PLT-')
  pelatih_barcode text references pelatih(barcode) on delete set null,
  nama            text,                   -- snapshot (denormalisasi)
  waktu           timestamptz not null,
  tanggal         date not null,
  status          text not null default 'Hadir',
  keterangan      text default '',
  unique (pelatih_barcode, tanggal)       -- 1 pelatih 1x per hari (atomik)
);
create index if not exists idx_presensi_pelatih_tanggal on presensi_pelatih (tanggal);
create index if not exists idx_presensi_pelatih_waktu   on presensi_pelatih (waktu desc);

-- =============================================================================
-- KEAMANAN: RLS aktif tanpa policy, hanya service_role lewat Edge Function.
-- =============================================================================
alter table pelatih           enable row level security;
alter table presensi_pelatih  enable row level security;

revoke all on table pelatih, presensi_pelatih from anon, authenticated;

-- =============================================================================
-- 4) HELPER
-- =============================================================================
create or replace function next_barcode_pelatih()
returns text language plpgsql volatile as $$
begin
  if not exists (select 1 from pelatih) then
    perform setval('barcode_pelatih_seq', 1, false);
  end if;

  return (app_config()->>'barcode_prefix_pelatih') || lpad(nextval('barcode_pelatih_seq')::text, 4, '0');
end;
$$;

-- =============================================================================
-- 5) FUNGSI RPC
-- =============================================================================
create or replace function rpc_get_pelatih_list()
returns jsonb language plpgsql as $$
declare
  v_pelatih jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'barcode', p.barcode,
           'nama', p.nama,
           'status', coalesce(nullif(p.status, ''), 'Aktif')
         ) order by p.nama), '[]'::jsonb)
    into v_pelatih
    from pelatih p;

  return jsonb_build_object('pelatih', v_pelatih);
end;
$$;

create or replace function rpc_add_pelatih(p_nama text, p_status text default null)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
  v_barcode text;
begin
  perform pg_advisory_xact_lock(v_lock);

  if trim(coalesce(p_nama, '')) = '' then
    raise exception 'Nama pelatih wajib diisi.';
  end if;

  v_barcode := next_barcode_pelatih();

  insert into pelatih (barcode, nama, status)
  values (v_barcode, trim(p_nama), coalesce(nullif(p_status, ''), 'Aktif'));

  return jsonb_build_object('barcode', v_barcode);
end;
$$;

create or replace function rpc_update_pelatih(p_barcode text, p_nama text, p_status text default null)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_barcode is null then
    raise exception 'Barcode pelatih tidak ditemukan.';
  end if;
  if trim(coalesce(p_nama, '')) = '' then
    raise exception 'Nama pelatih wajib diisi.';
  end if;

  update pelatih set
    nama = trim(coalesce(p_nama, '')),
    status = coalesce(nullif(p_status, ''), 'Aktif')
  where barcode = p_barcode;

  if not found then
    raise exception 'Data pelatih tidak ditemukan.';
  end if;

  return jsonb_build_object('barcode', p_barcode);
end;
$$;

create or replace function rpc_delete_pelatih(p_barcode text)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_barcode is null then
    raise exception 'Barcode pelatih tidak ditemukan.';
  end if;

  delete from pelatih where barcode = p_barcode;
  if not found then
    raise exception 'Data pelatih tidak ditemukan.';
  end if;

  if not exists (select 1 from pelatih) then
    perform setval('barcode_pelatih_seq', 1, false);
  end if;

  return jsonb_build_object('barcode', p_barcode);
end;
$$;

create or replace function rpc_scan_presensi_pelatih(p_barcode text)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
  v_tz text := app_config()->>'timezone';
  v_now timestamptz := now();
  v_local timestamp := v_now at time zone v_tz;
  v_tanggal date := v_local::date;
  v_pelatih pelatih%rowtype;
  v_existing presensi_pelatih%rowtype;
  v_id text;
  v_barcode text := trim(coalesce(p_barcode, ''));
begin
  perform pg_advisory_xact_lock(v_lock);

  if v_barcode = '' then
    raise exception 'Kode QR kosong.';
  end if;

  select * into v_pelatih from pelatih where lower(barcode) = lower(v_barcode) limit 1;
  if not found then
    raise exception 'Kode QR pelatih tidak terdaftar.';
  end if;
  if v_pelatih.status <> 'Aktif' then
    raise exception '% berstatus nonaktif, tidak bisa Presensi.', v_pelatih.nama;
  end if;

  select * into v_existing from presensi_pelatih where pelatih_barcode = v_pelatih.barcode and tanggal = v_tanggal;
  if found then
    raise exception '% sudah tercatat hadir hari ini pukul %.',
      v_pelatih.nama, to_char(v_existing.waktu at time zone v_tz, 'HH24:MI');
  end if;

  v_id := next_sequence_id('ABS-PLT-');
  insert into presensi_pelatih (id, pelatih_barcode, nama, waktu, tanggal, status, keterangan)
  values (v_id, v_pelatih.barcode, v_pelatih.nama, v_now, v_tanggal, 'Hadir', '');

  return jsonb_build_object('id', v_id, 'nama', v_pelatih.nama, 'waktu', v_now, 'status', 'Hadir');
end;
$$;

create or replace function rpc_get_presensi_pelatih_list(
  p_dari date default null, p_sampai date default null, p_status text default null,
  p_limit int default null, p_offset int default null
) returns jsonb language plpgsql as $$
declare
  v_rows jsonb;
  v_total int;
  v_offset int := coalesce(p_offset, 0);
begin
  with base as (
    select id, nama, waktu, status
      from presensi_pelatih r
     where (p_dari is null or r.tanggal >= p_dari)
       and (p_sampai is null or r.tanggal <= p_sampai)
       and (p_status is null or p_status = '' or r.status = p_status)
  )
  select
      coalesce(jsonb_agg(b.item order by b.waktu desc), '[]'::jsonb),
      (select count(*) from base)
    into v_rows, v_total
    from (
      select jsonb_build_object('id', id, 'nama', nama, 'waktu', waktu, 'status', status) as item,
             waktu
        from base
       order by waktu desc
       limit ((case when p_limit is null then 1000000000 else p_limit end))
       offset v_offset
    ) b;

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'limit', p_limit, 'offset', v_offset);
end;
$$;

-- Rekap kehadiran pelatih dihitung di DATABASE (group by nama + count), supaya
-- browser tidak menarik seluruh baris presensi — hemat bandwidth (filosofi yang
-- sama dengan agregat iuran di rpc_get_dashboard_stats).
create or replace function rpc_get_presensi_pelatih_rekap(
  p_dari date default null, p_sampai date default null, p_status text default null
) returns jsonb language plpgsql as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'nama', g.nama,
           'hadir', g.hadir,
           'telat', g.telat,
           'total', g.hadir + g.telat
         ) order by g.nama), '[]'::jsonb)
    into v_rows
    from (
      select nama,
             count(*) filter (where status = 'Hadir') as hadir,
             count(*) filter (where status = 'Telat') as telat
        from presensi_pelatih
       where (p_dari is null or tanggal >= p_dari)
         and (p_sampai is null or tanggal <= p_sampai)
         and (p_status is null or p_status = '' or status = p_status)
       group by nama
    ) g;

  return jsonb_build_object('rows', v_rows);
end;
$$;

-- =============================================================================
-- 6) HAK AKSES: revoke anon/authenticated, hanya service_role (ikut schema.sql).
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
