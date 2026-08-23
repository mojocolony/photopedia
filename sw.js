const RETIRE='photopedia-v1.0.6-retire';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('photopedia-')).map(k=>caches.delete(k)));
  await self.clients.claim();
  await self.registration.unregister();
})()));
// Intentionally no fetch handler: the network owns the shell while V1.x is
// being actively iterated. Photopedia's private content cache remains local.
