import sqlite3
import math
from typing import List, Dict, Any, Optional

# --- Types ---

class DailyRecord:
    def __init__(self, date: str, close: float, valuation_composite: float = 0.0):
        self.date = date
        self.close = close
        self.valuation_composite = valuation_composite

# --- Thresholds ---

DEFAULT_SDCA_THRESHOLDS = {
    "buy_threshold": 0.5,
    "sell_threshold": -1.5,
    "price_pct_buy": 30.0,
    "price_pct_sell": 75.0,
    "extended_discount_days": 25,
}

def merge_thresholds(overrides: Optional[Dict[str, float]] = None) -> Dict[str, float]:
    if not overrides:
        return DEFAULT_SDCA_THRESHOLDS.copy()
    
    t = DEFAULT_SDCA_THRESHOLDS.copy()
    if "buy_threshold" in overrides:
        t["buy_threshold"] = max(0.0, min(2.0, overrides["buy_threshold"]))
    if "sell_threshold" in overrides:
        t["sell_threshold"] = max(-2.0, min(0.0, overrides["sell_threshold"]))
    if "price_pct_buy" in overrides:
        t["price_pct_buy"] = max(10.0, min(50.0, overrides["price_pct_buy"]))
    if "price_pct_sell" in overrides:
        t["price_pct_sell"] = max(50.0, min(95.0, overrides["price_pct_sell"]))
    if "extended_discount_days" in overrides:
        try:
            t["extended_discount_days"] = max(10, min(60, int(overrides["extended_discount_days"])))
        except (ValueError, TypeError):
            pass
    
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

def compute_sdca_signal(data: List[DailyRecord], day_index: int, thresholds: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Compute SDCA signal for a given day (t-1 causal filtering)."""
    t = merge_thresholds(thresholds)
    
    day = data[day_index]
    closes = [d.close for d in data]
    composites = [d.valuation_composite for d in data]
    
    # t-1 Causal Enforcement
    composite_t1 = composites[day_index - 1] if day_index > 0 else 0.0
    composite_t2 = composites[day_index - 2] if day_index > 1 else composite_t1
    
    price_pct = calculate_price_percentile(closes, day_index)
    trend = calculate_composite_trend(composites, day_index)
    
    multiplier = sdca_multiplier(composite_t1)
    phase = detect_phase(composite_t1, price_pct, trend)
    
    consecutive_days_below_neg05 = 0
    for i in range(day_index - 1, -1, -1):
        if composites[i] < -0.5:
            consecutive_days_below_neg05 += 1
        else:
            break
            
    action = determine_action(
        composite_t1,
        composite_t2,
        price_pct,
        trend,
        consecutive_days_below_neg05,
        t
    )
    
    confidence = calculate_regime_confidence(composites, closes, day_index)
    
    return {
        "date": day.date,
        "multiplier": multiplier,
        "phase": phase,
        "action": action,
        "confidence": confidence,
        "pricePercentile": price_pct,
        "trendPositive": trend
    }

def compute_sdca_signals(data: List[DailyRecord], thresholds: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
    """Compute SDCA signals for entire dataset (vectorized)."""
    t = merge_thresholds(thresholds)
    return [compute_sdca_signal(data, i, t) for i in range(len(data))]
