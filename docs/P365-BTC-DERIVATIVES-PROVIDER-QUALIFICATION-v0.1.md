# P365 BTC Derivatives Provider Qualification v0.1

**Checkpoint:** CRYPTO-STRUCT-001A  
**Status:** PROVIDER LANDSCAPE / SOURCE QUALIFICATION PROPOSED — OWNER MERGE PENDING  
**Downstream dependency:** MOVE-002A crypto-market-structure evidence gap  
**Scope:** Provider comparison and source selection only  
**Primary asset:** BTC derivatives / perpetual market structure  
**Implementation effect:** No provider runtime, credentials, persistence, scheduler, backfill, WebSocket collector, UI, causal attribution, State/Regime/Risk/Intelligence, prediction, or trading logic.

## 1. Purpose

MOVE-002A proved that a material BTC move needs crypto-native evidence that is more representative than one exchange whenever a broader qualified source exists.

CRYPTO-STRUCT-001A therefore does **not** select Binance by default.

It evaluates providers against the factual questions P365 actually needs:

- cross-exchange open interest;
- cross-exchange funding;
- taker buy/sell pressure;
- long/short liquidation activity;
- basis / futures premium where useful;
- minute-to-five-minute intraday resolution;
- historical continuity;
- explicit units and timestamp semantics;
- durable internal-use permission;
- cost appropriate for the internal/non-commercial MVP.

The guiding rule is:

> Prefer the most representative qualified data for the question. Exchange-native data is fallback or venue-specific evidence, not the default market-wide truth.

## 2. Provider-selection criteria

A preferred provider must be evaluated on:

1. market representativeness — cross-exchange vs single venue;
2. metric completeness — OI / funding / taker / liquidation / basis;
3. intraday resolution — target is approximately 1m–5m where available;
4. history depth — enough for immediate investigation and durable continuity;
5. unit normalization — no guessed USD/coin/contract conversion;
6. time semantics — provider timestamp meaning must be explicit;
7. point-in-time suitability — later values must not leak into past MOVE analysis;
8. source methodology / known data limitations;
9. rate limits / operational fit;
10. licensing / storage / internal-use boundary;
11. cost;
12. ability to keep provider identity separate from canonical economic meaning.

No provider may be selected only because it has many endpoints.

## 3. Provider landscape

### 3.1 CryptoQuant

CryptoQuant's BTC Market Data API directly exposes perpetual open interest, funding rates, taker buy/sell stats, liquidations, perpetual price/OHLCV and related market data.

For the key MOVE metrics, the documentation supports `exchange=all_exchange` rather than requiring P365 to treat one venue as the market.

#### Open interest

CryptoQuant explicitly normalizes perpetual OI to USD across exchange contract specifications and supports `all_exchange / all_symbol`.

This is materially more suitable for P365's market-wide leverage question than Binance BTCUSDT OI alone.

#### Funding

Funding history supports `all_exchange` across multiple derivatives venues.

Funding remains an aggregated/provider methodology and must preserve CryptoQuant methodology/provenance rather than being represented as an exchange-native rate.

#### Taker buy/sell

The provider documents taker buy volume, taker sell volume, total taker volume, buy ratio, sell ratio and buy/sell ratio, with differing exchange contract units unified to USD. It supports `all_exchange`.

This closes the unit ambiguity found in Binance's own taker-volume endpoint.

#### Liquidations

CryptoQuant exposes long and short liquidations, including USD values, and supports `all_exchange`.

Important limitation: CryptoQuant explicitly warns that Binance changed its liquidation data collection policy on 27 Apr 2021. An all-exchange liquidation aggregate therefore still inherits source coverage limitations from constituent exchanges.

P365 must not describe CryptoQuant liquidation data as perfect or exhaustive global liquidation truth.

#### Resolution / history / price

Current CryptoQuant pricing states that Professional provides market data down to 1 minute, one year of history, 500k monthly credits and 120 requests/minute. Current listed Professional price is USD 99/month.

Retail-plan applicability, exact live entitlement and durable internal-use permission must be verified before runtime activation.

#### Verdict

> **PREFERRED PROVIDER CANDIDATE — CROSS-EXCHANGE MOVE EVIDENCE**
>
> Runtime remains owner/entitlement/live-shape/durable-use gated.

CryptoQuant is the current first candidate for cross-exchange OI, funding, taker buy/sell and liquidation evidence.

Basis remains a separate evidence need because this audited BTC Market Data surface does not provide the same explicit cross-exchange basis contract as CoinGlass/Coin Metrics.

### 3.2 CoinGlass

CoinGlass has the richest directly packaged cross-exchange surface found in this audit.

