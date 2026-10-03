# P365 BTC Perpetual Order-Book Liquidity Source Qualification v0.1

**Checkpoint:** ORDER-BOOK-001B  
**Status:** HYPERLIQUID LIVE-QUALIFIED READ-ONLY / BINANCE FUTURES VERCEL-EGRESS UNAVAILABLE  
**Market family:** CRYPTO / DERIVATIVES / MARKET_STRUCTURE  
**Owner approval:** Hyperliquid + Binance Futures approved 4 Oct 2026

## 1. Product question

This checkpoint adds factual derivatives-liquidity evidence for:

> What does the current BTC perpetual order book look like on qualified venues?

It is intentionally separate from SPOT order-book evidence.

A current perp snapshot may support later investigation of leverage-market structure, but a
single snapshot does not prove that derivatives liquidity caused a price move.

## 2. Qualified providers

### 2.1 Hyperliquid BTC perpetual — active read-only source

Public endpoint:

`POST https://api.hyperliquid.xyz/info`

Body:

`{"type":"l2Book","coin":"BTC"}`

Current official API semantics:

- public/no API credential;
- response contains `coin`, provider `time`, and bid/ask `levels`;
- each level exposes price `px`, size `sz`, and resting-order count `n`;
- at most 20 levels are returned per side;
- `l2Book` has REST weight 2 under the current 1200-weight/minute IP budget.

P365 requests native/full precision. It does not use price aggregation parameters in this
checkpoint.

### 2.2 Binance USDⓈ-M BTCUSDT perpetual — semantic source, deployment unavailable

Public endpoint contract:

`GET https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=500`

Qualified fields:

- `lastUpdateId`;
- `E` message output time;
- `T` transaction time;
- bid/ask price and BTC quantity levels.

The current P365 Vercel egress receives HTTP 451 with a Binance restricted-location /
eligibility message.

P365 classifies this as:

- status = `UNAVAILABLE`;
- errorCode = `UPSTREAM_UNAVAILABLE`.

It is not treated as authentication failure and is not bypassed through alternate routing.

## 3. Shared factual geometry

Methodology:

`btc-perp-depth-geometry-v1`

Both venues remain separate evidence objects.

Shared outputs:

- asset = BTC;
- marketType = PERPETUAL;
- venue;
- instrument;
- provider-derived observedAt;
- retrievedAt;
- best bid;
- best ask;
- midpoint;
- spread;
- spread bps;
- BTC bid depth;
- BTC ask depth;
- base-depth imbalance;
- coverage at 5 / 10 / 25 / 50 bps.

Hyperliquid additionally retains resting-order counts because the provider exposes `n`.

Binance Futures retains:

- transaction time `T` as provider observedAt;
- message output time `E`;
- `lastUpdateId` as provider sequence lineage.

## 4. Why BTC base depth is the comparison unit

Hyperliquid and Binance USDⓈ-M have different venue/quote/collateral conventions.

ORDER-BOOK-001B therefore compares only the economically compatible base quantity:

`BTC depth`

P365 does not:

- add Hyperliquid quote notional to Binance USDT notional;
- assume USDC = USDT = USD for aggregation;
- create one “global perpetual liquidity” number;
- assign venue weights.

Cross-venue evidence is comparative, not additive.

## 5. Band coverage

Reporting bands remain:

- 5 bps;
- 10 bps;
- 25 bps;
- 50 bps.

These are descriptive geometry bands, not materiality thresholds.

A band is COMPLETE only when returned bids and asks extend through both band boundaries.

Otherwise visible depth is retained with:

`coverage = PARTIAL`

This is especially important for Hyperliquid because the public `l2Book` endpoint returns
at most 20 levels per side.

## 6. Hyperliquid live proof — 4 Oct 2026

One Vercel preview execution returned:

- provider status = SUCCESS;
- provider snapshot time = `2026-10-03T20:28:43.776Z`;
- P365 retrievedAt = `2026-10-03T20:28:44.511Z`;
- 20 bid + 20 ask levels;
- best bid = `84,843`;
- best ask = `84,844`;
- spread = `1`;
- spread ≈ `0.11786 bps`;
- visible bid depth = `113.31997 BTC`;
- visible ask depth = `22.57484 BTC`;
- visible base-depth imbalance ≈ `+0.66776`;
- bid resting-order count = `160`;
- ask resting-order count = `92`;
- writes performed = false.

All 5/10/25/50 bps bands were PARTIAL in that proof because the native 20-level response
did not extend through the 5 bps boundary.

Therefore the 113.31997 / 22.57484 BTC figures are visible lower-bound depth from the
returned levels, not complete 5 bps or wider depth.

No bullish/bearish conclusion is authorized from the proof sample.

## 7. Binance Futures live proof — current Vercel environment

The same preview execution reached Binance USDⓈ-M and received:

`HTTP 451 — Service unavailable from a restricted location according to Eligibility`

This is an operational provider-region restriction.

The adapter remains implemented and schema-tested, but Binance Futures is not an active
P365 runtime source from the current deployment environment.

Hyperliquid technical success does not depend on Binance Futures availability.

## 8. Interpretation boundary

Permitted:

- “Hyperliquid BTC perp spread was X bps at provider time T.”
- “The visible top-20 bid depth exceeded visible ask depth.”
- “The 5 bps band was PARTIAL because the returned book did not reach the boundary.”
- “Binance Futures was unavailable from the deployment region.”

Not permitted:

- “The whole derivatives market is bid-heavy.”
- “Hyperliquid liquidity caused BTC to rise.”
- “113 BTC is complete 5 bps depth” when coverage is PARTIAL.
- “Binance confirms Hyperliquid” while Binance is unavailable.
- directional prediction or trading advice.

## 9. Runtime boundary

ORDER-BOOK-001B authorizes:

- Hyperliquid public read-only `l2Book`;
- Binance USDⓈ-M public depth adapter with explicit region-unavailable semantics;
- strict book validation;
- provider timestamps/lineage;
- current per-venue 5/10/25/50 bps geometry;
- focused tests;
- temporary preview live proof.

It does not authorize:

- durable persistence;
- Supabase cron;
- WebSocket/local-book history;
- historical liquidity deterioration measurement;
- cross-venue additive aggregation;
- MOVE evidence wiring;
- UI;
- causal attribution;
- State / Regime / Risk / Intelligence;
- trading signals.

## 10. Acceptance result

**Hyperliquid: TECHNICAL LIVE PASS for current read-only BTC perpetual liquidity.**

**Binance USDⓈ-M Futures: SEMANTIC/ADAPTER QUALIFIED, OPERATIONALLY UNAVAILABLE from
current Vercel egress.**

The original historical move-window question remains open because neither current-snapshot
adapter creates point-in-time order-book history.
