# P365 Stablecoin Liquidity Evidence Contract v0.1

**Status:** Active canonical contract and source-qualification gate

**Checkpoints:** CRYPTO-LIQ-001A contract; CRYPTO-LIQ-001B factual runtime; CRYPTO-LIQ-001C production activation

**Runtime status:** **PRODUCTION-ACTIVE — INTERNAL/NON-COMMERCIAL MVP**

**Source verdict:** **QUALIFIED_CANDIDATE — INTERNAL/NON-COMMERCIAL MVP**

**Canonical series key:** `crypto.usd_stablecoin_market_cap.usd`

## 1. Purpose

This document freezes the canonical meaning, provider-field mapping, temporal rules, lineage requirements, and permitted-use boundary for one USD stablecoin aggregate. CRYPTO-LIQ-001B implements that bounded factual runtime without changing the frozen metric, and CRYPTO-LIQ-001C records its separately verified production activation.

It remains a factual evidence contract only. CRYPTO-LIQ-001B authorizes the provider fetcher, canonical normalization, callable durable ingestion, bounded backfill, and read-only factual model described below. The separately operated production scheduler does not authorize UI, public redistribution, or higher-order reasoning.

## 2. Reasoning question

The v0.1 metric answers only:

> What is the aggregate USD market value of the stablecoin universe classified by the provider as USD-pegged, and how has that factual value changed over time?

It does not answer whether the observation represents a liquidity regime, capital inflow, available buying power, BTC demand, a bullish/bearish condition, issuance, redemption, bridge flow, or chain distribution.

## 3. Terminology boundaries

For this contract:

- **USD stablecoin market cap** means the provider-native USD-valued aggregate for the DefiLlama `peggedUSD` universe.
- **Market cap** is the provider's aggregate label and USD valuation; P365 does not reconstruct it from constituent tokens.
- **Stablecoin liquidity evidence** is a product-evidence category, not a claim that the number measures immediately deployable liquidity or flow.
- A change in aggregate market value is a factual numerical change only. It is not automatically issuance, redemption, inflow, outflow, or demand.
- `USD stablecoin market cap` is not equivalent to all stable assets globally.

## 4. Canonical metric

| Dimension | Frozen value |
|---|---|
| Logical series key | `crypto.usd_stablecoin_market_cap.usd` |
| Meaning | Aggregate USD market value of the DefiLlama `peggedUSD` stablecoin universe |
| Canonical value | Provider `totalCirculatingUSD.peggedUSD` |
| Unit | `USD` |
| Asset | `USD_STABLECOINS` |
| Cadence | Provider daily historical aggregate |

P365 consumes a provider-native aggregate observation. P365 must not calculate or silently replace this metric with a sum of individual stablecoins.

## 5. Universe

The canonical v0.1 universe is exactly the assets included by DefiLlama in its `peggedUSD` peg bucket at each provider-effective timestamp.

Explicitly excluded from this metric are `peggedEUR`, `peggedJPY`, `peggedVAR`, and every other non-USD peg class, including any new peg type the provider may add later. P365 must not silently broaden the series by combining peg buckets.

The universe is provider-taxonomy dependent. A material reclassification of an existing asset into or out of `peggedUSD` is a factual/methodology concern. Future runtime must preserve the received value and taxonomy provenance rather than normalize such a change away.

## 6. Semantic classification

| Semantic dimension | Classification |
|---|---|
| Legacy `ObservationDomain` | `MARKET` |
| `MarketDomain` | `CRYPTO` |
| `InformationClass` | `OBSERVATION` |
| `Jurisdiction` | `GLOBAL` |
| Asset | `USD_STABLECOINS` |
| Unit | `USD` |

The metric is not `PRICING`, `FLOW`, `POSITIONING`, `DERIVED_STATE`, or `DERIVED_METRIC`. Although DefiLlama aggregates underlying assets, the value received by P365 is a source-reported observation. P365 does not own or execute the constituent aggregation methodology.

The legacy domain remains part of logical history identity for compatibility with the existing `HistoricalObservationRepository`. Provider identity remains provenance and is not logical series identity.

## 7. Provider metric mapping

Primary official public resource:

```text
https://stablecoins.llama.fi/stablecoincharts/all
```

Credential-free provenance resource:

```text
/stablecoincharts/all
```

Exact field path:

```text
row.totalCirculatingUSD.peggedUSD
```

