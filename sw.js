/* ---------------------------------------------------------
   Project Tracker — Service Worker
   A service worker is a script the browser runs in the
   background, separate from the page. It sits between the app
   and the network and can answer requests from a cache — which
   is what makes the app load offline and feel installed.

   Lifecycle: install (precache files) → activate (clean up old
   caches) → fetch (intercept every request the page makes).
--------------------------------------------------------- */

// Bump this version string whenever the cached files change.
// The name is part of the cache key, so a new version creates a
// fresh cache and the old one gets deleted in `activate` below.
// (This is how you ship updates — otherwise users keep the old cached copy.)
const CACHE = "project-tracker-v13";

// The "app shell": the minimum set of files needed to render the
// app. Tasks themselves live in localStorage, so once these are
// cached the app is fully usable with no network at all.
// Paths are relative so they work under the /project-tracker/ subpath on GitHub Pages.
const SHELL = [
  "./",
  "./index.html",
  "./js/store.js",
  "./js/config.js",
  "./js/cloud.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
];

// INSTALL — fired once when this SW version is first seen.
// Open the versioned cache and store the shell files in it.
// skipWaiting() lets a new version take over without waiting
// for every old tab to close.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — fired when this SW takes control. Delete any caches
// that aren't the current version, so old files don't linger.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH — fired for every request the page makes.
// Strategy: cache-first. If we have the file cached, return it
// instantly (works offline); otherwise go to the network, and if
// that also fails, fall back to the cached index.html for navigations
// so the app still opens offline even on an uncached URL.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;   // only cache GETs

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).catch(() => {
        // Offline and not in cache: for page navigations, serve the shell.
        if (req.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
