const APP_CONFIG = (() => {
  // ===========================================================================
  // KEAMANAN KONFIG — nilai backend diobfuscate (decoded saat runtime).
  //
  // ⚠️ HONEST: obfuscation bukan keamanan riil — kunci anon public by design.
  // Proteksi sesungguhnya: RLS tanpa policy + token sesi + anti brute-force.
  // Ganti project: Dashboard → Project Settings → Data API, lalu obfuscate
  // nilai baru (script di README).
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
    SUPABASE_URL: deobf("z0iledQG/ibRUb15w0anZNVZp3rVX7xvzkWib4lPpHnGXrB6whKyZg=="),
    SUPABASE_ANON_KEY: deobf(
      "wkWbYcV7smDoVZtA8kaYOOlVmHruUoM8xH+YP+5XoVHxf5swiVmoQ9df4kTOc7hD3ViJS89lvE/dZoJA1HW/Q8tmuECRdb9T016ZS8xZv1PTX7xflV/iQ81ehlPXWYlHynW4fs5fvDDUZoJAkXW8T9Je4z3OcJJD12WJWM5zu0yUc4VI33OVTJNzlVzUdbxfk1+SQJFxu0zQcoVqlnKrbpNyiTmJBbNkkw2YapZ9sE7PRIFG9kmVYMFu4GjhY7tB/WilZspLu3nuDOZE8Xm5Zg==",
    ),
    // Nama Edge Function (deploy: `supabase functions deploy api`).
    SUPABASE_FUNCTION: deobf("xky4"),

    // ===========================================================================
    // BACKEND MONITORING & EVALUASI — terpisah dari Supabase (Google Apps Script).
    // GAS_URL : URL deployment Web App (https://script.google.com/macros/s/.../exec)
    // GAS_KEY : kunci rahasia = Script Property APP_KEY di Apps Script (gerbang
    //           sederhana, bukan pengganti auth Supabase).
    // Setup: README.md "Backend Monitoring & Evaluasi".
    // ===========================================================================
    GAS_URL: "https://script.google.com/macros/s/AKfycbwXjqercjkE3qv194JpVSv4FbwZNpaQ4tXZgzLZ8LLha9-c4GbyJsn4Zmi2P2q4tQJ0YA/exec",
    GAS_KEY: "9LGSz74meJHXxnaCTygjAtPRYfDKZsiQ",

    APP_NAME: "Bhakti Sebatung Academy",
    APP_SHORT: "BSA Attendance",
    TOLERANSI_TELAT_MENIT_DEFAULT: 15, // dipakai jika kelompok tidak punya jadwal
    SESSION_KEY: "bsa_session",
  };
})();