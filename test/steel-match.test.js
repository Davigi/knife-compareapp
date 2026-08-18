import { describe, it, expect } from "vitest";
import {
  squash, tokenize, buildSteelIndex, detectSteel,
  findSteelCandidates, classifyQuery, extractHandle,
} from "../src/lib/steel-match.js";
import { buildSteelsMap, product } from "./fixtures/steels.js";

const steels = buildSteelsMap();
const index = buildSteelIndex(steels);

const labelOf = (r) => r.steel?.label ?? null;

describe("normalisation", () => {
  it("collapses every separator between a letter run and a digit run", () => {
    // The reason vg-10 and vg10 had to be hand-enumerated as separate aliases.
    for (const variant of ["VG-10", "VG 10", "vg10", "VG_10", "vg.10", "Vg – 10"]) {
      expect(squash(variant)).toBe("vg10");
    }
  });

  it("treats the Japanese # in steel names as decoration", () => {
    expect(tokenize("White Steel #2")).toEqual(tokenize("white steel 2"));
    expect(squash("White Steel #2")).toBe("whitesteel2");
  });

  it("keeps genuinely different designations apart", () => {
    expect(squash("VG-1")).not.toBe(squash("VG-10"));
    expect(squash("AUS-8")).not.toBe(squash("AUS-10"));
  });

  it("keeps token edges so a short key cannot fire inside a longer word", () => {
    expect(tokenize("Master2 Series")).toEqual(["master2", "series"]);
    expect(squash("SG 2 / R 2")).toBe("sg2r2");
  });
});

describe("detectSteel — the regressions that shipped", () => {
  it("resolves 4-character keys that the reverted word-boundary fix broke", () => {
    // Commit ee362ca reverted a boundary check because it broke aus8 and vg10.
    // Token matching has to handle both without the trade-off.
    expect(labelOf(detectSteel(product({ title: "Musashi AUS8 Gyuto 210mm" }), index))).toBe("AUS-8");
    expect(labelOf(detectSteel(product({ title: "Damascus VG10 Santoku" }), index))).toBe("VG-10");
    expect(labelOf(detectSteel(product({ title: "SG2 Powder Steel Bunka" }), index))).toBe("SG2 / R2");
  });

  it("does not fire a 2-character key on letters buried inside a word", () => {
    // The old `includes("r2")` matched anything containing those characters.
    const res = detectSteel(product({ title: "Master2 Series Chef Knife", body: "A fine blade." }), index);
    expect(res.steel).toBeNull();
  });

  it("distinguishes VG-1 from VG-10 regardless of spelling", () => {
    expect(labelOf(detectSteel(product({ title: "VG 10 Nashiji" }), index))).toBe("VG-10");
    expect(labelOf(detectSteel(product({ title: "VG 1 Kurouchi" }), index))).toBe("VG-1");
    expect(labelOf(detectSteel(product({ title: "VG1 Kurouchi" }), index))).toBe("VG-1");
  });

  it("prefers the more specific designation when both could match", () => {
    expect(labelOf(detectSteel(product({ title: "Aogami Super Kurouchi Gyuto" }), index))).toBe("Blue Super");
    expect(labelOf(detectSteel(product({ title: "Aogami 2 Kurouchi" }), index))).toBe("Blue Steel #2");
  });

  it("trusts tags over body text", () => {
    const res = detectSteel(product({
      tags: ["VG-10", "Damascus"],
      title: "Chef Knife",
      body: "Comparable in feel to White Steel #2, but stainless.",
    }), index);
    expect(labelOf(res)).toBe("VG-10");
    expect(res.source).toBe("tags");
  });

  it("reports confidence rather than presenting every guess as certain", () => {
    const strong = detectSteel(product({ tags: ["ZDP-189"], title: "ZDP-189 Gyuto" }), index);
    const weak = detectSteel(product({ title: "Chef Knife", body: "…the sld variant is also offered…" }), index);
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
    expect(strong.confidence).toBeGreaterThan(0.5);
  });

  it("flags genuine ambiguity instead of silently choosing", () => {
    const res = detectSteel(product({ tags: ["SLD", "SKD"], title: "Knife" }), index);
    expect(res.ambiguous).toBe(true);
    expect(res.alternatives.length).toBeGreaterThan(0);
  });

  it("returns null cleanly when no steel is named", () => {
    const res = detectSteel(product({ title: "Cutting Board", tags: ["accessory"], body: "Hinoki wood." }), index);
    expect(res.steel).toBeNull();
    expect(res.confidence).toBe(0);
  });

  it("survives empty and malformed input", () => {
    expect(detectSteel({}, index).steel).toBeNull();
    expect(detectSteel(product({}), index).steel).toBeNull();
    expect(detectSteel(product({ title: "VG-10" }), buildSteelIndex({})).steel).toBeNull();
    expect(detectSteel(null, index).steel).toBeNull();
  });
});

