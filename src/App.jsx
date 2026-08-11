import { useState, useEffect, useRef } from "react";
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

const STEELS = {
  "white steel 3":  { label:"White Steel #3",  cat:"Carbon",       maker:"Hitachi", hrc:"59–62", retention:6,  sharpening:10, corrosion:1, chip:9,  comp:{ C:"0.80–0.90%", Mn:"0.10–0.20%", Si:"0.10–0.20%" }, desc:"Most accessible Shirogami. Low carbon gives exceptional ease of sharpening and a keen initial edge with lower edge retention than #1 or #2. Highly reactive — dry immediately after every use." },
  "shirogami 3":    { label:"White Steel #3",  cat:"Carbon",       maker:"Hitachi", hrc:"59–62", retention:6,  sharpening:10, corrosion:1, chip:9,  comp:{ C:"0.80–0.90%", Mn:"0.10–0.20%", Si:"0.10–0.20%" }, desc:"See White Steel #3." },
  "white steel 2":  { label:"White Steel #2",  cat:"Carbon",       maker:"Hitachi", hrc:"61–64", retention:7,  sharpening:9,  corrosion:1, chip:8,  comp:{ C:"1.00–1.10%", Mn:"0.20–0.30%", Si:"0.10–0.20%", P:"≤0.025%", S:"≤0.004%" }, desc:"Benchmark of Japanese kitchen knife carbon steels. High purity allows an extremely sharp edge. Very reactive — dry immediately after use." },
  "shirogami 2":    { label:"White Steel #2",  cat:"Carbon",       maker:"Hitachi", hrc:"61–64", retention:7,  sharpening:9,  corrosion:1, chip:8,  comp:{ C:"1.00–1.10%", Mn:"0.20–0.30%", Si:"0.10–0.20%" }, desc:"See White Steel #2." },
  "white steel 1":  { label:"White Steel #1",  cat:"Carbon",       maker:"Hitachi", hrc:"62–65", retention:8,  sharpening:8,  corrosion:1, chip:7,  comp:{ C:"1.25–1.35%", Mn:"0.20–0.30%", Si:"0.10–0.20%", P:"≤0.025%", S:"≤0.004%" }, desc:"Purest and highest-carbon Shirogami. Extremely refined edge — used in top Honyaki knives. More brittle than #2. Requires expert care." },
  "shirogami 1":    { label:"White Steel #1",  cat:"Carbon",       maker:"Hitachi", hrc:"62–65", retention:8,  sharpening:8,  corrosion:1, chip:7,  comp:{ C:"1.25–1.35%", Mn:"0.20–0.30%", Si:"0.10–0.20%" }, desc:"See White Steel #1." },
  "blue steel 2":   { label:"Blue Steel #2",   cat:"Carbon",       maker:"Hitachi", hrc:"62–63", retention:8,  sharpening:7,  corrosion:2, chip:8,  comp:{ C:"1.00–1.20%", Cr:"0.20–0.50%", W:"1.50–2.00%", Mn:"0.20–0.30%", Si:"0.10–0.20%" }, desc:"Most popular carbon steel in Japanese knife making. Tungsten and chromium improve toughness and retention while remaining accessible to sharpen." },
  "aogami 2":       { label:"Blue Steel #2",   cat:"Carbon",       maker:"Hitachi", hrc:"62–63", retention:8,  sharpening:7,  corrosion:2, chip:8,  comp:{ C:"1.00–1.20%", Cr:"0.20–0.50%", W:"1.50–2.00%", Mn:"0.20–0.30%", Si:"0.10–0.20%" }, desc:"See Blue Steel #2." },
  "blue steel 1":   { label:"Blue Steel #1",   cat:"Carbon",       maker:"Hitachi", hrc:"62–65", retention:9,  sharpening:6,  corrosion:2, chip:7,  comp:{ C:"1.20–1.40%", Cr:"0.30–0.50%", W:"1.50–2.00%", Mn:"0.20–0.30%", Si:"0.10–0.20%" }, desc:"Higher carbon than Blue #2. Superior edge retention. More demanding to sharpen — for experienced users." },
  "aogami 1":       { label:"Blue Steel #1",   cat:"Carbon",       maker:"Hitachi", hrc:"62–65", retention:9,  sharpening:6,  corrosion:2, chip:7,  comp:{ C:"1.20–1.40%", Cr:"0.30–0.50%", W:"1.50–2.00%", Mn:"0.20–0.30%", Si:"0.10–0.20%" }, desc:"See Blue Steel #1." },
  "blue super":     { label:"Blue Super",      cat:"Carbon",       maker:"Hitachi", hrc:"63–67", retention:10, sharpening:5,  corrosion:3, chip:8,  comp:{ C:"1.40–1.50%", Cr:"0.30–0.50%", W:"2.00–2.50%", Mo:"0.30–0.50%", V:"0.30–0.50%", Mn:"0.20–0.40%", Si:"0.10–0.40%" }, desc:"Pinnacle of Yasugi carbon steel. Mo and V push hardness and retention to the absolute limits without becoming brittle. Expert sharpening and care required." },
  "aogami super":   { label:"Blue Super",      cat:"Carbon",       maker:"Hitachi", hrc:"63–67", retention:10, sharpening:5,  corrosion:3, chip:8,  comp:{ C:"1.40–1.50%", Cr:"0.30–0.50%", W:"2.00–2.50%", Mo:"0.30–0.50%", V:"0.30–0.50%", Mn:"0.20–0.40%", Si:"0.10–0.40%" }, desc:"See Blue Super." },
  "v-toku 2":       { label:"V-Toku 2",        cat:"Carbon",       maker:"Hitachi", hrc:"62–65", retention:9,  sharpening:6,  corrosion:2, chip:7,  comp:{ C:"1.00–1.20%", V:"0.20–0.30%", Cr:"0.10–0.30%", Mn:"0.20–0.30%", Si:"0.10–0.20%" }, desc:"Hitachi carbon steel with vanadium additions. Vanadium carbides improve wear resistance beyond standard Blue steels." },
  "sk steel":       { label:"SK Steel",        cat:"Carbon",       maker:"JIS",     hrc:"58–62", retention:5,  sharpening:9,  corrosion:1, chip:9,  comp:{ C:"0.95–1.10%", Mn:"0.10–0.50%", Si:"0.10–0.35%" }, desc:"JIS standard basic tool steel. Lower performance but very easy to sharpen. Entry-level traditional knives. Highly reactive." },
  "apex ultra":     { label:"ApexUltra",       cat:"Carbon",       maker:"Takefu",  hrc:"64–67", retention:10, sharpening:3,  corrosion:3, chip:7,  comp:{ C:"1.55–1.65%", Cr:"0.50%", V:"0.50%", W:"2.00%", Mo:"0.50%", Mn:"0.30%" }, desc:"Ultra-high carbon steel. Extreme edge retention. Requires specialist heat treatment, expert sharpening and meticulous care." },
  "sld":            { label:"SLD",             cat:"Semi-stainless", maker:"Hitachi", hrc:"60–63", retention:8,  sharpening:7,  corrosion:5, chip:8,  comp:{ C:"0.95–1.00%", Cr:"7.80–8.50%", Mo:"1.00–1.50%", V:"0.20–0.30%", Mn:"0.30–0.60%", Si:"0.20–0.50%" }, desc:"Semi-stainless tool steel. ~8% Cr develops a protective patina rather than rusting aggressively. Excellent toughness and good edge retention." },
  "skd":            { label:"SKD",             cat:"Semi-stainless", maker:"JIS",     hrc:"62–64", retention:9,  sharpening:5,  corrosion:6, chip:7,  comp:{ C:"1.40–1.60%", Cr:"11.00–13.00%", Mo:"0.80–1.20%", V:"0.70–1.00%", Mn:"0.20–0.50%" }, desc:"High-carbon, high-chromium tool steel. ~12% Cr offers meaningful corrosion resistance. High carbide volume delivers excellent edge retention." },
  "hap-40":         { label:"HAP-40",          cat:"Semi-stainless", maker:"Hitachi", hrc:"66–67", retention:10, sharpening:4,  corrosion:5, chip:8,  comp:{ C:"1.27%", Cr:"4.00%", Mo:"5.00%", W:"6.00%", V:"3.00%", Co:"8.00%", Mn:"0.30%", Si:"0.45%" }, desc:"High-speed powder tool steel. W, Mo, V and Co push hardness to 66–67 HRC. Outstanding edge retention. Requires diamond or CBN stones." },
  "hap40":          { label:"HAP-40",          cat:"Semi-stainless", maker:"Hitachi", hrc:"66–67", retention:10, sharpening:4,  corrosion:5, chip:8,  comp:{ C:"1.27%", Cr:"4.00%", Mo:"5.00%", W:"6.00%", V:"3.00%", Co:"8.00%", Mn:"0.30%", Si:"0.45%" }, desc:"See HAP-40." },
  "aus-8":          { label:"AUS-8",           cat:"Stainless",    maker:"Aichi",   hrc:"57–59", retention:5,  sharpening:8,  corrosion:7, chip:8,  comp:{ C:"0.70–0.75%", Cr:"13.00–14.50%", Mo:"0.10–0.30%", V:"0.10–0.26%", Ni:"0.49%", Mn:"0.50%", Si:"1.00%" }, desc:"Reliable mid-range Japanese stainless. Balanced performance, easy to sharpen, forgiving of rough use, good corrosion resistance." },
  "aus8":           { label:"AUS-8",           cat:"Stainless",    maker:"Aichi",   hrc:"57–59", retention:5,  sharpening:8,  corrosion:7, chip:8,  comp:{ C:"0.70–0.75%", Cr:"13.00–14.50%", Mo:"0.10–0.30%", V:"0.10–0.26%", Ni:"0.49%", Mn:"0.50%", Si:"1.00%" }, desc:"See AUS-8." },
  "mv (molybdenum vanadium)": { label:"MV (Molybdenum Vanadium)", cat:"Stainless", maker:"Various", hrc:"56–58", retention:4, sharpening:9, corrosion:8, chip:9, comp:{ C:"0.60–0.70%", Cr:"13.00–14.00%", Mo:"0.50–1.00%", V:"0.10–0.20%" }, desc:"Basic stainless designation. Lower carbon limits edge retention but delivers excellent toughness and corrosion resistance. Very easy to sharpen." },
  "swedish steel":  { label:"Swedish Steel",   cat:"Stainless",    maker:"Sandvik", hrc:"60–62", retention:6,  sharpening:8,  corrosion:7, chip:8,  comp:{ C:"0.65–0.70%", Cr:"13.50%", Mo:"0.10%", Mn:"0.65%", Si:"0.40%" }, desc:"High-purity Scandinavian stainless (19C27). Fine microstructure allows sharpness comparable to carbon steels. Consistent quality." },
  "sweden":         { label:"Swedish Steel",   cat:"Stainless",    maker:"Sandvik", hrc:"60–62", retention:6,  sharpening:8,  corrosion:7, chip:8,  comp:{ C:"0.65–0.70%", Cr:"13.50%", Mo:"0.10%", Mn:"0.65%", Si:"0.40%" }, desc:"See Swedish Steel." },
  "vg1":            { label:"VG-1",            cat:"Stainless",    maker:"Takefu",  hrc:"57–60", retention:5,  sharpening:8,  corrosion:8, chip:8,  comp:{ C:"0.60–0.75%", Cr:"14.00–15.00%", Mo:"0.10%", Mn:"0.50%", Si:"0.40%" }, desc:"Entry-level VG series by Takefu. Good corrosion resistance and easy to sharpen. Low-maintenance for everyday use." },
  "vg5":            { label:"VG-5",            cat:"Stainless",    maker:"Takefu",  hrc:"59–61", retention:6,  sharpening:7,  corrosion:8, chip:7,  comp:{ C:"0.80–0.90%", Cr:"14.00–15.00%", V:"0.10–0.20%", Mo:"0.20%", Mn:"0.50%", Si:"0.50%" }, desc:"Mid-range VG series between VG-1 and VG-10. Good corrosion resistance. Easier to sharpen than VG-10." },
  "ginsan":         { label:"Ginsan / Silver #3", cat:"Stainless", maker:"Hitachi", hrc:"61–62", retention:7,  sharpening:8,  corrosion:8, chip:7,  comp:{ C:"0.95–1.10%", Cr:"13.00–14.50%", Mn:"0.50–0.70%", Si:"0.20–0.50%", P:"≤0.025%", S:"≤0.004%" }, desc:"Carbon steel performance with stainless convenience. Achieves sharpness close to White #2. Easier to sharpen than VG-10. Preferred by many professional chefs." },
  "silver #3":      { label:"Ginsan / Silver #3", cat:"Stainless", maker:"Hitachi", hrc:"61–62", retention:7,  sharpening:8,  corrosion:8, chip:7,  comp:{ C:"0.95–1.10%", Cr:"13.00–14.50%", Mn:"0.50–0.70%", Si:"0.20–0.50%" }, desc:"See Ginsan / Silver #3." },
  "gin san":        { label:"Ginsan / Silver #3", cat:"Stainless", maker:"Hitachi", hrc:"61–62", retention:7,  sharpening:8,  corrosion:8, chip:7,  comp:{ C:"0.95–1.10%", Cr:"13.00–14.50%", Mn:"0.50–0.70%", Si:"0.20–0.50%" }, desc:"See Ginsan / Silver #3." },
  "gingami #3":     { label:"Ginsan / Silver #3", cat:"Stainless", maker:"Hitachi", hrc:"61–62", retention:7,  sharpening:8,  corrosion:8, chip:7,  comp:{ C:"0.95–1.10%", Cr:"13.00–14.50%", Mn:"0.50–0.70%", Si:"0.20–0.50%" }, desc:"See Ginsan / Silver #3." },
  "chromax":        { label:"Chromax",         cat:"Stainless",    maker:"Hitachi", hrc:"61–63", retention:6,  sharpening:8,  corrosion:8, chip:8,  comp:{ C:"0.70–0.75%", Cr:"13.50%", Mo:"0.10%", Mn:"0.50%", Si:"0.40%" }, desc:"Hitachi stainless emphasising corrosion resistance and ease of sharpening. Good for humid environments." },
  "ats34":          { label:"ATS-34",          cat:"Stainless",    maker:"Hitachi", hrc:"60–62", retention:7,  sharpening:6,  corrosion:7, chip:7,  comp:{ C:"1.05%", Cr:"14.00%", Mo:"4.00%", Mn:"0.40%", Si:"0.35%" }, desc:"Premium conventional stainless equivalent to 154CM. Gold standard before PM steels. High Mo improves toughness and corrosion resistance." },
  "vg-10":          { label:"VG-10",           cat:"Stainless",    maker:"Takefu",  hrc:"60–62", retention:7,  sharpening:6,  corrosion:8, chip:7,  comp:{ C:"1.00%", Cr:"14.50–15.50%", Mo:"0.90–1.20%", V:"0.10–0.30%", Co:"1.30–1.50%", Mn:"0.50%", Si:"0.40%" }, desc:"Most widely-used premium Japanese stainless. Cobalt gives better edge retention than composition alone suggests. The benchmark for accessible high-performance stainless." },
  "vg10":           { label:"VG-10",           cat:"Stainless",    maker:"Takefu",  hrc:"60–62", retention:7,  sharpening:6,  corrosion:8, chip:7,  comp:{ C:"1.00%", Cr:"14.50–15.50%", Mo:"0.90–1.20%", V:"0.10–0.30%", Co:"1.30–1.50%", Mn:"0.50%", Si:"0.40%" }, desc:"See VG-10." },
  "vg-max":         { label:"VG-MAX",          cat:"Stainless",    maker:"Takefu",  hrc:"60–62", retention:8,  sharpening:6,  corrosion:8, chip:7,  comp:{ C:"1.00%", Cr:"14.50–15.50%", Mo:"0.90–1.20%", V:"0.30%", Co:"2.50%", Mn:"0.50%", Si:"0.50%" }, desc:"Upgraded proprietary VG-10 for Shun. Higher Co and V improve edge retention." },
  "aus-10":         { label:"AUS-10",          cat:"Stainless",    maker:"Aichi",   hrc:"60–62", retention:7,  sharpening:6,  corrosion:8, chip:8,  comp:{ C:"0.95–1.10%", Cr:"13.00–14.50%", Mo:"0.10–0.30%", V:"0.10–0.27%", Mn:"0.50%", Si:"1.00%", Ni:"0.49%" }, desc:"Premium AUS series. Higher C and V than AUS-8 improve edge retention. Nickel adds toughness." },
  "aus10":          { label:"AUS-10",          cat:"Stainless",    maker:"Aichi",   hrc:"60–62", retention:7,  sharpening:6,  corrosion:8, chip:8,  comp:{ C:"0.95–1.10%", Cr:"13.00–14.50%", Mo:"0.10–0.30%", V:"0.10–0.27%", Mn:"0.50%", Si:"1.00%", Ni:"0.49%" }, desc:"See AUS-10." },
  "cosp (cobalt special)": { label:"COSP (Cobalt Special)", cat:"Stainless", maker:"Takefu", hrc:"62–64", retention:8, sharpening:6, corrosion:7, chip:8, comp:{ C:"0.80–0.90%", Cr:"13.00–14.00%", Co:"3.00–5.00%", Mo:"0.50%", V:"0.20%", Mn:"0.50%" }, desc:"Cobalt-enhanced stainless. High Co allows greater hardness improving edge retention beyond what carbon content suggests." },
  "za-18":          { label:"ZA-18",           cat:"Stainless",    maker:"Takefu",  hrc:"63–65", retention:8,  sharpening:5,  corrosion:9, chip:7,  comp:{ C:"1.00%", Cr:"18.00%", Mo:"1.30%", V:"0.20%", Co:"1.50%", Mn:"0.40%", Si:"0.40%" }, desc:"18% Cr gives near-immune rust resistance. Ideal for humid professional environments. Cobalt improves hardness." },
  "sg2":            { label:"SG2 / R2",        cat:"Stainless PM", maker:"Takefu",  hrc:"62–64", retention:9,  sharpening:5,  corrosion:8, chip:8,  comp:{ C:"1.25%", Cr:"14.00%", V:"1.80%", Mo:"2.30%", Co:"1.50%", Mn:"0.40%", Si:"0.50%", P:"≤0.030%", S:"≤0.030%" }, desc:"Benchmark powder metallurgy stainless steel. Uniform carbide distribution delivers exceptional edge retention. The endgame steel for most professionals." },
  "r2":             { label:"SG2 / R2",        cat:"Stainless PM", maker:"Kobelco", hrc:"62–64", retention:9,  sharpening:5,  corrosion:8, chip:8,  comp:{ C:"1.25%", Cr:"14.00%", V:"1.80%", Mo:"2.30%", Co:"1.50%", Mn:"0.40%", Si:"0.50%" }, desc:"See SG2 / R2." },
  "vg xeos":        { label:"VG XEOS",         cat:"Stainless PM", maker:"Takefu",  hrc:"63–65", retention:9,  sharpening:5,  corrosion:8, chip:7,  comp:{ C:"1.20–1.40%", Cr:"14.00–15.00%", V:"1.50–2.00%", Mo:"2.00–2.50%", Co:"1.00%", Mn:"0.40%" }, desc:"Advanced PM stainless bridging VG-10 and SG2. High V and Mo push edge retention well beyond VG-10." },
  "srs-13":         { label:"SRS-13",          cat:"Stainless PM", maker:"Nachi",   hrc:"63–65", retention:9,  sharpening:4,  corrosion:8, chip:8,  comp:{ C:"1.30%", Cr:"13.50%", Mo:"2.00%", V:"3.00%", Co:"1.00%", Mn:"0.50%", Si:"0.30%" }, desc:"PM stainless by Nachi-Fujikoshi. High V (3%) produces fine vanadium carbides for exceptional retention." },
  "faxr2":          { label:"FAXR2",           cat:"Stainless PM", maker:"Takefu",  hrc:"63–64", retention:9,  sharpening:4,  corrosion:8, chip:8,  comp:{ C:"1.30%", Cr:"14.00%", Mo:"2.50%", V:"2.00%", Co:"1.50%", Mn:"0.40%", Si:"0.40%" }, desc:"PM stainless close to SG2. High V and Mo for excellent wear resistance." },
  "spg strix":      { label:"SPG STRIX",       cat:"Stainless PM", maker:"Takefu",  hrc:"63–64", retention:9,  sharpening:4,  corrosion:8, chip:8,  comp:{ C:"1.40%", Cr:"14.00%", Mo:"2.00%", V:"2.40%", Co:"1.00%", Mn:"0.40%", Si:"0.40%" }, desc:"Premium PM stainless at or above SG2. Very high V carbide content for exceptional edge retention." },
  "zdp-189":        { label:"ZDP-189",         cat:"Stainless PM", maker:"Hitachi", hrc:"67–69", retention:10, sharpening:2,  corrosion:7, chip:5,  comp:{ C:"3.00%", Cr:"20.00%", Mo:"1.40%", Mn:"0.50%", Si:"0.40%" }, desc:"The extreme end of knife steel. 3% C and 20% Cr push hardness to 67–69 HRC. Very brittle — expert-only." },
  "zdp189":         { label:"ZDP-189",         cat:"Stainless PM", maker:"Hitachi", hrc:"67–69", retention:10, sharpening:2,  corrosion:7, chip:5,  comp:{ C:"3.00%", Cr:"20.00%", Mo:"1.40%", Mn:"0.50%", Si:"0.40%" }, desc:"See ZDP-189." },
};

