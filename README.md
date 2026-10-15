# P365 — Multi-Asset Financial Market Intelligence

P365 adalah **Financial Market Intelligence & Trader Decision Support System** dengan visi multi-aset/lintas timeframe. **MVP pertama: Macro Catalyst & Narrative Intelligence** — mendeteksi perubahan makro yang layak diperhatikan dan menyusun **narasi makro sendiri berbasis evidence**, tanpa syarat menganalisis satu aset atau mendeteksi pergerakan harga. Analisis aset, market-wide risk-on/off dan asset attribution adalah fase sesudah MVP makro. Sistem ini bukan trading bot, signal copier, price predictor atau execution system.

**Kedalaman metodologi MVP:** P365 boleh menghitung probabilitas, weighted evidence, ambang risiko, nowcast dan skenario kuantitatif memakai metodologi akademik atau riset institusi terpercaya yang **dikutip dan diuji** pada data/vintage yang sah. Metodologi yang valid memungkinkan perhitungan; yang dilarang hanya angka tanpa sumber/metode atau klaim kausal tak berdasar. Rincian di kontrak produk §5.2 dan roadmap #360.

**Arah produk dan prioritas MVP owner 11 Oktober 2026:** [User & Decision-Support Contract](docs/P365-USER-DECISION-SUPPORT-CONTRACT.md) · [Market Universe (existing ontology §1.0)](docs/P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md) · [Product Roadmap #360](https://github.com/LDonthepath/P365/issues/360). Produk multi-asset tidak berarti semua source/market atau reasoning State/Regime sudah aktif. Recovery roadmap #283 dan canonical foundation safety gates tetap berlaku.

## Purpose

P365 dibangun untuk **menjelaskan market, bukan sekadar menampilkan market**.

**MVP awal harus menghasilkan Macro Briefing analitis yang berdiri sendiri**, menjawab:

- data makro apa yang benar-benar berubah versus basis pembanding yang sah;
- perubahan mana yang dapat menjadi **candidate catalyst** atau perkembangan makro yang perlu diperhatikan;
- narasi ekonomi apa yang konsisten dengan bukti, dan mana yang masih hipotesis;
- bukti apa yang mendukung, bertentangan atau belum tersedia; dan
- apa yang perlu dimonitor berikutnya.

P365 tidak boleh menciptakan economic event palsu, mengklaim sebab pergerakan aset, atau memaksakan label risk-on/off sebelum metodologi dan data multi-aset qualified.

P365 tidak boleh berhenti pada tabel angka atau ringkasan headline. MVP mengutamakan **macro fact → calibrated change/surprise → catalyst candidate → evidence-linked narrative → uncertainty/what-to-watch**. Makro regime, market pricing dan hubungan aset hanya dinyatakan apabila bukti relevan dan qualification teruji.

Model reasoning historis event/repricing (salah satu jalur, **bukan lagi gerbang wajib**):

```text
Observe
  ↓
Compare
  ↓
Detect Surprise
  ↓
Detect Repricing
  ↓
Test Transmission
  ↓
Resolve Confirmation / Contradiction
  ↓
Explain Regime
  ↓
Market Briefing
```

Prinsip utama:

> **P365 exists to explain the market, not merely to display it.**

Setiap layer, data source, model, dan UI harus dapat dipertanggungjawabkan terhadap tujuan tersebut. Kompleksitas yang hanya membuat dashboard semakin ramai tanpa meningkatkan kemampuan P365 untuk memahami dan menjelaskan market bukan merupakan tujuan produk.

## Product scope vs current implementation

**Cakupan produk jangka panjang:** Financial Market Intelligence lintas FX, rates, equities, commodities, crypto, credit/funding dan volatility/derivatives. **Namun MVP pertama dibatasi pada narasi makro berbasis data makro yang qualified**: growth, inflation, labor, policy, rates, dan macro liquidity/funding. Tidak perlu coverage empat keluarga aset atau risk-on/off market regime untuk lulus MVP pertama. Cakupan produk target ≠ provider/data runtime yang sudah terverifikasi.

**Snapshot fondasi historis (bukan inventaris runtime terkini):** Pengembangan mula-mula memusat pada Macro + Crypto + Gold/BTC. Semua klaim status berikut adalah snapshot foundation yang harus diverifikasi lagi terhadap current main, code, CI dan production; **bukan** hasil audit coverage live 11 Oktober 2026. Perluasan keluarga pasar pertama-tama harus lulus factual source/horizon/temporal quality gates di roadmap. State/Regime/Intelligence tetap deferred kecuali checkpoint terpisah disetujui owner.

Pipeline canonical dan reasoning boundary:

```text
Provider
  ↓
Ingestion
  ↓
Normalization
  ↓
Observation / Event / Evidence
  ↓
Context
  ↓
Baseline / Market Memory / Market Snapshot
  ↓
State / Repricing / Regime Analysis
  ↓
Intelligence
  ↓
Market Briefing
  ↓
UI
```

Pada snapshot fondasi awal, implementasi belum melewati Baseline/Market Memory. Kemajuan setelah snapshot harus diverifikasi di kode, issue, CI dan produksi; kalimat historis ini bukan status runtime terbaru. Derived State/Risk/Regime/higher-order Intelligence tetap owner-gated; *factual briefing* yang sudah ada tidak dengan sendirinya memenuhi acceptance narasi makro mandiri.

**Referensi kode terverifikasi:** pada `main@0ee4d3cd` (14 Oktober 2026), `lib/data/macro-registry.ts` berisi **37 seri FRED**. Registry kode adalah sumber kebenaran untuk jumlah/ID saat ini; entri registry tidak otomatis membuktikan kelengkapan histori, keterbaruan, atau aktivitas provider di produksi.

Daftar implementasi fondasi historis di bawah ini bukan laporan audit produksi terbaru:

Current implementation sudah mencakup:

- Alpha Vantage macro/crypto news sebagai Evidence.
- CoinDesk crypto news sebagai Evidence.
- Forex Factory weekly economic calendar sebagai Event + Evidence.
- Federal Reserve FOMC calendar sebagai Event + Evidence.
- FRED structured macro observations untuk **19 seri P0 pada tahap fondasi awal** (bukan total registry terkini).
- CoinGecko sebagai provider utama factual crypto market observations (BTC/ETH price, market cap, total market cap/volume, dominance).
- FRED + Yahoo Finance untuk factual cross-asset coverage yang sudah qualified pada foundation saat ini.
- Biquote sebagai trial provider untuk structured economic-event results.
- Canonical Context grouping untuk Macro, Crypto Market, dan Economic Events; audit F0 menemukan taxonomy defect pada Crypto Market yang masih harus diperbaiki.
- Provider health dengan status `HEALTHY`, `EMPTY`, `ERROR`, `UNAVAILABLE`, dan `STALE`.
- Evidence traceability dari canonical observations/events.

### Current maturity

P365 saat ini berada pada tahap **Market Intelligence Foundation**. Context sudah menjadi layer canonical yang aktif di dashboard, sementara State, Risk, dan Intelligence masih berada pada tahap contract/validation dan belum menjadi autonomous market-reasoning engines.

News juga belum otomatis dianggap sebagai intelligence. Interpretation hanya boleh dibangun ketika evidence, semantics, dan domain rules sudah didefinisikan dengan jelas.

## Running locally

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `DASHBOARD_AUTH_SECRET`, `DASHBOARD_ACCESS_EMAIL`, dan `DASHBOARD_ACCESS_PASSWORD`.
3. Isi `FRED_API_KEY` untuk structured macro observations.
4. Jalankan `npm install` lalu `npm run dev`.
5. Buka `http://localhost:3000` dan login menggunakan kredensial yang sudah diatur.

## Environment variables

| Variable | Kegunaan |
| --- | --- |
| `DASHBOARD_AUTH_SECRET` | Kunci HMAC untuk menandatangani cookie sesi. |
| `DASHBOARD_ACCESS_EMAIL` | Email satu akun yang diizinkan mengakses dashboard. |
| `DASHBOARD_ACCESS_PASSWORD` | Password akun tersebut. |
| `ALPHA_VANTAGE_API_KEY` | API key server-side untuk Alpha Vantage news dan market data. |
| `FRED_API_KEY` | API key server-side untuk observasi makro FRED. |
| `SUPABASE_URL` | URL server-side untuk durable Market Memory. |
| `SUPABASE_SECRET_KEY` / `P365_MEMORY_WRITE_KEY` | Server-only write credential untuk Market Memory. |

Untuk deployment Vercel, atur nilai tersebut pada Project Settings → Environment Variables. Jangan commit `.env.local` atau nilai rahasia lain ke repository.

## Documentation

Dokumentasi operasional fondasi menggunakan satu SSOT:

- `docs/P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md` — **master foundation SSOT**: current state, audit F0, FND-001…FND-019, remediation sequence, completion gates, dan checkpoint history.
- `docs/P365-ARCHITECTURE.md` — arsitektur, invariants, MVP makro yang berlaku, dan rujukan registry kode (bukan bukti deployment).
- `docs/P365-USER-DECISION-SUPPORT-CONTRACT.md` — **otoritas arah produk terbaru**: multi-asset, multi-horizon dan macro-as-context.
- `docs/P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md` (§1.0) — cakupan keluarga pasar target, data identity, readiness dan first-class activation gates.
- [Issue #360 — Product Roadmap PRB-0…PRB-6](https://github.com/LDonthepath/P365/issues/360) — pelacakan product rebaseline; terpisah dari [Recovery #283](https://github.com/LDonthepath/P365/issues/283).
- Dokumen requirement/governance khusus tetap terpisah hanya bila bersifat normatif, bukan sebagai competing current-state document.

## MACRO-CUT-004 — Integrated cleanup checkpoint (15 October 2026)

**Owner scope:** [Issue #455](https://github.com/LDonthepath/P365/issues/455). All six cleanup dimensions are evaluated in **one review PR**, not separate provider PRs: code, test/legacy, cron, durable history, metadata/source IDs, and docs. First MVP remains standalone macro catalyst/narrative; this checkpoint does not activate market features.

**Execution split:** removing orphaned live HTTP code and updating tests/docs is eligible for owner review. Database deletion, source-ID rewriting, and cron-job removal are **BLOCKED** from production execution until (a) an encrypted off-site full backup and isolated full restore drill are verified ([#331](https://github.com/LDonthepath/P365/issues/331), [Draft PR #357](https://github.com/LDonthepath/P365/pull/357)), (b) append-only/revision/Snapshot/Context reference closure is proven for each proposed group, and (c) the owner provides literal group-specific deletion approval. Merging the PR is **not** that approval.

**Audited inventory, 15 Oct 2026 14:10 UTC (live counts drift):** 188,816 Market Memory rows; 302 MB relation including indexes; 340 MB DB. By `COALESCE(source_id,payload->>'sourceId')`, 85,395 protected-source rows, 103,067 **candidate-review** nonmacro rows, and 354 unattributed/system rows. The candidate category does not mean safe-to-delete: Snapshot references 212 distinct Yahoo and 190 CoinGecko Observation IDs; Context references 68 CoinGecko Observation IDs, and Snapshot retains corresponding Evidence references. See storage audit and `scripts/ops/macro_cut_004_inventory_readonly.sql` for repeatable SQL.

**Cron classification:** active #2 GDELT, #5 Forex Factory/Federal Reserve calendars, #6 Snapshot, #24 FRED and housekeeping #23/#25; #3 Biquote intentionally inactive but **retained**, #4 CoinGecko-context, #10 DefiLlama, #15 SoSoValue, #20 CFTC inactive candidate jobs. Name does not determine behavior: inspect `cron.job.command` selectors and hash before any change. `scripts/ops/macro_cut_004_execution_blocked.sql` deliberately refuses execution, so no migration-on-merge, automatic deletion, or unintended cron unschedule.

**Metadata/source identity:** retain canonical historical `sourceId`, vintage/revision, provenance, physical row dedupe/supersession chains, and Snapshot/Context links; do not silently rewrite JSON or column values. The integrated PR is **PARTIAL/BLOCKED** for production data/cron retirement until operator gates pass; do not mark database cleanup completed based on code CI.
