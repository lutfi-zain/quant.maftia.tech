## Why

Dua masalah sistemik teridentifikasi pada strategi SDCA:

1. **Sinyal SELL yang cacat secara fundamental**: Sinyal SELL (berdasarkan `composite <= -1.5`) secara historis muncul saat pertengahan bull run, bukan di puncak siklus. Saat harga sedang melesat naik dengan kuat, indikator oscillator secara matematis menjadi sangat *overbought* (`-2.0`). Menjual di titik ini menghilangkan profit besar dari *parabolic phase*. Misalnya di 2017, SELL sinyal muncul di harga $4.100, padahal harga terus naik hingga $19.000.
2. **Keluarnya terlalu cepat (Front-running)**: Tidak adanya konsep keluar bertahap berdasarkan momentum siklus membuat model ini keluar 100% pada satu hari tertentu. Hal ini terbukti dengan simulasi di mana rata-rata BTC terjual terlalu dini sebelum *second leg* dalam siklus.

## What Changes

Strategi SDCA diubah total menjadi **6-State Machine Lifecycle** yang mereplikasi "Dollar Cost Averaging" institusional, dengan parameter pemicu (*triggers*) yang berpusat pada rasio `Price / MA200` (bukan sekadar `composite` mentah).

**Siklus Accumulation (BUY):**

- **BUY_DCA (Bottom Confirmed)**: Saat *undervalued* (`composite >= 1.0`) DAN harga belum menembus MA200 (`price < MA200`), lakukan pembelian DCA bertahap secara **mingguan** (*weekly*).
- **BUY_ALL (Bottom Ending / Breakout)**: Saat momentum berbalik arah (harga memotong naik menembus MA200) sementara aset masih di area zona murah (`composite > 0.5`), gunakan sisa ekuitas 100% untuk memborong, mencegah portofolio ketinggalan laju naik (*missing the train*).

**Siklus Distribution (SELL):**

- **SELL_DCA (Top Forming)**: Saat aset mulai mahal (`composite <= -1.0`) namun momentum masih tinggi (`price/MA200 ratio < 2.0`), lakukan penjualan sebagian secara **mingguan** (misalnya 8% per minggu saat -1.0, 15% per minggu saat -1.5). Ini memastikan tidak terjual habis secara prematur.
- **SELL_ALL (Cycle Peaked)**: Menjual sisa posisi 100% SECARA FINAL hanya bila 3 kondisi terpenuhi: aset sangat *overvalued* (`composite <= -1.5`), momentum mereda / terkompresi (`price/MA200 ratio < 2.0`), dan tren menukik (drawdown > 20% dari ATH).

## Capabilities

### New Capabilities

- `sdca-lifecycle-engine`: Implementasi State Machine 6-Fase untuk mengatur transisi logika antara HOLD, BUY_DCA, BUY_ALL, SELL_DCA, SELL_ALL.
- `sdca-weekly-cadence`: Enforces eksekusi SDCA dalam ritme mingguan (bukan harian) agar akumulasi/distribusi tidak terekskusi terlalu instan.

### Modified Capabilities

- `valuation-be-calculation`: Indikator rasio Price/MA200 serta tracking Drawdown ATH diintegrasikan ke *data pipeline* harian agar tersedia di `unified_daily_analytics`.
- `studio-trading-terminals`: Panel *Valuation Studio* diubah untuk menampilkan tahapan fase `Lifecycle State` SDCA dan rasio krusial `Price / MA200`.

## Impact

- **Affected Code**: Logika determinasi aksi di `engines/valuation/quant/sdca/engine.py`, logika *backtest continuous* di `scripts/calculate_sdca_backtest.py`, penyelarasan tabel SQL pada `run_report_pipeline.py`.
- **Systems Impacted**: Valuation System (SDCA Engine), Master SQL Pipeline, Frontend Dashboard.
- **Dependencies**: Perlu simulasi Walk-Forward dan Backtesting pada rentang siklus lengkap (2014-2021 untuk *training*, 2021-2026 untuk *testing*).

## Non-goals

- Mengubah 14 indikator fundamental pembentuk composite.
- Re-introducing `quant-technical-indicator-bank`.
- Sinyal posisi trading LTTD / MTTD.
