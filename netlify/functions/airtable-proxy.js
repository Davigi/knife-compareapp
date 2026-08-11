/**
 * airtable-proxy.js — Netlify Function
 *
 * Serves steel data and knowledge base content to the client.
 * The Airtable token never touches the browser — it lives in process.env only.
 *
 * GET /.netlify/functions/airtable-proxy?resource=steels
 * GET /.netlify/functions/airtable-proxy?resource=kb
 * GET /.netlify/functions/airtable-proxy?resource=kb&category=Metal
 *
 * Responses are plain JSON arrays — easy to drop into React state.
 */

const MAX_RECORDS = 500; // Airtable page size cap

const ALLOWED_RESOURCES = ["steels", "kb"];

// Airtable returns records in pages of 100; this fetches all of them.
async function fetchAll(token, base, table, formula = "", fields = []) {
  const results = [];
  let offset = "";

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (formula) params.set("filterByFormula", formula);
    if (offset)  params.set("offset", offset);
    fields.forEach((f) => params.append("fields[]", f));

    const res = await fetch(
      `https://api.airtable.com/v0/${base}/${table}?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Airtable ${res.status}`);
    }

    const data = await res.json();
    results.push(...(data.records || []));
    offset = data.offset || "";

    if (results.length >= MAX_RECORDS) break; // safety guard
  } while (offset);

  return results;
}

export const handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token      = process.env.AIRTABLE_TOKEN;
  const base       = process.env.AIRTABLE_BASE;
  const steelTable = process.env.AIRTABLE_STEELS_TABLE;
  const kbTable    = process.env.AIRTABLE_KB_TABLE;

  if (!token || !base) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  const resource = (event.queryStringParameters?.resource || "").toLowerCase();

  if (!ALLOWED_RESOURCES.includes(resource)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid resource. Use: steels | kb" }),
    };
  }

  try {
    // ── Steels ─────────────────────────────────────────────────────────────
    if (resource === "steels") {
      if (!steelTable) {
        return { statusCode: 500, body: JSON.stringify({ error: "AIRTABLE_STEELS_TABLE env var not set" }) };
      }

      // CSV import stores booleans as strings — fetch all and filter client-side
      const records = await fetchAll(
        token, base, steelTable,
        "",
        ["label","aliases","category","maker","hrc",
         "retention","sharpening","corrosion","chip",
         "c_pct","cr_pct","mo_pct","v_pct","w_pct","co_pct","mn_pct","si_pct","other_comp",
         "description","available"]
      );

      // Shape for the app: { [label]: { ...steel } }
      // Also expand aliases so detectSteel() works with the same map.
      const steels = {};
      for (const r of records) {
        const f = r.fields;
        // Skip steels explicitly marked unavailable (handles string "false" from CSV import)
        const avail = String(f.available ?? "true").toLowerCase();
        if (avail === "false") continue;
        // Build composition — omit empty values so the UI stays clean
        const comp = {};
        const compMap = { C:"c_pct", Cr:"cr_pct", Mo:"mo_pct", V:"v_pct", W:"w_pct", Co:"co_pct", Mn:"mn_pct", Si:"si_pct", Other:"other_comp" };
        for (const [el, key] of Object.entries(compMap)) {
          if (f[key]) comp[el] = f[key];
        }
        const entry = {
          label:      f.label  || "",
          // aliases array — used to build lookup keys
          aliases:   (f.aliases || "").split(",").map((a) => a.trim()).filter(Boolean),
          // Field names kept identical to original hardcoded STEELS shape
          cat:        f.category    || "",
          maker:      f.maker       || "",
          hrc:        f.hrc         || "",
          retention:  Number(f.retention  ?? 0),
          sharpening: Number(f.sharpening ?? 0),
          corrosion:  Number(f.corrosion  ?? 0),
          chip:       Number(f.chip       ?? 0),
          comp,
          desc:       f.description || "",
        };

        // Index by canonical label
        steels[f.label] = entry;
        // Index by each alias as well (app looks up by both)
        for (const alias of entry.aliases) {
          if (alias && !steels[alias]) steels[alias] = entry;
        }
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // 5-min CDN cache
        },
        body: JSON.stringify(steels),
      };
    }

    // ── Knowledge Base ──────────────────────────────────────────────────────
    if (resource === "kb") {
      if (!kbTable) {
        return { statusCode: 500, body: JSON.stringify({ error: "AIRTABLE_KB_TABLE env var not set" }) };
      }

      // Optionally filter by category (case-insensitive)
      const rawCategory = event.queryStringParameters?.category || "";
      const safeCategory = rawCategory.replace(/[^a-zA-Z0-9 &/-]/g, "").slice(0, 60);
      // CSV import stores booleans as strings so we can't use published=TRUE() —
      // fetch all and filter client-side instead
      const formula = safeCategory
        ? `LOWER(category)=LOWER("${safeCategory}")`
        : "";

      const records = await fetchAll(
        token, base, kbTable,
        formula,
        ["category","group","sort_order","title","body","image_url","link","shape_key","published"]
      );

      // Filter out explicitly unpublished rows (handles string "false" from CSV import)
      const published = records.filter(r => {
        const p = String(r.fields.published ?? "true").toLowerCase();
        return p !== "false";
      });

      // Sort by category → group → sort_order
      published.sort((a, b) => {
        const ca = a.fields.category || "", cb = b.fields.category || "";
        if (ca !== cb) return ca.localeCompare(cb);
        const ga = a.fields.group || "", gb = b.fields.group || "";
        if (ga !== gb) return ga.localeCompare(gb);
        return (Number(a.fields.sort_order) || 0) - (Number(b.fields.sort_order) || 0);
      });

      const items = published.map((r) => ({
        category:  r.fields.category  || "",
        group:     r.fields.group     || "",
        sortOrder: Number(r.fields.sort_order ?? 0),
        title:     r.fields.title     || "",
        body:      r.fields.body      || "",
        image:     r.fields.image_url || "",
        link:      r.fields.link      || "",
        shape:     r.fields.shape_key || "",
      }));

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
        body: JSON.stringify(items),
      };
    }
  } catch (err) {
    console.error("airtable-proxy error:", err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
