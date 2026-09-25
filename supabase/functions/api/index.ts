// =============================================================================
// Bhakti Sebatung Academy — Edge Function "api" (versi HARDENED)
//
// Pengganti Google Apps Script Web App (assets/code.gs -> doPost/doGet).
//
// TIDAK ADA logic bisnis di sini. File ini hanya:
//   1. Baca { action, token, payload } dari request (POST saja).
//   2. Origin allowlist (ALLOWED_ORIGIN) — blok request dari domain lain.
//   3. Cek token sesi lewat rpc_verify_token (kalau action bukan "login").
//   4. Panggil fungsi Postgres rpc_xxx yang sesuai (lihat supabase/schema.sql).
//   5. Bungkus hasil jadi { ok:true, data } / { ok:false, message, code } —
//      PERSIS dengan kontrak lama, jadi file frontend tidak berubah.
//
// Hardening vs versi lama:
//   - CORS kini diatur ke ALLOWED_ORIGIN (bukan "*").
//   - Fingerprint GET ("API is running") diperha.
//   - GET untuk action diperha (token tidak pernah masuk URL query string).
//   - Login: IP client (x-forwarded-for) dipasar ke rpc_login (anti
//     brute-force per-IP layer 2 di database) + limiter memory kasar.
//   - Header keamanan: Cache-Control no-store, X-Content-Type-Options.
//   - Aksi tidak dikenali -> pesan generik (tidak refleks input).
//
// Deploy:
//   supabase secrets set ALLOWED_ORIGIN=https://bhaktisebatung.web.id
//   supabase functions deploy api --no-verify-jwt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Domain GitHub Pages / custom domain. Bisa CSV multi-domain:
//   ALLOWED_ORIGIN=https://bhaktisebatung.web.id,https://user.github.io
function allowedOrigins(): string[] {
  const raw = (Deno.env.get("ALLOWED_ORIGIN") || "https://bhaktisebatung.web.id");
  // Tolerant separator: comma O sis space (mis. user jenis type).
  return raw.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => s !== "");
}

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  if (!origin) return true; // bukan browser (curl/alat): proteksi lewat token
  const o = origin.toLowerCase();
  return allowedOrigins().some((a) => o === a || (a.startsWith("https://") && o === a));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allow = origin && isAllowedOrigin(req) ? origin : allowedOrigins()[0] || "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

/** IP client dari header x-forwarded-for (seto oleh gateway Supabase). */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return "";
}

const PUBLIC_ACTIONS = new Set(["login", "getDashboardStats", "getSiswaList"]);

