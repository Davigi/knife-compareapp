/**
 * generate-airtable-csv.js
 *
 * Run once: node scripts/generate-airtable-csv.js
 * Outputs: scripts/knowledge_base.csv  (steels.csv is maintained directly)
 * Import both files into Airtable (each CSV = one table).
 *
 * steels.csv is the source of truth for steel records — edit it directly.
 * This script no longer regenerates it; it only validates and reports row count.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const esc = (v) => {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

const row = (cols) => cols.map(esc).join(",");

// ─── STEELS ───────────────────────────────────────────────────────────────────
// steels.csv is maintained directly — edit it to add/update steel records.
// available=true  → shown in the app
// available=false → stored in DB, hidden from UI until reviewed

const steelsCsv = readFileSync(join(__dir, "steels.csv"), "utf8");
const steelLines = steelsCsv.trim().split("\n");
console.log(`✓ steels.csv — ${steelLines.length - 1} records (header excluded)`);

// ─── (old hardcoded STEELS removed — steels.csv is now the source of truth) ───

// The 31 original steels were duplicated here as a `_PLACEHOLDER` array holding
// the pre-migration 0-10 scores. It was dead code that contradicted
// scripts/steels.csv, the actual source of truth, and it was the most likely
// thing to be copied from when someone went looking for "the steel data".
// Removed. Edit scripts/steels.csv, then run:
//   node scripts/rescore-steels.mjs --write
// ↑ _PLACEHOLDER unused — kept only for git diff reference, safe to delete

// ─── KNOWLEDGE BASE ────────────────────────────────────────────────────────────

const KB = [
  // ── Metal ──
  { category:"Metal", group:"Carbon Steels", sort:1,  title:"SK Steel — HRC 58–62",                body:"C 0.95–1.10%. JIS standard basic tool steel. Entry-level, very easy to sharpen. Highly reactive.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:2,  title:"White Steel #3 (Shirogami 3) — HRC 59–62", body:"C 0.80–0.90%. Most forgiving Shirogami. Easiest to sharpen, lower retention. Very reactive.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:3,  title:"White Steel #2 (Shirogami 2) — HRC 61–64", body:"C 1.00–1.10%. Benchmark carbon steel. Extremely sharp, easy to sharpen. Very reactive.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:4,  title:"Blue Steel #2 (Aogami 2) — HRC 62–63", body:"C 1.0–1.2%, W 1.5–2.0%, Cr 0.2–0.5%. Most popular carbon knife steel. Excellent chip resistance.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:5,  title:"White Steel #1 (Shirogami 1) — HRC 62–65", body:"C 1.25–1.35%. Purest Shirogami. Top Honyaki knives. More brittle than #2.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:6,  title:"Blue Steel #1 (Aogami 1) — HRC 62–65", body:"C 1.2–1.4%, W 1.5–2.0%. Superior retention. For experienced users.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:7,  title:"V-Toku 2 — HRC 62–65",              body:"C 1.0–1.2%, V 0.2–0.3%. Vanadium carbides improve wear resistance. Fine grain.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:8,  title:"Blue Super (Aogami Super) — HRC 63–67", body:"C 1.4–1.5%, W 2.0–2.5%, Mo, V. Pinnacle of Yasugi steel. Expert care required.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Carbon Steels", sort:9,  title:"ApexUltra (Takefu) — HRC 64–67",    body:"C 1.55–1.65%, W, V, Mo. Extreme edge retention. Expert-only steel.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Semi-Stainless", sort:10, title:"SLD (Hitachi) — HRC 60–63",         body:"C 0.95–1.0%, Cr 7.8–8.5%, Mo 1.5%. Patinas rather than rusts. Excellent toughness.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Semi-Stainless", sort:11, title:"SKD (JIS SKD11) — HRC 62–64",       body:"C 1.4–1.6%, Cr 11–13%. High carbide volume for excellent retention.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Semi-Stainless", sort:12, title:"HAP-40 (Hitachi PM) — HRC 66–67",   body:"C 1.27%, Cr 4%, W 6%, Mo 5%, V 3%, Co 8%. Extreme hardness. Requires diamond stones.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:13, title:"MV (Molybdenum Vanadium) — HRC 56–58", body:"C 0.60–0.70%, Cr 13–14%. Entry-level. Low retention, excellent toughness.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:14, title:"AUS-8 (Aichi) — HRC 57–59",         body:"C 0.70–0.75%, Cr 13–14.5%. Balanced, forgiving. Easy to sharpen.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:15, title:"VG-1 (Takefu) — HRC 57–60",         body:"C 0.60–0.75%, Cr 14–15%. Entry VG series. Low maintenance.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:16, title:"VG-5 (Takefu) — HRC 59–61",         body:"C 0.80–0.90%, Cr 14–15%. Mid-range VG. Solid everyday performer.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:17, title:"ATS-34 (Hitachi) — HRC 60–62",      body:"C 1.05%, Cr 14%, Mo 4%. Gold standard before PM steels.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:18, title:"Swedish Steel (Sandvik) — HRC 60–62", body:"C 0.65–0.70%, Cr 13.5%. High-purity. Sharpness comparable to carbon steels.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:19, title:"VG-10 (Takefu) — HRC 60–62",        body:"C 1.0%, Cr 14.5–15.5%, Mo 1%, Co 1.5%. Industry benchmark premium stainless.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:20, title:"VG-MAX (Takefu) — HRC 60–62",       body:"C 1.0%, Cr 15%, V 0.3%, Co 2.5%. Upgraded VG-10. Higher retention.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:21, title:"AUS-10 (Aichi) — HRC 60–62",        body:"C 0.95–1.10%, Cr 13–14.5%, Ni. Higher retention than AUS-8.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:22, title:"Ginsan / Silver #3 (Hitachi) — HRC 61–62", body:"C 0.95–1.10%, Cr 13–14.5%. Carbon steel performance, stainless maintenance.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:23, title:"Chromax (Hitachi) — HRC 61–63",     body:"C 0.70–0.75%, Cr 13.5%. Emphasis on corrosion resistance. Easy sharpening.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:24, title:"COSP / Cobalt Special — HRC 62–64", body:"C 0.80–0.90%, Cr 13–14%, Co 3–5%. High cobalt allows greater hardness.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Stainless",       sort:25, title:"ZA-18 (Takefu) — HRC 63–65",        body:"C 1.0%, Cr 18%, Co. Near-immune to rust. Ideal for humid kitchens.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Powder Metallurgy (PM)", sort:26, title:"SG2 / R2 — HRC 62–64",       body:"C 1.25%, Cr 14%, V 1.8%, Mo 2.3%. Benchmark PM stainless. Endgame for most professionals.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Powder Metallurgy (PM)", sort:27, title:"FAXR2 (Takefu) — HRC 63–64", body:"C 1.3%, Cr 14%, Mo 2.5%, V 2.0%. Close to SG2. Excellent wear resistance.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Powder Metallurgy (PM)", sort:28, title:"SPG STRIX (Takefu) — HRC 63–64", body:"C 1.4%, Cr 14%, V 2.4%, Mo 2.0%. At or above SG2 in performance.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Powder Metallurgy (PM)", sort:29, title:"VG XEOS (Takefu) — HRC 63–65", body:"C 1.2–1.4%, V 1.5–2.0%, Mo 2.0–2.5%. Bridges VG-10 and SG2.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Powder Metallurgy (PM)", sort:30, title:"SRS-13 (Nachi-Fujikoshi) — HRC 63–65", body:"C 1.3%, Cr 13.5%, V 3%. High vanadium for outstanding retention.", image:"", link:"", shape:"" },
  { category:"Metal", group:"Powder Metallurgy (PM)", sort:31, title:"ZDP-189 (Hitachi) — HRC 67–69", body:"C 3.0%, Cr 20%. Extreme hardness. Very brittle. Expert-only.", image:"", link:"", shape:"" },

  // ── Shape ──
  { category:"Shape", group:"Double Bevel", sort:1,  title:"Gyuto",     body:"Japanese chef's knife. Versatile all-purpose blade. 180–270mm.", image:"/Gyuto.png", link:"", shape:"gyuto" },
  { category:"Shape", group:"Double Bevel", sort:2,  title:"Santoku",   body:"Three virtues: meat, fish, vegetables. Shorter, lighter than gyuto. 165–190mm.", image:"/Santoku.png", link:"", shape:"santoku" },
  { category:"Shape", group:"Double Bevel", sort:3,  title:"Nakiri",    body:"Vegetable knife. Straight edge for push-cutting. 150–180mm.", image:"/Nakiri.png", link:"", shape:"nakiri" },
  { category:"Shape", group:"Double Bevel", sort:4,  title:"Sujihiki",  body:"Slicing knife. Long, thin blade minimises tearing. 240–330mm.", image:"/Sujihiki.png", link:"", shape:"sujihiki" },
  { category:"Shape", group:"Double Bevel", sort:5,  title:"Bunka",     body:"Reverse tanto tip. Great for precision cuts. 165–200mm.", image:"/Bunka.png", link:"", shape:"bunka" },
  { category:"Shape", group:"Double Bevel", sort:6,  title:"Honesuki",  body:"Boning knife. Stiff triangular blade for poultry. 145–165mm.", image:"/Honesuki.png", link:"", shape:"honesuki" },
  { category:"Shape", group:"Double Bevel", sort:7,  title:"Petty",     body:"Small utility knife for detail work and peeling. 120–180mm.", image:"/Petty.png", link:"", shape:"petty" },
  { category:"Shape", group:"Single Bevel (Traditional)", sort:8,  title:"Deba",      body:"Heavy fish butchery knife. Handles heads, bones and scales. 150–210mm.", image:"/Deba.png", link:"", shape:"deba" },
  { category:"Shape", group:"Single Bevel (Traditional)", sort:9,  title:"Yanagiba",  body:"Sashimi slicer. Long pull-cut for clean fish slices. 240–360mm.", image:"/Yanagiba.png", link:"", shape:"yanagiba" },
  { category:"Shape", group:"Single Bevel (Traditional)", sort:10, title:"Usuba",     body:"Vegetable knife for katsuramuki thin sheets. 180–240mm.", image:"/Usuba.png", link:"", shape:"usuba" },
  { category:"Shape", group:"Single Bevel (Traditional)", sort:11, title:"Kiritsuke", body:"Multi-purpose single-bevel. Extremely difficult to master. Status symbol.", image:"/Kiritsuke.png", link:"", shape:"kiritsuke" },

  // ── Makers ──
  { category:"Makers", group:"Sakai Region", sort:1, title:"Sakai Takayuki", body:"One of the largest Sakai producers. Wide range from entry-level to professional grade.", image:"", link:"https://www.musashihamono.com/search?q=Sakai+Takayuki", shape:"" },
  { category:"Makers", group:"Sakai Region", sort:2, title:"Takeshi Saji",   body:"Master smith known for exquisite Damascus patterns and premium materials.", image:"", link:"https://www.musashihamono.com/search?q=Takeshi+Saji", shape:"" },
  { category:"Makers", group:"Sakai Region", sort:3, title:"Morihei / Hiden", body:"Traditional maker known for exceptional single-bevel knives and hand finishing.", image:"", link:"https://www.musashihamono.com/search?q=Morihei", shape:"" },
  { category:"Makers", group:"Echizen & Other Regions", sort:4, title:"Yoshimi Kato", body:"Award-winning blacksmith. Exceptional grinds, SG2 and Damascus specialist.", image:"", link:"https://www.musashihamono.com/search?q=Yoshimi+Kato", shape:"" },
  { category:"Makers", group:"Echizen & Other Regions", sort:5, title:"Yu Kurosaki",  body:"Modern master. Innovative surface patterns, exceptional balance and fit & finish.", image:"", link:"https://www.musashihamono.com/search?q=Yu+Kurosaki", shape:"" },
  { category:"Makers", group:"Echizen & Other Regions", sort:6, title:"Tosa Tradition", body:"Kochi Prefecture. Utilitarian high-performance knives with excellent value.", image:"", link:"https://www.musashihamono.com/search?q=Tosa", shape:"" },

  // ── Terminology ──
  { category:"Terminology", group:"Construction Terms", sort:1, title:"Honbazuke", body:"Initial edge setting by the maker. Establishes the final cutting geometry.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Construction Terms", sort:2, title:"Honyaki",   body:"Single steel construction. Highest grade, hamon visible. Requires expert maintenance.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Construction Terms", sort:3, title:"Kasumi",    body:"Mirror edge bevel, misty body from forge work. Classic Japanese aesthetic.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Construction Terms", sort:4, title:"Kurouchi",  body:"Forge scale left intact. Rustic look, protective, reduces food adhesion.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Construction Terms", sort:5, title:"Tsuchime",  body:"Hand-hammered dimple texture. Decorative and reduces food sticking.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Construction Terms", sort:6, title:"Nashiji",   body:"Pear-skin matte texture. Effective food release, refined appearance.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Geometry & Parts", sort:7, title:"Ha",         body:"The cutting edge of the blade.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Geometry & Parts", sort:8, title:"Mune",       body:"The spine (back) of the blade.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Geometry & Parts", sort:9, title:"Shinogi",    body:"Transition line between the flat and the beveled edge section.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Geometry & Parts", sort:10, title:"HRC",       body:"Rockwell Hardness Scale C. Higher = better retention but more brittle.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Geometry & Parts", sort:11, title:"Single Bevel", body:"Edge ground on one side only. Traditional Japanese. Right or left-handed specific.", image:"", link:"", shape:"" },
  { category:"Terminology", group:"Geometry & Parts", sort:12, title:"Double Bevel", body:"Edge ground symmetrically. Works for both left and right-handed users.", image:"", link:"", shape:"" },

  // ── Usages ──
  { category:"Usages", group:"By Task", sort:1, title:"Fish Butchery",   body:"Deba. Weight and single bevel handle heads, bones and scales.", image:"", link:"", shape:"" },
  { category:"Usages", group:"By Task", sort:2, title:"Sashimi / Sushi", body:"Yanagiba. Long pull-cut creates clean, undamaged fish slices.", image:"", link:"", shape:"" },
  { category:"Usages", group:"By Task", sort:3, title:"Vegetable Prep",  body:"Nakiri for everyday prep. Usuba for katsuramuki and precise julienne.", image:"", link:"", shape:"" },
  { category:"Usages", group:"By Task", sort:4, title:"General Cooking", body:"Gyuto or Santoku as workhorse knives for most kitchen tasks.", image:"", link:"", shape:"" },
  { category:"Usages", group:"By Task", sort:5, title:"Meat Slicing",    body:"Sujihiki. Long blade covers the full cut, minimising tearing.", image:"", link:"", shape:"" },
  { category:"Usages", group:"By Task", sort:6, title:"Poultry Breakdown", body:"Honesuki. Stiff blade follows bone structure closely.", image:"", link:"", shape:"" },
  { category:"Usages", group:"By Task", sort:7, title:"Detail / Garnish", body:"Petty. Fine precision work, peeling and garnishes.", image:"", link:"", shape:"" },

  // ── Finish ──
  { category:"Finish", group:"Finish Types", sort:1, title:"Kasumi",              body:"Mirror edge with misty body. The classic Japanese aesthetic.", image:"/Kasumi.png", link:"", shape:"" },
  { category:"Finish", group:"Finish Types", sort:2, title:"Kurouchi (Blacksmith)", body:"Forge scale intact. Rustic, protective patina. Excellent food release.", image:"/Kurouchi.png", link:"", shape:"" },
  { category:"Finish", group:"Finish Types", sort:3, title:"Migaki (Mirror)",     body:"Fully polished blade. Maximum visual impact. Shows scratches over time.", image:"/Migaki.png", link:"", shape:"" },
  { category:"Finish", group:"Finish Types", sort:4, title:"Nashiji (Pear Skin)", body:"Textured matte. Very effective food release.", image:"/Nashiji.jpg", link:"", shape:"" },
  { category:"Finish", group:"Finish Types", sort:5, title:"Tsuchime (Hammered)", body:"Hand-hammered dimples. Highly decorative with anti-stick properties.", image:"/Tsuchime.jpeg", link:"", shape:"" },
  { category:"Finish", group:"Finish Types", sort:6, title:"Suminagashi (Damascus)", body:"Folded steel pattern. Each blade is unique.", image:"/Damascus.jpg", link:"", shape:"" },

  // ── Woods ──
  { category:"Woods", group:"Traditional Japanese", sort:1, title:"Ho (Magnolia)",    body:"Lightweight, absorbs moisture. Traditional Wa handle choice. Replaceable.", image:"/Magnolia.jpg", link:"", shape:"" },
  { category:"Woods", group:"Traditional Japanese", sort:2, title:"Walnut (Kurumi)",  body:"Dense, beautiful grain. Natural oils provide water resistance.", image:"/Walnut.jpg", link:"", shape:"" },
  { category:"Woods", group:"Traditional Japanese", sort:3, title:"Cherry (Sakura)",  body:"Hard, warm reddish tones. Good balance of grip and aesthetics.", image:"/Cherry.jpg", link:"", shape:"" },
  { category:"Woods", group:"Traditional Japanese", sort:4, title:"Chestnut (Kuri)",  body:"Traditional choice. Warm brown tones, medium weight.", image:"/Chestnut.jpg", link:"", shape:"" },
  { category:"Woods", group:"Traditional Japanese", sort:5, title:"Ebony",            body:"Very dense and dark. Premium traditional choice. Excellent water resistance.", image:"/Ebony.jpg", link:"", shape:"" },
  { category:"Woods", group:"Modern & Premium",     sort:6, title:"Stabilized Wood",  body:"Resin-impregnated. Highly water resistant, vivid colors, very stable.", image:"", link:"", shape:"" },
  { category:"Woods", group:"Modern & Premium",     sort:7, title:"Rosewood",         body:"Rich reddish-brown, high natural oil content. Dense and durable.", image:"/Rosewood.jpg", link:"", shape:"" },
  { category:"Woods", group:"Modern & Premium",     sort:8, title:"Ambrosia Maple",   body:"Blue-grey streaks from beetle galleries. Highly decorative.", image:"/Maple.jpg", link:"", shape:"" },
  { category:"Woods", group:"Modern & Premium",     sort:9, title:"Pakkawood",        body:"Resin-compressed layered wood. Stable, water resistant, various colors.", image:"", link:"", shape:"" },

  // ── Packs ──
  { category:"Packs", group:"By Number of Knives", sort:1, title:"1 Knife", body:"Santoku 165–180mm in VG-10 or Ginsan. The single all-rounder that handles meat, fish, and vegetables comfortably.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Number of Knives", sort:2, title:"2 Knives", body:"Gyuto + Petty. The classic combo — one for everything, one for detail work and fruit.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Number of Knives", sort:3, title:"3 Knives", body:"Gyuto + Petty + Nakiri. Covers protein, detail work, and vegetables.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Number of Knives", sort:4, title:"4 Knives", body:"Gyuto + Petty + Nakiri + Sujihiki. Adds a slicer for larger cuts of meat and fish.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Number of Knives", sort:5, title:"5 Knives", body:"Gyuto + Santoku + Nakiri + Petty + Deba. A well-rounded kitchen set covering daily tasks plus fish butchery.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Number of Knives", sort:6, title:"6 Knives", body:"Gyuto + Santoku + Nakiri + Petty + Deba + Sujihiki. The complete professional set.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Customer Type", sort:7, title:"Chef",       body:"Gyuto 240–270mm in premium steel (Blue Super, SG2). Performance over comfort, built for volume.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Customer Type", sort:8, title:"Sushi Chef", body:"Yanagiba + Deba + Usuba. The traditional single-bevel set for itamae work.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Customer Type", sort:9, title:"Gift",       body:"Santoku or Petty with a decorative handle (Damascus, premium wood) in a gift box.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Customer Type", sort:10, title:"Fisher",    body:"Deba + a sturdy Petty for on-the-spot cleaning and filleting.", image:"", link:"", shape:"" },
  { category:"Packs", group:"By Customer Type", sort:11, title:"Hunter",    body:"Thick-bladed knife in a tough steel (SLD, SKD) built for processing game.", image:"", link:"", shape:"" },

  // ── General ──
  { category:"General", group:"Care & Maintenance", sort:1, title:"Never dishwasher",   body:"Hand wash and dry immediately. Dishwashers destroy handles and edges.", image:"", link:"", shape:"" },
  { category:"General", group:"Care & Maintenance", sort:2, title:"Cutting surfaces",   body:"Wood or plastic only. Glass and ceramic destroy any edge quickly.", image:"", link:"", shape:"" },
  { category:"General", group:"Care & Maintenance", sort:3, title:"Carbon steel care",  body:"Dry immediately after use. Apply camellia oil for storage.", image:"", link:"", shape:"" },
  { category:"General", group:"Care & Maintenance", sort:4, title:"Sharpening",         body:"Whetstones: 400–1000 grit for repair, 1000–3000 regular, 6000+ polishing.", image:"", link:"", shape:"" },
  { category:"General", group:"Care & Maintenance", sort:5, title:"Storage",            body:"Magnetic strip, knife block, or blade guards. Never loose in drawers.", image:"", link:"", shape:"" },
  { category:"General", group:"Customer Notes",     sort:6, title:"Tax-Free Shopping",  body:"Non-resident visitors receive 6% tax-free discount. Passport required at purchase.", image:"", link:"", shape:"" },
  { category:"General", group:"Customer Notes",     sort:7, title:"Beginner",           body:"VG-10 or Ginsan. Stainless, forgiving, low maintenance. Gyuto or Santoku.", image:"", link:"", shape:"" },
  { category:"General", group:"Customer Notes",     sort:8, title:"Intermediate",       body:"Blue #2. Better performance. Requires immediate drying after use.", image:"", link:"", shape:"" },
  { category:"General", group:"Customer Notes",     sort:9, title:"Advanced",           body:"White #1, Honyaki, single-bevel. Maximum performance. Full care commitment.", image:"", link:"", shape:"" },
];

// ─── Generate CSVs ─────────────────────────────────────────────────────────────

// knowledge_base.csv
const kbHeaders = ["category","group","sort_order","title","body","image_url","link","shape_key","published"];
const kbRows = KB.map(k => row([
  k.category, k.group, k.sort, k.title, k.body, k.image, k.link, k.shape, "true",
]));
writeFileSync(join(__dir, "knowledge_base.csv"), [row(kbHeaders), ...kbRows].join("\n"), "utf8");
console.log(`✓ knowledge_base.csv — ${KB.length} records`);

console.log("\nNext: import both CSVs into Airtable, then copy the table IDs into Netlify env vars.");
