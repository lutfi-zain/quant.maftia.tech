import numpy as np
import pandas as pd

def compute_atr(df: pd.DataFrame, window: int = 14) -> pd.Series:
    tr1 = df['High'] - df['Low']
    tr2 = (df['High'] - df['Close'].shift(1)).abs()
    tr3 = (df['Low'] - df['Close'].shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=window).mean()

def ehler_supersmoother(series: pd.Series, length: int = 7) -> pd.Series:
    """
    Ehler 2-Pole SuperSmoother Filter (Book 1 Spectral Denoising).
    Eliminates high-frequency market microstructure noise while retaining zero lag.
    """
    a1 = np.exp(-1.414 * np.pi / length)
    b1 = 2 * a1 * np.cos(np.radians(1.414 * 180.0 / length))
    c2 = b1
    c3 = -a1 * a1
    c1 = 1 - c2 - c3

    vals = series.ffill().fillna(0).values
    filt = np.zeros(len(vals))
    filt[0] = vals[0]
    if len(vals) > 1:
        filt[1] = vals[1]
    for i in range(2, len(vals)):
        filt[i] = c1 * (vals[i] + vals[i-1]) / 2 + c2 * filt[i-1] + c3 * filt[i-2]
    return pd.Series(filt, index=series.index)

def shannon_entropy(series: pd.Series, window: int = 15, bins: int = 6) -> pd.Series:
    """
    Computes rolling Shannon Information Entropy of returns (Book 7 Sogo-hen).
    Higher entropy indicates random Gaussian noise/chop; lower entropy indicates deterministic trend.
    """
    def calc_shannon(x):
        if len(x) < window:
            return np.nan
        counts, _ = np.histogram(x, bins=bins)
        probs = counts / np.sum(counts)
        probs = probs[probs > 0]
        return -np.sum(probs * np.log2(probs))
    
    returns = series.pct_change().fillna(0)
    return returns.rolling(window=window).apply(calc_shannon, raw=True)

