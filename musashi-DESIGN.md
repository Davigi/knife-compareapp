---
version: alpha
name: "Musashi Hamono Dark Craft"
description: "Musashi Hamono is a Japanese knife e-commerce brand with a dark, craft-forward aesthetic. The site uses a near-black (#111111) background as its dominant surface, white text for legibility, and a vivid orange (#ec6a2c) as the sole action color for CTAs and accent borders. Typography pairs Inter (headings) with Zen Kaku Gothic New (body/CJK), supporting both Latin and Japanese scripts. The layout is grid-disciplined with zero border-radius on cards and containers, contrasted by fully-rounded pill buttons (120px radius). Product photography is presented on dark stone textures, reinforcing the artisanal, premium knife brand identity."
colors:
  surface-base: "#111111"
  card-popup-surface: "#ffffff"
  surface-dark-alt: "#161616"
  accent-silver: "#d5d5d5"
  action-orange: "#ec6a2c"
  foreground-black: "#000000"
  muted-text: "#666666"
  text-primary: "#ffffff"
typography:
  product-title-h1:
    fontFamily: "Inter, sans-serif"
    fontSize: "40px"
    fontWeight: "700"
    lineHeight: "32px"
    letterSpacing: "0em"
  body-cjk-primary:
    fontFamily: "Zen Kaku Gothic New, sans-serif"
    fontSize: "20px"
    fontWeight: "400"
    lineHeight: "22px"
  nav-menu-link:
    fontFamily: "Zen Kaku Gothic New, sans-serif"
    fontSize: "15.5556px"
    fontWeight: "400"
    lineHeight: "17.1111px"
  body-inter:
    fontFamily: "Inter, sans-serif"
    fontSize: "17px"
    fontWeight: "400"
    lineHeight: "20.4px"
  label-bold:
    fontFamily: "Zen Kaku Gothic New, sans-serif"
    fontSize: "14.4px"
    fontWeight: "600"
    lineHeight: "14.4px"
  body-medium:
    fontFamily: "Zen Kaku Gothic New, sans-serif"
    fontSize: "16px"
    fontWeight: "500"
    lineHeight: "19.2px"
  cta-button:
    fontFamily: "Inter, sans-serif"
    fontSize: "15.5556px"
    fontWeight: "700"
    lineHeight: "17.1111px"
rounded:
  none: "0px"
  sm: "2px"
  md: "5px"
  pill: "120px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "15px"
  lg: "20px"
  xl: "24px"
  2xl: "28.8px"
  3xl: "32px"
  4xl: "40px"
  5xl: "60px"
  6xl: "70px"
  7xl: "80px"
  8xl: "90px"
---

## Overview

