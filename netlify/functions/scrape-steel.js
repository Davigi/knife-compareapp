/**
 * scrape-steel.js — Netlify Function
 *
 * Fetches any public product page and returns extractable data
 * (title, og:image, og:price, body text) so the client can run
 * steel detection against it.
 *
 * SSRF protection:
 *  - Only http / https allowed
 *  - Hostname resolved and checked against all private IP ranges
 *  - localhost / .local / .internal blocked by name
 *  - Response capped at 500 KB
 *  - 8-second timeout
 *
 * GET /.netlify/functions/scrape-steel?url=<encoded_url>
 */

import dns from "node:dns/promises";
import { Buffer } from "node:buffer";

const MAX_BYTES  = 500_000; // 500 KB
const TIMEOUT_MS = 8_000;

// ── SSRF helpers ──────────────────────────────────────────────────────────────
function isPrivateIp(ip) {
  // IPv4
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 127)                         return true; // loopback
    if (a === 10)                          return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31)   return true; // RFC1918
    if (a === 192 && b === 168)            return true; // RFC1918
    if (a === 169 && b === 254)            return true; // link-local
    if (a === 0)                           return true; // 0.0.0.0/8
  }
  // IPv6
  if (ip === "::1")                        return true; // loopback
  if (ip.startsWith("fe80:"))             return true; // link-local
  if (/^f[cd]/i.test(ip))                 return true; // ULA (fc::/7)
  return false;
}

// ── HTML extraction helpers ───────────────────────────────────────────────────
function extractMeta(html, property) {
  // Handle both property= and name= attributes, in either order
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']{1,500})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].trim();
  }
  return "";
}

function extractTitle(html) {
  return (html.match(/<title[^>]*>([^<]{1,300})<\/title>/i) || [])[1]?.trim() || "";
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000); // enough for steel detection, not too much to send back
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const rawUrl = (event.queryStringParameters?.url || "").trim();
  if (!rawUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing url parameter" }) };
  }

  // Validate URL
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid URL" }) };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Only http/https URLs are allowed" }) };
  }

  // Block by hostname
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  ) {
    return { statusCode: 403, body: JSON.stringify({ error: "Private hostname not allowed" }) };
  }

  // Resolve and check IP (SSRF guard)
  try {
    const { address } = await dns.lookup(hostname);
    if (isPrivateIp(address)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Private IP not allowed" }) };
    }
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Cannot resolve hostname" }) };
  }

  console.log("scrape-steel →", rawUrl);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `Page returned ${res.status}` }) };
    }

    // Read with byte cap
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
      if (total >= MAX_BYTES) { reader.cancel(); break; }
    }
    const html = Buffer.concat(chunks).toString("utf-8");

    const title   = extractMeta(html, "og:title")     || extractTitle(html);
    const image   = extractMeta(html, "og:image");
    const desc    = extractMeta(html, "og:description") || extractMeta(html, "description");
    const rawPrice =
      extractMeta(html, "product:price:amount") ||
      extractMeta(html, "og:price:amount")      ||
      extractMeta(html, "twitter:data1");
    const price  = rawPrice ? parseFloat(rawPrice.replace(/[^\d.]/g, "")) : null;
    const body   = htmlToText(html);

    console.log("scrape-steel ← OK", title.slice(0, 80));

    return {
      statusCode: 200,
      headers: {
        "Content-Type":  "application/json",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify({ title, description: desc, body, image, price, url: rawUrl }),
    };
  } catch (err) {
    console.error("scrape-steel error:", err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
