# P365 US Spot Bitcoin ETF Daily Net Flow Evidence Contract v0.1

**Status:** **RUNTIME IMPLEMENTED / LIVE ENTITLEMENT & PRODUCTION ACTIVATION PENDING**

**Checkpoint:** CRYPTO-FLOW-001B factual runtime and durable-history integration

**Canonical series key:** `crypto.us_spot_btc_etf_net_flow.usd`

**Runtime status:** **IMPLEMENTED / NOT PRODUCTION-ACTIVE**

**Primary provider verdict:** **SoSoValue PROVISIONAL PROVIDER APPROVED — INTERNAL/NON-COMMERCIAL MVP**

**Audit date:** 30 September 2026

## 1. Purpose

This document freezes the factual meaning, semantic classification, time rules, revision behavior, provisional maturity policy, and source-qualification boundary for US spot Bitcoin ETF daily net flow. It selects SoSoValue as the first provider for the P365 internal/non-commercial MVP and retains Farside and CoinGlass as references or fallbacks.

CRYPTO-FLOW-001B implements the bounded provider, normalization, historical-ingestion, durable-history read-model, and regression-test paths defined here without changing FND-018A Observation identity. No scheduler, production backfill/write, UI, or reasoning is activated. No authorized `SOSOVALUE_API_KEY` was available in the implementation environment, so live entitlement and the actual authenticated response shape remain unverified.

## 2. Reasoning question

The metric answers only:

> What was the net daily capital flow into or out of the qualified US spot Bitcoin ETF universe on a given trading date?

It does not answer whether BTC is bullish or bearish, whether institutions are accumulating, whether ETF flow caused a BTC move, whether flow predicts future returns, or whether ETF demand confirms a trade.

## 3. Terminology boundaries

For this contract:

- **daily net flow** is the source-reported aggregate net USD inflow/outflow for one qualified US ETF trading date;
- positive means provider-reported net inflow;
- negative means provider-reported net outflow;
- zero is valid only when the provider explicitly reports factual numeric zero;
- missing, pending, partial, unavailable, and no-session are not zero;
- ETF net flow is not ETF AUM, ETF holdings, BTC price, ETF trading volume, issuance, a participant classification, or an institutional-intent claim;
- a completed prior-session fact may provide background for an intraday BTC user, but it is not an intraday measurement.

## 4. Canonical metric

| Dimension | Frozen value |
|---|---|
| Logical series key | `crypto.us_spot_btc_etf_net_flow.usd` |
| Meaning | Aggregate daily net USD inflow/outflow for the qualified US spot Bitcoin ETF universe |
| Legacy `ObservationDomain` | `MARKET` |
| Canonical unit | `USD` |
| Sign convention | positive inflow; negative outflow; provider-explicit zero only |
| Cadence | US ETF trading session / trading date |

If a source reports USD millions, normalization must multiply the exact source value by `1,000,000` using decimal-safe arithmetic and retain the source scale in provenance. The conversion changes scale only, not economic meaning.

## 5. Semantic classification

The existing ontology and runtime vocabulary already support the required dimensions:

| Axis | Frozen value |
|---|---|
| `ontologyVersion` | `v0.1` |
| `marketDomain` | `CRYPTO` |
| `informationClass` | `FLOW` |
| `jurisdiction` | `US` |
| `instrument` | `ETF` |
| `asset` | `BTC` |
| unit | `USD` |

This source-reported aggregate remains `FLOW`. It must not be classified as `OBSERVATION`, `PRICING`, `POSITIONING`, `DERIVED_STATE`, or `DERIVED_METRIC`. A later implementation using a P365-computed constituent sum would require an explicit methodology amendment rather than silently retaining provider-native semantics.

## 6. Universe

The v0.1 universe is methodological rather than a permanently hardcoded ticker count:

> US-listed spot Bitcoin ETFs included by the qualified provider in its canonical US spot BTC ETF aggregate for the relevant effective date.

