# Track E — Sparkline Audit Findings

**Auditor:** Subagent (parallel scouting)
**Date:** 2026-07-11
**Domain:** Sparkline comparison between unified `Sparkline.tsx` and prior `MetricCard.tsx`

---

## Executive Summary

| Finding | Severity | Status |
|---------|----------|--------|
| 1. Double-scaling of sparkline values (`normalized_score * 2`) | **Critical** | Gap confirmed |
| 2. Color coding strategy differs fundamentally | Major | Gap documented |
| 3. Rendering technology (SVG vs Recharts) | Minor | Architectural difference |
| 4. Hover tooltip (new feature in unified) | Minor | New capability |
| 5. Data source for 90-day window | Major | Gap documented |

---

## Finding E1: Double-Scaling of Sparkline & Score Values

**Severity:** CRITICAL
**Domain:** Sparkline data values

### Description

The unified `ValuationStudio.tsx` applies `* 2` to `normalized_score` when constructing sparkline data and display scores. The `normalized_score` field from `unified_component_signals` is already in the `[-2.0, +2.0]` range (same as the prior system's `normalized_value`). This double-scales the values to `[-4.0, +4.0]`.

### Evidence

**Unified code** (`ValuationStudio.tsx`, lines 277-280):

```typescript
const sparklinePoints = sortedHistory.slice(-90).map((s) => ({
    date: s.date.split("T")[0],
    value: toNum(s.normalized_score) * 2,   // ← DOUBLE SCALING
}));

const score = latestSignal ? toNum(latestSignal.normalized_score) * 2 : 0;  // ← DOUBLE SCALING
```

**Pipeline code** (`run_report_pipeline.py`, line 444):

```python
vnorm_val = float(vnorm) if vnorm is not None else 0.0
```

Where `vnorm` = `normalized_value` from `timeseries_metrics` which is already `[-2.0, +2.0]` (confirmed by `normalization.py` returning `-2.0` / `+2.0`).

The value is stored directly without scaling:

```python
(vdate, vname, vraw_val, vnorm_val, s_dir),  # vnorm_val is already [-2, +2]
```

**Prior system** (`DashboardLayout.tsx`, lines 52-56):

```typescript
const sparkData = data.slice(-90).map(pt => ({
    date: pt.date,
    value: pt.normalized_value   // ← no * 2, already [-2, +2]
}));
```

### Impact

- Sparkline Y-range shows [-4, +4] instead of [-2, +2] — misleading
- Score column in component matrix shows incorrect values (e.g., a component with score +1.5 shows as +3.0)
- Signal direction labels (OVERVALUED/DISCOUNT) remain correct because they use `signal_direction` from the backend
- 2-panel composite chart is NOT affected (uses `valuation_composite` directly)

### Reproduction

Open Valuation Studio → observe component matrix score column → any indicator with score > 1.0 shows as > 2.0 (should be capped at +2.0). Sparklines for strongly overvalued indicators show values approaching +4.0.

### Proposed Fix

Remove the `* 2` multipliers in `ValuationStudio.tsx` lines 280 and 283:

```typescript
// Before:
value: toNum(s.normalized_score) * 2,
// After:
value: toNum(s.normalized_score),
```

---

## Finding E2: Color Coding Strategy Difference

**Severity:** MAJOR
**Domain:** Sparkline visual encoding

### Description

Unified sparklines use signal-direction-based color coding (3 discrete colors), while prior system used continuous HSL gradient (full spectrum from red through yellow to green).

### Evidence

**Unified** (`ValuationStudio.tsx`, lines 349-353):

```typescript
<Sparkline
    data={ind.sparklineData}
    color={
        ind.direction === -1
            ? "#22C55E"     // green for discount
            : ind.direction === 1
                ? "#EF4444" // red for overvalued
                : "#64748B" // gray for neutral
    }
/>
```

**Prior** (`MetricCard.tsx`, line 33):

```typescript
const normColor = getValuationColor(metric.normalized_value);
```

Where `getValuationColor` returns an HSL gradient:

- -2: `hsl(350, 85%, 50%)` (red)
- 0: `hsl(45, 85%, 50%)` (yellow)
- +2: `hsl(145, 85%, 50%)` (green)

### Impact

- Prior system showed the degree of overvaluation/undervaluation through color intensity (light yellow = near neutral, deep red/green = extreme)
- Unified shows only 3 discrete colors — a neutral score (0.01) and an extreme score (+1.99) get the same gray/red color
- Users lose the continuous color gradient that provided at-a-glance severity assessment

### Proposed Fix

If 1:1 parity is desired, implement a `valueToHex` utility mirroring the prior system's `getValuationColor` and use it in `Sparkline.tsx` based on the **mean of sparkline values** or the **latest sparkline value** rather than signal direction.

---

## Finding E3: Rendering Technology Difference

**Severity:** MINOR
**Domain:** Sparkline rendering

### Description

Unified uses SVG `<polyline>` while prior used Recharts `<AreaChart>` with gradient fill.

### Evidence

**Unified** (`Sparkline.tsx`, lines 33-37):

```tsx
<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} ...>
    <polyline fill="none" stroke={color} strokeWidth="1.5" points={pathData} />
</svg>
```

**Prior** (`MetricCard.tsx`, lines 44-56):

```tsx
<ResponsiveContainer width="100%" height={40}>
    <AreaChart data={sparklineData}>
        <Area type="monotone" dataKey="value" stroke={normColor} strokeWidth={1.5} ... />
    </AreaChart>
</ResponsiveContainer>
```

### Impact

- SVG polyline has no gradient fill (line only) — prior had an area fill with gradient from 25% opacity to 0%
- SVG is 80×24px default vs prior 100%×40px — unified sparklines are smaller
- SVG renders faster (no library overhead) — acceptable trade-off
- SVG does not smooth lines (no monotone interpolation) — polyline is angular between points

### Notes

This is an acceptable architectural difference. SVG polyline is lighter weight and avoids adding Recharts as a dependency. The trade-off of slightly smaller size and no area fill is acceptable.

---

## Finding E4: Hover Tooltip (New Capability)

**Severity:** MINOR
**Domain:** Sparkline interactivity

### Description

Unified adds a custom hover tooltip feature that was not present in the prior system.

### Evidence

**Unified** (`Sparkline.tsx`, lines 42-72):

```tsx
const handleMouseMove = (e) => {
    // nearest-point detection
    // renders positioned tooltip with date + value
};
```

**Prior**: No custom tooltip on sparklines. Recharts has default hover behavior on `<Area>` but the `dot={false}` setting disables point markers on hover.

### Impact

This is a net improvement — users can now see exact values and dates when hovering over sparklines. Not a parity gap but an enhancement.

---

## Finding E5: Data Source for 90-Day Window

**Severity:** MAJOR
**Domain:** Sparkline data sourcing

### Description

Unified constructs sparkline data from component signals (fetched once via `getComponents`), while prior system fetched per-metric data individually for each indicator sparkline.

### Evidence

**Unified** (`ValuationStudio.tsx`, lines 275-280):

```typescript
const metricSignals = components.filter((c) => c.component_name === key);
const sortedHistory = [...metricSignals].sort((a, b) => a.date.localeCompare(b.date));
const sparklinePoints = sortedHistory.slice(-90).map((s) => ({
    date: s.date.split("T")[0],
    value: toNum(s.normalized_score) * 2,  // double-scaling issue noted separately
}));
```

**Prior** (`DashboardLayout.tsx`, lines 48-56):

```typescript
const sparklinePromises = summaries.map(async (m) => {
    const data = await fetchMetricData(m.name);      // ← separate API call per metric
    const sparkData = data.slice(-90).map(pt => ({
        date: pt.date,
        value: pt.normalized_value                    // ← already [-2, +2]
    }));
});
```

### Impact

- Unified uses 1 API call (`getComponents`) → fewer network requests, better performance
- Unified data comes from `unified_component_signals` table which has `normalized_score` field
- Prior data came from per-metric timeseries endpoint returning `MetricDataPoint[]`
- Both sources ultimately derive from the same valuation system — values should be equivalent
- Potential difference: `getComponents` may return fewer data points than the per-metric endpoint if component signals have lower daily resolution

### Notes

The unified approach is architecturally superior (1 API call vs 17). Values should be equivalent since both source from the valuation system. However, the double-scaling bug (E1) makes the comparison misleading.

---

## Summary Table

| # | Finding | Severity | Requires Fix? | Priority |
|---|---------|----------|---------------|----------|
| E1 | Double-scaling `normalized_score * 2` → values show [-4, +4] range | CRITICAL | Yes | P0 |
| E2 | Color coding: signal-direction discrete vs HSL continuous gradient | MAJOR | Optional | P2 |
| E3 | Rendering: SVG polyline vs Recharts AreaChart with gradient fill | MINOR | No | P3 |
| E4 | Hover tooltip: new capability not in prior system | MINOR | No (enhancement) | — |
| E5 | Data source: 1 API call vs 17 per-metric calls | MAJOR | No (improvement) | — |

---

## Files Affected

1. `/home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/ValuationStudio.tsx` (lines ~278-283) — double-scaling bug
2. `/home/ubuntu/projects/quant.maftia.tech/web/src/components/Sparkline.tsx` — color prop handling (if gradient parity fix implemented)