import { useState } from "react";

import { useSteelsData } from "./hooks/useSteelsData.js";
import { useKnowledgeBase } from "./hooks/useKnowledgeBase.js";
import { useKnifeSlots } from "./hooks/useKnifeSlots.js";
import { useIsMobile } from "./lib/utils.js";
import { chartableKnives, compareMetrics } from "./lib/chart.js";

import SiteHeader from "./components/SiteHeader.jsx";
import ReferenceDrawer from "./components/ReferenceDrawer.jsx";
import KnifePanel from "./components/KnifePanel.jsx";
import DiamondChart from "./components/DiamondChart.jsx";
import StatBars from "./components/StatBars.jsx";
import NoteModal from "./components/NoteModal.jsx";
import ScanModal from "./components/ScanModal.jsx";
import KnifeGame from "./components/KnifeGame.jsx";

/**
 * App — layout shell.
 *
 * Everything that used to live here as inline state and inline JSX now sits in a
 * hook or a component:
 *
 *   Airtable fetching + steelPairs memo  → hooks/useSteelsData.js
 *   knowledge base + grouping + search   → hooks/useKnowledgeBase.js
 *   knives/inputs/loading/errors arrays  → hooks/useKnifeSlots.js
 *   search + steel shortcut + fallthrough→ lib/resolve.js
 *   header and logo counter              → components/SiteHeader.jsx
 *   slide-out reference panel            → components/ReferenceDrawer.jsx
 *
 * What remains is composition and page furniture.
 */
export default function App() {
  const isMobile = useIsMobile();

  const steelsData = useSteelsData();
  const kb = useKnowledgeBase();
  const slots = useKnifeSlots({ index: steelsData.index });

  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState("Metal");
  const [scanning, setScanning] = useState(null);
  const [noteIndex, setNoteIndex] = useState(null);
  const [showGame, setShowGame] = useState(false);

  const knives = slots.visible.map((s) => s.knife);
  const charted = chartableKnives(knives);
  const comparison = compareMetrics(charted);

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8", color: "#1a1a16" }}>
      <SiteHeader
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        onEasterEgg={() => setShowGame(true)}
      />

      <ReferenceDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        kb={kb}
        section={section}
        onSection={setSection}
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 70px" }}>
        {/* A steel-data failure used to be a console message and an empty chart,
            which looked identical to "no steel detected". */}
        {steelsData.status === "error" && (
          <div style={{
            border: "1px solid #f0d8d8", background: "#fdf6f6", color: "#a03030",
            padding: "12px 16px", fontSize: 13, marginBottom: 16, borderRadius: 2,
          }}>
            ⚠ Steel database unavailable — {steelsData.error}. Comparisons will be empty until this is fixed.
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : `repeat(${slots.count}, minmax(0,1fr))`,
          gap: 16, marginBottom: 16,
        }}>
          {slots.visible.map((slot, i) => (
            <KnifePanel
              key={i}
              index={i}
              slot={slot}
              onInput={(v) => slots.setInput(i, v)}
              onSearch={() => slots.search(i)}
              onChoose={(candidate) => slots.choose(i, candidate)}
              onScan={() => setScanning(i)}
              onRemove={i >= 2 ? () => slots.removeSlot(i) : null}
              onNote={() => setNoteIndex(i)}
            />
          ))}
        </div>

        {slots.count < 3 && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <button onClick={slots.addSlot}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 22px",
                border: "1px solid #e0e0da", background: "transparent", color: "#9a9a94",
                fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                cursor: "pointer", borderRadius: 2,
              }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              Add 3rd knife
            </button>
          </div>
        )}

        {charted.length > 0 && (
          <div style={{ border: "1px solid #e8e8e3", padding: "24px 20px", background: "#ffffff", marginBottom: 24 }}>
            <div style={{
              fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
              color: "#c0c0ba", marginBottom: 20,
            }}>
              Performance Analysis
            </div>

            <DiamondChart knives={knives} reference={steelsData.reference} />
            <StatBars knives={knives} reference={steelsData.reference} allSteels={steelsData.records} />

            {/* Say the comparison in words, so reading it does not depend on
                judging polygon area by eye. */}
            {comparison.length > 0 && (
              <div style={{
                marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0f0ea",
                fontSize: 12, color: "#8a8a84", lineHeight: 1.9,
              }}>
                {comparison
                  .filter((m) => m.spread >= 5)
                  .map((m) => (
                    <div key={m.key}>
                      <strong style={{ fontWeight: 500, color: "#6b6b66" }}>{m.label}:</strong>{" "}
                      {m.leader.title} leads by {m.spread} point{m.spread === 1 ? "" : "s"}.
                    </div>
                  ))}
                {comparison.every((m) => m.spread < 5) && (
                  <div>These steels score within 5 points of each other on every measure.</div>
                )}
              </div>
            )}
          </div>
        )}

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

      {scanning !== null && (
        <ScanModal
          onResult={(ref) => {
            const slot = scanning;
            setScanning(null);
            slots.search(slot, ref);
          }}
          onClose={() => setScanning(null)}
        />
      )}

      {noteIndex !== null && slots.slots[noteIndex]?.knife && (
        <NoteModal knife={slots.slots[noteIndex].knife} onClose={() => setNoteIndex(null)} />
      )}

      {showGame && <KnifeGame onClose={() => setShowGame(false)} />}
    </div>
  );
}
