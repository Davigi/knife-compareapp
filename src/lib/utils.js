/**
 * utils.js — small browser-side helpers.
 *
 * This file used to hold the steel matcher, the chart scaling maths, the
 * knowledge-base grouping and the API call for feedback, all together. Those have
 * moved to modules that own one concern each:
 *
 *   detectSteel, matchesSteelKey, norm, isUrl, extractHandle → lib/steel-match.js
 *   computeRanges, scaleFrac                                 → lib/chart.js
 *   buildInfoMap                                             → hooks/useKnowledgeBase.js
 *   postNote                                                 → stays here (see below)
 *
 * `computeRanges` and `scaleFrac` are gone rather than relocated: they implemented
 * the relative chart scaling that made the radar chart unreadable. lib/chart.js
 * documents what they did and why absolute scaling replaced them.
 */

import { useState, useEffect } from "react";

// ─── Formatting ──────────────────────────────────────────────────────────────

export const fmtPrice = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : "—");

// ─── HTML helpers ────────────────────────────────────────────────────────────

/** Extract label/value rows from a Shopify description. */
export function parseSpecs(html) {
  if (!html || typeof DOMParser === "undefined") return [];
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
      const text = el.textContent.trim();
      const m = text.match(/^([A-Za-z][^:]{1,40}):\s*(.+)$/);
      if (m) specs.push({ label: m[1].trim(), value: m[2].trim() });
    });
  }
  return specs;
}

export function htmlToText(html) {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return String(html).replace(/<[^>]*>/g, " ");
  return new DOMParser().parseFromString(html, "text/html").body.textContent || "";
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export async function postNote({ product, handle, issueType, comment, reporter }) {
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
}

// ─── Responsive ──────────────────────────────────────────────────────────────

export function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}
