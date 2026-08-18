import { ACCENTS } from "../lib/constants.js";
import { AXES, METRIC_META, chartableKnives, valueToFraction, medianSteel } from "../lib/chart.js";

/**
 * StatBars — the same four metrics as DiamondChart, on the same absolute 0–100
 * scale, reading from the same helpers in src/lib/chart.js.
 *
 * Previously the bars used raw values as percentage widths while the radar chart
 * rescaled everything relative to the loaded knives, so the two charts told
 * different stories about identical numbers. They now cannot diverge.
 *
 * Bars are stacked in their own rows rather than overlaid at 2px offsets, which
 * is what made a three-way comparison unreadable, and each row is labelled with
 * its value and a marker for the median steel.
 */

export default function StatBars({ knives, reference = null, allSteels = [] }) {
  const entries = chartableKnives(knives);
  if (!entries.length) return null;

  const median = reference ?? medianSteel(allSteels);

  return (
    <div style={{ marginTop: 26 }}>
      {AXES.map((key) => {
        const values = entries.map(({ knife, index }) => ({
          index,
          value: Number(knife.steel[key]),
          estimated: knife.steel.scoreSource !== "computed",
        }));
        const best = Math.max(...values.map((v) => v.value));

        return (
          <div key={key} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span
                title={METRIC_META[key].help}
                style={{
                  fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "#9a9a94", fontWeight: 400, cursor: "help",
                }}
              >
                {METRIC_META[key].label}
              </span>
              {median && (
                <span style={{ fontSize: 9, color: "#c8c8c2", letterSpacing: "0.06em" }}>
                  typical {median[key]}
                </span>
              )}
            </div>

            {/* One row per knife — overlaying them made three-way reads impossible */}
            {values.map(({ index, value, estimated }) => (
              <div key={index} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                <div style={{ position: "relative", flex: 1, height: 6, background: "#f2f2ec", borderRadius: 3 }}>
                  <div
                    style={{
                      position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 3,
                      width: `${valueToFraction(value) * 100}%`,
                      background: ACCENTS[index],
                      opacity: value === best ? 0.95 : 0.65,
                      transition: "width .45s cubic-bezier(.4,0,.2,1)",
                    }}
                  />
                  {/* Median tick: context without rescaling the axis */}
                  {median && (
                    <div
                      title={`Typical steel: ${median[key]}`}
                      style={{
                        position: "absolute", top: -2, bottom: -2,
                        left: `${valueToFraction(median[key]) * 100}%`,
                        width: 1, background: "#d4d4ce",
                      }}
                    />
                  )}
                </div>
                <span style={{
                  fontSize: 11, color: ACCENTS[index], fontWeight: 500,
                  minWidth: 42, textAlign: "right", fontVariantNumeric: "tabular-nums",
                }}>
                  {Math.round(value)}
                  <span style={{ fontSize: 9, color: "#c0c0ba", fontWeight: 300 }}>/100</span>
                  {estimated && <span style={{ color: "#d0d0ca" }} title="Estimated from composition">*</span>}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
