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

// --- Data layer (Phase 5) -------------------------------------------------
// The app keeps using its own string ids (uid()). In the DB those live in the
// `client_id` column and are the key we match on; the DB's uuid PK is internal.
// These mappers translate between app shape and DB columns.

function taskToRow(t, userId) {
  return {
    user_id: userId,
    client_id: t.id,
    title: t.title,
    start: t.start || null,         // "" -> null (DB date column)
    due: t.due || null,
    status: t.status,
    priority: t.priority,
    notes: t.notes || "",
    project_id: null,               // set via projectUuid map by the caller wrapper below
    subtasks: t.subtasks || [],
    created: new Date(t.created || Date.now()).toISOString(),
  };
}
function rowToTask(r) {
  return {
    id: r.client_id || r.id,
    title: r.title || "",
    start: r.start || "",
    due: r.due || "",
    status: r.status || "todo",
    priority: r.priority || "none",
    notes: r.notes || "",
    projectId: r._project_client_id || "",   // resolved from the join map
    subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
    created: r.created ? new Date(r.created).getTime() : Date.now(),
  };
}

// Read every collection for the signed-in user and return them in APP shape.
// projectId references are kept as the app's string ids (client_id) throughout,
// so nothing in the app has to learn about uuids.
async function fetchAll() {
  if (!client) return null;
  const [proj, task, mile] = await Promise.all([
    client.from("projects").select("*"),
    client.from("tasks").select("*"),
    client.from("milestones").select("*"),
  ]);
  if (proj.error || task.error || mile.error) {
    throw new Error((proj.error || task.error || mile.error).message);
  }
  // Build uuid -> client_id map so task/milestone project_id (a uuid) maps back
  // to the app's string projectId.
  const uuidToClient = {};
  proj.data.forEach(p => { uuidToClient[p.id] = p.client_id || p.id; });

  const projects = proj.data.map(p => ({
    id: p.client_id || p.id,
    name: p.name || "",
    created: p.created ? new Date(p.created).getTime() : Date.now(),
  }));
  const tasks = task.data.map(r => {
    r._project_client_id = r.project_id ? (uuidToClient[r.project_id] || "") : "";
    return rowToTask(r);
  });
  const milestones = mile.data.map(m => ({
    id: m.client_id || m.id,
    name: m.name || "",
    date: m.date || "",
    projectId: m.project_id ? (uuidToClient[m.project_id] || "") : "",
    dependsOn: Array.isArray(m.depends_on) ? m.depends_on : [],
    created: m.created ? new Date(m.created).getTime() : Date.now(),
  }));
  return { projects, tasks, milestones };
}

// Resolve an app projectId (string) to the DB uuid for the current user.
async function projectUuidFor(clientProjectId) {
  if (!clientProjectId) return null;
  const { data } = await client.from("projects").select("id").eq("client_id", clientProjectId).maybeSingle();
  return data ? data.id : null;
}

// Per-row upserts/deletes, matched on (user_id, client_id). Each returns {error}.
async function upsertTask(t, userId) {
  const row = taskToRow(t, userId);
  row.project_id = await projectUuidFor(t.projectId);
  const { error } = await client.from("tasks").upsert(row, { onConflict: "user_id,client_id" });
  return { error: error ? error.message : null };
}
async function deleteTaskRow(clientId, userId) {
  const { error } = await client.from("tasks").delete().eq("user_id", userId).eq("client_id", clientId);
  return { error: error ? error.message : null };
}
async function upsertProject(p, userId) {
  const row = { user_id: userId, client_id: p.id, name: p.name, created: new Date(p.created || Date.now()).toISOString() };
  const { error } = await client.from("projects").upsert(row, { onConflict: "user_id,client_id" });
  return { error: error ? error.message : null };
}
async function deleteProjectRow(clientId, userId) {
  const { error } = await client.from("projects").delete().eq("user_id", userId).eq("client_id", clientId);
  return { error: error ? error.message : null };
}
async function upsertMilestone(m, userId) {
  const row = {
    user_id: userId, client_id: m.id, name: m.name, date: m.date || null,
    project_id: await projectUuidFor(m.projectId),
    depends_on: m.dependsOn || [],
    created: new Date(m.created || Date.now()).toISOString(),
  };
  const { error } = await client.from("milestones").upsert(row, { onConflict: "user_id,client_id" });
  return { error: error ? error.message : null };
}
async function deleteMilestoneRow(clientId, userId) {
  const { error } = await client.from("milestones").delete().eq("user_id", userId).eq("client_id", clientId);
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
  fetchAll,
  upsertTask, deleteTaskRow,
  upsertProject, deleteProjectRow,
  upsertMilestone, deleteMilestoneRow,
};

// Signal readiness so the app can react once the module has loaded (it's deferred).
window.dispatchEvent(new Event("cloud-ready"));
