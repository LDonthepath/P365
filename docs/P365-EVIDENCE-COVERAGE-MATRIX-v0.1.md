# P365 Evidence Coverage Matrix v0.1

**Checkpoint:** CRYPTO-STRUCT-001A supporting scope map  
**Status:** PROPOSED PRIORITIZATION MATRIX — OWNER MERGE PENDING  
**Product scope:** Macro explanatory layer → Crypto + Gold first-class markets  
**Primary use case:** Intraday market awareness and move-driven investigation  
**Implementation effect:** Documentation/prioritization only. No provider runtime, credentials, persistence, scheduler, UI, State/Regime/Risk/Intelligence, prediction, or trading logic.

## 1. Purpose

P365 must not become a collection of unrelated indicators.

Every evidence family is admitted only when it helps answer a specific market question
after a material BTC or Gold move.

Priority classes:

- **P0** — required to make intraday move investigation materially more useful;
- **P1** — high-value confirmation/background evidence after P0 coverage exists;
- **P2** — contextual/enrichment evidence that must not block the MVP;
- **DEFER** — do not implement until a concrete downstream question requires it.

Cadence classes:

- **SYNC** — minute/intraday evidence suitable for the MOVE window;
- **NEAR** — tens of minutes / session evidence;
- **SLOW** — daily/weekly background;
- **EVENT** — timestamped catalyst evidence.

The matrix is provider-neutral. Provider names are candidates, not architecture.

## 2. Coverage summary