Relevant official endpoints include aggregated OI history, OI by exchange, OI-weighted funding history, volume-weighted funding history, aggregated liquidation history, liquidation by exchange, aggregated futures taker buy/sell history, taker buy/sell exchange list and futures basis history.

#### Intraday suitability

CoinGlass supports 1m / 3m / 5m / 15m / 30m and higher intervals on relevant endpoints, but subscription interval limits matter.

Current tiers audited: Hobbyist generally starts at >=4h historical intervals, Startup at >=30m, while Standard supports unrestricted documented intervals including 5m. Current listed Standard price is USD 299/month.

#### Liquidation advantage

CoinGlass directly exposes aggregated long/short liquidation amounts in USD across an explicit exchange list, which is much more suitable than treating Binance force-order snapshots as total liquidation flow.

This still does not erase upstream exchange reporting limitations.

#### Terms blocker for durable Market Memory

Current CoinGlass API Terms prohibit, without written consent, bulk collection/storage or aggregation to create independent databases and restrict redistribution/derived-data distribution.

That restriction conflicts with P365's durable Market Memory objective unless written permission is obtained.

#### Verdict

> **BEST FEATURE-COVERAGE BENCHMARK / NOT SELECTED FOR DURABLE MVP RUNTIME WITHOUT WRITTEN STORAGE PERMISSION**

CoinGlass remains a benchmark/reference candidate unless owner explicitly accepts the cost and obtains terms clarity appropriate for durable Market Memory.

### 3.3 Coinalyze

Coinalyze offers a free authenticated API.

Current documented limits include 40 API calls/minute per key, up to 20 symbols per request, 1m / 5m / 15m / 30m / hourly and higher intraday history, and roughly 1500–2000 retained datapoints for intraday granularities.

It exposes per-market current and historical OI, current and historical funding, predicted funding, liquidation history, long/short ratios and OHLCV with buy-volume support.

The futures-market catalog exposes exchange identity, margin type and `oi_lq_vol_denominated_in`, which is useful for explicit unit handling.

#### Strengths

- free;
- explicit market catalog;
- multiple exchanges;
- OI/liquidation `convert_to_usd` option;
- 1m and 5m history;
- suitable as a validation/fallback provider.

#### Weaknesses

The documented API is predominantly contract/exchange scoped. A P365 market-wide aggregate would require an explicit venue universe, effective-dated constituent handling, unit normalization, missing venue behavior, aggregation methodology and methodology versioning.

That would make the market-wide series a **P365 derived metric**, not a provider-native aggregate.

Intraday retention is short. At 5m, 1500–2000 points is only several days of data.

Coinalyze also warns about historical Binance liquidation completeness, so naive exchange summation cannot be called complete global liquidation flow.

#### Verdict

> **FREE-FIRST FALLBACK / VALIDATION CANDIDATE**

Coinalyze is the strongest no-cost candidate in this audit, but not the preferred provider-native cross-exchange series for the first runtime.

### 3.4 Binance official USDⓈ-M Futures

Binance remains useful because it is the venue-native source for Binance derivatives.

Qualified official surfaces include 5m open-interest statistics, current/settled funding, basis, taker buy/sell ratio and the public force-order stream.

Strengths: official, free public market endpoints, low operational friction, useful venue-specific verification and a direct basis endpoint.

Limitations:

- one venue is not the full BTC derivatives market;
- OI/basis/taker provider history is approximately one month / 30 days;
- official taker absolute-volume units are not explicit enough for the frozen P365 canonical contract;
- public force-order stream is non-exhaustive.

#### Verdict

> **VENUE-NATIVE FALLBACK / SECONDARY EVIDENCE — NOT PRIMARY MARKET-WIDE PROVIDER**

Binance may remain useful for venue confirmation, venue-specific basis, source diagnostics and resilience/fallback.

P365 must not silently use Binance as a proxy for the entire BTC derivatives market.

### 3.5 Coin Metrics

Coin Metrics Market Data Feed covers a broad multi-venue futures universe and provides market OI, market liquidations, funding, contract prices, exchange-asset aggregate OI, exchange-asset basis and aggregated market metrics.

Its documentation is unusually explicit about market identity, exchange timestamps, database timestamps, corrected OI USD methodology, liquidation type and metric metadata/coverage.

Community API exists for a subset of data, but full target derivatives entitlement is not guaranteed by the Community offering. Production-grade Market Data generally requires an API key / commercial entitlement.

#### Verdict

> **HIGH-QUALITY INSTITUTIONAL REFERENCE / ENTITLEMENT-COST QUALIFICATION OPEN**

Do not reject Coin Metrics technically. It may be superior if later budget/entitlement makes it practical.

### 3.6 Kaiko / Amberdata

Both provide institutional-grade derivatives datasets with long history and liquidations, OI and related futures/perpetual evidence.

