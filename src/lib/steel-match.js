/**
 * steel-match.js — steel name resolution
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT WAS WRONG
 * --------------
 * The old detection was `norm(text).includes(key)` over a list of keys sorted
 * longest-first. Three failure modes came out of that, and they account for most
 * of the reported search mistakes:
 *
 *   1. NO WORD BOUNDARIES. The key `r2` is two characters. Any product whose
 *      title or body happened to contain the letters "r2" anywhere — a model
 *      code, a dimension, a URL fragment — resolved to R2 steel. `sg2`, `sld`,
 *      `skd`, `vg1` had the same exposure. Adding a boundary check was tried and
 *      reverted in commit ee362ca because it broke 4-character keys like `aus8`
 *      and `vg10` instead — the fix was applied to raw substrings rather than to
 *      tokens, so it could not win either way.
 *
 *   2. SEPARATORS WERE SIGNIFICANT. `norm()` collapsed whitespace but preserved
 *      hyphens, so `vg-10` and `vg10` were different keys. The database only
 *      worked because someone hand-enumerated both spellings as aliases — 100
 *      alias keys, of which only 71 were unique. Any steel added without that
 *      manual duplication would silently fail to match.
 *
 *   3. FIRST HIT WINS, SILENTLY. `detectSteel` returned the first key that
 *      matched with no notion of how good the match was or whether a second,
 *      equally plausible steel also matched. A wrong answer was indistinguishable
 *      from a right one.
 *
 * HOW THIS WORKS INSTEAD
 * ----------------------
 * Text is split into tokens on every non-alphanumeric character, and a key
 * matches when it equals the concatenation of a run of consecutive tokens:
 *
 *     key "vg10"          text "VG 10 Santoku"  → ["vg","10","santoku"]
 *                                                  "vg"+"10" = "vg10"          ✓
 *     key "whitesteel2"   text "White Steel #2" → ["white","steel","2"]
 *                                                  all three = "whitesteel2"   ✓
 *     key "r2"            text "Master2 Series" → ["master2","series"]
 *                                                  no run concatenates to "r2" ✗
 *
 * Separators stop mattering — "VG-10", "VG 10", "vg_10" and "VG10" all reduce to
 * the same key, so the hand-enumerated spelling aliases become unnecessary — while
 * token edges are preserved exactly, so a two-character key can never fire on
 * letters buried inside a longer word. That is the trade-off commit ee362ca could
 * not resolve: it was applying boundary checks to raw substrings, where tightening
 * for `r2` necessarily broke `aus8`.
 *
 * Every match is scored (specificity × where it was found), the best match per
 * distinct steel is kept, and the caller receives the winner *plus* the runners-up
 * and an explicit `ambiguous` flag when the top two are too close to call.
 */

// ─── Normalisation ───────────────────────────────────────────────────────────

/**
 * Fold to a comparable form: lowercase, strip diacritics, drop the `#` that
 * Japanese steel names use ("White Steel #2"), and treat every other
 * non-alphanumeric character as a separator.
 */
