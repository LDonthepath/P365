# P365 BTC Order-Book Liquidity Source Qualification v0.1

**Checkpoint:** ORDER-BOOK-001A  
**Status:** READ-ONLY IMPLEMENTATION / LIVE PROOF PENDING  
**Provider:** Binance Spot (already owner-approved)  
**Scope:** current BTCUSDT order-book geometry only

## 1. Product question

This checkpoint adds factual evidence for:

> Is the current BTC spot book wide, shallow, deep, or side-imbalanced on a qualified venue?

It does **not** yet answer whether liquidity deteriorated during a past move.

## 2. Source

Primary public endpoint:

`GET https://data-api.binance.vision/api/v3/depth`

Frozen request:

- symbol = `BTCUSDT`;
- default limit = `500`;
- authentication = none;
- data source = Binance memory/current book snapshot.

Official Binance documentation states the endpoint returns current limited market depth,
with `lastUpdateId`, bid price/quantity levels and ask price/quantity levels. Continuous
book reconstruction requires a local book built from snapshot + WebSocket depth updates;
that is outside ORDER-BOOK-001A.

## 3. Time semantics

The REST depth response has no exchange event timestamp.

Therefore:

- P365 must not invent provider `observedAt`;
- snapshot time basis = `P365_RETRIEVED_AT`;
- `lastUpdateId` is retained as provider lineage;
- this evidence describes the book only at retrieval time.

A future move-window historical liquidity feature requires durable sampling or a qualified
WebSocket local-book collector.

## 4. Factual metrics

Top of book:

- best bid USDT;
- best ask USDT;
- midpoint USDT;
- spread USDT;
- spread bps.

Depth geometry is reported at fixed descriptive bands:

- 5 bps;
- 10 bps;
- 25 bps;
- 50 bps.

These bands are **reporting geometry**, not thin/deep materiality thresholds.

For every band P365 records:

- bid depth BTC;
- ask depth BTC;
- bid native quote notional USDT;
- ask native quote notional USDT;
- quote-notional imbalance:
  `(bid - ask) / (bid + ask)`;
- `COMPLETE` or `PARTIAL` band coverage.

No USDT→USD conversion is performed.

## 5. Coverage rule

A band is `COMPLETE` only if the returned depth extends beyond both the bid and ask band
boundaries around midpoint.

If the returned 500-level snapshot does not reach either boundary:

- computed visible depth remains factual;
- coverage is `PARTIAL`;
- P365 must not present it as full band liquidity.

## 6. Interpretation boundary

Permitted:

- “Binance BTCUSDT spread was 0.8 bps at retrieval.”
- “Visible bid notional inside 10 bps exceeded visible ask notional.”
- “50 bps depth coverage was partial.”

Not permitted from one snapshot:

- “Liquidity deteriorated during the rally.”
- “Thin liquidity caused the move.”
- “The whole BTC market is bid-heavy.”
- “Price will rise/fall.”

Historical change requires repeated point-in-time evidence. Causality requires additional
evidence and explicit methodology.

## 7. Runtime boundary

ORDER-BOOK-001A authorizes:

- read-only Binance REST depth acquisition;
- strict book-shape validation;
- current snapshot geometry;
- fixed-band coverage accounting;
- focused tests;
- temporary preview live proof.

It does not authorize:

- persistence;
- Supabase cron;
- WebSocket/local-book reconstruction;
- historical depth comparison;
- market-wide aggregation;
- MOVE evidence wiring;
- UI;
- causal attribution;
- State / Regime / Risk / Intelligence;
- trading signals.

## 8. Acceptance gate

Technical qualification requires:

1. public market-data-only depth endpoint reachable without key;
2. live payload satisfies strict sorted non-crossed book invariants;
3. best bid/ask and spread are finite;
4. fixed-band depth geometry is reproducible;
5. coverage correctly reports partial when the response does not span a band;
6. exact-head build passes;
7. writes performed = 0.