describe("findSteelCandidates — the steel-name shortcut", () => {
  it("resolves a partial name to its full designation", () => {
    // The behaviour commit c7e7f71 added; it must survive the rewrite.
    expect(findSteelCandidates("Strix", index)[0].steel.label).toBe("SPG STRIX");
    expect(findSteelCandidates("Xeos", index)[0].steel.label).toBe("VG XEOS");
  });

  it("matches an exact designation in any spelling", () => {
    for (const q of ["VG-10", "vg10", "VG 10"]) {
      const top = findSteelCandidates(q, index)[0];
      expect(top.steel.label).toBe("VG-10");
      expect(top.exact).toBe(true);
    }
  });

  it("does not resolve a longer code to a shorter steel name", () => {
    // "h1001" must never match the key "h1"; the containment test runs
    // query-inside-key, so a longer query can never match a shorter key.
    expect(findSteelCandidates("h1001", index)).toEqual([]);
    expect(findSteelCandidates("aus8000", index)).toEqual([]);
  });

  it("refuses product-shaped queries so they fall through to product search", () => {
    // This is the "typed a product name, got a steel card" failure.
    expect(findSteelCandidates("M390 Gyuto 210mm Walnut", index)).toEqual([]);
    expect(findSteelCandidates("VG-10 Damascus Santoku 180mm", index)).toEqual([]);
  });

  it("ignores single-character noise", () => {
    expect(findSteelCandidates("a", index)).toEqual([]);
    expect(findSteelCandidates("2", index)).toEqual([]);
    expect(findSteelCandidates("", index)).toEqual([]);
  });

  it("ranks the exact match above a merely containing one", () => {
    const c = findSteelCandidates("SG2", index);
    expect(c[0].steel.label).toBe("SG2 / R2");
    expect(c[0].exact).toBe(true);
  });
});

describe("index integrity", () => {
  it("merges spelling variants instead of dropping them", () => {
    // The old proxy did `if (!steels[alias])`, discarding 29 of 100 alias keys.
    const vg10 = index.entries.filter((e) => e.joined === "vg10");
    expect(vg10.length).toBe(1);
    expect(vg10[0].steel.label).toBe("VG-10");
  });

  it("records keys claimed by more than one steel rather than silently picking", () => {
    expect(Array.isArray(index.collisions)).toBe(true);
    for (const c of index.collisions) expect(c.steels.length).toBeGreaterThan(1);
  });

  it("covers every available steel", () => {
    const reachable = new Set(index.entries.map((e) => e.steel.label));
    for (const label of new Set(Object.values(steels).map((s) => s.label))) {
      expect(reachable.has(label)).toBe(true);
    }
  });

  it("resolves spelling variants with no alias list at all", () => {
    // Reported in the field: a VG-10 knife showed VG-1 in the steel profile.
    //
    // The old matcher sorted keys by length and took the first substring hit with
    // no word boundaries, so "VG10" only reached VG-10 via a hand-typed `vg10`
    // alias. Where that alias was missing (Airtable had drifted from steels.csv),
    // the chain fell through to the 3-character key `vg1` — a substring of
    // "vg10" — and returned VG-1.
    //
    // Detection must therefore work from the label alone. Aliases are a
    // convenience, never load-bearing.
    const noAliases = {};
    for (const steel of new Map(Object.values(steels).map((s) => [s.label, s])).values()) {
      noAliases[steel.label] = { ...steel, aliases: [] };
    }
    const bare = buildSteelIndex(noAliases);

    for (const spelling of ["VG-10", "VG10", "VG 10", "vg10"]) {
      expect(
        detectSteel(product({ title: `Musashi ${spelling} Damascus Gyuto 210mm` }), bare).steel?.label,
        `"${spelling}" must resolve to VG-10 without any alias`
      ).toBe("VG-10");
    }
    // …and the neighbouring designation must stay distinct.
    for (const spelling of ["VG-1", "VG1", "VG 1"]) {
      expect(
        detectSteel(product({ title: `Musashi ${spelling} Kurouchi Gyuto` }), bare).steel?.label,
        `"${spelling}" must resolve to VG-1 without any alias`
      ).toBe("VG-1");
    }
  });

  it("finds every steel by its own label", () => {
    for (const label of new Set(Object.values(steels).map((s) => s.label))) {
      const found = findSteelCandidates(label, index, { maxTokens: 8 });
      expect(found[0]?.steel.label, `label "${label}" should resolve to itself`).toBe(label);
    }
  });
});

describe("classifyQuery", () => {
  it("recognises Musashi product URLs and extracts the handle", () => {
    const r = classifyQuery("https://www.musashihamono.com/products/aogami-super-gyuto?variant=42");
    expect(r.kind).toBe("musashi-url");
    expect(r.handle).toBe("aogami-super-gyuto");
  });

  it("routes other shops to the scraper", () => {
    expect(classifyQuery("https://zakuknives.com/products/x").kind).toBe("external-url");
    expect(classifyQuery("kap-kam.com/item/99").kind).toBe("external-url");
  });

  it("adds a scheme to bare domains so the scraper always gets a valid URL", () => {
    expect(classifyQuery("zakuknives.com/products/x").url).toBe("https://zakuknives.com/products/x");
  });

  it("treats everything else as a query", () => {
    expect(classifyQuery("gyuto 210").kind).toBe("query");
    expect(classifyQuery("VG-10").kind).toBe("query");
    expect(classifyQuery("   ").kind).toBe("empty");
  });

  it("extracts handles from assorted URL shapes", () => {
    expect(extractHandle("https://www.musashihamono.com/products/foo-bar")).toBe("foo-bar");
    expect(extractHandle("https://www.musashihamono.com/collections/x/products/foo-bar?v=1")).toBe("foo-bar");
    expect(extractHandle("foo-bar")).toBe("foo-bar");
  });
});
