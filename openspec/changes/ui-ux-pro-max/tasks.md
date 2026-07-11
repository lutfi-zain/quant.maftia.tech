## 1. CSS Design Tokens & Global Reset

- [ ] 1.1 Add spatial density tokens to `:root` in `index.css` (`--radius-none`, `--radius-sm`, `--radius-md`, `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`)
- [ ] 1.2 Redefine `--surface-glass` from `rgba(15, 23, 42, 0.8)` to solid `#0f172a`
- [ ] 1.3 Update `.glass-card`: remove `backdrop-filter`, set solid `background: var(--bg-card)`, set `border-radius: 4px`, reduce `box-shadow` intensity, remove hover `transform: translateY(-2px)`, replace with border-color-only hover
- [ ] 1.4 Update `.chart-panel`: remove `backdrop-filter`, set solid `background: var(--bg-card)`, set `border-radius: 4px`, reduce `box-shadow`
- [ ] 1.5 Update `.chart-subplot-header`: reduce padding to `6px 10px`
- [ ] 1.6 Update `.toggle-group`: set `border-radius: 2px`
- [ ] 1.7 Update `.toggle-btn`: set `border-radius: 0` (inside toggle group)
- [ ] 1.8 Update `.icon-btn`: set `border-radius: 2px`
- [ ] 1.9 Update `.gate-badge`: set `border-radius: 4px` (from `20px`)
- [ ] 1.10 Update `.sync-badge`: set `border-radius: 4px` (from `8px`)
- [ ] 1.11 Update `.sync-btn`: set `border-radius: 4px` (from `8px`)
- [ ] 1.12 Reduce scrollbar width from `6px` to `4px`, update thumb color
- [ ] 1.13 Remove `@keyframes pulseGlow` and `.animate-pulse-glow` class
- [ ] 1.14 Update mobile `@media` overrides: adjust `.glass-card` border-radius from `10px` to `4px`, `.chart-panel` border-radius from `10px` to `4px`

## 2. Layout Components

- [ ] 2.1 `AppLayout.tsx`: Reduce desktop main padding from `24px 32px` to `16px 24px`, reduce gap from `24px` to `16px`, reduce header `paddingBottom` from `16px` to `8px`
- [ ] 2.2 `Sidebar.tsx`: Reduce brand header padding from `20px` to `14px`, reduce nav item padding from `10px 12px` to `7px 10px`, reduce nav gap from `4px` to `2px`, reduce brand logo from `36px` to `30px`, reduce brand logo `border-radius` from `8px` to `4px`

## 3. Dashboard Bento Cards

- [ ] 3.1 `BentoSummary.tsx`: Reduce grid gap from `20px` to `10px`, reduce card padding from `20px` to `12px`, reduce primary metric font-size from `32px` to `26px` (LTTD from `28px` to `24px`), tighten bottom section margin/padding from `16px/12px` to `10px/8px`

## 4. Studio Inline Style Audit

- [ ] 4.1 `ValuationStudio.tsx`: Audit and reduce any inline `padding`, `gap`, `borderRadius` values to match new compact tokens
- [ ] 4.2 `LttdLab.tsx`: Same audit — reduce inline spacing overrides
- [ ] 4.3 `MttdConsole.tsx`: Same audit — reduce inline spacing overrides
- [ ] 4.4 `IchimokuTerminal.tsx`: Same audit — reduce inline spacing overrides

## 5. Verification

- [ ] 5.1 Visual check: all cards render with `4px` radius, no glassmorphism blur, no hover lift
- [ ] 5.2 Chart verification: 85px Y-axis lock and crosshair sync still functional across all studios
- [ ] 5.3 Mobile verification: layout still works correctly at `<768px` with bottom tab bar
- [ ] 5.4 Run `python3 run_report_pipeline.py` to confirm backend pipeline unaffected
