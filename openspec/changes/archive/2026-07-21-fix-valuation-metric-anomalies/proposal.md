## Why

Currently, the `ValuationComposite` logic is compromised by severe normalization threshold flaws and multicollinearity among its 17 indicators. Metrik seperti `sharpe_ratio_52w` mengalami *flatline* karena asumsi threshold `[-20, 53]` yang mustahil secara historis, sementara `cvdd_ratio` dan `unrealized_sell_risk` memiliki rentang cacat asimetris. Selain itu, redundansi ekstrem seperti korelasi `-0.941` antara `terminal_price_ratio` dan `two_year_ma` membias bobot konsensus indikator. Terakhir, anomali ketersediaan data untuk `williams_r` menyebabkan hilangnya 87% data harian. Perubahan ini diperlukan untuk mengembalikan validitas, simetri normalisasi `[-2.0, +2.0]`, dan independensi sinyal `ValuationComposite`.

## What Changes

- **Threshold Calibration**: Merestorasi `t_minus_2`, `t_minus_1`, `t_plus_1`, dan `t_plus_2` untuk indikator yang asimetris atau *flatline* (`sharpe_ratio_52w`, `cvdd_ratio`, `unrealized_sell_risk`) agar memetakan rentang skor `[-2.0, +2.0]` secara tepat.
- **Data Imputation & Alignment**: Memperbaiki iterasi *forward-fill* mingguan ke harian untuk `williams_r` (dan indikator mingguan lainnya) sehingga tidak menghasilkan `NaN`.
- **Feature Pruning**: Menghapus salah satu dari pasangan indikator yang redundan ekstrem (korelasi > 0.90) dari `ValuationComposite` (misalnya membuang `aviv_nupl` karena identik dengan `aviv_ratio`).

## Capabilities

### New Capabilities

- `valuation-feature-pruning`: The methodology and requirements for identifying and dropping redundant metrics from the Valuation Composite.

### Modified Capabilities

- `valuation-be-calculation`: Requirements for threshold generation and data-imputation techniques applied prior to interpolation.

## Impact

- **Affected Code**: `quant-btc-valuation-system` Python codebase (`seed_metric_config.py` dan kelas-kelas komponen).
- **Systems Impacted**: Valuation System (1 of the 4 unified quantitative systems).
- **Dependencies**: Perbaikan akan memengaruhi database `maftia_quant.db` (nilai metrik akan direkalkulasi), yang selanjutnya memperbaiki akurasi laporan SDCA di Frontend tanpa mengubah *schema* REST API.

## Non-goals

- Merestrukturisasi indikator selain 17 indikator Valuation.
- Menambahkan indikator baru.
- Melakukan perubahan pada LTTD, MTTD, atau Ichimoku System.
- Menyentuh atau mengaktifkan kembali `quant-technical-indicator-bank`.
