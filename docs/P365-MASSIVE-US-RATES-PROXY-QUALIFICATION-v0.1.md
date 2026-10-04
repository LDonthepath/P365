# P365 Massive US Rates Proxy Qualification v0.1

**Checkpoint:** MACRO-RATES-001B continuation  
**Status:** TECHNICAL LIVE PASS FOR STANDARD TREASURY FUTURES / YIELD-FUTURES PARTIAL / DURABLE NON-DISPLAY RIGHTS GATE  
**Scope:** Existing Massive access as an explicit intraday U.S. rates-pricing proxy candidate  
**Implementation effect:** Qualification only. No canonical runtime, scheduler, Market Memory write, MOVE wiring, UI, causality, or trading semantics.

## 1. Purpose

MACRO-RATES-001A established that P365 still lacks a qualified intraday U.S. rates bridge for
15/30/60/120-minute BTC/Gold MOVE investigation.

MACRO-RATES-001B initially tested Twelve Data and stopped at an entitlement gate.

Before treating paid rates access as unavoidable, this continuation tested an already configured
P365 provider credential:

`MASSIVE_API_KEY`

The question was:

> Can existing Massive Futures access provide a technically usable, explicitly labeled
> U.S. rates-pricing proxy without pretending futures are cash Treasury yields?

The answer is **yes technically for standard Treasury futures, but production durable use
remains licensing-gated**.

## 2. Provider and market identity

Massive Futures exposes CBOT/CME futures reference data and aggregate bars.

P365 live preview qualification used the existing server-side `MASSIVE_API_KEY` and performed
read-only API calls from the Vercel environment.

No key value was exposed and no Market Memory writes occurred.

Official provider references:

- https://massive.com/docs/rest/futures/aggregates
- https://massive.com/pricing?product=futures
- https://massive.com/legal/market-data-terms-of-service

Relevant CME product references:

- 2-Year Yield futures: `2YY`
- 10-Year Yield futures: `10Y`
- 2-Year T-Note futures: `ZT`
- 10-Year T-Note futures: `ZN`

Yield futures and standard Treasury futures are economically distinct.

## 3. Yield Futures live proof

Qualification date window:

`2026-10-01 <= window_start < 2026-10-03`

Resolution:

`5min`

### 3.1 Product discovery

Massive returned HTTP 200 / `OK` for both:

- `2YY`
- `10Y`

Both were identified as:

- asset sub-class: `interest_rate`
- trading venue: `XCBT`
- currency: `USD`

This independently proves that the existing Massive account can discover the CME/CBOT Yield
Futures product families.

### 3.2 2-Year Yield futures

Active single contracts discovered for 2 Oct 2026 included:

- `2YYV6` — settlement 30 Oct 2026
- `2YYX6` — settlement 30 Nov 2026

Observed five-minute trade-bar coverage over the test window:

| Contract | 5m bars | Volume | Transactions |
|---|---:|---:|---:|
| `2YYV6` | 0 | 0 | 0 |
| `2YYX6` | 0 | 0 | 0 |

Verdict:

> **PRODUCT/ACCESS PASS / SYNCHRONOUS LIQUIDITY FAIL ON TESTED SESSION**

The absence of trade bars is not interpreted as provider failure and is not filled with
synthetic zero-volume pricing.

This evidence is insufficient for P365's 15/30/60/120-minute MOVE hot path.

### 3.3 10-Year Yield futures

Active single contracts included:

- `10YV6` — settlement 30 Oct 2026
- `10YX6` — settlement 30 Nov 2026

Observed coverage:

| Contract | 5m bars | Volume | Transactions | Max observed bar gap |
|---|---:|---:|---:|---:|
| `10YV6` | 344 | 3,540 | 1,739 | 65 min |
| `10YX6` | 48 | 233 | 128 | 365 min |

`10YV6` five-minute bars contained provider-native yield prices around 5.25–5.27 in the
sampled session.

Verdict:

> **TECHNICAL LIVE PASS FOR 10Y YIELD FUTURES / COVERAGE NOT CONTINUOUS**

