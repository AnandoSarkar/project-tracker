// config.js — public Supabase connection details.
//
// These two values are SAFE to ship in client code and commit to git:
//   - the project URL is public;
//   - the publishable key is designed to be exposed in browsers.
// Security is enforced by Row-Level Security in the database (each user can only
// read/write their own rows), NOT by hiding this key. The service-role key is the
// secret one and must NEVER appear here or anywhere in the client.

window.SUPABASE_CONFIG = {
  url: "https://mnpvmflvwzfrtrumddfa.supabase.co",
  publishableKey: "sb_publishable_s_GfKhh2LiHkeVQA-njw7g_zjLy0QR3",
};