The universe excludes Hong Kong products, Bitcoin futures ETFs, leveraged/inverse ETFs, and closed-end or other products unless the selected provider explicitly includes them in the documented US spot-ETF aggregate and P365 separately approves that interpretation.

A future runtime must preserve, when exposed:

- the constituent ticker set applicable to the effective date;
- aggregate completion/update status;
- provider methodology or version;
- inclusion/exclusion changes and their effective dates;
- treatment of conversions and related products, including GBTC and newer mini trusts.

The SoSoValue API can return a current `symbol=BTC&country_code=US` ETF list, but the audited documentation does not make that list effective-dated or expose universe/methodology versions. It also does not explicitly document treatment of GBTC and mini trusts within the historical aggregate. A new ETF must therefore not enter runtime history as an invisible methodology change.

For v0.1 runtime, P365 consumes the provider-native SoSoValue US/BTC aggregate rather than reconstructing constituent sums. The current ETF-list endpoint may support audit and provenance, but P365 must not invent historical constituent membership. Any provider-native universe change remains an explicit known methodology-drift limitation and must retain available provenance.

## 7. Provider-native vs derived methodology

The preferred canonical value is a provider-native aggregate. SoSoValue documents `total_net_inflow` as the total net inflow of all ETFs for the requested day. CoinGlass documents aggregate `flow_usd`. Farside publishes a provider-generated `Total` column.

P365 must not sum constituent funds when a qualified provider-native aggregate is available.

If a later checkpoint must use deterministic P365 aggregation, it requires a new methodology version defining:

- exact effective-dated constituent inclusion;
- missing and pending constituent behavior;
- partial-day behavior and completion criteria;
- decimal/scale rules;
- revision behavior;
- aggregate quality when one or more constituents are unavailable.

## 8. Time semantics

ETF flow is a daily trading-session fact.

### `observedAt`

Use the provider-qualified trading/effective date. If the provider supplies only `YYYY-MM-DD`, P365 may anchor it deterministically as `YYYY-MM-DDT00:00:00.000Z` solely as the canonical effective-date timestamp. That anchor is not a release time, publication time, NYSE close, or intraday flow timestamp. Preserve the original date separately in provenance.

### `retrievedAt`

Use the timestamp when P365 successfully acquires the provider response. It is the point-in-time availability boundary for P365.

### `releasedAt` / `publishedAt`

Leave undefined unless the provider explicitly supplies and qualifies the corresponding timestamp.

Flow for trading date T may become knowable only after the session and after progressive fund reporting. Point-in-time reconstruction must constrain `retrievedAt`; it must never assume the completed value was knowable at the market close or at the effective-date anchor.

## 9. Partial/final semantics

SoSoValue does not expose a provider-native `FINAL`, `COMPLETE`, or partial/finality flag on `/etfs/summary-history`. P365 therefore defines the operational policy `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`:

> A SoSoValue daily aggregate for trading date T becomes eligible for canonical persistence only after the same authenticated API response contains at least one valid strictly later provider trading date.

For valid provider trading dates returned in strict descending order:

```text
T0 > T1 > T2 > ...

T0
→ PROVISIONAL
→ NOT canonicalized

T1, T2, ...
→ MATURED_ELIGIBLE_UNDER_P365_POLICY
→ may enter canonical Observation
```

This is a P365 operational maturity policy. It is not a claim that SoSoValue marks the value `FINAL`. Provider-stage provisional data may exist transiently during acquisition, but it is not a canonical factual Observation under this v0.1 contract.

The newest valid provider trading date in every response **MUST** remain non-canonical even if the US market is closed, local time is late at night, the dashboard appears complete, or all known ETF tickers appear populated. A guessed wall-clock rule such as “wait until 22:00 ET” remains prohibited.

Once a newer provider trading date exists, the prior trading date is no longer the provider's active/latest daily row. P365 may then treat it as matured historical evidence for the internal/non-commercial MVP. This sequence progression does not guarantee that SoSoValue will never revise an older row, so rolling correction detection and append-only revision handling remain mandatory.

