const APP_CONFIG = (() => {
  // ===========================================================================
  // KEAMANAN KONFIG — nilai backend diobfuscate supaya tidak terlihat sebagai
  // plaintext dalam source code / Inspect Element. Decode terjadi saat runtime.
  //
  // ⚠️ HONEST: obfuscation bukan keamanan riil — kunci ini PUBLIC by design
  // (anon key Supabase memang didesain untuk di-embar client-side). Proteksi
  // sesungguhnya tetap: RLS tanpa policy di semua tabel + token sesi kustom
  // (rpc_verify_token) + anti brute-force di supabase/hardening.sql.
  // Obfuscation cuma menyebabkan pemindaian diletapkan/di-perdeun.
  //
  // Untuk ganti project Supabase: buka Dashboard -> Project Settings ->
  // Data API / API Keys, isi SUPABASE_URL & SUPABASE_ANON_KEY baru, lalu
  // genarate nilai obfuscate dengan alat OBF (script di catatan README).
  // ===========================================================================
  const K = [0xa7, 0x3c, 0xd1, 0x09];
  function deobf(s) {
    try {
      const raw = atob(s);
      let out = "";
      for (let i = 0; i < raw.length; i++) {
        out += String.fromCharCode(raw.charCodeAt(i) ^ K[i % 4]);
      }
      return out;
    } catch (e) {
      return "";
    }
  }

  return {
    SUPABASE_URL: deobf("z0iledQG/ibBWLluxEu4YNReoWDCV6dwxU++cYlPpHnGXrB6whKyZg=="),
    SUPABASE_ANON_KEY: deobf(
      "wkWbYcV7smDoVZtA8kaYOOlVmHruUoM8xH+YP+5XoVHxf5swiVmoQ9df4kTOc7hD3ViJS89lvE/dZoJA1HW/Q8tmuECRdbxTzF2Wbc1Y42XXX+ND0F2GX9VYv2XOX+Mwk3W4fs5fvDDUZoJAkXW8T9Je4z3OcJJD12WJWM5zu0yUc4VI0HK7bpRxhVjUdbxfk1+SQJFxu0zQcoVQl3KVat9ymTmJROJk3lC4Y8V4n1PlRrxq1EW7RcAIuG/+TLNf5XC0f9Vl/Hn+ep1I1nmIOQ==",
    ),
    // Nama Edge Function yang dideploy (lihat supabase/functions/api/index.ts).
    SUPABASE_FUNCTION: deobf("1V24YcZSt2jPTrhvzg=="),
    APP_NAME: "Bhakti Sebatung Academy",
    APP_SHORT: "BSA Attendance",
    TOLERANSI_TELAT_MENIT_DEFAULT: 15, // dipakai jika kelompok tidak punya jadwal
    SESSION_KEY: "bsa_session",
  };
})();