// Service worker KITA: menyimpan "kerangka" aplikasi supaya tetap bisa dibuka tanpa sinyal.
// Data keluarga tidak disimpan di sini; itu tugas database lokal (F-10).
const CACHE = "kita-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // File build Next.js tidak pernah berubah isinya: ambil dari cache dulu.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Halaman: coba jaringan dulu, kalau offline pakai salinan terakhir (atau halaman awal).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/")),
        ),
    );
  }
});

// P-02: pengingat 07:00 dan 17:00 datang sebagai push notification.
self.addEventListener("push", (event) => {
  const { title, body } = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(title || "KITA", {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

// Menyentuh notifikasi membuka KITA (jendela yang sudah terbuka dipakai lagi).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) =>
        windows.length > 0 ? windows[0].focus() : self.clients.openWindow("/"),
      ),
  );
});
