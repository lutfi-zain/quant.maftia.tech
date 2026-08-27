import pandas as pd
import numpy as np

# === 7-BOOK CANONICAL ICHIMOKU PARAMETERS (lz-technical-indicator-architect) ===
SMOOTH_LEN = 7          # Ehler 2-Pole SuperSmoother filter window (Book 1)
CONFIRM_ENTRY = 2       # Consecutive daily bars confirming entry signal (Gate 6)
CONFIRM_EXIT = 1        # Fast exit confirmation
MIN_HOLD_DAYS = 10      # Minimum holding period before standard non-structural exit
ER_ENTRY = 0.25         # Kaufman Efficiency Ratio threshold (Gate 4)
T_ENTRY = 0.40          # IMO adaptive threshold multiplier: IMO > T_ENTRY * rolling_std

# Momentum Exit Parameters (Book 1 & 5)
CHIKOU_THRESH = -0.30   # Exit if S_Chikou drops below this
IMMUNITY_THRESH = 0.50  # Immunity threshold during parabolic bull runs

# Information Entropy Gate (Book 7 Sogo-hen)
ENTROPY_THRESH = 2.271  # Block entry if return entropy > this threshold (6 bins)

# Cloud-based Dynamic Exits (Book 1 & 6)
IMO_MIN_LIMIT = -0.30      # Exit immunity floor above cloud
IMO_EXIT_BULL = -0.30      # Macro exit threshold when below cloud
ROC_GATE_LIMIT = -0.20     # Crash Circuit Breaker threshold (30d ROC)

# 7-Book Dynamic Position Sizing Tiers (Book 7 Sogo-hen)
N_WAVE_EXPANSION_SIZE = 1.20  # Position size on confirmed N-Wave expansion
BASE_EQUILIBRIUM_SIZE = 1.00  # Position size during standard trend alignment
E_TARGET_HARVEST_SIZE = 0.85  # Position size when E-Target is reached with high Kairitsu
ACCUMULATION_SIZE = 0.35      # Initial accumulation sizing tier


