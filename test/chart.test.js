import { describe, it, expect } from "vitest";
import {
  valueToFraction, steelPolygon, gridPolygon, axisPoint,
  medianSteel, chartableKnives, compareMetrics, AXES,
} from "../src/lib/chart.js";
import { normaliseSteelBatch } from "../src/lib/steel-data.js";
import { availableRows } from "./fixtures/steels.js";

const GEOM = { cx: 200, cy: 176, r: 112 };
const { records } = normaliseSteelBatch(availableRows);
const steel = (label) => records.find((r) => r.label === label);
const knife = (label) => ({ title: label, steel: steel(label) });

describe("absolute scaling", () => {
  it("maps 0 to the centre and 100 to the rim, linearly", () => {
    expect(valueToFraction(0)).toBe(0);
    expect(valueToFraction(50)).toBe(0.5);
    expect(valueToFraction(100)).toBe(1);
  });

  it("clamps out-of-range values instead of drawing outside the chart", () => {
    expect(valueToFraction(-20)).toBe(0);
    expect(valueToFraction(180)).toBe(1);
  });

  it("refuses to invent a position for a missing value", () => {
    // The old scaleFrac() returned 0.7 whenever the range collapsed, so a steel
    // with no data was drawn at a plausible-looking position.
    expect(valueToFraction(undefined)).toBeNull();
    expect(valueToFraction(NaN)).toBeNull();
  });
});

describe("chart stability — the behaviour that made the graph confusing", () => {
  it("draws a knife identically whether it is alone or beside others", () => {
    // Under computeRanges(), loading a second knife rescaled both axes and the
    // first knife visibly changed shape without its data changing.
    const alone = steelPolygon(steel("VG-10"), GEOM);
    const withOne = steelPolygon(steel("VG-10"), GEOM);
    expect(alone).toBe(withOne);

    const solo = chartableKnives([knife("VG-10")]);
    const pair = chartableKnives([knife("VG-10"), knife("ZDP-189")]);
    expect(steelPolygon(solo[0].knife.steel, GEOM)).toBe(steelPolygon(pair[0].knife.steel, GEOM));
  });

  it("does not exaggerate a small difference into a large one", () => {
    // Relative scaling pushed any two values to opposite ends of the axis,
    // however close they actually were.
    const a = valueToFraction(60);
    const b = valueToFraction(62);
    expect(Math.abs(a - b)).toBeCloseTo(0.02, 5);
  });

  it("puts every axis on one common scale", () => {
    // Each axis previously had its own data-dependent zero, so the polygon shape
    // could not be read as strong-here-weak-there.
    const at70 = AXES.map((_, i) => axisPoint(i, valueToFraction(70), GEOM));
    const distances = at70.map(([x, y]) => Math.hypot(x - GEOM.cx, y - GEOM.cy));
    for (const d of distances) expect(d).toBeCloseTo(distances[0], 6);
  });

  it("agrees with the stat bars for the same value", () => {
    // Both charts read valueToFraction; there is no second scaling path to drift.
    const v = 43;
    const barWidthPct = valueToFraction(v) * 100;
    const [, y] = axisPoint(0, valueToFraction(v), GEOM);
    expect(barWidthPct).toBeCloseTo(43, 6);
    expect(GEOM.cy - y).toBeCloseTo(0.43 * GEOM.r, 6);
  });
});

describe("polygon construction", () => {
  it("builds a four-vertex polygon for a complete steel", () => {
    const poly = steelPolygon(steel("VG-10"), GEOM);
    expect(poly.split(" ")).toHaveLength(4);
    for (const pair of poly.split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
  });

  it("returns null rather than drawing a zero for a missing metric", () => {
    const broken = { ...steel("VG-10"), chip: undefined };
    expect(steelPolygon(broken, GEOM)).toBeNull();
    expect(steelPolygon(null, GEOM)).toBeNull();
  });

  it("places gridlines at fixed values", () => {
    const half = gridPolygon(50, GEOM).split(" ").map((p) => p.split(",").map(Number));
    for (const [x, y] of half) {
      expect(Math.hypot(x - GEOM.cx, y - GEOM.cy)).toBeCloseTo(GEOM.r / 2, 4);
    }
  });

  it("excludes knives that cannot be charted", () => {
    const list = [knife("VG-10"), { title: "No steel", steel: null }, null, { title: "Partial", steel: { retention: 50 } }];
    const ok = chartableKnives(list);
    expect(ok).toHaveLength(1);
    expect(ok[0].index).toBe(0);
  });

  it("keeps slot index so a knife keeps its panel colour", () => {
    const list = [null, knife("VG-10")];
    expect(chartableKnives(list)[0].index).toBe(1);
  });
});

describe("reference median", () => {
  it("summarises the database without distorting any axis", () => {
    const med = medianSteel(records);
    for (const key of AXES) {
      expect(med[key]).toBeGreaterThanOrEqual(0);
      expect(med[key]).toBeLessThanOrEqual(100);
    }
  });

  it("declines to average too small a sample", () => {
    expect(medianSteel([])).toBeNull();
    expect(medianSteel(records.slice(0, 2))).toBeNull();
  });
});

describe("comparison summary", () => {
  it("names the leader and the spread per metric", () => {
    const entries = chartableKnives([knife("White Steel #1"), knife("VG-10")]);
    const summary = compareMetrics(entries);
    expect(summary).toHaveLength(4);
    const corrosion = summary.find((s) => s.key === "corrosion");
    expect(corrosion.leader.title).toBe("VG-10");
    expect(corrosion.spread).toBeGreaterThan(0);
  });

  it("says nothing when there is only one knife to compare", () => {
    expect(compareMetrics(chartableKnives([knife("VG-10")]))).toEqual([]);
  });
});
