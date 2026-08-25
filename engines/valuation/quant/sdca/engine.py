import sqlite3
import math
from typing import List, Dict, Any, Optional

# --- Types ---

class DailyRecord:
    def __init__(
        self,
        date: str,
        close: float,
        valuation_composite: float = 0.0,
        lttd_regime: str = "SIDEWAYS",
        lttd_prob_bull: float = 0.0,
        lttd_prob_sideways: float = 0.0,
        lttd_target_exposure: float = 0.0,
        mttd_imo: float = 0.0,
        mttd_position: float = 0.0,
        mttd_er: float = 0.0,
        mttd_entropy: float = 2.0,
        ichimoku_imo: float = 0.0,
        ichimoku_position: float = 0.0,
        price_ma200_ratio: float = 1.0,
        ath_drawdown: float = 0.0
    ):
        self.date = date
        self.close = close
        self.valuation_composite = valuation_composite
        self.lttd_regime = lttd_regime
        self.lttd_prob_bull = lttd_prob_bull
        self.lttd_prob_sideways = lttd_prob_sideways
        self.lttd_target_exposure = lttd_target_exposure
        self.mttd_imo = mttd_imo
        self.mttd_position = mttd_position
        self.mttd_er = mttd_er
        self.mttd_entropy = mttd_entropy
        self.ichimoku_imo = ichimoku_imo
        self.ichimoku_position = ichimoku_position
        self.price_ma200_ratio = price_ma200_ratio
        self.ath_drawdown = ath_drawdown

# --- Thresholds ---

DEFAULT_SDCA_THRESHOLDS = {
    "dca_in_start": 1.7,
    "all_in_val": 1.25,
    "dca_out_start": -1.7,
    "all_out_val": 0.4,
    "buy_dca": 0.5,
    "buy_all": 1.0,
    "sell_dca": -1.0,
    "sell_all": -1.5,
}

def merge_thresholds(overrides: Optional[Dict[str, float]] = None) -> Dict[str, float]:
    if not overrides:
        return DEFAULT_SDCA_THRESHOLDS.copy()

    t = DEFAULT_SDCA_THRESHOLDS.copy()
    for k in DEFAULT_SDCA_THRESHOLDS:
        if k in overrides:
            t[k] = float(overrides[k])
    return t

# --- Core Logic ---

def sdca_multiplier(composite: float) -> float:
    """Maps valuation_composite to DCA allocation multiplier."""
    if composite >= 1.5: return 3.0
    if composite >= 1.0: return 2.0
    if composite >= 0.5: return 1.5
    if composite > -0.5: return 1.0
    if composite > -1.0: return 0.5
    if composite > -1.5: return 0.0
    return -0.5

def detect_phase(composite: float, price_percentile: float, trend_positive: bool) -> str:
    """Classifies market phase."""
    if composite >= 1.0 and price_percentile < 30 and trend_positive:
        return "deep_discount"
    if composite <= -1.0 and price_percentile > 75 and not trend_positive:
        return "euphoria"
    if composite >= 0.5 and price_percentile < 40:
        return "value"
    if composite <= -0.5 and price_percentile > 60:
        return "expansion"
    return "fair"

def calculate_price_percentile(all_prices: List[float], current_index: int, window_size: int = 365) -> float:
    """Calculate price percentile within a rolling window (causal: uses data up to t-1)."""
    start = max(0, current_index - window_size)
    window_prices = all_prices[start:current_index]
    
    if not window_prices:
        return 50.0
        
    current_price = all_prices[current_index]
    below_count = sum(1 for p in window_prices if p < current_price)
    
    return (below_count / len(window_prices)) * 100.0

def calculate_composite_trend(composites: List[float], current_index: int) -> bool:
    """Calculate composite trend: true if 7-day average > 30-day average."""
    valid_composites = composites[:current_index]
    
    if len(valid_composites) < 30:
        return True
        
    recent7 = valid_composites[-7:]
    recent30 = valid_composites[-30:]
    
    avg7 = sum(recent7) / len(recent7)
    avg30 = sum(recent30) / len(recent30)
    
    return avg7 > avg30

def determine_action(
    current_composite: float, 
    prev_composite: float, 
    price_percentile_val: float, 
    trend_positive: bool, 
    consecutive_days_below_neg05: int, 
    thresholds: Dict[str, float]
) -> str:
    """Determine SDCA action."""
    
    # Entry: START_AGGRESSIVE_DCA
    if (prev_composite <= thresholds["buy_threshold"] and 
        current_composite > thresholds["buy_threshold"] and 
        price_percentile_val < thresholds["price_pct_buy"] and 
        trend_positive):
        return "START_AGGRESSIVE_DCA"
        
    # Aggressive exit: SELL_ALL
    if current_composite <= thresholds["sell_threshold"]:
        return "SELL_ALL"
        
    # Gradual exit: REDUCE_POSITION
    if (prev_composite >= -0.5 and 
        current_composite < -0.5 and 
        price_percentile_val > thresholds["price_pct_sell"]):
        return "REDUCE_POSITION"
        
    # Extended overvaluation: REDUCE_POSITION
    if (current_composite < -0.5 and 
        consecutive_days_below_neg05 > thresholds["extended_discount_days"]):
        return "REDUCE_POSITION"
        
    # Normal DCA
    if current_composite >= thresholds["buy_threshold"]:
        return "NORMAL_DCA"
        
    return "HOLD"

