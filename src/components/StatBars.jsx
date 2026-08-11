import { ACCENTS } from "../lib/constants.js";

const METRIC_LABELS = [
  { label: "Edge Retention",     key: "retention" },
  { label: "Chip Resistance",    key: "chip" },
  { label: "Corrosion Res.",     key: "corrosion" },
  { label: "Ease of Sharpening", key: "sharpening" },
];

export default function StatBars({ knives }) {
  return (
    <div style={{ marginTop: 24 }}>
      {METRIC_LABELS.map(({ label, key }) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#9a9a94", fontWeight: 400,
            }}>
              {label}
            </span>
            <div style={{ display: "flex", gap: 12 }}>
              {knives.map((k, i) => {
                const v = k?.steel?.[key];
                if (v == null) return null;
                return (
                  <span key={i} style={{ fontSize: 11, color: ACCENTS[i], fontWeight: 500 }}>
                    {v * 10}
                    <span style={{ fontSize: 9, color: "#c0c0ba", fontWeight: 300 }}>/100</span>
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ position: "relative", height: 4, background: "#f0f0ea", borderRadius: 2 }}>
            {knives.map((k, i) => {
              const v = k?.steel?.[key];
              if (v == null) return null;
              return (
                <div key={i} style={{
                  position: "absolute", top: i * 1, height: 2, borderRadius: 1,
                  width: `${v * 10}%`, background: ACCENTS[i],
                  opacity: 0.8, transition: "width .5s ease",
                }} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
