/**
 * Test fixture: builds the exact `{ [name]: steelRecord }` shape that
 * airtable-proxy returns, straight from scripts/steels.csv — the source of truth.
 *
 * Using the real 31 available steels rather than a handful of invented ones means
 * the tests exercise the actual alias collisions in the dataset (r2/sg2/vg1/vg10),
 * which is where the search bugs actually lived.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readCsvObjects } from "../../scripts/lib/csv.mjs";
import { normaliseSteelRecord } from "../../src/lib/steel-data.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const { records } = readCsvObjects(readFileSync(join(ROOT, "scripts/steels.csv"), "utf8"));

export const allRows = records;
export const availableRows = records.filter((r) => String(r.available).toLowerCase() !== "false");

/** The map the client actually receives. */
export function buildSteelsMap(rows = availableRows) {
  const map = {};
  for (const row of rows) {
    const entry = normaliseSteelRecord(row);
    if (!entry) continue;
    map[entry.label] = entry;
    for (const alias of entry.aliases) if (!map[alias]) map[alias] = entry;
  }
  return map;
}

/** A realistic Musashi product shape for detection tests. */
export const product = ({ title = "", tags = [], body = "" } = {}) => ({ title, tags, body });
