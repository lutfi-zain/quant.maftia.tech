## MODIFIED Requirements

### Requirement: Composite chart shows 5 reference lines on valuation area panel
The composite valuation area panel in `ValuationStudio.tsx` SHALL display 5 horizontal reference lines at the following levels with the canonical sign and color mapping (`positive = undervalued / accumulation`, `negative = overvalued / bubble`):

| Level | Color | Dash | Label |
|-------|-------|------|-------|
| +2.0  | `#22C55E` / `rgba(34,197,94,0.8)` | dashed | Extreme Undervalued +2.00 |
| +1.0  | `#4ADE80` / `rgba(74,222,128,0.8)` | dashed | Discount / Accumulation +1.00 |
| 0.0   | `#64748B` / `rgba(100,116,139,0.8)` | solid | Neutral 0.00 |
| -1.5  | `#F87171` / `rgba(248,113,113,0.8)` | dashed | Bubble Risk -1.50 |
| -2.0  | `#EF4444` / `rgba(239,68,68,0.8)` | dashed | Extreme Overvalued -2.00 |

#### Scenario: All 5 lines visible on composite chart load
- **WHEN** the composite chart loads in Valuation Studio
- **THEN** all 5 reference lines are visible on the valuation area panel
- **AND** positive thresholds (+2.0, +1.0) use green/bullish palette with undervalued labels
- **AND** negative thresholds (-1.5, -2.0) use red/bearish palette with overvalued/bubble labels

#### Scenario: Reference lines do not interfere with candlestick BTC panel
- **WHEN** reference lines are drawn on the valuation panel
- **THEN** the BTC candlestick panel above shows no reference lines from the valuation panel
