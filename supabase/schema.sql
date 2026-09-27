-- =============================================================================
-- MASTER SKEMA SUPABASE LENGKAP & TERBARU — Bhakti Sebatung Academy
-- Versi: Terintegrasi Fitur Jenis Kelamin (Putra & Putri)
--
-- File ini adalah SATU-SATUNYA file master SQL yang mencakup seluruh skema database:
--   1. Ekstensi pgcrypto & fungsi konfigurasi app_config()
--   2. Tabel: admin, siswa (dengan kolom jenis_kelamin), jadwal, presensi,
--      iuran, sessions, login_attempts, dan sequence barcode_seq
--   3. Row Level Security (RLS) & pencabutan akses langsung anon/authenticated
--   4. Helper (hash_password, next_barcode, sync_barcode_seq, normalize_hp)
--   5. Seluruh fungsi RPC:
--      - rpc_login, rpc_verify_token, reset_admin
--      - rpc_get_siswa_list (mengembalikan jenisKelamin)
--      - rpc_add_siswa (menerima p_jenis_kelamin & fallback)
--      - rpc_update_siswa (menerima p_jenis_kelamin & fallback)
--      - rpc_delete_siswa (reset barcode_seq otomatis jika siswa terakhir dihapus)
--      - rpc_get_kelompok_list, rpc_scan_presensi
--      - rpc_get_iuran_bulan, rpc_tandai_iuran, rpc_batalkan_iuran, rpc_update_iuran
--      - rpc_get_presensi_list, rpc_get_dashboard_stats
--   6. Pengaturan hak akses (grant execute ke service_role)
--
-- CARA PENGGUNAAN (Jika suatu hari membuat project Supabase baru dari awal):
--   1. Buat project baru di Supabase Dashboard (https://supabase.com/dashboard)
--   2. Buka menu SQL Editor -> New Query
--   3. Salin dan tempel SELURUH isi file ini -> klik Run
--   Database langsung 100% siap dan lengkap dengan fitur jenis kelamin!
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- KONFIGURASI — setara object `CONFIG` di code.gs. Edit di SINI SAJA kalau
-- perlu ganti pepper password, nominal iuran default, dsb.
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
    'toleransi_default_menit', 15,
    'password_pepper', 'bsa-2026-kotabaru',   -- boleh diganti, tidak wajib
    'barcode_prefix', 'BSA-',
    'iuran_nominal_default', 50000,
    -- PENTING: samakan dengan timezone project Apps Script lama kamu
    -- (dulu: File > Project Settings > Time zone) supaya batas Hadir/Telat
    -- dan pembagian "hari ini" tetap identik dengan sebelum migrasi.
    'timezone', 'Asia/Jakarta'
  );
$$;

-- Catatan: array literal Postgres 1-indexed (bukan 0-indexed seperti JS),
-- jadi dipakai [p_bulan + 1] supaya bulan_nama(1) = 'Januari', dst.
create or replace function bulan_nama(p_bulan int)
returns text language sql immutable as $$
  select (array['', 'Januari','Februari','Maret','April','Mei','Juni','Juli',
                'Agustus','September','Oktober','November','Desember'])[p_bulan + 1];
$$;

-- p_dow: 0=Minggu .. 6=Sabtu (sama seperti Date.getDay() di JavaScript)
create or replace function hari_nama(p_dow int)
returns text language sql immutable as $$
  select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[p_dow + 1];
$$;

-- =============================================================================
-- TABEL — setara sheet Siswa/Presensi/Jadwal/Iuran/Admin
-- =============================================================================
create table if not exists admin (
  username        text primary key,
  password_hash   text not null,
  nama            text not null,
  role            text not null default 'Pengurus',
  status          text not null default 'Aktif'
);

create table if not exists siswa (
  id              text primary key,
  barcode         text not null unique,
  nama            text not null,
  jenis_kelamin   text not null default 'Putra' check (jenis_kelamin in ('Putra', 'Putri')),
  tanggal_lahir   date,
  kelompok        text default '',
  nama_ortu       text default '',
  hp_ortu         text default '',
  tanggal_daftar  timestamptz not null default now(),
  status          text not null default 'Aktif'
);

create table if not exists jadwal (
  kelompok        text not null,
  hari            text not null,
  jam_mulai       text,
  jam_selesai     text,
  toleransi_menit int,
  primary key (kelompok, hari)
);