const EXTRA_ALIASES = {
  "sg-2":"sg2","sg 2":"sg2","vg-1":"vg1","vg 1":"vg1","vg-5":"vg5","vg 5":"vg5",
  "vg 10":"vg-10","blue 2":"blue steel 2","blue 1":"blue steel 1",
  "white 2":"white steel 2","white 1":"white steel 1","white 3":"white steel 3",
  "silver steel #3":"ginsan","silver steel 3":"ginsan","silver 3":"ginsan","gin-san":"ginsan",
  "aogami2":"aogami 2","aogami1":"aogami 1","shirogami2":"shirogami 2","shirogami1":"shirogami 1",
  "zdp 189":"zdp-189","hap 40":"hap-40","aus 10":"aus-10","aus 8":"aus-8",
};
Object.entries(EXTRA_ALIASES).forEach(([k,v]) => {
  if (typeof v === "string") STEELS[k] = STEELS[v];
  else STEELS[k] = v;
});

// Light theme cat colors
const CAT_TEXT = { "Carbon":"#8a6820", "Semi-stainless":"#2a7a40", "Stainless":"#2060a0", "Stainless PM":"#6040a0" };
const CAT_BG   = { "Carbon":"#fdf5e4", "Semi-stainless":"#e8f5ee", "Stainless":"#e4eef8", "Stainless PM":"#ede8f8" };

