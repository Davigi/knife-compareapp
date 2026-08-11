// ── Comparison accent colors (matches CSS --color-accent-0/1/2) ───────────────
export const ACCENTS = ["#2060a0", "#1a8a50", "#7040a0"];

// ── Steel performance metrics ─────────────────────────────────────────────────
export const METRICS = ["retention", "chip", "corrosion", "sharpening"];

// ── Category badge colors ─────────────────────────────────────────────────────
export const CAT_TEXT = {
  "Carbon":        "#8a6820",
  "Semi-stainless":"#2a7a40",
  "Stainless":     "#2060a0",
  "Stainless PM":  "#6040a0",
};
export const CAT_BG = {
  "Carbon":        "#fdf5e4",
  "Semi-stainless":"#e8f5ee",
  "Stainless":     "#e4eef8",
  "Stainless PM":  "#ede8f8",
};

// ── Knowledge base category headings ─────────────────────────────────────────
export const KB_HEADINGS = {
  Metal:       "Steel Types",
  Shape:       "Blade Shapes",
  Makers:      "Notable Makers",
  Terminology: "Key Terminology",
  Usages:      "Knife Usages",
  Finish:      "Surface Finishes",
  Woods:       "Handle Woods",
  Packs:       "Recommended Packs",
  General:     "General Knowledge",
};

// ── Blade shape SVG polygon points ───────────────────────────────────────────
export const SHAPE_BLADES = {
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

// ── Feedback issue types ──────────────────────────────────────────────────────
export const ISSUE_TYPES = [
  "Steel mismatch",
  "Wrong specs",
  "Missing info",
  "Wrong price",
  "Other",
];