| Evidence family | Market question | Priority | Cadence role | Current P365 state | Free-first direction |
|---|---|---:|---|---|---|
| BTC / ETH / Gold / DXY price | What moved and what confirmed/diverged? | P0 | SYNC | **ACTIVE** | Existing qualified sources |
| Asia FX transmission — USDJPY / USDCNH | Did Japan/yen or China/offshore-RMB pricing reprice with the move? | P0 | SYNC | **ASIA-MACRO-001B PRODUCTION ACTIVE / DURABLE FORWARD** | Existing Yahoo trial path; fail-closed FX freshness |
| Continuous move materiality | Is the move historically unusual? | P0 | SYNC | **ACTIVE / MOVE-001C** | Existing Market Memory |
| Move evidence bundle | What point-in-time evidence was actually knowable around a material MOVE? | P0 | SYNC/EVENT/SLOW | **MOVE-002B READ-ONLY RUNTIME IMPLEMENTED** | Repository-backed composition only; current-only/non-durable families remain explicit gaps |
| Scheduled macro events | Was there a qualified scheduled catalyst? | P0 | EVENT | **ACTIVE** | Existing event pipeline |
| BTC derivatives OI | Is leverage exposure expanding/contracting? | P0 | SYNC | **TECHNICAL LIVE PASS / DURABLE-USE GATE** | Coinalyze free-first |
| BTC funding | Is perpetual positioning becoming expensive/crowded? | P0 | SYNC/NEAR | **LIVE-QUALIFIED / DURABLE-USE GATE** | Coinalyze free-first |
| BTC liquidations | Is forced deleveraging consistent with the move? | P0 | SYNC | **TECHNICAL LIVE PASS — SPARSE WINDOW / DURABLE-USE GATE** | Coinalyze free-first; ChainVector validation |
| BTC spot trade flow | Is spot participation confirming the move? | P0 | SYNC | **SPOT-FLOW-001A/001B/001C PRODUCTION ACTIVE / DURABLE FORWARD / BYBIT VERCEL-EGRESS UNAVAILABLE** | Binance Spot completed 5m taker-flow persists via existing `p365-market-fast`; MOVE-002B replay consumption remains separate |
| BTC order-book liquidity | Did depth/spread deteriorate or imbalance around the move? | P0 | SYNC | **SPOT BINANCE + PERP HYPERLIQUID CURRENT SNAPSHOTS LIVE-QUALIFIED / HISTORICAL WINDOW MISSING** | Binance Spot current depth + Hyperliquid BTC perp current depth; Binance Futures Vercel-egress unavailable |
| Unscheduled news/catalysts | Was there a non-calendar information shock? | P0 | EVENT/NEAR | **NEWS-001B/001C/001D PRODUCTION ACTIVE / DURABLE FORWARD HISTORY ACCUMULATING** | GDELT GAL BTC+Gold snapshots persist every fast-market cycle via existing `p365-market-fast`; no pre-activation backfill is claimed |
| Intraday rates / policy pricing | Did rates/real-yield/policy pricing reprice with BTC/Gold? | P0 | SYNC | **MACRO-RATES-001A/001B FREE-ONLY / PAID PATHS REJECTED / ZT+TN PROXY RISK-QUALIFIED ONLY / NO RUNTIME / REAL-YIELD INTRADAY UNRESOLVED** | Daily FRED remains canonical background; if any future free lawful proxy is found, ZT+TN is preferred over ZT+ZN after tenor-fidelity review |
| BTC basis | Is futures pricing rich/cheap vs spot/index? | P1 | SYNC | **MISSING / VENUE FALLBACK AVAILABLE** | Official exchange basis where qualified |
| BTC options IV / DVOL / skew | Did expected volatility/hedging reprice? | P1 | SYNC/NEAR | **MISSING** | Deribit public API candidate |
| BTC ETF net flow | Is institutional spot flow supportive/contradictory? | P1 | SLOW | **ACTIVE** | SoSoValue existing |
| Stablecoin supply | Is crypto liquidity expanding/contracting? | P1 | SLOW | **ACTIVE** | DefiLlama existing |
| Stablecoin lending/borrowing rates | Is crypto dollar liquidity getting tighter/looser? | P1 | NEAR/SLOW | **MISSING** | DefiLlama reference-rate family candidate |
| On-chain exchange flow | Is coin/stablecoin supply moving toward/from exchanges? | P1 | NEAR/SLOW | **MISSING** | Free provider search required |
| Large-transfer / whale flow | Is large-holder transfer activity unusual? | P1 | NEAR | **MISSING** | Free provider search required |
| Gold CFTC positioning | Is Gold speculative positioning stretched/changing? | P1 | SLOW | **ACTIVE** | CFTC existing |
| Gold ETF flow/holdings | Is investor Gold demand confirming macro move? | P1 | SLOW | **MISSING** | Free source qualification required |
| Broad stablecoin/DeFi rates | Is crypto financing liquidity tightening? | P1 | SLOW | **PARTIAL/MISSING** | DefiLlama candidate |
| Bitcoin mempool/fees | Is network congestion/activity unusual? | P2 | NEAR | **MISSING** | mempool.space public API |
| Bitcoin network fundamentals | Hashrate, difficulty, active-address/network context | P2 | SLOW | **MISSING** | Coin Metrics Community candidate |
| News attention / tone | Is attention/tone abruptly changing? | P2 | NEAR | **MISSING** | GDELT 15m timeline candidate |
| Fear & Greed | Broad retail sentiment backdrop | P2 | SLOW | **MISSING** | Alternative.me free API |
| Social sentiment | Is social attention/crowding changing intraday? | P2 | NEAR | **DEFER / no defensible free realtime source selected** | Revisit only if P0/P1 leave explanatory gap |
| Advanced options gamma/dealer models | Is dealer hedging mechanically amplifying moves? | DEFER | SYNC | **DEFERRED** | Requires explicit methodology/provider |
| Advanced on-chain valuation | MVRV/SOPR/realized-cap style context | P2 | SLOW | **DEFERRED** | Add only when user-value chain requires it |

## 3. P0 — Intraday evidence required for move explanation

### 3.1 Market/cross-asset fingerprint — ACTIVE

Already available:

- BTC spot;
- ETH spot;
- Gold futures;
- DXY;
- USDJPY and offshore USDCNH synchronous FX transmission evidence;
- MOVE-001C historical materiality.

Role:

- establish what moved;
- establish synchronous confirmation/divergence;
- never infer causality from co-movement alone.

No new provider is required for this family before MOVE evidence bundling. USDJPY/USDCNH are now collected by the existing Supabase `p365-market-fast` five-minute owner; they remain factual transmission evidence and do not imply Japan/China causality.