-- Kolom `tanggal` = tanggal kalender (timezone app_config()) saat presensi
-- dicatat. Dipakai untuk constraint UNIQUE "1 siswa hanya 1x presensi/hari"
-- secara atomik (menggantikan cek manual + LockService di code.gs lama).
-- siswa_id boleh NULL & on delete SET NULL (bukan cascade): kalau siswa
-- dihapus, riwayat presensi lamanya TETAP tersimpan (nama/kelompok/waktu
-- sudah didenormalisasi di sini) — sama seperti pesan konfirmasi hapus di
-- siswa.js: "Riwayat presensi lama tetap tersimpan."
create table if not exists presensi (
  id              text primary key,
  siswa_id        text references siswa(id) on delete set null,
  barcode         text,
  nama            text,
  kelompok        text,
  waktu           timestamptz not null,
  tanggal         date not null,
  status          text not null,
  keterangan      text default '',
  unique (siswa_id, tanggal)
);
create index if not exists idx_presensi_waktu   on presensi (waktu desc);
-- Index komposit untuk filter riwayat & dashboard (tanggal + kelompok/status).
-- Subsumes index `tanggal` lama (priffix sama) — drop supaya tidak redundant.
drop index if exists idx_presensi_tanggal;
create index if not exists idx_presensi_tanggal_kelompok_status on presensi (tanggal, kelompok, status);
-- Index fungsional supaya lookup scan (lower(barcode)) memakai index, bukan full scan.
create index if not exists idx_siswa_barcode_lower on siswa (lower(barcode));

-- Filosofi tetap sama seperti sebelumnya: TIDAK ADA baris untuk kombinasi
-- siswa+bulan+tahun berarti "Belum Bayar". Baris baru dibuat hanya saat
-- ditandai Lunas.
-- Sama seperti presensi: siswa_id nullable + ON DELETE SET NULL supaya
-- riwayat iuran lama tidak ikut terhapus saat data siswa dihapus.
create table if not exists iuran (
  id              text primary key,
  siswa_id        text references siswa(id) on delete set null,
  bulan           int not null check (bulan between 1 and 12),
  tahun           int not null check (tahun >= 2000),
  nominal         numeric not null default 0,
  status          text not null default 'Lunas',
  tanggal_bayar   date,
  keterangan      text default '',
  dicatat_oleh    text default '',
  unique (siswa_id, bulan, tahun)
);

-- Pengganti PropertiesService (SESSIONS) di Apps Script lama.
create table if not exists sessions (
  token   text primary key,
  username text not null,
  nama    text not null,
  role    text not null,
  exp     timestamptz not null
);
create index if not exists idx_sessions_exp on sessions (exp);

-- Pengganti PropertiesService (LOGIN_ATTEMPTS) — proteksi brute-force login.
create table if not exists login_attempts (
  username_key  text primary key,
  count         int not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);

-- Sumber nomor urut barcode (BSA-0001, BSA-0002, ...). Atomik by design,
-- jadi tidak mungkin dua siswa mendapat barcode yang sama meski didaftarkan
-- bersamaan (lebih kuat dari cara lama yang scan nilai maksimum di sheet).
create sequence if not exists barcode_seq;

-- =============================================================================
-- KEAMANAN: kunci akses langsung dari klien.
-- Semua akses WAJIB lewat Edge Function (pakai service_role key), persis
-- seperti dulu semua akses ke Spreadsheet WAJIB lewat Web App Apps Script.
-- RLS aktif tanpa policy apa pun -> anon & authenticated ditolak total;
-- hanya service_role yang bisa baca/tulis tabel-tabel ini.
-- =============================================================================
alter table admin          enable row level security;
alter table siswa          enable row level security;
alter table jadwal         enable row level security;
alter table presensi       enable row level security;
alter table iuran          enable row level security;
alter table sessions       enable row level security;
alter table login_attempts enable row level security;

revoke all on table admin, siswa, jadwal, presensi, iuran, sessions, login_attempts
  from anon, authenticated;

-- =============================================================================
-- HELPER
-- =============================================================================
create or replace function hash_password(p_password text)
returns text language sql immutable as $$
  select encode(digest(p_password || ':' || (app_config()->>'password_pepper'), 'sha256'), 'hex');
$$;

create or replace function next_sequence_id(p_prefix text)
returns text language sql volatile as $$
  select p_prefix || split_part(gen_random_uuid()::text, '-', 1);
