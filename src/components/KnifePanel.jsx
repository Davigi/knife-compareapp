import { ACCENTS, CAT_TEXT, CAT_BG } from "../lib/constants.js";
import { fmtPrice, htmlToText } from "../lib/utils.js";
import { useIsMobile } from "../lib/utils.js";
import Collapsible from "./Collapsible.jsx";
import SteelProfile from "./SteelProfile.jsx";

export default function KnifePanel({
  index, knife, input, loading, error,
  onInput, onSearch, onScan, onRemove, steelUnavailable, onNote,
}) {
  const accent  = ACCENTS[index];
  const isMobile = useIsMobile();

  const CURRENCY_SYMBOLS = { JPY: "¥", USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$" };
  const currency       = knife?.currency || "JPY";  // Musashi products always JPY
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const isJPY          = currency === "JPY";
  const taxFree        = knife && isJPY && !isNaN(knife.price) ? Math.round(knife.price * 0.94) : null;

  return (
    <div style={{ border: "1px solid #e8e8e3", background: "#ffffff", position: "relative", minHeight: 200 }}>
      {/* Accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: accent }} />

      {/* Search bar */}
      <div style={{
        display: "flex", gap: 8, padding: "14px 14px 12px 16px", flexWrap: "wrap",
        borderBottom: "1px solid #f0f0ea",
      }}>
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="URL, handle or reference…"
          style={{
            flex: "1 1 140px", minWidth: 0, background: "#fafaf8",
            border: "1px solid #e0e0da", color: "#1a1a16",
            fontSize: 13, padding: "10px 12px", borderRadius: 2,
          }}
        />
        <button
          onClick={onScan}
          title="Scan barcode"
          style={{
            flexShrink: 0, background: "none", border: "1px solid #e0e0da",
            color: "#9a9a94", width: 40, cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2,
          }}
        >
          ◎
        </button>
        <button
          onClick={onSearch}
          disabled={!input.trim() || loading}
          style={{
            flexShrink: 0,
            background: !input.trim() || loading ? "#f0f0ea" : "#111111",
            border: "none",
            color: !input.trim() || loading ? "#c0c0ba" : "#ffffff",
            fontSize: 11, fontWeight: 500, letterSpacing: "0.1em",
            padding: "10px 16px",
            cursor: loading ? "not-allowed" : "pointer",
            textTransform: "uppercase", whiteSpace: "nowrap", borderRadius: 2,
          }}
        >
          {loading ? "···" : "Search"}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            style={{
              flexShrink: 0, background: "none", border: "1px solid #e0e0da",
              color: "#c0c0ba", width: 36, cursor: "pointer", fontSize: 18, borderRadius: 2,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "40px 0" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: "50%", background: accent,
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: "16px 20px", color: "#c03030", fontSize: 13 }}>⚠ {error}</div>
      )}

      {/* Empty state */}
      {!knife && !loading && !error && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#d0d0ca", fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>◇</div>
          Knife {index + 1}
        </div>
      )}

      {/* Knife data */}
      {knife && !loading && (
        <div style={{ padding: "0 18px 20px 20px" }}>
          {/* Image / placeholder */}
          {knife.steelOnly ? (
            <div style={{
              width: "100%", aspectRatio: "4/3",
              background: "#f5f5f0",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 8, marginBottom: 16,
              borderBottom: "1px solid #f0f0ea",
            }}>
              <div style={{ fontSize: 36, color: "#d8d8d3" }}>◇</div>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#c0c0ba" }}>
                Steel reference
              </div>
            </div>
          ) : knife.image ? (
            <a
              href={knife.externalUrl || `https://www.musashihamono.com/products/${knife.handle}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "block", marginBottom: 16 }}
            >
              <img
                src={knife.image} alt={knife.title}
                style={{
                  width: "100%", aspectRatio: "4/3", objectFit: "contain",
                  background: "#fafaf8", display: "block", borderBottom: "1px solid #f0f0ea",
                }}
              />
            </a>
          ) : null}

          {knife.steel && !steelUnavailable && (
            <div style={{
              display: "inline-block", padding: "3px 10px", marginBottom: 10,
              background: CAT_BG[knife.steel.cat] || "#f0f0ea",
              color: CAT_TEXT[knife.steel.cat] || "#606060",
              fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
              fontWeight: 500, borderRadius: 2,
            }}>
              {knife.steel.cat}
            </div>
          )}
          {knife.steel && steelUnavailable && (
            <div style={{
              display: "inline-block", padding: "3px 10px", marginBottom: 10,
              background: "#fdf0e0", color: "#c08020",
              fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
              fontWeight: 500, borderRadius: 2,
            }}>
              Steel Unavailable
            </div>
          )}

          <div style={{ fontSize: 18, fontWeight: 400, lineHeight: 1.4, color: "#1a1a16", marginBottom: 6, letterSpacing: "0.01em" }}>
            {knife.title}
          </div>

          {knife.type && (
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#b0b0aa", marginBottom: 14, fontWeight: 400 }}>
              {knife.type}
            </div>
          )}

          {/* Price — hidden for steel-only entries */}
          {!knife.steelOnly && !isNaN(knife.price) && (
            <div style={{
              display: "flex", gap: 24, alignItems: "flex-start",
              padding: "14px 0", marginBottom: 14,
              borderTop: "1px solid #e8e8e3", borderBottom: "1px solid #e8e8e3",
            }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b0b0aa", marginBottom: 4, fontWeight: 400 }}>Price</div>
                <div style={{ fontSize: 22, fontWeight: 300, color: "#1a1a16" }}>
                  <span style={{ fontSize: 13, color: "#9a9a94", marginRight: 1 }}>{currencySymbol}</span>
                  {fmtPrice(knife.price)}
                </div>
              </div>
              {taxFree && (
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2a7a40", marginBottom: 4, fontWeight: 400 }}>Tax-Free −6%</div>
                  <div style={{ fontSize: 22, fontWeight: 300, color: "#2a7a40" }}>
                    <span style={{ fontSize: 13, color: "#5aaa70", marginRight: 1 }}>¥</span>
                    {fmtPrice(taxFree)}
                  </div>
                </div>
              )}
            </div>
          )}

          {knife.specs.length > 0 && (
            <Collapsible title="Technical Specifications" open={!isMobile}>
              {knife.specs.map((s, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  padding: "6px 0", borderBottom: "1px solid #f0f0ea", gap: 12,
                }}>
                  <span style={{ fontSize: 12, color: "#9a9a94", flexShrink: 0 }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: "#3a3a36", textAlign: "right" }}>{s.value}</span>
                </div>
              ))}
            </Collapsible>
          )}

          <SteelProfile
            steel={steelUnavailable ? null : knife.steel}
            unavailableLabel={steelUnavailable ? knife.steel?.label : null}
            tags={knife.tags}
            isMobile={isMobile}
          />

          <Collapsible title="Description">
            <div style={{ fontSize: 13, color: "#6b6b66", lineHeight: 1.8 }}>
              {htmlToText(knife.description)}
            </div>
          </Collapsible>

          {knife.handle && (
            <div style={{ paddingTop: 14, marginTop: 4, borderTop: "1px solid #f0f0ea" }}>
              <button
                onClick={onNote}
                style={{
                  background: "none", border: "1px solid #e0e0da", color: "#9a9a94",
                  fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "8px 16px", cursor: "pointer", borderRadius: 2, width: "100%",
                }}
              >
                ⚑ Report an issue with this product
              </button>
            </div>
          )}
          {knife.externalUrl && (
            <div style={{ paddingTop: 14, marginTop: 4, borderTop: "1px solid #f0f0ea" }}>
              <a
                href={knife.externalUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "block", textAlign: "center", border: "1px solid #e0e0da",
                  color: "#9a9a94", fontSize: 10, letterSpacing: "0.12em",
                  textTransform: "uppercase", padding: "8px 16px", borderRadius: 2,
                }}
              >
                ↗ View original page
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
