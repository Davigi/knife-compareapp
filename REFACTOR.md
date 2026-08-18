# Refactor notes — search engine and comparison chart

What changed, why, and what you still need to do by hand.

---

## The three defects this addresses

### 1. The chart could not be read as data

`DiamondChart` ran every axis through `computeRanges()` + `scaleFrac()`, rescaling
each axis to the min/max of whichever knives happened to be loaded, with
asymmetric padding (`pad` below, `pad * 0.3` above) and a `0.15` floor. Meanwhile
`StatBars` used the raw value as a percentage width. Consequences:

- **The polygon shape meant nothing.** Each axis had its own data-dependent zero,
  so the four vertices were not on a common scale.
- **A knife changed shape when a second was loaded.** Same data, different picture.
- **Small differences looked enormous.** Two steels one point apart were pushed to
  opposite ends of the axis.
- **The two charts contradicted each other**, showing the same numbers on different
  scales in the same card.

Now: one absolute 0–100 scale, in both charts, always. Both read
`valueToFraction()` from `src/lib/chart.js`, so there is no second scaling path
that can drift. Context that rescaling used to smuggle in is shown explicitly —
labelled gridlines, and a dotted reference outline for the median steel.

### 2. Two of the four metrics carried no information

Measured across the 1003-row database:

| | before | after |
|---|---|---|
| `r(retention, sharpening)` | **−0.957** — and 609 rows had `retention + sharpening === 105` exactly | −0.725 |
| `chip` | **70 for 984 of 1003 rows** (4 distinct values total) | 24 distinct values, range 64–89 |

Half the radar was drawing one number twice and a constant. `src/lib/steel-science.js`
now derives all four from carbide chemistry — carbon is partitioned among Nb, V,
W, Mo and Cr carbides, and the same carbide inventory is weighted three different
ways:

- **retention** by absolute carbide hardness (cementite counts fully)
- **sharpening** by hardness *relative to alumina abrasive* (~2100 HV) — vanadium
  carbide at 2800 HV dominates, cementite at 1000 HV barely registers
- **chip** by crack-initiation tendency, with a powder-metallurgy allowance

That difference in weighting is what decouples the axes. It also makes a real
property expressible that the old inverse formula made arithmetically impossible:
a carbon steel that both holds an edge and sharpens easily.

**corrosion** uses PREN on chromium *in solution*, not total chromium — and only
on dissolved molybdenum. Counting total Mo had rated HAP-40 (5% Mo, nearly all of
it locked in carbides) as corrosion-resistant as a stainless.

Fit against your 31 hand-curated steels: retention R² 0.92, corrosion R² 0.95,
sharpening R² 0.78, chip R² 0.51. Chip is weakest because only 19 of the 31 curated
chip values were real judgements — the other 12 were the placeholder 70, and the
calibrator excludes them so they cannot drag the axis flat.

### 3. The search guessed, silently

Three separate bugs:

**No word boundaries.** `detectSteel` was `norm(text).includes(key)`. The key `r2`
is two characters, so any product whose text contained those letters anywhere
resolved to R2 steel. Commit `ee362ca` reverted a boundary fix because it broke
`aus8` and `vg10` instead — the check was applied to raw substrings, where
tightening for `r2` necessarily breaks `aus8`.

Now text is tokenised and a key matches only as the concatenation of a run of
whole tokens. `vg10` matches `["vg","10"]`; `r2` does not match `master2`, because
that is one token. Both cases work, no trade-off.

**Separators were significant.** `norm()` preserved hyphens, so `vg-10` and `vg10`
were different keys. It only worked because both spellings were hand-enumerated —
100 alias keys, 71 unique, and `if (!steels[alias])` silently discarded the other
29. Now everything squashes to a separator-free form; the spelling aliases are
redundant.

**`products[0]`, always.** The first Shopify result was accepted with no quality
check and shown with the same confidence as an exact match. And the steel-name
shortcut ran *before* any product search and returned immediately, so a query
naming a steel could never reach the catalogue.

Now both lookups run and compete on one 0–1 scale. A clear winner resolves
directly; anything else offers the candidates. `VG-10` still goes straight to the
steel card, a pasted product title still goes straight to the product, but
`gyuto 210` now asks instead of guessing.

---

## Also fixed

