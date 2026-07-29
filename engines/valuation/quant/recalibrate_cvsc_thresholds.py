import sys
import os
import pandas as pd
import numpy as np

sys.path.insert(0, "/home/ubuntu/projects/quant.maftia.tech/engines/valuation")

from quant.components.ahr999_cvsc import Ahr999CvscComponent
from quant.components.mvrv_z_cvsc import MvrvZCvscComponent
from quant.components.pi_cycle_top_cvsc import PiCycleTopCvscComponent
from quant.components.risk_metrics_cvsc import RiskMetricsCvscComponent
from quant.components.two_year_ma_rcap import TwoYearMaRcapComponent
from quant.components.vpli_cvsc import VpliCvscComponent

COMPONENTS = [
    ("ahr999_cvsc", Ahr999CvscComponent),
    ("mvrv_z_cvsc", MvrvZCvscComponent),
    ("pi_cycle_top_cvsc", PiCycleTopCvscComponent),
    ("risk_metrics_cvsc", RiskMetricsCvscComponent),
    ("two_year_ma_rcap", TwoYearMaRcapComponent),
    ("vpli_cvsc", VpliCvscComponent),
]

def main():
    print("=== RECALIBRATING CVSC METRIC THRESHOLDS ===")
    recalibrated = {}
    
    for metric_name, comp_cls in COMPONENTS:
        print(f"\nProcessing {metric_name}...")
        comp = comp_cls()
        df = comp.fetch_data(full_rebuild=True)
        if df.empty or 'raw_value' not in df.columns:
            print(f"FAILED: No data for {metric_name}")
            continue
        
        raws = df['raw_value'].dropna()
        if len(raws) < 100:
            print(f"FAILED: Insufficient records ({len(raws)}) for {metric_name}")
            continue
            
        p2_5 = float(np.percentile(raws, 2.5))
        p25 = float(np.percentile(raws, 25.0))
        p75 = float(np.percentile(raws, 75.0))
        p97_5 = float(np.percentile(raws, 97.5))
        
        print(f"  Count: {len(raws)} days")
        print(f"  Raw value range: [{raws.min():.6e}, {raws.max():.6e}]")
        print(f"  Percentiles -> p2.5: {p2_5:.6e}, p25: {p25:.6e}, p75: {p75:.6e}, p97.5: {p97_5:.6e}")
        
        # Determine direction based on raw metric type:
        # For normal direction: lower raw value = cycle bottom (+2), higher raw value = cycle top (-2)
        # So t_plus_2 = p2.5, t_plus_1 = p25, t_minus_1 = p75, t_minus_2 = p97.5
        # Exception: two_year_ma_rcap (if inverted, adjust accordingly).
        
        t_plus_2 = p2_5
        t_plus_1 = p25
        t_minus_1 = p75
        t_minus_2 = p97_5
        
        recalibrated[metric_name] = (t_plus_2, t_plus_1, None, t_minus_1, t_minus_2, 'expanding_window')
        print(f"  ('metric_name', {t_plus_2:.6e}, {t_plus_1:.6e}, None, {t_minus_1:.6e}, {t_minus_2:.6e}, 'expanding_window')")

    print("\n=== RECALIBRATED SEED DATA SUMMARY ===")
    for metric_name, tuple_val in recalibrated.items():
        tp2, tp1, tzero, tm1, tm2, rescale = tuple_val
        print(f"    ('{metric_name}', {tp2:.6e}, {tp1:.6e}, None, {tm1:.6e}, {tm2:.6e}, '{rescale}'),")

if __name__ == '__main__':
    main()
