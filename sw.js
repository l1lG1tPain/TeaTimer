// TeaTimer 1.2 — service worker (офлайн-режим)
// Версия кэша совпадает с версией приложения: при её смене старый кэш удаляется.
const CACHE_NAME = 'teatimer-v1.2.1';
const SOUND_CACHE = 'teatimer-sounds-v1';

// Относительные пути: абсолютные "/..." дают 404 (и ломают всю установку, ведь
// cache.addAll — «всё или ничего»), если приложение лежит не в корне домена.
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './teas.json',
  './manifest.json',
  './assets/TeaTimer.png',
  './assets/TeaTimer-l.png',
  './assets/favicon.ico'
];

const SOUNDS = [
  './assets/sounds/Гонг.wav',
  './assets/sounds/Колокольчик.wav',
  './assets/sounds/Мягкий звон.wav'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)),
      // Звуки кэшируем отдельно и «мягко»: их отсутствие не должно ломать установку
      caches.open(SOUND_CACHE).then(cache => Promise.allSettled(SOUNDS.map(url => cache.add(url))))
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== SOUND_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const url = decodeURIComponent(req.url);
  const isSound = SOUNDS.some(s => url.includes(s.slice(2)));

  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // status 0 — «непрозрачные» ответы (Google Fonts без crossorigin): тоже кэшируем,
        // иначе шрифты пропадут офлайн.
        if (res.status === 200 || res.type === 'opaque') {
          const clone = res.clone();
          caches.open(isSound ? SOUND_CACHE : CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Офлайн и в кэше нет: для страниц отдаём приложение, для остального — пустой ответ
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});

// Тап по уведомлению «Пролив готов» — возвращаем пользователя в приложение
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});
