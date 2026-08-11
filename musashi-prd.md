# Musashi Knife App — Product Requirements Document

> **How to use this file**
> This is the living source of truth for the project. Read this at the start of every session.
> `[ DECIDED ]` = locked. `[ TODO ]` = needs an answer before work can start on that section.
> Update it as decisions change. Last updated: 2026-08-11.

---

## 1. Context

**Company:** Musashi Japan (musashihamono.com — Shopify store)
**Product owner / designer-engineer:** David Martinez (Davigi)
**Project codename:** Musashi SOT (Source of Truth)
**Current live prototype:** https://davigiknife-compare.netlify.app
**Source repo:** knife-compare (React + Vite, deployed on Netlify)

### The problem

New salespeople in Musashi shops lack the knife knowledge to guide customers confidently. The current tool solves this but has two blockers to going live:

1. The steel database (~40 steel types) and the entire knowledge base (8 sections) live as hardcoded JS objects in `App.jsx`. Any update requires a code deploy.
2. The Airtable API token is exposed in client-side code — a security issue.

Everything else (Shopify integration, barcode scanner, diamond chart, stat bars, Airtable feedback) is already built and working.

### The goal

Evolve the current prototype into a production-ready tool by:
1. Moving the steel database and knowledge base out of code and into Airtable
2. Securing the Airtable token behind a Netlify Function
3. Adding a steel-detection scraper for any external knife URL
4. Implementing the "Generate Sales Point" AI feature (already wired in the UI)
5. Redesigning with Tailwind CSS — mobile-first, dark-themed

---

## 2. What already exists (do not rebuild)

Reading the source code revealed these are fully working:

| Feature | How it works |
|---------|-------------|
| Shopify product fetch | `/api/products/{handle}.json` proxied to musashihamono.com via Netlify rewrite |
| Shopify search | `/api/search/suggest.json` — searches by name, SKU, vendor |
| Auto steel detection | Fuzzy-matches product tags + HTML against the hardcoded STEELS dictionary |
| Diamond chart | 4-axis SVG: edge retention, chip resistance, corrosion resistance, ease of sharpening |
| Stat bars | Horizontal bars for the same 4 metrics, up to 3 knives |
| Barcode / QR scanner | BarcodeDetector API with ZXing fallback — scans in-shop knife tags |
| Airtable feedback | Staff reports product data issues (steel mismatch, wrong specs, etc.) |
| Google Sheets overrides | Steel availability flags + photo overrides for woods, makers, finishes, shapes |
| 3-knife comparison | Up to 3 panels, add/remove third knife |
| Knowledge base side panel | 8 sections accessed from hamburger menu |
| Easter egg | Click logo 10× → pixel-art knife-catching game |

**What this means for the rebuild:** Do not switch frameworks. Keep React + Vite + Netlify. The rebuild is a restructuring and extension, not a rewrite.

---

## 3. Users

| User | Device | Key need |
|------|--------|----------|
| Sales staff (in-shop) | Smartphone — primary | Scan a barcode or type a name, get comparison in seconds |
| Customer (self-serve) | Any | Understand the difference between two knives |
| Product / marketing team | Desktop | Update steel info and knowledge base without touching code |

**[ DECIDED ]** The app is fully public. No login required. Comparisons are session-only (not saved).

---

## 4. Features

### 4.1 What needs to change in the rebuild

**Move steel data to Airtable** `[ CRITICAL ]`
- The `STEELS` object in App.jsx (~40 steel types with compositions, HRC, 4 ratings, descriptions, maker, category) must move to an Airtable base
- The app fetches this on load via a Netlify Function (to keep the Airtable token server-side)
- Product team updates steel data directly in Airtable — no code deploy needed

**Move knowledge base to Airtable** `[ CRITICAL ]`
- The `INFO` object (8 sections: Metal, Shape, Makers, Terminology, Usages, Finish, Woods, Packs) moves to Airtable
- Each section is a table; articles within it are rows
- The app fetches and renders dynamically
- Product team can add new sections or entries from Airtable

**Fix security: Airtable token** `[ CRITICAL — do first ]`
- Token is currently exposed at line 338 of App.jsx
- Move to a Netlify environment variable (`AIRTABLE_TOKEN`)
- All Airtable calls go through a Netlify Function, never direct from the browser