Maturity metadata alone does not create a factual revision under FND-018A. A future product requirement for durable provisional-state history when the numeric value is unchanged requires a separate contract/record family or an explicit identity-evolution checkpoint; it is not solved here.

## 10. Historical semantics

Immediate factual needs are:

- latest matured-eligible trading-date flow;
- previous trading-session flow;
- a factual five-session/approximately one-week context where explicitly requested.

Select actual trading-date observations. Weekends and exchange holidays are not missing observations and must not receive fabricated zero rows. Do not interpolate or forward-fill.

SoSoValue's official summary-history documentation supports `start_date`, `end_date`, and `limit`, excludes weekends/holidays, sorts latest first, and limits queries to the most recent one month. This is sufficient in depth for the immediate prior-session and five-session factual questions, but not for long-history baselines. History depth alone does not resolve live entitlement, correction-recheck, or provider-owned universe limitations.

Historical and bounded BACKFILL rows may be canonicalized only when they satisfy `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`. In a multi-date response, the newest valid provider trading date is excluded and only earlier valid dates are maturity-eligible. A BACKFILL candidate must be evaluated against provider data containing at least one valid trading date later than the candidate; it must not appear mature merely because a requested range ended on that date or because it is not today's date.

CRYPTO-FLOW-001B implements the rolling recheck as one authenticated FORWARD request with `limit=50`. It validates the bounded response, excludes the newest valid provider date, and canonicalizes all earlier maturity-eligible rows returned. Unchanged facts dedupe and changed facts append under FND-018A without an extra provider call.

## 11. Revision semantics

Reuse the existing Observation identity contract:

```text
MARKET
+ crypto.us_spot_btc_etf_net_flow.usd
+ observedAt
→ measurement identity
```

A changed canonical factual value for the same measurement creates a distinct revision fingerprint and a new append-only Observation. `retrievedAt` remains knowledge/availability time and must not enter the factual revision identity.

Under FND-018A, the revision fingerprint covers the measurement identity, source, canonical factual value, unit, and frequency. Finality metadata alone does not create a new Observation revision. For the same measurement, a later changed canonical factual value creates a new append-only factual revision; an identical value with a changed finality label does not.

Only values that are `MATURED_ELIGIBLE_UNDER_P365_POLICY` enter this canonical series, and later factual corrections must never overwrite earlier Market Memory rows. Maturity/finality metadata alone does not create a revision. Preserve an explicit provider finality/revision field if one becomes available in the future, but do not infer one from P365 maturity. None of the three audited sources documents a canonical vintage/revision identifier for this metric.

FND-018A behavior remains unchanged:

```text
Day T value = +100m; latest provider date = T
→ provisional
→ no canonical Observation

Later response: latest provider date = T+1; Day T still = +100m
→ matured eligible
→ persist +100m

Later provider correction: Day T = +105m
→ same measurement identity
→ changed factual value
→ new append-only revision
```

An identical value on refetch remains idempotent. `domain + seriesKey + observedAt` remains the measurement identity; no Observation identity change is authorized by this checkpoint.

## 12. Missing/zero rules

`missing != zero` is mandatory.

The following must not become zero without an explicit provider definition:

- blank, dash, `null`, omitted, non-numeric, or malformed aggregate values;
- missing or pending constituent values;
- incomplete aggregate;
- provider outage/error;
- market holiday or no trading session.

Farside's table visibly uses both `0.0` and `-`; therefore they are not interchangeable representations. Only a numeric provider-reported aggregate zero is a factual zero.

## 13. Provenance requirements

A future canonical Observation must retain at minimum:

- stable P365 source ID;
- credential-free provider resource path;
- exact canonical series/metric identity;
- request universe parameters such as `symbol=BTC` and `country_code=US`;
- original trading/effective date and deterministic canonical anchor;
- original unit/scale and any USD conversion rule;
- provider-native aggregate field name;
- retrieval timestamp;
- maturity policy `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`;
- completion basis `P365_PROVIDER_DATE_ADVANCEMENT`;
- effective-date constituent tickers and methodology/version when available.