def extract_causal_pivots_and_waves(df: pd.DataFrame, swing_lookback: int = 5) -> dict:
    """
    Causally extracts swing pivots and identifies Book 3 (Hado-ron) wave structures
    and Book 4 (Keisan-chi-ron) canonical price targets without look-ahead bias.
    
    Wave Archetypes (Book 3):
    - I-Wave: Single impulse leg (1 bar/sequence)
    - V-Wave: Two-leg retracement or rebound (A -> B)
    - N-Wave: Canonical 3-leg trend structure (A -> B -> C -> D)
      * Bullish: A(Low) -> B(High) -> C(Low) with C > A (Higher Low) and Close >= B (Confirmed Breakout)
      * Bearish: A(High) -> B(Low) -> C(High) with C < A (Lower High) and Close <= B (Confirmed Breakdown)
    - P-Wave: Contracting triangle consolidation (amp2 < 0.65 * amp1)
    - Y-Wave: Expanding megaphone / broadening formation
    - S-Wave: Structural failure / invalidation (uptrend fails higher low with C <= A)
    
    Price Targets (Book 4):
    - V-Target: B + (B - C)
    - N-Target: C + (B - A)
    - E-Target: B + (B - A)
    - NT-Target: C + (C - A)
    """
    n = len(df)
    highs = df['High'].values
    lows = df['Low'].values
    closes = df['Close'].values
    
    # Kihon Suchi (Fundamental Numbers - Book 2)
    KIHON_SUCHI = np.array([9, 17, 26, 33, 42, 65, 76, 129, 172, 226, 257])
    
    pivots = []  # List of (bar_idx, price, type: +1 for High, -1 for Low)
    
    wave_types = ['I'] * n
    wave_codes = np.zeros(n, dtype=int)  # 0: I, 1: V, 2: N, 3: P, 4: Y, 5: S
    is_n_wave = np.zeros(n)
    is_p_wave = np.zeros(n)
    target_V = np.full(n, np.nan)
    target_N = np.full(n, np.nan)
    target_E = np.full(n, np.nan)
    target_NT = np.full(n, np.nan)
    e_target_dist = np.zeros(n)
    bars_since_pivot = np.zeros(n)
    kihon_suchi_score = np.zeros(n)
    time_confluence_flag = np.zeros(n)
    
    k = swing_lookback
    
    for t in range(2 * k, n):
        cand_high_idx = t - k
        cand_high = highs[cand_high_idx]
        is_high = True
        for j in range(t - 2 * k, t + 1):
            if highs[j] > cand_high:
                is_high = False
                break
        
        cand_low_idx = t - k
        cand_low = lows[cand_low_idx]
        is_low = True
        for j in range(t - 2 * k, t + 1):
            if lows[j] < cand_low:
                is_low = False
                break
                
        if is_high and (not pivots or pivots[-1][2] != 1):
            if pivots and pivots[-1][2] == 1:
                if cand_high > pivots[-1][1]:
                    pivots[-1] = (cand_high_idx, cand_high, 1)
            else:
                pivots.append((cand_high_idx, cand_high, 1))
                
        if is_low and (not pivots or pivots[-1][2] != -1):
            if pivots and pivots[-1][2] == -1:
                if cand_low < pivots[-1][1]:
                    pivots[-1] = (cand_low_idx, cand_low, -1)
            else:
                pivots.append((cand_low_idx, cand_low, -1))
                
        # Book 2: Jikan-ron (Time Cycles)
        if pivots:
            last_pivot_idx, last_pivot_price, last_pivot_type = pivots[-1]
            dt = t - last_pivot_idx
            bars_since_pivot[t] = dt
            min_dist = np.min(np.abs(KIHON_SUCHI - dt))
            kihon_suchi_score[t] = np.exp(-(min_dist ** 2) / (2 * (2.0 ** 2)))
            time_confluence_flag[t] = 1.0 if min_dist <= 1 else 0.0
            
        # Book 3 & 4: Hado-ron (Waves) & Keisan-chi-ron (Targets)
        if len(pivots) >= 3:
            p0_idx, p0_price, p0_type = pivots[-1]  # C (most recent pivot)
            p1_idx, p1_price, p1_type = pivots[-2]  # B (preceding pivot)
            p2_idx, p2_price, p2_type = pivots[-3]  # A (base pivot)
            
            c_price = closes[t]
            
            if p2_type == -1 and p1_type == 1 and p0_type == -1:
                # Bullish wave sequence: A(Low) -> B(High) -> C(Low)
                A, B, C = p2_price, p1_price, p0_price
                
                # 4 Canonical Price Targets (Book 4)
                pV = B + (B - C)
                pN = C + (B - A)
                pE = B + (B - A)
                pNT = C + (C - A)
                
                target_V[t] = pV
                target_N[t] = pN
                target_E[t] = pE
                target_NT[t] = pNT
                
                if pE > pN:
                    e_target_dist[t] = (c_price - pN) / (pE - pN)
                
                amp1 = abs(B - A)
                amp2 = abs(B - C)
                
                # Wave Archetypes Classification (Book 3)
                if C <= A:
                    if c_price >= B:
                        # Upward breakout reversing S-wave failure into new impulse leg
                        wave_types[t] = 'I'
                        wave_codes[t] = 0
                    else:
                        # Active S-Wave: Structural failure (failed higher low C <= A)
                        wave_types[t] = 'S'
                        wave_codes[t] = 5
                elif C > A and amp2 < 0.65 * amp1 and c_price < B and c_price > C:
                    # P-Wave: Contracting triangle consolidation
                    wave_types[t] = 'P'
                    wave_codes[t] = 3
                    is_p_wave[t] = 1.0
                elif C > A and c_price >= B:
                    # Confirmed Bullish N-Wave (Higher Low C > A and Breakout Close >= B)
                    wave_types[t] = 'N'
                    wave_codes[t] = 2
                    is_n_wave[t] = 1.0
                elif C > A and c_price < B:
                    # Active V-Wave retracement leg
                    wave_types[t] = 'V'
                    wave_codes[t] = 1
                else:
                    wave_types[t] = 'I'
                    wave_codes[t] = 0
            
            elif p2_type == 1 and p1_type == -1 and p0_type == 1:
                # Bearish wave sequence: A(High) -> B(Low) -> C(High)
                A, B, C = p2_price, p1_price, p0_price
                
                if C < A:
                    # Lower High C < A: Bearish wave sequence
                    pV = B - (C - B)
                    pN = C - (A - B)
                    pE = B - (A - B)
                    pNT = C - (A - C)
                    
                    target_V[t] = pV
                    target_N[t] = pN
                    target_E[t] = pE
                    target_NT[t] = pNT
                    
                    amp1 = abs(A - B)
                    amp2 = abs(C - B)
                    
                    if amp2 < 0.65 * amp1 and c_price > B and c_price < C:
                        wave_types[t] = 'P'
                        wave_codes[t] = 3
                        is_p_wave[t] = 1.0
                    elif c_price <= B:
                        # Confirmed Bearish N-Wave (Breakdown Close <= B)
                        wave_types[t] = 'N'
                        wave_codes[t] = 2
                        is_n_wave[t] = 1.0
                    elif c_price > B:
                        # Active Bearish V-Wave
                        wave_types[t] = 'V'
                        wave_codes[t] = 1
                    else:
                        wave_types[t] = 'I'
                        wave_codes[t] = 0
                else:
                    # C >= A: Bullish higher high expansion from B(Low) -> C(High)
                    pV = C + (C - B)
                    pN = C + (C - A)
                    pE = C + (C - B)
                    pNT = C + (A - B)
                    
                    target_V[t] = pV
                    target_N[t] = pN
                    target_E[t] = pE
                    target_NT[t] = pNT
                    
                    if c_price >= C:
                        wave_types[t] = 'I'
                        wave_codes[t] = 0
                    else:
                        wave_types[t] = 'V'
                        wave_codes[t] = 1
                    
    return {
        'wave_type': wave_types,
        'wave_code': wave_codes,
        'is_n_wave': is_n_wave,
        'is_p_wave': is_p_wave,
        'target_V': target_V,
        'target_N': target_N,
        'target_E': target_E,
        'target_NT': target_NT,
        'e_target_dist': e_target_dist,
        'bars_since_pivot': bars_since_pivot,
        'kihon_suchi_score': kihon_suchi_score,
        'time_confluence_flag': time_confluence_flag,
    }

