import { useState, useEffect, useRef, useMemo } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import * as ZXingLib from "@zxing/library";

// ─── Design tokens matching musashihamono.com ──────────────────────────────────
// Background: warm white #fafaf8 | Cards: #ffffff | Borders: #e8e8e3
// Header: #111111 (dark nav like their site) | Text: #1a1a16 | Muted: #6b6b66
// Font: Jost (geometric sans — closest to their -apple-system / Helvetica stack)

const G = `
  @import url('https://fonts.googleapis.com/css2?family=Jost:wght@200;300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body,#root{min-height:100vh;background:#fafaf8;color:#1a1a16;font-family:'Jost',system-ui,-apple-system,'Helvetica Neue',sans-serif}
  ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#d8d8d2}
  @keyframes pulse{0%,80%,100%{opacity:.25;transform:scale(.75)}40%{opacity:1;transform:scale(1)}}
  input:focus{border-color:#1a1a16!important;outline:none}
  .collbody{max-height:0;overflow:hidden;transition:max-height .4s ease}
  .collbody.open{max-height:1200px}
  .rotplus{display:inline-block;transition:transform .2s}
  .rotplus.open{transform:rotate(45deg)}
  a{color:#1a1a16;text-decoration:none}
  a:hover{opacity:.6}
  button{font-family:'Jost',system-ui,-apple-system,'Helvetica Neue',sans-serif}
  input{font-family:'Jost',system-ui,-apple-system,'Helvetica Neue',sans-serif}
`;

// ── Steel data loaded from Airtable via /.netlify/functions/airtable-proxy?resource=steels ──

// Light theme cat colors
const CAT_TEXT = { "Carbon":"#8a6820", "Semi-stainless":"#2a7a40", "Stainless":"#2060a0", "Stainless PM":"#6040a0" };
const CAT_BG   = { "Carbon":"#fdf5e4", "Semi-stainless":"#e8f5ee", "Stainless":"#e4eef8", "Stainless PM":"#ede8f8" };

// ── Knowledge base loaded from Airtable via /.netlify/functions/airtable-proxy?resource=kb ──

// Human-readable headings per category key (same as original)
const KB_HEADINGS = {
  Metal:"Steel Types", Shape:"Blade Shapes", Makers:"Notable Makers",
  Terminology:"Key Terminology", Usages:"Knife Usages", Finish:"Surface Finishes",
  Woods:"Handle Woods", Packs:"Recommended Packs", General:"General Knowledge",
};

// Build an INFO-style map from the flat kbData array returned by the proxy
const buildInfoMap = (kbData) => {
  const map = {};
  for (const item of kbData) {
    if (!map[item.category]) {
      map[item.category] = { heading: KB_HEADINGS[item.category] || item.category, groups: [] };
    }
    let group = map[item.category].groups.find(g => g.name === item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      map[item.category].groups.push(group);
    }
    group.items.push({ n: item.title, d: item.body, img: item.image || "", link: item.link || "", shape: item.shape || "" });
  }
  return map;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isUrl    = (v) => v.includes("musashihamono.com") || v.startsWith("http");
const fmtPrice = (n) => isNaN(n) ? "—" : Math.round(n).toLocaleString();
const ACCENTS  = ["#2060a0", "#1a8a50", "#7040a0"];
const METRICS  = ["retention","chip","corrosion","sharpening"];

const extractHandle = (v) => {
  const t = v.trim();
  if (t.includes("/products/")) return t.split("/products/")[1].split("?")[0].split("/")[0];
  return t.split("?")[0];
};

const norm = (s) => s.toLowerCase().replace(/#/g,"").replace(/\s+/g," ").trim();

// steelPairs is passed in from App (useMemo over steelsData) so steel detection
// always uses the latest data without any module-level globals.
const detectSteel = (tags=[], title="", body="", steelPairs=[]) => {
  const srcMain = norm([...tags, title].join(" "));
  for (const [key,val] of steelPairs) {
    if (srcMain.includes(key)) return val;
  }
  const srcBody = norm(body);
  for (const [key,val] of steelPairs) {
    if (key.length >= 4 && srcBody.includes(key)) return val;
  }
  return null;
};

const parseSpecs = (html) => {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html,"text/html");
  const specs = [];
  doc.querySelectorAll("tr").forEach(row => {
    const cells = row.querySelectorAll("td,th");
    if (cells.length >= 2) {
      const label = cells[0].textContent.trim();
      const value = cells[1].textContent.trim();
      if (label && value && label.length < 60) specs.push({label,value});
    }
  });
  if (specs.length === 0) {
    doc.querySelectorAll("p,li").forEach(el => {
      const t = el.textContent.trim();
      const m = t.match(/^([A-Za-z][^:]{1,40}):\s*(.+)$/);
      if (m) specs.push({label:m[1].trim(), value:m[2].trim()});
    });
  }
  return specs;
};

const htmlToText = (html) => {
  if (!html) return "";
  return new DOMParser().parseFromString(html,"text/html").body.textContent || "";
};

const computeRanges = (knives) => {
  const active = knives.filter(k => k?.steel);
  return Object.fromEntries(METRICS.map(m => {
    const vals = active.map(k => k.steel[m]);
    if (vals.length <= 1) return [m, {lo:0, hi:10}];
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pad = Math.max(1, (mx - mn) * 0.3);
    return [m, {lo: Math.max(0, mn - pad), hi: Math.min(10, mx + pad * 0.3)}];
  }));
};

const scaleFrac = (v, lo, hi) => {
  const FLOOR = 0.15;
  if (hi <= lo) return 0.7;
  return FLOOR + ((v - lo) / (hi - lo)) * (1 - FLOOR);
};

// ─── Airtable — product notes from store staff ────────────────────────────────
// Token is stored in Netlify environment variables — never in client code.
// All Airtable writes go through /.netlify/functions/feedback (server-side).

const postNote = async ({ product, handle, issueType, comment, reporter }) => {
  const res = await fetch("/.netlify/functions/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product, handle, issueType, comment, reporter }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Server error ${res.status}`);
  }
  return res.json();
};

// ── Data fetching from Airtable proxy (handled inside App via useEffect) ──

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
};

