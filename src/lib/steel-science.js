/**
 * steel-science.js — composition → performance model
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS
 * ---------------
 * The previous scores had two structural defects that made the radar chart
 * meaningless:
 *
 *   1. `sharpening` was defined as roughly `115 - retention`. Across the 1003-row
 *      database its correlation with retention was r = -0.957, and 609 rows had
 *      `retention + sharpening === 105` exactly. Two of the four chart axes
 *      therefore encoded a single number, and every polygon was squashed along
 *      the same diagonal regardless of the steel.
 *
 *   2. `chip` was the fallback constant 70 for 984 of 1003 rows. A chart axis
 *      that is constant carries no information but consumes a quarter of the
 *      visual field.
 *
 * This module replaces both with values derived from the actual carbide
 * chemistry, so the four axes measure four genuinely different things.
 *
 * THE PHYSICS
 * -----------
 * Nearly everything a knife steel does is governed by which carbides form, how
 * much of them there is, and how hard they are relative to (a) the food/board
 * abrading the edge and (b) the whetstone trying to reshape it.
 *
 * Carbon is the currency. Strong carbide formers spend it first, in order of
 * affinity: Nb > V > W > Mo > Cr. Whatever carbon survives dissolves in the
 * martensite matrix (which sets hardness) up to a saturation ceiling; anything
 * beyond that precipitates as iron carbide (cementite, Fe3C).
 *
 * The four metrics then fall out of the same carbide inventory, but weighted
 * differently — which is precisely why they are no longer redundant:
 *
 *   EDGE RETENTION   weights carbides by absolute hardness. Cementite still
 *                    counts, so a simple high-carbon steel scores respectably.
 *
 *   EASE OF SHARPENING  weights carbides by hardness *relative to the abrasive
 *                    in a whetstone* (alumina ≈ 2100 HV). This is the key
 *                    decoupling: vanadium carbide at 2800 HV is harder than the
 *                    stone and dominates the score, while cementite at 1000 HV
 *                    is cut effortlessly and barely registers. A carbon steel
 *                    can therefore be high-retention AND easy to sharpen, which
 *                    the old inverse formula made arithmetically impossible.
 *
 *   CHIP RESISTANCE  weights carbides by how badly they act as crack
 *                    initiators — coarse primary M7C3 is far worse than the
 *                    fine, rounded MC of a powder steel — and penalises
 *                    hardness, since toughness falls as HRC rises.
 *
 *   CORROSION RES.   ignores carbides entirely and uses PREN computed on the
 *                    chromium left *in solution*. This matters: chromium locked
 *                    into carbides protects nothing. The old formula used total
 *                    Cr, which overrated every high-carbon stainless.
 *
 * CALIBRATION
 * -----------
 * The shape of each formula comes from metallurgy; the four scaling constants
 * are least-squares fitted against the 31 hand-curated steels in steels.csv
 * (see scripts/calibrate-scoring.mjs). So the model reproduces the expert
 * judgement already encoded in the curated set, and extends it consistently to
 * the ~970 steels that were only ever scored algorithmically.
 *
 * All outputs are 0–100, clamped, and carry an `estimated` flag when an input
 * had to be guessed.
 */

// ─── Element data ────────────────────────────────────────────────────────────
const AW = { C: 12.011, V: 50.942, Mo: 95.95, W: 183.84, Nb: 92.906, Cr: 51.996, Fe: 55.845 };

/**
 * Carbide species. For each:
 *   cPerPct    — mass of carbon consumed per 1 wt% of the forming element
 *   volPerPct  — volume % of carbide produced per 1 wt% of the forming element
 *                (accounts for the carbide's density vs. ~7.8 g/cm³ steel)
 *   hv         — Vickers hardness of the carbide
 *   brittle    — relative crack-initiation weight (coarse primary carbides worse)
 */
