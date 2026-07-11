## Context

The unified `ValuationStudio.tsx` and its sub-components (`MetricDetailChart.tsx`, `Sparkline.tsx`) were built to replicate the prior standalone `quant-btc-valuation-system` frontend which had a richer component set including `CompositeChart.tsx`, `AvivRatioChart.tsx`, `MetricDetail.tsx`, `MetricGrid.tsx`, `MetricCard.tsx`, `ThresholdEditor.tsx`, `DashboardLayout.tsx`, and `Sidebar.tsx`. The previous parity change (`2026-07-10`) established the structural scaffolding but no systematic component-by-component audit was performed against the prior system's actual runtime behavior.

The prior system had multiple subtle behaviors:

- **`CompositeChart.tsx`**: 2-panel Area+Area chart with specific reference lines, maximize toggles body overflow hidden, unique PNG export compositing with panel gap handling, crosshair sync setting position via `getCrosshairData` helper
- **`AvivRatioChart.tsx`**: 3-panel Candlestick+Line+Line chart with explicit date intersection (Set-based), 90px y-axis width, `mapToOscillator` embedded inline with slightly different return semantics (returns `0.0` instead of `null` for intermediate values)
- **`MetricDetail.tsx`**: 3-panel Candlestick+Line+Area chart, `valuationToHex` color utility, config threshold lines created at mount time with raw series, unique `getCrosshairData` lookup approach
- **`MetricGrid.tsx`**: Category-sectioned layout with section header banners and component counts
- **`MetricCard.tsx`**: Recharts AreaChart sparklines (not SVG polyline), raw_value + normalized_value display, regime state interpretation text, latest date displayed
- **`ThresholdEditor.tsx`**: Separate component with dirty detection, direction detection, reset defaults fetch, save calling `renormalizeMetric` after config save, success/error banner with color-coded borders
- **`DashboardLayout.tsx`**: Orchestrator that parallel-fetches metrics, composite, configs, BTC OHLC, AND per-metric sparkline data (last 90 points), handles refetch/rebuild pipeline API calls

The unified system uses a different architectural approach — React hooks inside `ValuationStudio.tsx` orchestrate everything, SVG polyline sparklines replace Recharts, and the detail chart computes oscillator client-side via `mapToOscillator` in `web/src/lib/oscillator.ts`.

## Goals / Non-Goals

**Goals:**

- Conduct a systematic parallel scouting audit across 8 audit domains: Composite Chart, Metric Detail Chart, Threshold Editor, Component Matrix, Sparklines, PNG Export, API Routes, and State Management
- For each domain, compare unified implementation vs prior system implementation side-by-side
- Document every gap with: domain, severity (Critical/Major/Minor), description, reproduction steps, and proposed fix
- For Critical gaps, provide immediate hotfix alongside the audit report
- Produce a single consolidated audit report (`audit-report.md`) that can serve as a pull request or remediation ticket
- Verify all 17 indicators render correctly with correct score ranges, sparkline colors, and signal directions

**Non-Goals:**

- Refactoring the prior standalone `quant-btc-valuation-system` frontend
- Changing the piecewise linear interpolation algorithm
- Touching `quant-technical-indicator-bank`
- Adding new features beyond achieving 1:1 parity
- Modifying LTTD, MTTD, or Ichimoku systems

## Decisions

### 1. Parallel Scouting Method: 8 Independent Audit Tracks

**Decision**: Split the audit into 8 independent parallel tracks, each run by a separate reviewer session. Each track produces a focused gap report section. The results are consolidated into the final audit report.

**Rationale**: The 8 domains are minimally coupled — changes to one do not affect others. Parallel execution minimizes total audit time and allows each track to deeply focus on its domain without context switching.

**Audit Tracks:**