$$;

create or replace function next_barcode()
returns text language plpgsql volatile as $$
begin
  -- Jika tabel siswa kosong, mulai kembali dari BSA-0001.
  -- Fungsi ini dipanggil dari rpc_add_siswa() yang sudah memakai
  -- advisory lock, sehingga reset aman terhadap pendaftaran bersamaan.
  if not exists (select 1 from siswa) then
    perform setval('barcode_seq', 1, false);
  end if;

  return (app_config()->>'barcode_prefix') || lpad(nextval('barcode_seq')::text, 4, '0');
end;
$$;

-- Jalankan manual sekali setelah import data siswa lama, supaya nomor
-- barcode berikutnya melanjutkan dari yang terbesar, bukan mulai dari 1 lagi.
create or replace function sync_barcode_seq()
returns void language plpgsql as $$
declare
  v_max int;
begin
  select coalesce(max((regexp_match(barcode, '(\d+)$'))[1]::int), 0)
    into v_max
    from siswa;

  if v_max = 0 then
    -- Tidak ada data siswa -> barcode berikutnya BSA-0001.
    perform setval('barcode_seq', 1, false);
  else
    -- Ada data -> barcode berikutnya melanjutkan dari nomor terbesar.
    perform setval('barcode_seq', v_max, true);
  end if;
end;
$$;

-- 08xxx -> 628xxx, 8xxx -> 628xxx, sudah 62xxx -> tetap (sama seperti normalizeHP_)
create or replace function normalize_hp(p_hp text)
returns text language plpgsql immutable as $$
declare
  v_clean text;
begin
  v_clean := regexp_replace(coalesce(p_hp, ''), '[\s\-().+]', '', 'g');
  if v_clean = '' then
    return '';
  elsif left(v_clean, 2) = '08' then
    return '62' || substr(v_clean, 2);
  elsif left(v_clean, 1) = '8' and length(v_clean) >= 9 then
    return '62' || v_clean;
  else
    return v_clean;
  end if;
end;
$$;

create or replace function register_failed_login(p_key text, p_max_attempts int, p_window interval)
returns void language plpgsql as $$
declare
  v_row login_attempts%rowtype;
begin
  select * into v_row from login_attempts where username_key = p_key;
  if not found or now() - v_row.window_start >= p_window then
    v_row.count := 0;
    v_row.window_start := now();
  end if;
  v_row.count := v_row.count + 1;
  if v_row.count >= p_max_attempts then
    v_row.locked_until := now() + p_window;
    v_row.count := 0;
    v_row.window_start := now();
  else
    v_row.locked_until := null;
  end if;

  insert into login_attempts (username_key, count, window_start, locked_until)
  values (p_key, v_row.count, v_row.window_start, v_row.locked_until)
  on conflict (username_key) do update
    set count = excluded.count,
        window_start = excluded.window_start,
        locked_until = excluded.locked_until;
end;
$$;

-- =============================================================================
-- AUTH — setara actionLogin, verifyToken, saveSession_, dst.
-- =============================================================================
create or replace function rpc_login(p_username text, p_password text)
returns jsonb language plpgsql as $$
declare
  v_username text := trim(coalesce(p_username, ''));
  v_password text := coalesce(p_password, '');
  v_key      text := lower(v_username);
  v_cfg      jsonb := app_config();
  v_max_attempts     int      := (v_cfg->>'max_login_attempts')::int;
  v_lockout_minutes  int      := (v_cfg->>'login_lockout_minutes')::int;
  v_session_hours    int      := (v_cfg->>'session_hours')::int;
  v_window   interval := (v_lockout_minutes || ' minutes')::interval;
  v_attempt  login_attempts%rowtype;
  v_admin    admin%rowtype;
  v_token    text;