// Burst limiter memory (per-instance, best-effort — layer final di database).
const LOGIN_LIMIT = { max: 30, windowMs: 60_000 };
const loginHits = new Map<string, number[]>();
function allowLoginBurst(ip: string): boolean {
  const now = Date.now();
  const arr = (loginHits.get(ip) || []).filter((t) => now - t < LOGIN_LIMIT.windowMs);
  if (arr.length >= LOGIN_LIMIT.max) {
    loginHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  loginHits.set(ip, arr);
  return true;
}

function jsonSuccess(req: Request, data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function jsonError(req: Request, message: string, code = "ERROR") {
  return new Response(JSON.stringify({ ok: false, message, code }), {
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Panggil 1 fungsi Postgres (rpc_xxx) dan lempar Error kalau gagal. */
async function call(fn: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message || "Terjadi kesalahan pada server.");
  return data;
}

// Nilai "kosong" (undefined/""); dipetakan ke null supaya cocok dengan
// parameter opsional di fungsi Postgres (COALESCE utk default).
function orNull(v: unknown) {
  return v === undefined || v === "" ? null : v;
}

type Handler = (payload: any, session: any) => Promise<unknown>;

// Peta action -> fungsi Postgres. Nama action & bentuk payload SAMA PERSIS
// dengan yang sudah dipanggil oleh assets/js/pages/*.js — tidak berubah.
const ACTIONS: Record<string, Handler> = {
  login: (p) => call("rpc_login", { p_username: p.username, p_password: p.password, p_ip: CURRENT_IP }),

  getDashboardStats: (_p, session) => call("rpc_get_dashboard_stats", { p_public: !session }),

  getSiswaList: (_p, session) => call("rpc_get_siswa_list", { p_public: !session }),

  addSiswa: (p) =>
    call("rpc_add_siswa", {
      p_nama: p.nama,
      p_kelompok: p.kelompok,
      p_tanggal_lahir: orNull(p.tanggalLahir),
      p_nama_ortu: p.namaOrtu,
      p_hp_ortu: p.hpOrtu,
      p_status: p.status,
      p_jenis_kelamin: p.jenisKelamin || "Putra",
    }),

  updateSiswa: (p) =>
    call("rpc_update_siswa", {
      p_id: p.id,
      p_nama: p.nama,
      p_kelompok: p.kelompok,
      p_tanggal_lahir: orNull(p.tanggalLahir),
      p_nama_ortu: p.namaOrtu,
      p_hp_ortu: p.hpOrtu,
      p_status: p.status,
      p_jenis_kelamin: p.jenisKelamin || "Putra",
    }),

  deleteSiswa: (p) => call("rpc_delete_siswa", { p_id: p.id }),

  getKelompokList: () => call("rpc_get_kelompok_list", {}),

  scanPresensi: (p) => call("rpc_scan_presensi", { p_barcode: p.barcode, p_tanggal: orNull(p.tanggal) }),

  getPresensiList: (p) =>
    call("rpc_get_presensi_list", {
      p_tanggal: orNull(p.tanggal),
      p_dari: orNull(p.dari),
      p_sampai: orNull(p.sampai),
      p_kelompok: orNull(p.kelompok),
      p_status: orNull(p.status),
      p_limit: orNull(p.limit),
      p_offset: orNull(p.offset),
    }),

  getIuranBulan: (p) =>
    call("rpc_get_iuran_bulan", {
      p_bulan: orNull(p.bulan),
      p_tahun: orNull(p.tahun),
      p_kelompok: orNull(p.kelompok),
    }),

  tandaiIuran: (p, session) =>
    call("rpc_tandai_iuran", {
      p_siswa_id: p.siswaId,
      p_bulan: p.bulan,
      p_tahun: p.tahun,
      p_nominal: orNull(p.nominal),
      p_tanggal_bayar: orNull(p.tanggalBayar),
      p_keterangan: p.keterangan,
      p_dicatat_oleh: (session && session.nama) || "",
    }),

  batalkanIuran: (p) =>
    call("rpc_batalkan_iuran", { p_siswa_id: p.siswaId, p_bulan: p.bulan, p_tahun: p.tahun }),

  // Catatan: p_tanggal_bayar sengaja pakai orNull (string kosong -> null ->
  // TIDAK diupdate), tapi p_keterangan TIDAK di-orNull supaya string kosong
  // ("") tetap tersimpan sebagai "sengaja dikosongkan" — sama seperti logic
  // actionUpdateIuran yang lama (updates hanya di-skip kalau field-nya
  // benar-benar tidak dikirim, bukan kalau dikirim kosong).
  updateIuran: (p) =>
    call("rpc_update_iuran", {
      p_id: p.id,
      p_nominal: orNull(p.nominal),
      p_tanggal_bayar: orNull(p.tanggalBayar),
      p_keterangan: p.keterangan,
    }),

  getRiwayatIuranSiswa: (p) => call("rpc_get_riwayat_iuran_siswa", { p_siswa_id: p.siswaId }),

  getPelatihList: () => call("rpc_get_pelatih_list", {}),

  addPelatih: (p) => call("rpc_add_pelatih", { p_nama: p.nama, p_status: p.status }),

  updatePelatih: (p) => call("rpc_update_pelatih", { p_barcode: p.barcode, p_nama: p.nama, p_status: p.status }),

  deletePelatih: (p) => call("rpc_delete_pelatih", { p_barcode: p.barcode }),

  scanPresensiPelatih: (p) => call("rpc_scan_presensi_pelatih", { p_barcode: p.barcode }),

  getPresensiPelatihList: (p) =>
    call("rpc_get_presensi_pelatih_list", {
      p_dari: orNull(p.dari),
      p_sampai: orNull(p.sampai),
      p_status: orNull(p.status),
      p_limit: orNull(p.limit),
      p_offset: orNull(p.offset),
    }),

  getPresensiPelatihRekap: (p) =>
    call("rpc_get_presensi_pelatih_rekap", {
      p_dari: orNull(p.dari),
      p_sampai: orNull(p.sampai),
      p_status: orNull(p.status),
    }),
};

// IP request berjalan (per-isolate request berproses sequential, aman).
let CURRENT_IP = "";

Deno.serve(async (req) => {
  if (!isAllowedOrigin(req)) {
    return jsonError(req, "Kesalahan: origin tidak diizinkan.", "FORBIDDEN");
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonError(req, "Method tidak diizinkan.", "METHOD_NOT_ALLOWED");
  }

  CURRENT_IP = clientIp(req);

  try {
    const body = await req.json().catch(() => ({} as any));
    const action = body.action;
    const payload = body.payload || {};
    const token = body.token || null;

    if (typeof action !== "string" || action === "") {
      return jsonError(req, "Aksi tidak dikenali.", "UNKNOWN_ACTION");
    }

    const handler = ACTIONS[action];
    if (!handler) return jsonError(req, "Aksi tidak dikenali.", "UNKNOWN_ACTION");

    // Verifikasi token bila ada (supaya admin yang login tetap dapat data penuh),
    // tapi hanya wajib untuk aksi non-publik.
    let session: any = null;
    if (token) {
      session = await call("rpc_verify_token", { p_token: token });
    }
    if (!PUBLIC_ACTIONS.has(action) && !session) {
      return jsonError(req, "Sesi berakhir, silakan login kembali.", "AUTH_EXPIRED");
    }

    if (action === "login" && !allowLoginBurst(CURRENT_IP || "unknown")) {
      return jsonError(req, "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.", "RATE_LIMITED");
    }

    const result = await handler(payload, session);
    return jsonSuccess(req, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Error tidak dari rpc aplikasi (mis. JSON tidak valid) -> pesan generik.
    if (!message) return jsonError(req, "Terjadi kesalahan tak terduga.", "BAD_REQUEST");
    return jsonError(req, message);
  }
});