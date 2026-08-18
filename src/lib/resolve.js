/**
 * resolve.js — turning what the user typed into what the panel shows
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT WAS WRONG
 * --------------
 * One input field served three purposes — external URL, steel name, product
 * keyword — resolved by sequential fallthrough inside `fetchKnife`:
 *
 *     if (isUrl && !isMusashi)      → scrape
 *     else if (steel-name matches)  → show steel card, return
 *     else                          → product search, take products[0]
 *
 * Two structural problems came out of that ordering:
 *
 *   THE STEEL SHORTCUT PRE-EMPTED PRODUCT SEARCH. It ran before any network call
 *   and returned immediately on a match, so a query that named a steel could never
 *   reach the catalogue — even when the user obviously wanted a knife.
 *
 *   PRODUCT SEARCH TOOK THE FIRST RESULT, ALWAYS. `products[0]` was accepted with
 *   no check on how well it matched. Shopify's top hit for a vague query is often
 *   unrelated, and the UI presented it with exactly the same confidence as an
 *   exact match. There was no way for the user to tell a good hit from a bad one,
 *   and no way to pick the right one.
 *
 * HOW THIS WORKS INSTEAD
 * ----------------------
 * Steel lookup and product search both run, and their results compete on a single
 * 0–1 scale. The outcome is then decided by how clear-cut the winner is:
 *
 *   • a strong winner with a clear gap to the runner-up  → resolve it directly
 *   • anything less                                      → hand back the candidates
 *   • nothing above the floor                            → a specific error
 *
 * So "VG-10" still resolves straight to the steel card, and a full product title
 * still resolves straight to the product — but "gyuto 210" now offers a choice
 * instead of silently guessing, which is where the false positives came from.
 *
 * The whole pipeline takes its network calls as an injected `api` object, so it
 * can be tested end-to-end without a server.
 */

import { classifyQuery, findSteelCandidates, detectSteel, tokenize, squash } from "./steel-match.js";

/** A candidate must clear this to be offered at all. */
const FLOOR = 0.28;
/** Top candidate resolves automatically only above this. */
const AUTO_SELECT = 0.8;
/** …and only if it leads the runner-up by at least this much. */
const AUTO_SELECT_GAP = 0.22;

/**
 * How well a product title answers the query.
 * Token overlap, with a strong bonus when the query is a prefix of the title —
 * which is what pasting a real product name looks like.
 */
export function scoreProductTitle(query, title, rank = 0) {
  const q = tokenize(query);
  const t = new Set(tokenize(title));
  if (!q.length) return 0;

  const overlap = q.filter((token) => t.has(token)).length / q.length;
  const qs = squash(query);
  const ts = squash(title);

  let score = overlap * 0.78;
  if (ts === qs) score = 1;
  else if (ts.startsWith(qs) && qs.length >= 6) score = Math.max(score, 0.9);
  else if (ts.includes(qs) && qs.length >= 8) score = Math.max(score, 0.82);

  // Shopify's own ranking is weak evidence, worth a nudge and no more.
  score += Math.max(0, 0.05 - rank * 0.012);
  return Math.min(1, score);
}

/** Steel candidate score (0–100 from the matcher) onto the shared 0–1 scale. */
const scoreSteelCandidate = (c) => Math.min(1, c.score / 100);

/** Shape a Shopify product into the knife record the UI renders. */
export function knifeFromProduct(product, detection) {
  const tags = Array.isArray(product.tags)
    ? product.tags
    : (product.tags ? String(product.tags).split(",").map((t) => t.trim()).filter(Boolean) : []);

  return {
    title: product.title ?? "",
    image: product.images?.[0]?.src ?? product.image ?? null,
    price: parseFloat(product.variants?.[0]?.price ?? product.price ?? NaN),
    currency: "JPY",
    type: product.product_type ?? null,
    vendor: product.vendor ?? null,
    tags,
    description: product.body_html ?? "",
    handle: product.handle ?? "",
    externalUrl: null,
    steel: detection?.steel ?? null,
    steelMatch: detection ?? null,
    steelOnly: false,
  };
}

/** Shape a steel record into a knife record for the steel-only card. */
export function knifeFromSteel(steel) {
  return {
    title: steel.label,
    image: null,
    price: NaN,
    currency: "",
    type: null,
    vendor: null,
    tags: [],
    description: steel.desc ?? "",
    handle: null,
    externalUrl: null,
    steel,
    steelMatch: { steel, confidence: 1, source: "name", ambiguous: false, alternatives: [] },
    steelOnly: true,
  };
}

