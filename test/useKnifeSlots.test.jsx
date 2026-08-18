// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useKnifeSlots } from "../src/hooks/useKnifeSlots.js";
import { buildSteelIndex } from "../src/lib/steel-match.js";
import { buildSteelsMap } from "./fixtures/steels.js";
import * as api from "../src/lib/api.js";

const index = buildSteelIndex(buildSteelsMap());

/** A product whose search + fetch can be delayed by a controllable amount. */
const product = (title, handle) => ({
  title, handle, tags: ["VG-10"], body_html: "<p>Knife.</p>",
  variants: [{ price: "10000" }], images: [{ src: "i.jpg" }],
  product_type: "Gyuto", vendor: "Musashi",
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  api.__clearCache();
  vi.restoreAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("useKnifeSlots", () => {
  it("resolves a steel name into a steel-only card", async () => {
    vi.spyOn(api, "searchProducts").mockResolvedValue([]);
    const { result } = renderHook(() => useKnifeSlots({ index }));

    await act(async () => { await result.current.search(0, "VG-10"); });

    await waitFor(() => expect(result.current.slots[0].knife).toBeTruthy());
    expect(result.current.slots[0].knife.steel.label).toBe("VG-10");
    expect(result.current.slots[0].loading).toBe(false);
  });

  it("offers candidates instead of guessing when the query is ambiguous", async () => {
    vi.spyOn(api, "searchProducts").mockResolvedValue([
      { title: "Gyuto 210mm Kurouchi", handle: "a", type: "Gyuto", vendor: "M" },
      { title: "Gyuto 210mm Damascus", handle: "b", type: "Gyuto", vendor: "M" },
    ]);
    const { result } = renderHook(() => useKnifeSlots({ index }));

    await act(async () => { await result.current.search(0, "gyuto 210"); });

    await waitFor(() => expect(result.current.slots[0].candidates).toBeTruthy());
    expect(result.current.slots[0].candidates.length).toBe(2);
    expect(result.current.slots[0].knife).toBeNull();
  });

  it("loads the knife the user picks from the candidate list", async () => {
    vi.spyOn(api, "searchProducts").mockResolvedValue([
      { title: "Gyuto 210mm Kurouchi", handle: "a", type: "Gyuto", vendor: "M" },
      { title: "Gyuto 210mm Damascus", handle: "b", type: "Gyuto", vendor: "M" },
    ]);
    vi.spyOn(api, "fetchProduct").mockImplementation(async (h) =>
      product(h === "b" ? "Gyuto 210mm Damascus" : "Gyuto 210mm Kurouchi", h));

    const { result } = renderHook(() => useKnifeSlots({ index }));
    await act(async () => { await result.current.search(0, "gyuto 210"); });
    await waitFor(() => expect(result.current.slots[0].candidates).toBeTruthy());

    const chosen = result.current.slots[0].candidates.find((c) => c.product?.handle === "b");
    await act(async () => { await result.current.choose(0, chosen); });

    await waitFor(() => expect(result.current.slots[0].knife).toBeTruthy());
    expect(result.current.slots[0].knife.title).toBe("Gyuto 210mm Damascus");
    expect(result.current.slots[0].candidates).toBeNull();
  });

  it("ignores a slow earlier search when a newer one has been started", async () => {
    // THE RACE. The old fetchKnife issued requests with no AbortSignal and no
    // request id, so two searches in one slot both wrote their result and the
    // slower one won by arriving last. The panel then showed a knife the user had
    // already searched past, with no error and no way to notice.
    vi.spyOn(api, "searchProducts").mockImplementation(async (q) => {
      if (q === "slow") { await wait(120); return [{ title: "SLOW RESULT", handle: "slow", type: "", vendor: "" }]; }
      await wait(5);
      return [{ title: "FAST RESULT", handle: "fast", type: "", vendor: "" }];
    });
    vi.spyOn(api, "fetchProduct").mockImplementation(async (h) =>
      product(h === "slow" ? "SLOW RESULT" : "FAST RESULT", h));

    const { result } = renderHook(() => useKnifeSlots({ index }));

    await act(async () => {
      const slow = result.current.search(0, "slow");
      await wait(10);
      const fast = result.current.search(0, "fast");
      await Promise.all([slow, fast]);
      await wait(200);
    });

    await waitFor(() => expect(result.current.slots[0].loading).toBe(false));
    const state = result.current.slots[0];
    const shown = state.knife?.title ?? state.candidates?.[0]?.label;
    expect(shown).toBe("FAST RESULT");
  });

  it("keeps slots independent of one another", async () => {
    vi.spyOn(api, "searchProducts").mockResolvedValue([]);
    const { result } = renderHook(() => useKnifeSlots({ index }));

    await act(async () => {
      await result.current.search(0, "VG-10");
      await result.current.search(1, "ZDP-189");
    });

    await waitFor(() => expect(result.current.slots[1].knife).toBeTruthy());
    expect(result.current.slots[0].knife.steel.label).toBe("VG-10");
    expect(result.current.slots[1].knife.steel.label).toBe("ZDP-189");
  });

  it("surfaces a specific error rather than an empty panel", async () => {
    vi.spyOn(api, "searchProducts").mockResolvedValue([]);
    const { result } = renderHook(() => useKnifeSlots({ index }));

    await act(async () => { await result.current.search(0, "zzz qqq"); });

    await waitFor(() => expect(result.current.slots[0].error).toBeTruthy());
    expect(result.current.slots[0].error).toMatch(/musashihamono\.com/);
    expect(result.current.slots[0].loading).toBe(false);
  });

  it("does not search an empty box", async () => {
    const search = vi.spyOn(api, "searchProducts").mockResolvedValue([]);
    const { result } = renderHook(() => useKnifeSlots({ index }));
    await act(async () => { await result.current.search(0, "   "); });
    expect(search).not.toHaveBeenCalled();
  });

  it("clears a slot completely when removed", async () => {
    vi.spyOn(api, "searchProducts").mockResolvedValue([]);
    const { result } = renderHook(() => useKnifeSlots({ index, initialCount: 3 }));

    await act(async () => { await result.current.search(2, "VG-10"); });
    await waitFor(() => expect(result.current.slots[2].knife).toBeTruthy());

    act(() => { result.current.removeSlot(2); });

    expect(result.current.slots[2].knife).toBeNull();
    expect(result.current.slots[2].input).toBe("");
    expect(result.current.count).toBe(2);
  });

  it("adds a third slot without disturbing the first two", async () => {
    vi.spyOn(api, "searchProducts").mockResolvedValue([]);
    const { result } = renderHook(() => useKnifeSlots({ index }));

    await act(async () => { await result.current.search(0, "VG-10"); });
    await waitFor(() => expect(result.current.slots[0].knife).toBeTruthy());

    act(() => { result.current.addSlot(); });

    expect(result.current.count).toBe(3);
    expect(result.current.slots[0].knife.steel.label).toBe("VG-10");
  });
});
