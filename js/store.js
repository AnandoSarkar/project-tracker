// store.js — the persistence seam.
//
// This is the ONE place that knows *where* data physically lives. Today that's
// localStorage; in the cloud-sync phase this module gains a Supabase-backed path
// and the rest of the app doesn't change, because everything funnels through here.
//
// Scope kept deliberately tiny: this owns raw read/write of the three collections
// (tasks, projects, milestones) plus the theme string. It does NOT know about the
// app's object shapes — normalization stays in the app (the data it returns is fed
// through normalizeTask/Project/Milestone by the caller, exactly as before).
//
// Loaded as an ES module but exposes its API on `window.Store` so the existing
// (global, non-module) app script can call it without being converted to a module.

const KEYS = {
  tasks: "projectTracker.tasks.v1",
  projects: "projectTracker.projects.v1",
  milestones: "projectTracker.milestones.v1",
  theme: "projectTracker.theme",
};

// Read a JSON array collection ("tasks" | "projects" | "milestones").
// Returns a raw array (un-normalized) or [] on missing/corrupt data — identical
// behaviour to the old inline load functions (which caught + warned + returned []).
function readCollection(name) {
  try {
    const raw = localStorage.getItem(KEYS[name]);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not load " + name + ":", e);
    return [];
  }
}

// Write a JSON array collection.
function writeCollection(name, value) {
  localStorage.setItem(KEYS[name], JSON.stringify(value));
}

// Plain string get/set (used for the theme preference).
function readValue(name) {
  return localStorage.getItem(KEYS[name]);
}
function writeValue(name, value) {
  localStorage.setItem(KEYS[name], value);
}

// Has this key ever been written? Distinguishes "first-ever visit" (key absent)
// from "key exists but is empty []" — used by the first-visit seed logic.
function has(name) {
  return localStorage.getItem(KEYS[name]) !== null;
}

window.Store = { KEYS, readCollection, writeCollection, readValue, writeValue, has };
