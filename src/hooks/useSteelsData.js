import { useEffect, useMemo, useState } from "react";
import { fetchSteels } from "../lib/api.js";
import { buildSteelIndex } from "../lib/steel-match.js";
import { medianSteel } from "../lib/chart.js";

/**
 * useSteelsData — load the steel database and build the lookup index once.
 *
 * This was previously inline in App.jsx: a `useEffect` that fetched both Airtable
 * resources together, plus a `useMemo` that rebuilt `steelPairs` as
 * `Object.entries(steelsData).map(...).sort(...)`. Two problems with that:
 *
 *   • The steels and the knowledge base were fetched in one `Promise.all`, so a
 *     knowledge-base failure took the comparison chart down with it even though
 *     the two are unrelated.
 *   • Errors were logged to the console and nowhere else. If Airtable was
 *     misconfigured, the app rendered an empty comparison with no explanation —
 *     which is indistinguishable from "no steel was detected".
 *
 * Loading is independent here, and the failure is returned so the UI can say so.
 */
export function useSteelsData() {
  const [steels, setSteels] = useState({});
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    (async () => {
      try {
        const { steels: data, meta: info } = await fetchSteels({ signal: controller.signal });
        if (!live) return;
        setSteels(data);
        setMeta(info);
        setStatus("ready");
        if (info?.rescaled) {
          console.warn(
            `Steel scores arrived on the legacy ${info.scoreScale} scale and were rescaled to 0–100. ` +
            "Re-import scripts/steels.csv into Airtable to remove this fallback."
          );
        }
      } catch (err) {
        if (!live || err?.name === "AbortError") return;
        setError(err.message || "Could not load steel data.");
        setStatus("error");
      }
    })();

    return () => { live = false; controller.abort(); };
  }, []);

  // Built once per data load, not per render.
  const index = useMemo(() => buildSteelIndex(steels), [steels]);

  const records = useMemo(() => {
    const seen = new Map();
    for (const steel of Object.values(steels)) {
      if (steel?.label && !seen.has(steel.label)) seen.set(steel.label, steel);
    }
    return [...seen.values()];
  }, [steels]);

  /** Median steel, drawn as the chart's reference outline. */
  const reference = useMemo(() => medianSteel(records), [records]);

  return { steels, records, index, reference, meta, status, error };
}
