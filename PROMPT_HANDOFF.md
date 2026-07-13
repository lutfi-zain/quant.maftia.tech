# MISSION: Mapping Quantitative Bitcoin Ecosystem, Unified Architecture Proposal & GitHub Repository Initialization

> **Dokumen Handoff Prompt untuk Agent AI**  
> **Target Direktori:** `/home/ubuntu/projects/quant.maftia.tech`  
> **Tujuan:** Menyediakan panduan eksekusi lengkap berstandar tinggi bagi *Agent AI* untuk memetakan arsitektur ekosistem kuantitatif Bitcoin, membangun proposal *Unified System* beserta rancangan UI/UX frontend, dan melakukan inisialisasi repositori GitHub.

---

## 1. Latar Belakang & Konteks Tugas

Di bawah direktori `/home/ubuntu/projects/` terdapat sebuah skrip orkestrator bernama `run_report_pipeline.py` yang memicu, menyinkronkan data, dan menjalankan kalkulasi pada 4 sistem kuantitatif Bitcoin:

1. `quant-btc-valuation-system`: Sistem valuasi siklus makroekonomi (17 indikator, Python, SQLite WAL, Hono+Bun API Port 3000, React Vite Port 5173).
2. `quant-btc-lttd-system`: Sistem klasifikasi tren jangka panjang (3-State Gaussian HMM, PCA, VIF Pruning, L1-Lasso/XGBoost, CausalFilter bebas lookahead, Port 8910).
3. `quant-btc-mttd-system`: Sistem strategi konsensus jangka menengah (MTTD v2, 6+ Statistical Families, Kaufman Efficiency Ratio Gate, Shannon Entropy Noise Gate).
4. `quant-lttd-ichimoku`: Dekomposisi Ichimoku menjadi osilator stasioner bebas noise (`tanh` + Ehlers SuperSmoother, 5-Gate Logic, diuji secara statistik).

Tugasmu adalah menjalankan skrip orkestrator tersebut untuk memverifikasi eksekusi, memetakan arsitektur serta fitur dari setiap proyek, lalu membangun satu pusat dokumentasi & proposal sistem terpadu (*Unified System & Frontend Proposal*) di dalam folder `/home/ubuntu/projects/quant.maftia.tech/`, dan mengunggahnya ke GitHub menggunakan `gh`.

---

## 2. Langkah-Langkah Eksekusi yang Wajib Dilakukan

### Langkah 1: Eksekusi & Audit Pipeline

- Jalankan `python3 run_report_pipeline.py` dari direktori `/home/ubuntu/projects`.
- Verifikasi bahwa seluruh pipeline berjalan sukses dan menghasilkan laporan mingguan `latest_week_scores_report.md`.
- Baca dan pahami alur integrasi data harian (penyalinan SQLite `ohlcv` dari `lttd.db` ke `btc_daily.json` milik MTTD).

### Langkah 2: Analisis Mendalam 4 Proyek Kuantitatif