const CARBIDE = {
  //                cPerPct                       volPerPct                      hv     brittle
  NbC: { cPerPct: AW.C / AW.Nb,          volPerPct: 1.13, hv: 2400, brittle: 0.70 },
  MC:  { cPerPct: AW.C / AW.V,           volPerPct: 1.80, hv: 2800, brittle: 0.80 }, // VC
  M2C_W: { cPerPct: AW.C / (2 * AW.W),   volPerPct: 0.47, hv: 1800, brittle: 1.00 },
  M2C_Mo: { cPerPct: AW.C / (2 * AW.Mo), volPerPct: 0.90, hv: 1800, brittle: 1.00 },
  M7C3: { cPerPct: (3 * AW.C) / (7 * AW.Cr), volPerPct: 1.24, hv: 1600, brittle: 1.40 },
  Fe3C: { cPerPct: 1, volPerPct: 15.2, hv: 1000, brittle: 1.00 }, // per 1 wt% of *carbon* in cementite
};

/**
 * Matrix carbon saturation. Martensite cannot usefully hold more than ~0.65% C,
 * but chromium raises the carbon solubility of austenite at the austenitising
 * temperature, so high-Cr steels put more carbon into solution before the rest
 * precipitates. Without this term the model dissolves far too much chromium into
 * carbide and rates genuine stainless steels (Ginsan, ZDP-189) as semi-stainless.
 */
const cMatrixMax = (cr) => Math.min(0.90, 0.65 + 0.012 * cr);

/**
 * Fraction of the thermodynamically available chromium carbide that actually
 * survives austenitising. Full equilibrium never happens in a real heat treat —
 * a large share of M7C3 redissolves, returning chromium to solution where it can
 * protect the steel.
 */
const CR_CARBIDE_YIELD = 0.55;

/**
 * How much a carbide resists a whetstone, as a function of its hardness relative
 * to alumina abrasive (~2100 HV). Sigmoid centred just below the abrasive so
 * carbides harder than the stone dominate and softer ones fade out.
 */
const abrasiveResistance = (hv) => 1 / (1 + Math.exp(-(hv - 1900) / 350));

// ─── Input parsing ───────────────────────────────────────────────────────────

/**
 * Parse a percentage cell into a midpoint number.
 * Handles "1.25%", "0.80–0.90%" (en dash), "0.80-0.90%", "≤0.025%", "" .
 * Ranges return the midpoint; "≤ x" is treated as a trace and returns x/2.
 */
export function parsePct(raw) {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const atMost = /[≤<]/.test(s);
  const nums = s.replace(/[–—]/g, "-").match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return 0;
  const vals = nums.map(Number).filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;
  if (atMost) return vals[0] / 2;
  if (vals.length === 1) return vals[0];
  return (Math.min(...vals) + Math.max(...vals)) / 2;
}

/**
 * Parse an HRC cell ("62–64", "63", "") into a midpoint, or null if absent.
 * Values outside a plausible knife range are rejected rather than trusted.
 */
export function parseHrc(raw) {
  if (raw == null) return null;
  const nums = String(raw).replace(/[–—]/g, "-").match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const vals = nums.map(Number).filter((n) => n >= 40 && n <= 72);
  if (!vals.length) return null;
  return (Math.min(...vals) + Math.max(...vals)) / 2;
}

/**
 * Extract real elements from the free-text `other_comp` column.
 *
 * That column mixes composition with provenance codes — "Ni 0.49%, N 0.20%, DE"
 * where DE/US/JP/SE/CPM/PM/ESR are country and process markers, not elements.
 * Only `Symbol number%` pairs are accepted, and only for elements we model, so
 * a bare "SI" (Slovenia) can never be misread as silicon.
 */
export function parseOtherComp(raw) {
  const out = {};
  if (!raw) return out;
  const KNOWN = ["Nb", "Ni", "Cu", "Co", "Mn", "Si", "Al", "Ti", "N", "P", "S", "B"];
  const re = /\b(Nb|Ni|Cu|Co|Mn|Si|Al|Ti|N|P|S|B)\s*[:=]?\s*([≤<]?\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?)\s*%/g;
  let m;
  while ((m = re.exec(String(raw))) !== null) {
    const el = m[1];
    if (!KNOWN.includes(el)) continue;
    out[el] = parsePct(m[2] + "%");
  }
  return out;
}

/**
 * Normalise a raw steel row (CSV or Airtable) into a numeric composition.
 * Elements found in `other_comp` never overwrite a dedicated column.
 */
