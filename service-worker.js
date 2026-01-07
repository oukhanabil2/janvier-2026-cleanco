const CACHE_NAME = 'planning-app-v1.0';
const DYNAMIC_CACHE = 'planning-dynamic-v1.0';

// Fichiers à mettre en cache immédiatement
const STATIC_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/database.js',
    '/excel-import.js',
    '/offline-manager.js',
    '/manifest.json',
    '/lib/xlsx.full.min.js',
    '/lib/dexie.min.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/favicon.ico'
];

// Installer le Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Mise en cache des fichiers statiques');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker installé');
                return self.skipWaiting();
            })
    );
});

// Activer et nettoyer les anciens caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
                        console.log('Suppression ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activé');
            return self.clients.claim();
        })
    );
});

// Stratégie: Cache First, fallback sur réseau
self.addEventListener('fetch', event => {
    // Ne pas intercepter les requêtes vers les APIs externes
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('localhost:') ||
        event.request.url.includes('127.0.0.1')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(response => {
                        // Ne pas mettre en cache les requêtes non réussies
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Mettre en cache la réponse pour plus tard
                        const responseToCache = response.clone();
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Si le réseau échoue, retourner une page hors ligne
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        
                        // Pour les images, retourner une image par défaut
                        if (event.request.headers.get('accept').includes('image')) {
                            return caches.match('/assets/icons/icon-512.png');
                        }
                        
                        return new Response('Mode hors ligne', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Implémentez la logique de synchronisation
    console.log('Synchronisation en arrière-plan');
    
    try {
        // Récupérer les données en attente depuis IndexedDB
        const db = await openDB();
        const pending = await db.getAll('pendingSync');
        
        if (pending.length > 0) {
            const serverUrl = localStorage.getItem('serverUrl') || 'https://votre-serveur.com/api';
            
            for (const item of pending) {
                await fetch(`${serverUrl}/${item.type}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });
                
                // Marquer comme synchronisé
                await db.delete('pendingSync', item.id);
            }
            
            console.log('Synchronisation terminée:', pending.length, 'éléments');
            
            // Notifier les clients
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'SYNC_COMPLETE',
                    count: pending.length
                });
            });
        }
    } catch (error) {
        console.error('Erreur synchronisation:', error);
    }
}

// Recevoir des messages depuis l'application
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_ASSETS') {
        event.waitUntil(cacheAssets(event.data.urls));
    }
});

async function cacheAssets(urls) {
    const cache = await caches.open(CACHE_NAME);
    return Promise.all(
        urls.map(url => cache.add(url).catch(err => console.log('Erreur cache:', url, err)))
    );
}

async function openDB() {
    // Fonction utilitaire pour ouvrir IndexedDB
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PlanningAgentsDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pendingSync')) {
                db.createObjectStore('pendingSync', { keyPath: 'id' });
            }
        };
    });
}