1. **Composite Chart (2-Panel)**: Compare ValuationStudio.tsx main charts vs prior CompositeChart.tsx
2. **Metric Detail Chart (3-Panel)**: Compare MetricDetailChart.tsx vs prior AvivRatioChart.tsx + MetricDetail.tsx
3. **Threshold Editor**: Compare inline editor in MetricDetailChart.tsx vs prior ThresholdEditor.tsx
4. **Component Matrix & Metric Grid**: Compare table in ValuationStudio.tsx vs prior MetricGrid.tsx + MetricCard.tsx
5. **Sparklines**: Compare Sparkline.tsx vs prior Recharts-based sparklines in MetricCard.tsx
6. **PNG Export**: Compare exportChartsToPng.ts vs prior CompositeChart.exportToPng
7. **API Routes & Data**: Compare metrics.ts backend routes vs prior API endpoints
8. **State Management & Navigation**: Compare state handling in ValuationStudio.tsx vs prior DashboardLayout.tsx

### 2. Gap Severity Classification

**Decision**: Use a 3-tier severity system:

- **Critical**: Data fidelity issue (wrong values, misaligned data, missing data), broken interaction preventing core use (can't view detail), or crash/error on normal flow
- **Major**: Missing feature/behavior that was present in prior system, visual inconsistency that affects analytical judgment, or non-trivial UX regression
- **Minor**: Cosmetic difference, different implementation approach with same outcome, or edge case behavior

**Rationale**: Clear severity helps prioritize remediation. Critical gaps block migration; Major gaps should be fixed before the next release; Minor gaps can be backlogged.

### 3. Audit Report Format

**Decision**: One consolidated `audit-report.md` in the change root with:

- Executive summary (count of Critical/Major/Minor gaps, 1:1 parity percentage)
- Per-domain detailed findings
- Each finding has: `[Domain] Severity: Title`, Description, Expected behavior, Actual behavior, Reproduction, Proposed fix
- Summary table at the end with fix priority ordering

**Rationale**: A single report is easier to review, share, and action against than 8 separate documents.

### 4. Gap Remediation vs Documentation Only

**Decision**: Critical gaps will include an inline hotfix as part of this change. Major/Minor gaps are documented as findings only — remediation is deferred to a follow-up change unless the user explicitly requests it.

**Rationale**: The primary deliverable is the audit itself. Fixing every gap would double the scope. Critical data-integrity issues are fixed immediately to avoid serving incorrect analytics.

### 5. Prior System Reference Snapshot

**Decision**: All prior system component code has been read and archived in this document's context. The audit does not execute the prior system — it compares source code behavior, data structures, and rendering logic statically.

**Rationale**: The prior system may not have a running instance on this machine. Static code comparison is sufficient for a 1:1 parity audit since all rendering logic is deterministic.

## Risks / Trade-offs

- **[Risk] Static code comparison may miss runtime behavior differences** → Mitigation: Where prior system behavior is ambiguous (e.g., crosshair sync callback ordering), trace through the effect dependency arrays and callback registration order to determine runtime semantics.
- **[Risk] Prior system's Recharts sparklines vs unified SVG polyline** → Sparklines are inherently different rendering technologies. Audit focuses on data alignment (90-day window, value range, color semantics) rather than pixel-perfect visual match.
- **[Risk] The prior system used `mapToOscillator` that returns `0.0` for intermediate null values differently than the unified version which returns `null`** → This is a potential Critical gap if it causes blank oscillator data. The audit will specifically check `isNaN` and null handling in both implementations.
- **[Risk] Date intersection/alignment strategy differs** → Prior system used Set-based intersection (`btcDates.has()`). Unified system uses SQL-level JOIN. Both should produce identical results but the audit must verify.**
- **[Trade-off] 8 parallel tracks require coordinating findings** → Each track is independent; results are simply concatenated into the report. No cross-track conflict resolution needed.

## Audit Methodology

For each audit domain, the reviewer will:

1. **Read** the unified component in full (already read)
2. **Read** the corresponding prior system component in full (already read)
3. **Compare** by feature area using a checklist derived from the prior system's rendered output:
   - Data rendering: same data source, same scale, same visual encoding?
   - Interactivity: same interactions, same keyboard/click behavior?
   - State management: same loading/error/empty states, same navigation flow?
   - Visual layout: same subplot arrangement, same header/footer elements, same labels?
   - Edge cases: null data, empty arrays, missing configs, network errors?
4. **Document** any difference found, with severity classification
5. **For Critical gaps**: propose and implement a fix
