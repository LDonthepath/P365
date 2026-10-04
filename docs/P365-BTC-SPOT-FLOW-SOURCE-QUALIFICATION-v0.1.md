# P365 BTC Spot Flow Source Qualification v0.1

**Checkpoint:** SPOT-FLOW-001A + SPOT-FLOW-001B + SPOT-FLOW-001C  
**Status:** BINANCE PRODUCTION ACTIVE / DURABLE FORWARD HISTORY ACCUMULATING / BYBIT VERCEL-EGRESS UNAVAILABLE  
**Scope:** BTC spot taker-flow evidence plus production-active forward durable history  
**Owner approval:** Binance Spot + Bybit Spot provider expansion approved 4 Oct 2026

## 1. Product question

This checkpoint exists to answer one bounded factual question after a material BTC move:

> Is observable **spot taker participation** on qualified venues supportive, contradictory,
> or unavailable relative to the move?

It does not determine cause.

## 2. Primary provider — Binance Spot

Primary public endpoint:

`GET https://data-api.binance.vision/api/v3/klines`

Frozen market:

- venue: Binance Spot;
- pair: `BTCUSDT`;
- interval: `5m`;
- timezone: UTC;
- authentication: none on the official market-data-only host.

The official Spot kline contract exposes:

- open time;
- OHLC;
- total base-asset volume;
- close time;
- quote-asset volume;
- number of trades;
- taker-buy base-asset volume;
- taker-buy quote-asset volume.

This makes Binance the primary free source for a complete provider-native 5m venue-flow
window without reconstructing every individual trade.

### 2.1 Frozen Binance metrics

All flow values use **BTC base units**:

`TAKER_SELL_BTC = TOTAL_BASE_VOLUME_BTC - TAKER_BUY_BASE_VOLUME_BTC`

`NET_TAKER_BTC = TAKER_BUY_BTC - TAKER_SELL_BTC`

`TAKER_BUY_SHARE = TAKER_BUY_BTC / TOTAL_BASE_VOLUME_BTC`

Required outputs:

- total base volume BTC;
- taker-buy base volume BTC;
- taker-sell base volume BTC;
- net taker base volume BTC;
- taker-buy share;
- trade count.

P365 does not convert these flows to USD and does not assume one USDT equals one USD.

### 2.2 Point-in-time rule

For an official 5m Binance kline:

- provider interval identity = kline open time;
- provider close time must equal `open + 5m - 1ms`;
- canonical factual availability of the completed interval is no earlier than
  `open + 5m`;
- a currently forming interval is excluded.

This mirrors the completed-bucket discipline already required for Coinalyze.

## 3. Secondary provider — Bybit Spot

Secondary public endpoint:

`GET https://api.bybit.com/v5/market/recent-trade`

Frozen request:

- `category=spot`;
- `symbol=BTCUSDT`;
- maximum current Spot REST response = 60 recent trades.

The official response defines `side` as the **side of taker**.

Qualified raw fields:

- execution id;
- price;
- BTC trade size;
- taker side;
- execution timestamp;
- block/RPI flags;
- provider sequence when present.

### 3.1 Bybit limitation

The Spot REST endpoint supplies only the most recent 60 trades.

For actively traded BTCUSDT, 60 trades usually cover substantially less than five
minutes. Therefore:

- Bybit REST output is a **RECENT_SAMPLE**;
- it must expose exact sample start/end and covered span;
- it must not be labeled a complete 5m flow window unless the actual returned sample spans
  at least five minutes;
- it is secondary validation, not the canonical 5m venue-flow source.

A future durable stream collector could change this boundary, but no WebSocket collector is
authorized in SPOT-FLOW-001A.

## 4. Cross-provider semantic boundary

Both providers expose taker-side factual evidence, but their coverage differs:

```text
BINANCE
provider-complete 5m kline
        ↓
primary 5m venue-flow evidence

BYBIT
latest <=60 spot trades
        ↓
bounded recent taker-side sample
```

P365 must not merge these into one market-wide number in this checkpoint.

No cross-exchange weighting, share-of-global-volume assumption, stablecoin-parity
normalization, or venue representativeness threshold is authorized.

## 5. Canonical read-only evidence shape

Methodology:

`venue-native-taker-flow-v1`

Primary Binance flow window:

