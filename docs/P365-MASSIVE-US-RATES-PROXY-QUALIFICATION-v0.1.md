# P365 Massive US Rates Proxy Qualification v0.1

**Checkpoint:** MACRO-RATES-001B continuation  
**Status:** TECHNICAL LIVE PASS / CURRENT INDIVIDUAL ACCESS NOT AUTHORIZED FOR P365 NON-DISPLAY RUNTIME / ZT+ZN ROLL METHODOLOGY FROZEN  
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

## 7. Contract selection / roll methodology — FROZEN v0.1

A canonical runtime must not hardcode a calendar-nearest contract.

CME Treasury futures use the March/June/September/December quarterly cycle, and liquidity
migrates from the expiring quarterly contract into the next contract before delivery. CME's
delivery education explicitly describes large holders rolling forward before delivery and
moving liquidity into the next quarterly contract.

Massive provides point-in-time contract discovery with exact contract ticker, active status,
last-trade date, settlement date and days-to-maturity, while its aggregate endpoint provides
trade-derived session volume.

P365 therefore freezes the following selection methodology.

### 7.1 Eligible universe

For product code `ZT` or `ZN` and target exchange session `S`:

1. query Massive Contracts point-in-time at `date=S`;
2. retain only:
   - exact product code;
   - `active=true`;
   - `type=single`;
   - valid ticker;
   - valid last-trade/settlement metadata where supplied;
3. combo/calendar-spread tickers are never eligible as the canonical outright proxy.

### 7.2 Information cutoff

Contract selection for session `S` must use only information available before session `S`
begins.

The liquidity input is the **most recent completed prior CBOT session** `P`, not the current
forming session and not simply the prior calendar date.

For each eligible contract, P365 reads the provider session aggregate for `P` and uses
provider-reported contract volume.

This prevents same-session volume from leaking future information into point-in-time selection.

### 7.3 Incumbent and switch rule

Let `I` be the contract selected for the previous session, when one exists and remains active.

Let `C` be the eligible later-expiry contract with the greatest positive completed-session
volume in `P`.

Rules:

- if no incumbent exists, select the eligible contract with the greatest positive volume in
  `P`;
- if the incumbent is still active, retain it unless a **later-expiry** candidate has strictly
  greater completed-session volume;
- ties retain the incumbent;
- once selection advances to a later expiry, it may not roll backward to an earlier expiry;
- if the incumbent is no longer active, select the eligible later-expiry contract with the
  greatest positive completed-session volume;
- if no eligible contract has positive completed-session volume and no valid incumbent can be
  retained, return `UNAVAILABLE_CONTRACT_SELECTION`.

There is no guessed percentage crossover threshold.

### 7.4 Session lock

The selected ticker is frozen for the entire target exchange session `S`.

P365 must not switch contracts intraday because current-session volume changes.

### 7.5 Roll-boundary comparison rule

Every Observation retains the exact provider-native contract ticker.

If two MOVE comparison points resolve to different contract tickers:

`comparisonStatus = ROLL_BOUNDARY`

and P365 must not compute:

- raw price delta;
- percentage price move;
- inferred rate-pressure direction across the boundary.

A separately calibrated continuous-futures methodology would be required before any
cross-contract splice or adjustment is permitted.

### 7.6 Existing research helper is not normative

The existing research-only `rates-historical-reconstruction.ts` currently chooses the
nearest-maturity active ZT contract that has observable 1-minute bars.

That behavior remains valid only for its documented research reconstruction scope.

It is **not** the canonical production roll methodology and is not changed by this documentation
checkpoint.

A future canonical runtime must implement this frozen volume-led point-in-time rule explicitly.

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

## 9. Massive / CME rights conclusion — CURRENT INDIVIDUAL ACCESS FAILS THE P365 RUNTIME GATE

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

Those uses are non-display/application use.

CME's current Non-Display guidance explicitly includes **research and analysis** in Category C-2
and states that real-time/delayed Information used by an Application requires an appropriate
Non-Display license. Historical-only use is also licensed, even where reporting/fees differ.

Massive's current individual Market Data Terms separately state that:

- individual market data is licensed for personal, non-business use;
- market data is display-use only unless another agreement applies;
- non-display use and creation of derived works are prohibited unless licensed.