### 3.2 BTC derivatives / leverage — IN QUALIFICATION

Required facts:

- per-contract/per-venue OI;
- market-wide derived OI where methodology is qualified;
- funding;
- long/short liquidation;
- later: venue basis.

Primary question:

> Is the move consistent with leverage expansion, leverage contraction, or forced
> deleveraging?

Current free-first candidate:

- Coinalyze raw 1m/5m per-market evidence.

Validation/reference:

- ChainVector Free where useful;
- official exchange APIs for venue-level checks.

Interpretation boundary:

- price up + OI down can be **consistent with** short-covering/deleveraging;
- price up + OI up can be **consistent with** new leveraged participation;
- neither proves a cause without supporting flow/catalyst evidence.

### 3.3 Spot trade flow — PRODUCTION ACTIVE / DURABLE FORWARD

Required facts:

- aggressive-buy / aggressive-sell or equivalently qualified trade-side evidence;
- volume;
- CVD / net aggressive-flow only under explicit methodology;
- venue identity and coverage.

Primary question:

> Is actual spot participation confirming the move, or is the move primarily visible in
> derivatives?

Current production coverage:

- Binance Spot public 5m klines are the approved primary venue source because they expose total BTC volume + taker-buy BTC volume for a completed provider-native window;
- completed Binance BTCUSDT windows now persist every fast-market cycle through the existing Supabase `p365-market-fast` owner;
- durable records retain venue/pair identity, completed-window effective time and P365 retrieval cutoff;
- production idempotency and point-in-time readback are proven;
- Bybit Spot public recent trades remain an approved secondary taker-side sample, but current Vercel egress cannot reach the provider;
- no market-wide spot-flow aggregate is authorized until a venue universe and normalization methodology are frozen.

The remaining P0 gap is historical consumption inside MOVE-002B, not acquisition continuity.

### 3.4 Order-book liquidity — CURRENT SNAPSHOTS PARTIALLY COVERED

Required facts:

- bid/ask spread;
- depth at explicit bps bands;
- order-book imbalance under explicit depth bands;
- temporary depth withdrawal / recovery;
- source venue;
- explicit SPOT vs PERPETUAL market type;
- provider timestamp/sequence where available.

Current coverage:

- Binance Spot BTCUSDT current book: live-qualified;
- Hyperliquid BTC perpetual current book: live-qualified;
- Binance USDⓈ-M BTCUSDT perpetual adapter: qualified but Vercel-egress unavailable;
- historical move-window book state: still missing.

Primary question:

> Did the price move through a normal book, or through unusually thin liquidity?

Boundary:

- one exchange order book is venue evidence, not the entire BTC market;
- snapshots must not be presented as complete order-flow history;
- exact book reconstruction requires transport/sequence semantics.

### 3.5 Unscheduled news / catalyst — CURRENT 15M IMPLEMENTED / HISTORICAL WINDOW MISSING

Scheduled economic events are already covered, but a material move may have no Event parent.

Current approved source:

- GDELT Article List (GAL) rolling RSS feed as the live hot path;
- GDELT DOC 2.0 remains semantically useful but is not a hot-path dependency because
  current Vercel shared-egress rate limiting is unreliable.

Current GAL coverage:

- updated every minute;
- rolling 15-minute monitored-article window;
- title + URL + item/feed timestamps;
- local BTC/Gold candidate filtering;
- no historical replay without durable acquisition.

Primary question:

> Was new information published around the move that could plausibly be relevant?

P365 requirements:

- preserve article publication / first-seen / retrieval times where available;
- source article remains evidence;
- GDELT classification/tone is not itself proof of causality;
- candidate headline proximity is not enough to mark a driver CONFIRMED;
- official issuer/government/exchange sources should outrank secondary reporting when
  available.

### 3.6 Intraday rates / policy pricing — SOURCE-QUALIFIED / RUNTIME OPEN

Required for both BTC and Gold:

- US 2Y nominal intraday pricing;
- US 10Y nominal intraday pricing;
- real-yield/TIPS evidence only where its economic meaning is explicitly qualified;
- policy-expectation / futures pricing where separately qualified.

