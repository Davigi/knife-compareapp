import { useState } from "react";
import InfoPanel from "./InfoPanel.jsx";

/**
 * ReferenceDrawer — the slide-out knowledge base: search, section tabs, results.
 *
 * This was roughly 170 lines of JSX inline in App.jsx, including the search box,
 * the results list with its own per-item expand/collapse state, and the section
 * tab strip. Moving it here is most of the reason App.jsx drops from 525 lines to
 * a layout shell.
 */

const PREVIEW_CHARS = 160;

function ResultItem({ item }) {
  const [expanded, setExpanded] = useState(false);
  const body = String(item.d ?? "");
  const needsMore = body.length > PREVIEW_CHARS;
  const isWiki = item.cat === "Wiki";

  return (
    <div style={{ paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid #f0f0ea" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {item.img && (
          <img src={item.img} alt={item.n}
            style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 5 }}>
            <span style={{
              fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#b0b0aa", background: "#f5f5f0", padding: "2px 7px", borderRadius: 2,
            }}>
              {item.cat}
            </span>
            {item.group && (
              <span style={{ fontSize: 9, color: "#c0c0ba", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {item.group}
              </span>
            )}
            {isWiki && item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer" title="View source document"
                style={{ marginLeft: "auto", flexShrink: 0, fontSize: 14, color: "#c0c0ba", textDecoration: "none", lineHeight: 1 }}>
                ⓘ
              </a>
            )}
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a16", marginBottom: 5 }}>{item.n}</div>
          <div style={{ fontSize: 12, color: "#8a8a84", lineHeight: 1.65 }}>
            {expanded || !needsMore ? body : `${body.slice(0, PREVIEW_CHARS)}…`}
          </div>

          {needsMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 7, background: "none", border: "none", padding: 0,
                cursor: "pointer", fontSize: 11, color: "#9a9a94", letterSpacing: "0.06em",
              }}
            >
              {expanded ? "Show less ↑" : "Read more ↓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReferenceDrawer({
  open, onClose, kb, section, onSection,
}) {
  const { infoMap, sections, query, setQuery, results, status, error } = kb;

  return (
    <>
      {open && (
        <div onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 100 }} />
      )}

      <div style={{
        position: "fixed", top: 0, right: 0, width: "min(440px,100vw)", height: "100vh",
        background: "#ffffff", zIndex: 101, overflowY: "auto", padding: 28,
        borderLeft: "1px solid #e8e8e3",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .32s cubic-bezier(.4,0,.2,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "#b0b0aa", textTransform: "uppercase" }}>
            Reference Guide
          </span>
          <button onClick={onClose} aria-label="Close"
            style={{ background: "none", border: "none", color: "#c0c0ba", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ position: "relative", marginBottom: 24 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search metals, shapes, makers…"
            style={{
              width: "100%", boxSizing: "border-box", background: "#fafaf8",
              border: "1px solid #e0e0da", color: "#1a1a16", fontSize: 13,
              padding: "10px 36px 10px 12px", borderRadius: 2, outline: "none",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search"
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#c0c0ba", cursor: "pointer",
                fontSize: 18, lineHeight: 1, padding: 0,
              }}>
              ×
            </button>
          )}
        </div>

        {/* A failed load used to be a silent console message and an empty panel. */}
        {status === "error" && (
          <div style={{ fontSize: 12, color: "#c03030", marginBottom: 16 }}>⚠ {error}</div>
        )}

        {results !== null ? (
          <div>
            <div style={{ fontSize: 11, color: "#b0b0aa", marginBottom: 20 }}>
              {results.length === 0
                ? `No results for "${query}"`
                : `${results.length} result${results.length === 1 ? "" : "s"}`}
            </div>
            {results.map((item, i) => <ResultItem key={`${item.cat}-${item.n}-${i}`} item={item} />)}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 28 }}>
              {sections.map((key) => (
                <button key={key} onClick={() => onSection(key)}
                  style={{
                    padding: "5px 14px",
                    border: `1px solid ${section === key ? "#111111" : "#e0e0da"}`,
                    background: section === key ? "#111111" : "transparent",
                    color: section === key ? "#ffffff" : "#9a9a94",
                    fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    cursor: "pointer", transition: "all .2s", borderRadius: 2,
                  }}>
                  {key}
                </button>
              ))}
            </div>
            <InfoPanel section={section} infoMap={infoMap} />
          </>
        )}
      </div>
    </>
  );
}
