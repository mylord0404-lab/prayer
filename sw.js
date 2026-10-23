/* 상황별 기도문 — 오프라인 캐시 */
var CACHE = "prayer-v2";
var ASSETS = ["./", "index.html", "styles.css", "app.js", "content.js", "manifest.webmanifest",
  "fonts/GowunBatang-Regular.woff2",
  "icons/apple-touch-icon.png", "icons/icon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  // 같은 도메인의 다른 앱 캐시는 건드리지 않도록 'prayer-' 캐시만 정리
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("prayer-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(caches.match("index.html").then(function (r) {
      var net = fetch(req).then(function (res) { if (res.ok) caches.open(CACHE).then(function (c) { c.put("index.html", res.clone()); }); return res; }).catch(function () { return r; });
      return r || net;
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
