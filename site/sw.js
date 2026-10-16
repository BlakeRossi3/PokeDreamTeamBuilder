// Dream Team Dex service worker: the page and data load network-first (so updates show right away);
// sprite packs are versioned (?v=build) and cached on first use, so repeat visits are fast and work offline.
const VERSION = "__BUILD__", CACHE = "dtd-" + VERSION;
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./gifkit.js", "./manifest.webmanifest", "./config.js", "./vendor/supabase.js"]).catch(() => {}))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("dtd-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (/\/(s|t)\/[^/]+\.wasm$/.test(u.pathname) || u.pathname.endsWith("learnsets.json") || u.pathname.endsWith("items.png")) {
    e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(r); if (hit) return hit; const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res; }));
    return;
  }
  e.respondWith(fetch(r).then(res => { if (res.ok && (r.mode === "navigate" || u.pathname.endsWith(".js") || u.pathname.endsWith(".webmanifest"))) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r.mode === "navigate" ? "./" : r, cp)); } return res; })
    .catch(() => caches.match(r.mode === "navigate" ? "./" : r).then(m => m || Response.error())));
});
