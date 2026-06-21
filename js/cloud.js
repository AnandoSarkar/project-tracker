// cloud.js — Supabase client + auth helpers.
//
// Loaded as an ES module (it imports the Supabase SDK from a CDN), then exposes a
// small API on `window.Cloud` so the global app script can use it without being a
// module itself — the same bridge pattern as store.js.
//
// Phase 3 scope: initialise the client and expose session/auth helpers. No data
// reads/writes yet (that's Phase 5), no auth UI yet (Phase 4).
//
// SDK pinned to a specific version for reproducibility (no build step / npm).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cfg = window.SUPABASE_CONFIG;

// Guard: if config is missing, fail loudly in the console but don't crash the app —
// the logged-out localStorage experience must keep working regardless.
let client = null;
if (cfg && cfg.url && cfg.publishableKey) {
  client = createClient(cfg.url, cfg.publishableKey);
} else {
  console.warn("Supabase config missing — cloud features disabled, running local-only.");
}

// --- Auth helpers (thin wrappers over the SDK) ---

// Current session (or null). Resolves once the SDK has restored any stored session.
async function getSession() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session || null;
}

// Current user (or null) — convenience for "am I logged in?".
async function getUser() {
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user || null;
}

// Subscribe to auth state changes (login/logout). Returns an unsubscribe fn.
function onAuthChange(cb) {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// --- Auth actions. Each returns { error } (null on success) so the UI can show a
// friendly message. Thin wrappers; the SDK persists the session itself. ---

async function signUp(email, password) {
  if (!client) return { error: "Cloud not configured." };
  const { error } = await client.auth.signUp({ email, password });
  return { error: error ? error.message : null };
}

async function signIn(email, password) {
  if (!client) return { error: "Cloud not configured." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  return { error: error ? error.message : null };
}

async function signOut() {
  if (!client) return { error: "Cloud not configured." };
  const { error } = await client.auth.signOut();
  return { error: error ? error.message : null };
}

window.Cloud = {
  get client() { return client; },   // raw client for later phases (queries)
  isConfigured: !!client,
  getSession,
  getUser,
  onAuthChange,
  signUp,
  signIn,
  signOut,
};

// Signal readiness so the app can react once the module has loaded (it's deferred).
window.dispatchEvent(new Event("cloud-ready"));