The 10Y path is materially more usable than 2YY, but the pair is asymmetric and therefore is
not selected as the primary two-tenor proxy family.

## 4. Standard Treasury Futures live proof

Because 2YY lacked usable bars, P365 tested standard CBOT Treasury futures using the same
provider and time window.

### 4.1 2-Year T-Note futures — ZT

Active single contracts included:

- `ZTZ6`
- `ZTH7`
- `ZTM7`

Most liquid observed contract:

`ZTZ6`

Coverage:

- 5m bars: **527**
- total volume: **3,050,214**
- total transactions: **174,869**
- maximum observed gap: **65 minutes**
- gaps >15m: **1**
- gaps >30m: **1**
- gaps >60m: **1**

Verdict:

> **STRONG TECHNICAL LIVE PASS AS A 2Y TREASURY FUTURES-PRICE PROXY**

### 4.2 10-Year T-Note futures — ZN

Active single contracts included:

- `ZNZ6`
- `ZNH7`
- `ZNM7`

Most liquid observed contract:

`ZNZ6`

Coverage:

- 5m bars: **528**
- total volume: **6,765,907**
- total transactions: **384,754**
- maximum observed gap: **65 minutes**
- gaps >15m: **1**
- gaps >30m: **1**
- gaps >60m: **1**

One farther contract request returned HTTP 429 during the bounded probe. This did not affect the
front-contract proof and demonstrates why a runtime adapter must retain explicit provider
rate-limit/error states.

Verdict:

> **STRONG TECHNICAL LIVE PASS AS A 10Y TREASURY FUTURES-PRICE PROXY**

## 5. Why ZT + ZN is the preferred proxy pair

For synchronous MOVE evidence, P365 values:

1. consistent semantics across tenors;
2. sufficient trade density at 5m;
3. explicit instrument identity;
4. provider-native timestamps;
5. no fabricated interpolation.

The tested session showed:

- `2YY`: no usable trade bars;
- `10Y` Yield futures: usable but materially less liquid than standard Treasury futures;
- `ZT` and `ZN`: dense five-minute observations on both curve points.

Therefore, if P365 later authorizes a **proxy** rates path, the preferred coherent pair is:

- `ZT` for front-end Treasury-futures price evidence;
- `ZN` for long-end Treasury-futures price evidence.

This is a technical proxy selection, **not** production authorization.

## 6. Non-negotiable semantic boundary

ZT/ZN are:

`RATES / PRICING / US / FUTURE`

They are **not**:

- DGS2;
- DGS10;
- on-the-run cash Treasury yields;
- constant-maturity yields;
- provider-native yield series.

Required identity dimensions include:

- product code;
- exact contract ticker/month;
- trading venue;
- price unit/convention;
- provider bar timestamp;
- retrieval timestamp.

### Price versus yield

Treasury futures are price-quoted and physically delivered against a basket of eligible
Treasury securities.

Treasury prices and yields have an inverse economic relationship, but standard Treasury futures
also contain:

- deliverable-basket mechanics;
- cheapest-to-deliver dynamics;
- conversion factors;
- financing/carry;
- delivery-option value;
- contract-roll effects.

Therefore P365 may say, for example:

> "2Y Treasury futures prices fell during the BTC MOVE, directionally consistent with upward
> front-end yield pressure."

P365 must not say:

> "US 2Y cash yield rose X bp"

unless a separately qualified cash-yield source or an explicitly approved CTD/yield-conversion
methodology provides that value.

No hidden futures-price-to-yield conversion is authorized.

## 7. Contract selection / roll boundary

A future adapter must not hardcode a calendar-nearest contract without liquidity checks.

The bounded proof showed active contracts with materially different activity.

A future methodology must freeze at least:

- eligible `type=single` contracts only;
- active-contract requirement;
- volume and/or open-interest selection rule;
- switch/roll rule;
- minimum liquidity/freshness gate;
- no splicing across contracts without an explicit continuous-series methodology.

The sampled proof selected the highest observed session volume only for qualification.

