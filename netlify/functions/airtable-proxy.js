/**
 * airtable-proxy.js — Netlify Function
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Serves steel records and knowledge-base content to the client. The Airtable
 * token never reaches the browser.
 *
 *   GET ?resource=steels          → { steels, meta }
 *   GET ?resource=kb              → { items, meta }
 *   GET ?resource=kb&category=…   → filtered knowledge base
 *   GET ?resource=health          → pipeline diagnostics, no secrets
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * This function used to hand-roll its own record shaping: it read the score
 * columns straight out of Airtable, coerced them with `Number(f.retention ?? 0)`
 * and shipped them. That is how the tiny-bars bug happened — Airtable still holds
 * the pre-migration 0–10 values, the ×10 bridge had been removed, and nothing in
 * the path knew or could know which scale it was holding.
 *
 * Normalisation now lives in src/lib/steel-data.js, shared with the client, the
 * tests and the build scripts, and it infers the score scale from the data. Two
 * consequences:
 *
 *   • legacy 0–10 rows render correctly *without* re-importing anything;
 *   • when the CSV is re-imported at 0–100, nothing here needs to change.
 *
 * The response is also an envelope rather than a bare map, so the client can see
 * what actually happened — which scale was detected, how many records were
 * dropped, which steels are missing metrics. Those used to be invisible.
 */

import { normaliseSteelBatch, toSteelMap } from "../../src/lib/steel-data.js";

const MAX_RECORDS = 2000;
const PAGE_SIZE = 100;
const ALLOWED_RESOURCES = ["steels", "kb", "health"];

const STEEL_FIELDS = [
  "label", "aliases", "category", "maker", "hrc",
  "retention", "sharpening", "corrosion", "chip",
  "c_pct", "cr_pct", "mo_pct", "v_pct", "w_pct", "co_pct", "mn_pct", "si_pct", "other_comp",
  "description", "available",
];

const KB_FIELDS = [
  "category", "group", "sort_order", "title", "body",
  "image_url", "link", "shape_key", "published",
];

const json = (statusCode, body, cacheSeconds = 0) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": cacheSeconds
      ? `public, max-age=${cacheSeconds}, stale-while-revalidate=600`
      : "no-store",
  },
  body: JSON.stringify(body),
});

/** Fetch every page of a table. Airtable returns 100 records at a time. */
async function fetchAll(token, base, table, { formula = "", fields = [] } = {}) {
  const results = [];
  let offset = "";

  do {
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
    if (formula) params.set("filterByFormula", formula);
    if (offset) params.set("offset", offset);
    fields.forEach((f) => params.append("fields[]", f));

    const res = await fetch(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Airtable responded ${res.status}`);
    }

    const data = await res.json();
    results.push(...(data.records || []));
    offset = data.offset || "";

    if (results.length >= MAX_RECORDS) {
      console.warn(`airtable-proxy: hit the ${MAX_RECORDS}-record ceiling on ${table}`);
      break;
    }
  } while (offset);

  return results;
}

/**
 * Airtable's CSV importer stores booleans as the strings "true"/"false" rather
 * than as checkboxes, so `filterByFormula` on those columns silently matches
 * nothing. Filtering happens here instead, treating a missing value as true.
 */
const isTruthyFlag = (value, dflt = true) => {
  if (value == null || value === "") return dflt;
  if (typeof value === "boolean") return value;
  return String(value).trim().toLowerCase() !== "false";
};

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method Not Allowed" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_DATA_BASE || process.env.AIRTABLE_BASE;
  const steelTable = process.env.AIRTABLE_STEELS_TABLE;
  const kbTable = process.env.AIRTABLE_KB_TABLE;

  const resource = (event.queryStringParameters?.resource || "").toLowerCase();
  if (!ALLOWED_RESOURCES.includes(resource)) {
    return json(400, { error: "Invalid resource. Use: steels | kb | health" });
  }

  // Health check reports configuration without leaking any of it.
  if (resource === "health") {
    return json(200, {
      ok: Boolean(token && base && steelTable && kbTable),
      configured: {
        AIRTABLE_TOKEN: Boolean(token),
        AIRTABLE_DATA_BASE: Boolean(base),
        AIRTABLE_STEELS_TABLE: Boolean(steelTable),
        AIRTABLE_KB_TABLE: Boolean(kbTable),
      },
    });
  }

  if (!token || !base) {
    return json(500, { error: "Server configuration error: Airtable credentials are not set." });
  }

  try {
    // ── Steels ───────────────────────────────────────────────────────────────
    if (resource === "steels") {
      if (!steelTable) return json(500, { error: "AIRTABLE_STEELS_TABLE is not set" });

      const raw = await fetchAll(token, base, steelTable, { fields: STEEL_FIELDS });
      const rows = raw.map((r) => r.fields).filter((f) => isTruthyFlag(f.available));

      // One shared normalisation path: scale detection, composition-derived
      // scores, validation. Identical to what the tests and scripts run.
      const { records, scale, rejected, incomplete } = normaliseSteelBatch(rows);
      const steels = toSteelMap(records);

      if (scale.multiplier !== 1) {
        console.warn(
          `airtable-proxy: detected legacy ${scale.scale} scores (max ${scale.max}) — ` +
          `rescaling by ×${scale.multiplier}. Re-import scripts/steels.csv to clear this.`
        );
      }
      if (rejected.length) console.warn(`airtable-proxy: dropped ${rejected.length} unusable steel rows`);
      if (incomplete.length) console.warn(`airtable-proxy: incomplete metrics for ${incomplete.join(", ")}`);

      return json(200, {
        steels,
        meta: {
          fetched: raw.length,
          available: records.length,
          keys: Object.keys(steels).length,
          scoreScale: scale.scale,
          rescaled: scale.multiplier !== 1,
          rejected: rejected.length,
          incomplete,
        },
      }, 300);
    }

    // ── Knowledge base ───────────────────────────────────────────────────────
    if (resource === "kb") {
      if (!kbTable) return json(500, { error: "AIRTABLE_KB_TABLE is not set" });

      const rawCategory = event.queryStringParameters?.category || "";
      const safeCategory = rawCategory.replace(/[^a-zA-Z0-9 &/-]/g, "").slice(0, 60);
      const formula = safeCategory ? `LOWER(category)=LOWER("${safeCategory}")` : "";

      const raw = await fetchAll(token, base, kbTable, { formula, fields: KB_FIELDS });

      const items = raw
        .map((r) => r.fields)
        .filter((f) => isTruthyFlag(f.published))
        .map((f) => ({
          category: f.category || "",
          group: f.group || "",
          sortOrder: Number(f.sort_order ?? 0) || 0,
          title: f.title || "",
          body: f.body || "",
          image: f.image_url || "",
          link: f.link || "",
          shape: f.shape_key || "",
        }))
        .sort((a, b) =>
          a.category.localeCompare(b.category) ||
          a.group.localeCompare(b.group) ||
          a.sortOrder - b.sortOrder
        );

      return json(200, { items, meta: { fetched: raw.length, published: items.length } }, 300);
    }
  } catch (err) {
    console.error("airtable-proxy error:", err);
    return json(502, { error: err.message || "Upstream request failed" });
  }
};
