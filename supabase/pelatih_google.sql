-- =============================================================================
-- FEATURE: LOGIN PELATIH VIA GOOGLE (Supabase Auth) — delta, idempotent.
-- Hybrid: admin tetap username+password, pelatih lewat Google. ADITIF (tanpa
-- DROP/DELETE data lama).
-- Isi: config ip_max_login_attempts=30 · kolom auth_uid & email di pelatih ·
-- rpc_login_google() (find-or-create pelatih + session role Pelatih) · revoke.
-- URUTAN: ... → pelatih.sql → pelatih_google.sql.
-- =============================================================================

-- =============================================================================
-- 1) KONFIGURASI — merge seluruh key terkini + ip_max_login_attempts naik 10 -> 30
--    (gotcha: app_config() didefinisikan ulang di beberapa file delta; delta ini
--     harus berisi SELURUH key supaya re-run file lain tidak menghapus key baru).
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
    'ip_max_login_attempts', 30,
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
-- 2) TABEL PELATIH — tambah kolom identitas Google (ADITIF, tidak ubah data lama)
-- =============================================================================
alter table pelatih
  add column if not exists auth_uid text,
  add column if not exists email    text;

-- Partial unique: baris pelatih lama (auth_uid/email NULL) tidak konflik.
create unique index if not exists idx_pelatih_auth_uid
  on pelatih (auth_uid) where auth_uid is not null;
create unique index if not exists idx_pelatih_email_lower
  on pelatih (lower(email)) where email is not null;

-- =============================================================================
-- 3) RPC LOGIN GOOGLE — find-or-create pelatih + buat session role 'Pelatih'
--    (mirror rpc_login, tapi tanpa password: identitas dari Supabase Auth).
-- =============================================================================
create or replace function rpc_login_google(p_auth_uid text, p_email text, p_nama text)
returns jsonb language plpgsql as $$
declare
  v_lock          constant bigint := hashtext('bsa_mutating_lock');
  v_barcode       text;
  v_nama          text := trim(coalesce(p_nama, ''));
  v_email         text := lower(trim(coalesce(p_email, '')));
  v_username      text;
  v_session_hours int := (app_config()->>'session_hours')::int;
  v_token         text;
begin
  if p_auth_uid is null or trim(p_auth_uid) = '' then
    raise exception 'Identitas Google tidak valid.';
  end if;
  if v_nama = '' then
    v_nama := coalesce(nullif(v_email, ''), 'Pelatih');
  end if;

  perform pg_advisory_xact_lock(v_lock);

  select barcode into v_barcode from pelatih where auth_uid = p_auth_uid limit 1;

  if v_barcode is null then
    -- Login Google pertama: buat baris pelatih baru (barcode auto, nama dari Google).
    v_barcode := next_barcode_pelatih();
    insert into pelatih (barcode, nama, status, auth_uid, email)
    values (v_barcode, v_nama, 'Aktif', p_auth_uid, nullif(v_email, ''));
  else
    -- Login berikutnya: sinkronkan snapshot nama/email dari Google.
    update pelatih set
      nama  = v_nama,
      email = coalesce(nullif(v_email, ''), email)
    where barcode = v_barcode;
  end if;

  v_username := coalesce(nullif(v_email, ''), p_auth_uid);

  delete from sessions where exp < now();

  v_token := gen_random_uuid()::text;
  insert into sessions (token_hash, username, nama, role, exp)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_username, v_nama, 'Pelatih',
          now() + (v_session_hours || ' hours')::interval);

  return jsonb_build_object('token', v_token, 'username', v_username, 'nama', v_nama, 'role', 'Pelatih');
end;
$$;

-- =============================================================================
-- 4) HAK AKSES: revoke anon/authenticated, hanya service_role (ikut schema.sql).
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
