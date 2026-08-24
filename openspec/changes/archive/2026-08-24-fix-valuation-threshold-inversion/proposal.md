## Why

In the Valuation Pillar Studio (`ValuationStudio.tsx`), the Master Executive Chart (`MultiPaneChart.tsx`), and the threshold configuration panel (`ConfigurationPanel.tsx`), the visual labels, threshold price lines, and descriptive text for the Valuation Composite score scale (`[-2.0, +2.0]`) are inverted. Specifically:
- `+2.00` is mistakenly labeled and styled as "Extreme Overvalued" (Red) instead of **Extreme Undervalued / Cycle Bottom** (Green).
- `+1.00` / `+1.50` is mistakenly labeled as "Bubble" (Red) instead of **Discount / Accumulation Zone** (Green/Teal).
- `-1.00` / `-1.50` is mistakenly labeled as "Discount" (Green) instead of **Warning Overvalued / Bubble Risk** (Orange/Red).
- `-2.00` is mistakenly labeled as "Extreme Undervalued" (Green) instead of **Extreme Overvalued / Cycle Peak** (Red).

The core calculation models (`normalization.py`, `sizing.py`, `sdcaEngine.ts`, and `MetricDetailChart.tsx`) and research documentation (`01_quant_btc_valuation_system.md`) already enforce the canonical convention (positive = undervalued/discount, negative = overvalued/bubble). This change fixes the UI charts, configuration tooltips, and architectural documentation to restore 100% visual and semantic consistency across the entire quantitative terminal.

## What Changes

- **Fix Valuation Studio Chart Reference Lines (`ValuationStudio.tsx`)**:
  - Invert threshold lines to align with canonical convention:
    - `+2.00` $\rightarrow$ Title: `"Extreme Undervalued +2.00"`, Color: `#22C55E` (Green)
    - `+1.00` $\rightarrow$ Title: `"Discount / Accumulation +1.00"`, Color: `#4ADE80` (Light Green)
    - `0.00` $\rightarrow$ Title: `"Neutral 0.00"`, Color: `#64748B` (Gray)
    - `-1.50` $\rightarrow$ Title: `"Bubble Risk -1.50"`, Color: `#F87171` (Light Red)
    - `-2.00` $\rightarrow$ Title: `"Extreme Overvalued -2.00"`, Color: `#EF4444` (Crimson)
- **Fix Executive Dashboard MultiPaneChart Reference Lines and Label (`MultiPaneChart.tsx`)**:
  - Correct `valSeries` price lines: `+1.00` Discount (Green), `-1.50` Bubble (Red).
  - Update subplot label: `"Valuation Composite [-2.0 → +2.0] · Discount +1.00 / Bubble -1.50"`.
- **Fix Piecewise Linear Threshold Descriptions (`ConfigurationPanel.tsx`)**:
  - Correct `score` display strings for `t_minus_2` (`Score = -2.0`), `t_minus_1` (`Score = -1.0`), `t_plus_1` (`Score = +1.0`), and `t_plus_2` (`Score = +2.0`).
- **Synchronize Architectural Documentation & Guardrails**:
  - Fix typos in `AGENTS.md`, `UNIFIED_SYSTEM_ARCHITECTURE.md`, and `docs/architecture/*.md` where bubble risk was described as `>= +1.50` instead of `<= -1.50` and deep discount as `<= -1.00` instead of `>= +1.00`.
- **Update OpenSpec Capability Specifications**:
  - Update `openspec/specs/valuation-studio-reference-lines/spec.md` to reflect the corrected reference lines and colors.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `valuation-studio-reference-lines`: Update composite chart reference line requirements at `+2.0`, `+1.0`, `0.0`, `-1.5`, and `-2.0` with canonical labeling and color assignments.

## Impact & System Scope

- **Impacted Systems**: Primary impact is on **System 1 (`quant-btc-valuation-system`)** UI and **Master Executive Dashboard (`MultiPaneChart`)**.
- **Unaltered Quantitative Systems**: **System 2 (`quant-btc-lttd-system`)**, **System 3 (`quant-btc-mttd-system`)**, and **System 4 (`quant-lttd-ichimoku`)** already use the correct sign convention in their execution engines (`CB_ACTIVATE = -2.26`, `COMP_ENTRY_BOOST = +2.00`).
- **Zero Lookahead Bias**: Strictly preserved; this is a presentation, configuration UI, and documentation alignment with zero changes to data pipelines, causal filters, or $t-1$ timestamps.
- **Non-Goals**:
  - No changes to underlying valuation indicator mathematical formulations or database schemas.
  - No re-introduction or modification of legacy components such as `quant-technical-indicator-bank`.
