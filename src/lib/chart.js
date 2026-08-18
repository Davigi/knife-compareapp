/**
 * chart.js — shared chart geometry and scaling
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY BOTH CHARTS NOW IMPORT FROM ONE PLACE
 * -----------------------------------------
 * The radar chart and the stat bars used to scale their data differently while
 * displaying the same numbers, so they contradicted each other on screen:
 *
 *   DiamondChart  ran every axis through `computeRanges()` + `scaleFrac()`, which
 *                 rescaled each axis to the min/max of *whichever knives happened
 *                 to be loaded*, with asymmetric padding (`pad` below, `pad*0.3`
 *                 above) and a 0.15 floor so nothing ever touched the centre.
 *
 *   StatBars      used the raw value as a percentage width — a plain 0–100 scale.
 *
 * The relative scaling had three consequences worth spelling out, because they
 * explain most of "the graph doesn't make sense":
 *
 *   1. THE POLYGON SHAPE MEANT NOTHING. Each axis got its own data-dependent zero
 *      point, so the four vertices were not on a common scale. A shape could not
 *      be read as "strong here, weak there" — the geometry was an artefact of the
 *      padding, not of the steel.
 *
 *   2. A KNIFE CHANGED SHAPE WHEN ANOTHER WAS LOADED. Alone, a knife was drawn
 *      against a fixed 0–100 range; add a second knife and both were redrawn
 *      against the pair's min/max. The first knife visibly moved without its data
 *      changing.
 *
 *   3. TINY DIFFERENCES LOOKED ENORMOUS. Two steels differing by one point were
 *      pushed to opposite ends of the axis, because the range collapsed onto
 *      whatever spread existed. The chart exaggerated by construction.
 *
 * Everything here is absolute: 0 at the centre, 100 at the rim, on every axis, in
 * both charts, always. Context that used to be smuggled in by rescaling is now
 * shown explicitly — as a reference polygon for the median steel, and as labelled
 * gridlines — so the reader can see the comparison instead of inferring it from a
 * distorted shape.
 */

import { METRIC_KEYS, METRIC_META } from "./steel-science.js";

export { METRIC_KEYS, METRIC_META };

/** Chart axis order, clockwise from the top. */
export const AXES = METRIC_KEYS;

/** The one scale, used everywhere. */
export const SCALE = { min: 0, max: 100 };

/** Gridline positions, drawn and labelled so the rings are readable. */
export const GRID_TICKS = [25, 50, 75, 100];

/**
 * Value → fraction of the radius. Absolute and linear: 0 is the centre, 100 the rim.
 * No floor, no padding, no dependence on what else is loaded.
 */
export const valueToFraction = (value) => {
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, (value - SCALE.min) / (SCALE.max - SCALE.min)));
};

/**
 * Cartesian point for an axis at a given fraction of the radius.
 * Axis 0 is north, then clockwise: east, south, west.
 */
export function axisPoint(axisIndex, fraction, geom) {
  const { cx, cy, r } = geom;
  const d = fraction * r;
  switch (axisIndex % 4) {
    case 0: return [cx, cy - d];
    case 1: return [cx + d, cy];
    case 2: return [cx, cy + d];
    default: return [cx - d, cy];
  }
}

const fmt = ([x, y]) => `${round(x)},${round(y)}`;
const round = (n) => Math.round(n * 100) / 100;

/**
 * Polygon points for one steel, or null when the steel is missing any metric.
 * Returning null rather than substituting zeros matters: a steel with unknown
 * chip resistance must not be drawn as though it scored zero.
 */
export function steelPolygon(steel, geom) {
  if (!steel) return null;
  const fractions = AXES.map((key) => valueToFraction(Number(steel[key])));
  if (fractions.some((f) => f === null)) return null;
  return fractions.map((f, i) => fmt(axisPoint(i, f, geom))).join(" ");
}

/** Polygon for a gridline ring at a given value. */
export function gridPolygon(value, geom) {
  const f = valueToFraction(value);
  return [0, 1, 2, 3].map((i) => fmt(axisPoint(i, f, geom))).join(" ");
}

/**
 * Median value per metric across a set of steel records.
 *
 * This is the honest replacement for relative rescaling: instead of distorting
 * the axes to manufacture contrast, draw where a typical steel sits and let the
 * reader see the distance. Returns null if there is nothing to average.
 */
export function medianSteel(records = []) {
  const usable = records.filter((s) => s && AXES.every((k) => Number.isFinite(Number(s[k]))));
  if (usable.length < 3) return null;
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const out = { label: "Typical steel", isReference: true };
  for (const key of AXES) out[key] = Math.round(median(usable.map((s) => Number(s[key]))));
  return out;
}

/**
 * Knives that can actually be charted, with their slot index preserved so colours
 * stay tied to the panel they came from.
 */
export function chartableKnives(knives = []) {
  return knives
    .map((knife, index) => ({ knife, index }))
    .filter(({ knife }) => knife?.steel && AXES.every((k) => Number.isFinite(Number(knife.steel[k]))));
}

/**
 * Per-metric comparison summary: who leads, and by how much.
 * Used to caption the chart in words, so the reading does not depend on
 * eyeballing polygon area.
 */
export function compareMetrics(entries = []) {
  if (entries.length < 2) return [];
  return AXES.map((key) => {
    const values = entries.map((e) => ({ index: e.index, title: e.knife.title, value: Number(e.knife.steel[key]) }));
    const sorted = [...values].sort((a, b) => b.value - a.value);
    return {
      key,
      label: METRIC_META[key].label,
      leader: sorted[0],
      spread: Math.round(sorted[0].value - sorted[sorted.length - 1].value),
      values,
    };
  });
}
