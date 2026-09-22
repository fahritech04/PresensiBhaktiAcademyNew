// =============================================================================
// Bhakti Sebatung Academy — Edge Function "api"
// Pengganti Google Apps Script Web App (assets/code.gs -> doPost/doGet).
//
// TIDAK ADA logic bisnis di sini. File ini hanya:
//   1. Baca { action, token, payload } dari request (sama seperti body Apps
//      Script lama).
//   2. Kalau action bukan "login", verifikasi token lewat rpc_verify_token.
//   3. Panggil fungsi Postgres rpc_xxx yang sesuai (lihat supabase/schema.sql
//      untuk logic aslinya — 1:1 dengan actionXxx() di code.gs lama).
//   4. Bungkus hasil jadi { ok:true, data } atau { ok:false, message, code }
//      — PERSIS format response yang sudah dipakai assets/js/core/api.js,
//      jadi TIDAK ADA file frontend lain yang perlu diubah.
//
// Deploy:
//   supabase functions deploy api --no-verify-jwt
// ("--no-verify-jwt" karena autentikasi dipegang sendiri lewat tabel
//  `sessions` + token kustom, bukan lewat sistem Auth bawaan Supabase —
//  sama seperti dulu Web App Apps Script di-set "Who has access: Anyone").
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Sama seperti Apps Script lama yang di-deploy "Who has access: Anyone",
// endpoint ini memang publik (proteksi ada di layer token/sesi kustom,
// bukan di CORS). Ganti "*" dengan domain kamu kalau mau dipersempit.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PUBLIC_ACTIONS = new Set(["login"]);

function jsonSuccess(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, code = "ERROR") {
  return new Response(JSON.stringify({ ok: false, message, code }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Panggil 1 fungsi Postgres (rpc_xxx) dan lempar Error kalau gagal. */
async function call(fn: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message || "Terjadi kesalahan pada server.");
  return data;
}

// Nilai "kosong" (undefined/""); dipetakan ke null supaya cocok dengan
// parameter opsional di fungsi Postgres (yang pakai COALESCE utk default).
function orNull(v: unknown) {
  return v === undefined || v === "" ? null : v;
}

type Handler = (payload: any, session: any) => Promise<unknown>;

// Peta action -> fungsi Postgres. Nama action & bentuk payload SAMA PERSIS
// dengan yang sudah dipanggil oleh assets/js/pages/*.js — tidak berubah.
const ACTIONS: Record<string, Handler> = {
  login: (p) => call("rpc_login", { p_username: p.username, p_password: p.password }),

  getDashboardStats: () => call("rpc_get_dashboard_stats", {}),

  getSiswaList: () => call("rpc_get_siswa_list", {}),

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

  scanPresensi: (p) => call("rpc_scan_presensi", { p_barcode: p.barcode }),

  getPresensiList: (p) =>
    call("rpc_get_presensi_list", {
      p_tanggal: orNull(p.tanggal),
      p_dari: orNull(p.dari),
      p_sampai: orNull(p.sampai),
      p_kelompok: orNull(p.kelompok),
      p_status: orNull(p.status),
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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);

  // Setara doGet(e) tanpa e.parameter.action di code.gs lama: cek cepat
  // lewat browser bahwa fungsi ini aktif.
  if (req.method === "GET" && !url.searchParams.get("action")) {
    return new Response(
      JSON.stringify({ ok: true, message: "Bhakti Sebatung Academy API is running." }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  try {
    let action = "";
    let payload: Record<string, unknown> = {};
    let token: string | null = null;

    if (req.method === "GET") {
      action = url.searchParams.get("action") || "";
      payload = JSON.parse(url.searchParams.get("payload") || "{}");
      token = url.searchParams.get("token");
    } else {
      const body = await req.json().catch(() => ({}) as any);
      action = body.action;
      payload = body.payload || {};
      token = body.token || null;
    }

    const handler = ACTIONS[action];
    if (!handler) return jsonError("Aksi tidak dikenali: " + action);

    let session: any = null;
    if (!PUBLIC_ACTIONS.has(action)) {
      session = await call("rpc_verify_token", { p_token: token });
      if (!session) return jsonError("Sesi berakhir, silakan login kembali.", "AUTH_EXPIRED");
    }

    const result = await handler(payload, session);
    return jsonSuccess(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.");
  }
});