They are positioned as institutional products with materially higher expected cost than the current MVP candidates.

#### Verdict

> **INSTITUTIONAL REFERENCE — NOT MVP FIRST CHOICE**

## 4. Comparative verdict

| Provider | Cross-exchange | OI | Funding | Taker | Liquidation | Basis | Intraday MVP fit | Cost / access | P365 verdict |
|---|---|---|---|---|---|---|---|---|---|
| CryptoQuant | Yes, provider-native `all_exchange` | Yes, USD-normalized | Yes | Yes, USD-normalized | Yes, with constituent limitations | Not primary audited strength | 1m on Professional | USD 99/mo Professional; entitlement required | **PREFERRED CANDIDATE** |
| CoinGlass | Yes, rich provider-native aggregates | Yes | Yes, incl. OI-weighted | Yes | Yes | Yes | 5m on Standard | USD 299/mo Standard; durable-storage terms blocker | **BEST FEATURE BENCHMARK / TERMS BLOCKED** |
| Coinalyze | Multi-exchange inputs; P365 must aggregate | Yes | Yes | Buy-volume available | Yes | No equivalent audited aggregate basis contract | 1m/5m | Free; 40 calls/min; short intraday retention | **FREE FALLBACK / VALIDATION** |
| Binance | No — one venue | Yes | Yes | Ratio | Partial only | Yes | 5m | Free public market API | **VENUE FALLBACK** |
| Coin Metrics | Broad multi-venue / aggregation levels | Yes | Yes | Via market data/trades | Yes | Yes | Technically strong | entitlement/pricing open | **INSTITUTIONAL REFERENCE** |
| Kaiko / Amberdata | Broad institutional | Yes | Yes | trade-level possible | Yes | Yes | Strong | high-cost / sales-led | **POST-MVP REFERENCE** |

## 5. Selected architecture direction

CRYPTO-STRUCT-001A does **not** freeze one provider as a permanent dependency.

The preferred hierarchy is:

```text
MARKET-WIDE QUESTION
    |
    +-- qualified provider-native cross-exchange aggregate
    |      preferred candidate: CryptoQuant
    |
    +-- independent/free validation
    |      Coinalyze candidate
    |
    +-- venue-native evidence
           Binance / other official exchange APIs
```

Provider identity remains provenance.

Canonical series should describe the economic universe, not provider branding, whenever the measurement is genuinely market-wide.

A provider-specific series is appropriate only when the economic question is venue-specific.

## 6. Liquidation completeness rule

No provider is allowed to erase source limitations.

In particular:

- Binance public force-order data is not exhaustive;
- CryptoQuant records the Binance collection-policy limitation;
- Coinalyze warns about incomplete historical Binance liquidation reporting;
- a cross-exchange aggregate is only as complete as its constituent source feeds.

Therefore P365 may say `provider-reported aggregated liquidations`, but must not claim `all market liquidations` unless source methodology actually establishes that scope.

## 7. Runtime gate

The next checkpoint is **not yet authorized to hardwire Binance or any other provider**.

Before CRYPTO-STRUCT-001B runtime:

1. owner selects or approves the primary provider candidate;
2. live entitlement is verified;
3. exact API response shapes are smoke-tested;
4. terms are checked for private durable storage;
5. canonical all-exchange series meanings are frozen from actual provider semantics;
6. history/backfill bounds are frozen;
7. acquisition cadence is chosen from MOVE needs, not provider maximum rate;
8. secondary validation/fallback role is explicit.

If the owner chooses free-first only, the next checkpoint should live-qualify Coinalyze as a bounded validation/prototype path and explicitly own any P365 aggregation methodology.

If the owner accepts the current paid MVP candidate, CryptoQuant should be live-qualified before implementation.

Binance remains available as secondary venue-native evidence in either path.

## 8. Basis handling

Basis is useful but should not force all metrics through one provider.

Options:

1. qualify CoinGlass/Coin Metrics later for broader basis;
2. retain Binance basis as explicitly venue-specific supporting evidence;
3. build a P365 derived basis only from separately qualified futures + spot prices under a methodology checkpoint.

Do not weaken market-wide OI/liquidation quality merely to force all metrics through one provider.

## 9. Explicit non-goals

CRYPTO-STRUCT-001A does not authorize:

- any runtime provider;
- purchase/subscription;
- API credential creation;
- durable writes;
- database schema changes;
- scheduler changes;
- production backfill;
- WebSocket infrastructure;
- provider lock-in;
- treating one exchange as the full market;
- hidden cross-exchange aggregation methodology;
- claims of exhaustive liquidation coverage;
- causal conclusions such as short squeeze / leverage expansion;
- State / Regime / Risk / Intelligence;
- prediction;
- BUY / SELL / LONG / SHORT;
- position sizing or execution.

