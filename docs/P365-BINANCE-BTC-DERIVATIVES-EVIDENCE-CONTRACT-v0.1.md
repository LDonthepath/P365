# P365 Binance BTC Derivatives Evidence Contract v0.1

**Checkpoint:** CRYPTO-STRUCT-001A  
**Status:** SOURCE QUALIFICATION PROPOSED — OWNER MERGE PENDING  
**Downstream dependency:** MOVE-002A crypto-market-structure evidence gap  
**Provider / venue:** Binance USDⓈ-M Futures  
**Initial instrument universe:** BTCUSDT perpetual only  
**Scope:** Contract and source qualification only  
**Implementation effect:** No provider adapter, API credential, persistence, scheduler, backfill, WebSocket collector, UI, causal attribution, State/Regime/Risk/Intelligence, prediction, or trading logic.

## 1. Purpose

MOVE-002A proved that P365 can detect a material BTC move and build a synchronous
BTC/ETH/DXY/Gold fingerprint, but cannot yet distinguish several crypto-native market
structure mechanisms because the required derivatives evidence is absent.

CRYPTO-STRUCT-001A evaluates Binance only for the evidence needed to close that concrete
gap:

- open interest;
- funding;
- basis;
- taker buy/sell pressure;
- liquidation / forced-order evidence.

This checkpoint does not qualify every Binance metric and does not turn Binance into a
general P365 provider.

## 2. Initial venue and instrument boundary

The v0.1 universe is intentionally narrow:

`Binance USDⓈ-M Futures / BTCUSDT / PERPETUAL`

Excluded from v0.1:

- COIN-M futures;
- ETH and other assets;
- quarterly futures except where the provider's basis endpoint needs contract-type
  comparison and a later contract explicitly enables it;
- options;
- user/account endpoints;
- top-trader and global long/short-account ratios;
- ADL risk;
- any cross-exchange aggregate.

Binance is economically part of the measurement universe because these facts describe a
specific trading venue. The canonical `sourceId` still remains separate provenance.
A future alternate data vendor that faithfully reports the same Binance venue fact must
not create a different logical series solely because the transport provider differs.

## 3. Canonical semantic boundary

The existing P365 ontology explicitly places BTC futures/open-interest evidence inside
the first-class Crypto market scope. Therefore these Binance facts remain:

- legacy `Observation.domain = MARKET`;
- `marketDomain = CRYPTO`;
- `jurisdiction = GLOBAL`;
- `instrument = CRYPTO_DERIVATIVE`;
- `asset = BTC`.

Information class depends on economic meaning:

| Evidence | Information class | Reason |
|---|---|---|
| Open interest | `POSITIONING` | Outstanding derivative exposure; matches the existing ontology example for BTC futures OI |
| Funding rate | `PRICING` | Provider-reported perpetual funding price/rate |
| Basis rate | `PRICING` | Futures-versus-index price relationship |
| Taker buy/sell ratio | `FLOW` | Executed aggressive-side activity during a bounded period |
| Liquidation snapshot | `FLOW` evidence | Forced execution activity; v0.1 does not create a canonical total-liquidation series |

No metric in this contract is `DERIVED_STATE`.

## 4. Qualified canonical series candidates

### 4.1 BTCUSDT perpetual open interest

Candidate logical series:

`crypto.btc.binance_usdm_perpetual.open_interest.quantity`

Provider resource:

`GET https://fapi.binance.com/futures/data/openInterestHist`

Required request scope:

- `symbol=BTCUSDT`;
- `period=5m` for the initial MOVE-compatible cadence.

Qualified source field:

`sumOpenInterest`

The Binance documentation calls this total open interest and supplies a timestamp at the
**end of the period**.

The official endpoint also exposes `sumOpenInterestValue`, but its currency/unit is not
made explicit in the audited endpoint contract. CRYPTO-STRUCT-001A therefore does not
canonicalize that field as USD/USDT.

Canonical unit for `sumOpenInterest` remains:

`PROVIDER_NATIVE_QUANTITY`

until runtime/source verification can prove a more specific unit without inference.
P365 may compare the same provider-native quantity through time, but must not relabel it
as contracts, BTC, USD, or USDT without qualification.

Source verdict:

**QUALIFIED CANDIDATE**

