## Context

The MAFTIA QUANT terminal is a 4-system quantitative Bitcoin intelligence dashboard built with React 19 + Vite + Lightweight Charts v5.2. The current UI uses generous glassmorphism (backdrop-filter blur, translucent surfaces), large `12px` border-radius, `20–24px` paddings, and hover-lift transforms — a consumer-app aesthetic that wastes screen real estate on a data-dense financial terminal.

The target users are quantitative analysts who need maximum information density with a Bloomberg/Refinitiv-grade visual language: sharp edges, tight spacing, opaque surfaces, and zero decorative motion.

**Current state:**
- `index.css`: 735 lines defining glassmorphic cards, chart panels, mobile responsive system
- `Sidebar.tsx`: 260px fixed sidebar with 20px brand header padding, 10px nav item padding
- `AppLayout.tsx`: 24px 32px main content padding, 16px header padding-bottom
- `BentoSummary.tsx`: 20px card padding, 32px metric values, 20px grid gap
- Studio files (4×): Use inline styles with generous spacing

**Constraints:**
- All charts must maintain `85px` right Y-axis width lock and crosshair sync (per AGENTS.md)
- DOM persistence rules: never unmount chart containers, use CSS visibility instead
- Mobile responsive system (`<768px`) already has compact spacing — minimal changes needed there
- API Gateway remains on `:8765`, no backend changes

## Goals / Non-Goals

**Goals:**
- Achieve information-dense terminal aesthetic with minimal wasted whitespace
- Reduce all border-radius to `2–4px` maximum for sharp professional edges
- Replace glassmorphism (backdrop-filter + translucent BGs) with solid opaque surfaces
- Tighten all spacing (padding, gap, margin) by ~40% while maintaining legibility
- Remove decorative hover transforms and pulse animations
- Maintain accessibility contrast ratios (4.5:1 minimum for text)

**Non-Goals:**
- No color palette modifications (Bloomberg Slate Amber stays)
- No font family changes (Inter + JetBrains Mono stays)
- No functional behavior changes (charts, gates, crosshair sync, fullscreen)
- No mobile-specific restructuring (already compact)
- No backend/API/pipeline changes
- No new component creation — this is a style token + inline style adjustment

## Decisions

### Decision 1: Solid Surfaces over Glassmorphism

**Choice:** Replace all `backdrop-filter: blur()` + semi-transparent backgrounds with solid `var(--bg-card)` / `var(--bg-elevated)` surfaces.

**Rationale:** Glassmorphism is computationally expensive (GPU compositing) and visually noisy on data-dense layouts. Solid surfaces create cleaner visual hierarchy and faster rendering. The blur effect provides minimal information — the "through" visual is rarely meaningful in a dashboard.

**Alternatives considered:**
- Reduce blur intensity to `4px` → Still incurs GPU cost, minimal visual difference
- Keep glass only on elevated modals → Inconsistent, chose full solid instead

### Decision 2: Border-Radius Scale `0px / 2px / 4px`

**Choice:** Three-tier radius: `0px` (charts, tables), `2px` (buttons, badges, inputs), `4px` (cards, panels).

**Rationale:** Bloomberg Terminal uses near-zero radius. `4px` for cards provides just enough softness to feel modern while staying sharp. Rounded corners waste pixel space proportional to radius.

### Decision 3: Spacing Scale Reduction

**Choice:** New 8px-grid compact tokens:
- Card padding: `20px` → `12px`
- Grid gap: `20px` → `10px`
- Header padding: `16px` → `8px`
- Nav item padding: `10px 12px` → `7px 10px`
- Nav gap: `4px` → `2px`

**Rationale:** Dense-mode scaling (~60% of original) matches Bloomberg/Refinitiv density. 8px grid preserved for alignment.

### Decision 4: Hover State Policy

**Choice:** Remove all `transform: translateY()` hover effects. Replace with border-color brightening only (`rgba(255,255,255,0.12)` → `rgba(255,255,255,0.18)`).

**Rationale:** Hover lifts cause layout jitter in chart panels (resize loop issue documented in AGENTS.md). For non-chart cards, they add decorative noise without functional value. A subtle border shift communicates interactivity without spatial disruption.

### Decision 5: Animation Policy

**Choice:** Remove `pulseGlow` animation. Keep only `spin` (loading indicator) and `fadeIn` (mobile drawer transition).

**Rationale:** Pulsing scale transforms on data cards distract from reading quantitative values. Financial terminals never animate data containers — only status indicators (loading spinners) use motion.

## Risks / Trade-offs

- **[Visual Contrast Risk]** Removing glassmorphism blur may reduce perceived depth between overlapping layers → **Mitigation**: Ensure card `background` is visibly distinct from `--bg-root` using solid colors with 1px border.
- **[Readability Risk]** Tighter spacing may feel cramped on small desktop monitors (1366×768) → **Mitigation**: Keep minimum card padding at `12px` (not lower), keep font sizes unchanged.
- **[Regression Risk]** Inline styles in 4 studio files may override global CSS tokens → **Mitigation**: Audit all inline `padding`, `gap`, `borderRadius` values in studio TSX files and align with new globals.
- **[Mobile Parity]** Mobile already has compact spacing via `@media` overrides — the new desktop tokens may conflict → **Mitigation**: Review mobile `!important` overrides to ensure they don't double-reduce spacing.
