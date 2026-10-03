# P365 BTC Order-Book Liquidity Source Qualification v0.1

**Checkpoint:** ORDER-BOOK-001A  
**Status:** LIVE-QUALIFIED CURRENT SNAPSHOT / HISTORICAL MOVE-WINDOW COVERAGE MISSING  
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


## 9. Live proof — 4 Oct 2026

Vercel preview executed one fresh Binance BTCUSDT depth snapshot with:

- provider status = `SUCCESS`;
- request depth = 500 bid + 500 ask levels;
- writes performed = false;
- snapshot time basis = `P365_RETRIEVED_AT`;
- provider `lastUpdateId = 101012293545`;
- best bid = `84,887.67 USDT`;
- best ask = `84,887.68 USDT`;
- spread = approximately `0.00118 bps`.

Coverage result:

| Band | Bid depth BTC | Ask depth BTC | Quote-notional imbalance | Coverage |
|---|---:|---:|---:|---|
| 5 bps | 47.15717 | 32.88952 | +0.1780 | COMPLETE |
| 10 bps | 83.36727 | 75.88839 | +0.0465 | COMPLETE |
| 25 bps | 110.27685 visible | 76.72611 visible | +0.1788 visible | PARTIAL |
| 50 bps | 110.27685 visible | 76.72611 visible | +0.1788 visible | PARTIAL |

This live proof validates the coverage model: a 500-level snapshot may fully cover narrow
bands while leaving wider bands truncated.

The 25/50 bps figures above are therefore visible lower-bound geometry from that one proof
snapshot, not full-band liquidity and not a persistent market conclusion.

The temporary preview route used for this proof must not remain in the final checkpoint.

## 10. Acceptance result

**Technical qualification: PASS for current read-only Binance BTCUSDT book geometry.**

What is now qualified:

- current top-of-book spread;
- current visible bid/ask depth;
- 5/10/25/50 bps depth bands with explicit COMPLETE/PARTIAL coverage;
- native BTC quantities and native USDT notionals;
- provider `lastUpdateId` lineage;
- retrieval-time temporal semantics.

What remains missing for the original move-investigation question:

- historical order-book snapshots before/during/after a material move;
- liquidity withdrawal/recovery measurement;
- cross-venue order-book confirmation.

Therefore ORDER-BOOK-001A does **not** close historical move-window liquidity coverage.