## 10. Deeper qualification pass — 4 Oct 2026

### 10.1 CryptoQuant API contract is materially stronger than one-venue data

The current BTC Market Data documentation explicitly supports:

- Open Interest: `exchange=all_exchange`, provider-normalized to USD;
- Funding Rates: `exchange=all_exchange`;
- Taker Buy/Sell Stats: `exchange=all_exchange`, buy/sell volumes normalized to USD;
- Liquidations: `exchange=all_exchange`, including long/short liquidation USD values;
- aggregation windows: `day`, `hour`, and `min` for market-data endpoints.

The provider's time convention defines `window=min` as the UTC minute bucket from
`HH:MM:00` through `HH:MM:59`.

This is a better semantic fit for MOVE than venue-specific Binance OI/funding/taker data
because the economic question is market-wide leverage/flow context.

### 10.2 CryptoQuant entitlement documentation inconsistency

The current pricing surface says:

- Basic: market-data API, daily resolution;
- Advanced: market-data API, hourly resolution;
- Professional: market-data + on-chain API, minute-resolution market data;
- Premium: minute-resolution market data with full history.

However, current API endpoint/discovery documentation still says that an access token is
obtained after upgrading to Professional or Premium.

P365 must treat this as an entitlement-documentation inconsistency.

Consequences:

1. no runtime assumption may be made from the pricing page alone;
2. exact minute endpoint entitlement must be smoke-tested with the intended plan;
3. HTTP `401` / `403` behavior must be treated as an entitlement failure, not schema absence;
4. CRYPTO-STRUCT runtime remains blocked until a real key proves the selected plan.

### 10.3 CryptoQuant usage boundary

Current CryptoQuant Terms grant API users internal, non-commercial use rights and prohibit
resale/redistribution. The pricing page labels Professional as `Personal use` and current
Terms reserve retail plans such as Professional for retail customers rather than corporate
entities.

For the current owner-operated internal/non-commercial P365 MVP this is potentially
compatible, but it is not proof of future corporate/commercial entitlement.

Before durable production use, live qualification must confirm:

- the owner account is eligible for the selected plan;
- API-derived normalized facts may be retained inside private P365 Market Memory under the
  applicable subscription/license;
- no public redistribution is performed.

A move to corporate/public/commercial P365 requires a fresh license/plan review.

### 10.4 CoinGlass durable-storage blocker confirmed

Current CoinGlass API Terms explicitly prohibit, without prior written consent:

- bulk collection/storage/aggregation to create independent databases;
- redistribution of API data or derived data;
- API proxy/gateway redistribution.

This conflicts directly with the P365 Market Memory durability model.

CoinGlass therefore remains technically excellent but **not runtime-eligible for durable
Market Memory without written consent**, regardless of endpoint richness.

### 10.5 Coinalyze free-first capability confirmed, legal boundary still weaker

The current Coinalyze API documentation confirms:

- free API access after account/API-key creation;
- 40 calls/minute per key;
- 1m and 5m OI history;
- 1m and 5m funding history;
- 1m and 5m liquidation history;
- `convert_to_usd` for OI/liquidation;
- future-market metadata including exchange, margin type and
  `oi_lq_vol_denominated_in`;
- only approximately 1500–2000 intraday datapoints retained.

The public API documentation encourages source attribution for public use, but the audit
did not find an API-specific durable-storage licence as explicit as CryptoQuant's internal
API-use grant.

Therefore Coinalyze remains the strongest **free validation/prototype candidate**, not the
preferred durable canonical source until its storage/use boundary is clearer.

### 10.6 Selection state after deeper audit

Current selection state:

1. **CryptoQuant — preferred primary candidate for market-wide BTC derivatives evidence**
   subject to live entitlement and private durable-storage confirmation.
2. **Coinalyze — free-first validation/fallback candidate**, with P365-owned aggregation
   methodology required for market-wide series and storage terms still to clarify.
3. **Binance — venue-native fallback/reference**, not the market-wide default.
4. **CoinGlass — feature benchmark**, technically strong but durable-storage blocked
   without written consent.
5. **Coin Metrics / Kaiko / Amberdata — institutional references** if budget/entitlement
   later makes them practical.

CRYPTO-STRUCT-001A still does not activate any provider.

## 11. Same-PR stopping gate

Because the owner requested this source work to continue in one PR, PR #156 may continue
to refine source qualification until the documentation evidence is exhausted.

It must still stop before:

- purchasing a plan;
- creating/using a new provider credential;
- committing provider runtime code;
- writing production data;
- changing Supabase cron;
- adding a new external dependency.

Those actions require an explicit owner choice of the provider/plan after this PR is
reviewed.


## 12. Free-first qualification pass — 4 Oct 2026

