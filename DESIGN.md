---
name: MO!D Design System
description: Precision Slate design system for manufacturing quality analytics.
colors:
  primary: "#2563EB"
  accent-hover: "#1D4ED8"
  accent-weak: "#EFF6FF"
  neutral-bg: "#F8FAFC"
  neutral-surface: "#FFFFFF"
  neutral-border: "#E2E8F0"
  neutral-text: "#0F172A"
  neutral-text-secondary: "#475569"
  neutral-text-muted: "#94A3B8"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
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

# Design System: MO!D — Precision Slate

## 1. Overview

**Creative North Star: "Precision Instrument"**

MO!D's visual language draws from the best modern analytics SaaS tools — Linear, Vercel Dashboard, Grafana. The interface is cool-toned, tightly gridded, and built around data legibility. Every element exists to make quality data faster to read and act on.

This system is optimized for high-density information in a regulated manufacturing environment. Cards have subtle shadows, borders are cool gray, and the single electric-blue accent drives the eye to actions and active states.

**Key Characteristics:**
- **Cool Gray Canvas**: `#F8FAFC` — a slightly cool, near-white background. Not warm. Reduces visual warmth to reinforce precision.
- **Single Font Family**: Inter throughout — display titles, body, labels, all Inter. JetBrains Mono exclusively for numerical data.
- **Electric Blue Accent**: `#2563EB` — clean, modern, trusted. Used for focus rings, active nav states, primary buttons, and key data highlights.
- **Micro-Shadow Elevation**: Cards have a real but very subtle shadow (`shadow-2`). This creates depth without breaking the flat aesthetic.
- **No Serif**: Fraunces has been removed. All headings are Inter 700-800.

---

## 2. Colors

### Primary Accent
- **Electric Blue** (`#2563EB` / blue-600): Used for active states, primary buttons, focus rings, active nav items. Hover is `#1D4ED8`.

### Neutral Palette
- **Cool Gray Page** (`#F8FAFC`): Default background — slightly cool, not warm paper.
- **Clean Surface** (`#FFFFFF`): Cards, panels, input fields.
- **Subtle Hover** (`#F1F5F9`): Hover rows, zebra stripes, nested tables.
- **Deep Well** (`#E2E8F0`): Chip backgrounds, code areas.
- **Standard Border** (`#E2E8F0`): All card and panel outlines.
- **Strong Border** (`#CBD5E1`): Table headers, section dividers.
- **Primary Text** (`#0F172A`): Near-black, slate-900.
- **Secondary Text** (`#475569`): Slate-600, labels, secondary info.
- **Muted Text** (`#94A3B8`): Slate-400, placeholder, eyebrows.

### Semantic Status Colors
- **Positive**: `#059669` (emerald-600)
- **Warning**: `#D97706` (amber-600)
- **Critical**: `#DC2626` (red-600)

### Named Rules
**The Accent Rarity Rule.** Electric blue is used on less than 15% of any screen. Its purpose is to guide the user's eye to the active item, primary action, or focused input.

**The Contrast Floor Rule.** All text must maintain ≥ 4.5:1 contrast. `--text-3 / #94A3B8` is the absolute minimum for muted labels.

---

## 3. Typography

**Single family:** Inter (system-ui fallback)
**Data/numbers:** JetBrains Mono only

### Scale
- **Display** (700, 2rem, -0.03em): Hero KPI numbers, page-level emphasis
- **H1** (700, 1.5rem, -0.025em): Page titles
- **H2** (600, 1.25rem, -0.02em): Section headers, card group headers
- **H3** (600, 1.0625rem, -0.015em): Card titles
- **Body** (400, 14px): Standard prose, table cells, form labels
- **Small** (400, 13px): Secondary metadata, footnotes
- **Label** (600, 11px, 0.05em, uppercase): Eyebrows, table column headers, section labels
- **Mono** (400, 13px, tabular-nums): All numeric values, timestamps, IDs

### Named Rules
**The Tabular Numbers Rule.** All numeric columns, KPI values, timestamps, and IDs use JetBrains Mono with `font-variant-numeric: tabular-nums`. This ensures vertical alignment in dense tables.

---

## 4. Elevation

Cards use visible but subtle micro-shadows to create real depth hierarchy.

### Elevation Levels
- **Level 0 (Canvas)**: `#F8FAFC` cool gray-white.
- **Level 1 (Surface)**: Cards — `1px solid #E2E8F0` border + `shadow-2` (4px/8px spread).
- **Level 2 (Hover)**: `background: #F1F5F9` + border: `#CBD5E1`. No shadow lift — background shift only.
- **Level 3 (Overlay)**: `rgba(15,23,42,0.45)` backdrop, panel border `#CBD5E1`, `shadow-3`.

### Named Rules
**The Micro-Shadow Rule.** Cards use `shadow-2` — subtle and professional, not floating or heavy. Modals use `shadow-3`. No element uses more depth than needed.

---

## 5. Components

### Buttons
- **Primary**: `#2563EB` solid bg, white text, hover `#1D4ED8`, 6px radius.
- **Ghost**: Transparent bg, `--border-strong` outline, hover bg `--surface-2`.
- **Radius**: `--radius-sm` (6px) for buttons, `--radius-md` (8px) for inputs.

### Cards / Containers
- **Radius**: `12px` (`--radius-lg`)
- **Background**: `#FFFFFF`
- **Border**: `1px solid #E2E8F0`
- **Shadow**: `shadow-2` — subtle but perceptible
- **Padding**: `24px` (`--pad-card`)

### Inputs / Fields
- **Style**: White bg, `--border` outline, `6px` radius.
- **Focus**: `2px solid #3B82F6` ring with `2px offset`.

---

## 6. Do's and Don'ts

### Do:
- **Do** use Inter for all non-numeric content at all levels of the hierarchy.
- **Do** use JetBrains Mono + `tabular-nums` for all numeric data, KPIs, timestamps.
- **Do** use the `shadow-2` on all cards for subtle depth.
- **Do** keep electric blue to active states, primary buttons, and focus indicators only.
- **Do** use cool gray borders (`#E2E8F0`).

### Don't:
- **Don't** use Fraunces or any serif font — it has been removed from this design system.
- **Don't** use warm colors (`#FAF8F5`, `#EAE3DA`, `#C8421C`) — these belong to the old editorial system.
- **Don't** use glassmorphism, backdrop-blur, or text-clip gradients.
- **Don't** use emojis as visual markers.
- **Don't** use colored left-border stripes on banner blocks — use full background tints instead.
