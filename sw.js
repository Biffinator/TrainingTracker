const CACHE='hybrid-v3.16.2';
const ASSETS=['./deletion.js?v=3.16.2','./plunge.js?v=3.16.2','./plunge-ui.js?v=3.16.2','./','./index.html','./app.js?v=3.16.2','./idle-sync.js?v=3.16.2','./session.js?v=3.16.2','./cloud.js?v=3.16.2','./cloud-api.js?v=3.16.2','./core.js?v=3.16.2','./program.js?v=3.16.2','./training.js?v=3.16.2','./wellness.js?v=3.16.2','./wellness-ui.js?v=3.16.2','./reporting.js?v=3.16.2','./reporting-ui.js?v=3.16.2','./suggestions.js?v=3.16.2','./suggestions-ui.js?v=3.16.2','./style.css?v=3.16.2','./manifest.webmanifest','./icons/icon-192.svg','./icons/icon-512.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k==='hybrid-v1'||k.startsWith('hybrid-v2.')||(k.startsWith('hybrid-v3.')&&k!==CACHE)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}return response;}).catch(async()=>await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));});




