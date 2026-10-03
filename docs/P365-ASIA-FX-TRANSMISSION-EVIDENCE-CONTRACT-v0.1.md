# P365 Asia FX Transmission Evidence Contract v0.1

**Checkpoint:** ASIA-MACRO-001A  
**Status:** RUNTIME IMPLEMENTED / LIVE VERCEL PROOF PENDING / PRODUCTION SCHEDULER NOT ACTIVATED  
**Scope:** China/Japan synchronous FX transmission evidence for BTC + Gold MOVE investigation  
**Provider:** existing Yahoo Finance trial market-data path  
**New external dependency/provider:** none

## 1. Purpose

P365 already ingests scheduled Event coverage for the approved jurisdictions:

- US;
- CHINA;
- JAPAN.

This checkpoint does not duplicate that event pipeline.

The remaining Asia-specific gap is synchronous market pricing. A material BTC or Gold MOVE
during Asia hours should be able to ask whether the Japanese yen or offshore Chinese yuan
repriced during the same window.

ASIA-MACRO-001A therefore adds two narrow factual pricing series:

- `fx.usdjpy.jpy_per_usd`;
- `fx.usdcnh.cnh_per_usd`.

This is transmission evidence, not causal attribution.

## 2. Analytical questions

### USD/JPY

> Did the yen materially strengthen or weaken against the U.S. dollar during the same
> BTC/Gold MOVE window?

USD/JPY is useful as Japan/yen transmission evidence around BoJ policy, Japanese rates,
intervention risk, and global funding/carry changes.

P365 must not infer "yen carry unwind" from USD/JPY alone.

### USD/CNH

> Did the offshore yuan materially strengthen or weaken against the U.S. dollar during the
> same BTC/Gold MOVE window?

USD/CNH is useful as China/offshore-RMB transmission evidence around PBoC policy,
China growth/credit information, and Asia risk repricing.

CNH is offshore yuan. It is not the same instrument as onshore CNY and is not the PBoC
daily fixing.

## 3. Canonical series

### USD/JPY

- series key: `fx.usdjpy.jpy_per_usd`
- legacy domain: `ASSET`
- marketDomain: `FX`
- informationClass: `PRICING`
- jurisdiction: `JAPAN`
- instrument: `FX_PAIR`
- asset: `USDJPY`
- unit: `JPY_PER_USD`
- base currency: USD
- quote currency: JPY

A higher value means more JPY per USD. P365 does not label that bullish/bearish for BTC or Gold.

### USD/CNH

- series key: `fx.usdcnh.cnh_per_usd`
- legacy domain: `ASSET`
- marketDomain: `FX`
- informationClass: `PRICING`
- jurisdiction: `CHINA`
- instrument: `FX_PAIR`
- asset: `USDCNH`
- unit: `CNH_PER_USD`
- base currency: USD
- quote currency: CNH

A higher value means more offshore CNH per USD. P365 does not equate this mechanically with
China capital outflow, PBoC action, or BTC direction.

The jurisdiction dimension identifies the non-USD economy whose transmission channel is
being monitored. The full two-currency pair remains explicit in series identity and metadata.

## 4. Existing provider path

P365 already uses Yahoo Finance's chart resource for Gold, Russell 2000 and DXY.

ASIA-MACRO-001A reuses the same provider boundary and adds no new SaaS/API/dependency.

Provider-native symbols:

- USD/JPY: `USDJPY=X`
- USD/CNH: `USDCNH=X`

Provider resource remains:

`/v8/finance/chart`

P365 retains the provider-native symbol in typed provenance.

Yahoo remains a trial market-data source. This checkpoint does not elevate Yahoo to an
official central-bank, institutional executable-FX, or benchmark-fixing source.

## 5. Time semantics

The existing Yahoo adapter uses provider `regularMarketTime` as `observedAt`.

P365 separately records:

- `observedAt` — provider quote timestamp;
- `retrievedAt` — P365 retrieval timestamp.

Retrieval time must never substitute for the quote timestamp.

If the provider timestamp is too old relative to retrieval, the Observation becomes stale
under the existing MARKET_REALTIME policy rather than being presented as current.

## 6. FX freshness window

A new `GLOBAL_FX_24_5` freshness calendar models the regular spot-FX week:

- Sunday 17:00 ET open;
- continuous Monday-Thursday;
- Friday 17:00 ET close;
- Saturday closed.

This is a bounded weekly freshness rule, not an exchange calendar. It does not claim exact
holiday schedules or provider-specific maintenance windows.

During a closed FX weekend, elapsed closed-market time does not by itself age an otherwise
qualified Friday quote. A quote timestamp that occurs outside the qualified weekly window
is not promoted as valid realtime pricing.

## 7. Historical-ingestion ownership

The existing historical-ingestion owner gains two FORWARD lanes:

- `usdjpy`;
- `usdcnh`.

They normalize through the same canonical Observation path and preserve:

- FND-018A identity/revision semantics;
- Yahoo native-symbol provenance;
- additive financial-market semantics;
- append-only Market Memory compatibility;
- explicit provider/retrieval timestamps.

BACKFILL is not authorized for Yahoo FX in this checkpoint.

## 8. Relationship to existing China/Japan events

FND-003B already makes US/CHINA/JAPAN scheduled Event ingestion production-active.

Therefore this checkpoint does not add or duplicate:

- BoJ calendar ingestion;
- PBoC/China economic-event calendar ingestion;
- China/Japan event identities;
- event scheduler logic.

Those events may later be compared with USDJPY/USDCNH pricing under the existing
MOVE/evidence architecture.

## 9. Interpretation boundary

Permitted factual statements include:

- "USD/JPY moved X% during the same 60-minute BTC MOVE window."
- "USD/CNH was approximately unchanged while BTC repriced."
- "A Japan Event occurred near the MOVE and USD/JPY repriced; causal attribution remains not evaluated."

Not permitted:

- "BoJ caused BTC to fall."
- "USDCNH proves Chinese capital flight."
- "The yen carry trade is unwinding" from USDJPY alone.
- any BUY/SELL/LONG/SHORT, sizing, or execution advice.

Always retain:

`causalAttribution = NOT_EVALUATED`

until a separately approved methodology permits a stronger conclusion.

## 10. Explicit non-goals

ASIA-MACRO-001A does not add:

- new provider/dependency;
- Supabase scheduler mutation;
- production durable activation;
- historical Yahoo backfill;
- onshore USD/CNY;
- JGB yields;
- China TSF/M2/PMI/CPI/PPI;
- Japan CPI/wages/Tankan;
- State/Regime/Risk/Intelligence;
- causal scoring;
- trading signals;
- dashboard UI.

Those remain demand-driven follow-up evidence, not implicit scope.

## 11. Merge gate

This checkpoint is merge-ready only when:

1. current main/base SHA is recorded;
2. Yahoo USDJPY/USDCNH provider-native symbols and quote semantics are verified;
3. both canonical series have explicit FX/PRICING semantics;
4. quote and retrieval timestamps remain separate;
5. FX regular-week freshness semantics are tested;
6. FORWARD historical-ingestion lanes are covered by regression tests;
7. no BACKFILL or scheduler activation is introduced;
8. exact-head build passes;
9. Vercel preview is READY;
10. live preview proof confirms both symbols return finite values with provider timestamps;
11. writes performed during qualification remain zero.

Production scheduling is a separate owner-reviewed activation step after merge.
