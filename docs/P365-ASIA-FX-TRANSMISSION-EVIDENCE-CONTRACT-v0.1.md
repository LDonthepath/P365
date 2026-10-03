# P365 Asia FX Transmission Evidence Contract v0.1

**Checkpoint:** ASIA-MACRO-001A + ASIA-MACRO-001B  
**Status:** PRODUCTION ACTIVE / DURABLE FORWARD INGESTION / WEEKEND TEMPORAL FITNESS FAIL-CLOSED  
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

## 10. ASIA-MACRO-001A explicit non-goals

ASIA-MACRO-001A did not add:

- new provider/dependency;
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


## 12. Vercel live proof — 4 Oct 2026

A preview-only read executed from the P365 Vercel environment with zero durable writes.

Proof retrieval around `2026-10-03T23:38:47Z` returned:

### USD/JPY

- provider status: `SUCCESS`;
- Yahoo native symbol: `USDJPY=X`;
- value: `157.83 JPY per USD`;
- provider `observedAt`: `2026-10-03T21:07:47.000Z`;
- canonical quality: `UNKNOWN`;
- reason: the provider timestamp falls on Saturday, outside the frozen regular
  `GLOBAL_FX_24_5` market window.

P365 therefore proves provider access/schema but deliberately refuses to promote that
weekend timestamp as qualified synchronous pricing.

### USD/CNH

- provider status: `SUCCESS`;
- Yahoo native symbol: `USDCNH=X`;
- value: `6.7044 CNH per USD`;
- provider `observedAt`: `2026-10-02T20:59:45.000Z`;
- canonical quality: `FRESH` under the closed-weekend freshness policy;
- provider timestamp is inside the qualified Friday FX window.

### Proof verdict

- Vercel provider access: **PASS**;
- finite quote values: **PASS**;
- source-native pair identity/provenance: **PASS**;
- quote timestamp retained separately from retrieval: **PASS**;
- closed-market temporal fitness fails closed: **PASS**;
- writes performed: **0**;
- production scheduler/backfill at ASIA-MACRO-001A proof time: **NOT ACTIVATED**.

This proof does not claim that the Saturday USDJPY value is a live tradable market quote.
A later production acquisition during an open FX window must satisfy the same freshness
policy before the observation can participate as synchronous MOVE evidence.


## 13. ASIA-MACRO-001B production activation — 4 Oct 2026

Owner-approved production activation reuses the existing Supabase-owned fast market scheduler.
No second scheduler was created.

### Scheduler

Existing job:

- job name: `p365-market-fast`;
- job id: `2`;
- schedule: `2-57/5 * * * *` (every five minutes);
- active jobs with this name after activation: `1`.

The existing provider list changed from:

`coingecko,gold,dxy`

to:

`coingecko,gold,dxy,usdjpy,usdcnh`

using `cron.alter_job(... command := ...)`, rather than directly updating `cron.job`.
This preserves Supabase Cron ownership and avoids duplicate scheduling.

### Controlled production proof

A one-off authenticated invocation through the same production historical-ingestion route
returned HTTP `200` with overall `SUCCESS`.

Both new lanes returned:

- provider status: `SUCCESS`;
- acquired: `1`;
- normalized: `1`;
- persisted Observation: `1`;
- persisted Evidence: `1`.

Durable Market Memory proof:

#### USD/JPY

- series: `fx.usdjpy.jpy_per_usd`;
- jurisdiction: `JAPAN`;
- instrument: `FX_PAIR`;
- native symbol: `USDJPY=X`;
- observedAt: `2026-10-03T21:07:47.000Z`;
- quality: `UNKNOWN`;
- reason: provider timestamp falls outside the qualified regular FX week.

#### USD/CNH

- series: `fx.usdcnh.cnh_per_usd`;
- jurisdiction: `CHINA`;
- instrument: `FX_PAIR`;
- native symbol: `USDCNH=X`;
- observedAt: `2026-10-02T20:59:45.000Z`;
- quality: `FRESH` under the closed-weekend freshness policy.

The quality difference is intentional. Production activation does not override
`GLOBAL_FX_24_5` temporal qualification.

### Recurring scheduler proof

The next natural `p365-market-fast` pg_cron run at
`2026-10-03T23:47:00Z` succeeded.

The resulting HTTP response was `200` / `SUCCESS` and included both:

- `usdjpy`;
- `usdcnh`.

Repeated acquisition of the same provider observation did not create duplicate durable
Observation rows: each new Asia FX series remained at one canonical row / one distinct
`observedAt` after the immediate recurring run.

### Activation boundary

ASIA-MACRO-001B activates only:

- recurring FORWARD acquisition;
- canonical durable Observation/Evidence persistence for USDJPY/USDCNH.

It still does not authorize:

- Yahoo FX BACKFILL;
- MOVE evidence-bundle wiring;
- dashboard presentation;
- JGB rates;
- onshore USD/CNY;
- China TSF/M2/PMI/CPI/PPI;
- Japan CPI/wages/Tankan;
- causality;
- State/Regime/Risk/Intelligence;
- trading signals.

`causalAttribution = NOT_EVALUATED` remains unchanged.
