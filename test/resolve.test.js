import { describe, it, expect, vi } from "vitest";
import { resolveQuery, materialise, scoreProductTitle } from "../src/lib/resolve.js";
import { buildSteelIndex } from "../src/lib/steel-match.js";
import { buildSteelsMap } from "./fixtures/steels.js";

const index = buildSteelIndex(buildSteelsMap());

/** A stub catalogue, so the pipeline can be tested without a network. */
const makeApi = ({ products = [], product = null, scrape = null, searchError = null } = {}) => ({
  searchProducts: vi.fn(async () => {
    if (searchError) throw searchError;
    return products;
  }),
  // Echo back the title of whichever product was asked for, as Shopify would.
  fetchProduct: vi.fn(async (handle) => product ?? {
    title: products.find((p) => p.handle === handle)?.title ?? `Product ${handle}`,
    handle, tags: ["VG-10"], body_html: "<p>A knife.</p>",
    variants: [{ price: "12000" }], images: [{ src: "img.jpg" }], product_type: "Gyuto", vendor: "Musashi",
  }),
  scrapeExternal: vi.fn(async () => scrape ?? {
    title: "External Knife", tags: [], body: "Made from AUS-8 stainless.", price: 99, currency: "USD",
  }),
});

const P = (title, handle = title.toLowerCase().replace(/\W+/g, "-")) => ({
  title, handle, type: "Gyuto", vendor: "Musashi", price: 12000, image: null,
});

describe("scoreProductTitle", () => {
  it("scores an exact title at the top", () => {
    expect(scoreProductTitle("Aogami Super Gyuto", "Aogami Super Gyuto")).toBe(1);
  });

  it("rewards a prefix match, as when a product name is pasted", () => {
    expect(scoreProductTitle("Aogami Super Kurouchi", "Aogami Super Kurouchi Gyuto 210mm")).toBeGreaterThan(0.85);
  });

  it("scores an unrelated title low", () => {
    expect(scoreProductTitle("aogami super gyuto", "Hinoki Cutting Board")).toBeLessThan(0.2);
  });

  it("is not fooled by separator spelling", () => {
    expect(scoreProductTitle("VG-10 santoku", "VG10 Santoku")).toBeGreaterThan(0.7);
  });
});

describe("resolveQuery — URLs", () => {
  it("resolves a Musashi link straight to the product", async () => {
    const api = makeApi();
    const res = await resolveQuery("https://www.musashihamono.com/products/aogami-gyuto", { index, api });
    expect(res.status).toBe("resolved");
    expect(api.fetchProduct).toHaveBeenCalledWith("aogami-gyuto", expect.anything());
    expect(api.searchProducts).not.toHaveBeenCalled();
    expect(res.knife.steel.label).toBe("VG-10");
  });

  it("scrapes another shop's page and identifies the steel from its text", async () => {
    const api = makeApi();
    const res = await resolveQuery("https://zakuknives.com/products/x", { index, api });
    expect(res.status).toBe("resolved");
    expect(res.knife.externalUrl).toBe("https://zakuknives.com/products/x");
    expect(res.knife.steel.label).toBe("AUS-8");
  });

  it("rejects a Musashi link with no product in it", async () => {
    const res = await resolveQuery("https://www.musashihamono.com/", { index, api: makeApi() });
    expect(res.status).toBe("error");
  });
});

