# Maftia Quant Platform: End-to-End Master Architecture

> **Navigation:**
> - [E2E Overview](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/00_end_to_end.md)
> - [01. Valuation Studio](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/01_valuation_system.md)
> - [02. LTTD Lab](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/02_lttd_system.md)
> - [03. MTTD Console](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/03_mttd_system.md)
> - [04. Ichimoku Terminal](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/04_ichimoku_system.md)

---

## 1. System Overview

The **Maftia Quant Bitcoin Intelligence Platform** is an enterprise-grade quantitative trading and analytics ecosystem. It integrates **4 unified quantitative models** into a single event-driven execution pipeline and real-time visualization interface.

The platform is structured into **5 distinct architectural layers**:

```mermaid
graph TD
    subgraph Layer1 ["Layer 1: Unified Ingestion Service"]
        DS_Binance["Binance Exchange Daily OHLCV Feed"]
        DS_Bitview["bitview.space BRK API (STH On-chain Metrics)"]
        DS_Macro["Macro & Sentiment Feeds (Fear & Greed, Funding Rates)"]
    end

    subgraph Layer2 ["Layer 2: Core Orchestration Engine (Python 3.11+)"]
        Orch["run_report_pipeline.py Orchestrator"]
        Sys1["quant-btc-valuation-system (Valuation Composite)"]
        Sys2["quant-btc-lttd-system (Gaussian HMM Regime & Ensemble)"]
        Sys3["quant-btc-mttd-system (MTTD Multi-Principle v2)"]
        Sys4["quant-lttd-ichimoku (Denoised Tanh Oscillator)"]
        
        Orch --> Sys1
        Orch --> Sys2
        Orch --> Sys3
        Orch --> Sys4
    end

    subgraph Layer3 ["Layer 3: Consolidated Storage Engine (SQLite WAL)"]
        DB_Master["maftia_quant.db (Master Storage)"]
        DB_Val["metrics.db (Valuation Cache)"]
        DB_LTTD["lttd.db (LTTD Cache)"]
        
        Sys1 --> DB_Val
        Sys2 --> DB_LTTD
        Sys3 --> DB_Master
        Sys4 --> DB_Master
        DB_Val & DB_LTTD --> DB_Master
    end

    subgraph Layer4 ["Layer 4: Single API Gateway (Hono v4 + Bun)"]
        GW["Bun API Gateway Router (api.quant.maftia.tech:8910)"]
        REST["REST API Endpoints (/api/v1/*)"]
        WS["WebSocket Crosshair Broadcast (/api/v1/ws/crosshair)"]
        
        DB_Master --> GW
        GW --> REST
        GW --> WS
    end

    subgraph Layer5 ["Layer 5: Enterprise Frontend SPA (React 19 + Vite)"]
        UI_Dash["Master Executive Dashboard"]
        UI_Val["Valuation Studio"]
        UI_LTTD["LTTD Lab"]
        UI_MTTD["MTTD Console"]
        UI_Ich["Ichimoku Terminal"]
        
        REST & WS --> UI_Dash
        REST & WS --> UI_Val
        REST & WS --> UI_LTTD
        REST & WS --> UI_MTTD
        REST & WS --> UI_Ich
    end

    classDef default fill:#1e293b,stroke:#64748b,color:#f8fafc;
    classDef highlight fill:#0f172a,stroke:#38bdf8,color:#f8fafc;
    class DS_Binance,DS_Bitview,DS_Macro,DB_Master,GW highlight;
```

---

## 2. Ingestion & Data Sources

`MasterOHLCV` acts as the canonical data source. Freshness is enforced by a **Causal Freshness Guard** ensuring that all indicators use historical ($t-1$) data with no lookahead bias.

*   **OHLCV Master Feed:** Daily price action fetched from Binance Exchange APIs and project cache.
*   **bitview.space BRK API:** Fetches 4 short-term holder (STH) indicators via a single bulk HTTP request:
    *   `sth_mvrv` (Short-Term Holder Market Value to Realized Value)
    *   `sth_nupl` (Short-Term Holder Net Unrealized Profit/Loss)
    *   `sth_sopr_24h` (Short-Term Holder Spent Output Profit Ratio)
    *   `sth_supply_in_profit` (Short-Term Holder Supply in Profit)
*   **Macro & Sentiment Feeds:** Crypto Fear & Greed index, Google Trends, and BTC funding rates.

---

## 3. Core Orchestration Engine

The pipeline runs sequentially via `run_report_pipeline.py`. It coordinates the calculations across all 4 systems, ensuring SQLite connections use **Write-Ahead Logging (WAL)** for lock-free concurrency.

### Daily Sync Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Exec as run_report_pipeline.py
    participant DB as maftia_quant.db (WAL)
    participant VAL as quant-btc-valuation-system
    participant LTTD as quant-btc-lttd-system
    participant MTTD as quant-btc-mttd-system
    participant ICH as quant-lttd-ichimoku

    Exec->>DB: Open SQLite WAL connection
    Exec->>VAL: Trigger Valuation Engine calculation
    VAL->>VAL: Calculate 17 indicators (t-1)
    VAL->>Exec: Return valuation_composite score [-2.0, +2.0]
    
    Exec->>LTTD: Run HMM Regime & Ensemble Engine
    LTTD->>LTTD: Calculate HMM Regime (BULL/BEAR/SIDEWAYS)
    LTTD->>Exec: Return LTTD final_score & regime
    
    Note over Exec,MTTD: Sync synced_daily.json and lttd target_exposure
    Exec->>MTTD: Trigger Mid-Term Trend Engine
    MTTD->>MTTD: Apply ER & Entropy gates; compute position
    MTTD->>Exec: Return mttd_imo & target position
    
    Exec->>ICH: Trigger Ichimoku Quant Engine
    ICH->>ICH: Compute Denoised Tanh components & SuperSmoother
    ICH->>Exec: Return ichimoku_imo & target position
    
    Exec->>DB: Persist UnifiedDailyAnalytics & UnifiedComponentSignals
    Exec->>DB: Close WAL connection cleanly