begin
  if v_username = '' or v_password = '' then
    raise exception 'Username dan password wajib diisi.';
  end if;

  select * into v_attempt from login_attempts where username_key = v_key;
  if found and v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Terlalu banyak percobaan gagal. Coba lagi dalam % menit.',
      ceil(extract(epoch from (v_attempt.locked_until - now())) / 60);
  end if;

  select * into v_admin from admin where lower(username) = v_key;

  if not found then
    perform register_failed_login(v_key, v_max_attempts, v_window);
    raise exception 'Username atau password salah.';
  end if;
  if v_admin.status <> 'Aktif' then
    raise exception 'Akun ini tidak aktif. Hubungi pengurus utama.';
  end if;
  if v_admin.password_hash <> hash_password(v_password) then
    perform register_failed_login(v_key, v_max_attempts, v_window);
    raise exception 'Username atau password salah.';
  end if;

  delete from login_attempts where username_key = v_key;
  delete from sessions where exp < now();

  v_token := gen_random_uuid()::text;
  insert into sessions (token, username, nama, role, exp)
  values (v_token, v_admin.username, v_admin.nama, v_admin.role, now() + (v_session_hours || ' hours')::interval);

  return jsonb_build_object('token', v_token, 'username', v_admin.username, 'nama', v_admin.nama, 'role', v_admin.role);
end;
$$;

create or replace function rpc_verify_token(p_token text)
returns jsonb language plpgsql as $$
declare
  v_session sessions%rowtype;
begin
  if p_token is null or p_token = '' then
    return null;
  end if;
  select * into v_session from sessions where token = p_token;
  if not found or v_session.exp < now() then
    return null;
  end if;
  return jsonb_build_object('username', v_session.username, 'nama', v_session.nama, 'role', v_session.role);
end;
$$;

-- Setara resetAdmin() di code.gs — reset akun pertama ke admin/admin123.
create or replace function reset_admin(p_username text default 'admin', p_password text default 'admin123')
returns void language plpgsql as $$
begin
  update admin set password_hash = hash_password(p_password), status = 'Aktif' where username = p_username;
  if not found then
    insert into admin (username, password_hash, nama, role, status)
    values (p_username, hash_password(p_password), 'Admin Academy', 'Pengurus', 'Aktif');
  end if;
  delete from login_attempts where username_key = lower(p_username);
end;
$$;

-- Akun admin default (username: admin / password: admin123).
-- SEGERA GANTI setelah login pertama, persis seperti pesan setupSpreadsheet() dulu.
insert into admin (username, password_hash, nama, role, status)
values ('admin', hash_password('Bsacademy135*'), 'Admin Academy', 'Pengurus', 'Aktif')
on conflict (username) do nothing;

-- =============================================================================
-- SISWA — setara actionGetSiswaList / actionAddSiswa / actionUpdateSiswa / actionDeleteSiswa
-- =============================================================================
create or replace function rpc_get_siswa_list()
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
           'namaOrtu', coalesce(s.nama_ortu, ''),
           'hpOrtu', normalize_hp(s.hp_ortu),
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

drop function if exists rpc_add_siswa(text, text, date, text, text, text);
create or replace function rpc_add_siswa(
  p_nama text, p_kelompok text, p_tanggal_lahir date,
  p_nama_ortu text, p_hp_ortu text, p_status text,
  p_jenis_kelamin text default null
) returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
  v_id text;
  v_barcode text;
  v_jk text;
  v_kelompok text;
begin
  perform pg_advisory_xact_lock(v_lock);

  if trim(coalesce(p_nama, '')) = '' then
    raise exception 'Nama wajib diisi.';
  end if;

  if p_jenis_kelamin is not null and trim(p_jenis_kelamin) <> '' then
    v_jk := case when trim(p_jenis_kelamin) in ('Putri', 'Perempuan') then 'Putri' else 'Putra' end;
    v_kelompok := trim(coalesce(p_kelompok, ''));
  elsif p_kelompok ~ '^\[JK:(Putra|Putri)\]' then
    v_jk := (regexp_match(p_kelompok, '^\[JK:(Putra|Putri)\]'))[1];
    v_kelompok := regexp_replace(coalesce(p_kelompok, ''), '^\[JK:(Putra|Putri)\]', '');
  else
    v_jk := 'Putra';
    v_kelompok := trim(coalesce(p_kelompok, ''));
  end if;

  v_id := next_sequence_id('SIS-');
  v_barcode := next_barcode();

  insert into siswa (id, barcode, nama, jenis_kelamin, tanggal_lahir, kelompok, nama_ortu, hp_ortu, tanggal_daftar, status)
  values (v_id, v_barcode, trim(p_nama), v_jk, p_tanggal_lahir, v_kelompok,
          coalesce(p_nama_ortu, ''), normalize_hp(p_hp_ortu), now(), coalesce(nullif(p_status, ''), 'Aktif'));

  return jsonb_build_object('id', v_id, 'barcode', v_barcode);
