## 1. ValuationStudio — remove subplot meta and axis lock

- [x] 1.1 In BTC subplot header, remove `<span className="subplot-meta">BTC / USD · DAILY</span>` and `<span className="subplot-axis-lock">85px</span>`
- [x] 1.2 In VAL subplot header, remove `<span className="subplot-meta">RANGE [-2.00, +2.00]</span>` and `<span className="subplot-axis-lock">85px</span>`

## 2. LttdLab — remove subplot meta and axis lock

- [x] 2.1 In BTC subplot header, remove "REGIME-COLORED CANDLES" meta and "85px" axis lock
- [x] 2.2 In HMM subplot header, remove "P(BULL) / P(BEAR) / P(SIDEWAYS)" meta and "85px" axis lock
- [x] 2.3 In VOL subplot header, remove "LOG RETURN BASIS" meta and "85px" axis lock

## 3. MttdConsole — remove subplot meta and axis lock

- [x] 3.1 In BTC subplot header, remove "MULTI-PRINCIPLE TRACKING" meta and "85px" axis lock
- [x] 3.2 In IMO subplot header, remove "RANGE [-1.00, +1.00]" meta and "85px" axis lock
- [x] 3.3 In GATES subplot header, remove "ER ≥ 0.20 · H ≤ 2.30" meta and "85px" axis lock

## 4. IchimokuTerminal — remove subplot meta and axis lock

- [x] 4.1 In BTC subplot header, remove "SUPERSMOOTHER FILTERED CLOUD" meta and "85px" axis lock
- [x] 4.2 In IMO subplot header, remove "BOUNDED TANH [-1.00, +1.00]" meta and "85px" axis lock
- [x] 4.3 In SCOMP subplot header, remove "ZERO-LAG IIR" meta and "85px" axis lock

## 5. Simplify mobile header CSS

- [x] 5.1 In `web/src/index.css` mobile section, change `.chart-subplot-header` from 2-row column layout back to single-row row layout (`flex-direction: row`, `height: 30px`, `min-height: unset`)
- [x] 5.2 Remove `.subplot-controls` border-top style in mobile section (no longer needs visual separator with only one item)

## 6. Verify & Commit

- [x] 6.1 Run `bun run tsc --noEmit` to verify no type errors
- [x] 6.2 Commit with conventional commit message: `clean: remove redundant subtitle and axis lock badge from subplot headers`
