import { ACCENTS } from "../lib/constants.js";

/**
 * CandidateList — the choice the app used to make silently.
 *
 * When a query does not have one clearly best answer, the resolver hands back the
 * plausible options and they are shown here. Previously `products[0]` was accepted
 * unconditionally, so an ambiguous query produced a confidently-wrong result with
 * no indication that other candidates existed.
 *
 * Steel matches and product matches are listed together, tagged, in score order.
 */
export default function CandidateList({ candidates, accentIndex = 0, onChoose, notice }) {
  if (!candidates?.length) return null;
  const accent = ACCENTS[accentIndex];

  return (
    <div style={{ padding: "14px 18px 18px 20px" }}>
      <div style={{
        fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "#b0b0aa", marginBottom: 4,
      }}>
        Did you mean
      </div>
      <div style={{ fontSize: 11, color: "#c0c0ba", marginBottom: 12, lineHeight: 1.5 }}>
        {notice || "More than one match — pick the right one."}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onChoose(c)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", textAlign: "left", cursor: "pointer",
              background: "#fafaf8", border: "1px solid #e8e8e3", borderRadius: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e8e8e3"; }}
          >
            <span style={{
              flexShrink: 0, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "3px 7px", borderRadius: 2,
              background: c.kind === "steel" ? "#eef2f8" : "#f2f2ec",
              color: c.kind === "steel" ? "#4a6a90" : "#9a9a94",
            }}>
              {c.kind === "steel" ? "Steel" : "Product"}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: 13, color: "#1a1a16", lineHeight: 1.35 }}>
                {c.label}
              </span>
              {c.sublabel && (
                <span style={{ display: "block", fontSize: 10, color: "#b0b0aa", marginTop: 2 }}>
                  {c.sublabel}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
