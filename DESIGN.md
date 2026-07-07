---
name: MO!D Design System
description: Editorial design system for pharma manufacturing quality reports.
colors:
  primary: "#C8421C"
  accent-hover: "#B03514"
  accent-weak: "#FDF3F0"
  neutral-bg: "#FAF8F5"
  neutral-surface: "#FFFFFF"
  neutral-border: "#EAE3DA"
  neutral-text: "#1C1917"
  neutral-text-secondary: "#2E2A27"
  neutral-text-muted: "#45403C"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter Tight, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter Tight, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "14px"
    fontWeight: 400
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
  giant: "64px"
---

# Design System: MO!D

## 1. Overview

**Creative North Star: "The Editorial Dossier"**

MO!D's visual language rejects the typical high-tech, abstract SaaS visual patterns. Instead, it frames automated quality data within a highly structured, paper-like dossier or scientific journal format. The layout is clean, grid-aligned, and prioritizes data readability above all.

This system is optimized for high-density information displays. In stead of soft floating components and backdrop-blur overlays, it relies on crisp, flat lines, solid borders, and clear typographic hierarchy. This creates a sense of authority, precision, and permanence appropriate for a regulated medical manufacturing environment (ISO 13485).

**Key Characteristics:**
- **Warm Paper Canvas**: A soft, high-readability background hue that prevents eye strain during long inspection reviews.
- **Typographic Contrast**: Fraunces Display Serif is used for section headers to evoke journalistic prestige, while Inter Tight handles precise user interface details, and JetBrains Mono displays numerical datasets.
- **Flat Outlined Containers**: Cards, lists, and tables are defined by thin outlined borders. Emojis and glassmorphism are completely banned.
- **Direct Provenance Visuals**: Verification flows are drawn as physical ink bezier lines extending from metrics to their spreadsheet origins.

---

## 2. Colors

The color palette consists of warm, paper-inspired neutral tones, deep charcoal for typography, and a burnt orange accent to call out highlights or active states.

### Primary
- **Burnt Orange** (`#C8421C` / oklch(50% 0.22 35)): Used for active states, key data highlights, focus rings, and primary action buttons. Accent hover is `#B03514`.

### Neutral
- **Warm Paper Background** (`#FAF8F5`): Default background tone for all pages.
- **Clean Surface** (`#FFFFFF`): Background for cards, input fields, and panels.
- **Crisp Border** (`#EAE3DA`): Used for standard outlines, grid lines, and dividers.
- **Strong Border** (`#D6CBBF`): Used for solid dividers and table headers.
- **Charcoal Ink** (`#1C1917`): Used for high-contrast primary text and body prose.
- **Secondary Ink** (`#2E2A27`): Used for secondary captions and secondary button labels.
- **Muted Ink** (`#45403C`): Used for labels, placeholder text, and secondary details.

### Named Rules
**The Accent Rarity Rule.** The burnt orange accent color is used on less than 10% of any given screen. Its purpose is to guide the GM's eye to deviations, actions, or selected states; overusing it dilutes its diagnostic value.

**The Contrast Floor Rule.** All text elements must maintain a minimum contrast ratio of 4.5:1 against their backgrounds (using `--text-3` / `#45403C` as the absolute lightest body text color in light mode).

---

## 3. Typography

The type system pairs a classic editorial display serif with a modern, high-legibility sans-serif and a structured monospace face.

**Display Font:** Fraunces (with Georgia, serif)
**Body Font:** Inter Tight (with system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono (with Courier New, monospace)

### Hierarchy
- **Display** (Bold, 2.5rem, 1.1): Used for main page titles and hero numerals.
- **Headline** (Semi-bold, 2rem, 1.15): Used for primary section headers.
- **Title** (Semi-bold, 1.25rem to 1.5rem, 1.3): Used for card titles and secondary group headers.
- **Body** (Regular, 15px, 1.55): Used for standard prose, tables, and form labels. Line lengths are constrained to a maximum of 75ch.
- **Label** (Semi-bold, 12px, 1.2, tracking 0.04em, uppercase): Used for eyebrows, table headers, and tiny auxiliary labels.
- **Mono** (Regular, 14px): Used for raw data cell values, timestamps, and mathematical values.

### Named Rules
**The Tabular Numbers Rule.** All tables, graphs, and numerical KPI outputs must use the monospace font with tabular numerals (`font-variant-numeric: tabular-nums`) to ensure vertical columns align perfectly.

---

## 4. Elevation

The elevation system rejects drop shadows as a method of separation. It uses flat boundaries, subtle background tints, and crisp borders to establish depth.

### Elevation Levels
- **Level 0 (Canvas)**: Warm paper background (`#FAF8F5`).
- **Level 1 (Surface)**: Cards and table blocks are rendered flat with a standard border (`1px solid #EAE3DA`) and no shadow.
- **Level 2 (Active/Hover)**: Hover states on cards translate to a subtle outlined frame and a flat background shift (`#FFFFFF` to `#FAF8F5`) rather than a shadow lift.
- **Level 3 (Overlay/Modal)**: Modal overlays use a dark semi-transparent backdrop (`rgba(28,25,23,0.4)`), and modal surfaces are outlined with a strong border.

### Named Rules
**The Flat Outline Rule.** Interfaces must stay flat. Do not use complex shadows or blurred card offsets. Depth is conveyed using hierarchical background tints (`--surface`, `--surface-2`, `--surface-3`) and outlined borders.

---

## 5. Components

Components are styled to look like physical elements of a ledger or folder.

### Buttons
- **Shape**: Outlined corners with a standard border radius (`8px` / `--radius-sm`).
- **Primary**: Solid burnt orange (`#C8421C`) background, white text. Transitions to hover color (`#B03514`) over 150ms.
- **Secondary/Ghost**: Flat transparent background, outlined in `--border-strong`. Text uses `--text-2`. Hover shifts background to `--surface-2`.

### Cards / Containers
- **Corner Style**: Outlined corners (`12px` / `--radius-md`).
- **Background**: Solid surface (`#FFFFFF`).
- **Border**: Thin border (`1px solid #EAE3DA`).
- **Internal Padding**: Structured padding (`24px` / `--space-5`).

### Inputs / Fields
- **Style**: Solid white background, outlined in `--border`, with a standard corner radius (`8px` / `--radius-sm`).
- **Focus**: Displays a sharp outline ring of burnt orange (`2px solid #C8421C`) with an offset of 2px.

---

## 6. Do's and Don'ts

### Do:
- **Do** align all numeric data columns to the right and use JetBrains Mono.
- **Do** wrap all text content in containers with a max-width of 75ch to preserve readability.
- **Do** use standard SVG icons with a stroke width of 1.6 and height/width of 16px or 24px.
- **Do** verify contrast ratios for helper text and placeholders.

### Don't:
- **Don't** use emojis as visual markers. Always use SVG stroke line icons.
- **Don't** use colored left-border stripes as highlights on warning banner blocks.
- **Don't** use background gradients or text-clip gradients.
- **Don't** use backdrop-blur filters or semi-transparent glass cards.