That is not yet a production roll methodology.

## 8. Timestamp and missing-bar boundary

Massive aggregate bars expose a provider `window_start` timestamp.

A future 5-minute canonical observation must distinguish:

- provider bar window start;
- provider/session date;
- P365 retrieval time.

No-trade interval:

`missing bar != unchanged price != zero move`

P365 must not forward-fill sparse Yield Futures to manufacture synchronous evidence unless a
separate methodology explicitly permits it.

## 9. Massive access / licensing gate

Technical API access is not equivalent to authorization for P365 durable automated use.

Massive's current individual Futures plans are labeled for individual use. Its Market Data
Terms state, unless a different agreement or Third Party Provider agreement applies, market
data is for personal/non-business use and default display use; non-display use and creation of
derived works require the necessary license/permission.

P365's intended workflow includes:

- recurring server-side acquisition;
- durable Market Memory persistence;
- automated comparison across MOVE windows;
- machine-generated evidence assessment.

Those uses must be treated as **non-display / application use** for governance purposes until
Massive/CME licensing explicitly authorizes them.

Therefore the existing `MASSIVE_API_KEY` proves technical access only.

It does **not** authorize P365 to persist or reason over these futures data in production.

Current public Massive Futures pricing also distinguishes individual plans from business plans,
with dedicated business exchange plans.

### Verdict

> **MASSIVE TREASURY FUTURES = TECHNICAL LIVE PASS / DURABLE NON-DISPLAY RIGHTS GATE**

No scheduler or Market Memory activation is authorized.

## 10. Relationship to BrokerTec/direct cash path

MACRO-RATES-001A's source hierarchy is not overturned.

For exact economic semantics:

1. licensed BrokerTec direct cash remains preferred;
2. standard Treasury futures are a proxy, not a replacement for exact cash yield;
3. daily FRED/Treasury remains the authoritative slow/background layer.

The value of Massive ZT/ZN is narrower:

> provide dense, synchronous front-end/long-end Treasury **futures-price repricing evidence**
> when exact intraday cash yields are unavailable.

## 11. Relationship to Twelve Data

Twelve Data remains:

`ACCESS_GATED / NOT_RUNTIME_APPROVED`

Massive changes the practical decision because P365 now knows a technically strong futures
proxy already exists through an existing credential.

Therefore there is no need to purchase or activate Twelve Data merely to obtain some form of
intraday rates evidence.

Twelve Data should only be revisited if P365 specifically needs its claimed yield series and
the owner is willing to resolve entitlement, provenance and rights.

## 12. Real yield remains unresolved

Nothing in this qualification solves intraday constant-maturity real yield.

`DFII10` remains daily background.

Status remains:

`MISSING_HIGH_VALUE_EVIDENCE`

No nominal futures proxy may be relabeled as real yield.

## 13. Production decision gate

Before any Massive rates runtime may be implemented, all of the following must be true:

1. owner explicitly approves using futures-price evidence as a proxy;
2. provider/CME rights for server-side recurring non-display use are documented;
3. durable storage/retention rights are documented;
4. contract-selection/roll methodology is frozen;
5. bar-completion and freshness rules are frozen;
6. missing/no-trade behavior is fail-closed;
7. exact canonical series identities are approved;
8. provider rate-limit/backoff semantics are implemented;
9. no cash-yield or basis-point labels are applied to ZT/ZN prices.

Until then:

`PROXY_TECHNICALLY_QUALIFIED / RUNTIME_BLOCKED_BY_RIGHTS_AND_METHODOLOGY`

## 14. Explicit non-goals

This qualification does not:

- add Massive rates provider code to production;
- change the existing Massive credential;
- create a new API key;
- create a scheduler;
- write Market Memory;
- create a continuous futures series;
- compute cash yields;
- compute basis-point changes from futures prices;
- solve real yield;
- wire rates into MOVE-002B;
- alter UI;
- activate causal attribution;
- produce trading signals.

The temporary preview-only diagnostic route used for live proof must be removed before this PR
is merge-ready.