**Tailwind CSS redesign** `[ HIGH ]`
- Replace all inline styles with Tailwind utility classes
- Dark theme — Tailwind's dark preset as the design system baseline
- CSS is configurable by the UI team without touching component logic
- Mobile-first: the barcode scan + comparison must work perfectly on a 390px screen

**Security hardening** `[ CRITICAL ]`
- See Section 6 for the full security model covering Airtable, Shopify, and the scraper

### 4.2 New features

**Steel detection from any external URL** `[ HIGH ]`
- User pastes a URL from any knife retailer (not just Musashi)
- Netlify Function fetches the page HTML (bypasses browser CORS)
- Extracts the steel type name using pattern matching (same logic as current `detectSteel`)
- Looks it up in the Airtable STEELS database
- If found: renders the steel profile and includes it in the comparison chart
- If not found: shows "Steel not in our database" with the raw name detected
- This is NOT a full product import — only the steel type is used for comparison
- Images, price, and product details are not shown for external URLs

**Fully dynamic knowledge base sections** `[ HIGH ]`
- The `category` field in Airtable defines every section — no code changes needed to add one
- Adding a new row with `category: "Knives Care"` in Airtable automatically creates that section in the app
- The app fetches all unique categories and renders them as nav tabs, sorted by a `sort_order` field
- Sections with no published entries are hidden automatically
- The hamburger menu tab list is generated from live Airtable data, not hardcoded strings

**Knowledge base search** `[ MEDIUM ]`
- Simple client-side search across the fetched Airtable content
- Filters entries as the user types — no server round trip needed

**Multi-language UI** `[ MEDIUM — v1 or v2 ]`
- Interface labels in JP and EN minimum
- Language toggle in the header
- Knowledge base content stays in the language it was written (authored in Airtable)
- `[ TODO ]` Confirm: does the knowledge base need full translation, or just the UI chrome?

### 4.3 Removed from scope

- **"Generate Sales Point"** — removed entirely. The UI button and language selector will be removed from the comparison view.

### 4.4 Keep as-is (no changes)

- Shopify product fetch and search
- Barcode / QR scanner
- Diamond chart and stat bars
- 3-knife comparison panel layout
- Feedback / note modal (token moves to server-side — no UI change)
- Steel availability (migrates from Google Sheets to Airtable `available` field)

### 4.4 Out of scope

- E-commerce or purchasing flow
- User accounts, saved comparisons, wishlists
- Ratings or reviews from customers
- Inventory management
- Native mobile app

---

## 5. Data model

### Steel (Airtable table)

Currently hardcoded as the `STEELS` object. Needs to move to Airtable with these fields:

```
steel {
  key           string    lookup key(s), comma-separated (e.g. "vg-10, vg10, vg 10")
  label         string    display name (e.g. "VG-10")
  category      string    "Carbon" | "Semi-stainless" | "Stainless" | "Stainless PM"
  maker         string    e.g. "Takefu", "Hitachi", "Aichi"
  hrc           string    e.g. "60–62"
  retention     number    1–10
  sharpening    number    1–10
  corrosion     number    1–10
  chip          number    1–10
  c_pct         string    carbon % (e.g. "1.00%")
  cr_pct        string    chromium %
  mo_pct        string    molybdenum %
  v_pct         string    vanadium %
  w_pct         string    tungsten %
  co_pct        string    cobalt %
  mn_pct        string    manganese %
  si_pct        string    silicon %
  other_comp    string    any other elements (free text)
  description   long text full explanation for the knowledge base
  available     boolean   if false, excluded from comparison chart (current Google Sheets feature)
}
```

### Knowledge base article (Airtable table per section, or one table with a category field)

```
article {
  title         string
  category      string    "Metal" | "Shape" | "Makers" | "Terminology" | "Usages" | "Finish" | "Woods" | "Packs" | (custom)
  group_name    string    sub-group heading within a section
  body          long text the explanation text
  image_url     string    optional photo (Airtable attachment URL)
  link          string    optional external link
  shape_key     string    optional — maps to SVG blade silhouettes (gyuto, santoku, etc.)
  sort_order    number    controls display order within group
  published     boolean
}
```

### Knife types taxonomy

Already defined in the app via `SHAPE_BLADES`. Canonical list:
- gyuto, santoku, nakiri, usuba, sujihiki, yanagiba, bunka, honesuki, petty, deba, kiritsuke
- These are used for the SVG blade icons — adding a new type requires a new SVG points string

### Imported steel profile (external URL, session-only)

