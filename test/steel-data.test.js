import { describe, it, expect } from "vitest";
import {
  detectScoreScale, normaliseSteelRecord, normaliseSteelBatch, toSteelMap,
} from "../src/lib/steel-data.js";
import {
  parsePct, parseHrc, parseOtherComp, readComposition, carbideModel, scoreSteel, METRIC_KEYS,
} from "../src/lib/steel-science.js";
import { availableRows, allRows } from "./fixtures/steels.js";

describe("input parsing", () => {
  it("reads ranges, single values and limits", () => {
    expect(parsePct("1.25%")).toBeCloseTo(1.25);
    expect(parsePct("0.80–0.90%")).toBeCloseTo(0.85);   // en dash, as stored
    expect(parsePct("0.80-0.90%")).toBeCloseTo(0.85);
    expect(parsePct("≤0.025%")).toBeCloseTo(0.0125);    // a limit is a trace
    expect(parsePct("")).toBe(0);
    expect(parsePct(undefined)).toBe(0);
  });

  it("reads HRC ranges and rejects implausible values", () => {
    expect(parseHrc("62–64")).toBe(63);
    expect(parseHrc("63")).toBe(63);
    expect(parseHrc("")).toBeNull();
    expect(parseHrc("HRC 999")).toBeNull();
  });

  it("does not mistake provenance codes for elements", () => {
    // other_comp mixes chemistry with country and process markers.
    // "SI" is Slovenia, not silicon; "N" only counts with a number attached.
    expect(parseOtherComp("Ni 0.49%, DE")).toEqual({ Ni: 0.49 });
    expect(parseOtherComp("DE")).toEqual({});
    expect(parseOtherComp("CPM, US")).toEqual({});
    expect(parseOtherComp("Nb 2.00%, N 0.20%, CPM, US")).toEqual({ Nb: 2, N: 0.2 });
    expect(parseOtherComp("P ≤0.025%, S ≤0.004%")).toEqual({ P: 0.0125, S: 0.002 });
  });

  it("never lets other_comp overwrite a dedicated column", () => {
    const comp = readComposition({ co_pct: "8.00%", other_comp: "Co 1.00%, JP" });
    expect(comp.Co).toBe(8);
  });
});

