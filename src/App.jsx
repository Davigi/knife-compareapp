import { useState, useEffect, useMemo } from "react";

import { KB_HEADINGS } from "./lib/constants.js";
import {
  norm, isUrl, extractHandle, detectSteel,
  parseSpecs, buildInfoMap, useIsMobile,
} from "./lib/utils.js";

import KnifePanel  from "./components/KnifePanel.jsx";
import DiamondChart from "./components/DiamondChart.jsx";
import StatBars    from "./components/StatBars.jsx";
import InfoPanel   from "./components/InfoPanel.jsx";
import NoteModal   from "./components/NoteModal.jsx";
import ScanModal   from "./components/ScanModal.jsx";
import KnifeGame   from "./components/KnifeGame.jsx";

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();

  // UI state
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [section,    setSection]    = useState("Metal");
  const [kbQuery,    setKbQuery]    = useState("");
  const [panelCount, setPanelCount] = useState(2);
  const [scanning,   setScanning]   = useState(null);
  const [noteIndex,  setNoteIndex]  = useState(null);
  const [logoClicks,    setLogoClicks]    = useState(0);
  const [showGame,      setShowGame]      = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  // Knife slots
  const [knives,  setKnives]  = useState([null, null, null]);
  const [inputs,  setInputs]  = useState(["", "", ""]);
  const [loading, setLoading] = useState([false, false, false]);
  const [errors,  setErrors]  = useState([null, null, null]);

  // Airtable data
  const [steelsData, setSteelsData] = useState({});
  const [kbData,     setKbData]     = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [steelsRes, kbRes] = await Promise.all([
          fetch("/.netlify/functions/airtable-proxy?resource=steels"),
          fetch("/.netlify/functions/airtable-proxy?resource=kb"),
        ]);
        if (steelsRes.ok) setSteelsData(await steelsRes.json());
        if (kbRes.ok)     setKbData(await kbRes.json());
      } catch (e) {
        console.error("airtable-proxy fetch error:", e);
      }
    })();
  }, []);

  // Derived — stable references via useMemo
  const steelPairs = useMemo(
    () =>
      Object.entries(steelsData)
        .map(([k, v]) => [norm(k), v])
        .sort((a, b) => b[0].length - a[0].length),
    [steelsData]
  );
  const infoMap  = useMemo(() => buildInfoMap(kbData), [kbData]);
  const SECTIONS = (Object.keys(infoMap).length ? Object.keys(infoMap) : Object.keys(KB_HEADINGS))
    .filter((k) => k !== "Wiki");

  // KB full-text search across all categories
  const kbResults = useMemo(() => {
    const q = kbQuery.trim().toLowerCase();
    if (!q) return null;
    const out = [];
    for (const [cat, data] of Object.entries(infoMap)) {
      for (const group of data.groups) {
        for (const item of group.items) {
          if (item.n.toLowerCase().includes(q) || item.d.toLowerCase().includes(q)) {
            out.push({ cat, group: group.name, ...item });
          }
        }
      }
    }
    return out;
  }, [kbQuery, infoMap]);

  // Array-slot helpers
  const setArr = (setter, i, val) =>
    setter((prev) => { const n = [...prev]; n[i] = val; return n; });

  // Product search
  const searchHandle = async (query) => {
    const qs = new URLSearchParams({
      resource: "search",
      q: query,
      "resources[type]": "product",
      "resources[limit]": "5",
      "resources[options][fields]": "title,product_type,variants.sku,tag,vendor",
    });
    const r = await fetch(`/.netlify/functions/shopify-proxy?${qs}`);
    if (!r.ok) throw new Error("Search error");
    const data = await r.json();
    const products = data?.resources?.results?.products;
    if (!products || products.length === 0)
      throw new Error(`No product found for "${query}"`);
    return products[0].url.split("/products/")[1].split("?")[0];
  };

  const fetchKnife = async (i) => {
    const input = inputs[i].trim();
    if (!input) return;
    setArr(setLoading, i, true);
    setArr(setErrors,  i, null);
    setArr(setKnives,  i, null);
    try {
      const isMusashi = input.includes("musashihamono.com");

      if (isUrl(input) && !isMusashi) {
        // ── External URL: scrape the page and detect steel client-side ──
        const qs = new URLSearchParams({ url: input });
        const r  = await fetch(`/.netlify/functions/scrape-steel?${qs}`);
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || `Could not fetch page (${r.status})`);
        }
        const data  = await r.json();
        const tags  = Array.isArray(data.tags) ? data.tags : [];
        const steel = detectSteel(tags, data.title || "", data.body || "", steelPairs);
        setArr(setKnives, i, {
          title:       data.title || input,
          image:       data.image || null,
          price:       data.price ?? NaN,
          currency:    data.currency || "",
          type:        null,
          vendor:      null,
          tags,
          description: data.description || "",
          specs:       [],
          steel,
          handle:      null,
          externalUrl: input,
        });
      } else {
        // ── Steel name shortcut — check BEFORE hitting any API ──
        // If the input looks like a known steel name (SG2, VG-10, Aogami, etc.)
        // show its profile directly without searching the Musashi shop.
        // This prevents "SG2" from returning a random Musashi knife in a different steel.
        if (!isMusashi) {
          const steelDirect = detectSteel([], input, "", steelPairs);
          if (steelDirect) {
            setArr(setKnives, i, {
              title: steelDirect.label || input, image: null,
              price: NaN, currency: "",
              type: null, vendor: null, tags: [],
              description: steelDirect.desc || "", specs: [],
              steel: steelDirect, handle: null, externalUrl: null, steelOnly: true,
            });
            return;
          }
        }

        // ── Musashi URL or keyword search ──
        let handle;
        if (isMusashi) {
          handle = extractHandle(input);
        } else {
          try {
            handle = await searchHandle(input);
          } catch {
            throw new Error(`No product or steel found for "${input}"`);
          }
        }

        const qs = new URLSearchParams({ resource: "products", handle, currency: "JPY" });
        const r  = await fetch(`/.netlify/functions/shopify-proxy?${qs}`);
        if (!r.ok) throw new Error(`Product not found: "${handle}"`);
        const data = await r.json();
        const p    = data?.product;
        if (!p) throw new Error("Invalid server response");
        const tags  = Array.isArray(p.tags) ? p.tags : (p.tags ? p.tags.split(", ") : []);
        const steel = detectSteel(tags, p.title || "", p.body_html || "", steelPairs);
        const specs = parseSpecs(p.body_html);
        setArr(setKnives, i, {
          title: p.title, image: p.images?.[0]?.src,
          price: parseFloat(p.variants?.[0]?.price || 0),
          currency: "JPY",
          type: p.product_type, vendor: p.vendor,
          tags, description: p.body_html, specs, steel, handle,
          externalUrl: null,
        });
      }
    } catch (err) {
      setArr(setErrors, i, err.message);
    } finally {
      setArr(setLoading, i, false);
    }
  };

  const removeThird = () => {
    setArr(setKnives, 2, null);
    setArr(setInputs, 2, "");
    setArr(setErrors, 2, null);
    setPanelCount(2);
  };

  const visibleKnives = knives.slice(0, panelCount);
  const hasChart      = visibleKnives.some((k) => k?.steel);

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8", color: "#1a1a16" }}>

      {/* ── Dark header ── */}
      <header style={{ background: "#111111", padding: "0 20px" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center", height: 60,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <img
              src="https://www.musashihamono.com/cdn/shop/files/musashi_horizontal_f26392c1-12f8-4add-8000-cb033f085aad.svg?v=1728878193"
              alt="Musashi"
              onClick={() => {
                const n = logoClicks + 1;
                setLogoClicks(n);
                if (n >= 10) { setLogoClicks(0); setShowGame(true); }
              }}
              style={{ height: 24, width: "auto", filter: "brightness(0) invert(1)", cursor: "pointer" }}
            />
            <span style={{
              fontSize: 10, fontWeight: 300, letterSpacing: "0.3em",
              color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
              borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 20,
            }}>
              Knife Guide
            </span>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 5 }}
          >
            {[0, 1, 2].map((j) => (
              <div key={j} style={{
                width: 22, height: 1, background: "rgba(255,255,255,0.7)", transition: "all .25s",
                transform: menuOpen
                  ? j === 0 ? "rotate(45deg) translate(4px,4px)"
                  : j === 2 ? "rotate(-45deg) translate(4px,-4px)"
                  : "none"
                  : "none",
                opacity: menuOpen && j === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>
      </header>

      {/* ── Menu overlay ── */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 100 }} />
      )}

      {/* ── Menu panel ── */}
      <div style={{
        position: "fixed", top: 0, right: 0, width: "min(440px,100vw)", height: "100vh",
        background: "#ffffff", zIndex: 101, overflowY: "auto", padding: 28,
        borderLeft: "1px solid #e8e8e3",
        transform: menuOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform .32s cubic-bezier(.4,0,.2,1)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "#b0b0aa", textTransform: "uppercase", fontWeight: 400 }}>
            Reference Guide
          </span>
          <button onClick={() => setMenuOpen(false)}
            style={{ background: "none", border: "none", color: "#c0c0ba", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <input
            value={kbQuery}
            onChange={(e) => setKbQuery(e.target.value)}
            placeholder="Search metals, shapes, makers…"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#fafaf8", border: "1px solid #e0e0da",
              color: "#1a1a16", fontSize: 13, padding: "10px 36px 10px 12px",
              borderRadius: 2, outline: "none",
            }}
          />
          {kbQuery && (
            <button
              onClick={() => setKbQuery("")}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#c0c0ba", cursor: "pointer",
                fontSize: 18, lineHeight: 1, padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Results mode */}
        {kbResults !== null ? (
          <div>
            <div style={{ fontSize: 11, color: "#b0b0aa", marginBottom: 20 }}>
              {kbResults.length === 0
                ? `No results for "${kbQuery}"`
                : `${kbResults.length} result${kbResults.length === 1 ? "" : "s"}`}
            </div>
            {kbResults.map((item, i) => {
              const isWiki     = item.cat === "Wiki";
              const itemKey    = `${item.cat}::${item.n}`;
              const isExpanded = expandedItems[itemKey];
              const PREVIEW    = 160;
              const needsMore  = item.d.length > PREVIEW;
              return (
                <div key={i} style={{
                  paddingBottom: 18, marginBottom: 18,
                  borderBottom: "1px solid #f0f0ea",
                }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {item.img && (
                      <img
                        src={item.img} alt={item.n}
                        style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Chips row */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 5 }}>
                        <span style={{
                          fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                          color: "#b0b0aa", background: "#f5f5f0",
                          padding: "2px 7px", borderRadius: 2,
                        }}>
                          {item.cat}
                        </span>
                        {item.group && (
                          <span style={{ fontSize: 9, color: "#c0c0ba", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            {item.group}
                          </span>
                        )}
                        {isWiki && item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View source document"
                            style={{
                              marginLeft: "auto", flexShrink: 0,
                              fontSize: 14, color: "#c0c0ba",
                              textDecoration: "none", lineHeight: 1,
                              transition: "color .15s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = "#6b6b66"}
                            onMouseLeave={(e) => e.currentTarget.style.color = "#c0c0ba"}
                          >
                            ⓘ
                          </a>
                        )}
                      </div>

                      {/* Title */}
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a16", marginBottom: 5 }}>
                        {item.n}
                      </div>

                      {/* Body */}
                      <div style={{ fontSize: 12, color: "#8a8a84", lineHeight: 1.65 }}>
                        {isExpanded || !needsMore
                          ? item.d
                          : item.d.slice(0, PREVIEW) + "…"}
                      </div>

                      {/* Expand / Collapse toggle */}
                      {needsMore && (
                        <button
                          onClick={() =>
                            setExpandedItems((prev) => ({
                              ...prev,
                              [itemKey]: !prev[itemKey],
                            }))
                          }
                          style={{
                            marginTop: 7, background: "none", border: "none",
                            padding: 0, cursor: "pointer",
                            fontSize: 11, color: "#9a9a94",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {isExpanded ? "Show less ↑" : "Read more ↓"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* Section tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 28 }}>
              {SECTIONS.map((key) => (
                <button key={key} onClick={() => setSection(key)}
                  style={{
                    padding: "5px 14px",
                    border: `1px solid ${section === key ? "#111111" : "#e0e0da"}`,
                    background: section === key ? "#111111" : "transparent",
                    color: section === key ? "#ffffff" : "#9a9a94",
                    fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    cursor: "pointer", transition: "all .2s", borderRadius: 2,
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
            <InfoPanel section={section} infoMap={infoMap} />
          </>
        )}
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 70px" }}>

        {/* Knife panels */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : `repeat(${panelCount}, minmax(0,1fr))`,
          gap: 16, marginBottom: 16,
        }}>
          {Array.from({ length: panelCount }, (_, i) => (
            <KnifePanel key={i} index={i}
              knife={knives[i]}   input={inputs[i]}
              loading={loading[i]} error={errors[i]}
              onInput={(v) => setArr(setInputs, i, v)}
              onSearch={() => fetchKnife(i)}
              onScan={() => setScanning(i)}
              onRemove={i === 2 ? removeThird : null}
              onNote={() => setNoteIndex(i)}
              steelUnavailable={false}
            />
          ))}
        </div>

        {/* Add 3rd knife */}
        {panelCount === 2 && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <button onClick={() => setPanelCount(3)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 22px", border: "1px solid #e0e0da",
                background: "transparent", color: "#9a9a94",
                fontSize: 10, letterSpacing: "0.14em",
                textTransform: "uppercase", cursor: "pointer", borderRadius: 2,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              Add 3rd knife
            </button>
          </div>
        )}

        {/* Performance chart */}
        {hasChart && (
          <div style={{
            border: "1px solid #e8e8e3", padding: "24px 20px",
            background: "#ffffff", marginBottom: 24,
          }}>
            <div style={{
              fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
              color: "#c0c0ba", marginBottom: 20, fontWeight: 400,
            }}>
              Performance Analysis
            </div>
            <DiamondChart knives={visibleKnives} />
            <StatBars     knives={visibleKnives} />
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 40, paddingTop: 20, borderTop: "1px solid #e8e8e3",
          textAlign: "center", fontSize: 11, color: "#c0c0ba", lineHeight: 1.8,
        }}>
          Created with love by{" "}
          <a href="https://davides.net/" target="_blank" rel="noopener noreferrer"
            style={{ color: "#6b6b66", fontWeight: 500 }}>
            David Martinez
          </a>
          {" · "}
          <a href="mailto:davigides@gmail.com" style={{ color: "#c0c0ba" }}>
            Please send me your feedback
          </a>
        </div>
      </div>

      {/* ── Modals ── */}
      {scanning !== null && (
        <ScanModal
          onResult={(ref) => {
            setArr(setInputs, scanning, ref);
            setScanning(null);
            setTimeout(() => fetchKnife(scanning), 150);
          }}
          onClose={() => setScanning(null)}
        />
      )}

      {noteIndex !== null && knives[noteIndex] && (
        <NoteModal knife={knives[noteIndex]} onClose={() => setNoteIndex(null)} />
      )}

      {showGame && <KnifeGame onClose={() => setShowGame(false)} />}
    </div>
  );
}