```
external_scrape {
  source_url      string
  raw_steel_name  string    what was detected in the page text
  matched_steel   steel?    the Airtable steel record, if found
  confidence      "high" | "low" | "not_found"
}
```
No database storage needed — this is computed and held in React state only.

---

## 6. Tech stack

**[ DECIDED ]** — Constraints: $0 budget, 2-week timeline, existing Netlify deployment.

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React + Vite (existing) | No reason to switch. Rebuilding in Next.js adds 3+ days with no user benefit |
| Styling | Tailwind CSS (new) | Replaces all inline styles. Dark theme. Configurable by UI team |
| Charts | Keep existing SVG diamond chart + stat bars | Already works, no dependency needed |
| Backend | Netlify Functions (existing, extend) | Already proxying Shopify. Add 2 new functions: Airtable proxy, URL scraper |
| CMS / database | Airtable (existing, extend) | Already used for feedback. Free tier: 1000 records/base — enough for steels + KB |
| Knife data | Shopify API via existing Netlify proxy | 2000+ references. Do not replicate — fetch live |
| URL scraping | Netlify Function + fetch | Simple server-side HTML fetch. No paid scraping service needed |
| Hosting | Netlify (existing) | Free tier, custom domain support |
| Domain | `[ TODO ]` Not decided | |
| Repo | Public GitHub | Open source |

### Netlify Functions needed (2 new, 1 secured)

```
/netlify/functions/airtable-proxy.js       ← NEW
  → Fetches steels + knowledge base from Airtable
  → Uses AIRTABLE_TOKEN env var (never exposed to browser)
  → Validates request origin (only accepts calls from the app domain)
  → Called once on app load, response cached in sessionStorage

/netlify/functions/scrape-steel.js         ← NEW
  → Accepts { url }
  → Validates URL is a real http/https URL before fetching
  → Fetches the page HTML server-side (bypasses browser CORS)
  → Runs detectSteel() logic against the HTML
  → Returns { rawName, matchedSteel, confidence }
  → Never stores or logs the scraped content

/netlify/functions/shopify-proxy.js        ← EXISTS (netlify.toml rewrite, convert to function)
  → Currently a dumb proxy — any path is forwarded to musashihamono.com
  → Harden: allowlist only /products/*.json and /search/suggest.json
  → Add rate limiting header check (Netlify's built-in request limit applies)
```

### Netlify environment variables

```
AIRTABLE_TOKEN          pat0T4h...  (move from App.jsx line 338 — critical)
AIRTABLE_BASE           appNNUwyYfe1yLgof
AIRTABLE_STEELS_TABLE   (new table ID after migration)
AIRTABLE_KB_TABLE       (new table ID after migration)
```

### Security model

**Airtable**
- API token lives only in Netlify env vars — never shipped in the JS bundle
- The browser calls `/netlify/functions/airtable-proxy`, not Airtable directly
- The proxy function only exposes read-only data (steels, KB articles) — the feedback write endpoint is a separate function and only accepts POST with a strict schema
- Airtable base permissions: the token used should have read-only scope for steels/KB, write-only scope for the feedback table

**Shopify**
- The existing Netlify rewrite (`/api/* → musashihamono.com/api/*`) forwards all paths — too broad
- Replace with a hardened function that only allows two endpoints:
  - `GET /products/{handle}.json`
  - `GET /search/suggest.json`
- All other paths return 404 from the function — the Shopify store is never exposed further
- No Shopify API key is used (the proxy hits the public storefront endpoints only, which require no auth)

**URL scraper**
- The scrape function accepts only `http://` and `https://` URLs — rejects file:// and internal addresses
- Does not follow redirects to private IP ranges (SSRF protection)
- Response size is capped (e.g. 500KB) to prevent abuse
- The function returns only the detected steel name and the matched record — never the raw HTML

---

## 7. URL steel-detection feature — precise spec

This is the new feature with the most complexity. Being precise here prevents rework.

### What it does

Detects the steel type in any knife product page and looks it up in the Musashi steel database for comparison. It does NOT import the knife product (no name, price, or image from external sources).

### What it does NOT do

- It does not display the external product's name, price, or images
- It does not store anything beyond the current session
- It is not a scraping/aggregation service

### User flow

