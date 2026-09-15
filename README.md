# P365 — Market Intelligence System

P365 adalah private market-intelligence dashboard untuk membaca kondisi pasar berbasis data dan evidence. Sistem ini **bukan** trading bot, execution system, signal copier, atau price predictor.

## Current scope

Implementasi aktif saat ini berfokus pada **Macro + Crypto**. Fondasi domain dibuat market-agnostic agar domain pasar lain dapat ditambahkan kemudian tanpa mengubah kontrak inti.

Pipeline canonical saat ini:

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
State / Risk
  ↓
Intelligence
  ↓
Briefing
  ↓
UI
```

Current implementation sudah mencakup:

- Alpha Vantage macro/crypto news sebagai Evidence.
- CoinDesk crypto news sebagai Evidence.
- Forex Factory weekly economic calendar sebagai Event + Evidence.
- Federal Reserve FOMC calendar sebagai Event + Evidence.
- FRED structured macro observations untuk 19 P0 series.
- Alpha Vantage BTC/USD dan ETH/USD market observations.
- Canonical Context grouping untuk Crypto Market, Macro, dan Economic Events.
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

Untuk deployment Vercel, atur nilai tersebut pada Project Settings → Environment Variables. Jangan commit `.env.local` atau nilai rahasia lain ke repository.

## Documentation

- [`docs/P365-ARCHITECTURE.md`](docs/P365-ARCHITECTURE.md) — product boundary, domain model, pipeline, invariants, dan roadmap.
- [`docs/MACRO-DATA-FOUNDATION-v0.1.md`](docs/MACRO-DATA-FOUNDATION-v0.1.md) — Macro Data Foundation dan P0 series registry.
- [`docs/P365-CONTEXT-STATE-RISK.md`](docs/P365-CONTEXT-STATE-RISK.md) — Context → State → Risk contract.
- [`docs/P365-CONTEXT-STATE-RISK-AUDIT.md`](docs/P365-CONTEXT-STATE-RISK-AUDIT.md) — audit kontrak Context → State → Risk.
- [`docs/P365-INTELLIGENCE-CONTRACT.md`](docs/P365-INTELLIGENCE-CONTRACT.md) — semantic contract untuk Intelligence.
