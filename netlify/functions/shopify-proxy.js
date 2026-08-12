/**
 * shopify-proxy.js — Netlify Function
 *
 * Called directly by the app (no redirect needed):
 *
 *   GET /.netlify/functions/shopify-proxy?resource=products&handle=knife-name&currency=JPY
 *   GET /.netlify/functions/shopify-proxy?resource=search&q=gyuto&resources[type]=product&...
 *
 * SSRF protection: only musashihamono.com is ever contacted.
 */

const SHOPIFY_ORIGIN = "https://www.musashihamono.com";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const p = event.queryStringParameters || {};
  const resource = p.resource;

  // SSRF guard — only two known resources allowed
  if (resource !== "products" && resource !== "search") {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid resource. Use: products | search" }) };
  }

  // Build Shopify URL based on resource type
  let shopifyUrl;
  if (resource === "products") {
    // ?resource=products&handle=knife-name&currency=JPY
    const handle   = (p.handle || "").replace(/[^a-z0-9-]/gi, "");
    const currency = (p.currency || "").replace(/[^A-Z]/g, "");
    if (!handle) return { statusCode: 400, body: JSON.stringify({ error: "Missing handle" }) };
    shopifyUrl = `${SHOPIFY_ORIGIN}/products/${handle}.json${currency ? `?currency=${currency}` : ""}`;
  } else {
    // ?resource=search&q=...&resources[type]=product&...
    // Forward all query params except "resource"
    const fwd = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) {
      if (k !== "resource") fwd.append(k, v);
    }
    shopifyUrl = `${SHOPIFY_ORIGIN}/search/suggest.json?${fwd.toString()}`;
  }

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
