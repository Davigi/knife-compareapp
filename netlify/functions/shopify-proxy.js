/**
 * shopify-proxy.js — Netlify Function
 *
 * Reverse-proxies /api/products/* and /api/search/* to musashihamono.com.
 * Using a Function (vs dumb [[redirects]]) lets us set proper headers so
 * Shopify doesn't reject the request.
 *
 * SSRF protection: only musashihamono.com is ever contacted.
 *
 * GET /api/products/:handle.json?currency=JPY
 * GET /api/search/suggest.json?q=...
 */

const SHOPIFY_ORIGIN = "https://www.musashihamono.com";
const ALLOWED_PREFIXES = ["products/", "search/"];

export const handler = async (event) => {
  // Debug: log everything Netlify passes so we can see the real values
  console.log("shopify-proxy called:", JSON.stringify({
    method:  event.httpMethod,
    path:    event.path,
    rawUrl:  event.rawUrl,
    rawQuery: event.rawQuery,
  }));

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Try event.path first (Netlify sets this to the original path when via redirect),
  // then fall back to parsing rawUrl
  let apiPath;
  try {
    const fromPath = (event.path || "").replace(/^\/api\//, "");
    const fromUrl  = new URL(event.rawUrl).pathname.replace(/^\/api\//, "");
    // Use whichever one looks like a Shopify path
    apiPath = ALLOWED_PREFIXES.some((p) => fromPath.startsWith(p))
      ? fromPath
      : fromUrl;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request URL" }) };
  }

  console.log("shopify-proxy apiPath:", apiPath);

  // SSRF guard — only allow the two known Shopify endpoints
  const allowed = ALLOWED_PREFIXES.some((p) => apiPath.startsWith(p));
  if (!allowed) {
    console.error("shopify-proxy SSRF blocked:", apiPath);
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden resource" }) };
  }

  // Reconstruct query string from event (Netlify already parses it)
  const qs = event.rawQuery ? `?${event.rawQuery}` : "";
  const shopifyUrl = `${SHOPIFY_ORIGIN}/${apiPath}${qs}`;

  console.log("shopify-proxy →", shopifyUrl);

  try {
    const res = await fetch(shopifyUrl, {
      headers: {
        "Accept":          "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer":         SHOPIFY_ORIGIN + "/",
        "Origin":          SHOPIFY_ORIGIN,
      },
    });

    const body = await res.text();
    console.log("shopify-proxy ←", res.status, apiPath);

    if (!res.ok) {
      console.error("shopify-proxy error body:", body.slice(0, 300));
    }

    return {
      statusCode: res.status,
      headers: {
        "Content-Type":  res.headers.get("content-type") || "application/json",
        "Cache-Control": "public, max-age=60",
      },
      body,
    };
  } catch (err) {
    console.error("shopify-proxy fetch failed:", err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Failed to reach Shopify store" }),
    };
  }
};
