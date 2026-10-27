const CACHE_NAME = 'hydrocybernetics-shell-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/network-visual.css',
  './css/digital-twin.css',
  './css/mobile.css',
  './js/config.js',
  './js/icons.js',
  './js/network-canvas.js',
  './js/hydraulic-integration.js',
  './js/app.js',
  './js/views/landing.js',
  './js/views/auth-citizen.js',
  './js/views/auth-municipal.js',
  './js/views/dashboard-citizen.js',
  './js/views/digital-twin.js',
  './js/views/dashboard-municipal.js',
  './js/views/placeholder.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only manage GET requests. API calls, POSTs, and other methods
  // continue to use the existing network behavior.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Keep API/data requests network-first. Do not cache live
  // hydraulic, authentication, citizen-report, or telemetry data.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/api/')
  ) {
    return;
  }

  // For navigation, prefer the network so the installed app
  // receives the current frontend, then fall back to the shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Local application assets: cache first, then network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetch(request))
    );
  }
});