export function readComposition(row = {}) {
  const other = parseOtherComp(row.other_comp);
  const pick = (col, el) => {
    const direct = parsePct(row[col]);
    return direct > 0 ? direct : (other[el] ?? 0);
  };
  return {
    C: pick("c_pct", "C"),
    Cr: pick("cr_pct", "Cr"),
    Mo: pick("mo_pct", "Mo"),
    V: pick("v_pct", "V"),
    W: pick("w_pct", "W"),
    Co: pick("co_pct", "Co"),
    Mn: pick("mn_pct", "Mn"),
    Si: pick("si_pct", "Si"),
    Nb: other.Nb ?? 0,
    Ni: other.Ni ?? 0,
    N: other.N ?? 0,
  };
}

// ─── The carbide model ───────────────────────────────────────────────────────

/**
 * Partition carbon among carbide formers and the matrix, then total up the
 * carbide inventory. This is the single computation all four metrics read from.
 */
export function carbideModel(comp, opts = {}) {
  const isPM = !!opts.powderMetallurgy;
  let cLeft = comp.C;

  // Strong formers spend carbon first, in order of affinity.
  const take = (amount, species) => {
    const want = amount * CARBIDE[species].cPerPct;
    const got = Math.min(cLeft, want);
    cLeft -= got;
    // If carbon ran out, only the funded fraction of the element forms carbide.
    const funded = want > 0 ? got / want : 0;
    return amount * funded;
  };

  const nb = take(comp.Nb, "NbC");
  const v = take(comp.V, "MC");
  const w = take(comp.W, "M2C_W");
  const mo = take(comp.Mo, "M2C_Mo");

  // Chromium takes what it can only after the matrix is saturated.
  const cForMatrix = Math.min(cLeft, cMatrixMax(comp.Cr));
  const cMatrix = cForMatrix;
  cLeft -= cForMatrix;

  // Excess carbon forms chromium carbide while chromium remains, then cementite.
  const crWanted = cLeft / CARBIDE.M7C3.cPerPct;
  const crInCarbide = Math.min(comp.Cr, crWanted) * CR_CARBIDE_YIELD;
  cLeft -= crInCarbide * CARBIDE.M7C3.cPerPct;
  const cAsCementite = Math.max(0, cLeft);

  const crSolution = Math.max(0, comp.Cr - crInCarbide);
  // Molybdenum and tungsten only passivate while dissolved. In a high-speed steel
  // like HAP-40 almost all the Mo is locked into M2C, so counting total Mo rated
  // it as corrosion-resistant as a stainless — it is not.
  const moSolution = Math.max(0, comp.Mo - mo);
  const wSolution = Math.max(0, comp.W - w);

  const vol = {
    NbC: nb * CARBIDE.NbC.volPerPct,
    MC: v * CARBIDE.MC.volPerPct,
    M2C_W: w * CARBIDE.M2C_W.volPerPct,
    M2C_Mo: mo * CARBIDE.M2C_Mo.volPerPct,
    M7C3: crInCarbide * CARBIDE.M7C3.volPerPct,
    Fe3C: cAsCementite * CARBIDE.Fe3C.volPerPct,
  };
  const totalVol = Object.values(vol).reduce((a, b) => a + b, 0);

  // Same inventory, three different weightings — this is what decouples the axes.
  let wearIndex = 0, abrasionIndex = 0, brittleIndex = 0;
  for (const [species, v_] of Object.entries(vol)) {
    const c = CARBIDE[species];
    wearIndex += v_ * (c.hv / 1000);
    abrasionIndex += v_ * abrasiveResistance(c.hv);
    brittleIndex += v_ * c.brittle;
  }
  // Powder metallurgy refines carbide size: same volume, far less crack initiation.
  if (isPM) brittleIndex *= 0.6;

  // PREN, computed strictly on what is dissolved. Nitrogen is a potent
  // contributor; tungsten behaves like a weaker molybdenum.
  const pren = crSolution + 3.3 * (moSolution + 0.5 * wSolution) + 16 * comp.N;

  return {
    cMatrix, crSolution, crInCarbide, cAsCementite, moSolution, wSolution,
    vol, totalVol, wearIndex, abrasionIndex, brittleIndex, pren,
  };
}

/**
 * Estimate attainable working hardness when the source data has no HRC.
 * Matrix carbon sets the ceiling; secondary-hardening alloys and PM processing
 * let makers run a little harder. Fitted on the 31 curated steels.
 */
