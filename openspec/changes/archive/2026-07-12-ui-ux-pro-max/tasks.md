## 1. CSS Design Tokens & Global Reset

- [x] 1.1 Add spatial density tokens to `:root` in `index.css` (`--radius-none`, `--radius-sm`, `--radius-md`, `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`)
- [x] 1.2 Redefine `--surface-glass` from `rgba(15, 23, 42, 0.8)` to solid `#0f172a`
- [x] 1.3 Update `.glass-card`: remove `backdrop-filter`, set solid `background: var(--bg-card)`, set `border-radius: 4px`, reduce `box-shadow` intensity, remove hover `transform: translateY(-2px)`, replace with border-color-only hover
- [x] 1.4 Update `.chart-panel`: remove `backdrop-filter`, set solid `background: var(--bg-card)`, set `border-radius: 4px`, reduce `box-shadow`
- [x] 1.5 Update `.chart-subplot-header`: reduce padding to `6px 10px`
- [x] 1.6 Update `.toggle-group`: set `border-radius: 2px`
- [x] 1.7 Update `.toggle-btn`: set `border-radius: 0` (inside toggle group)
- [x] 1.8 Update `.icon-btn`: set `border-radius: 2px`
- [x] 1.9 Update `.gate-badge`: set `border-radius: 4px` (from `20px`)
- [x] 1.10 Update `.sync-badge`: set `border-radius: 4px` (from `8px`)
- [x] 1.11 Update `.sync-btn`: set `border-radius: 4px` (from `8px`)
- [x] 1.12 Reduce scrollbar width from `6px` to `4px`, update thumb color
- [x] 1.13 Remove `@keyframes pulseGlow` and `.animate-pulse-glow` class
- [x] 1.14 Update mobile `@media` overrides: adjust `.glass-card` border-radius from `10px` to `4px`, `.chart-panel` border-radius from `10px` to `4px`

## 2. Layout Components

- [x] 2.1 `AppLayout.tsx`: Reduce desktop main padding from `24px 32px` to `16px 24px`, reduce gap from `24px` to `16px`, reduce header `paddingBottom` from `16px` to `8px`
- [x] 2.2 `Sidebar.tsx`: Reduce brand header padding from `20px` to `14px`, reduce nav item padding from `10px 12px` to `7px 10px`, reduce nav gap from `4px` to `2px`, reduce brand logo from `36px` to `30px`, reduce brand logo `border-radius` from `8px` to `4px`

## 3. Dashboard Bento Cards

- [x] 3.1 `BentoSummary.tsx`: Reduce grid gap from `20px` to `10px`, reduce card padding from `20px` to `12px`, reduce primary metric font-size from `32px` to `26px` (LTTD from `28px` to `24px`), tighten bottom section margin/padding from `16px/12px` to `10px/8px`

## 4. ValuationStudio.tsx

- [x] 4.1 Outer container: reduce `gap: "24px"` → `"16px"` (L~493 wrapper div)
- [x] 4.2 Header glass-card: reduce `padding: "20px 24px"` → `"12px 16px"`
- [x] 4.3 Circuit breaker status card: reduce `padding: "20px"` → `"12px"` (L~559 `.glass-card`)
- [x] 4.4 Threshold editor pill: reduce `borderRadius: "6px"` → `"4px"` (L649)
- [x] 4.5 Indicator list row: reduce `borderRadius: "4px"` already OK, reduce padding if any
- [x] 4.6 Direction badge: reduce `borderRadius: "10px"` → `"4px"` (L960)
- [x] 4.7 Threshold editor modal: reduce `borderRadius: "12px"` → `"4px"` (L1115)
- [x] 4.8 Component table `.glass-card`: reduce `padding: "20px"` → `"12px"` (L831)

## 5. LttdLab.tsx