Therefore the current individual `MASSIVE_API_KEY` is not merely "unverified" for P365's
intended automated runtime:

> **CURRENT INDIVIDUAL ACCESS DOES NOT AUTHORIZE THE PROPOSED P365 NON-DISPLAY WORKFLOW.**

Massive currently advertises a CBOT Business futures plan at USD 999/month with exchange
assistance, but P365 must not assume that purchasing that plan alone automatically satisfies
every CME Non-Display permission.

Before production activation, owner-approved written entitlement must explicitly cover, at
minimum:

1. CBOT ZT and ZN market data;
2. recurring server-side acquisition;
3. Category C-2 research/analysis or equivalent permitted non-display use;
4. internal durable storage/retention needed by Market Memory;
5. P365-derived factual comparison outputs;
6. any dashboard/display behavior that exposes raw or derived exchange data.

The compliant commercial path may be Massive Business + CME permissions/ILA or another written
arrangement directed by Massive/CME. The exact commercial paperwork is outside this
documentation checkpoint.

### Verdict

> **MASSIVE TREASURY FUTURES = TECHNICAL LIVE PASS / CURRENT INDIVIDUAL RIGHTS FAIL / BUSINESS-NON-DISPLAY ENTITLEMENT REQUIRED**

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

## 13. Canonical proxy contract — FROZEN v0.1

If rights are later approved, the intended canonical factual series are:

- `rates.us_treasury_2y_note_futures_price.points`
- `rates.us_treasury_10y_note_futures_price.points`

Semantics:

- marketDomain: `RATES`
- informationClass: `PRICING`
- jurisdiction: `US`
- instrument: `FUTURE`
- tenor: `2Y` or `10Y`
- unit: provider-native Treasury futures price points, par basis 100
- provider provenance: `massive`
- native symbol: exact selected contract ticker, e.g. `ZTZ6` or `ZNZ6`

The logical series key describes the economic proxy family; exact contract identity remains
mandatory provenance on every row.

### 13.1 Bar-completion rule

Massive documents `window_start` as the **beginning** of the aggregation window and states
that bars are built from trades; no-trade intervals have no bar.

For a 5-minute canonical bar:

`canonical observedAt = provider window_start + 5 minutes`

and the bar is eligible only when:

`provider window_start + 5 minutes <= retrievedAt`

No currently forming bar may be canonicalized.

No-trade behavior remains:

`missing bar != unchanged price != zero move`

No forward-fill is authorized for the MOVE hot path.

## 14. Production decision gate

The technical and methodology gates are now substantially closed.

Before any Massive rates runtime may be implemented:

1. owner explicitly approves futures-price evidence as the intended proxy boundary;
2. Massive/CME rights for recurring server-side non-display use are documented;
3. durable storage/retention and derived-output rights are documented;
4. implementation follows the frozen session-volume roll methodology exactly;
5. implementation follows the frozen completed-bar/missing-bar rules;
6. provider 429/backoff behavior remains fail-closed/bounded;
7. no cash-yield or basis-point labels are applied to ZT/ZN prices.

Current blocker:

`PROXY_TECHNICALLY_QUALIFIED / METHODOLOGY_FROZEN / RUNTIME_BLOCKED_BY_RIGHTS`

## 15. Explicit non-goals

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


## 16. Official rights and methodology references — 4 Oct 2026

Massive:

- https://massive.com/legal/market-data-terms-of-service
- https://massive.com/business-futures
- https://massive.com/docs/rest/futures/contracts
- https://massive.com/docs/rest/futures/aggregates

CME:

- https://www.cmegroup.com/market-data/license-data/market-data-policy-education-center.html
- https://www.cmegroup.com/market-data/distributor/files/cme-group-data-licensing-policy-guidelines-and-non-display-licensing-faq.pdf
- https://www.cmegroup.com/trading/interest-rates/basics-of-us-treasury-futures.html
- https://www.cmegroup.com/education/courses/introduction-to-treasuries/learn-about-the-treasuries-delivery-process

This checkpoint records the public-contract boundary for repository governance. It is not legal
advice and does not substitute for a provider/exchange entitlement agreement.