end;
$$;

drop function if exists rpc_update_siswa(text, text, text, date, text, text, text);
create or replace function rpc_update_siswa(
  p_id text, p_nama text, p_kelompok text, p_tanggal_lahir date,
  p_nama_ortu text, p_hp_ortu text, p_status text,
  p_jenis_kelamin text default null
) returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
  v_jk text;
  v_kelompok text;
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_id is null then
    raise exception 'ID siswa tidak ditemukan.';
  end if;

  if p_jenis_kelamin is not null and trim(p_jenis_kelamin) <> '' then
    v_jk := case when trim(p_jenis_kelamin) in ('Putri', 'Perempuan') then 'Putri' else 'Putra' end;
    v_kelompok := trim(coalesce(p_kelompok, ''));
  elsif p_kelompok ~ '^\[JK:(Putra|Putri)\]' then
    v_jk := (regexp_match(p_kelompok, '^\[JK:(Putra|Putri)\]'))[1];
    v_kelompok := regexp_replace(coalesce(p_kelompok, ''), '^\[JK:(Putra|Putri)\]', '');
  else
    select jenis_kelamin into v_jk from siswa where id = p_id;
    v_jk := coalesce(v_jk, 'Putra');
    v_kelompok := trim(coalesce(p_kelompok, ''));
  end if;

  update siswa set
    nama = trim(coalesce(p_nama, '')),
    jenis_kelamin = v_jk,
    kelompok = v_kelompok,
    tanggal_lahir = p_tanggal_lahir,
    nama_ortu = coalesce(p_nama_ortu, ''),
    hp_ortu = normalize_hp(p_hp_ortu),
    status = coalesce(nullif(p_status, ''), 'Aktif')
  where id = p_id;

  if not found then
    raise exception 'Data siswa tidak ditemukan.';
  end if;

  return jsonb_build_object('id', p_id);
end;
$$;

create or replace function rpc_delete_siswa(p_id text)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_id is null then
    raise exception 'ID siswa tidak ditemukan.';
  end if;

  delete from siswa where id = p_id;
  if not found then
    raise exception 'Data siswa tidak ditemukan.';
  end if;

  -- Jika siswa yang dihapus adalah siswa terakhir, reset sequence.
  -- Penghapusan siswa lain tidak mengulang nomor barcode lama.
  if not exists (select 1 from siswa) then
    perform setval('barcode_seq', 1, false);
  end if;

  return jsonb_build_object('id', p_id);
end;
$$;

-- =============================================================================
-- JADWAL / KELOMPOK — setara actionGetKelompokList
-- =============================================================================
create or replace function rpc_get_kelompok_list()
returns jsonb language sql as $$
  select jsonb_build_object('kelompok', coalesce(to_jsonb(array_agg(distinct k order by k)), '[]'::jsonb))
  from (
    select kelompok as k from siswa where kelompok is not null and kelompok <> ''
    union
    select kelompok as k from jadwal where kelompok is not null and kelompok <> ''
  ) t;
$$;