- asset = BTC;
- venue = BINANCE;
- pair = BTCUSDT;
- base unit = BTC;
- window = 300 seconds;
- coverage = COMPLETE;
- exact observedAt at completed interval end.

Bybit validation sample:

- asset = BTC;
- venue = BYBIT;
- pair = BTCUSDT;
- base unit = BTC;
- coverage = RECENT_SAMPLE;
- exact sampled time span retained.

## 6. Interpretation boundary

Examples of permitted factual language:

- “Binance BTCUSDT taker-buy share was 58% in the completed 5m window.”
- “Net taker flow on Binance BTCUSDT was +42 BTC.”
- “Bybit's latest 60-trade sample was buy-heavy but covered only 18 seconds.”

Not permitted from this evidence alone:

- “Spot caused the rally.”
- “The whole BTC spot market was buying.”
- “Whales are accumulating.”
- “The move will continue/reverse.”

Those require additional evidence and/or later methodology.

## 7. Runtime boundary

SPOT-FLOW-001A authorizes:

- public read-only provider acquisition;
- strict provider-envelope/schema validation;
- completed Binance 5m flow construction;
- Bybit recent-sample summarization;
- focused tests;
- live preview verification.

It does not authorize:

- Market Memory persistence;
- Supabase cron;
- WebSocket collectors;
- market-wide spot-flow aggregation;
- MOVE-002B wiring;
- dashboard/UI;
- causal attribution;
- State / Regime / Risk / Intelligence;
- trading signals.

## 8. Acceptance gate

SPOT-FLOW-001A primary runtime is technically qualified when live proof establishes:

1. Binance public market-data-only access works without credential;
2. live 5m row matches documented kline shape;
3. taker-buy base volume is bounded by total BTC volume;
4. incomplete current kline is excluded;
5. build passes;
6. writes performed = 0.

Secondary validation is independently qualified only when a second venue is operationally
reachable. A blocked secondary source must remain explicit `UNAVAILABLE`; it must not
invalidate a technically sound primary source and must not be silently replaced by fake
coverage.

Durable persistence remains a later, separately governed checkpoint.

## 9. Live proof — 4 Oct 2026

Preview execution from the P365 Vercel environment produced:

### Binance Spot — PASS

- public market-data-only endpoint reachable with no API key;
- completed 5m BTCUSDT bars parsed successfully;
- current incomplete bar excluded;
- proof window observedAt: `2026-10-03T20:00:00.000Z`;
- total base volume: `9.25842 BTC`;
- taker-buy base volume: `1.24717 BTC`;
- derived taker-sell base volume: approximately `8.01125 BTC`;
- derived net taker flow: approximately `-6.76408 BTC`;
- taker-buy share: approximately `13.47%`;
- trade count: `1,179`;
- writes performed: false.

These values are a live proof sample only, not a persistent market conclusion.

### Bybit Spot — ENVIRONMENT UNAVAILABLE

The same Vercel preview request reached Bybit's edge and received:

`HTTP 403: CloudFront distribution is configured to block access from your country`

This is an operational/geographic provider restriction on the deployment egress, not an
API-key authentication failure and not a schema failure.

Runtime therefore maps this condition to:

- provider status = `UNAVAILABLE`;
- error code = `UPSTREAM_UNAVAILABLE`.

Bybit remains semantically qualified as a taker-side recent-trade source, but it is not an
active P365 validation source from the current Vercel environment.

No alternate venue is added in this checkpoint without a new owner provider approval.


## 10. SPOT-FLOW-001B durable history runtime

SPOT-FLOW-001B implements forward-only durable history for the already-qualified Binance
BTCUSDT 5m flow window. It does **not** add another provider or change the SPOT-FLOW-001A
economic meaning.

### 10.1 Durable record shape

Each completed Binance 5m window is persisted as one atomic canonical `Evidence` record:

- `sourceId = binance-spot`;
- `kind = OBSERVATION`;
- methodology = `binance-btcusdt-5m-taker-flow-snapshot-v1`;
- venue/pair identity remains `BINANCE / BTCUSDT`;
- the full factual payload retains total BTC volume, taker-buy BTC, taker-sell BTC,
  net taker BTC, taker-buy share and trade count;
- the completed 5m boundary remains the source-effective time;
- `retrievedAt` remains the P365 knowledge-time cutoff.

