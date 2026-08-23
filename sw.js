const CACHE='photopedia-v0.15';
const CORE=['./','./index.html','./styles.css','./content.js','./app.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{
    if(response && response.ok && new URL(e.request.url).origin===self.location.origin){
      const copy=response.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy));
    }
    return response;
  })));
});