-- =============================================================================
-- SCAN PRESENSI — setara actionscanPresensi + determineStatus_ + sudahPresensiHariIni_
-- Dibungkus 1 transaksi + advisory lock supaya "sudah presensi hari ini" &
-- penentuan Hadir/Telat tetap atomik walau ada scan berbarengan.
-- =============================================================================
create or replace function rpc_scan_presensi(p_barcode text)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
  v_tz text := app_config()->>'timezone';
  v_now timestamptz := now();
  v_local timestamp := v_now at time zone v_tz;
  v_tanggal date := v_local::date;
  v_hari text := hari_nama(extract(dow from v_local)::int);
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
begin
  perform pg_advisory_xact_lock(v_lock);

  if v_barcode = '' then
    raise exception 'Kode QR kosong.';
  end if;

  select * into v_siswa from siswa where lower(barcode) = lower(v_barcode) limit 1;
  if not found then
    raise exception 'Kode QR tidak terdaftar. Periksa kembali kartu siswa.';
  end if;
  if v_siswa.status <> 'Aktif' then
    raise exception '% berstatus nonaktif, tidak bisa Presensi.', v_siswa.nama;
  end if;

  select * into v_existing from presensi where siswa_id = v_siswa.id and tanggal = v_tanggal;
  if found then
    raise exception '% sudah tercatat hadir hari ini pukul %.',
      v_siswa.nama, to_char(v_existing.waktu at time zone v_tz, 'HH24:MI');
  end if;

  select * into v_jadwal from jadwal
    where lower(trim(kelompok)) = lower(trim(coalesce(v_siswa.kelompok, '')))
      and lower(trim(hari)) = lower(trim(v_hari))
    limit 1;

  -- Jadwal.jam_mulai diisi manual oleh admin (format "HH:MM"); jika formatnya
  -- tidak valid, perlakukan sama seperti tidak ada jadwal -> selalu "Hadir"
  -- (sama seperti isNaN(jam) check di determineStatus_ yang lama).
  if found and v_jadwal.jam_mulai ~ '^\d{1,2}:\d{1,2}$' then
    v_jam := split_part(v_jadwal.jam_mulai, ':', 1)::int;
    if v_jam is not null then
      v_menit := coalesce(nullif(split_part(v_jadwal.jam_mulai, ':', 2), '')::int, 0);
      v_toleransi := coalesce(v_jadwal.toleransi_menit, (app_config()->>'toleransi_default_menit')::int);
      v_batas_local := date_trunc('day', v_local) + make_interval(hours => v_jam, mins => v_menit + v_toleransi);
      v_batas := v_batas_local at time zone v_tz;
      if v_now > v_batas then
        v_status := 'Telat';
      end if;
    end if;
  end if;

  v_id := next_sequence_id('ABS-');
  insert into presensi (id, siswa_id, barcode, nama, kelompok, waktu, tanggal, status, keterangan)
  values (v_id, v_siswa.id, v_siswa.barcode, v_siswa.nama, v_siswa.kelompok, v_now, v_tanggal, v_status, '');

  return jsonb_build_object('id', v_id, 'nama', v_siswa.nama, 'kelompok', v_siswa.kelompok, 'waktu', v_now, 'status', v_status);
end;
$$;

-- =============================================================================
-- IURAN BULANAN — setara actionGetIuranBulan / actionTandaiIuran /
-- actionBatalkanIuran / actionUpdateIuran / actionGetRiwayatIuranSiswa
-- =============================================================================
create or replace function rpc_get_iuran_bulan(p_bulan int default null, p_tahun int default null, p_kelompok text default null)
returns jsonb language plpgsql as $$
declare
  v_tz text := app_config()->>'timezone';
  v_bulan int := coalesce(p_bulan, extract(month from (now() at time zone v_tz))::int);
  v_tahun int := coalesce(p_tahun, extract(year from (now() at time zone v_tz))::int);
  v_rows jsonb;
  v_total_siswa int;
  v_total_lunas int;
  v_total_belum int;
  v_total_terkumpul numeric;
begin
  if v_bulan < 1 or v_bulan > 12 then
    raise exception 'Bulan tidak valid.';
  end if;

  with basis as (
    select s.id, s.nama, s.kelompok
      from siswa s
     where s.status = 'Aktif'
       and (p_kelompok is null or p_kelompok = '' or s.kelompok = p_kelompok)
  ),
  gabung as (
    select b.id as siswa_id, b.nama, b.kelompok,
           case when i.id is not null then 'Lunas' else 'Belum Bayar' end as status,
           i.nominal, i.tanggal_bayar, i.keterangan, i.id as iuran_id
      from basis b
      left join iuran i on i.siswa_id = b.id and i.bulan = v_bulan and i.tahun = v_tahun
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'siswaId', g.siswa_id, 'nama', g.nama, 'kelompok', g.kelompok, 'status', g.status,
      'nominal', g.nominal,
      'tanggalBayar', case when g.tanggal_bayar is not null then to_char(g.tanggal_bayar, 'YYYY-MM-DD') else null end,
      'keterangan', coalesce(g.keterangan, ''),
      'iuranId', g.iuran_id
    ) order by g.nama), '[]'::jsonb),
    count(*),
    count(*) filter (where g.status = 'Lunas'),
    coalesce(sum(g.nominal) filter (where g.status = 'Lunas'), 0)
  into v_rows, v_total_siswa, v_total_lunas, v_total_terkumpul
  from gabung g;

  v_total_belum := v_total_siswa - v_total_lunas;

  return jsonb_build_object(
    'rows', v_rows, 'bulan', v_bulan, 'tahun', v_tahun, 'namaBulan', bulan_nama(v_bulan),
    'totalSiswa', v_total_siswa, 'totalLunas', v_total_lunas, 'totalBelum', v_total_belum,
    'totalTerkumpul', v_total_terkumpul, 'nominalDefault', (app_config()->>'iuran_nominal_default')::numeric
  );