Musashi Hamono is a Japanese knife e-commerce brand with a dark, craft-forward aesthetic. The site uses a near-black (#111111) background as its dominant surface, white text for legibility, and a vivid orange (#ec6a2c) as the sole action color for CTAs and accent borders. Typography pairs Inter (headings) with Zen Kaku Gothic New (body/CJK), supporting both Latin and Japanese scripts. The layout is grid-disciplined with zero border-radius on cards and containers, contrasted by fully-rounded pill buttons (120px radius). Product photography is presented on dark stone textures, reinforcing the artisanal, premium knife brand identity.

**Signature traits:**
- Dual typeface system: Pairs Inter, sans-serif and Zen Kaku Gothic New, sans-serif across the type hierarchy.
- Soft, rounded geometry: Generous corner rounding up to 120px.
- Single-accent color discipline: A neutral-led palette reserves #ec6a2c as the lone accent.
- Layered elevation: Depth comes from 2 validated shadow tokens.

## Colors

The palette uses 8 validated color tokens across 1 theme profile. Semantic roles stay attached to observed usage so generation agents can choose accents without inventing new color meaning.

**Semantic naming:**
- **surface-primary** maps to `surface-base`: Role "primary" is grounded by usage context "Primary page and section background, nav bar, product area".
- **action-text** maps to `text-primary`: Role "text" is grounded by usage context "Body text, nav links, price labels, form inputs".
- **surface-background** maps to `surface-dark-alt`: Role "background" is grounded by usage context "Footer and secondary surface areas".
- **content-text** maps to `muted-text`: Role "text" is grounded by usage context "Subdued labels, secondary UI text in header zone".

### Primary Brand
- **Surface Base** (#111111): Primary page and section background, nav bar, product area. Role: primary. {authored: rgb(17, 17, 17), space: rgb}

### Text Scale
- **Accent Silver** (#d5d5d5): Product title color, logo link, star ratings, secondary text. Role: text. {authored: rgb(213, 213, 213), space: rgb}
- **Action Orange** (#ec6a2c): Add to Cart button fill, accent borders, CTA highlights. Role: text. {authored: rgb(236, 106, 44), space: rgb}
- **Foreground Black** (#000000): Accent foreground, product card popup text, button text on light surfaces. Role: text. {authored: rgb(0, 0, 0), space: rgb, alpha: 0.36}
- **Muted Text** (#666666): Subdued labels, secondary UI text in header zone. Role: text. {authored: rgb(102, 102, 102), space: rgb}
- **Text Primary** (#ffffff): Body text, nav links, price labels, form inputs. Role: text. {authored: rgb(255, 255, 255), space: rgb, alpha: 0.08}

### Surface & Shadows
- **Card Popup Surface** (#ffffff): Product card popup overlay background. Role: background. {authored: rgb(255, 255, 255), space: rgb, alpha: 0.08}
- **Surface Dark Alt** (#161616): Footer and secondary surface areas. Role: background. {authored: rgb(22, 22, 22), space: rgb}

## Typography

Typography uses Inter, sans-serif, Zen Kaku Gothic New, sans-serif across extracted hierarchy roles. Keep hierarchy mapped to these token rows before adding decorative type styles.

Mixes Inter, sans-serif and Zen Kaku Gothic New, sans-serif for visual contrast. Weight range spans bold, regular, semi-bold, medium. Sizes range from 14.4px to 40px.

### Font Roles
- **Headline Font**: Inter
- **Body Font**: Inter

### Type Scale Evidence
| Role | Font | Size | Weight | Line Height | Letter Spacing | Stack / Features | Notes |
|------|------|------|--------|-------------|----------------|------------------|-------|
| Primary product heading — large, bold, white on dark | Inter, sans-serif | 40px | 700 | 32px | 0em | Inter, sans-serif | Extracted token |
| Main body text, Japanese/Latin mixed content, product descriptions | Zen Kaku Gothic New, sans-serif | 20px | 400 | 22px | normal | Zen Kaku Gothic New, sans-serif | Extracted token |
| Primary navigation links, submenu items | Zen Kaku Gothic New, sans-serif | 15.5556px | 400 | 17.1111px | normal | Zen Kaku Gothic New, sans-serif | Extracted token |
| Secondary body text, UI labels, breadcrumbs | Inter, sans-serif | 17px | 400 | 20.4px | normal | Inter, sans-serif | Extracted token |
| Small bold labels, tags, category chips | Zen Kaku Gothic New, sans-serif | 14.4px | 600 | 14.4px | normal | Zen Kaku Gothic New, sans-serif | Extracted token |
| Medium-weight body text, section subheadings | Zen Kaku Gothic New, sans-serif | 16px | 500 | 19.2px | normal | Zen Kaku Gothic New, sans-serif | Extracted token |
| Button labels — uppercase, bold | Inter, sans-serif | 15.5556px | 700 | 17.1111px | normal | Inter, sans-serif | Extracted token |

## Layout

Responsive system uses 3 breakpoint tier(s): mobile, tablet, desktop.

This system uses a 4px base grid with scale values 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20.

### Responsive Strategy
- **mobile (475-1350px)**: Constrain layout for small viewports and prioritize vertical stacking.
- **tablet (767-1023px)**: Increase spacing and column structure for medium-width viewports.
- **desktop (1024-1280px)**: Expand layout density and horizontal composition for wide viewports.

### Spacing System
| Token | Value | Px | Notes |
|------|-------|----|-------|
| xs | 4px | 4 | Extracted spacing token |
| sm | 8px | 8 | Extracted spacing token |
| md | 12px | 12 | Extracted spacing token |
| base | 15px | 15 | Mapped to --gutter-small |
| lg | 20px | 20 | Mapped to --grid-padding-base |
| xl | 24px | 24 | Extracted spacing token |
| 2xl | 28.8px | 28.8 | Extracted spacing token |
| 3xl | 32px | 32 | Extracted spacing token |
| 4xl | 40px | 40 | Mapped to --gutter-container |
| 5xl | 60px | 60 | Mapped to --gutter-large |
| 6xl | 70px | 70 | Extracted spacing token |
| 7xl | 80px | 80 | Extracted spacing token |
| 8xl | 90px | 90 | Mapped to --gutter-xlarge |

## Elevation & Depth

Keep depth flat unless validated shadow or interaction evidence appears in the extraction payload. Do not invent shadows beyond this evidence boundary.

### Shadow Evidence
| Shadow Token | Layers | Details |
|--------------|--------|---------|
| card-popup | 1 | 0px 4px 10px 0px rgba(63, 63, 68, 0.4) |
| modal-overlay | 1 | 0px 8px 24px 0px rgba(0, 0, 0, 0.4) |

### Interaction Signals
| Theme | Signal | Evidence |
|-------|--------|----------|
| Light | outline-color | rgb(255, 255, 255) ; rgb(213, 213, 213) ; rgb(0, 0, 0) |
| Light | outline-width | 3px |
| Light | outline-offset | 0px ; -5px |
| Light | transform | matrix(1, 0, 0, 1, 0, 0) ; matrix(1, 0, 0, 1, 0, 10) ; matrix(-1, 0, 0, -1, 0, 0) |

## Shapes

Shape language maps directly to rounded tokens. Keep component corners consistent with the role mapping below before introducing bespoke geometry.

### Radius Roles
| Token | Value | Px | Role Mapping |
|------|-------|----|--------------|
| none | 0px | 0 | Hairline corner |
| sm | 2px | 2 | Hairline corner |
| md | 5px | 5 | Subtle corner |
| pill | 120px | 120 | Large surface corner |

### Geometry Evidence
| Radius Token | Shape | Units |
|--------------|-------|-------|
| none | 0 | px |
| sm | 2px | px |
| md | 5px | px |
| pill | 120 | px |

## Components

(none detected)

## Do's and Don'ts

Guardrails protect Dual typeface system, Soft, rounded geometry, Single-accent color discipline without adding unsupported visual claims.

| Do | Don't |
|----|---------|
| Do maintain consistent spacing using the base grid | Don't make unsupported claims about absent visual features |
| Do maintain WCAG AA contrast ratios (4.5:1 for normal text) | Don't mix rounded and sharp corners in the same view |
| Do use the primary color only for the single most important action per screen |  |
| Do verify evidence before writing new design-system guidance |  |

## Responsive Evidence

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <= 374px | screen and (max-width: 374px) |
| Mobile | <= 389px | screen and (max-width: 389px) |
| Mobile | <= 474px | screen and (max-width: 474px) |
| Mobile | <= 480px | (max-width: 480px) |
| Mobile | <= 500px | (max-width: 500px) |
| Mobile | <= 540px | screen and (max-width: 540px) |
| Mobile | <= 580px | screen and (max-width: 580px) |
| Mobile | <= 599px | (max-width: 599px) |
| Mobile | <= 749px | screen and (max-width: 749px) |
| Mobile | <= 767px | (max-width: 767px) |
| Breakpoint 11 | <= 768px | (max-width: 768px) |
| Breakpoint 12 | <= 800px | screen and (max-width: 800px) |
| Breakpoint 13 | <= 900px | screen and (max-width: 900px) |
| Breakpoint 14 | <= 920px | screen and (max-width: 920px) |
| Breakpoint 15 | <= 1012px | screen and (max-width: 1012px) |
| Breakpoint 16 | <= 1022px | screen and (max-width: 1022px) |
| Breakpoint 17 | <= 1023px | only screen and (max-width: 1023px) |
| Breakpoint 18 | <= 1024px | screen and (max-width: 1024px) |
| Breakpoint 19 | <= 1280px | screen and (max-width: 1280px) |
| Breakpoint 20 | <= 1350px | screen and (max-width: 1350px) |

## Agent Prompt Guide

### Example Component Prompts
- Create button component using validated primary color role and spacing tokens.
- Create card component with mapped radius role and evidence-backed elevation.
- Create form input component using inferred typography hierarchy and border roles.

### Iteration Guide
1. Start with extracted palette and typography roles only.
2. Map spacing and radius directly from token tables before visual polish.
3. Apply component patterns one section at a time and compare against source intent.
4. Keep elevation claims tied to explicit evidence in output.
5. Iterate with smallest diffs and re-check section hierarchy after each change.
