// Dream Team Dex online accounts (Supabase). Fill these in to turn on sign-in, cloud saves and friends;
// leave them empty and the app works exactly as before (saves stay in this browser).
// Both values are meant to be public: the anon key only allows what the row-level-security rules in
// supabase/migrations/ allow. NEVER put the service_role key here. See docs/supabase-setup.md.
window.DTD_CONFIG = {
  supabaseUrl: "https://cajoxjlojvwoqxukneoi.supabase.co",       // e.g. "https://abcdefghijklmnop.supabase.co"
  supabaseAnonKey: "sb_publishable_nz7yBjht1TS-u0ApN5MBeQ_Qe7DHVn8"    // Project Settings → API → Project API keys → "anon public"
};
