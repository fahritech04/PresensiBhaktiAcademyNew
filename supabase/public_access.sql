-- =============================================================================
-- FEATURE: AKSES PUBLIK (tanpa login) — delta, idempotent.
-- Publik boleh lihat Dashboard & daftar siswa TANPA data sensitif: dashboard
-- tanpa card iuran, siswa tanpa nama_ortu/hp_ortu. Caranya: fungsi menerima
-- p_public (Edge Function kirim true saat tanpa sesi valid).
-- URUTAN: ... → pelatih.sql → public_access.sql.
-- =============================================================================

-- Drop signature lama (0 arg) supaya tidak jadi overload duplikat.
drop function if exists rpc_get_siswa_list();
drop function if exists rpc_get_dashboard_stats();

create or replace function rpc_get_siswa_list(p_public boolean default false)
returns jsonb language plpgsql as $$
declare
  v_tz text := app_config()->>'timezone';
  v_siswa jsonb;
  v_kelompok jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'barcode', s.barcode,
           'nama', s.nama,
           'jenisKelamin', coalesce(s.jenis_kelamin, 'Putra'),
           'tanggalLahir', case when s.tanggal_lahir is not null then to_char(s.tanggal_lahir, 'YYYY-MM-DD') else '' end,
           'kelompok', coalesce(s.kelompok, ''),
           'namaOrtu', case when p_public then '' else coalesce(s.nama_ortu, '') end,
           'hpOrtu', case when p_public then '' else normalize_hp(s.hp_ortu) end,
           'tanggalDaftar', to_char(s.tanggal_daftar at time zone v_tz, 'YYYY-MM-DD'),
           'status', coalesce(nullif(s.status, ''), 'Aktif')
         ) order by s.nama), '[]'::jsonb)
    into v_siswa
    from siswa s;

  select coalesce(to_jsonb(array_agg(distinct k order by k)), '[]'::jsonb)
    into v_kelompok
    from (
      select kelompok as k from siswa where kelompok is not null and kelompok <> ''
      union
      select kelompok as k from jadwal where kelompok is not null and kelompok <> ''
    ) t;

  return jsonb_build_object('siswa', v_siswa, 'kelompok', v_kelompok);
end;
$$;

create or replace function rpc_get_dashboard_stats(p_public boolean default false)
returns jsonb language plpgsql as $$
declare
  v_tz text := app_config()->>'timezone';
  v_today date := (now() at time zone v_tz)::date;
  v_cutoff date := v_today - 6;
  v_total_aktif int;
  v_hadir_hari_ini int := 0;
  v_telat_hari_ini int := 0;
  v_belum_hari_ini int;
  v_tren jsonb;
  v_riwayat jsonb;
  v_iuran_lunas int := 0;
  v_iuran_terkumpul numeric := 0;
  v_bulan int := extract(month from v_today)::int;
  v_tahun int := extract(year from v_today)::int;
begin
  select count(*) into v_total_aktif from siswa where status = 'Aktif';

  select count(*) filter (where status = 'Hadir'), count(*) filter (where status = 'Telat')
    into v_hadir_hari_ini, v_telat_hari_ini
    from presensi where tanggal = v_today;

  v_belum_hari_ini := greatest(0, v_total_aktif - (v_hadir_hari_ini + v_telat_hari_ini));

  select coalesce(jsonb_agg(jsonb_build_object(
           'tanggal', to_char(d, 'YYYY-MM-DD'),
           'hadir', coalesce(c.hadir, 0),
           'telat', coalesce(c.telat, 0)
         ) order by d), '[]'::jsonb)
    into v_tren
    from generate_series(v_cutoff, v_today, interval '1 day') as d
    left join (
      select tanggal, count(*) filter (where status = 'Hadir') as hadir,
             count(*) filter (where status = 'Telat') as telat
        from presensi where tanggal between v_cutoff and v_today
        group by tanggal
    ) c on c.tanggal = d::date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nama', r.nama, 'kelompok', r.kelompok, 'waktu', r.waktu, 'status', r.status
         ) order by r.waktu desc), '[]'::jsonb)
    into v_riwayat
    from presensi r where r.tanggal = v_today;

  -- Agregat iuran hanya dihitung untuk admin (hemat query saat diakses publik).
  if not p_public then
    select count(*) filter (where i.status = 'Lunas'),
           coalesce(sum(i.nominal) filter (where i.status = 'Lunas'), 0)
      into v_iuran_lunas, v_iuran_terkumpul
      from siswa s
      left join iuran i on i.siswa_id = s.id and i.bulan = v_bulan and i.tahun = v_tahun
     where s.status = 'Aktif';
  end if;

  return jsonb_build_object(
    'totalSiswaAktif', v_total_aktif,
    'hadirHariIni', v_hadir_hari_ini,
    'telatHariIni', v_telat_hari_ini,
    'belumPresensiHariIni', v_belum_hari_ini,
    'tren7Hari', v_tren,
    'riwayatHariIni', v_riwayat,
    'iuranBulanIni', case when p_public then null
                          else jsonb_build_object(
                            'bulan', v_bulan, 'tahun', v_tahun,
                            'namaBulan', bulan_nama(v_bulan),
                            'lunas', v_iuran_lunas,
                            'belum', greatest(0, v_total_aktif - v_iuran_lunas),
                            'totalTerkumpul', v_iuran_terkumpul
                          ) end
  );
end;
$$;

-- =============================================================================
-- HAK AKSES: revoke anon/authenticated, hanya service_role (ikut pola delta lain).
-- Fungsi baru di atas dibuat dengan grant default (PUBLIC), jadi harus disapu
-- supaya tidak bisa dipanggil langsung lewat REST oleh anon/authenticated.
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