Primary question:

> Did the macro pricing complex reprice during the same move?

MACRO-RATES-001A source qualification establishes:

- Treasury/FRED `DGS2`, `DGS10`, and `DFII10` remain authoritative **daily background** and are not intraday substitutes;
- BrokerTec on-the-run U.S. Treasuries are the preferred audited **direct cash-market** path for 2Y/10Y if licensing and exact runtime schema are approved;
- CME `2YY` / `10Y` Yield futures are the preferred audited **explicit futures proxy** if direct cash is impractical, but they must remain `FUTURE` evidence and require authorized market-data access;
- Twelve Data fixed income remains an aggregator candidate, but MACRO-RATES-001B stopped at the access/entitlement gate: P365 has no Twelve Data credential, public Basic/demo access does not establish US2Y/10Y fixed-income market-data entitlement, exact 10Y identity remains unverified, and no live 5m/history/latency/source-lineage proof was executed;
- existing Massive access technically proves dense 5m standard Treasury futures pricing on both curve points: ZTZ6 produced 527 bars / 3,050,214 volume / 174,869 transactions and ZNZ6 produced 528 bars / 6,765,907 volume / 384,754 transactions in the bounded session window;
- Massive Yield Futures were asymmetric in the same window: 10YV6 produced 344 bars while both active 2YY singles produced zero bars, so 2YY+10Y is not selected as the primary two-tenor synchronous proxy;
- the earlier ZT/ZN preference is superseded for macro-tenor fidelity: CME ZN's deliverable basket is materially inside 10Y, while TN Ultra 10-Year is closer to the 10Y cash point; a bounded TNZ6 test still showed 525 five-minute bars, 2,029,436 volume and 167,668 transactions;
- if a free rights-compatible source later qualifies, ZT+TN is the preferred proxy family; it remains **FUTURES PRICE PROXY** evidence, not cash yields;
- GovPX provides strong realtime TIPS market coverage, but public documentation does not prove a provider-native intraday constant-maturity series equivalent to `DFII10`;
- therefore intraday 10Y constant-maturity real yield remains `MISSING_HIGH_VALUE_EVIDENCE`.

The existing research/event ZT path must not be silently relabeled as canonical US 2Y
cash-yield evidence.

The separate policy-path contract remains unchanged: CME FedWatch is semantically qualified
but runtime licensing/entitlement remains open.

Normative source audit:

`P365-INTRADAY-US-RATES-SOURCE-QUALIFICATION-v0.1.md`

No runtime/provider activation is authorized by MACRO-RATES-001A or MACRO-RATES-001B. Owner policy is now **FREE-ONLY**: paid Massive/CME, Twelve Data and BrokerTec paths are rejected for the current MVP. Proxy risk review prefers ZT+TN if a future free, legally compatible source qualifies; until then intraday rates remains explicit missing evidence.

## 4. P1 — High-value confirmation and market-specific context

### 4.1 BTC basis

Role:

- futures premium/discount;
- leverage/pricing confirmation.

A venue-native basis is acceptable when labeled as venue-specific evidence.
A market-wide basis requires a separate aggregation methodology.

### 4.2 Options / volatility

Required candidate facts:

- option-chain OI;
- option volume;
- implied volatility;
- bid/ask IV where qualified;
- DVOL or equivalent volatility index;
- skew / risk reversal under a frozen methodology;
- expiry concentration.

Free-first candidate:

- Deribit public API, subject to a dedicated source-qualification checkpoint.

Role:

> Did the move coincide with repricing of expected volatility or asymmetric hedging
> demand?

Options evidence is P1 because it can materially improve move interpretation but should
not block first leverage/spot/news coverage.

### 4.3 BTC ETF flow — ACTIVE SLOW BACKGROUND

Existing SoSoValue flow remains:

- qualified daily institutional-flow evidence;
- useful entering the move;
- not minute-level cause evidence.

### 4.4 Stablecoin liquidity — ACTIVE + EXPANSION GAP

Existing:

- DefiLlama USD stablecoin market cap.

