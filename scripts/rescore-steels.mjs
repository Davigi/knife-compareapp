/**
 * rescore-steels.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Recomputes the four performance metrics for every steel in scripts/steels.csv
 * from its composition, using the model in src/lib/steel-science.js.
 *
 *     node scripts/rescore-steels.mjs           # dry run: report only
 *     node scripts/rescore-steels.mjs --write   # rewrite steels.csv + import file
 *
 * Outputs when --write is given:
 *
 *   scripts/steels.csv                  source of truth, scores updated in place
 *   scripts/airtable-steels-import.csv  same data, ready to import into Airtable
 *   scripts/rescore-audit.csv           old vs new per steel, for human review
 *
 * The column set is unchanged, so the Airtable schema does not need editing —
 * import the file and choose "update existing records" matched on `label`.
 *
 * NOTE ON THE SCALE BUG: Airtable currently holds the pre-migration 0–10 scores.
 * The app no longer depends on this import to render correctly — the proxy detects
 * the legacy scale and rescales on arrival (see src/lib/steel-data.js). Importing
 * this file removes the fallback and replaces the placeholder values; it is not an
 * emergency.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readCsvObjects, writeCsv } from "./lib/csv.mjs";
import { scoreSteel, METRIC_KEYS } from "../src/lib/steel-science.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = join(ROOT, "scripts/steels.csv");
const write = process.argv.includes("--write");

const { header, records } = readCsvObjects(readFileSync(CSV, "utf8"));
console.log(`Read ${records.length} steels from scripts/steels.csv\n`);

const audit = [];
const updated = records.map((row) => {
  const before = Object.fromEntries(METRIC_KEYS.map((k) => [k, Number(row[k])]));
  const s = scoreSteel(row);

  // Whole numbers: the extra decimal implied a precision the model does not have.
  const after = Object.fromEntries(METRIC_KEYS.map((k) => [k, Math.round(s[k])]));

  audit.push({
    label: row.label,
    available: row.available,
    confidence: s.confidence,
    hrc_estimated: s.hrcEstimated ? "yes" : "no",
    ...Object.fromEntries(METRIC_KEYS.flatMap((k) => [
      [`${k}_old`, Number.isFinite(before[k]) ? before[k] : ""],
      [`${k}_new`, after[k]],
      [`${k}_delta`, Number.isFinite(before[k]) ? after[k] - before[k] : ""],
    ])),
  });

  return { ...row, ...after };
});

// ─── Report ──────────────────────────────────────────────────────────────────
const availableAudit = audit.filter((a) => String(a.available).toLowerCase() !== "false");

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log("Change per metric across all steels");
for (const k of METRIC_KEYS) {
  const deltas = audit.map((a) => a[`${k}_delta`]).filter((d) => d !== "");
  const abs = deltas.map(Math.abs);
  console.log(
    `  ${k.padEnd(11)} mean Δ ${mean(deltas).toFixed(1).padStart(6)}   ` +
    `mean |Δ| ${mean(abs).toFixed(1).padStart(5)}   max |Δ| ${Math.max(...abs).toFixed(0).padStart(3)}`
  );
}

console.log(`\nLargest changes among the ${availableAudit.length} steels visible in the app`);
const ranked = [...availableAudit]
  .map((a) => ({ a, worst: Math.max(...METRIC_KEYS.map((k) => Math.abs(a[`${k}_delta`] || 0))) }))
  .sort((x, y) => y.worst - x.worst)
  .slice(0, 10);
for (const { a, worst } of ranked) {
  const detail = METRIC_KEYS.map((k) => `${k.slice(0, 4)} ${a[`${k}_old`]}→${a[`${k}_new`]}`).join("  ");
  console.log(`  ${a.label.padEnd(24)} Δ${String(worst).padStart(3)}  ${detail}`);
}

const lowConfidence = audit.filter((a) => a.confidence === "low");
if (lowConfidence.length) {
  console.log(`\n${lowConfidence.length} steels have too little chemistry to model confidently.`);
  console.log(`  e.g. ${lowConfidence.slice(0, 6).map((a) => a.label).join(", ")}`);
}

if (!write) {
  console.log("\nDry run. Re-run with --write to apply.");
  process.exit(0);
}

// ─── Write ───────────────────────────────────────────────────────────────────
//
// Freeze the hand-curated scores BEFORE overwriting them.
//
// Without this, rescoring destroys its own calibration target: scripts/
// calibrate-scoring.mjs fits the model against the curated values, so once those
// values are the model's own output, a re-run would fit the model to itself and
// report a perfect, meaningless score. The frozen copy is what calibration reads
// from here on, so the expert judgement stays an independent reference no matter
// how many times this script runs.
const REFERENCE = join(ROOT, "scripts/steels-curated-reference.csv");
let referenceExists = true;
try { readFileSync(REFERENCE); } catch { referenceExists = false; }

if (!referenceExists) {
  const curated = records.filter((r) => String(r.available).toLowerCase() !== "false");
  writeFileSync(REFERENCE, writeCsv(header, curated), "utf8");
  console.log(`\n✓ scripts/steels-curated-reference.csv written — ${curated.length} original hand-scored steels,`);
  console.log("  frozen as the calibration target. Do not regenerate this file.");
} else {
  console.log("\n· scripts/steels-curated-reference.csv already exists; left untouched.");
}

writeFileSync(CSV, writeCsv(header, updated), "utf8");
console.log(`✓ scripts/steels.csv updated (${updated.length} rows)`);

const importPath = join(ROOT, "scripts/airtable-steels-import.csv");
writeFileSync(importPath, writeCsv(header, updated), "utf8");
console.log(`✓ scripts/airtable-steels-import.csv written — import with "update existing records" matched on label`);

const auditPath = join(ROOT, "scripts/rescore-audit.csv");
writeFileSync(auditPath, writeCsv(Object.keys(audit[0]), audit), "utf8");
console.log(`✓ scripts/rescore-audit.csv written — old vs new for every steel`);
