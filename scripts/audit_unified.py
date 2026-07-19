import sqlite3
import pandas as pd

conn = sqlite3.connect('data/maftia_quant.db')
df = pd.read_sql_query("SELECT * FROM unified_daily_analytics", conn)

print("="*50)
print("AUDIT UNIFIED DAILY ANALYTICS")
print("="*50)
print(f"Total Rows: {len(df)}")
print("\n[Missing Values / NULLs]")
nulls = df.isnull().sum()
print(nulls[nulls > 0].to_string())

print("\n[SDCA Variables Check]")
if 'sdca_multiplier' in df.columns:
    print(df[['sdca_multiplier', 'sdca_phase', 'sdca_action', 'sdca_confidence']].describe(include='all').T.to_string())
else:
    print("SDCA columns not found!")
    
conn.close()
