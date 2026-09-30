# CRYPTO-FLOW-001C — SoSoValue BTC ETF Flow Production Activation

**Date:** 30 September 2026

**Status:** PRODUCTION-ACTIVE — INTERNAL/NON-COMMERCIAL MVP

## Production application

- Exact main SHA: `35526686fb29a47837f0abc1c593b085da51760a`
- Vercel production deployment: READY
- Canonical series: `crypto.us_spot_btc_etf_net_flow.usd`
- Provider: SoSoValue
- Resource: `/etfs/summary-history?symbol=BTC&country_code=US&limit=50`
- Maturity policy: `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`

## Live verification

Authenticated production FORWARD ingestion succeeded.

Initial successful live ingestion:

- acquired: 20
- normalized: 20
- durable Observations: 20
- durable Evidence: 20
- distinct matured Observation dates: 20
- effective-date range: 2026-08-31 through 2026-09-28

The newest provider trading date remained excluded as provisional.

All verified Observations retain:

`MARKET / CRYPTO / FLOW / US / ETF / BTC`

with `quality=UNKNOWN` and completion basis
`P365_PROVIDER_DATE_ADVANCEMENT`.

Live response compatibility was also verified for SoSoValue's inert top-level
`details` envelope metadata. Wrapped responses still require `code === 0`
and array `data`.

## Idempotency correction

Production repeated-ingestion verification exposed a generic Market Memory
defect for Observation-derived Evidence.

Observation identity remained idempotent, but Evidence reused the same
canonical ID while its changing `retrievedAt` produced a different Market
Memory effective timestamp and therefore a different dedupe key.

PR #110 corrected future Observation Evidence to carry and use the semantic
Observation effective time for Market Memory dedupe.

The correction:

- does not change FND-018A Observation identity;
- does not change Evidence canonical IDs;
- does not fabricate `releasedAt` or `publishedAt`;
- does not delete or rewrite append-only historical rows;
- leaves NEWS and EVENT Evidence behavior unchanged.

The first post-fix run created the new stable semantic Evidence keys. A
subsequent authenticated FORWARD run created zero additional SoSoValue rows,
proving future unchanged-fact idempotency.

Historical verification duplicates remain intentionally preserved because
Market Memory is append-only.

## Production scheduler

Active Supabase `pg_cron` job:

- name: `p365-sosovalue-etf-flow`
- job id at activation: `15`
- schedule: `27 1,13 * * *`
- cadence: 01:27 UTC and 13:27 UTC daily
- endpoint owner: `/api/cron/historical-ingestion`
- mode: `FORWARD`
- provider: `sosovalue`

The cadence is an acquisition/recheck cadence only. It does not redefine
provider finality, market close, publication time, or trading-session
semantics.

## Governance boundary

Provider verdict remains:

**PROVISIONAL PROVIDER APPROVED — INTERNAL/NON-COMMERCIAL MVP**

Public redistribution, dataset resale, external API exposure, and commercial
use are not approved by this checkpoint.

UI and reasoning integration remain out of scope.
