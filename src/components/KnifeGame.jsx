import { useState, useEffect, useRef } from "react";

const GW = 360, GH = 430, GCX = 180, GCY = 200, GBOX = 92;
const G_WIN = 20, G_HP = 3, G_TOL = 30;
const P = 3; // 1 logical pixel = 3×3 canvas pixels

const G_LEVELS = [
  [0,  1.3, 88, 1],
  [4,  1.8, 70, 1],
  [8,  2.3, 55, 2],
  [12, 2.9, 44, 2],
  [16, 3.6, 34, 3],
];
const gLevel = (sc) => { let l = G_LEVELS[0]; for (const x of G_LEVELS) { if (sc >= x[0]) l = x; } return l; };

const gpx = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * P, y * P, w * P, h * P); };

const drawSamurai = (ctx) => {
  const sk="#e8a070", bl="#3a5c8c", sh="#5480b8", dk="#2e274a", hr="#141010", ob="#b06820", ft="#5a4030";
  gpx(ctx, 0,-12,2,3,hr); gpx(ctx,-1,-10,1,1,hr); gpx(ctx,2,-10,1,1,hr);
  gpx(ctx,-3,-9,6,6,sk);
  gpx(ctx,-3,-9,6,2,hr); gpx(ctx,-3,-7,1,3,hr); gpx(ctx,2,-7,1,3,hr);
  gpx(ctx,-1,-6,1,1,"#222"); gpx(ctx,1,-6,1,1,"#222");
  gpx(ctx,-5,-3,10,2,bl); gpx(ctx,-5,-3,2,2,sh);
  gpx(ctx,-4,-1,8,6,bl); gpx(ctx,-3,-1,1,4,sh);
  gpx(ctx,-4,5,8,2,ob); gpx(ctx,-2,5,2,2,"#cc9930");
  gpx(ctx,-5,7,10,5,dk);
  gpx(ctx,-5,11,4,4,dk); gpx(ctx,1,11,4,4,dk);
  gpx(ctx,-6,14,4,2,ft); gpx(ctx,1,14,4,2,ft);
  gpx(ctx,-7,15,2,1,hr); gpx(ctx,4,15,2,1,hr);
  gpx(ctx,4,-2,3,3,sk);
  gpx(ctx,7,-2,6,3,ob);
  gpx(ctx,7,-3,6,1,"#cc9030"); gpx(ctx,7,2,6,1,"#8a5010");
  gpx(ctx,9,-1,1,2,"#555"); gpx(ctx,11,-1,1,2,"#555");
  gpx(ctx,13,-3,2,6,"#8a8a8a");
  gpx(ctx,15,-4,12,5,"#c8d4e0");
  gpx(ctx,15,-5,11,1,"#e8eef8");
  gpx(ctx,22,-3,5,3,"#c0ccd8");
  gpx(ctx,26,-2,2,2,"#d0d8e8");
  gpx(ctx,27,-1,1,1,"#d8e0f0");
  gpx(ctx,15,1,11,1,"#9aa6b0");
  gpx(ctx,7,-4,6,1,"#111"); gpx(ctx,7,3,6,1,"#111");
  gpx(ctx,15,-6,13,1,"#111"); gpx(ctx,15,2,10,1,"#111");
  gpx(ctx,28,-2,1,3,"#111");
};

const drawFlyingKnife = (ctx, col) => {
  const blade = col === "#1a9955" ? "#1a9955" : col === "#cc2222" ? "#cc2222" : "#c8d4e0";
  const hnd   = col === "#1a9955" ? "#1a6633" : col === "#cc2222" ? "#991111" : "#b07820";
  gpx(ctx,-13,-2,7,4,hnd);
  gpx(ctx,-13,-3,7,1,"#111"); gpx(ctx,-13,2,7,1,"#111");
  gpx(ctx,-11,-1,1,2,"#555"); gpx(ctx,-9,-1,1,2,"#555");
  gpx(ctx,-6,-3,2,6,"#888"); gpx(ctx,-6,-4,2,1,"#111"); gpx(ctx,-6,3,2,1,"#111");
  gpx(ctx,-4,-3,16,4,blade);
  gpx(ctx,-4,-4,15,1,"#e0e8f4");
  gpx(ctx, 8,-2, 4,2,blade);
  gpx(ctx,11,-1, 2,1,blade);
  gpx(ctx,12, 0, 1,1,blade);
  gpx(ctx,-4,1,12,1,"#9aaab4");
  gpx(ctx,-4,-5,17,1,"#111"); gpx(ctx,-4,2,11,1,"#111");
  gpx(ctx,13,-2, 1,3,"#111");
};