// ─── Diamond Chart ─────────────────────────────────────────────────────────────
function DiamondChart({ knives }) {
  const W = 400, H = 360, cx = 200, cy = 155, R = 108;
  const ranges = computeRanges(knives);
  const isRelative = knives.filter(k => k?.steel).length >= 2;

  const pt = (axis, frac) => {
    const d = frac * R;
    if (axis === 0) return [cx, cy - d];
    if (axis === 1) return [cx + d, cy];
    if (axis === 2) return [cx, cy + d];
    return [cx - d, cy];
  };

  const toPoly = (s) => [
    pt(0, scaleFrac(s.retention,  ranges.retention.lo,  ranges.retention.hi)),
    pt(1, scaleFrac(s.chip,       ranges.chip.lo,       ranges.chip.hi)),
    pt(2, scaleFrac(s.corrosion,  ranges.corrosion.lo,  ranges.corrosion.hi)),
    pt(3, scaleFrac(s.sharpening, ranges.sharpening.lo, ranges.sharpening.hi)),
  ].map(p => p.join(",")).join(" ");

  const gridPoly = (f) =>
    [pt(0,f), pt(1,f), pt(2,f), pt(3,f)].map(p => p.join(",")).join(" ");

  const LBL = {fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:"0.1em", fill:"#9a9a94"};
  const DASHES = ["","7 3","2 3"];
  const active = knives.map((k,i) =>
    k?.steel ? {poly:toPoly(k.steel), color:ACCENTS[i], dash:DASHES[i], title:k.title||""} : null
  );
  const activeCount = active.filter(Boolean).length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", maxWidth:420, display:"block", margin:"0 auto"}}>
        {[0.25,0.5,0.75,1].map(f => (
          <polygon key={f} points={gridPoly(f)} fill="none"
            stroke={f===1?"#d0d0ca":"#eaeae4"} strokeWidth={f===1?1.2:0.8}/>
        ))}
        {[0,1,2,3].map(i => {
          const [x,y] = pt(i,1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e4e4de" strokeWidth={0.8}/>;
        })}
        {active.map((p,i) => p && (
          <polygon key={"f"+i} points={p.poly} fill={p.color+"18"} stroke="none"/>
        ))}
        {active.map((p,i) => p && (
          <polygon key={"s"+i} points={p.poly} fill="none"
            stroke={p.color} strokeWidth={2} strokeDasharray={p.dash} strokeLinejoin="round"/>
        ))}
        {active.map((p,i) => p && toPoly(knives[i].steel).split(" ").map((s,j) => {
          const [x,y] = s.split(",").map(Number);
          return <circle key={"d"+i+j} cx={x} cy={y} r={3} fill={p.color}/>;
        }))}
        <text x={cx} y={cy-R-16} textAnchor="middle" {...LBL}>EDGE RETENTION</text>
        <text x={cx+R+12} y={cy+4} textAnchor="start" {...LBL}>CHIP RES.</text>
        <text x={cx} y={cy+R+20} textAnchor="middle" {...LBL}>CORROSION RES.</text>
        <text x={cx-R-12} y={cy+4} textAnchor="end" {...LBL}>SHARPENING</text>
        {active.map((p,i) => {
          if (!p) return null;
          const ly = H - 14 - (activeCount - 1 - active.slice(0,i).filter(Boolean).length) * 18;
          return (
            <g key={"l"+i}>
              <line x1={8} y1={ly-1} x2={24} y2={ly-1} stroke={p.color} strokeWidth={2} strokeDasharray={p.dash}/>
              <text x={28} y={ly+3} textAnchor="start" {...LBL} fill="#6b6b66" fontSize={9}>
                {p.title.slice(0,34)}{p.title.length>34?"…":""}
              </text>
            </g>
          );
        })}
      </svg>
      {isRelative && (
        <div style={{textAlign:"center", fontSize:10, color:"#aaaaaa", letterSpacing:"0.1em",
          textTransform:"uppercase", marginTop:6}}>
          Chart scaled relative to loaded knives
        </div>
      )}
    </div>
  );
}