describe("carbide model", () => {
  const model = (row) => carbideModel(readComposition(row), {});

  it("spends carbon on strong formers before chromium", () => {
    // High vanadium locks carbon into MC, leaving less for chromium carbide,
    // which is why a PM steel keeps more chromium in solution than its
    // carbon content alone would suggest.
    const m = model({ c_pct: "1.25%", cr_pct: "14.00%", v_pct: "1.80%", mo_pct: "2.30%" });
    expect(m.vol.MC).toBeGreaterThan(0);
    expect(m.crSolution).toBeGreaterThan(10);
  });

  it("counts only dissolved molybdenum toward corrosion resistance", () => {
    // HAP-40: 5% Mo, nearly all of it tied up in M2C. Counting total Mo rated it
    // as corrosion-resistant as a stainless, which it is emphatically not.
    const hap = model({ c_pct: "1.27%", cr_pct: "4.00%", v_pct: "3.00%", mo_pct: "5.00%" });
    expect(hap.moSolution).toBeLessThan(5);
    expect(hap.pren).toBeLessThan(15);
  });

  it("gives a plain carbon steel cementite and no passivation", () => {
    const white = model({ c_pct: "1.05%" });
    expect(white.vol.Fe3C).toBeGreaterThan(0);
    expect(white.crSolution).toBe(0);
    expect(white.pren).toBe(0);
  });

  it("never produces negative or non-finite quantities", () => {
    for (const row of allRows) {
      const m = model(row);
      for (const [k, v] of Object.entries(m.vol)) {
        expect(Number.isFinite(v), `${row.label} vol.${k}`).toBe(true);
        expect(v, `${row.label} vol.${k}`).toBeGreaterThanOrEqual(0);
      }
      expect(m.pren).toBeGreaterThanOrEqual(0);
      expect(m.crSolution).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("scoring model — the defects it was written to remove", () => {
  const scored = allRows.map(scoreSteel);

  const pearson = (a, b) => {
    const m = (x) => x.reduce((s, v) => s + v, 0) / x.length;
    const ma = m(a), mb = m(b);
    let n = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return n / Math.sqrt(da * db);
  };

  it("no longer makes sharpening a mirror of retention", () => {
    // Old data: r = -0.957, with 609/1003 rows at retention + sharpening === 105.
    // Two chart axes encoded one number.
    const r = pearson(scored.map((s) => s.retention), scored.map((s) => s.sharpening));
    expect(Math.abs(r)).toBeLessThan(0.9);

    const mirrored = scored.filter((s) => Math.abs(s.retention + s.sharpening - 105) < 0.5).length;
    expect(mirrored / scored.length).toBeLessThan(0.1);
  });

  it("lets a carbon steel be both wear-resistant and easy to sharpen", () => {
    // Arithmetically impossible under the old inverse formula. It is the whole
    // reason Shirogami is prized, so a model that cannot express it is wrong.
    const white1 = scoreSteel(allRows.find((r) => r.label === "White Steel #1"));
    const srs13 = scoreSteel(allRows.find((r) => r.label === "SRS-13"));
    expect(white1.retention).toBeGreaterThan(70);
    expect(white1.sharpening).toBeGreaterThan(srs13.sharpening + 20);
  });

  it("gives chip resistance real spread instead of a constant", () => {
    // Old data: 70 for 984 of 1003 rows — a quarter of the chart carrying no signal.
    const distinct = new Set(scored.map((s) => Math.round(s.chip))).size;
    expect(distinct).toBeGreaterThan(10);
    const counts = {};
    for (const s of scored) counts[Math.round(s.chip)] = (counts[Math.round(s.chip)] ?? 0) + 1;
    const mode = Math.max(...Object.values(counts));
    expect(mode / scored.length).toBeLessThan(0.5);
  });

  it("orders corrosion resistance the way the categories say it should", () => {
    const by = (label) => scoreSteel(allRows.find((r) => r.label === label));
    expect(by("White Steel #2").corrosion).toBeLessThan(by("SLD").corrosion);
    expect(by("SLD").corrosion).toBeLessThan(by("VG-10").corrosion);
    expect(by("HAP-40").corrosion).toBeLessThan(by("VG-10").corrosion);
  });

  it("orders edge retention sensibly across the curated set", () => {
    const by = (label) => scoreSteel(allRows.find((r) => r.label === label));
    expect(by("White Steel #3").retention).toBeLessThan(by("White Steel #1").retention);
    expect(by("AUS-8").retention).toBeLessThan(by("SG2 / R2").retention);
    expect(by("SG2 / R2").retention).toBeGreaterThan(by("VG-10").retention);
  });

  it("keeps every score inside 0–100 for the whole database", () => {
    for (const [i, s] of scored.entries()) {
      for (const k of METRIC_KEYS) {
        expect(Number.isFinite(s[k]), `${allRows[i].label}.${k}`).toBe(true);
        expect(s[k], `${allRows[i].label}.${k}`).toBeGreaterThanOrEqual(0);
        expect(s[k], `${allRows[i].label}.${k}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("marks records whose hardness had to be inferred", () => {
    const withHrc = scoreSteel({ c_pct: "1.00%", cr_pct: "15%", hrc: "60–62" });
    const without = scoreSteel({ c_pct: "1.00%", cr_pct: "15%" });
    expect(withHrc.hrcEstimated).toBe(false);
    expect(without.hrcEstimated).toBe(true);
    expect(without.confidence).not.toBe("high");
  });
});

describe("score scale detection — the tiny-bars bug", () => {
  it("recognises legacy 0-10 data and rescales it", () => {
    // Airtable still holds the pre-migration 0-10 values. Under the old code they
    // flowed straight into a 0-100 UI and every bar rendered at a tenth length.
    const legacy = [
      { label: "A", retention: 7, sharpening: 6, corrosion: 8, chip: 7 },
      { label: "B", retention: 9, sharpening: 5, corrosion: 10, chip: 8 },
    ];
    const scale = detectScoreScale(legacy);
    expect(scale.scale).toBe("0-10");
    expect(scale.multiplier).toBe(10);

    const { records } = normaliseSteelBatch(legacy, { preferStored: true });
    expect(records[0].retention).toBe(70);
    expect(records[1].corrosion).toBe(100);
  });

  it("leaves current 0-100 data alone", () => {
    const modern = availableRows.map((r) => ({ ...r }));
    expect(detectScoreScale(modern).multiplier).toBe(1);
  });

  it("does not rescale when there is nothing to judge by", () => {
    expect(detectScoreScale([]).multiplier).toBe(1);
    expect(detectScoreScale([{ label: "A" }]).multiplier).toBe(1);
  });

  it("clamps anything that survives out of range", () => {
    const { records } = normaliseSteelBatch(
      [{ label: "X", retention: 250, sharpening: -30, corrosion: 50, chip: 50 }],
      { preferStored: true }
    );
    expect(records[0].retention).toBe(100);
    expect(records[0].sharpening).toBe(0);
  });
});

describe("record normalisation", () => {
  it("produces a complete, chartable record for every available steel", () => {
    const { records, incomplete, rejected } = normaliseSteelBatch(availableRows);
    expect(rejected).toEqual([]);
    expect(incomplete).toEqual([]);
    expect(records.length).toBe(availableRows.length);
    for (const r of records) {
      expect(r.label).toBeTruthy();
      expect(r.complete).toBe(true);
      for (const k of METRIC_KEYS) expect(typeof r[k]).toBe("number");
    }
  });

  it("prefers composition over stored scores and says so", () => {
    const rec = normaliseSteelRecord(availableRows.find((r) => r.label === "VG-10"));
    expect(rec.scoreSource).toBe("computed");
  });

  it("falls back to stored scores when there is no chemistry to model", () => {
    const rec = normaliseSteelRecord({ label: "Mystery", retention: 50, sharpening: 50, corrosion: 50, chip: 50 });
    expect(rec.scoreSource).toBe("curated");
    expect(rec.retention).toBe(50);
  });

  it("rejects rows with no label rather than shipping a blank card", () => {
    expect(normaliseSteelRecord({ retention: 50 })).toBeNull();
    const { rejected } = normaliseSteelBatch([{ retention: 50 }]);
    expect(rejected.length).toBe(1);
  });

  it("splits aliases and excludes unavailable steels from the lookup map", () => {
    const { records } = normaliseSteelBatch(allRows);
    const map = toSteelMap(records);
    expect(map["VG-10"]).toBeTruthy();
    expect(map["vg-10"]).toBeTruthy();          // via aliases
    expect(Object.values(map).every((s) => s.available)).toBe(true);
    // 972 rows are marked unavailable and must not reach the UI.
    expect(new Set(Object.values(map).map((s) => s.label)).size).toBe(availableRows.length);
  });
});
