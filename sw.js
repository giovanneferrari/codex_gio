const CACHE_NAME='rito-shell-v26';
const APP_SHELL=['./','./index.html','./styles.css?v=ux-push-26','./app.js?v=ux-push-26','./manifest.webmanifest?v=3','./assets/rito-logo-transparent.png?v=1','./assets/rito-monograma.png','./assets/icons/icon-192.png?v=3','./assets/icons/icon-512.png?v=3','./assets/icons/apple-touch-icon.png?v=3'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.hostname.endsWith('.supabase.co'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('./index.html')));
    return;
  }
  if(url.origin!==self.location.origin)return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}
    return response;
  })));
});

self.addEventListener('push',event=>{
  const message=event.data?.json()||{};
  event.waitUntil(self.registration.showNotification(message.title||'RITO',{body:message.body||'O fechamento foi atualizado.',icon:'./assets/icons/icon-192.png?v=3',badge:'./assets/icons/icon-192.png?v=3',data:message.data||{url:'./'}}));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const opened=windows[0];if(opened){opened.navigate(target);return opened.focus()}return clients.openWindow(target)}));
});