Potential expansion:

- reference supply/borrow rates for major stablecoins;
- protocol/asset borrowing-cost evidence where provider semantics are qualified;
- later exchange stablecoin balance / flow if a qualified source exists.

DefiLlama currently exposes market-size-weighted stablecoin reference supply/borrow
rates across major lending markets. These are candidates for a separate source/runtime
qualification, not automatically canonical data.

### 4.5 On-chain exchange / large-holder flows — MISSING P1

High-value candidates:

- BTC exchange inflow/outflow;
- exchange reserves/balance;
- large-holder / whale transfers;
- miner-to-exchange flow;
- stablecoin exchange inflow/outflow.

Role:

> Is observable coin/stablecoin movement consistent with changing potential supply or
> demand conditions?

Boundary:

- address attribution is methodology/provider dependent;
- raw blockchain transfer != exchange flow without attribution;
- do not treat a large transfer as sell pressure without destination/context.

No free source is frozen yet for attributed exchange flows.

### 4.6 Gold investor flow / positioning

Active:

- Gold CFTC Managed Money/COT evidence.

Missing:

- qualified Gold ETF flow/holdings.

Cadence is slow/background. It should confirm structural demand/positioning, not explain
a 15-minute Gold candle by itself.

## 5. P2 — Context and enrichment

### 5.1 Bitcoin mempool / fee pressure

Free candidate:

- mempool.space public REST API.

Useful factual context:

- mempool backlog;
- recommended fee levels;
- projected-block fee pressure;
- difficulty adjustment / hashrate-related network endpoints where relevant.

This is network-state evidence, not a default market-price driver.

### 5.2 Bitcoin network fundamentals

Free candidate:

- Coin Metrics Community API.

Community API:

- requires no API key for community endpoints;
- exposes community data under a Creative Commons license;
- provides network/asset metric catalogs.

Potential P2 evidence:

- network activity;
- active-address style metrics where available;
- supply/network fundamentals;
- other BTC network metrics.

Community availability must be checked metric-by-metric; paid catalog visibility does not
mean a metric is accessible on the free endpoint.

### 5.3 Attention / sentiment

Free candidates:

**GDELT**

- 15-minute news-volume/tone timelines for short windows;
- candidate article lists.

**Alternative.me Fear & Greed**

- free API;
- broad sentiment index;
- attribution required.

Fear & Greed is SLOW background and must not be used as a 5-minute catalyst.

GDELT attention/tone can be nearer to intraday cadence but remains media evidence, not
market positioning.

Social-media sentiment is deferred until a free realtime source is both semantically
useful and operationally defensible.

## 6. Evidence-family ordering for the MVP

The implementation order is intentionally not the same as the conceptual evidence tree.

### Phase A — P0 market mechanics

1. derivatives OI/funding/liquidation;
2. spot trade-flow;
3. order-book liquidity;
4. unscheduled news/catalyst;
5. intraday rates/policy pricing.

### Phase B — P1 confirmation

6. basis;
7. options / volatility;
8. on-chain exchange/large-holder flow;
9. stablecoin/DeFi liquidity expansion;
10. Gold ETF flow/holdings.

### Phase C — P2 enrichment

11. Bitcoin mempool/network context;
12. attention/tone;
13. Fear & Greed;
14. advanced on-chain/network valuation;
15. social sentiment only if a concrete explanatory gap remains.

Existing ETF/stablecoin/CFTC data remain active throughout; this ordering describes new
coverage work only.

## 7. Mixed-provider architecture rule

P365 should deliberately use mixed providers when that improves evidence quality.

Example architecture:

```text
PRICE / CROSS-ASSET
existing qualified sources
        |
DERIVATIVES
Coinalyze free-first + validation sources
        |
SPOT / ORDER BOOK
official exchange public APIs
        |
OPTIONS
Deribit candidate
        |
ETF FLOW
SoSoValue
        |
STABLECOIN / DEFI
DefiLlama
        |
ON-CHAIN / NETWORK
Coin Metrics Community + mempool.space
        |
NEWS / ATTENTION
GDELT
        |
SENTIMENT BACKGROUND
Alternative.me
        |
MACRO
existing sources + future intraday rates/pricing source
```

