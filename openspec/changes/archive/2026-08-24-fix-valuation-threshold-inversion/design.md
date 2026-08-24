## Context

See `proposal.md` for motivation and background.

Currently, the core quantitative models (`quant-btc-valuation-system/quant/components/normalization.py`, `quant-btc-lttd-system/src/execution/sizing.py`, `web/src/lib/sdcaEngine.ts`, and `web/src/components/studios/MetricDetailChart.tsx`) correctly map:
- `+2.00` to Extreme Undervaluation (Generational Accumulation)
- `+1.00` to Undervaluation / Discount Zone
- `0.00` to Neutral / Fair Value
- `-1.00` to `-1.50` to Warning Overvalued / Bubble Risk
- `-2.00` to Extreme Overvaluation / Cycle Peak

However, `ValuationStudio.tsx`, `MultiPaneChart.tsx`, and `ConfigurationPanel.tsx` contain inverted price lines, labels, and helper descriptions. This design details the exact code locations and changes needed to establish 100% uniformity.

## Goals / Non-Goals

**Goals:**
- Update `valSeries.createPriceLine` definitions in `ValuationStudio.tsx` and `MultiPaneChart.tsx` to match the canonical convention with proper colors (`#22C55E`, `#4ADE80`, `#64748B`, `#F87171`, `#EF4444`).
- Update the subplot label in `MultiPaneChart.tsx` to `"Valuation Composite [-2.0 → +2.0] · Discount +1.00 / Bubble -1.50"`.
- Correct the score descriptions in `ConfigurationPanel.tsx` for `t_minus_2`, `t_minus_1`, `t_plus_1`, and `t_plus_2`.
- Update architectural documentation (`AGENTS.md`, `UNIFIED_SYSTEM_ARCHITECTURE.md`, `docs/architecture/*.md`) to correct inverted text referring to bubble risk and deep discount thresholds.
- Maintain existing Lightweight Charts v5.2 layout invariants (85px Y-axis width synchronization and crosshair synchronization).

**Non-Goals:**
- No mathematical changes to normalization engines or indicator formula logic.
- No modifications to database schemas (`unified_daily_analytics`, `master_ohlcv`, or `metrics.db`).
- No modifications to LTTD, MTTD, or Ichimoku core execution algorithms.

## Decisions

### Decision 1: Canonical Reference Line Palette and Labels in `ValuationStudio.tsx`
In `web/src/components/studios/ValuationStudio.tsx`, replace lines 651–690 with:
```typescript
valSeries.createPriceLine({
    price: 2.0,
    color: "#22C55E",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: "Extreme Undervalued +2.00",
});
valSeries.createPriceLine({
    price: 1.0,
    color: "#4ADE80",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: "Discount / Accumulation +1.00",
});
valSeries.createPriceLine({
    price: 0,
    color: "#64748B",
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
    title: "Neutral 0.00",
});
valSeries.createPriceLine({
    price: -1.5,
    color: "#F87171",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: "Bubble Risk -1.50",
});
valSeries.createPriceLine({
    price: -2.0,
    color: "#EF4444",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: "Extreme Overvalued -2.00",
});
```

### Decision 2: Update `MultiPaneChart.tsx` Reference Lines & Label
In `web/src/components/charts/MultiPaneChart.tsx`:
1. Update price lines:
```typescript
valSeries.createPriceLine({
    price: 1.0,
    color: "#22C55E",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: "Discount +1.00",
});
valSeries.createPriceLine({
    price: -1.5,
    color: "#EF4444",
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: "Bubble -1.50",
});
```
2. Update header pane label:
```typescript
label: "Valuation Composite [-2.0 → +2.0] · Discount +1.00 / Bubble -1.50"
```

### Decision 3: Correct Display Descriptions in `ConfigurationPanel.tsx`
In `web/src/components/studios/ConfigurationPanel.tsx`:
```typescript
if (field === "t_minus_2") { desc = "Deep Bubble/Overvaluation Floor"; score = "Score = -2.0"; }
else if (field === "t_minus_1") { desc = "Warning Bubble/Overvaluation Border"; score = "Score = -1.0"; }
else if (field === "t_zero") { desc = "Neutral Target Value"; score = "Score = 0.0"; }
else if (field === "t_plus_1") { desc = "Undervaluation Floor"; score = "Score = +1.0"; }
else if (field === "t_plus_2") { desc = "Deep Undervaluation / Floor Floor"; score = "Score = +2.0"; }
```

### Decision 4: Synchronize Documentation & AGENTS.md
Update wording in:
- `AGENTS.md`: `when score <= -1.50 (bubble risk) or >= +1.00 (deep discount)`
- `UNIFIED_SYSTEM_ARCHITECTURE.md`: Line 172 `If Score <= -1.50 (Macro Bubble) or Score >= +1.00 (Deep Discount)`
- `docs/architecture/00_end_to_end.md` and `docs/architecture/01_valuation_system.md`

## Risks / Trade-offs

- **Visual Muscle Memory**: Users who were previously accustomed to seeing red on the top of the valuation oscillator will now see green on the top (+2.0) and red on the bottom (-2.0). However, this perfectly aligns with the standard Bitcoin valuation convention where bottoms/accumulation are positive osc values and cycle peaks/bubbles are negative osc values (or vice versa depending on oscillator polarity; in our system, +2.0 is green accumulation, matching `MetricDetailChart` and `BentoSummary`).
- **Zero Calculation Risk**: Since no calculation files or database tables are modified, there is zero risk of regression in backtests or ETL pipelines.