Owner direction:

> Prefer a free source when it is adequate. Do not depend on Binance merely because its
> endpoints are convenient.

This pass therefore re-ranks the candidates by **zero-cost MVP viability**.

### 12.1 Coinalyze — preferred free-first candidate

The official Coinalyze API is explicitly free.

Current documented contract:

- API-key authentication after free account registration;
- 40 API calls/minute per key;
- up to 20 symbols per request, with each symbol consuming one call;
- 1m / 5m / 15m / 30m and higher intraday granularity;
- approximately 1500–2000 retained datapoints for intraday intervals;
- daily history retained without the intraday deletion rule;
- future-market discovery exposes:
  - exchange;
  - symbol;
  - perpetual flag;
  - margin type;
  - `oi_lq_vol_denominated_in`;
  - whether OHLCV / buy-sell / long-short data exists;
- open-interest history with optional `convert_to_usd=true`;
- funding-rate history;
- predicted-funding history;
- liquidation history with optional `convert_to_usd=true`;
- OHLCV history includes:
  - total volume;
  - buy volume;
  - total transaction count;
  - buy transaction count.

This means a free P365 prototype can obtain enough raw evidence to build:

- multi-venue BTC OI in USD;
- per-venue funding;
- long/short liquidation USD;
- aggressive-buy volume share / taker-flow proxy from buy volume vs total volume;
- venue metadata needed for an explicit constituent universe.

#### Important methodology boundary

Coinalyze does not expose the audited market-wide provider-native aggregate needed by
P365 as one canonical all-exchange series.

Therefore any P365 all-exchange output must be a **versioned derived methodology**.

Examples:

- total BTC perpetual OI = sum of eligible venue OI USD;
- market-wide funding = OI-weighted average of eligible venue funding rates;
- total long/short liquidations = sum of eligible venue liquidation USD;
- taker buy ratio = sum eligible buy volume / sum eligible total volume.

The methodology must freeze:

- eligible venue list;
- stablecoin-margined vs coin-margined treatment;
- duplicate/overlapping contract handling;
- missing venue behavior;
- timestamp alignment tolerance;
- stale venue rejection;
- denominator requirements;
- source-unit conversion;
- methodology version.

No aggregation may silently change when Coinalyze adds/removes a venue.

#### Retention implication

At 5m:

- 1500 datapoints ≈ 5.2 days;
- 2000 datapoints ≈ 6.9 days.

Therefore P365 must begin durable capture early if it wants longer historical MOVE context.

This is not a blocker because Market Memory is explicitly designed to own durable
history.

#### Legal/usage boundary

The API documentation explicitly says the API is free and asks for source attribution
when API/data are used publicly.

The audit did not find a stronger API-specific durable-storage licence or a prohibition
equivalent to CoinGlass's independent-database restriction.

Therefore the free source remains **usage-rights clarification required for durable
production**, but no explicit storage prohibition was found in the audited Coinalyze API
documentation.

Verdict:

> **PREFERRED FREE-FIRST CANDIDATE — LIVE KEY / RESPONSE / STORAGE-USE VERIFICATION REQUIRED**

### 12.2 ChainVector — technically stronger free aggregate, prototype-labelled

ChainVector's current free plan is USD 0 forever and includes:

- normalized multi-exchange spot + perp market data across 40+ venues;
- funding;
- OI;
- liquidations;
- 10 requests/minute;
- 10,000 requests/month;
- seven days of history.

Its documentation exposes:

- cross-venue funding;
- open-interest history;
- liquidation tape;
- 5m / 1h / 4h / 1d liquidation aggregates;
- order-flow/CVD;
- cross-venue basis;
- normalized multi-exchange symbology.

Technically this is closer to the desired P365 market-wide representation than
Coinalyze's per-market raw inputs.

However, the provider describes Free as:

`Evaluate the API and build prototypes`

while production side projects are positioned on the paid Developer tier.

The provider launched its public v1 platform in 2026, so its operational history is also
short relative to older market-data sources.

Verdict:

> **FREE EVALUATION / CROSS-EXCHANGE REFERENCE — NOT YET PRIMARY PRODUCTION SOURCE**

ChainVector should be live-compared against Coinalyze before any production decision.

### 12.3 Kiyotaka — good schema, free tier does not include multi-exchange aggregation

Kiyotaka Free currently provides:

- 10 weight/minute;
- 1000 weight/day;
- seven days of history;
- OI;
- funding;
- liquidations;
- candles/trades;
- API key included.

Its API has strong normalization semantics and explicitly documents multi-exchange
aggregation methodologies:

- OI: sum;
- funding: OI-weighted average;
- liquidations: sum;
- USD normalization.

But the pricing contract says **multi-exchange aggregation is not included in Free**.