Provider history limitation: only the latest one month is available from this endpoint.
A durable P365 history must therefore be accumulated rather than relying indefinitely on
provider-retained history.

### 4.2 Current funding-rate state

Candidate logical series:

`crypto.btc.binance_usdm_perpetual.funding_rate.current`

Primary REST resource for the first runtime:

`GET https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT`

Qualified fields:

- `lastFundingRate`;
- `time`;
- `nextFundingTime`.

The provider documents `lastFundingRate` as the latest funding rate. P365 must not
rename it to a settled funding payment for `nextFundingTime`.

Canonical observed time is provider field `time`; `nextFundingTime` is retained as
metadata, not substituted for `observedAt`.

Canonical unit:

`DECIMAL_RATE`

The public Mark Price WebSocket also publishes funding rate at one- or three-second
cadence. That stream is technically qualified as a future higher-frequency source, but
v0.1 runtime should prefer REST polling first because the current P365 scheduler
architecture does not own a permanent WebSocket process.

Source verdict:

**QUALIFIED CANDIDATE — REST FIRST**

### 4.3 Settled funding-rate history

Candidate logical series:

`crypto.btc.binance_usdm_perpetual.funding_rate.settled`

Provider resource:

`GET https://fapi.binance.com/fapi/v1/fundingRate`

Qualified fields:

- `fundingRate`;
- `fundingTime`;
- `markPrice`;
- `rateType` when present.

Canonical observed time is `fundingTime`.

`rateType=Regular` and `rateType=Special` must remain distinguishable. A future
runtime must not silently mix special stock-dividend-related funding records into a
regular BTC perpetual funding series if such a row were ever returned.

Source verdict:

**QUALIFIED CANDIDATE**

The current audited documentation specifies request bounds and limit up to 1000 but does
not state a fixed maximum historical-retention horizon. P365 must not assume unlimited
history.

### 4.4 BTCUSDT perpetual basis rate

Candidate logical series:

`crypto.btc.binance_usdm_perpetual.basis_rate`

Provider resource:

`GET https://fapi.binance.com/futures/data/basis`

Required request scope:

- `pair=BTCUSDT`;
- `contractType=PERPETUAL`;
- `period=5m`.

Qualified canonical field:

`basisRate`

Canonical observed time is the provider `timestamp`, documented as the **start of the
period**.

Canonical unit:

`DECIMAL_RATE`

The endpoint also exposes index price, futures price, annualized basis rate and absolute
basis. Those fields remain supporting provenance/source facts; this v0.1 contract
freezes only `basisRate` as the primary MOVE evidence series.

Source verdict:

**QUALIFIED CANDIDATE**

Provider history limitation: only the latest 30 days.

### 4.5 BTCUSDT taker buy/sell ratio

Candidate logical series:

`crypto.btc.binance_usdm_perpetual.taker_buy_sell_ratio`

Provider resource:

`GET https://fapi.binance.com/futures/data/takerlongshortRatio`

Required request scope:

- `symbol=BTCUSDT`;
- `period=5m`.

Qualified canonical field:

`buySellRatio`

Canonical observed time is the provider `timestamp`, documented as the **start of the
period**.

Canonical unit:

`RATIO`

The endpoint also returns `buyVol` and `sellVol`. The audited official documentation
does not specify their units. CRYPTO-STRUCT-001A therefore **does not qualify their
absolute values for canonical P365 use**.

If absolute aggressive-buy/sell notional later becomes necessary, P365 must either obtain
an explicit unit contract or separately define a deterministic methodology from qualified
aggregate trades. It must not guess the units of `buyVol` / `sellVol`.

Source verdict:

**QUALIFIED CANDIDATE FOR RATIO ONLY**

Provider history limitation: only the latest 30 days.

## 5. Liquidation / forced-order evidence

Public market liquidation evidence is available from:

`{symbol}@forceOrder`

for `btcusdt` on the Binance USDⓈ-M market WebSocket.

The stream exposes event time plus force-order fields including symbol, side, original
quantity, price, average price, filled quantities and trade time.

However, this is **not an exhaustive liquidation tape**.

The current stream page describes one liquidation snapshot per symbol within each
1000ms interval. Binance's derivatives change log states that effective 14 Apr 2026 the
description was changed from the "latest" liquidation order to the **largest** liquidation
order. The live stream page still uses the older "latest" wording.

P365 resolves this conservatively:

- a received message proves an observed forced-order snapshot;
- it does not prove all liquidations in that second were captured;
- summing messages does not produce total Binance liquidation volume;
- absence of messages cannot be interpreted without proven continuous stream health;
- a gap/reconnect must remain explicit;
- user/account `forceOrders` REST history is not a substitute for market-wide
  liquidation evidence.

Source verdict:

**PARTIALLY QUALIFIED — OBSERVED LIQUIDATION SNAPSHOT ONLY**

Rejected meaning:

`TOTAL_LIQUIDATION_VOLUME`

No canonical liquidation Observation series is frozen in CRYPTO-STRUCT-001A. Transport,
coverage-health and durable event identity require a separate runtime/infrastructure
checkpoint.

## 6. Why REST-first is the first runtime boundary

The existing P365 production ownership model uses bounded HTTP acquisition plus Supabase
`pg_cron`. It does not currently own a permanent outbound WebSocket collector.

Four high-value Binance inputs can be acquired without changing that infrastructure:

1. 5m open-interest history;
2. current funding-rate state;
3. 5m basis rate;
4. 5m taker buy/sell ratio.

Settled funding history is also REST-accessible.

Therefore the first runtime checkpoint should be REST-only. Liquidation WebSocket
collection must not be hidden inside a request-scoped Vercel route or short-lived cron
invocation and claimed to be continuous.

## 7. Time semantics

The provider uses different timestamp meanings and P365 must preserve them.

| Metric | Provider time meaning | Canonical `observedAt` |
|---|---|---|
| Open-interest statistics | end of period | provider `timestamp` |
| Basis | start of period | provider `timestamp` |
| Taker buy/sell ratio | start of period | provider `timestamp` |
| Current funding state | current provider time | `time` |
| Settled funding history | funding settlement time | `fundingTime` |
| Liquidation snapshot | event + order trade time | not canonicalized in 001A; retain both |

`retrievedAt` always remains the time P365 successfully receives the response/message.

No bucket timestamp may be shifted merely to make cross-series timestamps line up.

## 8. Point-in-time and revision rules

A future runtime must reuse FND-018A append-only Observation identity.

For bounded 5m series:

`MARKET + seriesKey + provider observedAt → measurement identity`

For current funding snapshots, provider `time` owns the measurement time.

For settled funding history, `fundingTime` owns the measurement time.

Requirements:

- same measurement + unchanged factual value is idempotent;
- same measurement + changed factual value appends a revision;
- `retrievedAt` remains availability, not factual identity;
- later provider corrections must not overwrite prior Market Memory rows;
- source/venue/symbol/contract type/period and provider resource remain provenance;
- no later-known value may leak into an earlier MOVE investigation.

## 9. Missing, zero and absence semantics

`missing != zero`

Rules:

- provider empty/error/unavailable is not numeric zero;
- missing 5m bucket is not zero;
- missing OI is not zero open interest;
- missing taker ratio is not neutral flow;
- no captured liquidation snapshot is not automatically zero liquidation;
- WebSocket disconnection makes liquidation coverage `UNKNOWN`;
- an explicit numeric rate or ratio of zero is factual zero only when supplied by the
  provider.

## 10. Historical continuity

The source is sufficient for immediate MOVE investigation but has bounded provider-side
history:

- OI statistics: latest one month;
- basis: latest 30 days;
- taker buy/sell ratio: latest 30 days;
- funding-rate history: bounded request interface, but no fixed retention duration is
  stated in the audited endpoint documentation;
- public liquidation stream: live snapshot transport, not historical market liquidation
  REST.

P365 must build its own durable history if these metrics are needed beyond provider
retention.

A future backfill policy must be explicit and bounded. CRYPTO-STRUCT-001A does not
authorize a one-month bulk write.

## 11. Rate limits and operational scope

The audited public market endpoints do not require a user-data API key.

Relevant documented limits include:

- OI statistics: 1000 requests / 5 min / IP;
- taker buy/sell volume: 1000 requests / 5 min / IP;
- funding history shares 500 / 5 min / IP with funding-info;
- basis currently reports request weight 0;
- market WebSocket liquidation snapshots update at 1000ms;
- mark-price/funding WebSocket can update every second or every three seconds.

A future runtime must still use bounded cadence, timeout/error handling and P365's
existing cache/scheduler ownership. Public endpoints are not permission to poll
unboundedly.

