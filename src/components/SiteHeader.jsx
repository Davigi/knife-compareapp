import { useState } from "react";

/**
 * SiteHeader — logo, wordmark, menu button.
 * Lifted out of App.jsx along with the logo easter-egg click counter, which was
 * loose top-level state in the orchestrator.
 */

const LOGO = "https://www.musashihamono.com/cdn/shop/files/musashi_horizontal_f26392c1-12f8-4add-8000-cb033f085aad.svg?v=1728878193";
const CLICKS_TO_UNLOCK = 10;

export default function SiteHeader({ menuOpen, onToggleMenu, onEasterEgg }) {
  const [clicks, setClicks] = useState(0);

  const handleLogoClick = () => {
    const next = clicks + 1;
    if (next >= CLICKS_TO_UNLOCK) {
      setClicks(0);
      onEasterEgg?.();
    } else {
      setClicks(next);
    }
  };

  return (
    <header style={{ background: "#111111", padding: "0 20px" }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto", height: 60,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img
            src={LOGO}
            alt="Musashi"
            onClick={handleLogoClick}
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

        <button
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Close reference guide" : "Open reference guide"}
          aria-expanded={menuOpen}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 6,
            display: "flex", flexDirection: "column", gap: 5,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 22, height: 1, background: "rgba(255,255,255,0.7)", transition: "all .25s",
              transform: menuOpen
                ? i === 0 ? "rotate(45deg) translate(4px,4px)"
                  : i === 2 ? "rotate(-45deg) translate(4px,-4px)" : "none"
                : "none",
              opacity: menuOpen && i === 1 ? 0 : 1,
            }} />
          ))}
        </button>
      </div>
    </header>
  );
}
