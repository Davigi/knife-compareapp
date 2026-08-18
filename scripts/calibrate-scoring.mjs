/**
 * calibrate-scoring.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Fits the scaling constants in src/lib/steel-science.js against the 31
 * hand-curated steels in scripts/steels.csv, then reports whether the resulting
 * model actually fixes the two structural defects it was written to fix:
 *
 *   • are the four metrics still collinear?  (old r(retention, sharpening) = -0.957)
 *   • is chip resistance still effectively a constant?  (old: 70 for 984/1003 rows)
 *
 * The *shape* of each formula is metallurgy and is not fitted. Only the scaling
 * constants are. Run:
 *
 *     node scripts/calibrate-scoring.mjs            # report fit, don't write
 *     node scripts/calibrate-scoring.mjs --write    # patch COEF in steel-science.js
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readCsvObjects } from "./lib/csv.mjs";
import { COEF, scoreSteel, parseHrc } from "../src/lib/steel-science.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const METRICS = ["retention", "sharpening", "chip", "corrosion"];

const { records } = readCsvObjects(readFileSync(join(ROOT, "scripts/steels.csv"), "utf8"));

/**
 * Calibration must fit against the ORIGINAL hand-assigned scores, never against
 * whatever is currently in steels.csv. Once rescore-steels.mjs has run, that file
 * holds the model's own output — fitting to it would be fitting the model to
 * itself and would report a perfect, meaningless result.
 *
 * rescore-steels.mjs freezes the pre-rescore curated rows into
 * steels-curated-reference.csv on its first run; prefer that whenever it exists.
 */
const REFERENCE = join(ROOT, "scripts/steels-curated-reference.csv");
let curatedSource = records;
let sourceName = "scripts/steels.csv";
try {
  curatedSource = readCsvObjects(readFileSync(REFERENCE, "utf8")).records;
  sourceName = "scripts/steels-curated-reference.csv (frozen originals)";
} catch { /* not yet frozen — steels.csv still holds the originals */ }

const curated = curatedSource.filter(
  (r) => String(r.available).toLowerCase() !== "false" && parseHrc(r.hrc) != null
);

console.log(`Loaded ${records.length} steels; ${curated.length} curated rows from ${sourceName}.\n`);

// ─── Statistics helpers ──────────────────────────────────────────────────────
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function pearson(a, b) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
const rmse = (a, b) => Math.sqrt(mean(a.map((v, i) => (v - b[i]) ** 2)));
function r2(actual, pred) {
  const m = mean(actual);
  const ssTot = actual.reduce((s, v) => s + (v - m) ** 2, 0);
  const ssRes = actual.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0);
  return ssTot ? 1 - ssRes / ssTot : 0;
}

// ─── Coordinate descent over the tunable constants ───────────────────────────
/** Each entry: [path, initialStep, lowerBound, upperBound] */
const KNOBS = [
  ["retention.intercept", 8, -40, 60], ["retention.wear", 4, 2, 45], ["retention.hrc", 0.8, 0, 8],
  ["sharpening.intercept", 8, 60, 180], ["sharpening.abrasion", 4, 2, 45], ["sharpening.hrc", 0.8, 0, 8],
  ["chip.intercept", 8, 60, 180], ["chip.hrc", 0.8, 0, 8], ["chip.hrcPow", 0.15, 0.8, 2.0], ["chip.brittle", 0.4, 0, 5],
  ["corrosion.midpoint", 2, 2, 26], ["corrosion.width", 1, 1, 12],
];

const get = (p) => p.split(".").reduce((o, k) => o[k], COEF);
const set = (p, v) => { const ks = p.split("."); const last = ks.pop(); ks.reduce((o, k) => o[k], COEF)[last] = v; };

/**
 * Which curated rows carry real signal for each metric.
 *
 * `chip` was the fallback constant 70 for 984 of 1003 rows, including 12 of the
 * 31 curated ones. Those 12 are not expert judgements, they are a default. Fitting
 * against them drags the chip coefficients toward flat and produces an axis with
 * almost no spread — which is exactly the defect we are trying to remove. So the
 * chip fit uses only rows where a human actually chose a value.
 */
const FIT_MASK = {
  retention: () => true,
  sharpening: () => true,
  corrosion: () => true,
  chip: (r) => Number(r.chip) !== 70,
};
const fitRows = Object.fromEntries(
  METRICS.map((m) => [m, curated.map((r, i) => (FIT_MASK[m](r) ? i : -1)).filter((i) => i >= 0)])
);
console.log(
  "Rows contributing to each fit: " +
  METRICS.map((m) => `${m} ${fitRows[m].length}`).join(", ") +
  `  (chip drops ${curated.length - fitRows.chip.length} placeholder-70 rows)\n`
);

/** Total loss = mean RMSE across the four metrics, over signal-bearing rows only. */
function loss() {
  const scored = curated.map(scoreSteel);
  let total = 0;
  for (const m of METRICS) {
    const idx = fitRows[m];
    const actual = idx.map((i) => Number(curated[i][m]));
    const pred = idx.map((i) => scored[i][m]);
    total += rmse(actual, pred);
  }
  return total / METRICS.length;
}

let best = loss();
console.log(`Initial mean RMSE: ${best.toFixed(3)}`);

