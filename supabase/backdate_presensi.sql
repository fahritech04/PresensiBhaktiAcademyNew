-- =============================================================================
-- FEATURE: BACKDATE PRESENSI — scan telat / latihan hari lama. Idempotent.
-- Contoh: latihan Senin, admin scan Selasa dgn tanggal latihan → presensi
-- dicatat di tanggal Senin, status sesuai jadwal SENIN; duplikat tetap diblok.
-- URUTAN WAJIB: schema.sql → hardening.sql → backdate_presensi.sql.
-- Tidak menambah kolom ke tabel bisnis; default (tanggal = hari ini) tetap sama.
-- =============================================================================

-- Konfigurasi: berapa hari diere backdate diizinkan (default 7).
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
    'iuran_nominal_default', 50000,
    'timezone', 'Asia/Jakarta'
  );
$$;

create or replace function rpc_scan_presensi(p_barcode text, p_tanggal date default null)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
  v_tz text := app_config()->>'timezone';
  v_now timestamptz := now();
  v_local timestamp := v_now at time zone v_tz;
  v_today date := v_local::date;
  v_tanggal date;
  v_hari text;
  v_siswa siswa%rowtype;
  v_existing presensi%rowtype;
  v_jadwal jadwal%rowtype;
  v_status text := 'Hadir';
  v_jam int;
  v_menit int;
  v_toleransi int;
  v_batas_local timestamp;
  v_batas timestamptz;
  v_id text;
  v_barcode text := trim(coalesce(p_barcode, ''));
  v_keterangan text := '';
  v_max_backdate int := coalesce((app_config()->>'scan_backdate_max_days')::int, 7);
begin
  perform pg_advisory_xact_lock(v_lock);

  if v_barcode = '' then
    raise exception 'Kode QR kosong.';
  end if;

  -- Tanggal presensi: default hari ini. p_tanggal = backdate (scan telat,
  -- latihan hari lama) — max v_max_backdate hari diere, tidak bisa di masa depan.
  if p_tanggal is null then
    v_tanggal := v_today;
  else
    if p_tanggal > v_today then
      raise exception 'Tanggal presensi belum tiba (tidak bisa di masa depan).';
    end if;
    if p_tanggal < v_today - v_max_backdate then
      raise exception 'Tanggal presensi terlalu lama (maksimum % hari diere).', v_max_backdate;
    end if;
    v_tanggal := p_tanggal;
    if v_tanggal < v_today then
      v_keterangan := 'Backdate';
    end if;
  end if;

  -- Hari (untuk lookup jadwal) baxari TANGGAL PRESENSI, bukan waktu scan —
  -- supaya backdate scan Senin tetap tercatat sesuai jadwal Senin.
  v_hari := hari_nama(extract(dow from v_tanggal)::int);

  select * into v_siswa from siswa where lower(barcode) = lower(v_barcode) limit 1;
  if not found then
    raise exception 'Kode QR tidak terdaftar. Periksa kembali kartu siswa.';
  end if;
  if v_siswa.status <> 'Aktif' then
    raise exception '% berstatus nonaktif, tidak bisa Presensi.', v_siswa.nama;
  end if;

  select * into v_existing from presensi where siswa_id = v_siswa.id and tanggal = v_tanggal;
  if found then
    raise exception '% sudah tercatat hadir tanggal % pukul %.',
      v_siswa.nama, to_char(v_tanggal, 'YYYY-MM-DD'), to_char(v_existing.waktu at time zone v_tz, 'HH24:MI');
  end if;

  select * into v_jadwal from jadwal
    where lower(trim(kelompok)) = lower(trim(coalesce(v_siswa.kelompok, '')))
      and lower(trim(hari)) = lower(trim(v_hari))
    limit 1;

-- Jadwal.jam_mulai "HH:MM"; tidak valid → selalu "Hadir" (sama dgn versi lama).
-- Batas Telat hanya dicek utk scan HARI INI. Backdate sengaja langsung 'Hadir'
-- (scanner tak tahu telat/tidak di hari lama); keterangan 'Backdate' utk audit.
  if v_tanggal = v_today and found and v_jadwal.jam_mulai ~ '^\d{1,2}:\d{1,2}$' then
    v_jam := split_part(v_jadwal.jam_mulai, ':', 1)::int;
    if v_jam is not null then
      v_menit := coalesce(nullif(split_part(v_jadwal.jam_mulai, ':', 2), '')::int, 0);
      v_toleransi := coalesce(v_jadwal.toleransi_menit, (app_config()->>'toleransi_default_menit')::int);
      v_batas_local := date_trunc('day', v_tanggal) + make_interval(hours => v_jam, mins => v_menit + v_toleransi);
      v_batas := v_batas_local at time zone v_tz;
      if v_now > v_batas then
        v_status := 'Telat';
      end if;
    end if;
  end if;

  v_id := next_sequence_id('ABS-');
  insert into presensi (id, siswa_id, barcode, nama, kelompok, waktu, tanggal, status, keterangan)
  values (v_id, v_siswa.id, v_siswa.barcode, v_siswa.nama, v_siswa.kelompok, v_now, v_tanggal, v_status, v_keterangan);

  return jsonb_build_object('id', v_id, 'nama', v_siswa.nama, 'kelompok', v_siswa.kelompok,
                            'waktu', v_now, 'tanggal', to_char(v_tanggal, 'YYYY-MM-DD'), 'status', v_status);
end;
$$;

-- =============================================================================
-- HAK AKSES: revoke anon/authenticated, hanya service_role (ikut schema.sql).
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