P365 could call venues separately and reproduce the same methodology itself, but that
adds no clear advantage over Coinalyze while having a lower free request budget.

Verdict:

> **FREE SECONDARY REFERENCE — NOT FIRST CHOICE**

### 12.4 CoinBoss — feature-rich but free access is explicitly temporary

CoinBoss currently exposes free public endpoints including:

- aggregated liquidations;
- OI;
- funding;
- long/short ratios;
- derivatives and exchange data.

However, its own pricing page states:

- all endpoints are currently free;
- current Professional access is free **for a limited time**;
- paid tiers are planned.

A time-limited free state is not a defensible durable dependency for P365.

Verdict:

> **TEMPORARY-FREE REFERENCE ONLY**

### 12.5 Loris Tools — rejected for production dependency

Loris Tools offers a free tier with BTC/ETH data across many venues, but its own API
documentation explicitly warns:

> Do not rely on this API for production trading systems.

That makes it unsuitable as a P365 canonical production provider.

Verdict:

> **REJECTED AS PRODUCTION DEPENDENCY**

## 13. Free-first provider hierarchy

For the current no-cost MVP objective:

```text
PRIMARY FREE CANDIDATE
Coinalyze
  raw per-venue 1m/5m facts
  + explicit P365 aggregation methodology
        |
        +-- validation/reference: ChainVector Free
        |
        +-- venue-native validation:
              Binance / Bybit / OKX / BitMEX / other official public APIs
```

This architecture intentionally prefers:

1. free raw factual inputs;
2. P365-owned transparent aggregation;
3. independent cross-checks;
4. no single-exchange dependency.

## 14. Revised next gate

CRYPTO-STRUCT-001B should now be:

**Coinalyze Free Live Qualification + Aggregation Methodology Freeze**

It should remain in a separate checkpoint after owner merge of CRYPTO-STRUCT-001A.

Before runtime code:

1. owner creates/provides a free Coinalyze API key;
2. live `future-markets` response is captured;
3. exact BTC perpetual venue universe is recorded;
4. 5m OI/funding/liquidation/OHLCV shapes are verified;
5. USD conversion is verified on real responses;
6. timestamp/bucket semantics are verified;
7. P365 aggregation methodology is frozen;
8. ChainVector Free is optionally used as an independent aggregate comparison;
9. no public/commercial redistribution is assumed.

Binance remains fallback evidence rather than primary data ownership.


## 15. Coinalyze free aggregation methodology candidate

This section freezes the **methodological shape** that a later live-key checkpoint must
validate. It does not freeze a production venue list before the live `future-markets`
response is available.

### 15.1 Raw-first durability

P365 should persist **raw per-contract/per-venue factual observations first** and keep
market-wide aggregates as deterministic read-only `DERIVED_METRIC` outputs.

Reason:

- exchange coverage can change;
- one venue may expose multiple BTC perpetual contracts;
- contract denomination differs;
- methodology may evolve without rewriting raw history;
- a later provider can replace/validate Coinalyze without destroying source facts.

The aggregate must never be ingested as if Coinalyze itself reported a single all-exchange
fact.

### 15.2 Eligible BTC perpetual universe

At each universe refresh, candidate markets come from:

`GET /v1/future-markets`

A market is eligible for the base BTC perpetual universe when:

- `base_asset = BTC`;
- `is_perpetual = true`;
- `expire_at = 0` or provider semantics prove the market has no expiry;
- the market has not been explicitly rejected for malformed or incompatible metadata.

Both stablecoin-margined and coin-margined perpetuals may be included because OI and
liquidation endpoints support `convert_to_usd=true`.

Distinct provider market symbols are distinct contracts. They are not deduplicated merely
because they share the same venue or base asset.

Every aggregate must retain:

- exact eligible market symbols;
- exact exchange codes;
- margin-type mix;
- universe count;
- deterministic sorted-universe hash;
- retrieval time of the universe metadata.

No newly appearing venue/contract may silently enter an already-versioned historical
aggregate. A universe change creates a new effective universe revision / methodology
context from that point forward.

### 15.3 Open-interest aggregate candidate

Source:

`GET /v1/open-interest-history?interval=5min&convert_to_usd=true`

The endpoint returns OHLC values per contract bucket.

Candidate market-wide point value:

`OI_TOTAL_USD(t) = Σ OI_CLOSE_USD_i(t)`

for all eligible markets with a valid same-bucket OI close value.

Rules:

- use provider USD conversion;
- no coin/contract multiplication is reimplemented by P365;
- missing contract data remains missing, never zero;
- retain included-market count and excluded/missing-market list;
- do not label the result exhaustive global OI;
- label it as the P365 aggregate over the explicit Coinalyze-covered eligible universe.