end;
$$;

create or replace function rpc_tandai_iuran(
  p_siswa_id text, p_bulan int, p_tahun int, p_nominal numeric,
  p_tanggal_bayar date, p_keterangan text, p_dicatat_oleh text
) returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
  v_tz text := app_config()->>'timezone';
  v_id text;
  v_is_insert boolean;
  v_nominal numeric := coalesce(p_nominal, (app_config()->>'iuran_nominal_default')::numeric);
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_siswa_id is null then
    raise exception 'Siswa wajib dipilih.';
  end if;
  if p_bulan is null or p_bulan < 1 or p_bulan > 12 then
    raise exception 'Bulan tidak valid.';
  end if;
  if p_tahun is null or p_tahun < 2000 then
    raise exception 'Tahun tidak valid.';
  end if;
  if v_nominal < 0 then
    raise exception 'Nominal tidak valid.';
  end if;
  if not exists (select 1 from siswa where id = p_siswa_id) then
    raise exception 'Data siswa tidak ditemukan.';
  end if;

  v_id := next_sequence_id('IUR-');

  insert into iuran (id, siswa_id, bulan, tahun, nominal, status, tanggal_bayar, keterangan, dicatat_oleh)
  values (v_id, p_siswa_id, p_bulan, p_tahun, v_nominal, 'Lunas',
          coalesce(p_tanggal_bayar, (now() at time zone v_tz)::date),
          coalesce(p_keterangan, ''), coalesce(p_dicatat_oleh, ''))
  on conflict (siswa_id, bulan, tahun) do update set
    nominal = excluded.nominal,
    status = 'Lunas',
    tanggal_bayar = excluded.tanggal_bayar,
    keterangan = excluded.keterangan,
    dicatat_oleh = excluded.dicatat_oleh
  returning (xmax = 0) into v_is_insert;

  if v_is_insert then
    return jsonb_build_object('id', v_id);
  else
    return jsonb_build_object('updated', true);
  end if;
end;
$$;

create or replace function rpc_batalkan_iuran(p_siswa_id text, p_bulan int, p_tahun int)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_siswa_id is null or p_bulan is null or p_tahun is null then
    raise exception 'Data tidak lengkap.';
  end if;

  delete from iuran where siswa_id = p_siswa_id and bulan = p_bulan and tahun = p_tahun;
  if not found then
    raise exception 'Belum ada catatan pembayaran untuk bulan ini.';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function rpc_update_iuran(p_id text, p_nominal numeric, p_tanggal_bayar date, p_keterangan text)
returns jsonb language plpgsql as $$
declare
  v_lock constant bigint := hashtext('bsa_mutating_lock');
begin
  perform pg_advisory_xact_lock(v_lock);

  if p_id is null then
    raise exception 'ID pembayaran tidak ditemukan.';
  end if;
  if p_nominal is not null and p_nominal < 0 then
    raise exception 'Nominal tidak valid.';
  end if;

  update iuran set
    nominal = coalesce(p_nominal, nominal),
    tanggal_bayar = coalesce(p_tanggal_bayar, tanggal_bayar),
    keterangan = coalesce(p_keterangan, keterangan)
  where id = p_id;

  if not found then
    raise exception 'Data pembayaran tidak ditemukan.';
  end if;

  return jsonb_build_object('id', p_id);
end;
$$;

create or replace function rpc_get_riwayat_iuran_siswa(p_siswa_id text)
returns jsonb language plpgsql as $$
declare
  v_rows jsonb;
begin
  if p_siswa_id is null then
    raise exception 'ID siswa wajib diisi.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'bulan', i.bulan, 'tahun', i.tahun, 'namaBulan', bulan_nama(i.bulan),
           'nominal', i.nominal, 'status', i.status,
           'tanggalBayar', case when i.tanggal_bayar is not null then to_char(i.tanggal_bayar, 'YYYY-MM-DD') else '' end,
           'keterangan', coalesce(i.keterangan, '')
         ) order by i.tahun desc, i.bulan desc), '[]'::jsonb)
    into v_rows
    from iuran i where i.siswa_id = p_siswa_id;

  return jsonb_build_object('rows', v_rows);
end;
$$;