The durable ID fingerprints the complete factual payload. An identical refetch is therefore
idempotent, while a changed provider fact for the same 5m measurement receives a new
append-only Evidence revision. A separate deterministic `windowKey` groups revisions of the
same venue/pair/interval.

### 10.2 Acquisition boundary

The existing authenticated historical-ingestion runtime gains provider `binance-spot` in
`FORWARD` mode.

Routine acquisition requests only the latest three Binance 5m klines:

- currently forming bars are still rejected by the provider adapter;
- completed overlap is intentionally small and allows one missed poll to self-heal;
- repeated completed windows remain idempotent;
- no unbounded historical scan is performed.

`BACKFILL` is **not** enabled by this checkpoint.

### 10.3 Explicit non-activation boundary

SPOT-FLOW-001B does not activate:

- Supabase `pg_cron` changes;
- production writes before owner merge/review;
- historical backfill;
- Bybit persistence;
- market-wide spot-flow aggregation;
- MOVE-002B consumption;
- dashboard/UI;
- causal attribution;
- State / Regime / Risk / Intelligence;
- trading signals.

Production activation is a separate checkpoint after merge and runtime verification.


## 11. SPOT-FLOW-001C Production Activation

SPOT-FLOW-001C activates the already-merged SPOT-FLOW-001B durable path in production.
It does not add a provider, change the frozen 5m flow meaning, enable BACKFILL, or activate
higher-order interpretation.

Production baseline:

- merged runtime: `main@730ea95f2ca3174d42f7e3a271e10881a387b0f0`;
- production Vercel deployment for that SHA: READY;
- pre-activation durable Binance spot-flow rows: `0`;
- existing scheduler owner: Supabase `pg_cron` job id `2`, `p365-market-fast`;
- existing cadence retained: `2-57/5 * * * *`;
- no duplicate scheduler created.

The existing job command was altered in place from:

`coingecko,gold,dxy,usdjpy,usdcnh,gdelt`

to:

`coingecko,gold,dxy,usdjpy,usdcnh,gdelt,binance-spot`

### 11.1 Natural production proof

The first naturally elapsed permanent scheduler run after activation was:

- pg_cron run id: `34105`;
- start: `2026-10-04T12:27:00.116276Z`;
- pg_cron status: `succeeded`;
- pg_net request id: `34087`;
- HTTP status: `200`;
- P365 ingestion status: `SUCCESS`;
- Binance Spot acquired: `2`;
- normalized: `2`;
- persisted Observations: `0`;
- persisted Evidence: `2`.

The two completed factual windows were:

- observedAt `2026-10-04T12:20:00.000Z`: net taker `-11.4206 BTC`,
  taker-buy share approximately `31.25%`, trade count `8,189`;
- observedAt `2026-10-04T12:25:00.000Z`: net taker approximately
  `-4.6172 BTC`, taker-buy share approximately `40.76%`, trade count `3,865`.

These are proof samples, not market conclusions.

### 11.2 Idempotency and point-in-time proof

A controlled authenticated repeat request used pg_net request id `34088` and returned
HTTP `200 / SUCCESS`. Binance again acquired and normalized the same two completed windows,
while Market Memory remained exactly:

- `2` durable rows;
- `2` distinct window keys;
- `2` distinct Evidence IDs.

This proves unchanged refetch idempotency at the production persistence boundary.

Both initial rows were retrieved at `2026-10-04T12:27:02.170Z`.
Historical cutoff verification returned:

- `0` eligible rows at or before `2026-10-04T12:27:02.169Z`;
- `2` eligible rows at or before `2026-10-04T12:27:02.170Z`.

The retrieval-time knowledge boundary therefore remains preserved.

### 11.3 Post-activation boundary

No Vercel error/fatal runtime logs were observed after activation through the verification
window. Two earlier dashboard Observation-history timeout errors at approximately
`12:19Z` belonged to the prior production deployment and predated SPOT-FLOW-001C.

Still inactive:

- Binance historical BACKFILL;
- Bybit persistence;
- cross-venue or market-wide spot-flow aggregation;
- MOVE-002B historical spot-flow consumption;
- dashboard/UI;
- causal attribution;
- State / Regime / Risk / Intelligence;
- trading signals.