A canonical SoSoValue Observation should retain `provider=SoSoValue`, `providerResource=/etfs/summary-history`, `symbol=BTC`, `countryCode=US`, the original `providerTradingDate`, `aggregateField=total_net_inflow`, and `unit=USD`. It must not write `providerFinal=true` unless SoSoValue actually supplies and qualifies that field in the future.

Finality/completion metadata may be retained if the provider later supplies it. A status-only or maturity-only transition does not automatically create a separate Observation revision under FND-018A.

Do not fabricate native instrument IDs, publication/release timestamps, constituent completeness, or methodology versions. Provider identity remains provenance and must not enter the logical series key.

## 14. Freshness/session semantics

This metric must use US ETF trading-session semantics, not a 24/7 crypto calendar and not generic wall-clock daily freshness.

The CRYPTO-FLOW-001B read model returns only stored maturity-eligible canonical facts and preserves acquisition quality as `UNKNOWN`. It exposes the latest fact, previous actual trading-session fact, and at most five recent actual sessions without interpolation. It does not infer current/stale status. A future calendar-qualified layer may distinguish:

- matured-eligible latest canonical session;
- provisional newest provider trading date;
- stale provider history relative to expected trading sessions;
- holiday/weekend no-session;
- unknown exchange/session status.

Exact session calendar and acquisition-lag behavior remain unqualified. CRYPTO-FLOW-001B therefore does not invent a close, publication, provider-finality time, or market-recency classification.

## 15. SoSoValue qualification

### Owner provider decision

> **SoSoValue is selected as the first BTC ETF flow provider for the P365 internal/non-commercial MVP.**

This closes the owner-approval provider-selection gate. Runtime use is approved by the P365 owner only within the internal/non-commercial MVP boundary and only through the official authenticated API. It is not proof that SoSoValue granted broader commercial, redistribution, external API, dataset-resale, or storage rights.

### Official API mapping

