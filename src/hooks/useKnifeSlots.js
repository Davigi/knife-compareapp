import { useCallback, useRef, useState, useEffect } from "react";
import * as api from "../lib/api.js";
import { resolveQuery, materialise } from "../lib/resolve.js";

/**
 * useKnifeSlots — all per-slot comparison state.
 *
 * Replaces four parallel arrays in App.jsx (`knives`, `inputs`, `loading`,
 * `errors`) mutated through a shared `setArr(setter, i, val)` helper. Beyond being
 * hard to follow, that arrangement had a concrete defect: `fetchKnife` never
 * cancelled anything, so two searches in the same slot raced and the slower one
 * won by arriving last. The panel then showed a knife the user had already
 * navigated away from, with no error and no way to tell.
 *
 * Each slot now owns an AbortController. Starting a search aborts the previous
 * one, and a late response for a superseded request is dropped rather than
 * rendered.
 */

const EMPTY_SLOT = {
  input: "",
  knife: null,
  loading: false,
  error: null,
  candidates: null,
  notice: null,
};

const makeSlots = (n) => Array.from({ length: n }, () => ({ ...EMPTY_SLOT }));

export function useKnifeSlots({ index, maxSlots = 3, initialCount = 2 } = {}) {
  const [slots, setSlots] = useState(() => makeSlots(maxSlots));
  const [count, setCount] = useState(initialCount);

  // One controller and one request id per slot, so late responses can be ignored.
  const controllers = useRef(makeSlots(maxSlots).map(() => null));
  const requestIds = useRef(new Array(maxSlots).fill(0));

  useEffect(() => () => controllers.current.forEach((c) => c?.abort()), []);

  const patch = useCallback((i, changes) => {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...changes };
      return next;
    });
  }, []);

  const setInput = useCallback((i, value) => patch(i, { input: value }), [patch]);

  /** Begin a request for slot `i`, cancelling whatever it was doing. */
  const begin = useCallback((i) => {
    controllers.current[i]?.abort();
    const controller = new AbortController();
    controllers.current[i] = controller;
    const id = ++requestIds.current[i];
    patch(i, { loading: true, error: null, candidates: null, notice: null });
    return { controller, id, current: () => requestIds.current[i] === id };
  }, [patch]);

  /** Run the resolver for whatever is currently typed in slot `i`. */
  const search = useCallback(async (i, overrideQuery) => {
    const query = overrideQuery ?? slots[i]?.input ?? "";
    if (!String(query).trim()) return;
    if (overrideQuery != null) patch(i, { input: overrideQuery });

    const { controller, id, current } = begin(i);

    try {
      const result = await resolveQuery(query, { index, api, signal: controller.signal });
      if (!current()) return;   // superseded by a newer search in this slot

      if (result.status === "resolved") {
        patch(i, { knife: result.knife, loading: false, error: null, candidates: null, notice: result.notice ?? null });
      } else if (result.status === "choose") {
        patch(i, { knife: null, loading: false, error: null, candidates: result.candidates, notice: result.notice ?? null });
      } else {
        patch(i, { knife: null, loading: false, error: result.error, candidates: null, notice: null });
      }
    } catch (err) {
      if (err?.name === "AbortError" || !current()) return;
      patch(i, { knife: null, loading: false, error: err.message || "Something went wrong.", candidates: null });
    }
    void id;
  }, [slots, index, begin, patch]);

  /** The user picked one of the offered candidates. */
  const choose = useCallback(async (i, candidate) => {
    const { controller, id, current } = begin(i);
    try {
      const knife = await materialise(candidate, { index, api, signal: controller.signal });
      if (!current()) return;
      patch(i, { knife, loading: false, error: null, candidates: null, input: knife.title ?? "" });
    } catch (err) {
      if (err?.name === "AbortError" || !current()) return;
      patch(i, { loading: false, error: err.message || "Could not load that item." });
    }
    void id;
  }, [begin, index, patch]);

  const clear = useCallback((i) => {
    controllers.current[i]?.abort();
    requestIds.current[i]++;
    setSlots((prev) => {
      const next = [...prev];
      next[i] = { ...EMPTY_SLOT };
      return next;
    });
  }, []);

  const addSlot = useCallback(() => setCount((c) => Math.min(maxSlots, c + 1)), [maxSlots]);
  const removeSlot = useCallback((i) => {
    clear(i);
    setCount((c) => Math.max(1, c - 1));
  }, [clear]);

  const visible = slots.slice(0, count);

  return { slots, visible, count, setInput, search, choose, clear, addSlot, removeSlot };
}
