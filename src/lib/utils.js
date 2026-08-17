import { useState, useEffect } from "react";
import { METRICS } from "./constants.js";

// ── String / URL helpers ──────────────────────────────────────────────────────
export const isUrl = (v) =>
  v.includes("musashihamono.com") || v.startsWith("http");

export const fmtPrice = (n) =>
  isNaN(n) ? "—" : Math.round(n).toLocaleString();

export const extractHandle = (v) => {
  const t = v.trim();
  if (t.includes("/products/"))
    return t.split("/products/")[1].split("?")[0].split("/")[0];
  return t.split("?")[0];
};

export const norm = (s) =>
  s.toLowerCase().replace(/#/g, "").replace(/\s+/g, " ").trim();

// ── Steel detection ───────────────────────────────────────────────────────────
// True if `inputNorm` appears as a whole word within `key` (or is an exact match).
// Minimum 3 chars to avoid single/double-char noise.
// "strix"    → matches key "spg strix"  ✓
// "xeos"     → matches key "vg xeos"    ✓
// "sg2"      → matches key "sg2"        ✓  (exact)
// "h1001"    → does NOT match key "h1"  ✓  ("h1" not found in "h1001"… wait wrong direction)
// Note: we search for inputNorm *inside* key, so "h1001" can never appear inside "h1".
export const matchesSteelKey = (key, inputNorm) => {
  if (key === inputNorm) return true;
  if (inputNorm.length < 3) return false;
  const idx = key.indexOf(inputNorm);
  if (idx === -1) return false;
  const before = idx === 0 || !/[a-z0-9]/.test(key[idx - 1]);
  const after  = idx + inputNorm.length >= key.length || !/[a-z0-9]/.test(key[idx + inputNorm.length]);
  return before && after;
};
// steelPairs: [normalizedKey, steelObject][] sorted longest-first
// Word-boundary check: short keys (≤4 chars) must not be adjacent to alphanumeric chars
// e.g. "m2" must not match inside "m2240" or "sg2model"
const wordMatch = (src, key) => {
  const idx = src.indexOf(key);
  if (idx === -1) return false;
  if (key.length > 4) return true; // long keys: substring is fine
  const before = idx === 0             || !/[a-z0-9]/.test(src[idx - 1]);
  const after  = idx + key.length >= src.length || !/[a-z0-9]/.test(src[idx + key.length]);
  return before && after;
};

export const detectSteel = (tags = [], title = "", body = "", steelPairs = []) => {
  // Pass 1 — tags + title (all key lengths, word-boundary guarded for short keys)
  const srcMain = norm([...tags, title].join(" "));
  for (const [key, val] of steelPairs) {
    if (wordMatch(srcMain, key)) return val;
  }
  // Pass 2 — body HTML (min 3 chars, word-boundary guarded)
  const srcBody = norm(body);
  for (const [key, val] of steelPairs) {
    if (key.length >= 3 && wordMatch(srcBody, key)) return val;
  }
  return null;
};

// ── Product data helpers ──────────────────────────────────────────────────────
export const parseSpecs = (html) => {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const specs = [];
  doc.querySelectorAll("tr").forEach((row) => {
    const cells = row.querySelectorAll("td,th");
    if (cells.length >= 2) {
      const label = cells[0].textContent.trim();
      const value = cells[1].textContent.trim();
      if (label && value && label.length < 60) specs.push({ label, value });
    }
  });
  if (specs.length === 0) {
    doc.querySelectorAll("p,li").forEach((el) => {
      const t = el.textContent.trim();
      const m = t.match(/^([A-Za-z][^:]{1,40}):\s*(.+)$/);
      if (m) specs.push({ label: m[1].trim(), value: m[2].trim() });
    });
  }
  return specs;
};

export const htmlToText = (html) => {
  if (!html) return "";
  return (
    new DOMParser().parseFromString(html, "text/html").body.textContent || ""
  );
};

// ── Chart scaling helpers ─────────────────────────────────────────────────────
export const computeRanges = (knives) => {
  const active = knives.filter((k) => k?.steel);
  return Object.fromEntries(
    METRICS.map((m) => {
      const vals = active.map((k) => k.steel[m]);
      if (vals.length <= 1) return [m, { lo: 0, hi: 100 }];
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      const pad = Math.max(5, (mx - mn) * 0.3);
      return [m, { lo: Math.max(0, mn - pad), hi: Math.min(100, mx + pad * 0.3) }];
    })
  );
};

export const scaleFrac = (v, lo, hi) => {
  const FLOOR = 0.15;
  if (hi <= lo) return 0.7;
  return FLOOR + ((v - lo) / (hi - lo)) * (1 - FLOOR);
};

// ── Airtable feedback ─────────────────────────────────────────────────────────
export const postNote = async ({ product, handle, issueType, comment, reporter }) => {
  const res = await fetch("/.netlify/functions/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product, handle, issueType, comment, reporter }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Server error ${res.status}`);
  }
  return res.json();
};

// ── Knowledge base map builder ────────────────────────────────────────────────
import { KB_HEADINGS } from "./constants.js";

export const buildInfoMap = (kbData) => {
  const map = {};
  for (const item of kbData) {
    if (!map[item.category]) {
      map[item.category] = {
        heading: KB_HEADINGS[item.category] || item.category,
        groups: [],
      };
    }
    let group = map[item.category].groups.find((g) => g.name === item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      map[item.category].groups.push(group);
    }
    group.items.push({
      n: item.title,
      d: item.body,
      img: item.image || "",
      link: item.link || "",
      shape: item.shape || "",
    });
  }
  return map;
};

// ── Responsive hook ───────────────────────────────────────────────────────────
export const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
};