- Gunakan tool pembaca file (`view_file`) untuk mempelajari `README.md`, `AGENTS.md`, skema database, dan alur pemrosesan logika matematika di masing-masing dari 4 proyek di atas.
- Catat parameter-parameter kritis: formula transformasi ($\tanh$, SuperSmoother), pengujian hipotesis statistik (ADF, KS test, Welch's t-test), serta 10 Keluarga Statistik (*10 Statistical Families*).

### Langkah 3: Pembuatan Dokumentasi Modular (`docs/*.md`)

### Langkah 3: Pembuatan Dokumentasi Modular (`docs/*.md`)

Buat folder `docs/` di dalam `/home/ubuntu/projects/quant.maftia.tech/` dan tulis 4 dokumen Markdown berpresisi tinggi:

1. `docs/01_quant_btc_valuation_system.md`: Arsitektur 17 indikator (3 Pilar: Fundamental, Teknikal, Sentimen), normalisasi piecewise `[-2, +2]`, SQLite WAL, dan Hono+Bun API.
2. `docs/02_quant_btc_lttd_system.md`: Arsitektur 6-Layer, estimasi half-life Ornstein-Uhlenbeck (120-350 hari), Gaussian HMM (Bull, Bear, Sideways), PCA ($k=3$, $\ge 85\%$ varians), VIF Pruning ($>10$), dan Walk-Forward Optimization (WFO).
3. `docs/03_quant_btc_mttd_system.md`: Arsitektur konsensus multi-prinsip, formula Integrated Market Oscillator ($\text{IMO}$), Kaufman ER Gate (`>= 0.20`), Shannon Entropy Gate (`<= 2.30`), dan Chikou Momentum Exit (`< -0.30`).
4. `docs/04_quant_lttd_ichimoku.md`: Transformasi non-stasioner Ichimoku ke osilator $\tanh$ stasioner `[-1, +1]`, Ehlers SuperSmoother 2-pole IIR, dan 5 pengujian statistik formal.

### Langkah 4: Pembuatan Master Unified System Architecture (`UNIFIED_SYSTEM_ARCHITECTURE.md`)

Buat dokumen utama `UNIFIED_SYSTEM_ARCHITECTURE.md` di root `/home/ubuntu/projects/quant.maftia.tech/` yang merangkum:

- **Unified Data Ingestion & Core Processing:** Penyatuan feed OHLCV exchange, `bitview.space` BRK API (`sth_mvrv, sth_nupl, sth_sopr, sth_supply`), dan Causal Freshness Guard.
- **Consolidated Storage (`maftia_quant.db`):** Skema SQL terintegrasi untuk tabel `master_ohlcv`, `unified_daily_analytics`, dan `unified_component_signals`.
- **Single API Gateway (`api.quant.maftia.tech`):** Layanan Hono v4 (Bun runtime) berkecepatan tinggi dengan REST `/api/v1/...` dan WebSocket Server.
- **Interlocking Quantitative Safeguards:** Penjelasan bagaimana *Circuit Breaker* Valuation System membatasi eksekusi LTTD saat risiko gelembung (`>= +1.50`), dan bagaimana Gaussian HMM LTTD (*Sideways/Bearish*) menghentikan (*override*) posisi MTTD & Ichimoku menjadi `0.0` exposure.
- **Proposal Fitur Frontend & 4 Deep-Dive Sandboxes:**
  - *Executive Dashboard:* Bento grid header, Cross-System Confluence Gauge, Action Banner, dan Interactive Summary Table.
  - *4 Sandboxes:* Valuation Pillar Studio, LTTD Orthogonal Regime Lab, MTTD Console, dan Ichimoku Terminal.
- **Desain Layout, UI/UX & Rich Aesthetics System:**
  - Desain bertema *High-End Quantitative Financial Terminal* (perpaduan Bloomberg Terminal, TradingView, Glassmorphism, & Obsidian Dark-Tech UI).
  - *Curated HSL Tokens:* Deep Obsidian (`hsl(220, 24%, 7%)`), Bull Emerald (`hsl(142, 71%, 45%)`), Neutral Amber (`hsl(45, 93%, 47%)`), Bear Crimson (`hsl(0, 84%, 60%)`). Typography: Google Fonts **Outfit** & **JetBrains Mono**.
  - **2 Inovasi UX Charting Kritis:** (1) **Vertical Crosshair Synchronization** (kursor di grafik utama mensinkronisasikan penunjuk waktu di seluruh grafik indikator secara vertikal). (2) **85px Y-Axis Width Lock** (mengunci lebar sumbu kanan agar grid horizontal dan vertikal tegak lurus sempurna).
- **Roadmap Implementasi 4 Fase:** Fase 1 (Storage/ETL), Fase 2 (API Gateway), Fase 3 (Frontend Core), Fase 4 (Advanced Sandboxes).

### Langkah 5: Pembuatan Indeks `README.md` & `.gitignore`

- Buat file `.gitignore` standar yang mengabaikan `.venv/`, `node_modules/`, `.bun/`, `tmp/`, dan `*.log`.
- Buat `README.md` yang berfungsi sebagai halaman indeks master, dilengkapi diagram alur Mermaid (*Interlocking Matrix*), tabel tautan ke seluruh dokumen, serta ringkasan kondisi pasar terkini (`100% Cash/Neutral Mode`).

### Langkah 6: Inisialisasi Git & Push ke GitHub via `gh`

- Di dalam `/home/ubuntu/projects/quant.maftia.tech/`:

  ```bash
  git init
  git branch -M main
  git add .
  git commit -m "feat: init Maftia Quant Bitcoin Intelligence Platform architecture & documentation"
  gh repo create quant.maftia.tech --public --description "Unified Quantitative Bitcoin Intelligence Platform & Architecture Repository" --source=. --remote=origin --push
  ```

- Verifikasi bahwa repositori berhasil ter-push ke `https://github.com/<GITHUB_USER>/quant.maftia.tech`.

---

## 3. Success Criteria (Kriteria Keberhasilan)

Tugas dianggap **BERHASIL 100%** apabila memenuhi seluruh poin berikut:

1. **Integritas Skrip:** `python3 run_report_pipeline.py` berjalan tanpa *traceback error* dan file `latest_week_scores_report.md` memperlihatkan skor komposit terbaru.
2. **Kelengkapan Folder & File:** Terdapat tepat 8 file di dalam `/home/ubuntu/projects/quant.maftia.tech/`: `.gitignore`, `README.md`, `UNIFIED_SYSTEM_ARCHITECTURE.md`, `PROMPT_HANDOFF.md`, serta 4 file markdown di dalam direktori `docs/`.
3. **Kualitas Markdown & Diagram:** Seluruh dokumen menggunakan standar *GitHub Flavored Markdown*, memuat diagram alur **Mermaid.js** berkoordinat jelas (tidak ada error sintaks kurung/tanda kutip), skema SQL formal, dan tabel komparatif paramater.
4. **Ketepatan Konsep Kuantitatif:** Dokumen secara akurat menjelaskan konsep *CausalFilter (Zero Lookahead Bias)*, *Ornstein-Uhlenbeck Half-Life*, *Gaussian HMM*, *PCA/VIF Pruning*, *SuperSmoother $\tanh$*, *Kaufman ER Gate*, dan *Shannon Entropy*.
5. **Solusi UI/UX Kritis Terjawab:** Dokumen UI/UX mencantumkan secara eksplisit solusi **Vertical Crosshair Sync** dan penguncian lebar sumbu kanan **85px Y-Axis Width Lock**.
6. **Keberhasilan Push GitHub:** Perintah `gh repo view <USER>/quant.maftia.tech` menghasilkan status *Public Repository* dengan `main` branch berisi commit inisialisasi yang memuat seluruh file tersebut.

---

## 4. Expected Output Structure (Struktur Direktori yang Diharapkan)

```bash
/home/ubuntu/projects/quant.maftia.tech/
├── .git/                               # Initialized Git Repository
├── .gitignore                          # Standard gitignore (logs, venv, bun, tmp)
├── README.md                           # Master Index, Executive Summary & Interlocking Mermaid Flowchart
├── UNIFIED_SYSTEM_ARCHITECTURE.md      # Master Unified System Architecture, UI/UX, & Phased Roadmap
├── PROMPT_HANDOFF.md                   # This AI Agent Handoff Prompt Document
└── docs/
    ├── 01_quant_btc_valuation_system.md   # 17-Metric Cycle Valuation Engine Docs
    ├── 02_quant_btc_lttd_system.md        # Orthogonal Regime-Switching LTTD System Docs
    ├── 03_quant_btc_mttd_system.md        # Multi-Principle Consensus MTTD v2 Docs
    └── 04_quant_lttd_ichimoku.md          # Denoised Stationary Tanh Ichimoku Docs
```
