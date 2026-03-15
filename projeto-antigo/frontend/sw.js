// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  FiberOps — Service Worker                                              ║
// ║  Estratégias:                                                           ║
// ║    Cache First      → app shell, MapLibre CDN                           ║
// ║    Stale-While-Rev  → tiles OSM + Esri (mapa offline)                  ║
// ║    Network First    → API de dados (ctos, rotas, diagramas...)          ║
// ║    Network Only     → auth, POST mutations (nunca cacheado)             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const CACHE_VERSION   = "ftth-v1";
const CACHE_SHELL     = `${CACHE_VERSION}-shell`;
const CACHE_TILES     = `${CACHE_VERSION}-tiles`;
const CACHE_API       = `${CACHE_VERSION}-api`;
const ALL_CACHES      = [CACHE_SHELL, CACHE_TILES, CACHE_API];

// Tile cache: max 2000 tiles, 30 dias
const TILE_MAX_ENTRIES = 2000;
const TILE_MAX_AGE_MS  = 30 * 24 * 60 * 60 * 1000;

// API cache: 24h
const API_MAX_AGE_MS   = 24 * 60 * 60 * 1000;

// App shell: pré-cacheia na instalação
const PRECACHE_SHELL = [
  "/",
  "/index.html",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
];

// ── Endpoints que NUNCA devem ser cacheados ───────────────────────────────────
const NETWORK_ONLY = [
  "/api/login",
  "/api/logout",
  "/api/me",
  "/api/auth",
];

// Métodos de escrita — nunca cachear
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ── Endpoints de dados cacheáveis (Network First + fallback) ─────────────────
const API_CACHEABLE = [
  "/api/ctos",
  "/api/caixas_emenda_cdo",
  "/api/rotas_fibras",
  "/api/olts",
  "/api/postes",
  "/api/diagrama",
  "/api/movimentacoes",
  "/api/topologia",
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — precache do app shell
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      Promise.allSettled(
        PRECACHE_SHELL.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Precache falhou: ${url}`, err)
          )
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — remove caches antigos
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => {
          console.log(`[SW] Removendo cache antigo: ${k}`);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — roteamento por estratégia
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora non-GET que não são mutações conhecidas (extensões, dev tools, etc.)
  if (request.method !== "GET" && !WRITE_METHODS.has(request.method)) return;

  // ── Writes: Network Only — deixa o authFetch lidar (tem retry/circuit-breaker)
  if (WRITE_METHODS.has(request.method)) return;

  // ── Auth endpoints: Network Only
  if (NETWORK_ONLY.some((p) => url.pathname.startsWith(p))) return;

  // ── Tiles OSM (tile.openstreetmap.org, arcgisonline.com, e /api/tiles/)
  if (
    url.hostname.includes("openstreetmap.org") ||
    url.hostname.includes("arcgisonline.com") ||
    url.pathname.startsWith("/api/tiles/")
  ) {
    event.respondWith(staleWhileRevalidate(request, CACHE_TILES, TILE_MAX_AGE_MS, TILE_MAX_ENTRIES));
    return;
  }

  // ── MapLibre CDN: Cache First (versão fixada, nunca muda)
  if (url.hostname === "unpkg.com") {
    event.respondWith(cacheFirst(request, CACHE_SHELL));
    return;
  }

  // ── App shell (index.html e raiz): Cache First com fallback de rede
  if (
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname.endsWith(".html")
  ) {
    event.respondWith(cacheFirst(request, CACHE_SHELL));
    return;
  }

  // ── API de dados: Network First com fallback do cache
  if (API_CACHEABLE.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(networkFirst(request, CACHE_API, API_MAX_AGE_MS));
    return;
  }

  // ── Tudo mais: Network First genérico
  event.respondWith(networkFirst(request, CACHE_API, API_MAX_AGE_MS));
});

// ─────────────────────────────────────────────────────────────────────────────
// ESTRATÉGIAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache First: serve do cache se existir, senão busca da rede e armazena.
 * Ideal para: app shell, CDN com versão fixa.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn(`[SW] cacheFirst offline e sem cache: ${request.url}`);
    return new Response("Offline — recurso não disponível em cache.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/**
 * Network First: tenta rede primeiro, fallback para cache em erro.
 * Ideal para: dados de API — garante frescor quando online.
 */
async function networkFirst(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      // Armazena com timestamp para expiração
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set("X-SW-Cached-At", Date.now().toString());
      const body = await responseToCache.arrayBuffer();
      cache.put(
        request,
        new Response(body, { status: responseToCache.status, headers })
      );
    }
    return networkResponse;
  } catch (_) {
    // Offline — tenta o cache
    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get("X-SW-Cached-At") || "0", 10);
      const age = Date.now() - cachedAt;
      if (age < maxAgeMs) {
        console.log(`[SW] Offline fallback (${Math.round(age / 60000)}min antigo): ${request.url}`);
        return cached;
      }
      // Cache expirado mas melhor que nada
      console.warn(`[SW] Cache expirado (${Math.round(age / 3600000)}h) mas offline: ${request.url}`);
      return cached;
    }
    return new Response(
      JSON.stringify({ ok: false, error: "Offline — dado não disponível em cache." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Stale While Revalidate: serve do cache imediatamente, atualiza em background.
 * Ideal para: tiles de mapa — resposta rápida, frescor eventual.
 * Aplica limite de entradas e expiração por idade.
 */
async function staleWhileRevalidate(request, cacheName, maxAgeMs, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Revalida em background (fire-and-forget)
  const fetchAndUpdate = fetch(request.clone())
    .then(async (networkResponse) => {
      if (!networkResponse.ok) return;
      await cache.put(request, networkResponse);
      await evictOldEntries(cache, maxEntries, maxAgeMs);
    })
    .catch(() => {}); // silencia offline — serve o cache existente

  if (cached) {
    // Serve o cache imediatamente, revalida em background
    fetchAndUpdate; // não await — let it run
    return cached;
  }

  // Sem cache: espera a rede
  try {
    return await fetchAndUpdate.then(() => cache.match(request)).then(
      (r) => r || fetch(request)
    );
  } catch (_) {
    return new Response("", { status: 503 });
  }
}

/**
 * Evict oldest cache entries when limit is exceeded.
 */
async function evictOldEntries(cache, maxEntries, maxAgeMs) {
  const keys = await cache.keys();
  const now = Date.now();

  // Remove entries por idade
  for (const key of keys) {
    const response = await cache.match(key);
    if (!response) continue;
    const cachedAt = parseInt(response.headers.get("X-SW-Cached-At") || "0", 10);
    if (cachedAt && now - cachedAt > maxAgeMs) {
      await cache.delete(key);
    }
  }

  // Remove mais antigas se ainda exceder o limite
  const remaining = await cache.keys();
  if (remaining.length > maxEntries) {
    const toDelete = remaining.slice(0, remaining.length - maxEntries);
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  }
}
