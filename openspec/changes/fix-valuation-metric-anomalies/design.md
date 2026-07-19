## Context

Telah diidentifikasi melalui audit data historis bahwa 4 dari 17 indikator pada `quant-btc-valuation-system` menghasilkan skor normalisasi yang bias atau gagal. `sharpe_ratio_52w` mengalami *flatline*, `cvdd_ratio` dan `unrealized_sell_risk` memiliki batas *threshold* asimetris (sehingga sisi *bubble* atau sisi *discount*-nya tak terjangkau), dan `williams_r` kehilangan 87% data harian karena kegagalan *forward-fill* saat *join* dataset mingguan dengan harian. Lebih jauh, `aviv_nupl` menunjukkan kolinearitas ekstrem dengan `aviv_ratio` (0.923), mencemari bobot *ValuationComposite*.

## Goals / Non-Goals

**Goals:**

- Menghapus multikolinearitas struktural dengan melakukan *feature pruning* (membuang `aviv_nupl` dan menonaktifkan `williams_r` jika imputasi data tidak dimungkinkan).
- Merestorasi `metric_config` ke batas wajar matematis `[-2.0, +2.0]`.
- Menerapkan iterasi *forward-fill* (`ffill()`) ke data seri `williams_r` (`price_ohlc` mingguan) agar sinkron dengan baris *daily* `master_ohlcv`.

**Non-Goals:**

- Merombak algoritma *SuperSmoother IIR* di Ichimoku atau sistem MTTD.
- Menganalisis sisa 13 indikator yang saat ini dinilai stabil.
- Membangun UI/Visual baru di frontend.

## Decisions

- **Tuning SQLite Threshold di Seed Script**: Parameter `[t_minus_2, t_minus_1, t_plus_1, t_plus_2]` akan di-update di `seed_metric_config.py`.
  - *Rationale*: Daripada *hardcode* di *engine* normalisasi, konfigurasi *seed* dipertahankan karena memelihara prinsip arsitektur `database-driven`.
- **Pandas `ffill()` untuk Williams %R**: Pandas *dataframe* pada metode `fetch_data` di `williams_r.py` akan diindeks ulang ke penanggalan harian (*daily date range*) menggunakan `ffill()`.
  - *Rationale*: Pendekatan klasik *time-series* untuk menghindari *lookahead bias* dalam menangani dataset deret waktu diskrit yang frekuensinya lebih lambat dari baris induknya.
- **Pruning `aviv_nupl` dari Pipeline Rata-Rata**: Komponen ini akan dihapus dari kueri di `run_report_pipeline.py`.
  - *Rationale*: Rata-rata 16 komponen (setelah dikurangi 1) akan langsung mengoreksi bias *equally-weighted*.

## Risks / Trade-offs

- **[Risk] Perubahan nilai historis ValuationComposite secara retroaktif** → *Mitigation*: Pembaruan *database* `maftia_quant.db` tidak masalah selama seluruh baris historis SDCA Backtest ikut dibangun ulang melalui perintah `python3 run_report_pipeline.py` sebelum disajikan oleh API Gateway. Front-end `ValuationStudio` tidak akan *break* karena ia menggunakan Y-Axis width `85px` yang kebal terhadap pergeseran karakter dinamis.
