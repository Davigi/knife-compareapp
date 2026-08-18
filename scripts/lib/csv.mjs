/**
 * csv.mjs — minimal RFC-4180 CSV reader/writer.
 *
 * steels.csv contains quoted fields with embedded commas ("white steel 3,shirogami 3")
 * and em/en dashes, so a naive split(",") corrupts the data. This handles quoting,
 * escaped quotes, CRLF, and a UTF-8 BOM.
 */

export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Parse into objects keyed by the header row. */
export function readCsvObjects(text) {
  const rows = parseCsv(text).filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] ?? ""; });
    return o;
  });
  return { header, records };
}

const escapeCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeCsv(header, records) {
  const lines = [header.map(escapeCell).join(",")];
  for (const r of records) lines.push(header.map((h) => escapeCell(r[h])).join(","));
  return lines.join("\n") + "\n";
}