const HEART_PX = [[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[3,5]];
const LV_NAMES = ["EASY","EASY","MEDIUM","HARD","INTENSE"];

export default function KnifeGame({ onClose }) {
  const canvasRef = useRef(null);
  const g = useRef({
    angle: 0, hp: G_HP, score: 0, frame: 0,
    knives: [], flash: null, state: "playing",
    keys: { l: false, r: false },
  });
  const [ui, setUi] = useState({ hp: G_HP, score: 0, state: "playing", lvIdx: 0 });

  const toAngle = (clientX, clientY) => {
    const el = canvasRef.current; if (!el) return 0;
    const r  = el.getBoundingClientRect();
    const cx = (clientX - r.left) * (GW / r.width);
    const cy = (clientY - r.top)  * (GH / r.height);
    return Math.atan2(cy - GCY, cx - GCX) * 180 / Math.PI;
  };

  useEffect(() => {
    const kd = (e) => {
      if (e.key === "ArrowLeft"  || e.key === "a") g.current.keys.l = true;
      if (e.key === "ArrowRight" || e.key === "d") g.current.keys.r = true;
      if (e.key === "Escape") onClose();
    };
    const ku = (e) => {
      if (e.key === "ArrowLeft"  || e.key === "a") g.current.keys.l = false;
      if (e.key === "ArrowRight" || e.key === "d") g.current.keys.r = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup",   ku);

    const el  = canvasRef.current;
    const onTS = (e) => { e.preventDefault(); g.current.angle = toAngle(e.touches[0].clientX, e.touches[0].clientY); };
    const onTM = (e) => { e.preventDefault(); g.current.angle = toAngle(e.touches[0].clientX, e.touches[0].clientY); };
    const onMD = (e) => { g.current._md = true;  g.current.angle = toAngle(e.clientX, e.clientY); };
    const onMM = (e) => { if (g.current._md) g.current.angle = toAngle(e.clientX, e.clientY); };
    const onMU = ()  => { g.current._md = false; };
    el?.addEventListener("touchstart", onTS, { passive: false });
    el?.addEventListener("touchmove",  onTM, { passive: false });
    el?.addEventListener("mousedown",  onMD);
    el?.addEventListener("mousemove",  onMM);
    window.addEventListener("mouseup", onMU);

    let raf;
    const loop = () => {
      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext("2d");
      const s   = g.current;
      const [, spd, spawnF, maxA] = gLevel(s.score);

      if (s.state === "playing") {
        if (s.keys.l) s.angle -= 3.5;
        if (s.keys.r) s.angle += 3.5;
        if (s.flash) { s.flash.t--; if (s.flash.t <= 0) s.flash = null; }
        s.frame++;
        const active = s.knives.filter((k) => k.st === "fly").length;
        if (s.frame >= spawnF && active < maxA) {
          s.frame = 0;
          s.knives.push({ a: Math.random() * 360, dist: GBOX + 75, spd, st: "fly", t: 0 });
        }
        s.knives = s.knives.filter((k) => {
          if (k.st !== "fly") return --k.t > 0;
          k.dist -= k.spd;
          if (k.dist <= GBOX) {
            let d = ((s.angle - k.a) % 360 + 360) % 360;
            if (d > 180) d = 360 - d;
            if (d <= G_TOL) {
              k.st = "caught"; k.t = 20; s.score++;
              s.flash = { a: k.a, t: 20, good: true,  txt: "CATCH!" };
              if (s.score >= G_WIN) s.state = "win";
            } else {
              k.st = "miss"; k.t = 20;
              s.flash = { a: k.a, t: 20, good: false, txt: "MISS!" };
              if (--s.hp <= 0) s.state = "gameover";
            }
          }
          return true;
        });
        setUi({ hp: s.hp, score: s.score, state: s.state, lvIdx: G_LEVELS.indexOf(gLevel(s.score)) });
      }

      // ── Draw ──
      ctx.fillStyle = "#ebebeb";
      ctx.fillRect(0, 0, GW, GH);
      ctx.fillStyle = "#e0e0e0";
      for (let x = 0; x < GW; x += P) ctx.fillRect(x, 0, 1, GH);
      for (let y = 0; y < GH; y += P) ctx.fillRect(0, y, GW, 1);

      const bcol = s.state === "win" ? "#b08800" : s.state === "gameover" ? "#bb2020" : "#1a1a1a";
      const bhi  = s.state === "win" ? "#ffcc00" : s.state === "gameover" ? "#ff4444" : "#444444";
      const bx = GCX - GBOX, by = GCY - GBOX, bs = GBOX * 2;
      ctx.fillStyle = bcol;
      ctx.fillRect(bx-4,by-4,bs+8,4); ctx.fillRect(bx-4,by+bs,bs+8,4);
      ctx.fillRect(bx-4,by,4,bs);     ctx.fillRect(bx+bs,by,4,bs);
      ctx.fillStyle = bhi + "88";
      ctx.fillRect(bx,by,bs,1); ctx.fillRect(bx,by+bs-1,bs,1);
      ctx.fillRect(bx,by,1,bs); ctx.fillRect(bx+bs-1,by,1,bs);

      const angR = s.angle * Math.PI / 180;
      const tolR = G_TOL   * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(GCX, GCY, GBOX, angR - tolR, angR + tolR);
      ctx.strokeStyle = "#00cc44"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.stroke();
      ctx.lineWidth = 1;

      if (s.flash) {
        const al = s.flash.t / 20;
        const fr = s.flash.a * Math.PI / 180;
        const fx = GCX + Math.cos(fr) * GBOX, fy = GCY + Math.sin(fr) * GBOX;
        ctx.beginPath();
        ctx.arc(fx, fy, 22 * al, 0, Math.PI * 2);
        ctx.fillStyle = s.flash.good ? `rgba(0,180,80,${al * 0.7})` : `rgba(200,40,40,${al * 0.7})`;
        ctx.fill();
        ctx.font = `bold ${Math.round(10 + 4 * al)}px monospace`;
        ctx.fillStyle   = s.flash.good ? "#007730" : "#cc1111";
        ctx.textAlign   = "center";
        ctx.fillText(s.flash.txt, GCX + Math.cos(fr) * 60, GCY + Math.sin(fr) * 60 - 8 * (1 - al) * 20);
      }

      s.knives.forEach((k) => {
        const rad = k.a * Math.PI / 180;
        const kx  = GCX + Math.cos(rad) * k.dist;
        const ky  = GCY + Math.sin(rad) * k.dist;
        ctx.save();
        ctx.translate(kx, ky);
        ctx.rotate(rad + Math.PI);
        ctx.scale(1 / P, 1 / P);
        const col = k.st === "caught" ? "#1a9955" : k.st === "miss" ? "#cc2222" : null;
        drawFlyingKnife(ctx, col);
        ctx.restore();
      });

      ctx.save();
      ctx.translate(GCX, GCY);
      ctx.rotate(angR);
      ctx.scale(1 / P, 1 / P);
      drawSamurai(ctx);
      ctx.restore();

      if (s.state !== "playing") {
        ctx.fillStyle = "rgba(235,235,235,0.86)";
        ctx.fillRect(0, 0, GW, GH);
        ctx.textAlign = "center"; ctx.imageSmoothingEnabled = false;
        ctx.font      = `bold ${P * 7}px monospace`;
        ctx.fillStyle = bcol;
        ctx.fillText(s.state === "win" ? "YOU WIN!" : "GAME OVER", GCX, GCY - 12);
        ctx.font      = `${P * 4}px monospace`;
        ctx.fillStyle = "#555";
        ctx.fillText(
          s.state === "win" ? `All ${G_WIN} knives caught!` : `Caught ${s.score} of ${G_WIN}`,
          GCX, GCY + 18
        );
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup",   ku);
      window.removeEventListener("mouseup", onMU);
      el?.removeEventListener("touchstart", onTS);
      el?.removeEventListener("touchmove",  onTM);
    };
  }, [onClose]);

  const retry = () => {
    g.current = { angle: 0, hp: G_HP, score: 0, frame: 0, knives: [], flash: null, state: "playing", keys: { l: false, r: false } };
    setUi({ hp: G_HP, score: 0, state: "playing", lvIdx: 0 });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#1a1a1a", zIndex: 300,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      {/* Top bar */}
      <div style={{
        width: GW, display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 12px", background: "#111", borderBottom: "3px solid #2a2a2a",
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          {Array.from({ length: G_HP }, (_, i) => (
            <svg key={i} width={P * 7} height={P * 6 + 2} style={{ imageRendering: "pixelated", display: "block" }}>
              {HEART_PX.map(([dx, dy], j) => (
                <rect key={j} x={dx * P} y={dy * P} width={P} height={P}
                  fill={i < ui.hp ? "#ff3366" : "#2a2a2a"} />
              ))}
            </svg>
          ))}
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#555", letterSpacing: "0.12em" }}>
          {LV_NAMES[Math.min(ui.lvIdx, 4)]}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#ddd", letterSpacing: "0.08em" }}>
          {ui.score}<span style={{ color: "#444" }}>/{G_WIN}</span>
        </span>
      </div>

      <canvas ref={canvasRef} width={GW} height={GH}
        style={{ display: "block", imageRendering: "pixelated", touchAction: "none", cursor: "crosshair", userSelect: "none" }} />

      {/* Bottom bar */}
      <div style={{
        width: GW, background: "#111", borderTop: "3px solid #2a2a2a",
        padding: "12px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        {ui.state === "playing" ? (
          <>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#444", letterSpacing: "0.1em" }}>
              TAP OR DRAG → FACE THAT DIRECTION
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#2a2a2a", letterSpacing: "0.08em" }}>
              a / d keys also work · esc to quit
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={retry} style={{
              background: "#1a1a1a", border: "2px solid #ddd", color: "#ddd",
              fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em",
              padding: "9px 22px", cursor: "pointer", textTransform: "uppercase",
            }}>
              ↺ RETRY
            </button>
            <button onClick={onClose} style={{
              background: "#1a1a1a", border: "2px solid #444", color: "#444",
              fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em",
              padding: "9px 22px", cursor: "pointer", textTransform: "uppercase",
            }}>
              ✕ QUIT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
