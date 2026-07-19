import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('data/maftia_quant.db')
# Ambil data komponen
df = pd.read_sql_query("SELECT date, component_name, normalized_score FROM unified_component_signals WHERE system_source = 'VALUATION'", conn)

if df.empty:
    print("DATA KOSONG!")
    exit()

# Pivot table agar baris = tanggal, kolom = 17 indikator
pivot_df = df.pivot(index='date', columns='component_name', values='normalized_score')

print("="*50)
print("1. DATA INTEGRITY & AVAILABILITY AUDIT")
print("="*50)
print(f"Total Hari Data: {len(pivot_df)}")
print("\n[Metrik dengan Missing Values (>0%)]")
null_counts = pivot_df.isnull().sum()
print(null_counts[null_counts > 0].sort_values(ascending=False).to_string())

print("\n[Metrik yang 'Flatline' atau Rusak (Variansi Mendekati 0)]")
variances = pivot_df.var()
print(variances[variances < 0.1].to_string() if not variances[variances < 0.1].empty else "Tidak ada metrik flatline.")

print("\n[Rentang Normalisasi (Harusnya -2.0 s/d +2.0)]")
stats = pivot_df.agg(['min', 'max', 'mean']).T
print(stats.to_string())

print("\n"+"="*50)
print("2. HIDDEN PATTERNS: MULTICOLLINEARITY (REDUNDANCY)")
print("="*50)
print("Metrik yang korelasinya > 0.85 (Sinyal tumpang tindih / redundant):")
corr = pivot_df.corr()
high_corr = []
for i in range(len(corr.columns)):
    for j in range(i+1, len(corr.columns)):
        if abs(corr.iloc[i, j]) > 0.85:
            high_corr.append((corr.columns[i], corr.columns[j], corr.iloc[i, j]))

high_corr.sort(key=lambda x: abs(x[2]), reverse=True)
if high_corr:
    for c1, c2, val in high_corr:
        print(f"⚠️ {c1} <--> {c2}: {val:.3f}")
else:
    print("Tidak ada redundansi ekstrem (>0.85).")

conn.close()
