import sqlite3
import math
from typing import List, Dict, Any, Optional

# --- Types ---

class DailyRecord:
    def __init__(self, date: str, close: float, valuation_composite: float = 0.0, price_ma200_ratio: float = 1.0, ath_drawdown: float = 0.0):
        self.date = date
        self.close = close
        self.valuation_composite = valuation_composite
        self.price_ma200_ratio = price_ma200_ratio
        self.ath_drawdown = ath_drawdown

# --- Thresholds ---

DEFAULT_SDCA_THRESHOLDS = {
    "buy_dca": 0.5,
    "buy_all": 1.0,
    "sell_dca": -1.0,
    "sell_all": -1.5,
    "buy_exit": 0.3,
    "sell_exit": -0.8,
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
    """Compute SDCA signals for entire dataset with FSM chronological state tracking."""
    from datetime import datetime
    signals = []

    # Merge dynamic thresholds
    t = merge_thresholds(thresholds)

    # FSM State variables
    state = "NEUTRAL"
    buy_all_fired = False

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

        # Get yesterday's values (t-1 causal lookup)
        if i > 0:
            prev_day = data[i - 1]
            comp_t1 = prev_day.valuation_composite
            price_t1 = prev_day.close
            ratio_t1 = getattr(prev_day, 'price_ma200_ratio', 1.0)
            drawdown_t1 = getattr(prev_day, 'ath_drawdown', 0.0)

            # Causal 30-day Price moving average
            sma_window = [data[idx].close for idx in range(max(0, i - 30), i)]
            sma30_t1 = sum(sma_window) / len(sma_window) if sma_window else price_t1

            # Check price/MA200 crossover for BUY_ALL
            if i > 1:
                prev_prev_day = data[i - 2]
                ratio_t2 = getattr(prev_prev_day, 'price_ma200_ratio', 1.0)
                # Cross above MA200: ratio crossed from < 1.0 to >= 1.0
                cross_above_ma200 = ratio_t2 < 1.0 and ratio_t1 >= 1.0
            else:
                cross_above_ma200 = False
        else:
            comp_t1 = 0.0
            price_t1 = 0.0
            ratio_t1 = 1.0
            drawdown_t1 = 0.0
            sma30_t1 = 0.0
            cross_above_ma200 = False

        # FSM State Transitions
        # Maintain previous state to implement transition hysteresis
        prev_state = state
        state = "NEUTRAL"

        # Check transition out of SELL zone
        in_sell_zone = False
        if prev_state in ("SELL_ALL", "SELL_DCA"):
            if comp_t1 <= t["sell_exit"]:
                in_sell_zone = True

        # Check transition out of BUY zone
        in_buy_zone = False
        if prev_state in ("BUY_ALL", "BUY_DCA"):
            if comp_t1 >= t["buy_exit"]:
                in_buy_zone = True

        # Reset buy_all_fired when composite goes negative (enters overvalued area)
        if comp_t1 < 0.0:
            buy_all_fired = False

        # 1. SELL_ALL Conditions (Highest priority exit)
        sell_all_trigger = (comp_t1 <= t["sell_all"] and ratio_t1 < 2.0 and drawdown_t1 >= 20.0 and price_t1 < sma30_t1)
        safety_net_trigger = (comp_t1 <= (t["sell_all"] - 0.5) and ratio_t1 < 1.0)

        if sell_all_trigger or safety_net_trigger:
            state = "SELL_ALL"
        # 2. SELL_DCA Conditions
        elif (comp_t1 <= t["sell_dca"] and ratio_t1 < 2.0 and price_t1 < sma30_t1) or (in_sell_zone and prev_state == "SELL_DCA"):
            state = "SELL_DCA"
        # 3. BUY_ALL Condition (Breakout bottom ending)
        elif comp_t1 >= t["buy_all"] and cross_above_ma200 and not buy_all_fired:
            state = "BUY_ALL"
        # 4. BUY_DCA Condition (Bottom confirmed)
        elif (comp_t1 >= t["buy_dca"] and ratio_t1 < 1.0) or (in_buy_zone and prev_state == "BUY_DCA"):
            state = "BUY_DCA"
        # 5. Fallback to NEUTRAL
        elif -0.5 < comp_t1 < 0.5:
            state = "NEUTRAL"
            
        # Action Determination based on current State and Cadence
        action = "HOLD"
        multiplier = 0.0
        
        if state == "SELL_ALL":
            action = "SELL_ALL"
            multiplier = -1.0  # -1.0 represents sell 100% remaining
        elif state == "SELL_DCA":
            if is_monday:
                action = "SELL_DCA"
                # Graduated weekly DCA percentages: 15% if comp <= -1.5, 8% if comp <= -1.0
                multiplier = -0.15 if comp_t1 <= -1.5 else -0.08
            else:
                action = "HOLD"
                multiplier = 0.0
        elif state == "BUY_ALL":
            action = "BUY_ALL"
            multiplier = 999.0  # Special multiplier code for BUY_ALL remaining cash
            buy_all_fired = True
            # Transition state to NEUTRAL after firing to prevent re-triggering
            state = "NEUTRAL"
        elif state == "BUY_DCA":
            if is_monday:
                action = "BUY_DCA"
                # Proportional weekly DCA multipliers:
                if comp_t1 >= 1.5:
                    multiplier = 3.0
                elif comp_t1 >= 1.0:
                    multiplier = 2.0
                else:
                    multiplier = 1.5
            else:
                action = "HOLD"
                multiplier = 0.0
        elif state == "NEUTRAL":
            # Normal DCA if composite is still positive (fair value) and it's Monday
            if is_monday and comp_t1 >= 0.5:
                action = "BUY_DCA"
                multiplier = 1.0
            else:
                action = "HOLD"
                multiplier = 0.0
                
        signals.append({
            "date": date_str,
            "multiplier": multiplier,
            "phase": state.lower(),
            "action": action,
            "confidence": "HIGH",
            "pricePercentile": ratio * 100.0, # UI compatibility mapping
            "price_ma200_ratio": ratio,
            "ath_drawdown": drawdown,
            "trendPositive": ratio >= 1.0
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