Rules:

- provider-specific shapes stay outside canonical reasoning;
- economic meaning determines the series, not provider branding;
- provider/venue stays in provenance;
- no source gets privileged simply because it supplies many metric families;
- free-first does not mean low-quality-first;
- a paid source may be reconsidered only when a documented evidence gap remains after
  free sources are exhausted.

## 8. Causal-evidence ladder

Evidence coverage does not automatically authorize causal language.

P365 should progress through:

```text
MATERIAL MOVE
    ↓
SYNCHRONOUS FACTS
    ↓
CANDIDATE DRIVER
    ↓
SUPPORTING / CONTRADICTING EVIDENCE
    ↓
EVIDENCE COMPLETE?
    ├─ no  → UNEXPLAINED / EVIDENCE_INCOMPLETE
    └─ yes → methodology-qualified interpretation
```

Examples of stronger bundles:

### Candidate: short-covering / deleveraging

Potential supporting evidence:

- BTC price higher;
- OI falling;
- short-liquidation activity elevated;
- spot flow not strongly contradictory;
- no stronger scheduled/unscheduled catalyst discovered.

Wording remains:

> **consistent with short-covering / deleveraging**

until an approved methodology defines a stronger causal claim.

### Candidate: leverage-led expansion

Potential supporting evidence:

- BTC price higher;
- OI rising;
- funding/basis rising;
- spot-flow confirmation weak or mixed.

This does not mean the move must reverse.

### Candidate: spot-led demand

Potential supporting evidence:

- BTC price higher;
- qualified spot buy pressure/CVD positive;
- OI flat/down or not expanding materially;
- derivatives not dominant.

### Candidate: macro repricing

Potential supporting evidence:

- qualified intraday rates/policy pricing moves;
- DXY/Gold/ETH response consistent;
- relevant scheduled or unscheduled macro catalyst.

Again, relationship evidence is not causality by itself.

## 9. Acceptance gate

This matrix is complete enough for MVP prioritization when:

1. every new metric maps to a user question;
2. P0/P1/P2 is explicit;
3. cadence role is explicit;
4. current coverage vs missing coverage is explicit;
5. free-first provider candidates are recorded without activating them;
6. slow data cannot masquerade as intraday causes;
7. market-wide vs venue-specific evidence is explicit;
8. on-chain attribution is kept distinct from raw chain activity;
9. sentiment remains context unless methodology proves stronger relevance;
10. missing evidence is allowed to result in `UNEXPLAINED`;
11. State/Regime/Risk/Intelligence and trading semantics remain inactive.

## 10. Immediate handoff

The P0 source-qualification sequence has progressed through derivatives, spot-flow,
order-book, unscheduled-news and intraday-rates qualification.

The active composition runtime is now merged:

**MOVE-002B — Read-Only Move Evidence Bundle Runtime**

MOVE-002B does not add another provider. It consumes durable point-in-time facts already
available and exposes unresolved temporal gaps explicitly:

- Coinalyze derivatives: technically live-qualified, durable replay not approved;
- Binance spot-flow: durable FORWARD acquisition is production-active; MOVE-002B historical-Evidence consumption remains pending;
- spot/perp order books: current snapshots, historical window missing;
- GDELT GAL: durable forward snapshot acquisition is now production-active; pre-activation history remains unavailable and MOVE-002B historical-Evidence wiring remains separate;
- intraday rates: FREE_ONLY / no approved runtime.

NEWS-001D production activation closes the acquisition side of the unscheduled-news gap:
the remaining news work is consumption/replay integration, not another provider or scheduler.

SPOT-FLOW-001C likewise closes the acquisition-continuity side of BTC spot taker-flow:
the remaining spot-flow work is MOVE-002B historical replay consumption and later evidence composition, not another scheduler or fake backfill.

Those gaps may be addressed later as isolated checkpoints only when their source/use boundary
is defensible. Options/on-chain/sentiment expansion must not pre-empt unresolved P0 evidence
continuity without a concrete product reason.