// ─── Stat Bars ─────────────────────────────────────────────────────────────────
function StatBars({ knives }) {
  const metrics = [
    {label:"Edge Retention",    key:"retention"},
    {label:"Chip Resistance",   key:"chip"},
    {label:"Corrosion Res.",    key:"corrosion"},
    {label:"Ease of Sharpening",key:"sharpening"},
  ];
  return (
    <div style={{marginTop:24}}>
      {metrics.map(({label,key}) => (
        <div key={key} style={{marginBottom:16}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
            <span style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"#9a9a94", fontWeight:400}}>{label}</span>
            <div style={{display:"flex", gap:12}}>
              {knives.map((k,i) => {
                const v = k?.steel?.[key];
                if (v == null) return null;
                return (
                  <span key={i} style={{fontSize:11, color:ACCENTS[i], fontWeight:500}}>
                    {v*10}<span style={{fontSize:9, color:"#c0c0ba", fontWeight:300}}>/100</span>
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{position:"relative", height:4, background:"#f0f0ea", borderRadius:2}}>
            {knives.map((k,i) => {
              const v = k?.steel?.[key];
              if (v == null) return null;
              return (
                <div key={i} style={{
                  position:"absolute", top:i*1, height:2, borderRadius:1,
                  width:`${v*10}%`, background:ACCENTS[i],
                  opacity:0.8, transition:"width .5s ease",
                }}/>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Collapsible ───────────────────────────────────────────────────────────────
function Coll({title, children, open:defaultOpen=false}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{borderTop:"1px solid #e8e8e3"}}>
      <div onClick={() => setOpen(!open)}
        style={{display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"13px 0", cursor:"pointer", userSelect:"none"}}>
        <span style={{fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase",
          color:"#9a9a94", fontWeight:400}}>{title}</span>
        <span className={`rotplus${open?" open":""}`}
          style={{color:"#c0c0ba", fontSize:18, lineHeight:1}}>+</span>
      </div>
      <div className={`collbody${open?" open":""}`}>
        <div style={{paddingBottom:16}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Steel Profile ─────────────────────────────────────────────────────────────
function SteelProfile({steel, tags, isMobile, unavailableLabel}) {
  if (!steel) {
    return (
      <Coll title="Steel Profile" open={!isMobile}>
        {unavailableLabel ? (
          <div style={{fontSize:13, color:"#c08020", lineHeight:1.6, marginBottom:tags?.length?12:0}}>
            ⚠ {unavailableLabel} is currently marked unavailable in store and is excluded from the comparison chart.
          </div>
        ) : (
          <div style={{fontSize:13, color:"#9a9a94", marginBottom:tags?.length?12:0}}>
            Steel not identified from product data.
          </div>
        )}
        {tags?.length > 0 && (
          <>
            <div style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
              color:"#c0c0ba", marginBottom:8}}>Product Tags</div>
            <div style={{display:"flex", flexWrap:"wrap", gap:5}}>
              {tags.map((tag,i) => (
                <span key={i} style={{padding:"3px 10px", border:"1px solid #e0e0da",
                  fontSize:11, color:"#9a9a94", borderRadius:2}}>{tag}</span>
              ))}
            </div>
          </>
        )}
      </Coll>
    );
  }
  const tc = CAT_TEXT[steel.cat] || "#606060";
  const bc = CAT_BG[steel.cat]   || "#f5f5f0";
  return (
    <Coll title="Steel Profile" open={!isMobile}>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:14}}>
        <span style={{padding:"3px 10px", background:bc, color:tc, borderRadius:2,
          fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:500}}>
          {steel.cat}
        </span>
        {steel.maker && <span style={{fontSize:11, color:"#9a9a94"}}>{steel.maker}</span>}
        {steel.hrc   && <span style={{fontSize:11, color:"#9a9a94"}}>HRC {steel.hrc}</span>}
      </div>
      <p style={{fontSize:13, color:"#5a5a56", lineHeight:1.75, marginBottom:16}}>{steel.desc}</p>
      {steel.comp && Object.keys(steel.comp).length > 0 && (
        <>
          <div style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
            color:"#c0c0ba", marginBottom:10}}>Composition</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {Object.entries(steel.comp).map(([el,val]) => (
              <div key={el} style={{padding:"5px 10px", border:"1px solid #e8e8e3",
                background:"#fafaf8", borderRadius:2}}>
                <span style={{fontSize:9, color:tc, marginRight:4, fontWeight:500,
                  letterSpacing:"0.05em"}}>{el}</span>
                <span style={{fontSize:11, color:"#3a3a36"}}>{val}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Coll>
  );
}

// ─── Easter Egg: Knife Catcher Minigame ───────────────────────────────────────
// Trigger: click the logo 10 times.
// Controls: tap / drag anywhere → character faces that direction from centre.
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

// ── pixel-art helpers ─────────────────────────────────────────────────────────
const gpx = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x*P, y*P, w*P, h*P); };

// Samurai sprite (facing right = arm + weapon extend right)
// Inspired by blue-gi / dark-hakama samurai with topknot
const drawSamurai = (ctx) => {
  const sk="#e8a070", bl="#3a5c8c", sh="#5480b8", dk="#2e274a", hr="#141010", ob="#b06820", ft="#5a4030";
  // topknot
  gpx(ctx, 0,-12, 2,3,hr); gpx(ctx,-1,-10,1,1,hr); gpx(ctx,2,-10,1,1,hr);
  // head – skin
  gpx(ctx,-3,-9, 6,6,sk);
  // hair over head
  gpx(ctx,-3,-9,6,2,hr); gpx(ctx,-3,-7,1,3,hr); gpx(ctx,2,-7,1,3,hr);
  // eyes
  gpx(ctx,-1,-6,1,1,"#222"); gpx(ctx,1,-6,1,1,"#222");
  // shoulders
  gpx(ctx,-5,-3,10,2,bl); gpx(ctx,-5,-3,2,2,sh); // shoulder highlight L
  // gi body
  gpx(ctx,-4,-1,8,6,bl); gpx(ctx,-3,-1,1,4,sh);
  // obi belt
  gpx(ctx,-4,5,8,2,ob); gpx(ctx,-2,5,2,2,"#cc9930");
  // hakama
  gpx(ctx,-5,7,10,5,dk);
  // legs split
  gpx(ctx,-5,11,4,4,dk); gpx(ctx,1,11,4,4,dk);
  // sandals
  gpx(ctx,-6,14,4,2,ft); gpx(ctx,1,14,4,2,ft);
  gpx(ctx,-7,15,2,1,hr); gpx(ctx,4,15,2,1,hr);
  // right arm (weapon arm, pointing right)
  gpx(ctx,4,-2,3,3,sk);
  // ── kitchen knife (gyuto) extending right from hand ──
  // handle
  gpx(ctx,7,-2,6,3,ob);
  gpx(ctx,7,-3,6,1,"#cc9030"); gpx(ctx,7,2,6,1,"#8a5010");
  gpx(ctx,9,-1,1,2,"#555"); gpx(ctx,11,-1,1,2,"#555"); // rivets
  // bolster/guard
  gpx(ctx,13,-3,2,6,"#8a8a8a");
  // blade (gyuto profile: tall near bolster, tapers to tip)
  gpx(ctx,15,-4,12,5,"#c8d4e0");    // main blade
  gpx(ctx,15,-5,11,1,"#e8eef8");    // spine highlight
  gpx(ctx,22,-3, 5,3,"#c0ccd8");    // taper
  gpx(ctx,26,-2, 2,2,"#d0d8e8");    // near tip
  gpx(ctx,27,-1, 1,1,"#d8e0f0");    // tip
  // edge
  gpx(ctx,15,1,11,1,"#9aa6b0");
  // black outlines
  gpx(ctx,7,-4,6,1,"#111"); gpx(ctx,7,3,6,1,"#111");
  gpx(ctx,15,-6,13,1,"#111"); gpx(ctx,15,2,10,1,"#111");
  gpx(ctx,28,-2,1,3,"#111");
};

// Flying kitchen knife sprite (pointing right, 24×6 logical px)
const drawFlyingKnife = (ctx, col) => {
  const blade = col === "#1a9955" ? "#1a9955" : col === "#cc2222" ? "#cc2222" : "#c8d4e0";
  const hnd   = col === "#1a9955" ? "#1a6633" : col === "#cc2222" ? "#991111" : "#b07820";
  // handle
  gpx(ctx,-13,-2,7,4,hnd);
  gpx(ctx,-13,-3,7,1,"#111"); gpx(ctx,-13,2,7,1,"#111");
  gpx(ctx,-11,-1,1,2,"#555"); gpx(ctx,-9,-1,1,2,"#555");
  // bolster
  gpx(ctx,-6,-3,2,6,"#888"); gpx(ctx,-6,-4,2,1,"#111"); gpx(ctx,-6,3,2,1,"#111");
  // blade
  gpx(ctx,-4,-3,16,4,blade);
  gpx(ctx,-4,-4,15,1,"#e0e8f4");  // spine
  gpx(ctx, 8,-2, 4,2,blade);      // taper
  gpx(ctx,11,-1, 2,1,blade);      // tip
  gpx(ctx,12, 0, 1,1,blade);
  // edge
  gpx(ctx,-4,1,12,1,"#9aaab4");
  // outlines
  gpx(ctx,-4,-5,17,1,"#111"); gpx(ctx,-4,2,11,1,"#111");
  gpx(ctx,13,-2, 1,3,"#111");
};

// pixel-art heart (7×6 logical px)
const HEART_PX = [[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[3,5]];

function KnifeGame({ onClose }) {
  const canvasRef = useRef(null);
  const g = useRef({
    angle:0, hp:G_HP, score:0, frame:0,
    knives:[], flash:null, state:"playing",
    keys:{l:false,r:false},
  });
  const [ui, setUi] = useState({hp:G_HP, score:0, state:"playing", lvIdx:0});

  // Convert client coords → canvas-space angle from centre
  const toAngle = (clientX, clientY) => {
    const el = canvasRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    const cx = (clientX - r.left)  * (GW / r.width);
    const cy = (clientY - r.top)   * (GH / r.height);
    return Math.atan2(cy - GCY, cx - GCX) * 180 / Math.PI;
  };

  useEffect(() => {
    // keyboard
    const kd = e => {
      if (e.key==="ArrowLeft"||e.key==="a")  g.current.keys.l=true;
      if (e.key==="ArrowRight"||e.key==="d") g.current.keys.r=true;
      if (e.key==="Escape") onClose();
    };
    const ku = e => {
      if (e.key==="ArrowLeft"||e.key==="a")  g.current.keys.l=false;
      if (e.key==="ArrowRight"||e.key==="d") g.current.keys.r=false;
    };
    window.addEventListener("keydown",kd);
    window.addEventListener("keyup",ku);

    // touch: tap OR drag → face that direction from centre
    const el = canvasRef.current;
    const onTS = e => { e.preventDefault(); g.current.angle = toAngle(e.touches[0].clientX, e.touches[0].clientY); };
    const onTM = e => { e.preventDefault(); g.current.angle = toAngle(e.touches[0].clientX, e.touches[0].clientY); };
    const onMD = e => { g.current._md=true; g.current.angle = toAngle(e.clientX, e.clientY); };
    const onMM = e => { if (g.current._md) g.current.angle = toAngle(e.clientX, e.clientY); };
    const onMU = () => { g.current._md=false; };
    el?.addEventListener("touchstart",onTS,{passive:false});
    el?.addEventListener("touchmove", onTM,{passive:false});
    el?.addEventListener("mousedown", onMD);
    el?.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup",onMU);

    // game loop
    let raf;
    const loop = () => {
      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext("2d");
      const s = g.current;
      const [,spd,spawnF,maxA] = gLevel(s.score);

      if (s.state==="playing") {
        if (s.keys.l) s.angle -= 3.5;
        if (s.keys.r) s.angle += 3.5;
        if (s.flash) { s.flash.t--; if (s.flash.t<=0) s.flash=null; }
        s.frame++;
        const active = s.knives.filter(k=>k.st==="fly").length;
        if (s.frame >= spawnF && active < maxA) {
          s.frame=0;
          s.knives.push({a:Math.random()*360, dist:GBOX+75, spd, st:"fly", t:0});
        }
        s.knives = s.knives.filter(k => {
          if (k.st!=="fly") return --k.t>0;
          k.dist -= k.spd;
          if (k.dist <= GBOX) {
            let d = ((s.angle-k.a)%360+360)%360; if(d>180) d=360-d;
            if (d <= G_TOL) {
              k.st="caught"; k.t=20; s.score++;
              s.flash={a:k.a,t:20,good:true,txt:"CATCH!"};
              if (s.score>=G_WIN) s.state="win";
            } else {
              k.st="miss"; k.t=20;
              s.flash={a:k.a,t:20,good:false,txt:"MISS!"};
              if (--s.hp<=0) s.state="gameover";
            }
          }
          return true;
        });
        setUi({hp:s.hp, score:s.score, state:s.state,
          lvIdx: G_LEVELS.indexOf(gLevel(s.score))});
      }

      // ── DRAW ──────────────────────────────────────────────────────────────
      // bg: off-white/light gray like chrome dino
      ctx.fillStyle = "#ebebeb";
      ctx.fillRect(0,0,GW,GH);
      // subtle pixel grid
      ctx.fillStyle="#e0e0e0";
      for(let x=0;x<GW;x+=P) ctx.fillRect(x,0,1,GH);
      for(let y=0;y<GH;y+=P) ctx.fillRect(0,y,GW,1);

      const bcol = s.state==="win"?"#b08800":s.state==="gameover"?"#bb2020":"#1a1a1a";
      const bhi  = s.state==="win"?"#ffcc00":s.state==="gameover"?"#ff4444":"#444444";

      // arena box — 4px pixel border
      const bx=GCX-GBOX, by=GCY-GBOX, bs=GBOX*2;
      ctx.fillStyle=bcol;
      ctx.fillRect(bx-4,by-4,bs+8,4); ctx.fillRect(bx-4,by+bs,bs+8,4);
      ctx.fillRect(bx-4,by,4,bs);     ctx.fillRect(bx+bs,by,4,bs);
      ctx.fillStyle=bhi+"88";
      ctx.fillRect(bx,by,bs,1); ctx.fillRect(bx,by+bs-1,bs,1);
      ctx.fillRect(bx,by,1,bs); ctx.fillRect(bx+bs-1,by,1,bs);

      // catch-zone arc (green arc on box edge)
      const angR = s.angle*Math.PI/180;
      const tolR = G_TOL*Math.PI/180;
      ctx.beginPath();
      ctx.arc(GCX,GCY,GBOX,angR-tolR,angR+tolR);
      ctx.strokeStyle="#00cc44"; ctx.lineWidth=4; ctx.lineCap="round"; ctx.stroke();
      ctx.lineWidth=1;

      // flash effect + floating text
      if (s.flash) {
        const al=s.flash.t/20;
        const fr=s.flash.a*Math.PI/180;
        const fx=GCX+Math.cos(fr)*GBOX, fy=GCY+Math.sin(fr)*GBOX;
        ctx.beginPath();
        ctx.arc(fx,fy,22*al,0,Math.PI*2);
        ctx.fillStyle=s.flash.good?`rgba(0,180,80,${al*0.7})`:`rgba(200,40,40,${al*0.7})`;
        ctx.fill();
        // floating text
        ctx.font=`bold ${Math.round(10+4*al)}px monospace`;
        ctx.fillStyle=s.flash.good?"#007730":"#cc1111";
        ctx.textAlign="center";
        ctx.fillText(s.flash.txt, GCX+Math.cos(fr)*60, GCY+Math.sin(fr)*60 - 8*(1-al)*20);
      }

      // flying knives
      s.knives.forEach(k => {
        const rad=k.a*Math.PI/180;
        const kx=GCX+Math.cos(rad)*k.dist, ky=GCY+Math.sin(rad)*k.dist;
        ctx.save();
        ctx.translate(kx,ky);
        ctx.rotate(rad+Math.PI);
        ctx.scale(1/P,1/P);
        const col=k.st==="caught"?"#1a9955":k.st==="miss"?"#cc2222":null;
        drawFlyingKnife(ctx,col);
        ctx.restore();
      });

      // samurai character
      ctx.save();
      ctx.translate(GCX,GCY);
      ctx.rotate(angR);
      ctx.scale(1/P,1/P);
      drawSamurai(ctx);
      ctx.restore();

      // end-state overlay
      if (s.state!=="playing") {
        ctx.fillStyle="rgba(235,235,235,0.86)";
        ctx.fillRect(0,0,GW,GH);
        ctx.textAlign="center"; ctx.imageSmoothingEnabled=false;
        ctx.font=`bold ${P*7}px monospace`;
        ctx.fillStyle=bcol;
        ctx.fillText(s.state==="win"?"YOU WIN!":"GAME OVER", GCX, GCY-12);
        ctx.font=`${P*4}px monospace`;
        ctx.fillStyle="#555";
        ctx.fillText(s.state==="win"?`All ${G_WIN} knives caught!`:`Caught ${s.score} of ${G_WIN}`, GCX, GCY+18);
      }

      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown",kd);
      window.removeEventListener("keyup",ku);
      window.removeEventListener("mouseup",onMU);
      el?.removeEventListener("touchstart",onTS);
      el?.removeEventListener("touchmove",onTM);
    };
  }, [onClose]);

  const retry = () => {
    g.current={angle:0,hp:G_HP,score:0,frame:0,knives:[],flash:null,state:"playing",keys:{l:false,r:false}};
    setUi({hp:G_HP,score:0,state:"playing",lvIdx:0});
  };

  const LV_NAMES=["EASY","EASY","MEDIUM","HARD","INTENSE"];

  return (
    <div style={{position:"fixed",inset:0,background:"#1a1a1a",zIndex:300,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>

      {/* top bar */}
      <div style={{width:GW,display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"8px 12px",background:"#111",borderBottom:"3px solid #2a2a2a"}}>
        <div style={{display:"flex",gap:5}}>
          {Array.from({length:G_HP},(_,i)=>(
            <svg key={i} width={P*7} height={P*6+2} style={{imageRendering:"pixelated",display:"block"}}>
              {HEART_PX.map(([dx,dy],j)=>(
                <rect key={j} x={dx*P} y={dy*P} width={P} height={P}
                  fill={i<ui.hp?"#ff3366":"#2a2a2a"}/>
              ))}
            </svg>
          ))}
        </div>
        <span style={{fontFamily:"monospace",fontSize:10,color:"#555",letterSpacing:"0.12em"}}>
          {LV_NAMES[Math.min(ui.lvIdx,4)]}
        </span>
        <span style={{fontFamily:"monospace",fontSize:13,color:"#ddd",letterSpacing:"0.08em"}}>
          {ui.score}<span style={{color:"#444"}}>/{G_WIN}</span>
        </span>
      </div>

      {/* canvas */}
      <canvas ref={canvasRef} width={GW} height={GH}
        style={{display:"block",imageRendering:"pixelated",touchAction:"none",
          cursor:"crosshair",userSelect:"none"}}/>

      {/* bottom bar */}
      <div style={{width:GW,background:"#111",borderTop:"3px solid #2a2a2a",
        padding:"12px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        {ui.state==="playing" ? (
          <>
            <div style={{fontFamily:"monospace",fontSize:11,color:"#444",letterSpacing:"0.1em"}}>
              TAP OR DRAG → FACE THAT DIRECTION
            </div>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#2a2a2a",letterSpacing:"0.08em"}}>
              a / d keys also work · esc to quit
            </div>
          </>
        ) : (
          <div style={{display:"flex",gap:12}}>
            <button onClick={retry}
              style={{background:"#1a1a1a",border:"2px solid #ddd",color:"#ddd",
                fontFamily:"monospace",fontSize:11,letterSpacing:"0.1em",
                padding:"9px 22px",cursor:"pointer",textTransform:"uppercase"}}>
              ↺ RETRY
            </button>
            <button onClick={onClose}
              style={{background:"#1a1a1a",border:"2px solid #444",color:"#444",
                fontFamily:"monospace",fontSize:11,letterSpacing:"0.1em",
                padding:"9px 22px",cursor:"pointer",textTransform:"uppercase"}}>
              ✕ QUIT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Note Modal ───────────────────────────────────────────────────────────────
const ISSUE_TYPES = ["Steel mismatch", "Wrong specs", "Missing info", "Wrong price", "Other"];

function NoteModal({ knife, onClose }) {
  const [issueType, setIssueType] = useState("Steel mismatch");
  const [comment,   setComment]   = useState("");
  const [reporter,  setReporter]  = useState("");
  const [status,    setStatus]    = useState("idle"); // idle | sending | done | error
  const [errMsg,    setErrMsg]    = useState("");

  const send = async () => {
    if (!comment.trim()) return;
    setStatus("sending");
    try {
      await postNote({
        product:   knife.title,
        handle:    knife.handle,
        issueType,
        comment:   comment.trim(),
        reporter:  reporter.trim() || "Anonymous",
      });
      setStatus("done");
    } catch(e) {
      setErrMsg(e.message);
      setStatus("error");
    }
  };

  const labelStyle = {fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
    color:"#9a9a94", marginBottom:6, display:"block", fontWeight:400};
  const inputStyle = {width:"100%", background:"#fafaf8", border:"1px solid #e0e0da",
    color:"#1a1a16", fontSize:13, padding:"10px 12px", borderRadius:2,
    fontFamily:"inherit", marginBottom:16};

  return (
    <div onClick={onClose} style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
      zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20}}>
      <div onClick={e => e.stopPropagation()}
        style={{background:"#ffffff", width:"100%", maxWidth:480, padding:28, borderRadius:2,
          boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}}>

        {status === "done" ? (
          <div style={{textAlign:"center", padding:"20px 0"}}>
            <div style={{fontSize:28, marginBottom:12}}>✓</div>
            <div style={{fontSize:15, fontWeight:500, color:"#1a1a16", marginBottom:6}}>Note sent</div>
            <div style={{fontSize:13, color:"#9a9a94", marginBottom:24}}>
              The team will review it in Airtable.
            </div>
            <button onClick={onClose}
              style={{background:"#111111", border:"none", color:"#ffffff",
                fontSize:11, fontWeight:500, letterSpacing:"0.1em",
                padding:"11px 24px", cursor:"pointer", textTransform:"uppercase", borderRadius:2}}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20}}>
              <div>
                <div style={{fontSize:16, fontWeight:500, color:"#1a1a16", marginBottom:4}}>Add a note</div>
                <div style={{fontSize:12, color:"#9a9a94"}}>{knife.title}</div>
              </div>
              <button onClick={onClose}
                style={{background:"none", border:"none", color:"#c0c0ba",
                  cursor:"pointer", fontSize:22, lineHeight:1, padding:0}}>×</button>
            </div>

            <label style={labelStyle}>Issue type</label>
            <select value={issueType} onChange={e => setIssueType(e.target.value)}
              style={{...inputStyle, cursor:"pointer"}}>
              {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={labelStyle}>Comment <span style={{color:"#e05050"}}>*</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Describe the issue…"
              rows={4} style={{...inputStyle, resize:"vertical"}}/>

            <label style={labelStyle}>Your name / store <span style={{color:"#c0c0ba"}}>(optional)</span></label>
            <input value={reporter} onChange={e => setReporter(e.target.value)}
              placeholder="e.g. David — Tokyo store"
              style={inputStyle}/>

            {status === "error" && (
              <div style={{fontSize:12, color:"#c03030", marginBottom:12}}>⚠ {errMsg}</div>
            )}

            <div style={{display:"flex", gap:10, justifyContent:"flex-end"}}>
              <button onClick={onClose}
                style={{background:"none", border:"1px solid #e0e0da", color:"#9a9a94",
                  fontSize:11, letterSpacing:"0.1em", padding:"10px 20px",
                  cursor:"pointer", textTransform:"uppercase", borderRadius:2}}>
                Cancel
              </button>
              <button onClick={send} disabled={!comment.trim() || status==="sending"}
                style={{background:!comment.trim()?"#f0f0ea":"#111111", border:"none",
                  color:!comment.trim()?"#c0c0ba":"#ffffff",
                  fontSize:11, fontWeight:500, letterSpacing:"0.1em",
                  padding:"10px 24px", cursor:!comment.trim()?"not-allowed":"pointer",
                  textTransform:"uppercase", borderRadius:2}}>
                {status==="sending" ? "Sending…" : "Send note"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Scan Modal ────────────────────────────────────────────────────────────────
function ScanModal({ onResult, onClose }) {
  const videoRef    = useRef(null);
  const controlsRef = useRef(null);
  const streamRef   = useRef(null);
  const frameRef    = useRef(null);
  const [status,    setStatus]    = useState("starting");
  const [found,     setFound]     = useState("");
  const [useNative, setUseNative] = useState(null);

  const stopAll = () => {
    try { controlsRef.current?.stop(); } catch(e) {}
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const close   = () => { stopAll(); onClose(); };
  const confirm = () => { stopAll(); onResult(found); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ("BarcodeDetector" in window) {
          setUseNative(true);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode:"environment", width:{ideal:1920}, height:{ideal:1080} }
          });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          await new Promise((resolve, reject) => {
            videoRef.current.onloadedmetadata = resolve;
            videoRef.current.onerror = reject;
            videoRef.current.play().catch(reject);
          });
          await new Promise(resolve => {
            const check = () => {
              if (videoRef.current?.videoWidth > 0) resolve();
              else setTimeout(check, 100);
            };
            check();
          });
          let formats;
          try { formats = await BarcodeDetector.getSupportedFormats(); }
          catch(e) { formats = ["ean_13","ean_8","code_128","code_39","qr_code","upc_a"]; }
          const detector = new BarcodeDetector({ formats });
          setStatus("scanning");
          const scan = async () => {
            if (cancelled) return;
            try {
              if (videoRef.current?.readyState >= 2) {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0 && !cancelled) {
                  setFound(codes[0].rawValue);
                  setStatus("found");
                  return;
                }
              }
            } catch(e) {}
            frameRef.current = requestAnimationFrame(scan);
          };
          scan();
        } else {
          setUseNative(false);
          const hints = new Map();
          hints.set(ZXingLib.DecodeHintType.POSSIBLE_FORMATS, [
            ZXingLib.BarcodeFormat.EAN_13, ZXingLib.BarcodeFormat.EAN_8,
            ZXingLib.BarcodeFormat.CODE_128, ZXingLib.BarcodeFormat.CODE_39,
            ZXingLib.BarcodeFormat.QR_CODE, ZXingLib.BarcodeFormat.UPC_A,
          ]);
          const reader = new BrowserMultiFormatReader(hints);
          setStatus("scanning");
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode:"environment" } },
            videoRef.current,
            (result) => {
              if (cancelled || !result) return;
              setFound(result.getText());
              setStatus("found");
            }
          );
          if (!cancelled) controlsRef.current = controls;
        }
      } catch(e) {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; stopAll(); };
  }, []);

  return (
    <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.85)",
      zIndex:200, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:20}}>
      <div style={{position:"relative", width:"100%", maxWidth:480,
        overflow:"hidden", marginBottom:20, borderRadius:2, backgroundColor:"#000"}}>
        <video ref={videoRef} playsInline muted autoPlay
          style={{width:"100%", display:"block"}}/>
        {status === "scanning" && (
          <div style={{position:"absolute", inset:0, display:"flex",
            alignItems:"center", justifyContent:"center", pointerEvents:"none"}}>
            <div style={{width:"70%", height:56, border:"2px solid #ffffff",
              borderRadius:2, boxShadow:"0 0 0 2000px rgba(0,0,0,0.4)"}}/>
          </div>
        )}
      </div>
      <div style={{fontSize:13, color:"#ffffff", marginBottom:20,
        textAlign:"center", letterSpacing:"0.04em", lineHeight:1.7}}>
        {status === "starting" && "Starting camera…"}
        {status === "scanning" && "Point the barcode at the frame"}
        {status === "error"    && "Camera not available. Check permissions in Settings."}
        {status === "found"    && (
          <div>
            <div style={{fontSize:10, color:"rgba(255,255,255,0.6)", marginBottom:6,
              textTransform:"uppercase", letterSpacing:"0.12em"}}>Reference found</div>
            <div style={{fontSize:22, color:"#ffffff", fontWeight:500,
              letterSpacing:"0.08em"}}>{found}</div>
          </div>
        )}
      </div>
      <div style={{display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center"}}>
        {status === "found" && (
          <>
            <button onClick={confirm}
              style={{background:"#ffffff", border:"none", color:"#111111",
                fontSize:12, fontWeight:500, letterSpacing:"0.1em",
                padding:"12px 28px", cursor:"pointer", textTransform:"uppercase"}}>
              Search "{found}"
            </button>
            <button onClick={() => { setFound(""); setStatus("scanning"); }}
              style={{background:"none", border:"1px solid rgba(255,255,255,0.4)",
                color:"rgba(255,255,255,0.8)", fontSize:12,
                padding:"12px 20px", cursor:"pointer", textTransform:"uppercase"}}>
              Retry
            </button>
          </>
        )}
        <button onClick={close}
          style={{background:"none", border:"1px solid rgba(255,255,255,0.25)",
            color:"rgba(255,255,255,0.5)", fontSize:12,
            padding:"12px 20px", cursor:"pointer", textTransform:"uppercase"}}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Knife Panel ───────────────────────────────────────────────────────────────
function KnifePanel({index, knife, input, loading, error, onInput, onSearch, onScan, onRemove, steelUnavailable, onNote}) {
  const accent   = ACCENTS[index];
  const taxFree  = knife ? Math.round(knife.price * 0.94) : null;
  const isMobile = useIsMobile();

  return (
    <div style={{border:"1px solid #e8e8e3", background:"#ffffff", position:"relative", minHeight:200}}>
      <div style={{position:"absolute", top:0, left:0, width:2, height:"100%", background:accent}}/>

      <div style={{display:"flex", gap:8, padding:"14px 14px 12px 16px", flexWrap:"wrap",
        borderBottom:"1px solid #f0f0ea"}}>
        <input value={input} onChange={e => onInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && onSearch()}
          placeholder="URL, handle or reference…"
          style={{flex:"1 1 140px", minWidth:0, background:"#fafaf8",
            border:"1px solid #e0e0da", color:"#1a1a16",
            fontSize:13, padding:"10px 12px", borderRadius:2}}/>
        <button onClick={onScan} title="Scan barcode"
          style={{flexShrink:0, background:"none", border:"1px solid #e0e0da",
            color:"#9a9a94", width:40, cursor:"pointer", fontSize:18,
            display:"flex", alignItems:"center", justifyContent:"center", borderRadius:2}}>
          ◎
        </button>
        <button onClick={onSearch} disabled={!input.trim()||loading}
          style={{flexShrink:0,
            background:!input.trim()||loading?"#f0f0ea":"#111111",
            border:"none",
            color:!input.trim()||loading?"#c0c0ba":"#ffffff",
            fontSize:11, fontWeight:500,
            letterSpacing:"0.1em", padding:"10px 16px",
            cursor:loading?"not-allowed":"pointer",
            textTransform:"uppercase", whiteSpace:"nowrap", borderRadius:2}}>
          {loading?"···":"Search"}
        </button>
        {onRemove && (
          <button onClick={onRemove}
            style={{flexShrink:0, background:"none", border:"1px solid #e0e0da",
              color:"#c0c0ba", width:36, cursor:"pointer", fontSize:18, borderRadius:2}}>×</button>
        )}
      </div>

      {loading && (
        <div style={{display:"flex", gap:6, justifyContent:"center", padding:"40px 0"}}>
          {[0,1,2].map(i => (
            <div key={i} style={{width:5, height:5, borderRadius:"50%", background:accent,
              animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>
          ))}
        </div>
      )}

      {error && !loading && (
        <div style={{padding:"16px 20px", color:"#c03030", fontSize:13}}>⚠ {error}</div>
      )}

      {!knife && !loading && !error && (
        <div style={{padding:"40px 0", textAlign:"center", color:"#d0d0ca", fontSize:13}}>
          <div style={{fontSize:28, marginBottom:8}}>◇</div>
          Knife {index+1}
        </div>
      )}

      {knife && !loading && (
        <div style={{padding:"0 18px 20px 20px"}}>
          {knife.image && (
            <a href={`https://www.musashihamono.com/products/${knife.handle}`}
              target="_blank" rel="noopener noreferrer"
              style={{display:"block", marginBottom:16}}>
              <img src={knife.image} alt={knife.title}
                style={{width:"100%", aspectRatio:"4/3", objectFit:"contain",
                  background:"#fafaf8", display:"block", borderBottom:"1px solid #f0f0ea"}}/>
            </a>
          )}

          {knife.steel && !steelUnavailable && (
            <div style={{display:"inline-block", padding:"3px 10px", marginBottom:10,
              background:CAT_BG[knife.steel.cat]||"#f0f0ea",
              color:CAT_TEXT[knife.steel.cat]||"#606060",
              fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase",
              fontWeight:500, borderRadius:2}}>
              {knife.steel.cat}
            </div>
          )}
          {knife.steel && steelUnavailable && (
            <div style={{display:"inline-block", padding:"3px 10px", marginBottom:10,
              background:"#fdf0e0", color:"#c08020",
              fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase",
              fontWeight:500, borderRadius:2}}>
              Steel Unavailable
            </div>
          )}

          <div style={{fontSize:18, fontWeight:400, lineHeight:1.4,
            color:"#1a1a16", marginBottom:6, letterSpacing:"0.01em"}}>
            {knife.title}
          </div>

          {knife.type && (
            <div style={{fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase",
              color:"#b0b0aa", marginBottom:14, fontWeight:400}}>{knife.type}</div>
          )}

          <div style={{display:"flex", gap:24, alignItems:"flex-start",
            padding:"14px 0", marginBottom:14,
            borderTop:"1px solid #e8e8e3", borderBottom:"1px solid #e8e8e3"}}>
            <div>
              <div style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
                color:"#b0b0aa", marginBottom:4, fontWeight:400}}>Price</div>
              <div style={{fontSize:22, fontWeight:300, color:"#1a1a16"}}>
                <span style={{fontSize:13, color:"#9a9a94", marginRight:1}}>¥</span>
                {fmtPrice(knife.price)}
              </div>
            </div>
            <div>
              <div style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
                color:"#2a7a40", marginBottom:4, fontWeight:400}}>Tax-Free −6%</div>
              <div style={{fontSize:22, fontWeight:300, color:"#2a7a40"}}>
                <span style={{fontSize:13, color:"#5aaa70", marginRight:1}}>¥</span>
                {fmtPrice(taxFree)}
              </div>
            </div>
          </div>

          {knife.specs.length > 0 && (
            <Coll title="Technical Specifications" open={!isMobile}>
              {knife.specs.map((s,i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", padding:"6px 0",
                  borderBottom:"1px solid #f0f0ea", gap:12}}>
                  <span style={{fontSize:12, color:"#9a9a94", flexShrink:0}}>{s.label}</span>
                  <span style={{fontSize:12, color:"#3a3a36", textAlign:"right"}}>{s.value}</span>
                </div>
              ))}
            </Coll>
          )}

          <SteelProfile
            steel={steelUnavailable ? null : knife.steel}
            unavailableLabel={steelUnavailable ? knife.steel.label : null}
            tags={knife.tags} isMobile={isMobile}/>

          <Coll title="Description">
            <div style={{fontSize:13, color:"#6b6b66", lineHeight:1.8}}>
              {htmlToText(knife.description)}
            </div>
          </Coll>

          <div style={{paddingTop:14, marginTop:4, borderTop:"1px solid #f0f0ea"}}>
            <button onClick={onNote}
              style={{background:"none", border:"1px solid #e0e0da", color:"#9a9a94",
                fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
                padding:"8px 16px", cursor:"pointer", borderRadius:2, width:"100%"}}>
              ⚑ Report an issue with this product
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shape Icons — small line-drawn blade silhouettes ─────────────────────────
const SHAPE_BLADES = {
  gyuto:     "18,15 60,11 88,13 97,19 86,33 55,37 18,27",
  santoku:   "18,15 50,12 75,12 88,16 88,22 78,30 50,34 18,26",
  nakiri:    "18,14 75,12 92,12 92,28 75,30 18,26",
  usuba:     "18,13 70,11 90,11 90,29 70,31 18,27",
  sujihiki:  "18,17 70,15 92,17 99,20 92,24 70,26 18,24",
  yanagiba:  "18,18 60,17 85,17 98,20 86,23 60,24 18,23",
  bunka:     "18,15 50,12 68,12 78,15 86,20 75,31 48,34 18,26",
  honesuki:  "18,14 45,13 68,14 80,19 68,30 45,29 18,25",
  petty:     "18,17 42,14 62,14 72,17 78,21 68,30 42,32 18,27",
  deba:      "18,12 50,9 80,11 95,18 84,34 50,37 18,29",
  kiritsuke: "18,16 65,13 85,13 92,17 99,21 88,32 55,36 18,27",
};

function ShapeIcon({ shape }) {
  const points = SHAPE_BLADES[shape];
  if (!points) return null;
  return (
    <svg viewBox="0 0 102 42" style={{width:72, height:30, flexShrink:0, display:"block"}}>
      <rect x="2" y="15" width="17" height="12" rx="2" fill="#3a3a36"/>
      <polygon points={points} fill="#d8d8d2" stroke="#9a9a94" strokeWidth="1"/>
    </svg>
  );
}

// ─── Info Thumbnail — small photo for woods / makers / finishes ───────────────
function InfoThumb({ src, link, fit="contain" }) {
  const img = (
    <img src={src} alt="" style={{width:72, height:54, objectFit:fit,
      borderRadius:2, border:"1px solid #e8e8e3", background:"#ffffff",
      display:"block", flexShrink:0}}/>
  );
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" style={{flexShrink:0}}>
        {img}
      </a>
    );
  }
  return img;
}

// ─── Info Panel ────────────────────────────────────────────────────────────────
function InfoPanel({section, infoMap}) {
  const data = infoMap?.[section];
  if (!data) return (
    <div style={{padding:"40px 0", textAlign:"center", color:"#d0d0ca", fontSize:13}}>
      Loading…
    </div>
  );

  return (
    <div>
      <div style={{fontSize:22, fontWeight:300, color:"#1a1a16", textAlign:"left",
        letterSpacing:"0.02em", marginBottom:24}}>{data.heading}</div>
      {data.groups.map((g,gi) => (
        <div key={gi} style={{marginBottom:28}}>
          <div style={{fontSize:9, letterSpacing:"0.18em", textTransform:"uppercase",
            color:"#b0b0aa", marginBottom:12, paddingBottom:8, textAlign:"left",
            borderBottom:"1px solid #e8e8e3", fontWeight:500}}>
            {g.name}
          </div>
          {g.items.map((item,ii) => {
            const img  = item.img;
            const link = item.link;
            const showSvg = item.shape && !img;
            return (
              <div key={ii} style={{display:"flex", gap:14, alignItems:"flex-start", marginBottom:16}}>
                {showSvg && <ShapeIcon shape={item.shape}/>}
                {img && <InfoThumb src={img} link={link} fit={section==="Shape" ? "contain" : "cover"}/>}
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:13, fontWeight:500, color:"#1a1a16", marginBottom:3, textAlign:"left"}}>{item.n}</div>
                  <div style={{fontSize:13, color:"#6b6b66", lineHeight:1.65, textAlign:"left"}}>{item.d}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile   = useIsMobile();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [section,    setSection]    = useState("Metal");
  const [panelCount, setPanelCount] = useState(2);
  const [knives,     setKnives]     = useState([null,null,null]);
  const [inputs,     setInputs]     = useState(["","",""]);
  const [loading,    setLoading]    = useState([false,false,false]);
  const [errors,     setErrors]     = useState([null,null,null]);
  const [scanning,   setScanning]   = useState(null);
  const [noteIndex,  setNoteIndex]  = useState(null);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showGame,   setShowGame]   = useState(false);
  // ── Airtable-backed data ──────────────────────────────────────────────────
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

  // Derive steel lookup pairs from Airtable data (longest match first)
  const steelPairs = useMemo(() =>
    Object.entries(steelsData)
      .map(([k,v]) => [norm(k), v])
      .sort((a,b) => b[0].length - a[0].length),
    [steelsData]
  );

  // Build the info map from the flat kbData array
  const infoMap = useMemo(() => buildInfoMap(kbData), [kbData]);

  const setArr = (setter,i,val) =>
    setter(prev => { const n=[...prev]; n[i]=val; return n; });

  const searchHandle = async (query) => {
    const qs = [
      `q=${encodeURIComponent(query)}`,
      `resources[type]=product`,
      `resources[limit]=5`,
      `resources[options][fields]=title,product_type,variants.sku,tag,vendor`,
    ].join("&");
    const r = await fetch(`/api/search/suggest.json?${qs}`);
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
    setArr(setLoading,i,true);
    setArr(setErrors,i,null);
    setArr(setKnives,i,null);
    try {
      const handle = isUrl(input) ? extractHandle(input) : await searchHandle(input);
      const r = await fetch(`/api/products/${handle}.json?currency=JPY`);
      if (!r.ok) throw new Error(`Product not found: "${handle}"`);
      const data = await r.json();
      const p = data?.product;
      if (!p) throw new Error("Invalid server response");
      const tags  = Array.isArray(p.tags) ? p.tags : (p.tags ? p.tags.split(", ") : []);
      const steel = detectSteel(tags, p.title||"", p.body_html||"", steelPairs);
      const specs = parseSpecs(p.body_html);
      setArr(setKnives, i, {
        title:p.title, image:p.images?.[0]?.src,
        price:parseFloat(p.variants?.[0]?.price||0),
        type:p.product_type, vendor:p.vendor,
        tags, description:p.body_html, specs, steel, handle,
      });
    } catch(err) {
      setArr(setErrors,i,err.message);
    } finally {
      setArr(setLoading,i,false);
    }
  };

  const removeThird = () => {
    setArr(setKnives,2,null); setArr(setInputs,2,""); setArr(setErrors,2,null);
    setPanelCount(2);
  };

  const visibleKnives = knives.slice(0,panelCount);
  // All steels returned by the Airtable proxy are available (proxy filters available=TRUE)
  const chartKnives = visibleKnives;
  const hasChart = chartKnives.some(k => k?.steel);
  const SECTIONS = Object.keys(infoMap).length ? Object.keys(infoMap) : Object.keys(KB_HEADINGS);

  return (
    <div style={{minHeight:"100vh", background:"#fafaf8", color:"#1a1a16",
      fontFamily:"'Jost',system-ui,-apple-system,'Helvetica Neue',sans-serif"}}>
      <style>{G}</style>

      {/* ── Dark header matching Musashi nav ── */}
      <header style={{background:"#111111", padding:"0 20px"}}>
        <div style={{maxWidth:1100, margin:"0 auto", display:"flex",
          justifyContent:"space-between", alignItems:"center", height:60}}>

          <div style={{display:"flex", alignItems:"center", gap:20}}>
            <img
              src="https://www.musashihamono.com/cdn/shop/files/musashi_horizontal_f26392c1-12f8-4add-8000-cb033f085aad.svg?v=1728878193"
              alt="Musashi"
              onClick={() => {
                const n = logoClicks + 1;
                setLogoClicks(n);
                if (n >= 10) { setLogoClicks(0); setShowGame(true); }
              }}
              style={{height:24, width:"auto", filter:"brightness(0) invert(1)", cursor:"pointer"}}
            />
            <span style={{fontSize:10, fontWeight:300, letterSpacing:"0.3em",
              color:"rgba(255,255,255,0.35)", textTransform:"uppercase",
              borderLeft:"1px solid rgba(255,255,255,0.15)", paddingLeft:20}}>
              Knife Guide
            </span>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{background:"none", border:"none", cursor:"pointer", padding:6,
              display:"flex", flexDirection:"column", gap:5}}>
            {[0,1,2].map(j => (
              <div key={j} style={{width:22, height:1, background:"rgba(255,255,255,0.7)",
                transition:"all .25s",
                transform:menuOpen
                  ? j===0?"rotate(45deg) translate(4px,4px)":j===2?"rotate(-45deg) translate(4px,-4px)":"none"
                  : "none",
                opacity:menuOpen&&j===1?0:1}}/>
            ))}
          </button>
        </div>
      </header>

      {/* ── Menu overlay ── */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)}
          style={{position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:100}}/>
      )}

      {/* ── Menu panel ── */}
      <div style={{position:"fixed", top:0, right:0, width:"min(440px,100vw)", height:"100vh",
        background:"#ffffff", zIndex:101, overflowY:"auto", padding:28,
        borderLeft:"1px solid #e8e8e3",
        transform:menuOpen?"translateX(0)":"translateX(100%)",
        transition:"transform .32s cubic-bezier(.4,0,.2,1)"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28}}>
          <span style={{fontSize:10, letterSpacing:"0.2em", color:"#b0b0aa",
            textTransform:"uppercase", fontWeight:400}}>Reference Guide</span>
          <button onClick={() => setMenuOpen(false)}
            style={{background:"none", border:"none", color:"#c0c0ba",
              cursor:"pointer", fontSize:22, lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:28}}>
          {SECTIONS.map(key => (
            <button key={key} onClick={() => setSection(key)}
              style={{padding:"5px 14px",
                border:`1px solid ${section===key?"#111111":"#e0e0da"}`,
                background: section===key?"#111111":"transparent",
                color: section===key?"#ffffff":"#9a9a94",
                fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase",
                cursor:"pointer", transition:"all .2s", borderRadius:2}}>
              {key}
            </button>
          ))}
        </div>
        <InfoPanel section={section} infoMap={infoMap}/>
      </div>

      {/* ── Main content ── */}
      <div style={{maxWidth:1100, margin:"0 auto", padding:"28px 20px 70px"}}>

        {/* Panels */}
        <div style={{
          display:"grid",
          gridTemplateColumns: isMobile ? "1fr" : `repeat(${panelCount}, minmax(0,1fr))`,
          gap:16, marginBottom:16}}>
          {Array.from({length:panelCount}, (_,i) => (
            <KnifePanel key={i} index={i}
              knife={knives[i]} input={inputs[i]}
              loading={loading[i]} error={errors[i]}
              onInput={v => setArr(setInputs,i,v)}
              onSearch={() => fetchKnife(i)}
              onScan={() => setScanning(i)}
              onRemove={i===2?removeThird:null}
              onNote={() => setNoteIndex(i)}
              steelUnavailable={false}/>
          ))}
        </div>

        {/* Add 3rd knife */}
        {panelCount===2 && (
          <div style={{display:"flex", justifyContent:"center", marginBottom:24}}>
            <button onClick={() => setPanelCount(3)}
              style={{display:"flex", alignItems:"center", gap:8,
                padding:"10px 22px", border:"1px solid #e0e0da",
                background:"transparent", color:"#9a9a94",
                fontSize:10, letterSpacing:"0.14em",
                textTransform:"uppercase", cursor:"pointer", borderRadius:2}}>
              <span style={{fontSize:16, lineHeight:1}}>+</span>
              Add 3rd knife
            </button>
          </div>
        )}

        {/* Chart */}
        {hasChart && (
          <div style={{border:"1px solid #e8e8e3", padding:"24px 20px",
            background:"#ffffff", marginBottom:24}}>
            <div style={{fontSize:9, letterSpacing:"0.22em", textTransform:"uppercase",
              color:"#c0c0ba", marginBottom:20, fontWeight:400}}>Performance Analysis</div>
            <DiamondChart knives={chartKnives}/>
            <StatBars knives={chartKnives}/>
          </div>
        )}

        {/* Sales Point — generation not yet implemented, UI only */}

        {/* Scanner modal */}
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

        {/* Note modal */}
        {noteIndex !== null && knives[noteIndex] && (
          <NoteModal
            knife={knives[noteIndex]}
            onClose={() => setNoteIndex(null)}
          />
        )}

        {/* Easter egg: knife catcher game */}
        {showGame && <KnifeGame onClose={() => setShowGame(false)}/>}

        {/* Footer */}
        <div style={{marginTop:40, paddingTop:20, borderTop:"1px solid #e8e8e3",
          textAlign:"center", fontSize:11, color:"#c0c0ba", lineHeight:1.8}}>
          Created with love by{" "}
          <a href="https://davides.net/" target="_blank" rel="noopener noreferrer"
            style={{color:"#6b6b66", fontWeight:500}}>David Martinez</a>
          {" · "}
          <a href="mailto:davigides@gmail.com" style={{color:"#c0c0ba"}}>
            Please send me your feedback
          </a>
        </div>

      </div>
    </div>
  );
}
