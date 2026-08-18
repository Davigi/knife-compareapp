import { useEffect, useMemo, useState } from "react";
import { fetchKnowledgeBase } from "../lib/api.js";
import { KB_HEADINGS } from "../lib/constants.js";

/**
 * useKnowledgeBase — knowledge-base content, grouped, plus full-text search.
 *
 * Extracted from App.jsx, where the fetch, the `infoMap` grouping and the search
 * filter were three separate pieces of inline state. Loading is now independent of
 * the steel fetch, so a knowledge-base outage no longer blanks the comparison.
 */

/** Group flat KB rows into `{ category: { heading, groups: [{ name, items }] } }`. */
export function buildInfoMap(items = []) {
  const map = {};
  for (const item of items) {
    const category = item.category || "General";
    if (!map[category]) {
      map[category] = { heading: KB_HEADINGS[category] || category, groups: [] };
    }
    let group = map[category].groups.find((g) => g.name === item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      map[category].groups.push(group);
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
}

/** Case-insensitive search across every entry's title and body. */
export function searchKb(infoMap, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return null;
  const out = [];
  for (const [cat, data] of Object.entries(infoMap)) {
    for (const group of data.groups) {
      for (const item of group.items) {
        const title = String(item.n ?? "").toLowerCase();
        const body = String(item.d ?? "").toLowerCase();
        if (title.includes(q) || body.includes(q)) {
          // Title hits are what the reader is usually looking for.
          out.push({ cat, group: group.name, ...item, _rank: title.includes(q) ? 0 : 1 });
        }
      }
    }
  }
  return out.sort((a, b) => a._rank - b._rank);
}

export function useKnowledgeBase() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    (async () => {
      try {
        const { items: data } = await fetchKnowledgeBase({ signal: controller.signal });
        if (!live) return;
        setItems(data);
        setStatus("ready");
      } catch (err) {
        if (!live || err?.name === "AbortError") return;
        setError(err.message || "Could not load the reference guide.");
        setStatus("error");
      }
    })();

    return () => { live = false; controller.abort(); };
  }, []);

  const infoMap = useMemo(() => buildInfoMap(items), [items]);
  const results = useMemo(() => searchKb(infoMap, query), [infoMap, query]);

  const sections = useMemo(() => {
    const keys = Object.keys(infoMap).length ? Object.keys(infoMap) : Object.keys(KB_HEADINGS);
    return keys.filter((k) => k !== "Wiki");
  }, [infoMap]);

  return { items, infoMap, sections, query, setQuery, results, status, error };
}
