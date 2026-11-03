/* Notificações do Meu caixa. Adicione na PRIMEIRA linha do seu sw.js:
     importScripts('sw-push.js');
   e coloque este arquivo ao lado do sw.js. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Meu caixa', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  const q = new URL(url).searchParams.get('pluggy');
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find(c => c.url.startsWith(self.registration.scope));
    if (w) { await w.focus(); w.postMessage({ type: 'pluggy-open', q }); return; }
    await clients.openWindow(url);
  })());
});