const steps = Object.fromEntries(KNOBS.map(([p, s]) => [p, s]));
for (let pass = 0; pass < 220; pass++) {
  let improved = false;
  for (const [path, , lo, hi] of KNOBS) {
    const cur = get(path);
    for (const dir of [1, -1]) {
      const next = Math.min(hi, Math.max(lo, cur + dir * steps[path]));
      if (next === cur) continue;
      set(path, next);
      const l = loss();
      if (l < best - 1e-9) { best = l; improved = true; break; }
      set(path, cur);
    }
  }
  if (!improved) {
    let anyShrunk = false;
    for (const [path] of KNOBS) {
      if (steps[path] > 1e-4) { steps[path] /= 2; anyShrunk = true; }
    }
    if (!anyShrunk) break;
  }
}

console.log(`Fitted  mean RMSE: ${best.toFixed(3)}\n`);

// ─── Fit quality per metric, against the curated set ─────────────────────────
const scored = curated.map(scoreSteel);
console.log("Fit against the 31 curated steels");
console.log("  metric        RMSE     R²     (curated scores are decile-rounded, so RMSE ~8 is at the noise floor)");
for (const m of METRICS) {
  const idx = fitRows[m];
  const actual = idx.map((i) => Number(curated[i][m]));
  const pred = idx.map((i) => scored[i][m]);
  console.log(`  ${m.padEnd(12)} ${rmse(actual, pred).toFixed(2).padStart(6)}  ${r2(actual, pred).toFixed(3).padStart(6)}   n=${idx.length}`);
}

// ─── The real test: are the axes independent now? ────────────────────────────
const all = records.map(scoreSteel);
console.log("\nCorrelation between metrics across all " + records.length + " steels (new model)");
console.log("               " + METRICS.map((m) => m.slice(0, 7).padStart(8)).join(""));
for (const a of METRICS) {
  const row = METRICS.map((b) => pearson(all.map((s) => s[a]), all.map((s) => s[b])).toFixed(2).padStart(8)).join("");
  console.log("  " + a.padEnd(12) + row);
}

const oldRet = records.map((r) => Number(r.retention));
const oldSh = records.map((r) => Number(r.sharpening));
console.log(`\n  OLD r(retention, sharpening) = ${pearson(oldRet, oldSh).toFixed(3)}   ← two axes, one number`);
console.log(`  NEW r(retention, sharpening) = ${pearson(all.map((s) => s.retention), all.map((s) => s.sharpening)).toFixed(3)}`);

// ─── Is chip still a constant? ───────────────────────────────────────────────
const distinct = (arr) => new Set(arr.map((v) => Math.round(v))).size;
console.log("\nDistinct values across all steels (a chart axis needs spread to mean anything)");
for (const m of METRICS) {
  const oldVals = records.map((r) => Number(r[m]));
  console.log(`  ${m.padEnd(12)} old ${String(distinct(oldVals)).padStart(4)} distinct → new ${String(distinct(all.map((s) => s[m]))).padStart(4)}`);
}
const oldChipMode = records.filter((r) => Number(r.chip) === 70).length;
const newChipSpread = all.map((s) => s.chip);
console.log(`\n  chip: old value 70 covered ${oldChipMode}/${records.length} rows (${((oldChipMode / records.length) * 100).toFixed(0)}%)`);
console.log(`        new range ${Math.min(...newChipSpread).toFixed(1)} – ${Math.max(...newChipSpread).toFixed(1)}, sd ${Math.sqrt(mean(newChipSpread.map((v) => (v - mean(newChipSpread)) ** 2))).toFixed(1)}`);

// ─── Biggest disagreements with the curated set, for human review ────────────
console.log("\nLargest disagreements with curated values (review these by hand)");
const deltas = curated.map((r, i) => ({
  label: r.label,
  worst: Math.max(...METRICS.map((m) => Math.abs(Number(r[m]) - scored[i][m]))),
  detail: METRICS.map((m) => `${m.slice(0, 4)} ${r[m]}→${scored[i][m]}`).join("  "),
})).sort((a, b) => b.worst - a.worst).slice(0, 8);
for (const d of deltas) console.log(`  ${d.label.padEnd(24)} Δ${d.worst.toFixed(0).padStart(3)}  ${d.detail}`);

// ─── Emit ────────────────────────────────────────────────────────────────────
const block = `export const COEF = {
  hrc: { intercept: ${COEF.hrc.intercept}, cMatrix: ${COEF.hrc.cMatrix}, alloy: ${COEF.hrc.alloy}, pm: ${COEF.hrc.pm} },
  retention: { intercept: ${+COEF.retention.intercept.toFixed(3)}, wear: ${+COEF.retention.wear.toFixed(3)}, hrc: ${+COEF.retention.hrc.toFixed(3)} },
  sharpening: { intercept: ${+COEF.sharpening.intercept.toFixed(3)}, abrasion: ${+COEF.sharpening.abrasion.toFixed(3)}, hrc: ${+COEF.sharpening.hrc.toFixed(3)} },
  chip: { intercept: ${+COEF.chip.intercept.toFixed(3)}, hrc: ${+COEF.chip.hrc.toFixed(3)}, hrcPow: ${+COEF.chip.hrcPow.toFixed(3)}, brittle: ${+COEF.chip.brittle.toFixed(3)} },
  corrosion: { midpoint: ${+COEF.corrosion.midpoint.toFixed(3)}, width: ${+COEF.corrosion.width.toFixed(3)} },
};`;

console.log("\n" + block);

if (process.argv.includes("--write")) {
  const p = join(ROOT, "src/lib/steel-science.js");
  const src = readFileSync(p, "utf8");
  const patched = src.replace(/export const COEF = \{[\s\S]*?\n\};/, block);
  if (patched === src) { console.error("\n✗ Could not locate the COEF block to patch."); process.exit(1); }
  writeFileSync(p, patched);
  console.log(`\n✓ Wrote fitted coefficients to ${p}`);
}
