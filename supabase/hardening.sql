-- =============================================================================
-- HARDENING KEAMANAN — delta di atas schema.sql. Tidak mengubah aturan bisnis,
-- hanya lapisan anti brute-force + hashing password & token sesi. Idempotent.
-- URUTAN WAJIB: schema.sql → hardening.sql → backdate_presensi.sql
-- (re-run schema.sql mengreset rpc_ → re-run hardening + backdate).
-- Isi: config ip_max_login_attempts · login_attempts_ip (anti brute per-IP) ·
-- token sesi SHA-256 · bcrypt password + auto-upgrade hash lama · rpc_login v2
-- (lockout per-IP + delay jitter) · rpc_verify_token v2 · revoke akses.
-- =============================================================================

-- =============================================================================
-- 1) KONFIGURASI — key lama + key hardening baru (defaults)
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
    'toleransi_default_menit', 15,
    'password_pepper', 'bsa-2026-kotabaru',   -- tetap dipakai untuk verify hash SHA-256 lama
    'barcode_prefix', 'BSA-',
    'iuran_nominal_default', 50000,
    'timezone', 'Asia/Jakarta'
  );
$$;

-- =============================================================================
-- 2) ANTI BRUTE-FORCE LAYER 2: per-IP (layer 1 = username, sudah ada)
-- =============================================================================
create table if not exists login_attempts_ip (
  ip            text primary key,
  count         int not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);

alter table login_attempts_ip enable row level security;
revoke all on table login_attempts_ip from anon, authenticated;

create or replace function register_failed_login_ip(p_ip text, p_max_attempts int, p_window interval)
returns void language plpgsql as $$
declare
  v_row login_attempts_ip%rowtype;
begin
  select * into v_row from login_attempts_ip where ip = p_ip;
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

  insert into login_attempts_ip (ip, count, window_start, locked_until)
  values (p_ip, v_row.count, v_row.window_start, v_row.locked_until)
  on conflict (ip) do update
    set count = excluded.count,
        window_start = excluded.window_start,
        locked_until = excluded.locked_until;
end;
$$;

-- =============================================================================
-- 3) SESSIONS -> token disimpan sebagai SHA-256 (tidak ada plaintext at rest).
-- Migrasi: rename tabel lama -> create baru (token_hash PK) -> backfill hash.
-- =============================================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'sessions'
                   and column_name = 'token_hash') then
    alter table sessions rename to sessions_old;

    create table sessions (
      token_hash text primary key,
      username   text not null,
      nama       text not null,
      role       text not null,
      exp        timestamptz not null
    );

    insert into sessions (token_hash, username, nama, role, exp)
    select encode(digest(token, 'sha256'), 'hex'), username, nama, role, exp
      from sessions_old;

    drop table sessions_old;

    drop index if exists idx_sessions_exp;
    create index if not exists idx_sessions_exp on sessions (exp);
    alter table sessions enable row level security;
    revoke all on table sessions from anon, authenticated;
  end if;
end;
$$;

-- =============================================================================
-- 4) PASSWORD: bcrypt untuk hash baru; verify_password tetap membaca hash
--    SHA-256 peppered lama (barangis dari schema.sql) supaya login lama
--    tetap jalan, lalu auto-upgrade ke bcrypt saat login sukses.
-- =============================================================================
create or replace function hash_password(p_password text)
returns text language sql stable as $$
  select crypt(p_password, gen_salt('bf', 11));
$$;

create or replace function verify_password(p_password text, p_hash text)
returns boolean language sql immutable as $$
  select p_hash is not null and p_hash <> '' and
         case when left(p_hash, 2) = '$2' then p_hash = crypt(p_password, p_hash)
              else encode(digest(p_password || ':' || (app_config()->>'password_pepper'), 'sha256'), 'hex') = p_hash
         end;
$$;

-- =============================================================================
-- 5) RPC LOGIN v2 — sama kontrak { ok, data }/response, param p_ip opsional.
--    Tambahan vs lama: lockout per-IP, delay jitter khi gagal (sloka brute
--    force), verify bcrypt + fallback SHA-256, upgrade hash saat sukses.
-- =============================================================================
create or replace function rpc_login(p_username text, p_password text, p_ip text default null)
returns jsonb language plpgsql as $$
declare
  v_username text := trim(coalesce(p_username, ''));
  v_password text := coalesce(p_password, '');
  v_key      text := lower(v_username);
  v_ip       text := lower(trim(coalesce(p_ip, '')));
  v_cfg      jsonb := app_config();
  v_max_attempts    int := (v_cfg->>'max_login_attempts')::int;
  v_lockout_minutes int := (v_cfg->>'login_lockout_minutes')::int;
  v_ip_max          int := coalesce((v_cfg->>'ip_max_login_attempts')::int, 10);
  v_ip_lockout      int := coalesce((v_cfg->>'ip_lockout_minutes')::int, 15);
  v_session_hours   int := (v_cfg->>'session_hours')::int;
  v_min_delay_ms    numeric := coalesce((v_cfg->>'login_min_delay_ms')::numeric, 350);
  v_max_delay_ms    numeric := coalesce((v_cfg->>'login_max_delay_ms')::numeric, 1200);
  v_window     interval := (v_lockout_minutes || ' minutes')::interval;
  v_ip_window  interval := (v_ip_lockout || ' minutes')::interval;
  v_attempt    login_attempts%rowtype;
  v_ip_attempt login_attempts_ip%rowtype;
  v_admin      admin%rowtype;
  v_token      text;