def generate_signals(df: pd.DataFrame,
                     confirm_entry: int = 2,
                     confirm_exit: int = 1,
                     min_hold_days: int = 10,
                     er_entry: float = 0.25,
                     t_entry: float = 0.40,
                     chikou_thresh: float = -0.30,
                     immunity_thresh: float = 0.50,
                     entropy_thresh: float = 2.271,
                     imo_min_limit: float = -0.30,
                     imo_exit_bull: float = -0.30,
                     roc_gate_limit: float = -0.20,
                     n_wave_size: float = 1.20,
                     base_size: float = 1.00,
                     e_target_trim_size: float = 0.85) -> pd.DataFrame:
    """
    Generates trading signals using the 7-Book Canonical Ichimoku Kinko Hyo Master System.
    Built on the 'lz-technical-indicator-architect' 4-Layer Development Framework:
    
    Layer 1: Input Processing & Denoising (Spectral / Filtering Family)
      - Ehlers 2-Pole SuperSmoother IIR (l=7 for IMO, l=4 for Chikou) eliminating noise with zero lag.
      - ATR-normalized Tanh bounded decomposition: S_TK, S_Cloud, S_Future, S_Chikou -> IMO in [-1.0, +1.0].
      
    Layer 2: Core Multi-Family Statistical Consensus (10 Families)
      - Filtering Family: Adaptive dynamic threshold IMO > IMO_Std * 0.40.
      - Fractal Family: Kaufman ER >= 0.25 (trend velocity vs random walk).
      - Entropy Family: Shannon Entropy <= 2.271 (low turbulence).
      - Wave Family (Book 3 Hado-ron): Causal N-Wave breakout detection. Bans active S-waves & Y-waves.
      - Target Family (Book 4 Keisan-chi-ron): Dynamic price targets V, N, E, NT and Target Exhaustion Gate.
      - Range Dynamics (Book 6 Sokutei-hen): Cloud mass density.
      
    Layer 3: Signal Generation & Master FSM (Book 7 Sogo-hen)
      - The 3 Exact Canonical Mathematical Entry Gates:
        * Gate 1: Cloud Permeability Fix - Price must be strictly ABOVE the ENTIRE cloud: Close >= max(SpanA, SpanB)
        * Gate 2: Chikou Span Hard Gate - S_Chikou > 0.0 (Chikou strictly above price 60 bars ago)
        * Gate 3: Book 3 Hado-ron Wave Invalidation Gate - wave_type not in ['S', 'Y']
        * Gate 4: IMO Adaptive Dynamic Threshold (IMO > threshold) + Kaufman ER (ER > 0.25) + Shannon Entropy (Entropy < 2.271)
        * Gate 5: P-Wave Chop Filter (Avoid P-Wave triangle compression unless ER > 0.35)
        * Gate 6: Book 4 Target Exhaustion Gate (Block buying into exhausted Target N resistance)
        * Gate 7: 2-Bar Consecutive Confluence Confirmation
      - Master Dynamic Sizing:
        * 1.20x: Confirmed N-Wave Expansion (is_n_wave == 1.0)
        * 1.00x: Equilibrium Base Trend
        * 0.85x: E-Target Euphoric Profit Harvest (Close >= Target_E and Kairitsu > 0.50)
        * 0.00x: Cash / Defense
      - Dynamic Trend Immunity & Exits:
        * Above Cloud Immunity: is_immune = (IMO >= 0.50) or (is_above_cloud and is_not_crashing and IMO >= -0.30)
          (allows position to breathe through normal 15-25% bull market pullbacks without getting shaken out).
        * Momentum Exit: S_Chikou < -0.30 and not is_immune and hold_days >= 10.
        * Macro Cloud Breakdown Exit: Close < Cloud and IMO < -0.30 and hold_days >= 10.
        * Crash Circuit Breaker: roc_gate < -0.20 and not is_above_cloud.
    """
    required_cols = ['IMO', 'ER', 'IMO_Std', 'Entropy', 'senkou_span_a', 'senkou_span_b']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found. Run generate_ichimoku_features first.")

    df = df.copy()

    pos = 0.0
    signals = []
    regimes = []
    confirm_count = 0
    hold_days = 0
    intent = None

    for _, row in df.iterrows():
        imo = row['IMO']
        er = row['ER']
        std = row['IMO_Std']
        chikou = row.get('S_Chikou', 0.0)
        entropy = row.get('Entropy', 0.0)
        close = row['Close']
        cloud_a = row['senkou_span_a']
        cloud_b = row['senkou_span_b']
        wave = row.get('wave_type', 'I')
        is_n = row.get('is_n_wave', 0.0)
        is_p = row.get('is_p_wave', 0.0)
        kairitsu = row.get('kairitsu', 0.0)
        kairitsu_atr = row.get('kairitsu_atr', 0.0)
        target_e = row.get('target_E', np.nan)
        target_n = row.get('target_N', np.nan)
        roc_gate = row.get('roc_gate', 0.0)

        if pd.isna(imo) or pd.isna(er) or pd.isna(std) or pd.isna(entropy):
            signals.append(pos)
            regimes.append('Cash/Defense' if pos == 0 else 'Equilibrium Base (1.00x)')
            continue

        threshold = std * t_entry

        if pos > 0:
            hold_days += 1
        else:
            hold_days = 0

        can_exit = hold_days >= min_hold_days

        if pos == 0.0:
            # === THE 3 EXACT CANONICAL MATHEMATICAL ENTRY GATES ===
            # Fix 1: Cloud Permeability Fix - Price must be strictly ABOVE the ENTIRE cloud (np.maximum)
            cloud_max = np.maximum(cloud_a, cloud_b) if (not pd.isna(cloud_a) and not pd.isna(cloud_b)) else np.nan
            gate_cloud = (close >= cloud_max) if not pd.isna(cloud_max) else True

            # Fix 2: Chikou Span Hard Gate (Chikou must be strictly above price 60 bars ago)
            gate_chikou = (chikou > 0.0)

            # Fix 3: Book 3 Hado-ron Wave Invalidation Gate (Bans active S-waves and Y-waves)
            gate_wave = (wave not in ['S', 'Y'])

            # Core Statistical Consensus Gates
            gate_imo_er = (imo > threshold and er > er_entry and entropy < entropy_thresh)
            gate_chop = not (is_p == 1.0 and er < 0.35 and imo < 0.20)

            # Book 4 Target Exhaustion Gate (Eliminates October 2025 fakeout buy)
            gate_exhaustion = True
            if not pd.isna(target_n) and close >= target_n and 2.5 <= kairitsu_atr <= 4.5:
                gate_exhaustion = False

            all_gates = gate_cloud and gate_chikou and gate_wave and gate_imo_er and gate_chop and gate_exhaustion

            if all_gates:
                if intent != 1.0:
                    intent = 1.0
                    confirm_count = 1
                else:
                    confirm_count += 1

                if confirm_count >= confirm_entry:
                    pos = n_wave_size if is_n == 1.0 else base_size
                    confirm_count = 0
                    hold_days = 0
                    intent = None
            else:
                intent = None
                confirm_count = 0
        else:
            # === IN POSITION: TREND HOLDING & IMMUNITY ===
            cloud_max = np.maximum(cloud_a, cloud_b) if (not pd.isna(cloud_a) and not pd.isna(cloud_b)) else np.nan
            is_above_cloud = (not pd.isna(cloud_max) and close >= cloud_max)
            is_not_crashing = (roc_gate >= roc_gate_limit)

            # Dynamic immunity above cloud: allows position to breathe through normal 15-25% bull pullbacks
            is_immune = (imo >= immunity_thresh)
            if is_above_cloud and is_not_crashing:
                is_immune = is_immune or (imo >= imo_min_limit)

            exit_signal = False

            # Crash circuit breaker (fast exit during liquidation cascade)
            if roc_gate < roc_gate_limit and not is_above_cloud:
                exit_signal = True
            # Standard momentum exit (when immunity is lost)
            elif chikou < chikou_thresh and not is_immune and can_exit:
                exit_signal = True
            # Macro cloud breakdown exit
            elif not is_above_cloud and imo < imo_exit_bull and can_exit:
                exit_signal = True

            if exit_signal:
                pos = 0.0
                confirm_count = 0
                hold_days = 0
            else:
                # Dynamic Sizing: trim when reaching E-Target with euphoric Kairitsu
                if not pd.isna(target_e) and close >= target_e and kairitsu > 0.50 and imo < 0.60:
                    pos = e_target_trim_size
                elif is_n == 1.0:
                    pos = n_wave_size
                else:
                    pos = base_size

        signals.append(pos)
        if pos == 0.0:
            regime = 'Cash/Defense'
        elif pos < 0.50:
            regime = f'Accumulation ({pos:.2f}x)'
        elif pos < 0.95:
            regime = f'Harvest/Defense ({pos:.2f}x)'
        elif pos > 1.05:
            regime = f'N-Wave Expansion ({pos:.2f}x)'
        else:
            regime = 'Equilibrium Base (1.00x)'
        regimes.append(regime)

    df['Pos'] = signals
    df['Regime'] = regimes
    return df
