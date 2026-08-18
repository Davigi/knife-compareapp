/**
 * steel-data.js — the single boundary where raw steel records become app data
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every steel record in the system passes through here, whichever direction it
 * came from: Airtable (via the Netlify proxy), scripts/steels.csv (via the build
 * scripts), or a test fixture. One normalisation path means the browser and the
 * server can no longer disagree about what a steel record is — which is how the
 * "charts render tiny bars" bug survived a deploy.
 *
 * THE BUG THIS EXISTS TO KILL
 * ---------------------------
 * Scores were migrated from a 0–10 scale to a 0–100 scale in the CSV, but
 * Airtable still held the old 0–10 values, and the proxy's ×10 bridge had been
 * removed. Nothing in the pipeline knew what scale it was holding, so 0–10 data
 * flowed into a UI that assumed 0–100 and every bar rendered at a tenth of its
 * length. No error, no warning — just quietly wrong charts.
 *
 * `detectScoreScale()` below removes that whole class of failure: the scale is
 * inferred from the data itself and normalised on arrival. Loading legacy 0–10
 * Airtable rows now produces correct charts *without* re-importing anything.
 *
 * WHERE SCORES COME FROM
 * ----------------------
 * Composition is the real data; the four performance scores are derived from it
 * by src/lib/steel-science.js. Stored score columns are treated as a fallback for
 * records too sparse to model, not as the source of truth. That inverts the old
 * arrangement, in which the scores were authoritative and drifted freely from the
 * chemistry printed next to them.
 */

import { scoreSteel, parseHrc, readComposition, METRIC_KEYS } from "./steel-science.js";

/** Metrics every steel record must expose, on a 0–100 scale. */
export { METRIC_KEYS };

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * Infer the score scale used by a batch of records.
 *
 * Returns the multiplier needed to bring them to 0–100. Deciding per-batch rather
 * than per-value matters: a single record scoring 8 is ambiguous, but a whole
 * table whose maximum is 10 is unambiguously the legacy scale.
 *
 * @param {Array<object>} rows raw records (Airtable fields or CSV rows)
 * @returns {{multiplier: 1|10, scale: '0-100'|'0-10', max: number, sampled: number}}
 */
export function detectScoreScale(rows = []) {
  let max = 0;
  let sampled = 0;
  for (const row of rows) {
    for (const key of METRIC_KEYS) {
      const v = num(row?.[key]);
      if (v == null) continue;
      sampled++;
      if (v > max) max = v;
    }
  }
  // Nothing to go on: assume the current scale rather than silently scaling.
  if (!sampled) return { multiplier: 1, scale: "0-100", max: 0, sampled: 0 };
  const legacy = max > 0 && max <= 10;
  return { multiplier: legacy ? 10 : 1, scale: legacy ? "0-10" : "0-100", max, sampled };
}

const clamp100 = (v) => Math.min(100, Math.max(0, v));

/**
 * Normalise one raw steel row into the canonical app record.
 *
 * @param {object} row              raw CSV row or Airtable `fields` object
 * @param {object} [opts]
 * @param {number} [opts.scoreMultiplier=1]  from detectScoreScale()
 * @param {boolean} [opts.preferStored=false] use stored scores even when the
 *        composition is modellable (used by the migration script to diff old vs new)
 * @returns {object|null} canonical record, or null if the row has no usable label
 */
export function normaliseSteelRecord(row = {}, opts = {}) {
  const { scoreMultiplier = 1, preferStored = false } = opts;

  const label = String(row.label ?? "").trim();
  if (!label) return null;

  const aliases = String(row.aliases ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const comp = readComposition(row);
  const modellable = comp.C > 0;

  // Stored scores, brought onto the 0–100 scale and clamped.
  const stored = {};
  let storedCount = 0;
  for (const key of METRIC_KEYS) {
    const v = num(row[key]);
    if (v == null) { stored[key] = null; continue; }
    stored[key] = clamp100(v * scoreMultiplier);
    storedCount++;
  }

  let scores, scoreSource, confidence, hrcEstimated, science = null;
  if (modellable && !preferStored) {
    science = scoreSteel(row);
    scores = Object.fromEntries(METRIC_KEYS.map((k) => [k, clamp100(science[k])]));
    scoreSource = "computed";
    confidence = science.confidence;
    hrcEstimated = science.hrcEstimated;
  } else {
    scores = Object.fromEntries(METRIC_KEYS.map((k) => [k, stored[k]]));
    scoreSource = storedCount ? "curated" : "unknown";
    confidence = storedCount === METRIC_KEYS.length ? "medium" : "low";
    hrcEstimated = parseHrc(row.hrc) == null;
  }

  // A record missing any metric cannot be charted; the UI must be able to tell.
  const complete = METRIC_KEYS.every((k) => typeof scores[k] === "number" && Number.isFinite(scores[k]));

  // Composition display map, empty values omitted so the profile card stays clean.
  const compDisplay = {};
  const COMP_COLUMNS = {
    C: "c_pct", Cr: "cr_pct", Mo: "mo_pct", V: "v_pct",
    W: "w_pct", Co: "co_pct", Mn: "mn_pct", Si: "si_pct", Other: "other_comp",
  };
  for (const [el, col] of Object.entries(COMP_COLUMNS)) {
    if (row[col]) compDisplay[el] = row[col];
  }

  return {
    label,
    aliases,
    cat: String(row.category ?? row.cat ?? "").trim(),
    maker: String(row.maker ?? "").trim(),
    hrc: String(row.hrc ?? "").trim(),
    desc: String(row.description ?? row.desc ?? "").trim(),
    comp: compDisplay,
    composition: comp,
    ...scores,
    scoreSource,
    confidence,
    hrcEstimated,
    complete,
    powderMetallurgy: science?.powderMetallurgy ?? /\bPM\b/i.test(String(row.category ?? "")),
    available: String(row.available ?? "true").trim().toLowerCase() !== "false",
  };
}

/**
 * Normalise a whole batch: detect the scale once, then map.
 * Also returns anything that failed validation, so callers can log rather than
 * silently ship a broken record.
 *
 * @returns {{records: Array, scale: object, rejected: Array, incomplete: Array}}
 */
export function normaliseSteelBatch(rows = [], opts = {}) {
  const scale = detectScoreScale(rows);
  const records = [];
  const rejected = [];
  const incomplete = [];

  for (const row of rows) {
    const rec = normaliseSteelRecord(row, { ...opts, scoreMultiplier: scale.multiplier });
    if (!rec) { rejected.push({ row, reason: "missing label" }); continue; }
    if (!rec.complete) incomplete.push(rec.label);
    records.push(rec);
  }
  return { records, scale, rejected, incomplete };
}

/**
 * Build the `{ [name]: record }` map the client indexes, from normalised records.
 * Only available records are included, matching the previous proxy behaviour.
 */
export function toSteelMap(records = []) {
  const map = {};
  for (const rec of records) {
    if (!rec.available) continue;
    map[rec.label] = rec;
    for (const alias of rec.aliases) if (!map[alias]) map[alias] = rec;
  }
  return map;
}
