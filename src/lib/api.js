/**
 * api.js — every network call the app makes, in one place
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The old code issued `fetch` calls inline inside App.jsx with ad-hoc error
 * handling per call site, and no request ever carried an AbortSignal. That last
 * point caused a real bug: searching twice in quick succession left two requests
 * in flight, and whichever resolved last won. A slow first search could overwrite
 * the result of a fast second one, so the panel showed the wrong knife with no
 * indication anything had gone wrong.
 *
 * Everything here takes a signal, normalises errors into messages a person can
 * act on, and caches successful GETs for the session so re-searching the same
 * term is instant and does not re-hit Shopify.
 */

const FUNCTIONS = "/.netlify/functions";

/** Session-lifetime cache. Keyed by full request URL. */
const cache = new Map();
const MAX_CACHE = 120;

function remember(key, value) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

/** Thrown for anything the user should see a message about. */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = "error" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
  }
}

async function getJson(url, { signal, cacheable = true } = {}) {
  if (cacheable && cache.has(url)) return cache.get(url);

  let res;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError("Could not reach the server. Check your connection and try again.", { kind: "network" });
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* handled below */ }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, { status: res.status });
  }
  if (data === null) {
    throw new ApiError("The server returned an unreadable response.", { status: res.status });
  }
  return cacheable ? remember(url, data) : data;
}

// ─── Airtable ────────────────────────────────────────────────────────────────

/**
 * Steel records, keyed by label and alias.
 *
 * Accepts both the current envelope `{ steels, meta }` and the older bare map, so
 * a client deployed ahead of the function (or vice versa) still works instead of
 * rendering an empty comparison.
 */
export async function fetchSteels({ signal } = {}) {
  const data = await getJson(`${FUNCTIONS}/airtable-proxy?resource=steels`, { signal });
  if (data && typeof data === "object" && data.steels) {
    return { steels: data.steels, meta: data.meta ?? {} };
  }
  return { steels: data ?? {}, meta: { legacyResponse: true } };
}

/** Knowledge-base entries. Same envelope tolerance as fetchSteels. */
export async function fetchKnowledgeBase({ signal } = {}) {
  const data = await getJson(`${FUNCTIONS}/airtable-proxy?resource=kb`, { signal });
  if (Array.isArray(data)) return { items: data, meta: { legacyResponse: true } };
  return { items: data?.items ?? [], meta: data?.meta ?? {} };
}

// ─── Shopify ─────────────────────────────────────────────────────────────────

/**
 * Search the Musashi catalogue.
 * Returns up to `limit` products; the caller decides which (if any) to use.
 * The previous code took `products[0]` unconditionally and never surfaced the rest.
 */
export async function searchProducts(query, { signal, limit = 6 } = {}) {
  const qs = new URLSearchParams({
    resource: "search",
    q: query,
    "resources[type]": "product",
    "resources[limit]": String(limit),
    "resources[options][fields]": "title,product_type,variants.sku,tag,vendor",
  });
  const data = await getJson(`${FUNCTIONS}/shopify-proxy?${qs}`, { signal });
  const products = data?.resources?.results?.products ?? [];
  return products.map((p) => ({
    title: p.title ?? "",
    handle: handleFromUrl(p.url) || p.handle || "",
    image: p.image ?? p.featured_image ?? null,
    price: p.price != null ? parseFloat(String(p.price).replace(/[^\d.]/g, "")) : NaN,
    type: p.product_type ?? "",
    vendor: p.vendor ?? "",
  })).filter((p) => p.handle);
}

const handleFromUrl = (url) => {
  if (!url) return "";
  const part = String(url).split("/products/")[1];
  return part ? part.split("?")[0].split("/")[0] : "";
};

/** Full product record for a handle. */
export async function fetchProduct(handle, { signal, currency = "JPY" } = {}) {
  const qs = new URLSearchParams({ resource: "products", handle, currency });
  const data = await getJson(`${FUNCTIONS}/shopify-proxy?${qs}`, { signal });
  const p = data?.product;
  if (!p) throw new ApiError(`No product exists at “${handle}” on musashihamono.com.`, { kind: "not-found" });
  return p;
}

// ─── External pages ──────────────────────────────────────────────────────────

/** Scrape a non-Musashi product page. */
export async function scrapeExternal(url, { signal } = {}) {
  const qs = new URLSearchParams({ url });
  return getJson(`${FUNCTIONS}/scrape-steel?${qs}`, { signal });
}

/** Diagnostics for the Airtable pipeline. Never cached. */
export async function fetchHealth({ signal } = {}) {
  return getJson(`${FUNCTIONS}/airtable-proxy?resource=health`, { signal, cacheable: false });
}

/** Exposed for tests. */
export const __clearCache = () => cache.clear();