- [x] 5.1 Outer container: reduce `gap: "24px"` → `"16px"` (L449)
- [x] 5.2 Header glass-card: reduce `padding: "20px 24px"` → `"12px 16px"` (L455)
- [x] 5.3 Regime stat metric cards: reduce `gap: "24px"` → `"16px"` (L494)
- [x] 5.4 Stat glass-cards (3×): reduce `padding: "16px"` → `"12px"` (L582, L613, L644)
- [x] 5.5 Regime status card: reduce `padding: "10px 16px"` → `"8px 12px"` (L517)
- [x] 5.6 Direction badge: reduce `borderRadius: "10px"` → `"4px"` (L904)
- [x] 5.7 Component table `.glass-card`: reduce `padding: "20px"` → `"12px"` (L835)
- [x] 5.8 Data table `th` cells: reduce `padding: "12px 8px"` → `"8px 6px"` (L949-L955)
- [x] 5.9 Data table `td` cells: reduce `padding: "14px 8px"` → `"10px 6px"` (L971-L1013)

## 6. MttdConsole.tsx

- [x] 6.1 Outer container: reduce `gap: "24px"` → `"16px"` (L470)
- [x] 6.2 Header glass-card: reduce `padding: "20px 24px"` → `"12px 16px"` (L476)
- [x] 6.3 Three gate status cards: reduce `borderRadius: "8px"` → `"4px"` (L625, L684, L743)
- [x] 6.4 Gate status cards stat metric: reduce `gap: "24px"` → `"16px"` (L~515)
- [x] 6.5 Gate family badge: reduce `borderRadius: "6px"` → `"4px"` (L956)
- [x] 6.6 Direction badge: reduce `borderRadius: "10px"` → `"4px"` (L991)
- [x] 6.7 Component table `.glass-card`: reduce `padding: "20px"` → `"12px"` (L922)
- [x] 6.8 Data table `th` cells: reduce `padding: "12px 8px"` → `"8px 6px"`
- [x] 6.9 Data table `td` cells: reduce `padding: "14px 8px"` → `"10px 6px"`

## 7. IchimokuTerminal.tsx

- [x] 7.1 Outer container: reduce `gap: "24px"` → `"16px"` (L615)
- [x] 7.2 Header glass-card: reduce `padding: "20px 24px"` → `"12px 16px"` (L621)
- [x] 7.3 Ichimoku state metric cards: reduce `gap: "24px"` → `"16px"` (L660)
- [x] 7.4 State card: reduce `padding: "10px 16px"` → `"8px 12px"` (L680)
- [x] 7.5 Direction badge: reduce `borderRadius: "10px"` → `"4px"` (L925)
- [x] 7.6 Component table `.glass-card`: reduce `padding: "20px"` → `"12px"` (L893)
- [x] 7.7 Data table `th` cells: reduce `padding: "12px 8px"` → `"8px 6px"` (L951-L958)
- [x] 7.8 Data table `td` cells: reduce `padding: "14px 8px"` → `"10px 6px"` (L974-L1026)

## 8. MetricDetailChart.tsx

- [x] 8.1 Header glass-card: reduce `padding: "16px 20px"` → `"12px 16px"` (L986)
- [x] 8.2 Header stat row: reduce `gap: "16px"` → `"10px"` (L992)
- [x] 8.3 Chart controls row: reduce `gap: "12px"` → `"8px"` (L1017)
- [x] 8.4 Outer wrapper: reduce `gap: "20px"` → `"12px"` (L981, L1084)
- [x] 8.5 Stat detail panel: reduce `padding: "20px"` → `"12px"`, `gap: "16px"` → `"10px"` (L1200, L1203)
- [x] 8.6 Button pills: reduce `borderRadius: "6px"` → `"4px"` (L1037, L1068)

## 9. Verification

- [x] 9.1 Visual check: all cards render with `4px` radius, no glassmorphism blur, no hover lift
- [x] 9.2 Chart verification: 85px Y-axis lock and crosshair sync still functional across all studios
- [x] 9.3 Mobile verification: layout still works correctly at `<768px` with bottom tab bar
- [x] 9.4 Run `python3 run_report_pipeline.py` to confirm backend pipeline unaffected
