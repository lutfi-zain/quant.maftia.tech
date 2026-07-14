# 02. LTTD System Architecture

> **Navigation:**
> - [E2E Overview](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/00_end_to_end.md)
> - [01. Valuation Studio](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/01_valuation_system.md)
> - [02. LTTD Lab](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/02_lttd_system.md)
> - [03. MTTD Console](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/03_mttd_system.md)
> - [04. Ichimoku Terminal](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/04_ichimoku_system.md)

---

## 1. System Role

The **Long-Term Trend Detection System** (LTTD, `quant-btc-lttd-system`) classifies daily market conditions into three major structural states (`BULL`, `BEAR`, or `SIDEWAYS`) and computes an ensemble quantitative score (`[-1.0, +1.0]`) to direct target investment exposures.

Its primary architectural role is serving as the **Regime Override Gate** for the medium-term systems. When LTTD classifies the market as `SIDEWAYS` ($P_{\text{Sideways}} > 0.60$), it forces mid-term exposures (MTTD and Ichimoku) to `0.0` to avoid whipsaw fee churn.

---

## 2. 6-Layer Signal Engine Flow

The LTTD calculations are partitioned across 6 processing layers, from ingestion to presentation:

```mermaid
graph TD
    subgraph Layer0 [Layer 0: Ingestion & Raw Data]
        D_OHLCV["MasterOHLCV (Daily Close, Returns)"]
        D_Onchain["STH On-chain Metrics (sth_mvrv, sth_nupl, etc.)"]
    end

    subgraph Layer1 [Layer 1: Regime Detection]
        HMM_Input["Calculate Log Returns & 20-day Realized Volatility"]
        HMM["3-State Gaussian HMM Model"]
        Regime_Out["Posterior Probabilities: P_Bull, P_Bear, P_Sideways"]
        
        D_OHLCV --> HMM_Input --> HMM --> Regime_Out
    end

    subgraph Layer2 [Layer 2: Signal Engine - Causal Filtering]
        Tech["12 Technical Indicators (Kalman RSI, Quantile DEMA, VWMA TSI, etc.)"]
        D_OHLCV --> Tech
        D_Onchain --> Tech
    end

    subgraph Layer3 [Layer 3: Orthogonalization & Pruning]
        Std["Z-Score Standardisation"]
        VIF["VIF Filter: Prune indicators if VIF > 10"]
        PCA["PCA Module: Extract top 3 Principal Components"]
        
        Tech --> Std --> VIF --> PCA
    end

    subgraph Layer4 [Layer 4: Ensemble Aggregation]
        Ensemble["XGBoost / L1-Lasso Logistic Regression Ensemble"]
        WFO["Walk-Forward Optimization (WFO):<br/>3yr Train -> 6mo Val -> 6mo Test"]
        
        PCA --> Ensemble --> WFO
    end

    subgraph Layer5 [Layer 5: Sizing & Regime Override]
        Override{"Is P_Sideways > 0.60<br/>or valuation_composite >= +1.50?"}
        Sized["Position = P_Bull * FinalScore * VolTarget"]
        CB_Active["Target Exposure = 0.0<br/>(Sideways Regime / Bubble CB)"]
        
        Regime_Out & WFO --> Override
        Override -->|Yes| CB_Active
        Override -->|No| Sized
    end

    subgraph Layer6 [Layer 6: Database & API Presentation]
        DB_LTTD["lttd.db (daily_lttd table)"]
        DB_Master["maftia_quant.db (unified_daily_analytics)"]
        API["Hono v4 Gateway Port :8910"]
        UI["React SPA (LTTD Lab Panel)"]
        
        CB_Active & Sized --> DB_LTTD --> DB_Master --> API --> UI
    end
```

---

## 3. Gaussian HMM Regime States

A **3-State Gaussian Hidden Markov Model (HMM)** is trained using daily log returns and annualized realized volatility:

| Regime | State Index | Description | Volatility Characteristics | Sizing Influence |
|---|---|---|---|---|
| **BULL** | `0` | Mean positive returns, steady growth. | Low-to-Medium | Sinyal ensemble active. |
| **BEAR** | `1` | Negative expected returns, high downside variance. | High | Sinyal ensemble active (bias short/cash). |
| **SIDEWAYS** | `2` | Mean returns near 0, trendless range. | Low | **Circuit Breaker Active:** Override forces `0.0` exposure. |

---

## 4. Orthogonalization & Walk-Forward Optimization (WFO)

To eliminate multikolinearitas (collinearity) and prevent parameter overfitting:
1.  **Variance Inflation Factor (VIF):** Features with $\text{VIF} > 10$ are pruned.
2.  **Principal Component Analysis (PCA):** Performs linear transformation, extracting the top 3 components explaining $\ge 85\%$ of variance.
3.  **Pratt's Relative Importance:** Measures the individual feature contribution to the final Principal Components.
4.  **WFO Schedule:** Rolling 3-Year Training Window $\rightarrow$ 6-Month Validation (hyperparameter tuning) $\rightarrow$ 6-Month Out-of-Sample Test.

---

## 5. Storage Schema Excerpt (`database/lttd.db`)

```sql
-- LTTD core regime and exposure output
CREATE TABLE daily_lttd (
    data_as_of TEXT PRIMARY KEY,
    date TEXT,
    regime TEXT CHECK(regime IN ('Strong Bull', 'Weak Bull', 'Neutral', 'Weak Bear', 'Strong Bear', 'BULL', 'BEAR', 'SIDEWAYS')) NOT NULL,
    final_score REAL CHECK(final_score >= -1.0 AND final_score <= 1.0) NOT NULL,
    target_exposure REAL CHECK(target_exposure >= 0.0 AND target_exposure <= 2.5) NOT NULL,
    posterior_prob REAL,
    circuit_breaker_active BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily raw and normalized indicator scores
CREATE TABLE indicator_scores (
    date TEXT,
    indicator_name TEXT,
    score REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, indicator_name)
);

-- Extracted principal components
CREATE TABLE pca_components (
    date TEXT,
    component_name TEXT,
    value REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, component_name)
);
```

---

## 6. API Route Mapping & Frontend

| HTTP Verb | Route | Description |
|---|---|---|
| **GET** | `/api/v1/system/lttd/details` | Returns daily model details including PCA variances. |
| **GET** | `/api/v1/timeseries/master` | Returns timeline variables including `lttd_regime` and `lttd_target_exposure`. |

> [!NOTE]
> **Operational Boundary Safeguard:** The API Gateway acts as a strictly read-only interface querying `maftia_quant.db`. The legacy `POST /api/v1/lttd/actions/run` endpoint and any script spawning/subprocess orchestration triggers for `quant-btc-lttd-system` have been completely removed. Executing and running LTTD engines or backfills is restricted strictly to CLI operation.

### Frontend Integration (`LttdLab.tsx`)
The **LTTD Lab** panel visualizes long-term states:
*   **Regime Background Bands:** Colors chart zones by state (`BULL` = Green, `BEAR` = Red, `SIDEWAYS` = Yellow).
*   **Continuous Exposure Backtest:** Positions in the LTTD Lab strategy backtester bind directly to `lttd_target_exposure` to maintain sizing logic rather than binary flags, increasing backtest Sharpe parity.

---

<blockquote>
  <p><strong>Navigation:</strong></p>
  <ul>
    <li><a href="file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/00_end_to_end.md">E2E Overview</a></li>
    <li><a href="file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/01_valuation_system.md">01. Valuation Studio</a></li>
    <li><a href="file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/02_lttd_system.md">02. LTTD Lab</a></li>
    <li><a href="file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/03_mttd_system.md">03. MTTD Console</a></li>
    <li><a href="file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/04_ichimoku_system.md">04. Ichimoku Terminal</a></li>
  </ul>
</blockquote>

← [01. Valuation Studio](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/01_valuation_system.md) | ↑ [LTTD Lab](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/02_lttd_system.md) | [03. MTTD Console](file:///home/ubuntu/projects/quant.maftia.tech/docs/architecture/03_mttd_system.md) →