describe("resolveQuery — the false positives this was built to stop", () => {
  it("no longer accepts an unrelated first search result", async () => {
    // The old code did `products[0]` with no quality check, so this returned a
    // cutting board for a knife query and presented it as certain.
    const api = makeApi({ products: [P("Hinoki Cutting Board"), P("Knife Sharpening Stone")] });
    const res = await resolveQuery("gyuto 210", { index, api });
    expect(res.status).not.toBe("resolved");
  });

  it("offers a choice when several products match comparably", async () => {
    const api = makeApi({
      products: [P("Gyuto 210mm Kurouchi"), P("Gyuto 210mm Damascus"), P("Gyuto 210mm Nashiji")],
    });
    const res = await resolveQuery("gyuto 210", { index, api });
    expect(res.status).toBe("choose");
    expect(res.candidates.length).toBeGreaterThan(1);
    expect(res.candidates.every((c) => c.kind === "product")).toBe(true);
  });

  it("still resolves a bare steel name straight to the steel card", async () => {
    const api = makeApi({ products: [P("VG10 Damascus Santoku 180mm")] });
    const res = await resolveQuery("VG-10", { index, api });
    expect(res.status).toBe("resolved");
    expect(res.knife.steelOnly).toBe(true);
    expect(res.knife.steel.label).toBe("VG-10");
  });

  it("lets a product query reach the catalogue even though it names a steel", async () => {
    // The old steel shortcut returned before any product search could run, so a
    // query like this could never find a knife.
    const api = makeApi({ products: [P("VG-10 Damascus Santoku 180mm")] });
    const res = await resolveQuery("VG-10 Damascus Santoku 180mm", { index, api });
    expect(api.searchProducts).toHaveBeenCalled();
    expect(res.status).toBe("resolved");
    expect(res.knife.steelOnly).toBe(false);
    expect(res.knife.title).toBe("VG-10 Damascus Santoku 180mm");
  });

  it("resolves a pasted product title directly", async () => {
    const api = makeApi({ products: [P("Aogami Super Kurouchi Gyuto 210mm"), P("Hinoki Board")] });
    const res = await resolveQuery("Aogami Super Kurouchi Gyuto 210mm", { index, api });
    expect(res.status).toBe("resolved");
    expect(res.knife.title).toBe("Aogami Super Kurouchi Gyuto 210mm");
  });
});

describe("resolveQuery — failure reporting", () => {
  it("explains what to try instead of a bare 'not found'", async () => {
    const api = makeApi({ products: [] });
    const res = await resolveQuery("qqqq zzz", { index, api });
    expect(res.status).toBe("error");
    expect(res.error).toMatch(/musashihamono\.com/);
    expect(res.error).toMatch(/steel name/i);
  });

  it("still answers from local steel data when product search is down", async () => {
    const api = makeApi({ searchError: new Error("Shopify unavailable") });
    const res = await resolveQuery("VG-10", { index, api });
    expect(res.status).toBe("resolved");
    expect(res.knife.steel.label).toBe("VG-10");
    expect(res.notice).toMatch(/unavailable/i);
  });

  it("reports a search outage when there is no local answer either", async () => {
    const api = makeApi({ searchError: new Error("Shopify unavailable") });
    const res = await resolveQuery("gyuto 210", { index, api });
    expect(res.status).toBe("error");
    expect(res.error).toMatch(/unavailable/i);
  });

  it("propagates cancellation instead of showing a stale result", async () => {
    // Two searches in flight used to race, and the slower one could overwrite the
    // faster one's result with no sign anything had gone wrong.
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const api = makeApi({ searchError: abort });
    await expect(resolveQuery("gyuto", { index, api })).rejects.toThrow(/abort/i);
  });

  it("asks for input rather than searching for nothing", async () => {
    const api = makeApi();
    const res = await resolveQuery("   ", { index, api });
    expect(res.status).toBe("error");
    expect(api.searchProducts).not.toHaveBeenCalled();
  });
});

describe("materialise", () => {
  it("builds a steel-only card without any network call", async () => {
    const api = makeApi();
    const steel = buildSteelsMap()["VG-10"];
    const knife = await materialise({ kind: "steel", steel }, { index, api });
    expect(knife.steelOnly).toBe(true);
    expect(api.fetchProduct).not.toHaveBeenCalled();
  });

  it("fetches the full record for a chosen product and detects its steel", async () => {
    const api = makeApi();
    const knife = await materialise(
      { kind: "product", product: { handle: "some-gyuto", title: "Some Gyuto" } },
      { index, api }
    );
    expect(api.fetchProduct).toHaveBeenCalledWith("some-gyuto", expect.anything());
    expect(knife.steel.label).toBe("VG-10");
    expect(knife.price).toBe(12000);
  });
});