def calculate_regime_confidence(composites: List[float], prices: List[float], current_index: int) -> str:
    """Compute regime confidence."""
    valid_composites = composites[:current_index]
    valid_prices = prices[:current_index]
    
    if len(valid_composites) < 90:
        return "HIGH"
        
    last90 = valid_composites[-90:]
    sign_changes = 0
    for i in range(1, len(last90)):
        prev_sign = 1 if last90[i-1] > 0 else (-1 if last90[i-1] < 0 else 0)
        curr_sign = 1 if last90[i] > 0 else (-1 if last90[i] < 0 else 0)
        
        if prev_sign != curr_sign and prev_sign != 0 and curr_sign != 0:
            sign_changes += 1
            
    if sign_changes > 3:
        return "LOW"
        
    if len(valid_composites) >= 180:
        last180 = valid_composites[-180:]
        all_below_neg1 = all(c < -1.0 for c in last180)
        
        if all_below_neg1 and len(valid_prices) >= 2:
            price_start = valid_prices[-180] if len(valid_prices) >= 180 else valid_prices[0]
            price_end = valid_prices[-1]
            price_drop = (price_start - price_end) / price_start if price_start > 0 else 0
            
            if price_drop < 0.2:
                return "LOW"
                
    return "HIGH"

def compute_sdca_signals(data: List[DailyRecord], thresholds: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
    """Compute SDCA signals for entire dataset using 4-State Cycle Rotation Hysteresis FSM."""
    from datetime import datetime
    signals = []

    # Merge dynamic thresholds
    t = merge_thresholds(thresholds)

    dca_in_start = t.get("dca_in_start", 1.7)
    all_in_val = t.get("all_in_val", 1.25)
    dca_out_start = t.get("dca_out_start", -1.7)
    all_out_val = t.get("all_out_val", 0.4)

    current_state = "OUT_ALL"

    for i in range(len(data)):
        day = data[i]
        date_str = day.date
        price = day.close
        comp = day.valuation_composite
        ratio = getattr(day, 'price_ma200_ratio', 1.0)
        drawdown = getattr(day, 'ath_drawdown', 0.0)

        # Parse today's weekday
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            is_monday = dt.weekday() == 0
        except Exception:
            is_monday = False

        comp_t1 = data[i - 1].valuation_composite if i > 0 else 0.0

        prev_state = current_state

        # State machine transition evaluation using t-1 causal composite
        if current_state == "OUT_ALL":
            if comp_t1 >= dca_in_start:
                current_state = "DCA_IN"
        elif current_state == "DCA_IN":
            if comp_t1 <= all_in_val:
                current_state = "ALL_IN"
        elif current_state == "ALL_IN":
            if comp_t1 <= dca_out_start:
                current_state = "DCA_OUT"
        elif current_state == "DCA_OUT":
            if comp_t1 >= all_out_val:
                current_state = "OUT_ALL"

        is_transition = current_state != prev_state

        action = "HOLD"
        multiplier = 0.0
        phase = "neutral"

        if current_state == "ALL_IN":
            phase = "buy_all"
            if is_transition:
                action = "BUY_ALL"
                multiplier = 999.0
            else:
                action = "HOLD"
                multiplier = 0.0
        elif current_state == "DCA_IN":
            phase = "buy_dca"
            if is_transition or is_monday:
                action = "BUY_DCA"
                multiplier = 2.0
            else:
                action = "HOLD"
                multiplier = 0.0
        elif current_state == "DCA_OUT":
            phase = "sell_dca"
            if is_transition or is_monday:
                action = "SELL_DCA"
                multiplier = -0.15
            else:
                action = "HOLD"
                multiplier = 0.0
        elif current_state == "OUT_ALL":
            if is_transition:
                phase = "sell_all"
                action = "SELL_ALL"
                multiplier = -1.0
            else:
                phase = "neutral"
                action = "HOLD"
                multiplier = 0.0

        signals.append({
            "date": str(date_str),
            "multiplier": float(multiplier),
            "phase": str(phase),
            "action": str(action),
            "confidence": "HIGH",
            "pricePercentile": float(ratio * 100.0),
            "price_ma200_ratio": float(ratio),
            "ath_drawdown": float(drawdown),
            "trendPositive": bool(ratio >= 1.0)
        })

    return signals

def compute_sdca_signal(data: List[DailyRecord], day_index: int, thresholds: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Compute SDCA signal for a given day (t-1 causal filtering)."""
    signals = compute_sdca_signals(data, thresholds)
    if 0 <= day_index < len(signals):
        return signals[day_index]
    return {
        "date": data[day_index].date if day_index < len(data) else "",
        "multiplier": 0.0,
        "phase": "neutral",
        "action": "HOLD",
        "confidence": "LOW",
        "pricePercentile": 50.0,
        "price_ma200_ratio": 1.0,
        "ath_drawdown": 0.0,
        "trendPositive": True
    }