const INFO = {
  Metal:{heading:"Steel Types",groups:[
    {name:"Carbon Steels — softest to hardest",items:[
      {n:"SK Steel — HRC 58–62",               d:"C 0.95–1.10%. JIS standard basic tool steel. Entry-level, very easy to sharpen. Highly reactive."},
      {n:"White Steel #3 (Shirogami 3) — HRC 59–62", d:"C 0.80–0.90%. Most forgiving Shirogami. Easiest to sharpen, lower retention. Very reactive."},
      {n:"White Steel #2 (Shirogami 2) — HRC 61–64", d:"C 1.00–1.10%. Benchmark carbon steel. Extremely sharp, easy to sharpen. Very reactive."},
      {n:"Blue Steel #2 (Aogami 2) — HRC 62–63", d:"C 1.0–1.2%, W 1.5–2.0%, Cr 0.2–0.5%. Most popular carbon knife steel. Excellent chip resistance."},
      {n:"White Steel #1 (Shirogami 1) — HRC 62–65", d:"C 1.25–1.35%. Purest Shirogami. Top Honyaki knives. More brittle than #2."},
      {n:"Blue Steel #1 (Aogami 1) — HRC 62–65", d:"C 1.2–1.4%, W 1.5–2.0%. Superior retention. For experienced users."},
      {n:"V-Toku 2 — HRC 62–65",              d:"C 1.0–1.2%, V 0.2–0.3%. Vanadium carbides improve wear resistance. Fine grain."},
      {n:"Blue Super (Aogami Super) — HRC 63–67", d:"C 1.4–1.5%, W 2.0–2.5%, Mo, V. Pinnacle of Yasugi steel. Expert care required."},
      {n:"ApexUltra (Takefu) — HRC 64–67",    d:"C 1.55–1.65%, W, V, Mo. Extreme edge retention. Expert-only steel."},
    ]},
    {name:"Semi-Stainless — softest to hardest",items:[
      {n:"SLD (Hitachi) — HRC 60–63",         d:"C 0.95–1.0%, Cr 7.8–8.5%, Mo 1.5%. Patinas rather than rusts. Excellent toughness."},
      {n:"SKD (JIS SKD11) — HRC 62–64",       d:"C 1.4–1.6%, Cr 11–13%. High carbide volume for excellent retention."},
      {n:"HAP-40 (Hitachi PM) — HRC 66–67",   d:"C 1.27%, Cr 4%, W 6%, Mo 5%, V 3%, Co 8%. Extreme hardness. Requires diamond stones."},
    ]},
    {name:"Stainless — softest to hardest",items:[
      {n:"MV (Molybdenum Vanadium) — HRC 56–58", d:"C 0.60–0.70%, Cr 13–14%. Entry-level. Low retention, excellent toughness."},
      {n:"AUS-8 (Aichi) — HRC 57–59",         d:"C 0.70–0.75%, Cr 13–14.5%. Balanced, forgiving. Easy to sharpen."},
      {n:"VG-1 (Takefu) — HRC 57–60",         d:"C 0.60–0.75%, Cr 14–15%. Entry VG series. Low maintenance."},
      {n:"VG-5 (Takefu) — HRC 59–61",         d:"C 0.80–0.90%, Cr 14–15%. Mid-range VG. Solid everyday performer."},
      {n:"ATS-34 (Hitachi) — HRC 60–62",      d:"C 1.05%, Cr 14%, Mo 4%. Gold standard before PM steels."},
      {n:"Swedish Steel (Sandvik) — HRC 60–62", d:"C 0.65–0.70%, Cr 13.5%. High-purity. Sharpness comparable to carbon steels."},
      {n:"VG-10 (Takefu) — HRC 60–62",        d:"C 1.0%, Cr 14.5–15.5%, Mo 1%, Co 1.5%. Industry benchmark premium stainless."},
      {n:"VG-MAX (Takefu) — HRC 60–62",       d:"C 1.0%, Cr 15%, V 0.3%, Co 2.5%. Upgraded VG-10. Higher retention."},
      {n:"AUS-10 (Aichi) — HRC 60–62",        d:"C 0.95–1.10%, Cr 13–14.5%, Ni. Higher retention than AUS-8."},
      {n:"Ginsan / Silver #3 (Hitachi) — HRC 61–62", d:"C 0.95–1.10%, Cr 13–14.5%. Carbon steel performance, stainless maintenance."},
      {n:"Chromax (Hitachi) — HRC 61–63",     d:"C 0.70–0.75%, Cr 13.5%. Emphasis on corrosion resistance. Easy sharpening."},
      {n:"COSP / Cobalt Special — HRC 62–64", d:"C 0.80–0.90%, Cr 13–14%, Co 3–5%. High cobalt allows greater hardness."},
      {n:"ZA-18 (Takefu) — HRC 63–65",        d:"C 1.0%, Cr 18%, Co. Near-immune to rust. Ideal for humid kitchens."},
    ]},
    {name:"Powder Metallurgy (PM) — softest to hardest",items:[
      {n:"SG2 / R2 (Takefu / Kobelco) — HRC 62–64", d:"C 1.25%, Cr 14%, V 1.8%, Mo 2.3%. Benchmark PM stainless. Endgame for most professionals."},
      {n:"FAXR2 (Takefu) — HRC 63–64",        d:"C 1.3%, Cr 14%, Mo 2.5%, V 2.0%. Close to SG2. Excellent wear resistance."},
      {n:"SPG STRIX (Takefu) — HRC 63–64",    d:"C 1.4%, Cr 14%, V 2.4%, Mo 2.0%. At or above SG2 in performance."},
      {n:"VG XEOS (Takefu) — HRC 63–65",      d:"C 1.2–1.4%, V 1.5–2.0%, Mo 2.0–2.5%. Bridges VG-10 and SG2."},
      {n:"SRS-13 (Nachi-Fujikoshi) — HRC 63–65", d:"C 1.3%, Cr 13.5%, V 3%. High vanadium for outstanding retention."},
      {n:"ZDP-189 (Hitachi) — HRC 67–69",     d:"C 3.0%, Cr 20%. Extreme hardness. Very brittle. Expert-only."},
    ]},
  ]},
  Shape:{heading:"Blade Shapes",groups:[
    {name:"Double Bevel",items:[
      {n:"Gyuto",d:"Japanese chef's knife. Versatile all-purpose blade. 180–270mm.",shape:"gyuto"},
      {n:"Santoku",d:"Three virtues: meat, fish, vegetables. Shorter, lighter than gyuto. 165–190mm.",shape:"santoku"},
      {n:"Nakiri",d:"Vegetable knife. Straight edge for push-cutting. 150–180mm.",shape:"nakiri"},
      {n:"Sujihiki",d:"Slicing knife. Long, thin blade minimises tearing. 240–330mm.",shape:"sujihiki"},
      {n:"Bunka",d:"Reverse tanto tip. Great for precision cuts. 165–200mm.",shape:"bunka"},
      {n:"Honesuki",d:"Boning knife. Stiff triangular blade for poultry. 145–165mm.",shape:"honesuki"},
      {n:"Petty",d:"Small utility knife for detail work and peeling. 120–180mm.",shape:"petty"},
    ]},
    {name:"Single Bevel (Traditional)",items:[
      {n:"Deba",d:"Heavy fish butchery knife. Handles heads, bones and scales. 150–210mm.",shape:"deba"},
      {n:"Yanagiba",d:"Sashimi slicer. Long pull-cut for clean fish slices. 240–360mm.",shape:"yanagiba"},
      {n:"Usuba",d:"Vegetable knife for katsuramuki thin sheets. 180–240mm.",shape:"usuba"},
      {n:"Kiritsuke",d:"Multi-purpose single-bevel. Extremely difficult to master. Status symbol.",shape:"kiritsuke"},
    ]},
  ]},
  Makers:{heading:"Notable Makers",groups:[
    {name:"Sakai Region",items:[
      {n:"Sakai Takayuki",d:"One of the largest Sakai producers. Wide range from entry-level to professional grade.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Sakai+T.",link:"https://www.musashihamono.com/search?q=Sakai+Takayuki"},
      {n:"Takeshi Saji",d:"Master smith known for exquisite Damascus patterns and premium materials.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Saji",link:"https://www.musashihamono.com/search?q=Takeshi+Saji"},
      {n:"Morihei / Hiden",d:"Traditional maker known for exceptional single-bevel knives and hand finishing.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Morihei",link:"https://www.musashihamono.com/search?q=Morihei"},
    ]},
    {name:"Echizen & Other Regions",items:[
      {n:"Yoshimi Kato",d:"Award-winning blacksmith. Exceptional grinds, SG2 and Damascus specialist.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Kato",link:"https://www.musashihamono.com/search?q=Yoshimi+Kato"},
      {n:"Yu Kurosaki",d:"Modern master. Innovative surface patterns, exceptional balance and fit & finish.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Kurosaki",link:"https://www.musashihamono.com/search?q=Yu+Kurosaki"},
      {n:"Tosa Tradition",d:"Kochi Prefecture. Utilitarian high-performance knives with excellent value.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Tosa",link:"https://www.musashihamono.com/search?q=Tosa"},
    ]},
  ]},
  Terminology:{heading:"Key Terminology",groups:[
    {name:"Construction Terms",items:[
      {n:"Honbazuke",d:"Initial edge setting by the maker. Establishes the final cutting geometry."},
      {n:"Honyaki",d:"Single steel construction. Highest grade, hamon visible. Requires expert maintenance."},
      {n:"Kasumi",d:"Mirror edge bevel, misty body from forge work. Classic Japanese aesthetic."},
      {n:"Kurouchi",d:"Forge scale left intact. Rustic look, protective, reduces food adhesion."},
      {n:"Tsuchime",d:"Hand-hammered dimple texture. Decorative and reduces food sticking."},
      {n:"Nashiji",d:"Pear-skin matte texture. Effective food release, refined appearance."},
    ]},
    {name:"Geometry & Parts",items:[
      {n:"Ha",d:"The cutting edge of the blade."},
      {n:"Mune",d:"The spine (back) of the blade."},
      {n:"Shinogi",d:"Transition line between the flat and the beveled edge section."},
      {n:"HRC",d:"Rockwell Hardness Scale C. Higher = better retention but more brittle."},
      {n:"Single Bevel",d:"Edge ground on one side only. Traditional Japanese. Right or left-handed specific."},
      {n:"Double Bevel",d:"Edge ground symmetrically. Works for both left and right-handed users."},
    ]},
  ]},
  Usages:{heading:"Knife Usages",groups:[
    {name:"By Task",items:[
      {n:"Fish Butchery",d:"Deba. Weight and single bevel handle heads, bones and scales."},
      {n:"Sashimi / Sushi",d:"Yanagiba. Long pull-cut creates clean, undamaged fish slices."},
      {n:"Vegetable Prep",d:"Nakiri for everyday prep. Usuba for katsuramuki and precise julienne."},
      {n:"General Cooking",d:"Gyuto or Santoku as workhorse knives for most kitchen tasks."},
      {n:"Meat Slicing",d:"Sujihiki. Long blade covers the full cut, minimising tearing."},
      {n:"Poultry Breakdown",d:"Honesuki. Stiff blade follows bone structure closely."},
      {n:"Detail / Garnish",d:"Petty. Fine precision work, peeling and garnishes."},
    ]},
  ]},
  Finish:{heading:"Surface Finishes",groups:[
    {name:"Finish Types",items:[
      {n:"Kasumi",d:"Mirror edge with misty body. The classic Japanese aesthetic.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Kasumi"},
      {n:"Kurouchi (Blacksmith)",d:"Forge scale intact. Rustic, protective patina. Excellent food release.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Kurouchi"},
      {n:"Migaki (Mirror)",d:"Fully polished blade. Maximum visual impact. Shows scratches over time.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Migaki"},
      {n:"Nashiji (Pear Skin)",d:"Textured matte. Very effective food release.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Nashiji"},
      {n:"Tsuchime (Hammered)",d:"Hand-hammered dimples. Highly decorative with anti-stick properties.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Tsuchime"},
      {n:"Suminagashi (Damascus)",d:"Folded steel pattern. Each blade is unique.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Damascus"},
    ]},
  ]},
  Woods:{heading:"Handle Woods",groups:[
    {name:"Traditional Japanese",items:[
      {n:"Ho (Magnolia)",d:"Lightweight, absorbs moisture. Traditional Wa handle choice. Replaceable.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Ho"},
      {n:"Walnut (Kurumi)",d:"Dense, beautiful grain. Natural oils provide water resistance.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Walnut"},
      {n:"Cherry (Sakura)",d:"Hard, warm reddish tones. Good balance of grip and aesthetics.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Sakura"},
      {n:"Chestnut (Kuri)",d:"Traditional choice. Warm brown tones, medium weight.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Kuri"},
      {n:"Ebony",d:"Very dense and dark. Premium traditional choice. Excellent water resistance.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Ebony"},
    ]},
    {name:"Modern & Premium",items:[
      {n:"Stabilized Wood",d:"Resin-impregnated. Highly water resistant, vivid colors, very stable.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Stabilized"},
      {n:"Rosewood",d:"Rich reddish-brown, high natural oil content. Dense and durable.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Rosewood"},
      {n:"Ambrosia Maple",d:"Blue-grey streaks from beetle galleries. Highly decorative.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Maple"},
      {n:"Pakkawood",d:"Resin-compressed layered wood. Stable, water resistant, various colors.",img:"https://placehold.co/100x80/e8e8e3/9a9a94?text=Pakkawood"},
    ]},
  ]},
  Packs:{heading:"Recommended Packs",groups:[
    {name:"By Number of Knives",items:[
      {n:"1 Knife",d:"Santoku 165–180mm in VG-10 or Ginsan. The single all-rounder that handles meat, fish, and vegetables comfortably."},
      {n:"2 Knives",d:"Gyuto + Petty. The classic combo — one for everything, one for detail work and fruit."},
      {n:"3 Knives",d:"Gyuto + Petty + Nakiri. Covers protein, detail work, and vegetables."},
      {n:"4 Knives",d:"Gyuto + Petty + Nakiri + Sujihiki. Adds a slicer for larger cuts of meat and fish."},
      {n:"5 Knives",d:"Gyuto + Santoku + Nakiri + Petty + Deba. A well-rounded kitchen set covering daily tasks plus fish butchery."},
      {n:"6 Knives",d:"Gyuto + Santoku + Nakiri + Petty + Deba + Sujihiki. The complete professional set."},
    ]},
    {name:"By Customer Type",items:[
      {n:"Chef",d:"Gyuto 240–270mm in premium steel (Blue Super, SG2). Performance over comfort, built for volume."},
      {n:"Sushi Chef",d:"Yanagiba + Deba + Usuba. The traditional single-bevel set for itamae work."},
      {n:"Gift",d:"Santoku or Petty with a decorative handle (Damascus, premium wood) in a gift box."},
      {n:"Fisher",d:"Deba + a sturdy Petty for on-the-spot cleaning and filleting."},
      {n:"Hunter",d:"Thick-bladed knife in a tough steel (SLD, SKD) built for processing game."},
    ]},
  ]},
  General:{heading:"General Knowledge",groups:[
    {name:"Care & Maintenance",items:[
      {n:"Never dishwasher",d:"Hand wash and dry immediately. Dishwashers destroy handles and edges."},
      {n:"Cutting surfaces",d:"Wood or plastic only. Glass and ceramic destroy any edge quickly."},
      {n:"Carbon steel care",d:"Dry immediately after use. Apply camellia oil for storage."},
      {n:"Sharpening",d:"Whetstones: 400–1000 grit for repair, 1000–3000 regular, 6000+ polishing."},
      {n:"Storage",d:"Magnetic strip, knife block, or blade guards. Never loose in drawers."},
    ]},
    {name:"Customer Notes",items:[
      {n:"Tax-Free Shopping",d:"Non-resident visitors receive 6% tax-free discount. Passport required at purchase."},
      {n:"Beginner",d:"VG-10 or Ginsan. Stainless, forgiving, low maintenance. Gyuto or Santoku."},
      {n:"Intermediate",d:"Blue #2. Better performance. Requires immediate drying after use."},
      {n:"Advanced",d:"White #1, Honyaki, single-bevel. Maximum performance. Full care commitment."},
    ]},
  ]},
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
const STEEL_PAIRS = Object.entries(STEELS)
  .map(([k,v]) => [norm(k), v])
  .sort((a,b) => b[0].length - a[0].length);

const resolveSteel = (s) => {
  if (!s || !s.desc?.startsWith("See ")) return s;
  const ref = s.desc.replace("See ","").replace(".","").trim();
  return Object.values(STEELS).find(x => x.label === ref && !x.desc?.startsWith("See ")) || s;
};

const detectSteel = (tags=[], title="", body="") => {
  const srcMain = norm([...tags, title].join(" "));
  for (const [key,val] of STEEL_PAIRS) {
    if (srcMain.includes(key)) return resolveSteel(val);
  }
  const srcBody = norm(body);
  for (const [key,val] of STEEL_PAIRS) {
    if (key.length >= 4 && srcBody.includes(key)) return resolveSteel(val);
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

// ─── Google Sheets backend ──────────────────────────────────────────────────
// No API key needed. In Google Sheets: File → Share → Publish to web →
// select each tab individually → format "Comma-separated values (.csv)" →
// Publish, then paste the resulting URL below for each tab.
// Leave blank to skip — the app works normally with hardcoded data until filled in.
const SHEET_CSV = {
  steels: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS99j5DMR2ISvrqRvRRdgXH8EJslA-mUSHlck6x6D6RTMmnl_Kk1tf9BXBvjQ0DeK10UIzhpP5RIMJU/pub?gid=91564173&single=true&output=csv",
  woods:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS99j5DMR2ISvrqRvRRdgXH8EJslA-mUSHlck6x6D6RTMmnl_Kk1tf9BXBvjQ0DeK10UIzhpP5RIMJU/pub?gid=315244972&single=true&output=csv",
  makers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS99j5DMR2ISvrqRvRRdgXH8EJslA-mUSHlck6x6D6RTMmnl_Kk1tf9BXBvjQ0DeK10UIzhpP5RIMJU/pub?gid=519397208&single=true&output=csv",
  finish: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS99j5DMR2ISvrqRvRRdgXH8EJslA-mUSHlck6x6D6RTMmnl_Kk1tf9BXBvjQ0DeK10UIzhpP5RIMJU/pub?gid=0&single=true&output=csv",
  shapes: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS99j5DMR2ISvrqRvRRdgXH8EJslA-mUSHlck6x6D6RTMmnl_Kk1tf9BXBvjQ0DeK10UIzhpP5RIMJU/pub?gid=1623593862&single=true&output=csv",
};

const parseCSV = (text) => {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i+1] === '\n') i++;
        row.push(field); field = "";
        if (row.some(x => x !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); if (row.some(x=>x!=="")) rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = (r[i] ?? "").trim());
    return obj;
  });
};

