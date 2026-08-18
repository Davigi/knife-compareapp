import { ACCENTS } from "../lib/constants.js";
import {
  AXES, METRIC_META, GRID_TICKS, axisPoint, steelPolygon, gridPolygon,
  chartableKnives, valueToFraction,
} from "../lib/chart.js";

/**
 * DiamondChart — four-axis radar on a fixed 0–100 scale.
 *
 * Every axis runs 0 at the centre to 100 at the rim, always. A polygon therefore
 * means the same thing whether one knife is loaded or three, and shapes can be
 * compared between sessions. See src/lib/chart.js for what the previous relative
 * scaling was doing and why it had to go.
 *
 * `reference` is the median steel across the database; it is drawn as a faint
 * dotted outline so a reader can see whether a knife is unusual without the axes
 * being distorted to manufacture that impression.
 */

const W = 400, H = 400;
const GEOM = { cx: 200, cy: 176, r: 112 };
const DASHES = ["", "7 3", "2 3"];
const LBL = { fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.1em", fill: "#9a9a94" };

const AXIS_LABEL_POS = [
  { dx: 0, dy: -18, anchor: "middle" },
  { dx: 14, dy: 4, anchor: "start" },
  { dx: 0, dy: 22, anchor: "middle" },
  { dx: -14, dy: 4, anchor: "end" },
];

export default function DiamondChart({ knives, reference = null }) {
  const entries = chartableKnives(knives);
  if (!entries.length) return null;

  const referencePoly = reference ? steelPolygon(reference, GEOM) : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", maxWidth: 440, display: "block", margin: "0 auto" }}
        role="img"
        aria-label={
          "Steel comparison on four axes, each scaled 0 to 100. " +
          entries.map(({ knife }) =>
            `${knife.title}: ` + AXES.map((k) => `${METRIC_META[k].label} ${Math.round(knife.steel[k])}`).join(", ")
          ).join(". ")
        }
      >
        {/* Gridlines at fixed values, so the rings are readable quantities */}
        {GRID_TICKS.map((tick) => (
          <polygon
            key={tick}
            points={gridPolygon(tick, GEOM)}
            fill="none"
            stroke={tick === 100 ? "#d0d0ca" : "#ecece6"}
            strokeWidth={tick === 100 ? 1.2 : 0.8}
          />
        ))}

        {/* Spokes */}
        {AXES.map((_, i) => {
          const [x, y] = axisPoint(i, 1, GEOM);
          return <line key={i} x1={GEOM.cx} y1={GEOM.cy} x2={x} y2={y} stroke="#e4e4de" strokeWidth={0.8} />;
        })}

        {/* Ring values — the number the old chart could never show, because the
            rings did not correspond to any fixed value */}
        {GRID_TICKS.map((tick) => {
          const [, y] = axisPoint(0, valueToFraction(tick), GEOM);
          return (
            <text key={tick} x={GEOM.cx + 4} y={y + 9} {...LBL} fontSize={7.5} fill="#cdcdc6" textAnchor="start">
              {tick}
            </text>
          );
        })}

        {/* Reference outline: where a typical steel sits */}
        {referencePoly && (
          <polygon points={referencePoly} fill="none" stroke="#c8c8c2" strokeWidth={1} strokeDasharray="1 4" />
        )}

        {/* Knife polygons */}
        {entries.map(({ knife, index }) => {
          const poly = steelPolygon(knife.steel, GEOM);
          const color = ACCENTS[index];
          return (
            <g key={`shape-${index}`}>
              <polygon points={poly} fill={`${color}18`} stroke="none" />
              <polygon
                points={poly} fill="none" stroke={color} strokeWidth={2}
                strokeDasharray={DASHES[index]} strokeLinejoin="round"
              />
              {AXES.map((key, axis) => {
                const [x, y] = axisPoint(axis, valueToFraction(Number(knife.steel[key])), GEOM);
                return <circle key={axis} cx={x} cy={y} r={3} fill={color} />;
              })}
            </g>
          );
        })}

        {/* Axis labels */}
        {AXES.map((key, i) => {
          const [x, y] = axisPoint(i, 1, GEOM);
          const pos = AXIS_LABEL_POS[i];
          return (
            <text key={key} x={x + pos.dx} y={y + pos.dy} textAnchor={pos.anchor} {...LBL}>
              {METRIC_META[key].short}
            </text>
          );
        })}

        {/* Legend */}
        {entries.map(({ knife, index }, row) => {
          const y = H - 12 - (entries.length - 1 - row) * 17;
          const estimated = knife.steel.scoreSource !== "computed" || knife.steel.hrcEstimated;
          const title = knife.steel.label || knife.title || "";
          return (
            <g key={`legend-${index}`}>
              <line x1={8} y1={y - 1} x2={24} y2={y - 1} stroke={ACCENTS[index]} strokeWidth={2} strokeDasharray={DASHES[index]} />
              <text x={28} y={y + 3} textAnchor="start" {...LBL} fill="#6b6b66">
                {title.slice(0, 30)}{title.length > 30 ? "…" : ""}
                {estimated && <tspan fill="#b8b8b2"> · est.</tspan>}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{
        textAlign: "center", fontSize: 9, color: "#c0c0ba",
        letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4,
      }}>
        All axes 0–100{reference ? " · dotted outline: typical steel" : ""}
      </div>
    </div>
  );
}