```

---

## 4. Consolidated Storage Engine

The unified database `maftia_quant.db` stores historical and current analytical metrics.

*   `master_ohlcv`: Canonical table for daily Bitcoin prices (`open`, `high`, `low`, `close`, `volume`).
*   `unified_daily_analytics`: Daily outputs from all 4 quantitative systems.
*   `unified_component_signals`: Daily individual indicator components (17 valuation, 12 LTTD, 10 MTTD, 4 Ichimoku).

---

## 5. Single API Gateway & WebSocket Server

All client queries route through a **Hono v4 Gateway on port `:8910`**, bound to `0.0.0.0` for container and external visibility.

*   `GET /api/v1/executive-summary`: Fetches the latest day's status across all 4 systems.
*   `GET /api/v1/timeseries/master`: Returns full historical time series.
*   `WebSocket /api/v1/ws/crosshair`: Broadcasts multi-window mouse coordinate updates (`x`, `y` coordinates) to synchronize charts across different displays.

---

## 6. Enterprise Frontend SPA

Built with **React 19, TypeScript, Vite, and Lightweight Charts v5.2**.
*   **85px Y-Axis Lock:** Strictly enforces a fixed width of `85px` on the right price/oscillator axis across all subplots to prevent horizontal time-tick misalignment.
*   **DOM Chart Persistence:** Fullscreen maximize toggling preserves chart instances in the DOM by using CSS visibility filters (`.chart-subplot-hidden { height: 0; overflow: hidden }`) instead of unmounting.

---

## 7. Cross-System Interlocking Safeguards

The platform employs a multi-tiered defense architecture, where systems act as gates and overrides for one another.

```mermaid
flowchart LR
    VAL["1. VALUATION SYSTEM<br/>Macro Cycle Pillars<br/><i>Score: -2.0 to +2.0</i>"]
    LTTD["2. LTTD SYSTEM<br/>3-State HMM Regime<br/><i>BULL / BEAR / SIDEWAYS</i>"]
    MTTD["3. MTTD SYSTEM v2<br/>Consensus Oscillator<br/><i>ER & Shannon Entropy Gates</i>"]
    ICH["4. ICHIMOKU QUANT<br/>SuperSmoother Tanh<br/><i>5-Gate Confirmation</i>"]

    VAL -->|"Bubble Circuit Breaker:<br/>If Score >= +1.50<br/>Caps LTTD exposure to 50%"| LTTD
    VAL -->|"Discount Boost:<br/>If Score <= -1.00<br/>Enables aggressive entry"| LTTD
    LTTD -->|"Regime Override:<br/>If HMM = SIDEWAYS (P_Sideways > 0.6)<br/>Forces 0.0 Position Sizing"| MTTD
    LTTD -->|"Regime Override:<br/>If HMM = SIDEWAYS (P_Sideways > 0.6)<br/>Forces 0.0 Position Sizing"| ICH
    MTTD <-->|"Confluence Gate:<br/>Both must confirm positive<br/>for leverage exposure"| ICH

    style VAL fill:#1e293b,stroke:#f97316,color:#f8fafc
    style LTTD fill:#1e293b,stroke:#38bdf8,color:#f8fafc
    style MTTD fill:#1e293b,stroke:#a855f7,color:#f8fafc
    style ICH fill:#1e293b,stroke:#ec4899,color:#f8fafc
```

### Inter-System Interaction Matrix

| System Source | Target System | Logic & Condition | Action Taken |
|---|---|---|---|
| **Valuation** | LTTD | `valuation_composite >= +1.50` (Extreme Bubble) | Set macro safety valve, cap maximum LTTD target exposure to `0.50`. |
| **Valuation** | LTTD | `valuation_composite <= -1.00` (Deep Discount) | Enable aggressive scale-in; override short signals. |
| **LTTD** | MTTD & Ichimoku | `lttd_regime == 'SIDEWAYS'` ($P_{\text{Sideways}} > 0.60$) | Force medium-term target positions (`mttd_position`, `ichimoku_position`) to `0.0` (Return to Cash). |
| **MTTD** | Ichimoku | `mttd_imo > 0.25` AND `ichimoku_imo > 0.40` | Symmetrical confluence: Unlock maximum target leverage/sizing. |

---

> **Navigation:**
> - [E2E Overview](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/00_end_to_end.md)
> - [01. Valuation Studio](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/01_valuation_system.md)
> - [02. LTTD Lab](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/02_lttd_system.md)
> - [03. MTTD Console](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/03_mttd_system.md)
> - [04. Ichimoku Terminal](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/04_ichimoku_system.md)

← Prev (Index) | ↑ [E2E Overview](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/00_end_to_end.md) | [01. Valuation Studio](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/01_valuation_system.md) →