const fetchSheet = async (url) => {
  if (!url) return [];
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return parseCSV(await res.text());
  } catch(e) { return []; }
};

// Default to available=true for any steel not listed in the sheet (fail-open)
const isAvail = (label, map) => {
  if (!label) return true;
  const v = map[label.toLowerCase()];
  return v === undefined ? true : v;
};

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
function InfoPanel({section, overrides}) {
  const data = INFO[section];
  if (!data) return null;

  // Any sheet row whose key doesn't match an existing hardcoded item
  // becomes a brand-new entry, grouped separately at the bottom.
  const usedKeys = new Set(
    data.groups.flatMap(g => g.items.map(item => item.n.toLowerCase()))
  );
  const extraItems = Object.values(overrides || {})
    .filter(ov => ov.key && !usedKeys.has(ov.key.toLowerCase()))
    .map(ov => ({ n: ov.key, d: ov.desc || "Added via Google Sheets.", img: ov.img, link: ov.link }));
  const groups = extraItems.length
    ? [...data.groups, { name:"Added via Sheet", items:extraItems }]
    : data.groups;

  return (
    <div>
      <div style={{fontSize:22, fontWeight:300, color:"#1a1a16", textAlign:"left",
        letterSpacing:"0.02em", marginBottom:24}}>{data.heading}</div>
      {groups.map((g,gi) => (
        <div key={gi} style={{marginBottom:28}}>
          <div style={{fontSize:9, letterSpacing:"0.18em", textTransform:"uppercase",
            color:"#b0b0aa", marginBottom:12, paddingBottom:8, textAlign:"left",
            borderBottom:"1px solid #e8e8e3", fontWeight:500}}>
            {g.name}
          </div>
          {g.items.map((item,ii) => {
            const ov  = overrides?.[item.n.toLowerCase()];
            const img = ov?.img  || item.img;
            const link= ov?.link || item.link;
            const showSvg = item.shape && !img;  // SVG only shown when no photo available
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
  const [salesLang,  setSalesLang]  = useState("en");
  const [steelAvailability, setSteelAvailability] = useState({});
  const [woodOverrides,     setWoodOverrides]     = useState({});
  const [makerOverrides,    setMakerOverrides]     = useState({});
  const [finishOverrides,   setFinishOverrides]    = useState({});
  const [shapeOverrides,    setShapeOverrides]     = useState({});

  useEffect(() => {
    (async () => {
      const [steelsRows, woodsRows, makersRows, finishRows, shapesRows] = await Promise.all([
        fetchSheet(SHEET_CSV.steels),
        fetchSheet(SHEET_CSV.woods),
        fetchSheet(SHEET_CSV.makers),
        fetchSheet(SHEET_CSV.finish),
        fetchSheet(SHEET_CSV.shapes),
      ]);
      const avail = {};
      steelsRows.forEach(r => { if (r.key) avail[r.key.toLowerCase()] = String(r.available).toLowerCase() !== "false"; });
      setSteelAvailability(avail);

      const toMap = (rows) => {
        const m = {};
        rows.forEach(r => { if (r.key) m[r.key.toLowerCase()] = { key:r.key, img:r.img, link:r.link, desc:r.desc }; });
        return m;
      };
      setWoodOverrides(toMap(woodsRows));
      setMakerOverrides(toMap(makersRows));
      setFinishOverrides(toMap(finishRows));
      setShapeOverrides(toMap(shapesRows));
    })();
  }, []);

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
      const steel = detectSteel(tags, p.title||"", p.body_html||"");
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
  const chartKnives = visibleKnives.map(k =>
    (k?.steel && !isAvail(k.steel.label, steelAvailability)) ? {...k, steel:null} : k
  );
  const hasChart = chartKnives.some(k => k?.steel);
  const SECTIONS = Object.keys(INFO);

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
        <InfoPanel section={section} overrides={
          section==="Woods"  ? woodOverrides  :
          section==="Makers" ? makerOverrides :
          section==="Finish" ? finishOverrides :
          section==="Shape"  ? shapeOverrides  : null
        }/>
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
              steelUnavailable={knives[i]?.steel ? !isAvail(knives[i].steel.label, steelAvailability) : false}/>
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
        {hasChart && (
          <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:24}}>
            <button
              style={{height:42, background:"#111111", border:"none", color:"#ffffff",
                fontSize:11, fontWeight:500, letterSpacing:"0.1em",
                padding:"0 20px", cursor:"pointer", textTransform:"uppercase",
                borderRadius:2, display:"flex", alignItems:"center", gap:8}}>
              <span style={{fontSize:13}}>✦</span> Generate Sales Point
            </button>
            <select value={salesLang} onChange={e => setSalesLang(e.target.value)}
              style={{height:42, background:"#ffffff", border:"1px solid #e0e0da", color:"#1a1a16",
                fontSize:12, padding:"0 12px", borderRadius:2, cursor:"pointer"}}>
              <option value="en">🇺🇸 English</option>
              <option value="ja">🇯🇵 日本語</option>
              <option value="es">🇪🇸 Español</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="ar">🇸🇦 العربية</option>
              <option value="tr">🇹🇷 Türkçe</option>
              <option value="ru">🇷🇺 Русский</option>
            </select>
          </div>
        )}

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