## 12. Terms / use boundary

The current Binance Indonesia General Terms grant a nonexclusive licence to use Binance
IP as necessary to receive Binance services for personal non-commercial or **internal
business use**.

The same Terms prohibit using Binance Services for resale or commercial purposes,
including transactions on behalf of another person/entity, unless Binance expressly
agrees in writing. They also contain broad restrictions on automated acquisition by
methods not intended to be provided through Binance Services and on copying/storing/
redistributing Binance IP.

CRYPTO-STRUCT-001A therefore applies the conservative P365 boundary:

> **INTERNAL P365 USE ONLY / NO RAW DATA REDISTRIBUTION OR RESALE**

The official documented API/market-stream surfaces are the intended acquisition path;
website scraping is not authorized by this checkpoint.

A future runtime should persist only the minimum normalized factual measurements and
lineage required for private P365 operation, not mirror/rebroadcast Binance raw feeds.
Terms must be re-reviewed before any public, commercial, redistribution, external API,
or dataset-resale use.

This is a product-governance qualification, not legal advice.

## 13. Provider/source verdict

Metric-specific verdict:

| Metric | Verdict | Immediate MOVE suitability |
|---|---|---|
| 5m open interest | QUALIFIED_CANDIDATE | High |
| Current funding-rate state | QUALIFIED_CANDIDATE — REST FIRST | High |
| Settled funding history | QUALIFIED_CANDIDATE | Background/history |
| 5m basis rate | QUALIFIED_CANDIDATE | High |
| 5m taker buy/sell ratio | QUALIFIED_CANDIDATE — RATIO ONLY | High |
| Absolute `buyVol` / `sellVol` | UNQUALIFIED UNIT | Do not canonicalize |
| Liquidation force-order stream | PARTIALLY_QUALIFIED | Observed snapshots only |
| Total liquidation volume | REJECTED | Source does not provide exhaustive total |
| Aggregate trades | REFERENCE / POSSIBLE LATER DERIVATION | Not needed for first runtime |
| Top/global long-short ratios | DEFERRED | Not required by MOVE-002A |

Overall source verdict:

> **BINANCE USDⓈ-M BTCUSDT PERPETUAL: QUALIFIED CANDIDATE FOR INTERNAL MOVE MARKET-STRUCTURE EVIDENCE, WITH METRIC-SPECIFIC LIMITS**

## 14. Runtime gate

After owner merge, **CRYPTO-STRUCT-001B** may implement a bounded REST factual runtime
for only:

- open interest;
- current funding-rate state;
- settled funding history where needed for continuity;
- basis rate;
- taker buy/sell ratio.

CRYPTO-STRUCT-001B must:

1. use official `fapi.binance.com` market-data endpoints only;
2. pin `BTCUSDT` / USDⓈ-M / perpetual scope;
3. validate every provider response and finite numeric field;
4. preserve each endpoint's exact timestamp semantics;
5. retain `sourceId`, resource, symbol, period and contract scope;
6. reuse FND-018A identity/revisions and FND-010A provenance patterns;
7. preserve missing != zero;
8. keep `sumOpenInterest` in provider-native quantity units;
9. reject `sumOpenInterestValue` USD/USDT interpretation until qualified;
10. canonicalize `buySellRatio` only, not unqualified absolute volume fields;
11. keep current funding and settled funding as distinct series;
12. fail closed on wrong symbol/contract/source shape;
13. use bounded acquisition cadence rather than dashboard critical-path fetches;
14. add no causal interpretation, State/Regime/Risk/Intelligence or trading logic.

Liquidation collection is **not** part of CRYPTO-STRUCT-001B.

## 15. Explicit non-goals

CRYPTO-STRUCT-001A does not authorize:

- runtime/provider code;
- durable writes;
- database schema changes;
- production backfill;
- Supabase cron changes;
- persistent WebSocket infrastructure;
- API credentials;
- raw Binance feed redistribution;
- COIN-M or cross-exchange aggregation;
- ETH/altcoin derivatives expansion;
- options;
- top-trader positioning;
- long/short sentiment labels;
- total liquidation reconstruction;
- leverage/short-covering causal conclusions;
- State / Regime / Risk / Intelligence;
- prediction;
- BUY / SELL / LONG / SHORT;
- position sizing or execution.
