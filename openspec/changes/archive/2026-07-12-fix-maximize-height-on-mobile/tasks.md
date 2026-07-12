## 1. Fix ValuationStudio getPanelHeights

- [x] 1.1 Add `const MOBILE_BOTTOM_TAB_HEIGHT = 56;` near `getPanelHeights()` in `web/src/components/studios/ValuationStudio.tsx`
- [x] 1.2 Modify `getPanelHeights()`: when `isMobile` is true, compute `const available = full - MOBILE_BOTTOM_TAB_HEIGHT;` and use `available` instead of `full` for all maximized height calculations
- [x] 1.3 Verify the default mobile heights (non-maximized) remain unchanged at `{ btc: 160, val: 120 }`
- [x] 1.4 Add a comment referencing the matching CSS rule (`.chart-panel.fullscreen mobile bottom: 56px`)

## 2. Fix LttdLab getPanelHeights

- [x] 2.1 Add `const MOBILE_BOTTOM_TAB_HEIGHT = 56;` near `getPanelHeights()` in `web/src/components/studios/LttdLab.tsx`
- [x] 2.2 Modify `getPanelHeights()`: when `isMobile` is true, compute `available = full - MOBILE_BOTTOM_TAB_HEIGHT` and use it for maximize calculations (cases: `"btc"`, `"hmm"`, `"vol"`)
- [x] 2.3 Verify default mobile heights remain unchanged at `{ btc: 160, hmm: 120, vol: 120 }`

## 3. Fix MttdConsole getPanelHeights

- [x] 3.1 Add `const MOBILE_BOTTOM_TAB_HEIGHT = 56;` near `getPanelHeights()` in `web/src/components/studios/MttdConsole.tsx`
- [x] 3.2 Modify `getPanelHeights()`: when `isMobile` is true, compute `available = full - MOBILE_BOTTOM_TAB_HEIGHT` and use it for maximize calculations (cases: `"btc"`, `"imo"`, `"gates"`)
- [x] 3.3 Verify default mobile heights remain unchanged at `{ btc: 160, imo: 120, gates: 120 }`

## 4. Fix IchimokuTerminal getPanelHeights

- [x] 4.1 Add `const MOBILE_BOTTOM_TAB_HEIGHT = 56;` near `getPanelHeights()` in `web/src/components/studios/IchimokuTerminal.tsx`
- [x] 4.2 Modify `getPanelHeights()`: when `isMobile` is true, compute `available = full - MOBILE_BOTTOM_TAB_HEIGHT` and use it for maximize calculations (cases: `"btc"`, `"imo"`, `"scomp"`)
- [x] 4.3 Verify default mobile heights remain unchanged at `{ btc: 160, imo: 120, scomp: 120 }`

## 5. Verify & Commit

- [x] 5.1 Run `bun run tsc` or TypeScript compiler to verify no type errors
- [x] 5.2 Manually test maximize on mobile viewport in each studio (use browser devtools mobile mode)
- [x] 5.3 Commit with conventional commit message: `fix: account for mobile bottom tab bar in maximized chart panel heights`
