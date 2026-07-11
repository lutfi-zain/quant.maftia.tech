## Why

The current dashboard UI suffers from excessive glassmorphism, oversized paddings, and large rounded corners that waste screen real estate on a data-dense quantitative terminal. Users working with 4 simultaneous subsystems (Valuation, LTTD, MTTD, Ichimoku) need maximized data density, not decorative spacing. The visual design feels consumer-grade rather than institutional-grade. This change brings the terminal closer to Bloomberg/Refinitiv information density while maintaining legibility and modern aesthetics.

## What Changes

- **Reduce border-radius globally**: Cards from `12px` → `4px`, badges from `20px` → `4px`, buttons from `8px` → `4px`. Sharp, professional edges.
- **Tighten spacing system**: Replace generous `20–24px` paddings with compact `10–14px`. Gap between cards from `20px` → `10px`.
- **Remove glassmorphism effects**: Drop `backdrop-filter: blur()` and translucent backgrounds. Use solid opaque surfaces (`--bg-card`, `--bg-elevated`) for faster rendering and cleaner visual hierarchy.
- **Remove hover lift transforms**: Cards should not physically move on hover — only subtle border/background color shifts.
- **Compact header**: Reduce desktop page header padding and subtitle line height. Tighter vertical rhythm.
- **Compact sidebar**: Reduce sidebar brand header and nav item padding. Tighter nav gap from `4px` → `2px`.
- **Compact Bento cards**: Reduce internal card padding, tighten metric value font sizes from `32px` → `26px`, tighten section divider margins.
- **Dense chart subplot headers**: Reduce header padding from `8px 14px` → `6px 10px`, reduce font size.
- **Scrollbar refinement**: Thinner scrollbar (4px), subtler colors.
- **Kill decorative animations**: Remove `pulseGlow` scale animation. Keep only functional `spin` for loading.

## Non-goals

- **No color palette change** — Bloomberg Slate Amber palette remains unchanged.
- **No typography family change** — Inter + JetBrains Mono stays.
- **No functional behavior change** — All chart interactions, crosshair sync, fullscreen, gate badges, circuit breakers remain identical.
- **No mobile layout restructuring** — Mobile responsive breakpoints and bottom sheet logic stay as-is (mobile already has tight spacing).
- **No backend/API/pipeline changes** — Pure CSS + JSX style-prop adjustments.
- **`quant-technical-indicator-bank` remains deprecated** — Not referenced or re-introduced.

## Systems Impact

All 4 unified systems are visually impacted through their respective studio components, but **zero** quantitative logic, mathematical transformations, or causal filtering is modified. This is a presentation-layer-only change.

## Capabilities

### New Capabilities

- `minimalist-terminal-design-system`: Global design token overhaul — border-radius scale, spacing scale, surface opacity rules, hover state rules, and animation policy for the entire terminal.

### Modified Capabilities

- `bloomberg-slate-palette`: Border-radius and spacing tokens are extended to enforce the new minimalist density constraints.
- `chart-panel-layout`: Chart subplot header density and panel border-radius reduced to match the minimalist system.
- `executive-terminal-and-sandboxes`: Dashboard Bento card sizing, header layout, and sidebar nav density tightened.

## Impact

- **CSS**: `web/src/index.css` — Major token and class overhaul (`.glass-card`, `.chart-panel`, `.chart-subplot-header`, `.toggle-group`, `.toggle-btn`, `.icon-btn`, `.gate-badge`, `.sync-badge`, `.sync-btn`, scrollbar, animations).
- **Layout Components**: `AppLayout.tsx`, `Sidebar.tsx` — inline style padding/gap reductions.
- **Dashboard**: `BentoSummary.tsx` — card padding, font-size, and margin tightening.
- **Studio Components**: `ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx` — any inline padding/gap overrides that conflict with the new global tokens.
- **No API/Backend/Pipeline files touched**.
