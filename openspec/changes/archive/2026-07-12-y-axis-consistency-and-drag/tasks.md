## 1. Enable vertical drag interaction

- [x] 1.1 In `ValuationStudio.tsx`, change `handleScroll: { vertTouchDrag: false }` to `handleScroll: { vertTouchDrag: true }` in `makeCommonOptions()`
- [x] 1.2 In `LttdLab.tsx`, change `handleScroll: { vertTouchDrag: false }` to `handleScroll: { vertTouchDrag: true }` in `makeCommonOptions()`
- [x] 1.3 In `MttdConsole.tsx`, change `handleScroll: { vertTouchDrag: false }` to `handleScroll: { vertTouchDrag: true }` in `makeCommonOptions()`
- [x] 1.4 In `IchimokuTerminal.tsx`, change `handleScroll: { vertTouchDrag: false }` to `handleScroll: { vertTouchDrag: true }` in `makeCommonOptions()`

## 2. Re-apply Y-axis minimumWidth in maximize resize effect

- [x] 2.1 In `ValuationStudio.tsx`, add `btc.priceScale("right").applyOptions({ minimumWidth: yWidth })` and `val.priceScale("right").applyOptions({ minimumWidth: yWidth })` in the maximize resize effect (alongside the existing `.resize()` call)
- [x] 2.2 In `LttdLab.tsx`, add minimumWidth re-application for all subplots in the maximize resize effect
- [x] 2.3 In `MttdConsole.tsx`, add minimumWidth re-application for all subplots in the maximize resize effect
- [x] 2.4 In `IchimokuTerminal.tsx`, add minimumWidth re-application for all subplots in the maximize resize effect

## 3. Verify & Commit

- [x] 3.1 Run `bun run tsc --noEmit` to verify no type errors
- [x] 3.2 Commit with conventional commit message: `feat: enable Y-axis drag and lock consistent Y-axis width across subplots`