/** Shape a scraped external page into a knife record. */
export function knifeFromScrape(data, url, detection) {
  return {
    title: data.title || url,
    image: data.image ?? null,
    price: data.price ?? NaN,
    currency: data.currency || "",
    type: null,
    vendor: null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    description: data.description ?? data.body ?? "",
    handle: null,
    externalUrl: url,
    steel: detection?.steel ?? null,
    steelMatch: detection ?? null,
    steelOnly: false,
  };
}

/**
 * Resolve one slot's query.
 *
 * @param {string} rawQuery
 * @param {object} deps
 * @param {object} deps.index   built by buildSteelIndex()
 * @param {object} deps.api     { searchProducts, fetchProduct, scrapeExternal }
 * @param {AbortSignal} [deps.signal]
 * @returns {Promise<{status:'resolved'|'choose'|'error', knife?, candidates?, error?, notice?}>}
 */
export async function resolveQuery(rawQuery, { index, api, signal } = {}) {
  const parsed = classifyQuery(rawQuery);

  if (parsed.kind === "empty") {
    return { status: "error", error: "Type a product name, a steel name, or paste a link." };
  }

  // ── A Musashi link names exactly one product; there is nothing to choose ──
  if (parsed.kind === "musashi-url") {
    if (!parsed.handle) {
      return { status: "error", error: "That Musashi link doesn't contain a product address." };
    }
    const product = await api.fetchProduct(parsed.handle, { signal });
    const detection = detectSteel(
      { tags: product.tags, title: product.title, body: product.body_html },
      index
    );
    return { status: "resolved", knife: knifeFromProduct(product, detection) };
  }

  // ── Another shop's page: scrape it and identify the steel from the text ──
  if (parsed.kind === "external-url") {
    const data = await api.scrapeExternal(parsed.url, { signal });
    const detection = detectSteel(
      { tags: data.tags, title: data.title, body: data.body },
      index
    );
    return { status: "resolved", knife: knifeFromScrape(data, parsed.url, detection) };
  }

  // ── A free-text query: let steels and products compete ──
  const steelMatches = findSteelCandidates(parsed.text, index).slice(0, 3);

  let products = [];
  let searchFailed = null;
  try {
    products = await api.searchProducts(parsed.text, { signal });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    // A search outage must not hide a steel we can answer from local data.
    searchFailed = err;
  }

  const candidates = [
    ...steelMatches.map((c) => ({
      kind: "steel",
      id: `steel:${c.steel.label}`,
      label: c.steel.label,
      sublabel: [c.steel.cat, c.steel.maker].filter(Boolean).join(" · "),
      score: scoreSteelCandidate(c),
      steel: c.steel,
    })),
    ...products.map((p, rank) => ({
      kind: "product",
      id: `product:${p.handle}`,
      label: p.title,
      sublabel: [p.type, p.vendor].filter(Boolean).join(" · "),
      score: scoreProductTitle(parsed.text, p.title, rank),
      product: p,
    })),
  ]
    .filter((c) => c.score >= FLOOR)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    if (searchFailed) {
      return { status: "error", error: `Product search is unavailable right now (${searchFailed.message})` };
    }
    return {
      status: "error",
      error: `Nothing on musashihamono.com matches “${parsed.text}”, and it isn't a steel we know. Try a shorter phrase, a steel name like “VG-10”, or paste a product link.`,
    };
  }

  const [top, runnerUp] = candidates;
  const decisive = top.score >= AUTO_SELECT && (!runnerUp || top.score - runnerUp.score >= AUTO_SELECT_GAP);

  if (!decisive) {
    return {
      status: "choose",
      candidates: candidates.slice(0, 6),
      notice: searchFailed ? "Showing steel matches only — product search is unavailable." : null,
    };
  }

  return {
    status: "resolved",
    knife: await materialise(top, { index, api, signal }),
    notice: searchFailed ? "Product search is unavailable; matched on steel name." : null,
  };
}

/**
 * Turn a chosen candidate into a knife record.
 * Steels are local; products need one more request.
 */
export async function materialise(candidate, { index, api, signal } = {}) {
  if (candidate.kind === "steel") return knifeFromSteel(candidate.steel);

  const product = await api.fetchProduct(candidate.product.handle, { signal });
  const detection = detectSteel(
    { tags: product.tags, title: product.title, body: product.body_html },
    index
  );
  return knifeFromProduct(product, detection);
}

export const THRESHOLDS = { FLOOR, AUTO_SELECT, AUTO_SELECT_GAP };
