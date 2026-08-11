import { CAT_TEXT, CAT_BG } from "../lib/constants.js";
import Collapsible from "./Collapsible.jsx";

export default function SteelProfile({ steel, tags, isMobile, unavailableLabel }) {
  if (!steel) {
    return (
      <Collapsible title="Steel Profile" open={!isMobile}>
        {unavailableLabel ? (
          <div style={{ fontSize: 13, color: "#c08020", lineHeight: 1.6, marginBottom: tags?.length ? 12 : 0 }}>
            ⚠ {unavailableLabel} is currently marked unavailable in store and is excluded from the comparison chart.
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#9a9a94", marginBottom: tags?.length ? 12 : 0 }}>
            Steel not identified from product data.
          </div>
        )}
        {tags?.length > 0 && (
          <>
            <div style={{
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#c0c0ba", marginBottom: 8,
            }}>
              Product Tags
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  padding: "3px 10px", border: "1px solid #e0e0da",
                  fontSize: 11, color: "#9a9a94", borderRadius: 2,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </Collapsible>
    );
  }

  const tc = CAT_TEXT[steel.cat] || "#606060";
  const bc = CAT_BG[steel.cat]   || "#f5f5f0";

  return (
    <Collapsible title="Steel Profile" open={!isMobile}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span style={{
          padding: "3px 10px", background: bc, color: tc, borderRadius: 2,
          fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500,
        }}>
          {steel.cat}
        </span>
        {steel.maker && <span style={{ fontSize: 11, color: "#9a9a94" }}>{steel.maker}</span>}
        {steel.hrc   && <span style={{ fontSize: 11, color: "#9a9a94" }}>HRC {steel.hrc}</span>}
      </div>

      <p style={{ fontSize: 13, color: "#5a5a56", lineHeight: 1.75, marginBottom: 16 }}>
        {steel.desc}
      </p>

      {steel.comp && Object.keys(steel.comp).length > 0 && (
        <>
          <div style={{
            fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#c0c0ba", marginBottom: 10,
          }}>
            Composition
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(steel.comp).map(([el, val]) => (
              <div key={el} style={{
                padding: "5px 10px", border: "1px solid #e8e8e3",
                background: "#fafaf8", borderRadius: 2,
              }}>
                <span style={{
                  fontSize: 9, color: tc, marginRight: 4,
                  fontWeight: 500, letterSpacing: "0.05em",
                }}>
                  {el}
                </span>
                <span style={{ fontSize: 11, color: "#3a3a36" }}>{val}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Collapsible>
  );
}