The exact `t` bucket-anchor meaning is **not documented clearly enough** in the current
API contract and must be verified from live responses before `observedAt` is frozen.

### 15.4 Funding aggregate candidate

Source:

`GET /v1/funding-rate-history?interval=5min`

Funding is a dimensionless rate and must not be summed.

Candidate market-wide funding:

`FUNDING_OI_WEIGHTED(t) = Σ(rate_i(t) × OI_USD_i(t)) / Σ OI_USD_i(t)`

where:

- funding and OI belong to the same eligible contract;
- both values are valid for the aligned 5m bucket;
- OI uses the provider USD-converted value;
- denominator must be positive;
- contracts missing either OI or funding are excluded from both numerator and denominator;
- included/excluded contracts are retained in lineage.

The funding result is:

- `marketDomain = CRYPTO`;
- `informationClass = DERIVED_METRIC`;
- methodology = `coinalyze-btc-perpetual-oi-weighted-funding-v1`.

It must not be presented as a provider-native funding rate.

### 15.5 Liquidation aggregate candidate

Source:

`GET /v1/liquidation-history?interval=5min&convert_to_usd=true`

The API returns per-market long and short liquidation values.

Candidate outputs:

`LONG_LIQ_USD(t) = Σ long_liquidation_usd_i(t)`

`SHORT_LIQ_USD(t) = Σ short_liquidation_usd_i(t)`

`TOTAL_LIQ_USD(t) = LONG_LIQ_USD(t) + SHORT_LIQ_USD(t)`

Rules:

- values are summed only across valid aligned eligible markets;
- missing venues are not zero;
- the aggregate must retain venue/contract coverage metadata;
- source limitations from constituent exchanges remain explicit;
- output wording is **provider-covered multi-venue liquidations**, not exhaustive global
  liquidation volume.

The exact mapping of response fields `l` and `s` to long/short sides must be confirmed
against a live response before canonical runtime is authorized, even though Coinalyze's
public metric documentation distinguishes long- and short-liquidation series.

### 15.6 Buy/sell volume boundary

Coinalyze OHLCV history returns:

- `v` total futures volume;
- `bv` buy volume;
- `tx` transaction count;
- `btx` buy transaction count.

Coinalyze's custom-metric documentation also distinguishes futures buy volume and sell
volume and uses them for CVD.

However, the API contract does **not** explicitly define `bv` as the same economic
concept as exchange-native **taker buy volume**.

Therefore P365 must not silently rename Coinalyze `bv` to `TAKER_BUY_VOLUME`.

The qualified derived candidate is instead:

Because `future-markets.oi_lq_vol_denominated_in` explicitly covers **OI, liquidation
and volume denomination**, OHLCV `v` / `bv` cannot be summed across contracts unless
their denominations have first been normalized.

The OHLCV history endpoint has no `convert_to_usd` parameter.

Therefore CRYPTO-STRUCT-001A **withdraws the candidate cross-venue formula**
`Σ buy_volume / Σ total_volume`.

Qualified handling is now:

- persist per-contract `v` and `bv` only where `has_buy_sell_data = true`;
- retain `oi_lq_vol_denominated_in` in provenance;
- allow per-contract `buy_volume_share_i = bv_i / v_i` when `v_i > 0`;
- do not sum `v` or `bv` across contracts with different denominations;
- do not invent USD normalization from close price without a separately frozen
  methodology.

A market-wide directional-volume / CVD aggregate remains **NOT_QUALIFIED** from
Coinalyze alone in CRYPTO-STRUCT-001A.

ChainVector documents normalized cross-venue taker CVD from its own tick capture, but its
free tier is explicitly positioned for evaluation/prototypes. Venue-native official APIs
may also remain validation inputs.

### 15.7 Timestamp alignment gate

The current Coinalyze API contract documents:

- UNIX-second `from` / `to`;
- ascending historical responses;
- 1m / 5m / higher interval choices;
- numeric `t` per history bucket.

It does **not** explicitly define whether `t` is:

- bucket open;
- bucket close;
- another provider anchor.

Therefore CRYPTO-STRUCT-001B must empirically verify the timestamp against current wall
clock / adjacent buckets before any canonical `observedAt` rule is frozen.

No timestamp shift may be invented merely to align Coinalyze to P365's five-minute spot
observations.

### 15.8 Missing-market and coverage semantics

Until historical coverage statistics exist, CRYPTO-STRUCT-001A does **not** invent a
minimum percentage coverage threshold.

Every derived aggregate must expose:

- eligibleUniverseCount;
- includedMarketCount;
- missingMarketCount;
- includedMarkets;
- missingMarkets;
- universeHash;
- methodologyVersion.

If coverage is incomplete, the value may be computed only when the later runtime contract
explicitly permits it and labels the coverage state. Otherwise fail closed.