begin
  if v_username = '' or v_password = '' then
    raise exception 'Username dan password wajib diisi.';
  end if;

  -- Lockout per-IP (cek pertama supaya password tidak di-hash walau diblokir)
  if v_ip <> '' then
    select * into v_ip_attempt from login_attempts_ip where ip = v_ip;
    if found and v_ip_attempt.locked_until is not null and v_ip_attempt.locked_until > now() then
      raise exception 'Terlalu banyak percobaan dari IP ini. Coba lagi dalam % menit.',
        ceil(extract(epoch from (v_ip_attempt.locked_until - now())) / 60);
    end if;
  end if;

  -- Lockout per-username (diaman dari schema.sql)
  select * into v_attempt from login_attempts where username_key = v_key;
  if found and v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    raise exception 'Terlalu banyak percobaan gagal. Coba lagi dalam % menit.',
      ceil(extract(epoch from (v_attempt.locked_until - now())) / 60);
  end if;

  select * into v_admin from admin where lower(username) = v_key;

  if not found then
    perform register_failed_login(v_key, v_max_attempts, v_window);
    if v_ip <> '' then
      perform register_failed_login_ip(v_ip, v_ip_max, v_ip_window);
    end if;
    perform pg_sleep(((v_min_delay_ms + floor(random() * (v_max_delay_ms - v_min_delay_ms + 1))))::float8 / 1000.0);
    raise exception 'Username atau password salah.';
  end if;
  if v_admin.status <> 'Aktif' then
    raise exception 'Akun ini tidak aktif. Hubungi pengurus utama.';
  end if;

  if not verify_password(v_password, v_admin.password_hash) then
    perform register_failed_login(v_key, v_max_attempts, v_window);
    if v_ip <> '' then
      perform register_failed_login_ip(v_ip, v_ip_max, v_ip_window);
    end if;
    perform pg_sleep(((v_min_delay_ms + floor(random() * (v_max_delay_ms - v_min_delay_ms + 1))))::float8 / 1000.0);
    raise exception 'Username atau password salah.';
  end if;

  -- Sukses: buang lockout, upgrade hash SHA-256 lama -> bcrypt.
  delete from login_attempts where username_key = v_key;
  if v_ip <> '' then
    delete from login_attempts_ip where ip = v_ip;
  end if;
  if v_admin.password_hash not like '$2%' then
    update admin set password_hash = hash_password(v_password) where username = v_admin.username;
  end if;

  delete from sessions where exp < now();

  v_token := gen_random_uuid()::text;
  insert into sessions (token_hash, username, nama, role, exp)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_admin.username, v_admin.nama, v_admin.role,
          now() + (v_session_hours || ' hours')::interval);

  return jsonb_build_object('token', v_token, 'username', v_admin.username, 'nama', v_admin.nama, 'role', v_admin.role);
end;
$$;

-- =============================================================================
-- 6) RPC VERIFY TOKEN v2 — lookup lewat token_hash (sha256 dari token)
-- =============================================================================
create or replace function rpc_verify_token(p_token text)
returns jsonb language plpgsql as $$
declare
  v_session sessions%rowtype;
begin
  if p_token is null or p_token = '' then
    return null;
  end if;
  select * into v_session from sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found or v_session.exp < now() then
    return null;
  end if;
  return jsonb_build_object('username', v_session.username, 'nama', v_session.nama, 'role', v_session.role);
end;
$$;

-- =============================================================================
-- 6b) RPC LOGOUT — hapus sesi berdasarkan token
-- =============================================================================
create or replace function rpc_logout(p_token text)
returns boolean language plpgsql as $$
begin
  if p_token is null or p_token = '' then
    return false;
  end if;
  delete from sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  return found;
end;
$$;

-- =============================================================================
-- 7) HAK AKSES: revoke anon/authenticated, hanya service_role yang boleh
--    panggil fungsi aplikasi (ikut pola schema.sql).
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