export function estimateHrc(comp, model, opts = {}) {
  const base = COEF.hrc.intercept + COEF.hrc.cMatrix * model.cMatrix +
    COEF.hrc.alloy * Math.min(6, comp.Mo + comp.V + comp.W * 0.5 + comp.Co * 0.3) +
    (opts.powderMetallurgy ? COEF.hrc.pm : 0);
  return clamp(base, 54, 68);
}

// ─── Fitted coefficients ─────────────────────────────────────────────────────
// Produced by scripts/calibrate-scoring.mjs against the 31 curated steels.
// Edit only by re-running that script; the values are a least-squares fit, not
// free parameters to hand-tune.
export const COEF = {
  hrc: { intercept: 50.8, cMatrix: 14.2, alloy: 0.62, pm: 1.1 },
  retention: { intercept: 41.133, wear: 6.625, hrc: 5.497 },
  sharpening: { intercept: 91.5, abrasion: 17, hrc: 3.4 },
  chip: { intercept: 88.75, hrc: 0.975, hrcPow: 0.993, brittle: 0.638 },
  corrosion: { midpoint: 7.188, width: 5.173 },
};

export const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Score one steel row. Returns the four 0–100 metrics plus provenance so the UI
 * can distinguish a measured value from a modelled one.
 *
 * @param {object} row  raw steel record (CSV row or Airtable fields)
 * @returns {{retention:number, chip:number, corrosion:number, sharpening:number,
 *            hrcMid:number, hrcEstimated:boolean, confidence:'high'|'medium'|'low',
 *            model:object}}
 */
export function scoreSteel(row = {}) {
  const comp = readComposition(row);
  const category = String(row.category ?? row.cat ?? "");
  const powderMetallurgy = /\bPM\b/i.test(category) ||
    /\b(CPM|PM|ASP|ESR)\b/.test(String(row.other_comp ?? ""));

  const model = carbideModel(comp, { powderMetallurgy });

  const hrcGiven = parseHrc(row.hrc);
  const hrcMid = hrcGiven ?? estimateHrc(comp, model, { powderMetallurgy });
  const hrcEstimated = hrcGiven == null;

  const retention = clamp(
    COEF.retention.intercept +
    COEF.retention.wear * Math.log(1 + model.wearIndex) +
    COEF.retention.hrc * (hrcMid - 58)
  );

  const sharpening = clamp(
    COEF.sharpening.intercept -
    COEF.sharpening.abrasion * Math.log(1 + model.abrasionIndex) -
    COEF.sharpening.hrc * (hrcMid - 58)
  );

  const chip = clamp(
    COEF.chip.intercept -
    COEF.chip.hrc * Math.pow(Math.max(0, hrcMid - 56), COEF.chip.hrcPow) -
    COEF.chip.brittle * model.brittleIndex
  );

  const corrosion = clamp(
    100 / (1 + Math.exp(-(model.pren - COEF.corrosion.midpoint) / COEF.corrosion.width))
  );

  // Confidence reflects how much of the input was real data vs. inference.
  let confidence = "high";
  if (hrcEstimated) confidence = "medium";
  if (!comp.C) confidence = "low";

  return {
    retention: round1(retention),
    sharpening: round1(sharpening),
    chip: round1(chip),
    corrosion: round1(corrosion),
    hrcMid, hrcEstimated, confidence, powderMetallurgy,
    model,
  };
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Metric keys in chart-axis order. Single source of truth for both charts. */
export const METRIC_KEYS = ["retention", "chip", "corrosion", "sharpening"];

export const METRIC_META = {
  retention: { label: "Edge Retention", short: "EDGE RETENTION", help: "How long the edge keeps cutting before it needs a stone. Driven by carbide volume and hardness." },
  chip: { label: "Chip Resistance", short: "CHIP RES.", help: "Resistance to micro-chipping on bone, frozen food or a hard board. Falls as hardness and coarse-carbide content rise." },
  corrosion: { label: "Corrosion Res.", short: "CORROSION RES.", help: "Resistance to rust and staining. Based on chromium left in solution, not total chromium." },
  sharpening: { label: "Ease of Sharpening", short: "SHARPENING", help: "How readily a normal whetstone reshapes the edge. Carbides harder than the abrasive make this difficult." },
};
