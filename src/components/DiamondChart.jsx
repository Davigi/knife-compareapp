import { ACCENTS, METRICS } from "../lib/constants.js";
import { computeRanges, scaleFrac } from "../lib/utils.js";

const W = 400, H = 360, cx = 200, cy = 155, R = 108;

function pt(axis, frac) {
  const d = frac * R;
  if (axis === 0) return [cx, cy - d];
  if (axis === 1) return [cx + d, cy];
  if (axis === 2) return [cx, cy + d];
  return [cx - d, cy];
}

function toPoly(steel, ranges) {
  return [
    pt(0, scaleFrac(steel.retention,  ranges.retention.lo,  ranges.retention.hi)),
    pt(1, scaleFrac(steel.chip,       ranges.chip.lo,       ranges.chip.hi)),
    pt(2, scaleFrac(steel.corrosion,  ranges.corrosion.lo,  ranges.corrosion.hi)),
    pt(3, scaleFrac(steel.sharpening, ranges.sharpening.lo, ranges.sharpening.hi)),
  ].map((p) => p.join(",")).join(" ");
}

function gridPoly(f) {
  return [pt(0, f), pt(1, f), pt(2, f), pt(3, f)].map((p) => p.join(",")).join(" ");
}

const DASHES = ["", "7 3", "2 3"];
const LBL = { fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.1em", fill: "#9a9a94" };

export default function DiamondChart({ knives }) {
  const ranges = computeRanges(knives);
  const isRelative = knives.filter((k) => k?.steel).length >= 2;

  const active = knives.map((k, i) =>
    k?.steel
      ? { poly: toPoly(k.steel, ranges), color: ACCENTS[i], dash: DASHES[i], title: k.title || "" }
      : null
  );
  const activeCount = active.filter(Boolean).length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 420, display: "block", margin: "0 auto" }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={gridPoly(f)} fill="none"
            stroke={f === 1 ? "#d0d0ca" : "#eaeae4"} strokeWidth={f === 1 ? 1.2 : 0.8} />
        ))}
        {[0, 1, 2, 3].map((i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e4e4de" strokeWidth={0.8} />;
        })}
        {active.map((p, i) => p && (
          <polygon key={"f" + i} points={p.poly} fill={p.color + "18"} stroke="none" />
        ))}
        {active.map((p, i) => p && (
          <polygon key={"s" + i} points={p.poly} fill="none"
            stroke={p.color} strokeWidth={2} strokeDasharray={p.dash} strokeLinejoin="round" />
        ))}
        {active.map((p, i) => p && toPoly(knives[i].steel, ranges).split(" ").map((s, j) => {
          const [x, y] = s.split(",").map(Number);
          return <circle key={"d" + i + j} cx={x} cy={y} r={3} fill={p.color} />;
        }))}
        <text x={cx}     y={cy - R - 16} textAnchor="middle" {...LBL}>EDGE RETENTION</text>
        <text x={cx+R+12} y={cy + 4}     textAnchor="start"  {...LBL}>CHIP RES.</text>
        <text x={cx}     y={cy + R + 20} textAnchor="middle" {...LBL}>CORROSION RES.</text>
        <text x={cx-R-12} y={cy + 4}     textAnchor="end"    {...LBL}>SHARPENING</text>
        {active.map((p, i) => {
          if (!p) return null;
          const ly = H - 14 - (activeCount - 1 - active.slice(0, i).filter(Boolean).length) * 18;
          return (
            <g key={"l" + i}>
              <line x1={8} y1={ly - 1} x2={24} y2={ly - 1} stroke={p.color} strokeWidth={2} strokeDasharray={p.dash} />
              <text x={28} y={ly + 3} textAnchor="start" {...LBL} fill="#6b6b66" fontSize={9}>
                {p.title.slice(0, 34)}{p.title.length > 34 ? "…" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {isRelative && (
        <div style={{
          textAlign: "center", fontSize: 10, color: "#aaaaaa",
          letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6,
        }}>
          Chart scaled relative to loaded knives
        </div>
      )}
    </div>
  );
}
