const APP_CONFIG = {
  // ⚠️ Isi 2 baris ini dengan punya project Supabase kamu sendiri:
  // Dashboard -> Project Settings -> Data API / API Keys.
  // SUPABASE_URL = base URL project (TANPA /functions/v1/...).
  SUPABASE_URL: "https://fdhgcwiisbpiekvybsox.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkaGdjd2lpc2JwaWVrdnlic294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjg3MTQsImV4cCI6MjEwNTY0NDcxNH0.x3mylijbDNZBzmcsyjLg4ifYpbVBLevrY-pYFLAqEY0",
  // Nama Edge Function yang dideploy (lihat supabase/functions/api/index.ts).
  SUPABASE_FUNCTION: "raihanfahrifi",
  APP_NAME: "Bhakti Sebatung Academy",
  APP_SHORT: "BSA Attendance",
  TOLERANSI_TELAT_MENIT_DEFAULT: 15, // dipakai jika kelompok tidak punya jadwal
  SESSION_KEY: "bsa_session",
};