1. User types or pastes any URL into a knife panel search field (e.g. a Shun or Global product page)
2. App detects it's an external URL (not musashihamono.com)
3. Calls `/netlify/functions/scrape-steel.js` with the URL
4. Function fetches the page HTML, runs `detectSteel()` against it
5. If a steel is matched: panel shows the steel profile (from Airtable data). The diamond chart includes it.
6. If no match: panel shows "Steel detected: [raw name] — not in our database yet"
7. If fetch fails (bot-blocked, paywall): panel shows an error message

### Steel detection logic (reuse from current code)

The existing `detectSteel(tags, title, body)` function in App.jsx already handles fuzzy matching. For external URLs, we call it with `([], "", pageText)` since we have no tags or structured title — just raw page text.

---

## 8. Design spec

**[ DECIDED ]** Dark-themed Tailwind design system. Mobile-first.

### Tailwind config (to build)

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',  // or 'media' — TBD
  theme: {
    extend: {
      colors: {
        // Musashi palette — map to Tailwind custom tokens
        'musashi-dark':   '#111111',  // header / dark surfaces
        'musashi-cream':  '#fafaf8',  // page background
        'musashi-card':   '#ffffff',  // card surfaces
        'musashi-border': '#e8e8e3',  // borders
        'musashi-muted':  '#9a9a94',  // secondary text
        'musashi-text':   '#1a1a16',  // primary text
        // Accent colors for 3-knife comparison
        'accent-1': '#2060a0',
        'accent-2': '#1a8a50',
        'accent-3': '#7040a0',
      },
      fontFamily: {
        sans: ['Jost', 'system-ui', 'sans-serif'],
      },
    },
  },
}
```

### Component structure (new file organization)

```
src/
  components/
    KnifePanel/         Search input, barcode scan button, knife card
    CompareChart/       Diamond SVG + stat bars
    KnowledgeBase/      Side panel + section tabs + article list
    SteelProfile/       Collapsible steel detail card
    SalesPoint/         AI-generated pitch + language selector
    ScanModal/          Camera barcode scanner
    NoteModal/          Staff feedback form
  hooks/
    useKnife.js         Fetch + parse a knife from Shopify or external URL
    useAirtable.js      Load steels + knowledge base from Netlify Function
    useSteelDetect.js   Resolve steel from a fetched knife
    useIsMobile.js      (existing)
  utils/
    detectSteel.js      (extracted from App.jsx — no changes needed)
    parseSpecs.js       (extracted from App.jsx — no changes needed)
    formatPrice.js
  App.jsx               Thin root — composes components, holds state
  main.jsx              (unchanged)
```

### Mobile-first priorities

The scanner and comparison must work on a 390px screen. Current layout already handles mobile via `useIsMobile()` — Tailwind responsive classes replace the JS check.

---

## 9. Build plan — 2 weeks

### Week 1: Foundation

| Day | Task |
|-----|------|
| 1 | Fix security: move Airtable token to env var + Netlify Function. Deploy. |
| 2 | Set up Airtable: create Steels table, migrate all 40 steel entries from App.jsx |
| 3 | Set up Airtable: create Knowledge Base table, migrate INFO object |
| 4 | Build `airtable-proxy` Netlify Function. Wire to app. Verify app works off Airtable. |
| 5 | Install Tailwind. Start componentizing App.jsx into separate files. |

### Week 2: Features + redesign

| Day | Task |
|-----|------|
| 6 | Complete component split. Mobile-first Tailwind redesign. Remove Sales Point button + language selector. |
| 7 | Harden Shopify proxy: replace netlify.toml rewrite with a strict allowlist function. |
| 8 | Build `scrape-steel` Netlify Function with SSRF protection. Wire to external URL detection. |
| 9 | Multi-language UI (EN + JP chrome). Knowledge base search (client-side). |
| 10 | QA: mobile, edge cases (scrape fail, steel not found, blocked URL, 3-knife layout). Deploy. |

### What's not in this 2-week window (v2)

- Full JP translation of knowledge base content
- Knowledge base linked to specific knives
- Additional knife types beyond the current 11 blade shapes
- Analytics / logging of URL scrapes

---

## 10. Open questions remaining

| # | Question | Status |
|---|----------|--------|
| 1 | Does knowledge base need full JP translation or just UI chrome? | Open |
| 2 | Custom domain — decided? | Open |
| 3 | Who migrates the steel data + knowledge base content to Airtable? | Open |

---

*Source code read and incorporated: 2026-08-11*
*App.jsx: 1792 lines, single-component React. Shopify proxy, Airtable, Google Sheets, barcode scanner all confirmed working.*
