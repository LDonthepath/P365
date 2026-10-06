# P365 Cron Cadence & Evidence Persistence Audit — 2026-10-06

**Status:** AUDIT FROZEN / IMPLEMENTATION DEFERRED TO GITHUB ISSUE  
**Repository baseline:** `main@ac21d09fa08dad2858f1b38e723eee52a11424c8`  
**Production mutation during audit:** 0  
**Purpose:** align polling and durable persistence with the actual information cadence and production utility of each evidence family.

## 1. Governing rule

P365 must distinguish **polling cadence** from **persistence cadence**.

A scheduler may poll more frequently than the economic/source release cadence when timely detection matters. Market Memory should only gain a new durable factual version when one of the following changes:

- provider-effective date/time;
- canonical value or qualified revision;
- semantic provider content that materially changes the factual record.

High-frequency durable sampling remains justified only where a production consumer requires point-in-time intraday history.

## 2. Current production scheduler findings

Read-only production verification on 6 Oct 2026 found the following active jobs:

| Job | Schedule | Audit verdict |
|---|---|---|
| `p365-market-fast` | every 5m | KEEP, but split context-only CoinGecko persistence from fast pricing |
| `p365-event-fast` | every 5m | KEEP polling; fix duplicate EVENT Evidence persistence |
| `p365-fred` | hourly | KEEP |
| `p365-event-calendar` | every 6h | KEEP polling; fix unchanged EVENT Evidence persistence |
| `p365-snapshot-capture` | every 5m | KEEP |
| `p365-stablecoin` | twice daily | KEEP |
| `p365-sosovalue-etf-flow` | twice daily | KEEP |
| `p365-cftc-gold-cot` | daily | KEEP detector; durable persistence remains weekly/report-driven |
| `p365-storage-daily` | daily | KEEP |

All sampled jobs were succeeding in the verified 7-day window.

## 3. Lane-by-lane decision

### KEEP_FAST

These series have real intraday consumers and should retain fast durable history:

- BTC spot;
- ETH spot;
- Gold;
- DXY;
- USDJPY;
- USDCNH;
- Binance completed 5m BTC spot-flow windows.

They are used by MOVE, event-window evidence, synchronous market fingerprinting, or related replay/calibration.

### KEEP_SOURCE_NATIVE / RELEASE-ALIGNED

- GDELT durable snapshots remain source-native feed-build keyed (~15m effective cadence despite more frequent acquisition attempts).
- FRED remains hourly as a release detector; durable canonical Observation/Evidence writes are already idempotent under the current contract.
- DefiLlama stablecoin remains twice-daily detection with daily provider-effective facts and preserved factual revisions.
- SoSoValue ETF flow remains twice-daily maturity detection; only maturity-qualified trading-date facts persist.
- CFTC Gold COT remains daily polling for holiday-delay resilience, while durable facts remain weekly/report-driven.
- SEP remains release-driven.

## 4. EVIDENCE-EFF-001B — CoinGecko cadence split

### Finding

Context-only CoinGecko metrics currently share the 5-minute durable ingestion lane with BTC/ETH spot even though they have no MOVE/event-horizon historical consumer:

- `btc.market_cap.usd`;
- `eth.market_cap.usd`;
- `crypto.total_market_cap.usd`;
- `crypto.total_volume_24h.usd`;
- `crypto.btc_dominance.pct`;
- `crypto.eth_dominance.pct`.

Prior audit measurement found these context metrics contribute approximately:

- **2,296 Market Memory rows/day**;
- **~2.10 MB/day logical payload** before tuple/index overhead.

### Implementation target

Split one existing CoinGecko provider into two internal persistence lanes:

- `coingecko` → fast BTC/ETH spot only;
- `coingecko-context` → slower context persistence.

Canonical source identity and series keys must remain unchanged. Dashboard live acquisition must continue to expose all current CoinGecko context metrics.

