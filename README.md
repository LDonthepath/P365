# P365 — Market Intelligence System

P365 adalah private market-intelligence dashboard untuk membaca kondisi pasar berbasis data dan evidence. Sistem ini **bukan** trading bot, execution system, signal copier, atau price predictor.

## Purpose

P365 dibangun untuk **menjelaskan market, bukan sekadar menampilkan market**.

Tujuan akhirnya adalah menghasilkan **Market Briefing** yang membantu pengguna memahami:

- apa yang sedang berubah di market;
- mengapa perubahan tersebut terjadi;
- bagaimana perubahan ekspektasi diterjemahkan menjadi repricing;
- bagaimana repricing tersebut ditransmisikan antar-aset;
- bukti apa yang mengonfirmasi atau bertentangan dengan pembacaan tersebut; dan
- apa yang perlu dimonitor berikutnya.

P365 karena itu tidak boleh berhenti pada pembacaan angka atau headline. Angka ekonomi, kebijakan moneter, likuiditas, market pricing, dan pergerakan aset harus dibaca **relatif terhadap rezim yang sedang berlaku dan ekspektasi yang sudah di-price oleh market**.

Mental model reasoning P365:

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

## Current scope

Implementasi aktif saat ini berfokus pada **Macro + Crypto**. Fondasi domain dibuat market-agnostic agar domain pasar lain dapat ditambahkan kemudian tanpa mengubah kontrak inti.

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

Implementasi aktif belum melewati fondasi Baseline/Market Memory; State, Risk, Intelligence, dan Market Briefing tetap deferred.

Current implementation sudah mencakup:

- Alpha Vantage macro/crypto news sebagai Evidence.
- CoinDesk crypto news sebagai Evidence.
- Forex Factory weekly economic calendar sebagai Event + Evidence.
- Federal Reserve FOMC calendar sebagai Event + Evidence.
- FRED structured macro observations untuk 19 P0 series.
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
3. Isi `ALPHA_VANTAGE_API_KEY` untuk provider Alpha Vantage.
4. Isi `FRED_API_KEY` untuk structured macro observations.
5. Jalankan `npm install` lalu `npm run dev`.
6. Buka `http://localhost:3000` dan login menggunakan kredensial yang sudah diatur.

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

- [`docs/P365-ARCHITECTURE.md`](docs/P365-ARCHITECTURE.md) — product boundary, domain model, pipeline, invariants, dan roadmap.
- [`docs/MACRO-DATA-FOUNDATION-v0.1.md`](docs/MACRO-DATA-FOUNDATION-v0.1.md) — Macro Data Foundation dan P0 series registry.
- [`docs/P365-CONTEXT-STATE-RISK.md`](docs/P365-CONTEXT-STATE-RISK.md) — Context → State → Risk contract.
- [`docs/P365-CONTEXT-STATE-RISK-AUDIT.md`](docs/P365-CONTEXT-STATE-RISK-AUDIT.md) — audit kontrak Context → State → Risk.
- [`docs/P365-INTELLIGENCE-CONTRACT.md`](docs/P365-INTELLIGENCE-CONTRACT.md) — semantic contract untuk Intelligence.
