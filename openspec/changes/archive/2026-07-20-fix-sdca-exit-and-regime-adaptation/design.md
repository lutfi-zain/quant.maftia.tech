## Context

Analisis pergerakan siklus data masa lalu menemukan bahwa strategi SDCA memiliki pemicu SELL yang tidak logis dan *false positive* tinggi bila hanya berpatokan pada *composite valuation* <= -1.5. Harga dapat terus naik 2x hingga 6x lipat sejak titik tersebut. Temuan empiris dari sistem saat ini:

- 100% hari dengan status *overvalued* (`composite <= -1.5`) terjadi saat harga menembus jauh di atas indikator fundamental tren `MA200`.
- Menjual di kondisi sekadar "jauh di atas MA200" membuang *return parabolic*. Harga baru terkonfirmasi berbalik arah saat kompresi mulai turun ke area MA200.

Oleh karena itu, diperlukan perombakan mekanisme SDCA menjadi struktur *Finite State Machine* 6 tahap yang mendeteksi fase nyata dari sebuah siklus akumulasi vs distribusi, memakai rasio kompresi historis `Price / MA200`.

## Goals / Non-Goals

**Goals:**

- Membangun *6-State Lifecycle Machine* untuk SDCA (`HOLD`, `BUY_DCA`, `BUY_ALL`, `SELL_DCA`, `SELL_ALL`).
- Mengubah eksekusi logika DCA menjadi berbasis waktu interval (Mingguan) agar terhindar dari pengosongan modal dalam hari yang sama.
- Memasukkan rasio `Price / MA200` sebagai gerbang (gate) transisi state. Menahan posisi saat rasio menembus di atas > 2.0.
- Mengeksekusi posisi sisa secara total ke `BUY_ALL` ketika harga melewati MA200 ke arah atas di area murah.
- Meng-update tabel, API dan display visual di Panel Valuation Studio untuk status *SDCA State* terbaru.

**Non-Goals:**

- Merombak parameter indikator mentah penyusun komponen Valuation.
- Mengganti arsitektur *LTTD, MTTD, atau Ichimoku systems*.
- Menyentuh UI Subplot selain panel kanan SDCA.

## Decisions

- **Weekly DCA Cadence**: Secara historis eksekusi *buy* bertubi-tubi dalam beberapa hari terbukti menyedot ekuitas modal sebelum aset mencapai harga terendah. Konversi pemicu ke *weekly* memberikan napas bagi portofolio dalam menangkap kisaran harga lebih merata.
- **Rasio Price / MA200**: Saat siklus melonjak (mid-cycle), rasio melampaui `2.0+`. Memulai `SELL_DCA` saat rasio sudah memadat ke bawah `< 2.0` secara empiris membersihkan 100% kerugian *false signal* di tahun 2017 & 2021.
- **BUY_ALL Breakout Trigger**: Sering kali bottom memantul tajam dan tidak akan pernah menyentuh dasar lagi. *Cross upward* di atas MA200 dengan composite > 0.5 (undervalued) merupakan indikasi tak terbantahkan siklus bottom telah selesai, sehingga ini mengaktifkan `BUY_ALL`.
- **SELL_ALL Konfirmasi**: Trigger akhir 100% liquidasi dilakukan bukan karena harga memuncak sesaat, melainkan karena *Drawdown dari ATH* sudah memburuk drastis (> 20%) bersama rasio kompresi.

## Risks / Trade-offs

- **[Risk] State Lag**: Mekanisme MA200 memiliki sedikit lag (telat) dalam respons perputaran ekstrim *V-shape*. → *Mitigation*: Fungsi jual perlahan (`SELL_DCA`) sudah akan mendistribusikan hingga 60-70% posisi sebelum menyentuh target `SELL_ALL` sehingga mencegah kerugian mendalam.
- **[Risk] Database Schema Migration**: Penambahan variabel `price_ma200_ratio` ke kolom `unified_daily_analytics`. → *Mitigation*: Akan disuntikkan secara dinamis saat iterasi `run_report_pipeline.py`.