**The tiny-bars bug is no longer reachable.** Airtable holds the pre-migration
0–10 scores and the ×10 bridge had been removed, so 0–10 data flowed into a 0–100
UI with no error. `detectScoreScale()` infers the scale from the batch and
normalises on arrival — **legacy rows now render correctly without re-importing
anything.**

**Search race condition.** No request carried an `AbortSignal`, so two searches in
one slot both wrote their result and the slower one won by arriving last. The panel
showed a knife the user had already searched past, with no error. Each slot now
owns an `AbortController` and a request id; superseded responses are dropped.
`test/useKnifeSlots.test.jsx` reproduces the old behaviour and fails without the fix.

**Failures are visible.** A steel-database outage used to be a `console.error` and
an empty chart — indistinguishable from "no steel detected". It now says so. Weak
or ambiguous steel detection is flagged on the card rather than presented as fact.

**`https://www.musashihamono.com/`** produced the handle `www.musashihamono.com`
via a "last path segment" fallback, then a confusing 404. It now reports that the
link doesn't point at a product.

---

## File map

```
src/lib/
  steel-science.js    composition → the four metrics. Carbide model + fitted constants.
  steel-data.js       the one boundary where raw records become app data.
                      Scale detection, validation, provenance flags.
  steel-match.js      tokenisation, index, detection, query classification.
  resolve.js          query → knife, or → candidates, or → a specific error.
  chart.js            geometry and the single absolute scale both charts read.
  api.js              every network call. Abort signals, caching, error shaping.
  utils.js            formatting and DOM helpers only.

src/hooks/
  useSteelsData.js    steel fetch + index + median reference
  useKnowledgeBase.js KB fetch + grouping + search
  useKnifeSlots.js    per-slot state, cancellation, candidate selection

src/components/
  SiteHeader.jsx      header + logo easter egg
  ReferenceDrawer.jsx the slide-out KB panel (~170 lines lifted out of App.jsx)
  CandidateList.jsx   the choice the app used to make silently
  App.jsx             layout shell — 525 lines → ~190

scripts/
  calibrate-scoring.mjs        fits the model against the frozen curated 31
  rescore-steels.mjs           recomputes steels.csv from composition
  steels-curated-reference.csv frozen originals — the calibration target.
                               DO NOT REGENERATE.
  lib/csv.mjs                  RFC-4180 reader/writer

test/                          96 tests
```

### Why `steels-curated-reference.csv` must not be regenerated

`calibrate-scoring.mjs` fits the model against the hand-assigned scores. Once
`rescore-steels.mjs` has written the model's own output into `steels.csv`, fitting
against that file would fit the model to itself and report a perfect, meaningless
result. The frozen copy keeps the expert judgement as an independent reference.

---

## What you still need to do

1. **Review the diff and push.** Netlify deploys from `main`; git push has to come
   from your terminal.

2. **Import `scripts/airtable-steels-import.csv` into Airtable** — "update existing
   records", matched on `label`. This replaces the 0–10 values and the placeholder
   chip scores. *Not urgent* — the proxy handles legacy data — but it removes the
   fallback and stops Airtable contradicting the repo.

3. **Sanity-check the rescored steels.** `scripts/rescore-audit.csv` has old vs new
   for all 1003. The visible 31 moved by at most 20 points; the ones worth your eye
   are White Steel #1–3 and SK Steel, where sharpening dropped from the old ceiling
   of 90–100 into the high 70s/low 80s. The model says they are still the easiest
   steels to sharpen — it just doesn't award them a perfect score.

4. **Not addressed:** price/currency detection for zakuknives.com and kap-kam.com
   (`scrape-steel.js`). Left alone deliberately — it's independent of the search and
   chart work, and I couldn't reach either site from this sandbox to test against
   real markup.

5. **Optional:** enabling more of the 972 `available=false` steels is now safer —
   they are scored by the same model as the visible 31, rather than on a separate
   algorithmic scale, so mixing them no longer mixes incompatible number systems.
   The matcher also reports key collisions (`index.collisions`) instead of silently
   picking a winner.

---

## Commands

```bash
npm test                              # 96 tests
npm run build
node scripts/calibrate-scoring.mjs    # report model fit; --write to refit constants
node scripts/rescore-steels.mjs       # dry run; --write to regenerate CSVs
```
