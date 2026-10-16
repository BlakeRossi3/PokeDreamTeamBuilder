// Dream Team Dex service worker.
// - The page and small files: network first (updates show right away), but on a slow or missing connection the
//   cached copy is used after a short wait, so the app also starts offline.
// - Sprite packs, learnsets, the 2D art and the item sheet carry a hash of their own contents (?v=…). They live in one cache that
//   survives new deploys: only packs that really changed are downloaded again. Older versions of a pack are removed
//   when the new one is stored.
const VERSION = "__BUILD__", CACHE = "dtd-" + VERSION, PACKS = "dtd-packs";
const SHELL = ["./", "./gifkit.js", "./manifest.webmanifest", "./config.js", "./vendor/supabase.js"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("dtd-") && k !== CACHE && k !== PACKS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isPack = p => /\/(s|t)\/[^/]+\.wasm$/.test(p) || /\/(learnsets|art2d)\.json$/.test(p) || p.endsWith("items.png");
async function packFetch(r){
  const c = await caches.open(PACKS), hit = await c.match(r); if (hit) return hit;
  const res = await fetch(r);
  if (res.ok) {
    const u = new URL(r.url);
    c.put(r, res.clone()).then(async () => {   // drop older versions of the same pack
      for (const k of await c.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); }
    }).catch(() => {});
  }
  return res;
}
// network first; if it hasn't answered in time and a cached copy exists, use that (the network copy still updates the cache)
function shellFetch(e, r, u){
  const key = r.mode === "navigate" ? "./" : r;
  const net = fetch(r).then(res => { if (res.ok && (r.mode === "navigate" || /\.(js|webmanifest)$/.test(u.pathname))) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(key, cp)); } return res; });
  e.waitUntil(net.catch(() => {}));
  return caches.match(key).then(cached => {
    if (!cached) return net;
    const slow = new Promise(res => setTimeout(() => res(cached), r.mode === "navigate" ? 3500 : 2500));
    return Promise.race([net.catch(() => cached), slow]);
  });
}
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (isPack(u.pathname)) { e.respondWith(packFetch(r)); return; }
  e.respondWith(shellFetch(e, r, u).catch(() => caches.match(r.mode === "navigate" ? "./" : r).then(m => m || Response.error())));
});