The current [SoSoValue developer surface](https://sosovalue.com/developer) advertises RESTful JSON access, crypto ETF data, a zero-cost Demo plan, and a Beta limit of 20 calls/minute. The current official [Market Data documentation](https://sodex.com/documentation/for-developers/developers/data-api) is hosted under the SoDEX documentation surface and uses base URL `https://openapi.sosovalue.com/openapi/v1`. Its [authentication and limits contract](https://sodex.com/documentation/for-developers/developers/data-api/authentication-and-limits) specifies the API-key header and quotas below.

| Item | Audited contract |
|---|---|
| Method | `GET` |
| Aggregate resource | `/etfs/summary-history` |
| Authentication | server-side `x-soso-api-key` header |
| Required query | `symbol=BTC`, `country_code=US` |
| Optional query | `start_date`, `end_date`, `limit` |
| Aggregate field | `total_net_inflow` |
| Unit | USD |
| Date field | `date`, trading date `yyyy-MM-dd` |
| Ordering | reverse chronological |
| Non-trading days | excluded |
| History range | most recent one month |
| Limit | default 50, maximum 300 |
| Current constituent list | `GET /etfs?symbol=BTC&country_code=US` |
| Per-fund history | `GET /etfs/{ticker}/history`, field `net_inflow` |
| Published request limits | 100,000/month and 20/minute in current auth/limits docs |

The exact provider-native mapping is:

```text
GET https://openapi.sosovalue.com/openapi/v1/etfs/summary-history
    ?symbol=BTC
    &country_code=US

response date             → provider effective trading date
response total_net_inflow → canonical USD daily net flow candidate
```

The endpoint and field are documented and immediate history depth is sufficient. However:

- the aggregate response exposes no partial/final/update status;
- the ETF list is current, not effective-dated;
- historical universe and methodology revisions are not exposed;
- GBTC/mini-trust treatment is not explicitly defined in the API contract;
- documentation is internally imperfect: common definitions describe a common response envelope while ETF endpoint examples show bare arrays;
- actual Demo-key entitlement to the ETF endpoints was not exercised because this docs-only checkpoint does not create credentials.

### Terms and permission boundary

The [Terms linked from the SoSoValue developer page](https://sosovalue-white-paper.gitbook.io/sosovalue-whitepaper/9.-resources/9.4-terms-of-use.md) currently resolve through a moved SoSoValue whitepaper page governing a website, not a separate Market Data API licence. Those terms limit website use to personal/non-commercial use and prohibit automated website access/copying and redistribution. Official authenticated API calls are not website scraping, but the audited terms do not clearly grant storage, repeated automated API ingestion, or durable internal reuse of API data.

The newer SoDEX Terms likewise govern its interface and permit personal/non-commercial use; they do not provide a clear API-data licence for P365. No audited API-specific permission resolves this ambiguity.

The owner explicitly accepts SoSoValue official API use for the internal/non-commercial MVP despite the absence of a separately audited API-data storage licence. This is a product-governance risk acceptance, not legal advice or a claim of commercial permission. Terms must be re-reviewed before any commercial or public deployment.

Verdict:

> **PROVISIONAL PROVIDER APPROVED — INTERNAL/NON-COMMERCIAL MVP**

SoSoValue is the selected provisional provider and is eligible for the bounded CRYPTO-FLOW-001B implementation after owner merge. Qualification remains limited to the official authenticated API, provider-native aggregate, latest-date exclusion, `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`, append-only corrections, retained universe-methodology limitation, and no public/commercial redistribution. It is not fully production-qualified.

## 16. Farside assessment

The official [Farside Bitcoin ETF flow table](https://farside.co.uk/btc/) provides:

- daily US spot Bitcoin ETF flows;
- per-fund values and a provider-generated `Total`;
- USD millions;
- history from launch through an all-data table;
- real-time progressive updates, typically during the US evening/night;
- visible treatment of GBTC and the newer Grayscale mini trust `BTC` in the current table.

Limitations:

- the audited official site exposes a public HTML table, not an official machine-readable API;
- no explicit automated-access or data-reuse licence was found on the official ETF, privacy, or site navigation pages;
- all-rights-reserved copyright is displayed;
- no machine completion/finality, revision/vintage, or methodology-version field is exposed;
- progressive updates mean historical corrections may occur, but no revision contract is documented;
- dash and numeric zero both appear and must not be conflated.

Verdict:

> **REFERENCE SOURCE / RUNTIME LICENSING-AUTOMATION UNQUALIFIED**

Farside may be used for manual/reference comparison, but P365 must not scrape it or qualify it for runtime merely because its table is useful.

## 17. CoinGlass assessment

The official [CoinGlass ETF Flows History](https://docs.coinglass.com/reference/etf-flows-history) endpoint documents:

| Item | Audited contract |
|---|---|
| Method/resource | `GET https://open-api-v4.coinglass.com/api/etf/bitcoin/flow-history` |
| Authentication | `CG-API-KEY` header |
| Aggregate | `flow_usd` |
| Per-fund breakdown | `etf_flows[].etf_ticker`, `etf_flows[].flow_usd` |
| Date/time | `timestamp`, milliseconds |
| Unit | USD |
| Plans | Hobbyist, Startup, Standard, Professional, Enterprise |

Current [CoinGlass pricing](https://www.coinglass.com/pricing) lists Hobbyist at USD 29/month, 30 requests/minute, personal use, and all-time daily history. Commercial use begins at the Standard tier, currently USD 299/month. No purchase or subscription was made.

The endpoint is technically suitable in aggregate/per-ticker shape and history depth, but its documentation does not expose aggregate finality or effective-dated universe/methodology fields. Under P365's free-first requirement it is not the primary candidate.

Verdict:

> **TECHNICALLY QUALIFIED / NOT FREE-FIRST — PAID PLAN AND FINALITY/UNIVERSE GATES REMAIN**

## 18. Licensing/use boundary

No source is approved for public redistribution, dataset republication, resale, external API exposure, or commercial P365 use.

SoSoValue's free Demo availability is not itself a licence grant. The owner accepts the unresolved API-data storage-permission risk only for official authenticated API use within P365's internal/non-commercial MVP. Farside has no verified automation/reuse permission. CoinGlass explicitly separates personal-use lower plans from commercial-use plans and is paid.

This is a product-governance risk acceptance and source-qualification record, not legal advice. Terms must be re-reviewed before commercial/public deployment. Any later permission must be recorded from the provider's then-current API-specific terms or written authorization. P365 must not claim ownership of provider data.

## 19. Runtime gate

CRYPTO-FLOW-001B is implemented against the provider-selection and provider-date-advancement contract. The server-only adapter calls the official resource with `symbol=BTC`, `country_code=US`, and `limit=50`, enforces a 10-second timeout and FRESH/no-store acquisition, and strictly validates unique descending trading dates plus finite numeric `total_net_inflow` values. It supports the documented bare row array and common `data` envelope only; the exact authenticated live shape remains pending because no authorized key was available.

Implemented and deterministically tested:

1. strict missing/null/malformed/non-finite rejection and explicit numeric zero acceptance;
2. `SOSOVALUE_ETF_FLOW_MATURITY_V0_1` selection and unconditional newest-row exclusion;
3. one-request `limit=50` FORWARD rolling correction recheck;
4. SoSoValue-only BACKFILL with an inclusive 28-calendar-day maximum, same-response later-date witness, and returned-coverage proof;
5. deterministic trading-date midnight-UTC anchoring;
6. exact `MARKET / CRYPTO / FLOW / US / ETF / BTC / USD` semantics and provenance;
7. unchanged FND-018A idempotency and append-only correction behavior;
8. bounded point-in-time history reads with revision collapse and at most five actual sessions;
9. server-only credential handling, 10-second timeout, and explicit provider error classification;
10. provider failure isolation in multi-provider FORWARD runs;
11. no UI, reasoning, scheduler, or production-write expansion.

Remaining activation gates are an authorized authenticated smoke read proving Demo/free entitlement and exact live response shape, owner audit/merge, deployment, and a separately approved CRYPTO-FLOW-001C production scheduler/backfill activation. Current status is **RUNTIME IMPLEMENTED / LIVE ENTITLEMENT & PRODUCTION ACTIVATION PENDING**.

The historical provider-native universe remains unversioned and provider-owned. This known limitation does not authorize constituent reconstruction or invented historical membership.

A guessed wall-clock delay remains insufficient. The CRYPTO-FLOW-001B runtime does not claim SoSoValue provider-native `FINAL` status and fails closed when provider-date advancement cannot be proven.

## 20. Future UI semantics

No UI is authorized by this checkpoint.

A later approved UI may present only factual content such as:

- matured-eligible trading date;
- net USD flow with explicit sign;
- source and retrieval/as-of time;
- matured/provisional/unknown state through translated labels;
- actual previous-session or five-session context;
- provider universe disclosure.

It must not label flow as bullish/bearish, institutional accumulation, BTC demand, confirmation of a trade, causal price pressure, or a prediction.

## 21. Non-goals

This checkpoint does not implement or authorize:

- committed credentials, Supabase changes, production Market Memory writes, or scheduler activation;
- production backfill or live provider-data persistence;
- dashboard/UI;
- cumulative ETF-flow signal or percentile;
- P365 constituent aggregation;
- ETF holdings or AUM series;
- Gold ETF flow;
- confirmation/contradiction or causal BTC interpretation;
- State, Regime, Risk, Intelligence, or trading signals;
- paid subscription;
- website scraping or undocumented endpoint use.

The result is one implemented factual flow runtime with a provisional owner-approved provider, an explicit sequence-based maturity policy, and a bounded internal/non-commercial runtime boundary. Live entitlement, production activation, commercial/public permission, and effective-dated universe methodology remain open.