def generate_ichimoku_features(df: pd.DataFrame,
                               p1=20, p2=60, p3=120,
                               er_len=14, std_len=30,
                               entropy_window=15, entropy_bins=6,
                               swing_lookback=5) -> pd.DataFrame:
    """
    Generates the complete 7-Book Canonical Ichimoku Kinko Hyo Quantitative Feature Set:
    - Book 1: 5-Line Equilibrium & Tanh Denoised Oscillators (S_TK, S_Cloud, S_Future, S_Chikou, IMO)
    - Book 2: Jikan-ron (Kihon Suchi Fundamental Numbers & Time Cycle Confluence)
    - Book 3: Hado-ron (6 Wave Archetypes: I, V, N, P, Y, S)
    - Book 4: Keisan-chi-ron (4 Canonical Price Targets: V, N, E, NT)
    - Book 5: Waga Saiko no Hen (Kumo Twist Inflection & Kairitsu Elasticity)
    - Book 6: Sokutei-hen (Cloud Mass Thickness & Volatility Bands)
    - Book 7: Sogo-hen (Unified Master System Telemetry)
    """
    df = df.copy()
    df['ATR'] = compute_atr(df, p2)
    df['ATR14'] = compute_atr(df, 14)

    # === BOOK 1: BASE ICHIMOKU LINES & SPECTRAL DENOISING ===
    df['tenkan_sen'] = (df['High'].rolling(p1).max() + df['Low'].rolling(p1).min()) / 2
    df['kijun_sen'] = (df['High'].rolling(p2).max() + df['Low'].rolling(p2).min()) / 2

    df['senkou_span_a_raw'] = (df['tenkan_sen'] + df['kijun_sen']) / 2
    df['senkou_span_b_raw'] = (df['High'].rolling(p3).max() + df['Low'].rolling(p3).min()) / 2

    df['senkou_span_a'] = df['senkou_span_a_raw'].shift(p2)
    df['senkou_span_b'] = df['senkou_span_b_raw'].shift(p2)
    
    # Chikou Span (backward shifted for visualization)
    df['chikou_span'] = df['Close'].shift(-p2)

    # 200-day Trend Baseline
    df['MA200'] = df['Close'].rolling(200).mean()

    # Normalized components (tanh bounded [-1, 1])
    df['S_TK'] = np.tanh((df['tenkan_sen'] - df['kijun_sen']) / df['ATR'])

    cloud_max = np.maximum(df['senkou_span_a'], df['senkou_span_b'])
    cloud_min = np.minimum(df['senkou_span_a'], df['senkou_span_b'])
    dist_cloud = np.zeros(len(df))
    above = df['Close'] > cloud_max
    below = df['Close'] < cloud_min
    dist_cloud[above] = (df['Close'] - cloud_max)[above] / df['ATR'][above]
    dist_cloud[below] = (df['Close'] - cloud_min)[below] / df['ATR'][below]
    df['S_Cloud'] = np.tanh(dist_cloud)

    df['S_Future'] = np.tanh((df['senkou_span_a_raw'] - df['senkou_span_b_raw']) / df['ATR'])
    raw_chikou_dist = (df['Close'] - df['Close'].shift(p2)) / df['ATR']
    smoothed_chikou_dist = ehler_supersmoother(raw_chikou_dist, length=4)
    df['S_Chikou'] = np.tanh(smoothed_chikou_dist)

    # Composite IMO & SuperSmoother Filter
    imo_raw = (df['S_TK'] + df['S_Cloud'] + df['S_Future'] + df['S_Chikou']) / 4.0
    df['IMO'] = ehler_supersmoother(imo_raw, length=7)
    df['IMO_Std'] = df['IMO'].rolling(std_len).std()

    # Fractal Efficiency Ratio (ER) & Information Shannon Entropy
    change = df['Close'].diff().abs()
    volatility = change.rolling(er_len).sum()
    direction = df['Close'].diff(er_len).abs()
    df['ER'] = direction / volatility
    df['Entropy'] = shannon_entropy(df['Close'], window=entropy_window, bins=entropy_bins)

    # Price ROC for crash gate (30 days lookback)
    df['roc_gate'] = df['Close'].pct_change(periods=30).fillna(0)

    # === BOOK 5 & 6: KUMO TWISTS, KAIRITSU, CLOUD MASS DENSITY ===
    twist_curr = np.sign(df['senkou_span_a'] - df['senkou_span_b']).diff().ne(0).astype(float)
    df['kumo_twist_curr'] = twist_curr
    twist_fwd = np.sign(df['senkou_span_a_raw'] - df['senkou_span_b_raw']).diff().ne(0).astype(float)
    df['kumo_twist_fwd'] = twist_fwd
    df['kumo_twist_flag'] = (df['kumo_twist_curr'].rolling(5).max() > 0).astype(float)

    # Kairitsu (Elasticity / Rubber Band)
    df['kairitsu'] = (df['Close'] - df['kijun_sen']) / df['kijun_sen']
    df['kairitsu_atr'] = (df['Close'] - df['kijun_sen']) / df['ATR']

    # Book 6: Cloud Mass Thickness & Volatility Expansion
    df['cloud_thickness'] = (df['senkou_span_a'] - df['senkou_span_b']).abs() / df['ATR']
    df['cloud_mass_score'] = np.tanh(df['cloud_thickness'])
    df['vol_expansion_ratio'] = df['ATR14'] / df['ATR']

    # === BOOKS 2, 3, 4: CAUSAL PIVOTS, WAVES, TARGETS & JIKAN CYCLES ===
    wave_dict = extract_causal_pivots_and_waves(df, swing_lookback=swing_lookback)
    for col, vals in wave_dict.items():
        df[col] = vals

    # Target Confluence Distance
    close_vals = df['Close'].values
    atr_vals = df['ATR'].values
    t_v = df['target_V'].values
    t_n = df['target_N'].values
    t_e = df['target_E'].values
    conf_dist = np.zeros(len(df))
    for i in range(len(df)):
        c = close_vals[i]
        a = atr_vals[i] if atr_vals[i] > 0 else 1.0
        dists = []
        if not np.isnan(t_v[i]): dists.append(abs(c - t_v[i]))
        if not np.isnan(t_n[i]): dists.append(abs(c - t_n[i]))
        if not np.isnan(t_e[i]): dists.append(abs(c - t_e[i]))
        conf_dist[i] = min(dists) / a if dists else 0.0
    df['target_confluence_dist'] = conf_dist
    df['time_price_confluence'] = df['kihon_suchi_score'] * np.exp(-np.clip(df['target_confluence_dist'], 0, 5))

    df['fwd_ret_1d'] = np.log(df['Close'].shift(-1) / df['Close'])
    return df
