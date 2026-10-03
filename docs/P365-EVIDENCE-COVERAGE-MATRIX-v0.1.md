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
| Continuous move materiality | Is the move historically unusual? | P0 | SYNC | **ACTIVE / MOVE-001C** | Existing Market Memory |
| Scheduled macro events | Was there a qualified scheduled catalyst? | P0 | EVENT | **ACTIVE** | Existing event pipeline |
| BTC derivatives OI | Is leverage exposure expanding/contracting? | P0 | SYNC | **LIVE-QUALIFIED / DURABLE-USE GATE** | Coinalyze free-first |
| BTC funding | Is perpetual positioning becoming expensive/crowded? | P0 | SYNC/NEAR | **LIVE-QUALIFIED / DURABLE-USE GATE** | Coinalyze free-first |
| BTC liquidations | Is forced deleveraging consistent with the move? | P0 | SYNC | **LIVE-QUALIFIED SPARSE WINDOW / DURABLE-USE GATE** | Coinalyze free-first; ChainVector validation |
| BTC spot trade flow | Is spot participation confirming the move? | P0 | SYNC | **MISSING** | Official exchange public APIs; source qualification required |
| BTC order-book liquidity | Did depth/spread deteriorate or imbalance around the move? | P0 | SYNC | **MISSING** | Official exchange public APIs; methodology required |
| Unscheduled news/catalysts | Was there a non-calendar information shock? | P0 | EVENT/NEAR | **MISSING** | GDELT free candidate + official-source verification |
| Intraday rates / policy pricing | Did rates/real-yield/policy pricing reprice with BTC/Gold? | P0 | SYNC | **MISSING** | Free/source search still required |
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
- MOVE-001C historical materiality.

Role:

- establish what moved;
- establish synchronous confirmation/divergence;
- never infer causality from co-movement alone.

No new provider is required for this family before MOVE evidence bundling.

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

### 3.3 Spot trade flow — MISSING P0

Required facts:

- aggressive-buy / aggressive-sell or equivalently qualified trade-side evidence;
- volume;
- CVD / net aggressive-flow only under explicit methodology;
- venue identity and coverage.

Primary question:

> Is actual spot participation confirming the move, or is the move primarily visible in
> derivatives?

Free-first direction:

- official exchange public trade APIs / streams;
- start venue-specific and retain venue identity;
- do not fabricate a market-wide spot-flow aggregate until a venue universe and
  normalization methodology are frozen.

This is higher priority than broad sentiment.

### 3.4 Order-book liquidity — MISSING P0

Required facts:

- bid/ask spread;
- depth at explicit bps bands;
- order-book imbalance under explicit depth bands;
- temporary depth withdrawal / recovery;
- source venue.

Primary question:

> Did the price move through a normal book, or through unusually thin liquidity?

Boundary:

- one exchange order book is venue evidence, not the entire BTC market;
- snapshots must not be presented as complete order-flow history;
- exact book reconstruction requires transport/sequence semantics.

### 3.5 Unscheduled news / catalyst — MISSING P0

Scheduled economic events are already covered, but a material move may have no Event parent.

Free candidate:

- GDELT DOC/event/news surfaces.

Relevant GDELT properties:

- short-window timelines can operate at 15-minute resolution;
- article-volume timeline can expose attention spikes;
- article lists can identify candidate contemporaneous headlines.

Primary question:

> Was new information published around the move that could plausibly be relevant?

P365 requirements:

- preserve article publication / first-seen / retrieval times where available;
- source article remains evidence;
- GDELT classification/tone is not itself proof of causality;
- candidate headline proximity is not enough to mark a driver CONFIRMED;
- official issuer/government/exchange sources should outrank secondary reporting when
  available.

### 3.6 Intraday rates / policy pricing — MISSING P0

Required for both BTC and Gold:

- US 2Y;
- US 10Y;
- real yield where intraday qualified;
- policy-expectation / futures pricing where qualified.

Primary question:

> Did the macro pricing complex reprice during the same move?

Current FRED daily facts remain useful background but cannot answer this question.

The existing research/event ZT path must not be silently relabeled as canonical US 2Y
cash-yield evidence.

Provider selection remains open. This gap is **P0** and should be source-qualified after
the derivatives live gate or in parallel if it does not block the current PR.

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

The immediate active work remains:

**CRYPTO-STRUCT-001B — Coinalyze Free Live Qualification + Aggregation Methodology Freeze**

After that, the next missing **P0** families should be addressed in this order unless new
evidence changes the priority:

1. BTC spot-flow source qualification;
2. BTC order-book liquidity source qualification;
3. unscheduled-news/catalyst source qualification;
4. intraday rates/policy-pricing source qualification.

Options/on-chain/sentiment expansion must not pre-empt these P0 gaps.
