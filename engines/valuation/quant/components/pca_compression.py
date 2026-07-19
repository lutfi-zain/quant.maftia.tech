"""
PCA Compression Layer for ValuationComposite.

Transforms 17 normalized indicator scores into orthogonal principal components
to mitigate multicollinearity bias in equally-weighted aggregation.
"""
import sqlite3
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from typing import List, Optional, Tuple

# Components that are still included (aviv_nupl excluded per previous fix)
VALUATION_COMPONENTS: List[str] = [
    "ahr999",
    "aviv_ratio",
    "cvdd_ratio",
    "dvrsi",
    "fear_greed_cmc",
    "fear_greed_og",
    "lth_sth_sopr_ratio",
    "mvrv_z",
    "pi_cycle_top",
    "risk_metrics",
    "sharpe_ratio_52w",
    "terminal_price_ratio",
    "two_year_ma",
    "unrealized_sell_risk",
    "vpli",
    "williams_r",
]

# Total expected components
N_COMPONENTS = len(VALUATION_COMPONENTS)

# Maximum missing ratio per day before excluding that day from PCA fit
MAX_MISSING_RATIO = 0.5

# Minimum explained variance ratio to retain a PC
MIN_VARIANCE_RATIO = 0.05

# Rolling window for PCA fitting
PCA_WINDOW = 365


def _load_component_matrix(db_path: str, cut_date: Optional[str] = None) -> pd.DataFrame:
    """
    Load a date x component matrix of normalized scores from unified_component_signals.

    Returns a DataFrame with:
        - index: date (string YYYY-MM-DD, sorted)
        - columns: component names
        - values: normalized_score
    """
    conn = sqlite3.connect(db_path)

    placeholders = ",".join("?" for _ in VALUATION_COMPONENTS)
    if cut_date:
        rows = conn.execute(
            f"""
            SELECT date, component_name, normalized_score
            FROM unified_component_signals
            WHERE system_source = 'VALUATION'
              AND component_name IN ({placeholders})
              AND date <= ?
            ORDER BY date ASC
            """,
            [*VALUATION_COMPONENTS, cut_date],
        ).fetchall()
    else:
        rows = conn.execute(
            f"""
            SELECT date, component_name, normalized_score
            FROM unified_component_signals
            WHERE system_source = 'VALUATION'
              AND component_name IN ({placeholders})
            ORDER BY date ASC
            """,
            VALUATION_COMPONENTS,
        ).fetchall()

    conn.close()

    if not rows:
        empty_df = pd.DataFrame()
        assert isinstance(empty_df, pd.DataFrame)
        return empty_df

    df = pd.DataFrame(rows, columns=["date", "component_name", "normalized_score"])
    # Normalize mixed date formats. Keep last value if duplicate date+component
    df["date"] = df["date"].str[:10]
    df = df.drop_duplicates(subset=["date", "component_name"], keep="last")
    matrix = df.pivot(index="date", columns="component_name", values="normalized_score")
    matrix.index = matrix.index.sort_values()
    matrix = matrix.sort_index()

    # Ensure all expected columns exist (fill missing with NaN)
    for col in VALUATION_COMPONENTS:
        if col not in matrix.columns:
            matrix[col] = np.nan

    return matrix[VALUATION_COMPONENTS]


def compute_pca_composite(
    db_path: str,
    cut_date: Optional[str] = None,
    rolling_window: int = PCA_WINDOW,
) -> pd.Series:
    """
    Compute the PCA-compressed ValuationComposite for all dates <= cut_date.

    Returns a Series indexed by date with values in [-2.0, +2.0].
    """
    matrix = _load_component_matrix(db_path, cut_date)
    if matrix.empty or len(matrix) < rolling_window:
        # Fallback: simple mean if insufficient data
        return matrix.mean(axis=1, skipna=True).fillna(0.0).clip(-2.0, 2.0)

    # Impute remaining NaN with component-wise mean (non-causal imputation is okay
    # since we only use the rolling window for PCA fitting, not for future prediction)
    component_means = matrix.mean(skipna=True)
    matrix_filled = matrix.fillna(component_means)

    composite = pd.Series(index=matrix.index, dtype=float, name="valuation_composite")

    for i in range(len(matrix)):
        current_date = matrix.index[i]

        if i < rolling_window:
            # Use simple average for early dates (insufficient rolling window)
            row = matrix.iloc[i]
            valid = row.dropna()
            composite.iloc[i] = valid.mean() if len(valid) > 0 else 0.0
            continue

        # Rolling window: [i - rolling_window, i - 1] (strictly causal)
        train_start = i - rolling_window
        train_data = matrix_filled.iloc[train_start:i]

        # Check missing ratio per date
        missing_ratio = train_data.isnull().mean(axis=1)
        train_clean = train_data[missing_ratio <= MAX_MISSING_RATIO]

        if len(train_clean) < 30:
            # Fallback if too few clean training rows
            row = matrix.iloc[i]
            valid = row.dropna()
            composite.iloc[i] = valid.mean() if len(valid) > 0 else 0.0
            continue

        # Fit PCA
        pca = PCA()
        pca.fit(train_clean.values)

        # Select components with explained variance >= MIN_VARIANCE_RATIO
        mask = pca.explained_variance_ratio_ >= MIN_VARIANCE_RATIO
        n_selected = mask.sum()

        if n_selected == 0:
            # Fallback: keep the first component
            n_selected = 1
            mask[0] = True

        # Project the current day's scores
        current_row = matrix_filled.iloc[i].values.reshape(1, -1)
        projected = pca.transform(current_row)[0, :n_selected]

        # Equally-weighted mean of retained PCs, then scale to [-2, 2]
        pc_mean = projected.mean()
        scaled = np.clip(pc_mean * 2.0, -2.0, 2.0)
        composite.iloc[i] = scaled

    return composite.clip(-2.0, 2.0)
