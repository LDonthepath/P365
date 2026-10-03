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
