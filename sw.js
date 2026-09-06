const CACHE='hybrid-v3.15.6';
const ASSETS=['./deletion.js?v=3.15.6','./plunge.js?v=3.15.6','./plunge-ui.js?v=3.15.6','./','./index.html','./app.js?v=3.15.6','./idle-sync.js?v=3.15.6','./session.js?v=3.15.6','./cloud.js?v=3.15.6','./cloud-api.js?v=3.15.6','./core.js?v=3.15.6','./program.js?v=3.15.6','./training.js?v=3.15.6','./wellness.js?v=3.15.6','./wellness-ui.js?v=3.15.6','./suggestions.js?v=3.15.6','./suggestions-ui.js?v=3.15.6','./style.css?v=3.15.6','./manifest.webmanifest','./icons/icon-192.svg','./icons/icon-512.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k==='hybrid-v1'||k.startsWith('hybrid-v2.')||(k.startsWith('hybrid-v3.')&&k!==CACHE)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}return response;}).catch(async()=>await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));});