Target slow cadence: **hourly**, subject to post-merge production verification.

No provider expansion, no historical deletion, no backfill, and no semantic change are authorized.

## 5. EVIDENCE-EFF-001C — Event Evidence content idempotency

### Production proof

Since 3 Oct 2026:

| Source | Physical EVENT Evidence | Semantic versions | Retrieval-only excess |
|---|---:|---:|---:|
| Biquote | 290 | 5 | 285 |
| Federal Reserve calendar | 121 | 37 | 84 |
| Forex Factory | 18 | 14 | 4 |

Examples:

- one Biquote event accumulated **144 physical Evidence rows** with one unchanged semantic payload;
- a Federal Reserve calendar Evidence ID accumulated **15 physical rows** with unchanged semantic payload.

### Root cause

Current generic Market Memory EVENT Evidence semantics fall back to `retrievedAt` when no source release/publication time is present.

Therefore unchanged polls receive different `effective_at` values and different dedupe keys.

### Required correction

The fix must be **EVENT-specific**, not a global Evidence rewrite.

Desired behavior:

```text
same event ID + same factual/semantic content
→ same durable version
→ no extra physical row

same event ID + factual content changed
→ new append-only durable version
```

Valid changes that must remain preservable include:

- forecast/actual transitions;
- revision changes;
- meaningful status changes such as TOMORROW → TODAY;
- provider calendar content changes.

NEWS/GDELT, Observation Evidence, Binance flow, EventResult identity, and canonical Event identity must remain outside this correction.

## 6. FRED legacy compaction feasibility

A deeper read-only audit corrected the earlier assumption that most same-canonical-ID FRED physical Evidence rows were automatically safe duplicates.

Findings:

- 723 FRED canonical Evidence IDs have more than one physical row;
- after removing retrieval timestamps and normalizing the legacy `observationEffectiveAt` contract difference:
  - only **118 IDs** become fully identical;
  - **605 IDs** still carry semantic/provenance variation;
- the relatively clear identical excess opportunity is only about **1.55 MB logical payload**, not the previously estimated ~40 MB.

Therefore:

> **Do not treat the historical FRED footprint as a safe bulk-deletion target.**

Potential differences include vintage/provenance/knowledge-time semantics. EVIDENCE-EFF-001D remains read-only/deferred until point-in-time equivalence is formally proven.

## 7. Current storage reference

Read-only measurement at approximately 16:59 UTC on 6 Oct 2026:

- database: **287,943,827 bytes**;
- Market Memory total: **249,864,192 bytes**;
- Market Memory heap: **182,616,064 bytes**;
- Market Memory indexes: **66,764,800 bytes**;
- `cron.job_run_details`: **25,657,344 bytes**;
- Market Memory rows: **160,327**;
- Evidence rows: **122,348**;
- Observation rows: **36,380**.

The immediate storage strategy remains:

> reduce low-value future write-rate first; do not perform risky canonical historical deletion.

## 8. Deferred implementation order

Implementation is intentionally moved out of this docs-only PR and into GitHub issue tracking.

Recommended sequence:

1. EVIDENCE-EFF-001B — CoinGecko fast/slow persistence split;
2. production activation and storage-growth verification;
3. EVIDENCE-EFF-001C — EVENT Evidence content idempotency;
4. repeat storage-growth measurement;
5. HOUSEKEEP-002 — bounded `cron.job_run_details` retention;
6. EVIDENCE-EFF-001D — remain read-only unless a safe compaction methodology is proven;
7. reconsider durable order-book production activation only after measured storage runway improves.

## 9. Guardrails

This document does not authorize:

- production cron mutation;
- Market Memory deletion;
- VACUUM FULL / REINDEX;
- historical compaction;
- new provider;
- new external dependency;
- order-book sampling activation;
- State / Regime / Risk / Intelligence;
- causal attribution;
- trading signals.

One implementation checkpoint should remain one reviewed PR.
