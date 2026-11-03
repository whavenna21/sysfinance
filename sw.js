// Service worker do Meu caixa: funciona offline e recebe as notificações.
importScripts('sw-push.js');

// Troque o número sempre que publicar uma versão nova do app.
const CACHE = 'caixa-v2';
const ARQUIVOS = ['./', './index.html', './pluggy.js', './sw-push.js', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ARQUIVOS.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Só os arquivos do próprio app passam por aqui (Firebase, Pluggy e o servidor seguem direto).
// Primeiro tenta a internet (para pegar sempre a versão nova); sem conexão, usa a cópia guardada.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