export function fold(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[#＃]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Raw string → token array. Splitting only; nothing is joined here, so token
 * edges survive and `Master2` stays a single token that `r2` cannot match.
 */
export function tokenize(s) {
  const f = fold(s);
  return f ? f.split(" ").filter(Boolean) : [];
}

/**
 * Raw string → separator-free comparison key. "VG-10", "VG 10" and "vg10" all
 * squash to `vg10`, which is what makes spelling variants equivalent without any
 * hand-maintained alias list.
 */
export const squash = (s) => tokenize(s).join("");

/**
 * The longest token run a designation is allowed to span.
 * The widest real key in the dataset is 3 tokens ("MV (Molybdenum Vanadium)");
 * 4 leaves headroom without inviting accidental concatenations.
 */
const MAX_SPAN = 4;

/** Every concatenation of consecutive tokens, as `squashed → tokens consumed`. */
function spanForms(tokens, maxSpan = MAX_SPAN) {
  const forms = [];
  for (let i = 0; i < tokens.length; i++) {
    let acc = "";
    for (let span = 1; span <= maxSpan && i + span <= tokens.length; span++) {
      acc += tokens[i + span - 1];
      forms.push({ key: acc, start: i, span });
    }
  }
  return forms;
}

/** Stable identity for a steel record, used to group matches. */
const steelId = (steel) => steel?.label || steel?.id || JSON.stringify(steel);

// ─── Index ───────────────────────────────────────────────────────────────────

/**
 * Build a lookup index from the `{ [name]: steelRecord }` map the API returns.
 *
 * Keys that fold to the same tokens are merged rather than silently dropped —
 * the old code did `if (!steels[alias]) steels[alias] = entry`, which discarded
 * 29 of 100 alias keys without any signal. Here a collision between two
 * *different* steels is recorded so it can be surfaced instead of guessed.
 *
 * @param {Record<string, object>} steelsData
 * @returns {{entries: Array, byKey: Map, collisions: Array}}
 */
export function buildSteelIndex(steelsData = {}) {
  /** @type {Map<string, {tokens: string[], joined: string, records: Array}>} */
  const byJoined = new Map();

  const addKey = (rawKey, steel, isLabel) => {
    const tokens = tokenize(rawKey);
    if (!tokens.length || tokens.length > MAX_SPAN) return;
    const joined = tokens.join("");
    let slot = byJoined.get(joined);
    if (!slot) {
      slot = { tokens, joined, records: [] };
      byJoined.set(joined, slot);
    }
    // Don't record the same steel twice for the same key (label == alias happens
    // constantly in this dataset: "White Steel #3" and alias "white steel 3").
    if (!slot.records.some((r) => steelId(r.steel) === steelId(steel))) {
      slot.records.push({ steel, isLabel, rawKey });
    } else if (isLabel) {
      const existing = slot.records.find((r) => steelId(r.steel) === steelId(steel));
      existing.isLabel = true;
    }
  };

  for (const [name, steel] of Object.entries(steelsData)) {
    if (!steel || typeof steel !== "object") continue;
    const isLabel = fold(name) === fold(steel.label ?? name);
    addKey(name, steel, isLabel);
    for (const alias of steel.aliases ?? []) addKey(alias, steel, false);
    if (steel.label) addKey(steel.label, steel, true);
  }

  const entries = [];
  const collisions = [];
  for (const slot of byJoined.values()) {
    if (slot.records.length > 1) {
      collisions.push({ key: slot.joined, steels: slot.records.map((r) => r.steel.label) });
    }
    for (const rec of slot.records) {
      entries.push({
        tokens: slot.tokens,
        joined: slot.joined,
        length: slot.joined.length,
        steel: rec.steel,
        isLabel: rec.isLabel,
        rawKey: rec.rawKey,
        // A key claimed by more than one steel can never be decisive on its own.
        shared: slot.records.length > 1,
      });
    }
  }
  // Longest first: a longer designation is always the more specific reading.
  entries.sort((a, b) => b.length - a.length);

  // Squashed key → entries, so scanning text is a hash lookup per token span.
  const byKey = new Map();
  for (const e of entries) {
    if (!byKey.has(e.joined)) byKey.set(e.joined, []);
    byKey.get(e.joined).push(e);
  }

  return { entries, byKey, collisions };
}

// ─── Matching within text ────────────────────────────────────────────────────

/** Where a match was found, and how much we trust that location. */
const SOURCE_WEIGHT = { tags: 1.0, title: 0.92, body: 0.5 };

/**
 * Find every steel mentioned in one field of text.
 *
 * Walks each start position and lengthens the concatenation one token at a time,
 * so a key is only ever compared against a whole run of tokens.
 *
 * @returns {Array<{steel, joined, score, source}>}
 */
function scanField(text, index, source) {
  const tokens = tokenize(text);
  if (!tokens.length) return [];
  const hits = [];
  for (const form of spanForms(tokens)) {
    const matches = index.byKey.get(form.key);
    if (!matches) continue;
    for (const e of matches) {
      // Specificity: a designation spanning several words, or a longer code, is
      // stronger evidence than a bare two-character key.
      const specificity = form.span * 8 + Math.min(e.length, 14);
      let score = specificity * (SOURCE_WEIGHT[source] ?? 0.5);
      if (e.isLabel) score *= 1.06;      // canonical name beats an alias
      if (e.shared) score *= 0.6;        // key claimed by several steels
      hits.push({ steel: e.steel, joined: e.joined, score, source, position: form.start });
    }
  }
  return hits;
}

/**
 * Identify the steel a product is made from.
 *
 * Replaces `detectSteel(tags, title, body, steelPairs)`. Instead of returning the
 * first substring hit, it aggregates evidence across all three fields and reports
 * how confident it is.
 *
 * @param {{tags?: string[], title?: string, body?: string}} product
 * @param {ReturnType<typeof buildSteelIndex>} index
 * @returns {{steel: object|null, confidence: number, matchedKey: string|null,
 *            source: string|null, ambiguous: boolean, alternatives: Array}}
 */
export function detectSteel(product, index) {
  const empty = { steel: null, confidence: 0, matchedKey: null, source: null, ambiguous: false, alternatives: [] };
  if (!index?.entries?.length) return empty;

  const tags = Array.isArray(product?.tags) ? product.tags.join(" ") : String(product?.tags ?? "");
  const hits = [
    ...scanField(tags, index, "tags"),
    ...scanField(product?.title ?? "", index, "title"),
    ...scanField(product?.body ?? "", index, "body"),
  ];
  if (!hits.length) return empty;

  // Best evidence per distinct steel; a steel named in two fields gains a little.
  const best = new Map();
  for (const h of hits) {
    const id = steelId(h.steel);
    const prev = best.get(id);
    if (!prev) best.set(id, { ...h, sources: new Set([h.source]) });
    else {
      prev.sources.add(h.source);
      if (h.score > prev.score) Object.assign(prev, h, { sources: prev.sources });
    }
  }
  const ranked = [...best.values()]
    .map((h) => ({ ...h, score: h.score * (1 + 0.08 * (h.sources.size - 1)) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const runnerUp = ranked[1];

  // Two different steels with near-identical evidence means we genuinely cannot
  // tell — say so rather than picking one and hoping.
  const ambiguous = !!runnerUp && runnerUp.score > top.score * 0.85;

  // Confidence is calibrated so a bare two-character key found only in body text
  // lands low, while a multi-token label in the tags lands high.
  const confidence = Math.max(0, Math.min(1, (top.score / 34) * (ambiguous ? 0.6 : 1)));

  return {
    steel: top.steel,
    confidence,
    matchedKey: top.joined,
    source: top.source,
    ambiguous,
    alternatives: ranked.slice(1, 4).map((h) => ({ steel: h.steel, key: h.joined, score: h.score })),
  };
}

// ─── Matching a user's query ─────────────────────────────────────────────────

/**
 * Steels whose name the user's query could be naming.
 *
 * The old `matchesSteelKey` tested whether the query appeared as a whole word
 * inside a key, which is the right *idea* — it lets "Strix" find "SPG STRIX" —
 * but it operated on raw characters, so it inherited the hyphen problem and had
 * an arbitrary 3-character floor. This version does the same containment test on
 * tokens, and returns ranked candidates rather than the first hit.
 *
 * Queries longer than 3 tokens are rejected outright: "M390 Gyuto 210mm" is
 * somebody shopping for a knife, not asking about a steel. That single guard
 * removes the "typed a product name, got a steel card" failure.
 *
 * @returns {Array<{steel, key, score, exact: boolean}>} best first
 */
export function findSteelCandidates(query, index, { maxTokens = 3 } = {}) {
  const q = tokenize(query);
  if (!q.length || q.length > maxTokens || !index?.entries?.length) return [];
  const qKey = q.join("");
  // A single character or digit is noise, not a steel name.
  if (qKey.length < 2) return [];

  const bySteel = new Map();
  for (const e of index.entries) {
    let score = 0;
    let exact = false;
    if (e.joined === qKey) {
      score = 100;
      exact = true;
    } else {
      // Query appears as a run of whole words inside a longer designation:
      // "strix" inside "SPG STRIX". Because both sides are compared as token
      // spans, "h1001" can never match the key "h1" — the query is longer than
      // anything the key can produce.
      for (const form of spanForms(e.tokens)) {
        if (form.key !== qKey) continue;
        // Prefer the shortest key containing the query, so "strix" lands on
        // "SPG STRIX" rather than some longer designation that also contains it.
        score = Math.max(score, 70 - (e.tokens.length - form.span) * 8);
        break;
      }
    }
    if (!score) continue;
    if (e.isLabel) score += 3;
    if (e.shared) score -= 25;

    const id = steelId(e.steel);
    const prev = bySteel.get(id);
    if (!prev || score > prev.score) bySteel.set(id, { steel: e.steel, key: e.joined, score, exact });
  }

  return [...bySteel.values()].sort((a, b) => b.score - a.score || a.key.length - b.key.length);
}

// ─── Query classification ────────────────────────────────────────────────────

const MUSASHI_HOST = "musashihamono.com";

/**
 * Decide what the user typed before doing any network work.
 *
 * The old flow tested `isUrl()`, then tried a steel-name shortcut, then fell
 * through to product search — with the steel shortcut able to pre-empt a product
 * lookup. Making the classification explicit and total means each branch can
 * report a specific error instead of the generic
 * `No product or steel found for "…"`.
 *
 * @returns {{kind: 'empty'|'musashi-url'|'external-url'|'query', handle?: string, url?: string, text: string}}
 */
export function classifyQuery(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { kind: "empty", text };

  const looksLikeUrl = /^https?:\/\//i.test(text) || /^[\w.-]+\.[a-z]{2,}\//i.test(text);
  const mentionsMusashi = text.toLowerCase().includes(MUSASHI_HOST);

  if (mentionsMusashi) {
    return { kind: "musashi-url", handle: extractHandle(text), url: text, text };
  }
  if (looksLikeUrl) {
    const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    return { kind: "external-url", url, text };
  }
  return { kind: "query", text };
}

/**
 * Pull the product handle out of a Shopify product URL, or return "" when the URL
 * does not name a product.
 *
 * The empty return matters. The previous version fell back to "last path segment",
 * so `https://www.musashihamono.com/` yielded the handle `www.musashihamono.com`,
 * which was then requested from Shopify and produced a confusing 404 rather than
 * "that link doesn't point at a product".
 */
export function extractHandle(value) {
  const t = String(value ?? "").trim();
  const withoutQuery = t.split("?")[0].split("#")[0];

  if (withoutQuery.includes("/products/")) {
    return withoutQuery.split("/products/")[1].split("/")[0] ?? "";
  }
  // Anything with a scheme or a host must go through /products/ to name a product.
  if (/^https?:\/\//i.test(withoutQuery) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(withoutQuery)) return "";

  return withoutQuery.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
}
