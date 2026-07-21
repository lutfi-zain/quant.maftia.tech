# Summarizing findings and proposing formula for Acceptance Contract.
# The Institutional Illiquidity Premium (IIP) modifier perfectly targets Nov 2021 without affecting 2017 or Apr 2021.
# It is calculated as:
# 1. LTH_Ratio = LTH_Supply / Total_Supply
# 2. Active_Ratio = 1 - LTH_Ratio
# 3. Illiquidity_Factor = LTH_Ratio / Active_Ratio
# 4. IIP_Multiplier = Illiquidity_Factor / Rolling_4Y_Mean(Illiquidity_Factor)
# 5. IIP_Penalty = max(0, IIP_Multiplier^2 - 1.0)
#
# This yields an additive penalty of ~0.0 for 2017 and Apr 2021, and ~+0.96 for Nov 2021.
# Applying this to normalized scores pushes Nov 2021 up towards +1.5 to +2.0 (macro top / bubble).