The [official DefiLlama API documentation](https://api-docs.defillama.com/) identifies `/stablecoincharts/all` as the free, no-auth endpoint for historical market-cap totals across stablecoins. The official SDK at audited commit [`f0d43119c746dda0c1ad8460c37ac9e00e8e5161`](https://github.com/DefiLlama/api-sdk/tree/f0d43119c746dda0c1ad8460c37ac9e00e8e5161) maps that resource and stablecoin base URL to `StablecoinChartDataPoint[]`; its type and example distinguish `date`, `totalCirculating`, and `totalCirculatingUSD`, and read the aggregate market cap from `totalCirculatingUSD.peggedUSD`.

CRYPTO-LIQ-001A also performed a read-only schema observation of the live endpoint on 29 September 2026. The response was an array of daily rows containing a Unix `date`, `totalCirculating`, and `totalCirculatingUSD`, with distinct peg-type keys including `peggedUSD`, `peggedEUR`, `peggedJPY`, and `peggedVAR`. This observation qualifies the current payload shape; it is not a runtime integration or an availability guarantee.

P365 must not substitute:

- `totalCirculating.peggedUSD`, which is not the frozen USD-valued field;
- `totalMintedUSD`;
- `totalBridgedToUSD`;
- a sum of individual stablecoins;
- an aggregate across all peg types.

## 8. Time semantics

### `observedAt`

Use the exact provider-effective Unix timestamp in the historical row's `date`, converted deterministically to ISO-8601 UTC.

The provider timestamp must not be reinterpreted as publication time, release time, market close, or an invented intraday observation time.

### `retrievedAt`

Use the timestamp at which P365 retrieves the payload. This is the knowledge/availability time for point-in-time reconstruction and must not replace `observedAt`.

### Other timestamps

- `releasedAt`: not applicable / undefined.
- `publishedAt`: not applicable / undefined unless the provider later supplies an explicit publication timestamp.

## 9. Historical semantics

The endpoint supplies historical aggregate rows at a daily cadence. The immediate MVP comparison requirements are:

- latest qualified point;
- 1D predecessor;
- 1W predecessor;
- 4W predecessor.

For each target horizon, select the latest valid canonical observation on or before the target. Do not interpolate, require an invented exact calendar match, or forward-fill from an observation after the target. If no eligible predecessor exists, the comparison is missing.

Every point-in-time read must constrain both:

```text
observedAt <= target
retrievedAt <= asOf
```

The same `asOf` cutoff must govern latest and all predecessor selections. A provider correction retrieved later than `asOf` is future knowledge and is ineligible for that historical view.

## 10. Revision semantics

DefiLlama does not expose a canonical vintage or revision identifier sufficient for P365 lineage. Future normalization must therefore reuse existing Observation identity semantics:

```text
domain + seriesKey + observedAt
→ measurement identity
```

If the canonical factual value for that measurement changes, the changed value must produce a new revision fingerprint and a distinct append-only canonical Observation revision.

`retrievedAt` is knowledge/availability time. It must not enter measurement identity or the factual revision fingerprint. An identical refetch remains idempotent; a factual provider correction remains preserved. Earlier Market Memory rows must never be overwritten or deleted.

## 11. Missing/zero rules

`missing != 0` is mandatory.

The row is invalid for this canonical metric when any required component is absent or malformed, including:

- missing `date`;
- malformed or non-finite Unix timestamp;
- missing `totalCirculatingUSD`;
- missing `totalCirculatingUSD.peggedUSD`;
- non-numeric or non-finite `peggedUSD` value;
- otherwise incomplete row that cannot establish the metric and its effective time.

Invalid or missing data must not produce an Observation with value zero. Only a provider-explicit, finite numeric `0` at the exact target field may represent factual zero.

## 12. Provenance

A future canonical Observation must retain at minimum:

- `sourceId` identifying DefiLlama;
- provider resource `/stablecoincharts/all`;
- exact provider-effective timestamp from `date`;
- metric identity `crypto.usd_stablecoin_market_cap.usd`;
- unit `USD`;
- peg type `peggedUSD`;
- P365 retrieval timestamp.

Future runtime may use existing metadata fields for compatibility, but must not fabricate a provider-native instrument ID, native symbol, release time, publication time, or vintage ID.

DefiLlama identity is provenance. It must not be embedded into the logical series key.

## 13. Freshness requirements

This aggregate is a daily 24/7 crypto factual series. That statement defines cadence and market continuity; it does not approve a freshness threshold.

The existing generic `MARKET_DAILY` five-day maximum age must not be applied automatically merely because it exists. Such a threshold could make a stalled daily provider series appear current.

CRYPTO-LIQ-001B explicitly qualifies:

- acquisition freshness at normalization time;
- read/presentation recency relative to a shared `asOf`;
- behavior when the endpoint, timestamp, or cadence becomes stale;
- fail-closed behavior when the freshness policy cannot be evaluated.

The implemented rule compares UTC effective calendar dates: the same UTC date and immediately previous UTC date are current; older dates are stale; future or invalid timestamps are unknown. The runtime distinguishes immutable persisted Observation `quality` from later read-model recency assessment and does not reuse generic `MARKET_DAILY`.

## 14. Source qualification

### Verdict

**QUALIFIED_CANDIDATE — INTERNAL/NON-COMMERCIAL MVP**

### Strengths

- official public stablecoin API;
- the public stablecoin resource requires no API key;
- provider-native historical aggregate;
- daily historical depth;
- explicit peg-type separation;
- direct USD-valued aggregate at the required field.

### Limitations

- no explicit canonical revision/vintage identity;
- provider taxonomy can evolve;
- the public/free rate-limit ceiling is described only generically, not as a strong service commitment;
- service availability and uninterrupted access are not guaranteed;
- P365 has no approval for commercial use, public redistribution, or republication of DefiLlama datasets.

This verdict is not full production-commercial qualification and is not a guarantee of data correctness, continuity, or availability.

## 15. Licensing boundary

The [DefiLlama Terms of Use](https://defillama.com/terms), effective 24 June 2025 when reviewed for this checkpoint, include official public APIs within the Services. They grant a revocable, non-transferable, non-exclusive licence for personal, non-commercial use and prohibit, among other things, resale, republication without permission, and commercial exploitation without prior written consent. They also state that access and availability may be changed, suspended, or terminated and require users to review the then-current Terms each time they access the Services.

The DefiLlama documentation separately describes the API as open/free to use and appreciates source citation. That operational description does not override the Terms of Use.

P365 owner approval is therefore bounded to:

> internal/non-commercial development and MVP use

This is a P365 product-governance approval, not a claim of ownership, a legal opinion, or a broader licence from DefiLlama. P365 does not claim ownership of DefiLlama data.

A fresh licensing review and, where required, explicit permission or an appropriate commercial licence is mandatory before any of these triggers:

- commercial use of P365;
- subscription or paid access;
- public redistribution of provider data;
- republication of DefiLlama datasets;
- resale or external API exposure.

Runtime operation must retain source attribution. Any commercial or public-product activation requires a fresh review of the then-current Terms and, where required, permission or an appropriate licence.

## 16. Runtime requirements

CRYPTO-LIQ-001B implements only the factual runtime chain approved by its gate:

- a DefiLlama provider fetcher using the exact public resource;
- explicit provider result states and validation;
- canonical normalization using the frozen field and semantics;
- provenance and Observation identity mapping;
- append-only durable ingestion;
- an initial historical backfill that preserves provider-effective time and P365 retrieval time;
- point-in-time latest/1D/1W/4W factual reads;
- an explicitly qualified freshness policy;
- focused deterministic tests.

001B reuses existing `ProviderResult<T>`, Observation, semantic mapping, identity, provenance, and historical repository contracts. Its additive mappings remain isolated and backward-compatible. No constituent summation or alternate metric fallback is permitted.

### Production activation evidence

Production activation was verified after PR #103 merged and the Vercel deployment reached `READY` at exact merge SHA `5638872ad1a8a006593aa54b310a88a09db89873`.

An authenticated bounded DefiLlama BACKFILL for `2026-08-26` through `2026-09-29` persisted 35 canonical Observation rows across 35 distinct provider-effective dates for source `defillama-stablecoins` and series `crypto.usd_stablecoin_market_cap.usd`. Read-only verification included:

| Horizon | Provider-effective time | Value (USD) | Acquisition quality |
|---|---|---:|---|
| Latest | `2026-09-29T00:00:00Z` | 311262369758.53 | `FRESH` |
| 1D predecessor | `2026-09-28T00:00:00Z` | 311470047825 | `FRESH` |
| 1W predecessor | `2026-09-22T00:00:00Z` | 310349625823 | `STALE` |
| 4W predecessor | `2026-09-01T00:00:00Z` | 307292864580 | `STALE` |

Historical `STALE` acquisition quality remains valid factual history and is not represented as current or fresh. The latest verified Observation preserves `MARKET`, `defillama-stablecoins`, `/stablecoincharts/all`, `peggedUSD`, `USD`, `DAILY`, and `CRYPTO / OBSERVATION / GLOBAL / USD_STABLECOINS` provenance and semantics. Provider-effective time remains separate from P365 `retrievedAt`; no release, publication, or native instrument identity was fabricated.

The durable DefiLlama Observation count remained 35 after a separate authenticated production FORWARD invocation. This proves that an unchanged latest factual refetch is idempotent in production. Changed-value correction behavior remains governed by the append-only runtime contract and tests; it is not claimed from this unchanged-value production check.

Supabase `pg_cron` remains the sole recurring scheduler. The active standalone job `p365-stablecoin` runs at `17 1,13 * * *` (01:17 and 13:17 UTC) and targets `/api/cron/historical-ingestion` with `mode=FORWARD&providers=defillama`. DefiLlama is intentionally not part of `p365-market-fast`: twice-daily acquisition provides bounded redundancy for a daily source without implying intraday cadence. Temporary activation and backfill jobs were removed. The permanent cron set is `p365-market-fast`, `p365-event-fast`, `p365-fred`, `p365-event-calendar`, `p365-snapshot-capture`, and `p365-stablecoin`.

The job's existence, active configuration, cadence, explicit production invocation success, durable backfill, and FORWARD idempotency are verified. This checkpoint does not claim that a naturally elapsed permanent `p365-stablecoin` scheduled execution has already completed. No stablecoin UI or reasoning layer is activated.

## 17. Future UI semantics

No UI is authorized by 001A or automatically by 001B.

If a later UI checkpoint is approved, it may display only factual content such as:

- current aggregate USD market value;
- provider-effective observation time;
- retrieval/as-of time where useful for traceability;
- factual 1D/1W/4W changes with actual predecessor timestamps;
- explicit missing, stale, old, partial, or unknown states through translated presentation labels;
- DefiLlama source attribution and the `peggedUSD` universe boundary.

It must not label the observation as liquidity regime, inflow/outflow, buying power, BTC demand, bullish/bearish evidence, or a trade signal.

## 18. CRYPTO-LIQ-001B acceptance gate

CRYPTO-LIQ-001B may begin only after this contract PR has been audited and merged.

001B passes only if it demonstrates all of the following:

1. exact mapping from `totalCirculatingUSD.peggedUSD`;
2. strict validation where missing is never converted to zero;
3. deterministic Unix `date` to ISO-8601 `observedAt` conversion;
4. separate P365 `retrievedAt`, with no fabricated release/publication time;
5. the frozen canonical series key and semantic classification;
6. provenance sufficient to identify DefiLlama, `/stablecoincharts/all`, `peggedUSD`, USD, and provider-effective time;
7. existing measurement/revision identity semantics with append-only corrections;
8. durable ingestion and bounded historical behavior with no lookahead;
9. latest/1D/1W/4W on-or-before selection and explicit missing predecessors;
10. explicit daily 24/7 freshness qualification rather than automatic reuse of generic `MARKET_DAILY`;
11. provider failures, malformed rows, and stale data fail closed;
12. focused tests for schema, time, missing/zero, revisions, history, freshness, and provenance;
13. no reasoning/state/UI expansion unless separately approved;
14. the then-current Terms still permit the intended internal/non-commercial use.

## 19. Non-goals

CRYPTO-LIQ-001B does not implement or authorize:

- scheduler or cron activation;
- production backfill execution or a claim that production Market Memory already contains this history;
- Supabase schema changes;
- dashboard cards or other UI;
- a liquidity State, market Regime, Risk, or Intelligence output;
- BTC directional inference or causal attribution;
- stablecoin issuance/redemption;
- per-chain liquidity or bridge data;
- stablecoin depeg or price monitoring;
- individual token ranking;
- ETF flows, derivatives, REL-002, confirmation/contradiction, or trading signals;
- a new dependency or package.

The v0.1 contract freezes one provider-native factual aggregate. Its production runtime and standalone scheduler are active for the approved internal/non-commercial MVP boundary; UI and reasoning remain absent.