A future threshold such as "require 90% of OI coverage" must be calibrated from live
history rather than guessed.

### 15.9 Candidate raw and derived semantic classes

Raw Coinalyze facts:

| Fact | Market domain | Information class |
|---|---|---|
| Per-contract OI USD | CRYPTO | POSITIONING |
| Per-contract funding | CRYPTO | PRICING |
| Per-contract long/short liquidations USD | CRYPTO | FLOW |
| Per-contract futures volume / buy volume | CRYPTO | FLOW |

Derived P365 outputs:

| Derived output | Information class |
|---|---|
| Multi-venue total OI USD | DERIVED_METRIC |
| OI-weighted funding | DERIVED_METRIC |
| Multi-venue long/short liquidation totals | DERIVED_METRIC |
| Per-contract buy-volume share | DERIVED_METRIC |
| Multi-venue buy-volume / CVD aggregate | NOT_QUALIFIED |

No derived output is State, Regime, Risk, Intelligence, or a trading signal.

### 15.10 What remains blocked on the API key

After this documentation pass, only live-provider facts remain unresolved:

1. current BTC perpetual market universe;
2. actual Coinalyze market symbols/exchange codes;
3. whether every target market returns 5m OI/funding/liquidation/OHLCV;
4. exact response timestamp anchor;
5. real `convert_to_usd` behavior;
6. live `l` / `s` liquidation-side mapping;
7. observed 5m update latency/gaps;
8. practical API-call budget for the live BTC universe;
9. durable private-use/storage clarification if needed from Coinalyze.

No runtime code should precede those checks.


## 16. Free-tier call-budget contract

Coinalyze documents:

- 40 API calls/minute per API key;
- maximum 20 symbols in one request;
- **each symbol consumes one API call**;
- HTTP 429 returns `Retry-After`.

For the initial 5m evidence cycle, let:

`N = number of eligible BTC perpetual contracts`

Core historical endpoint families:

1. OI;
2. funding;
3. liquidation;
4. OHLCV.

Provider call-credit demand per complete 5m cycle is therefore:

`CYCLE_CREDITS = 4 × N`

HTTP request count is:

`HTTP_REQUESTS = 4 × ceil(N / 20)`

but quota consumption remains `4 × N`, not the HTTP-request count.

### 16.1 Hard feasibility ceiling

Across a five-minute cycle, the theoretical maximum provider quota is:

`40 calls/min × 5 min = 200 symbol-calls`

Therefore a complete four-family 5m cycle is mathematically impossible when:

`4N > 200`

or:

`N > 50`

This is a hard provider-limit statement, not a guessed market threshold.

P365 must not silently drop venues or evidence families merely to fit the free quota.

### 16.2 Minute-level scheduler rule

No rolling minute may schedule more than 40 symbol-credits.

The scheduler must:

- chunk each endpoint to at most 20 symbols/request;
- count every requested symbol against quota;
- spread endpoint families across the 5m collection window;
- honor `Retry-After` on 429;
- fail the cycle explicitly when the required universe cannot be completed before the
  next canonical bucket deadline;
- retain per-family acquisition completion time.

The exact production schedule remains live-universe dependent.

### 16.3 No invented reserve percentage

CRYPTO-STRUCT-001A does not hardcode a guessed 10%/20% quota reserve.

The live-key checkpoint must measure:

- actual BTC universe size;
- retry/error rate;
- response latency;
- metadata refresh cost;
- practical completion time.

Only then may a bounded operational reserve be frozen.

### 16.4 Universe refresh

`/future-markets` has no symbol fan-out parameter and is used to discover the effective
universe.

The source contract does not justify pretending the universe is immutable.

Runtime must refresh it periodically and retain the exact retrieved universe snapshot,
but CRYPTO-STRUCT-001A does not invent a refresh cadence before live behavior is measured.

## 17. Updated acceptance boundary before runtime

Documentation-only qualification is now exhausted enough that further progress requires
a real free API key.

CRYPTO-STRUCT-001B must prove, with live responses:

1. eligible BTC perpetual count `N`;
2. whether `4N` fits the desired 5m cycle with practical latency;
3. exact bucket-anchor meaning of `t`;
4. exact OI/funding OHLC behavior;
5. liquidation `l` / `s` side mapping;
6. USD-converted OI/liquidation output values;
7. actual market denomination metadata;
8. per-contract OHLCV volume-unit behavior;
9. response gaps / staleness;
10. 429 / `Retry-After` behavior;
11. universe-change handling;
12. private durable-storage/use suitability.

Until those are proven:

- no ingestion runtime;
- no Supabase cron;
- no backfill;
- no market-wide Coinalyze volume/CVD claim;
- no causal label such as short-covering or leverage expansion.