-- =============================================================================
-- RIWAYAT PRESENSI & DASHBOARD — setara actionGetPresensiList / actionGetDashboardStats
-- =============================================================================
-- Overload lama (5 param) dari schema versi sebelum pagination — drop supaya
-- tidak ada duplikat fungsi khi re-run (Supabase/Postgres autoload).
drop function if exists rpc_get_presensi_list(date, date, date, text, text);

create or replace function rpc_get_presensi_list(
  p_tanggal date default null, p_dari date default null, p_sampai date default null,
  p_kelompok text default null, p_status text default null,
  p_limit int default null, p_offset int default null
) returns jsonb language plpgsql as $$
declare
  v_rows jsonb;
  v_total int;
  v_offset int := coalesce(p_offset, 0);
begin
  -- Filter didefinisikan SATU kali (CTE base), dipakai oleh count & pagination —
  -- tanpa pengulangan condition where.
  with base as (
    select id, nama, kelompok, waktu, status
      from presensi r
     where (p_tanggal is null or r.tanggal = p_tanggal)
       and (p_tanggal is not null or p_dari is null or r.tanggal >= p_dari)
       and (p_tanggal is not null or p_sampai is null or r.tanggal <= p_sampai)
       and (p_kelompok is null or p_kelompok = '' or r.kelompok = p_kelompok)
       and (p_status is null or p_status = '' or r.status = p_status)
  )
  select
      coalesce(jsonb_agg(b.item order by b.waktu desc), '[]'::jsonb),
      (select count(*) from base)
    into v_rows, v_total
    from (
      select jsonb_build_object('id', id, 'nama', nama, 'kelompok', kelompok, 'waktu', waktu, 'status', status) as item,
             waktu
        from base
       order by waktu desc
       limit ((case when p_limit is null then 1000000000 else p_limit end))
       offset v_offset
    ) b;

  -- p_limit null => ambil semua (untuk ekspor laporan), tanpa batas.
  return jsonb_build_object('rows', v_rows, 'total', v_total, 'limit', p_limit, 'offset', v_offset);
end;
$$;

create or replace function rpc_get_dashboard_stats()
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

  -- Agregat iuran bulan ini langsung di DB (count/sum), tanpa jsonb_agg
  -- seluruh baris siswa — sama basis dengan rpc_get_iuran_bulan (status Aktif).
  select count(*) filter (where i.status = 'Lunas'),
         coalesce(sum(i.nominal) filter (where i.status = 'Lunas'), 0)
    into v_iuran_lunas, v_iuran_terkumpul
    from siswa s
    left join iuran i on i.siswa_id = s.id and i.bulan = v_bulan and i.tahun = v_tahun
   where s.status = 'Aktif';

  return jsonb_build_object(
    'totalSiswaAktif', v_total_aktif,
    'hadirHariIni', v_hadir_hari_ini,
    'telatHariIni', v_telat_hari_ini,
    'belumPresensiHariIni', v_belum_hari_ini,
    'tren7Hari', v_tren,
    'riwayatHariIni', v_riwayat,
    'iuranBulanIni', jsonb_build_object(
      'bulan', v_bulan, 'tahun', v_tahun,
      'namaBulan', bulan_nama(v_bulan),
      'lunas', v_iuran_lunas,
      'belum', greatest(0, v_total_aktif - v_iuran_lunas),
      'totalTerkumpul', v_iuran_terkumpul
    )
  );
end;
$$;

-- =============================================================================
-- HAK AKSES FUNGSI: hanya service_role (dipakai Edge Function) yang boleh
-- memanggil fungsi apa pun di sini — termasuk helper internal seperti
-- app_config()/hash_password(), karena app_config() memuat PASSWORD_PEPPER.
-- Supabase secara default memberi EXECUTE ke anon & authenticated untuk
-- setiap fungsi baru, jadi harus dicabut eksplisit satu per satu di sini.
-- Catatan: blok ini menyapu SEMUA fungsi di schema public, jadi jalankan
-- file ini di project Supabase yang baru/khusus untuk aplikasi ini.
-- =============================================================================
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      -- Jangan sentuh fungsi bawaan extension (pgcrypto dkk), hanya fungsi
      -- aplikasi kita sendiri yang didefinisikan di atas.
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated;', f.sig);
    execute format('grant execute on function %s to service_role;', f.sig);
  end loop;
end;
$$;
