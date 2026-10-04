# P365 Intraday US Rates Transmission Source Qualification v0.1

**Checkpoint:** MACRO-RATES-001A  
**Status:** SOURCE QUALIFICATION COMPLETE / OWNER FREE-ONLY / PAID PATHS REJECTED / ZT+TN PROXY RISK-QUALIFIED ONLY / NO RUNTIME APPROVED / REAL-YIELD INTRADAY UNRESOLVED  
**Scope:** US rates transmission evidence for BTC + Gold MOVE investigation  
**Implementation effect:** Documentation/source-qualification only. No provider runtime, API credential, dependency, scheduler, durable write, UI, State/Regime/Risk/Intelligence, causal conclusion, or trading logic.

## 1. Purpose

P365 already has authoritative daily US rates background:

- `DGS2` — US 2Y constant-maturity Treasury yield;
- `DGS10` — US 10Y constant-maturity Treasury yield;
- `DFII10` — US 10Y inflation-indexed constant-maturity yield;
- `T10YIE` — US 10Y breakeven inflation;
- `T10Y2Y` — 10Y minus 2Y curve spread.

Those series are useful for daily/weekly macro context but cannot determine whether rates repriced
inside a material BTC/Gold MOVE window of 15/30/60/120 minutes.

The P0 question is narrower:

> During the same market MOVE, did front-end rates, long-end rates, or qualified real-rate
> evidence reprice synchronously?

This checkpoint qualifies the source landscape before any runtime is authorized.

## 2. Non-negotiable semantic boundaries

P365 must keep the following data classes distinct.

### 2.1 Treasury constant-maturity rate

Example:

`DGS10`

This is a Treasury/Federal Reserve daily par-curve observation. It is not a live quote for one
specific on-the-run Treasury security.

### 2.2 On-the-run cash Treasury

Example economic meaning:

`current on-the-run 10Y Treasury market price/yield`

This is a specific recently auctioned cash security. It is not identical to the 10Y
constant-maturity par rate.

### 2.3 Treasury futures

Examples:

- 2-Year T-Note futures;
- 10-Year T-Note futures.

These are derivatives. Their prices embed futures/basis/delivery mechanics and must not be
stored or presented as cash Treasury yields.

### 2.4 Treasury Yield futures

Examples:

- CME 2-Year Yield futures (`2YY`);
- CME 10-Year Yield futures (`10Y`).

These are derivatives quoted directly in yield and anchored at settlement to BrokerTec
on-the-run benchmarks. They are useful synchronous yield-pricing proxies, but they are still
futures and are not the current spot/cash Treasury yield.

### 2.5 TIPS market pricing versus constant-maturity real yield

Real-time pricing for a specific TIPS instrument is not automatically the same data series as
`DFII10`, which is a daily 10-year constant-maturity inflation-indexed yield.

P365 must not silently relabel one as the other.

## 3. Existing official daily source — RETAIN

### US Treasury / FRED

US Treasury publishes nominal and real par yield curves from indicative bid-side market price
quotations obtained around 3:30 p.m. ET on each trading day. Treasury derives fixed-maturity
par rates from the fitted curve.

Existing P365 FRED observations remain the canonical slow/background layer.

Source references:

- https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/
- https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology
- https://fred.stlouisfed.org/series/DGS10
- https://fred.stlouisfed.org/series/DFII10

### Verdict

- authority: **PASS**
- semantic clarity: **PASS**
- durable use in P365: **ALREADY ACTIVE**
- intraday 15/30/60/120m suitability: **FAIL — DAILY**
- action: **retain; do not replace**

Alpha Vantage's Treasury-yield endpoint is not an intraday alternative because its documented
Treasury-yield cadence is daily/weekly/monthly and the underlying series is sourced through
FRED.

Source:

- https://www.alphavantage.co/documentation/

## 4. Direct nominal cash market — BrokerTec On-the-Run U.S. Treasuries

CME Group's BrokerTec On-the-Run U.S. Treasury data is the strongest audited direct cash-market
candidate for nominal intraday transmission evidence.

Public product documentation states that the feed:

- covers on-the-run 2Y, 3Y, 5Y, 7Y, 10Y, 20Y and 30Y Treasuries;
- provides continuous real-time data;
- includes top-of-book bid/offer and five levels of aggregated depth;
- also covers when-issued pricing.

Source:

- https://www.cmegroup.com/market-data/browse-data/catalog/brokertec-us-treasuries-on-the-run.html

### Important runtime caveat

The public catalog proves direct real-time cash Treasury pricing coverage, but it does not by
itself freeze the exact machine schema needed by P365 or prove that the selected delivery path
supplies a provider-native yield field for every observation.

If a runtime feed supplies price rather than yield, converting bond price to yield would require
a deterministic methodology with:

- exact CUSIP/security identity;
- coupon;
- maturity;
- settlement convention;
- accrued interest/day-count convention;
- calculation version.

That calculation must not be hidden inside raw provider normalization.

### Licensing

CME explicitly treats internal non-display use in software/processes for research/analysis as a
licensable market-data use and routes organizational access through its Information License
Agreement framework.

Sources:

- https://www.cmegroup.com/market-data/license-data.html
- https://www.cmegroup.com/market-data/license-data/market-data-policy-education-center.html

Website pages are not an authorized substitute for a licensed feed. CME website data terms
prohibit systematic extraction/data mining without permission.

Source:

- https://www.cmegroup.com/trading/market-data-explanation-disclaimer.html

### Verdict

- direct cash-market semantic fit: **PASS**
- 2Y/10Y coverage: **PASS**
- synchronous cadence: **PASS**
- source authority/provenance: **PASS**
- exact runtime schema/yield-field proof: **OPEN**
- free production path: **FAIL**
- P365 entitlement/license: **UNVERIFIED**
- runtime approval: **NO**

BrokerTec is the preferred **direct-cash** path if owner-approved licensing and exact feed
schema later pass qualification.

## 5. Transaction-based BrokerTec Treasury Benchmarks — HIGH QUALITY / CADENCE INSUFFICIENT

BrokerTec U.S. Treasury Benchmarks are transaction-based yields for on-the-run Treasuries and
are conceptually high-quality yield observations.

However, the benchmark publication schedule is discrete rather than a five-minute live series.
That makes it useful for validation/anchor purposes, not the primary P365 15/30/60/120-minute
MOVE evidence stream.

Sources:

- https://www.cmegroup.com/market-data/cme-group-benchmark-administration/brokertec-us-treasury-benchmarks.html
- https://www.cmegroup.com/markets/interest-rates/yield-futures.html

### Verdict

- source quality: **PASS**
- provider-native yield semantics: **PASS**
- primary MOVE-window cadence: **FAIL**
- role: **validation / anchor, not hot path**

## 6. CME Yield futures — QUALIFIED EXPLICIT FUTURES PROXY

CME Yield futures provide a cleaner yield-oriented derivatives proxy than silently converting
standard Treasury futures into a cash-yield series.

Relevant contracts:

- `2YY` — 2-Year Yield futures;
- `10Y` — 10-Year Yield futures.

CME documents that Yield futures:

- trade directly in yield;
- reference recently auctioned/on-the-run Treasury curve points;
- are anchored by BrokerTec U.S. Treasury benchmarks;
- settle in cash to the corresponding benchmark;
- trade around the clock;
- use fixed $10 per basis-point exposure.

Sources:

- https://www.cmegroup.com/markets/interest-rates/yield-futures.html
- https://www.cmegroup.com/education/articles-and-reports/introducing-yield-futures
- https://www.cmegroup.com/articles/faqs/yield-futures-faq.html

### Semantic boundary

A future canonical Yield-futures Observation must be:

- marketDomain: `RATES`;
- informationClass: `PRICING`;
- jurisdiction: `US`;
- instrument: `FUTURE`;
- tenor: `2Y` or `10Y`;
- contract month: explicit;
- provider/source: explicit.

It must **not** use the same series identity as:

- `DGS2`;
- `DGS10`;
- direct BrokerTec on-the-run cash pricing.

### Verdict

- synchronous macro-pricing usefulness: **PASS**
- direct-yield quotation: **PASS**
- cash-yield equivalence: **FAIL — FUTURES PROXY**
- licensing/entitlement for automated durable use: **REQUIRED / UNVERIFIED**
- runtime approval: **NO**
- fallback rank: **PREFERRED EXPLICIT PROXY if direct cash is unavailable and licensed access is approved**

## 7. Standard Treasury futures — EXISTING RESEARCH PROXY / DO NOT PROMOTE

P365 already has event-specific research using 2-Year Treasury Note futures (`ZT`).

Standard Treasury futures can be useful as directional rate-repricing evidence, but they carry
contract/delivery/basis mechanics and are priced in futures-price conventions rather than a
provider-native cash yield.

The existing ZT path therefore remains a research/event-specific proxy.

Rules:

- do not rename ZT as `US 2Y yield`;
- do not rename 10-Year Treasury Note futures as `US 10Y cash yield`;
- do not mix futures-price percentage moves with Treasury yield basis-point changes;
- any later use must preserve contract month and futures identity.

### Verdict

- directional repricing evidence: **USEFUL**
- canonical cash-yield substitute: **FAIL**
- new runtime in this checkpoint: **NO**

## 8. Twelve Data fixed-income API — OPERATIONALLY PROMISING / PROVENANCE GATE OPEN

Twelve Data documents a fixed-income catalog and generic time-series API.

Public documentation directly demonstrates:

- fixed-income symbol `US2Y` named `US Treasury Yield 2 Years`;
- instrument type `Bond`;
- generic time-series intervals including `1min` and `5min`;
- historical time-series retrieval;
- timestamped OHLC bars;
- fixed-income market-data availability on qualifying plans.

Sources:

- https://twelvedata.com/docs
- https://twelvedata.com/pricing-business
- https://twelvedata.com/terms

Twelve Data's January 2026 terms permit access, processing and storage for Internal Use subject
to the customer's subscription tier and third-party data restrictions. Free-tier data is not
authorized for commercial use.

### Why it is not frozen as the P365 provider yet

Public documentation does not yet establish enough source-level lineage for P365 to claim that
the Treasury-yield series is equivalent to:

- U.S. Treasury constant-maturity yields;
- BrokerTec on-the-run cash yields;
- another named transaction/quote benchmark.

The catalog example also proves `US2Y`, but this audit has not independently live-proven the
exact `US10Y` symbol/response, its source lineage, market-hours behavior, or quote-latency
semantics.

The business pricing page also distinguishes catalog/reference access from fixed-income market
data access; production use must be evaluated under the actual business tier and any underlying
third-party restrictions.

### Runtime qualification requirements

Before Twelve Data can be selected, a later live qualification must prove:

1. exact `US2Y` and 10Y symbol identities;
2. exact economic meaning of each returned number;
3. upstream/source lineage;
4. 5-minute availability on both required tenors;
5. exchange/timezone semantics;
6. bar-open/bar-close timestamp meaning;
7. real-time versus delayed status;
8. historical depth;
9. missing/holiday behavior;
10. Internal Use and durable-retention rights for P365's selected plan;
11. any third-party data licensing obligations.

### Verdict

- API ergonomics: **PASS**
- potential 5m cadence: **PASS AT GENERIC API LEVEL**
- `US2Y` catalog discovery: **PASS**
- exact 10Y live identity: **UNVERIFIED**
- upstream benchmark/source lineage: **UNVERIFIED**
- durable production rights: **PLAN/THIRD-PARTY DEPENDENT**
- runtime approval: **NO — LIVE SOURCE-LINEAGE QUALIFICATION REQUIRED**

Twelve Data remains the most practical audited **aggregator candidate** for a future bounded
live qualification, not a canonical source selection in MACRO-RATES-001A.

## 9. Intraday real-yield evidence — UNRESOLVED

### Existing daily truth

`DFII10` remains P365's authoritative daily 10Y constant-maturity inflation-indexed yield.

U.S. Treasury explicitly describes the real par curve as a daily curve built from indicative
TIPS market quotations around 3:30 p.m. ET.

### GovPX

GovPX U.S. Treasury and Agency data offers:

- real-time and historical U.S. Treasury market data;
- TIPS coverage;
- on-the-run and off-the-run coverage.

Source:

- https://www.cmegroup.com/market-data/browse-data/catalog/govpx-us-treasury-and-agency.html

This makes GovPX a strong institutional candidate for **intraday TIPS market evidence**.

However, the public product page does not prove a provider-native intraday series semantically
identical to the Treasury/FRED 10Y constant-maturity real yield.

Therefore:

`real-time TIPS market data != automatically DFII10 intraday`

### Explicit prohibition

MACRO-RATES-001A does not authorize P365 to manufacture an intraday 10Y real yield by:

- relabeling one TIPS instrument as constant-maturity real yield;
- combining a live nominal yield with stale daily `DFII10`;
- subtracting unrelated nominal/inflation proxies;
- using retrieval time as quote time;
- hiding a calculated bond yield as provider-native data.

### Verdict

- direct intraday TIPS market source candidate: **YES — GovPX**
- direct intraday 10Y constant-maturity real-yield source: **NOT QUALIFIED**
- free-first qualified path: **NOT FOUND**
- runtime status: **MISSING_HIGH_VALUE_EVIDENCE**

P365 must prefer an explicit missing-evidence state over a false real-yield proxy.

## 10. Policy-implied path — DO NOT DUPLICATE

US policy-implied pricing is already governed by:

`P365-US-POLICY-IMPLIED-PRICING-CONTRACT-v0.1.md`

Current status remains:

> CME FedWatch semantically qualified / runtime licensing open.

MACRO-RATES-001A does not create another FedWatch/OIS/SOFR-futures contract and does not loosen
that runtime gate.

## 11. Frozen data requirements for a future nominal-rates runtime

A future MACRO-RATES runtime intended for MOVE investigation must preserve at minimum:

- economic series meaning;
- direct cash versus futures/proxy identity;
- tenor;
- exact security or contract identity where applicable;
- provider-native symbol;
- quote/bar timestamp;
- retrieval timestamp;
- value and unit;
- bid/ask/mid/last or OHLC field meaning;
- delayed/realtime status;
- source/provider lineage;
- market-hours calendar;
- quality/freshness;
- history and revision identity;
- license/retention basis.

Target cadence:

- preferred: **5 minutes or finer**;
- slower data must not masquerade as synchronous 15-minute MOVE evidence.

Missing data is not zero and is not eligible for interpolation unless a later methodology
explicitly authorizes it.

## 12. Candidate canonical semantic families

These are semantic families, not permission to create runtime rows.

### Direct cash on-the-run nominal rates

2Y:

`RATES / PRICING / US / SOVEREIGN_BOND / tenor=2Y`

10Y:

`RATES / PRICING / US / SOVEREIGN_BOND / tenor=10Y`

Identity must distinguish these from daily constant-maturity Treasury series.

### Yield futures proxy

2Y:

`RATES / PRICING / US / FUTURE / tenor=2Y`

10Y:

`RATES / PRICING / US / FUTURE / tenor=10Y`

Contract month must be explicit.

### Real-rate/TIPS evidence

No new canonical intraday constant-maturity real-yield family is frozen until source semantics
or an approved calculation methodology closes the gap.

## 13. Source decision matrix

| Source | Economic meaning | Intraday | Provenance fit | Durable-use gate | MACRO-RATES-001A verdict |
|---|---|---:|---|---|---|
| Treasury/FRED DGS2/DGS10/DFII10 | Constant-maturity nominal/real yields | No | Excellent | Existing | **RETAIN DAILY BACKGROUND** |
| Alpha Vantage Treasury Yield | Repackaged FRED Treasury yield | No | Clear | Existing provider but unnecessary | **REJECT FOR INTRADAY** |
| BrokerTec OTR UST | Direct cash on-the-run Treasury market | Yes | Excellent | CME ILA / entitlement | **PREFERRED DIRECT-CASH CANDIDATE; RUNTIME BLOCKED** |
| BrokerTec UST Benchmarks | Transaction-based OTR benchmark yield | Discrete | Excellent | CME licensing | **VALIDATION/ANCHOR; CADENCE FAIL** |
| CME 2YY / 10Y Yield futures | Yield-quoted futures proxy | Yes | Excellent | CME market-data entitlement | **PREFERRED EXPLICIT FUTURES PROXY; RUNTIME BLOCKED** |
| Standard ZT / 10Y note futures | Treasury futures-price proxy | Yes | Excellent | market-data entitlement | **RESEARCH PROXY ONLY** |
| Twelve Data fixed income | Aggregated Treasury-yield API candidate | Potentially | **Open** | fixed-income entitlement + third-party terms | **MACRO-RATES-001B ACCESS-GATED; NOT RUNTIME-APPROVED** |
| Massive CME/CBOT futures | Standard Treasury futures + Yield futures proxy | Yes where traded | Excellent instrument provenance | non-display/business/CME rights | **MACRO-RATES-001B TECHNICAL LIVE PASS; DURABLE RIGHTS GATE** |
| GovPX TIPS | Direct TIPS market pricing | Yes | Excellent for TIPS market | CME/GovPX licensing | **REAL-RATE CANDIDATE; CMT EQUIVALENCE NOT PROVEN** |

## 14. Checkpoint verdict

### Nominal 2Y / 10Y

The market-data route is now understood, but no production provider is approved.

Preferred hierarchy:

1. **BrokerTec direct cash** remains preferred if owner-approved entitlement + exact schema satisfy runtime needs;
2. for an explicitly labeled intraday **proxy**, the risk review now prefers **ZT + TN**, not ZT + ZN: ZT is tightly aligned to the 2Y maturity area, while CME's TN Ultra 10-Year basket is materially closer to the 10Y cash point than ZN; bounded live proof showed TNZ6 remained highly liquid in the tested session. This is risk qualification only, not runtime approval;
3. **CME Yield futures** remain semantically attractive because they trade directly in yield, but the bounded Massive proof found usable 10Y activity and no 2YY trade bars in the same test window, so the pair is not selected as the primary synchronous proxy;
4. **Twelve Data** remains access-gated; owner-approved fixed-income entitlement would still be required before a genuine live yield-series qualification;
5. existing daily FRED remains background when no qualified intraday runtime is authorized.

P365 must not scrape CME/Yahoo websites to bypass a licensing gate.

### 10Y real yield

Remain explicitly:

`MISSING_HIGH_VALUE_EVIDENCE`

until a direct source or separate methodology is approved.

### Policy path

Remain under the existing FedWatch contract and licensing gate.

## 15. Next runtime gate

Do **not** implement MACRO-RATES-001B as durable production ingestion under the current
individual Massive entitlement.

The technical source-selection gate is now closed for an explicit proxy:

- product family, if a free lawful source later qualifies: `ZT` + `TN`;
- semantics: Treasury futures **price** proxy, never cash yield;
- 5m technical coverage: live-proven;
- point-in-time contract roll: frozen in
  `P365-MASSIVE-US-RATES-PROXY-QUALIFICATION-v0.1.md`;
- completed-bar and missing-bar semantics: frozen.

The remaining blocking gate is rights/entitlement.

Paid entitlement is no longer an implementation option for the current MVP.

A future runtime may proceed only if a **free** source can legally support:

1. recurring server-side ZT/TN acquisition;
2. internal automated analysis;
3. durable storage/retention where required;
4. derived factual comparison outputs;
5. the intended display boundary.

If no free source passes these gates, P365 must keep intraday rates proxy evidence explicitly
unavailable.

## 16. Explicit non-goals

MACRO-RATES-001A does not add or activate:

- provider runtime;
- API key;
- external dependency;
- Supabase job;
- durable writes;
- Yahoo rates ingestion;
- CME webpage scraping;
- bond-yield calculation;
- real-yield calculation;
- breakeven calculation;
- curve-spread runtime;
- FedWatch runtime;
- Treasury auction evidence;
- MOVE-002B wiring;
- UI;
- State/Regime/Risk/Intelligence;
- causal scoring;
- trading signals or execution.


## 17. MACRO-RATES-001B Twelve Data bounded qualification — 4 Oct 2026

MACRO-RATES-001B attempted the next bounded qualification step without activating a provider.

Verified public/provider facts:

- Twelve Data documents `US2Y` in the fixed-income reference catalog;
- the generic time-series API supports 5-minute intervals and bar-open timestamp semantics;
- fixed-income **market data** is listed on Pro individual / Venture business tiers, while Basic
  primarily exposes reference data plus other market families and trial symbols;
- the current US trial-symbol page identifies AAPL rather than a Treasury-yield symbol;
- Twelve Data terms permit Internal Use processing/storage only subject to the actual
  subscription tier, add-ons and third-party restrictions.

P365 environment inspection found no `TWELVE_DATA_API_KEY`.

Therefore a genuine US2Y/10Y 5-minute market-data proof could not be executed without first
obtaining owner-approved account entitlement. Exact 10Y symbol identity, symbol-specific
history, latency, market-session behavior and upstream Treasury benchmark lineage remain
unverified.

Verdict:

> **TWELVE DATA = ACCESS-GATED CANDIDATE / NOT RUNTIME-APPROVED**

Normative qualification record:

`P365-TWELVE-DATA-US-RATES-QUALIFICATION-v0.1.md`

No credential, purchase, provider runtime, scheduler or durable write is authorized by this
result.


## 18. MACRO-RATES-001B continuation — Massive Treasury Futures qualification

The owner instructed MACRO-RATES-001B to continue in PR #166 rather than opening a new PR.

P365 therefore audited the already-configured Massive provider before accepting a new paid
rates dependency.

A preview-only Vercel qualification using the existing server-side `MASSIVE_API_KEY` proved:

### Yield Futures

- `2YY`: product and active-contract discovery PASS, but both tested active single contracts
  (`2YYV6`, `2YYX6`) returned zero 5-minute trade bars in the tested session;
- `10Y`: product/contract discovery PASS;
- `10YV6`: 344 five-minute bars, volume 3,540, 1,739 transactions;
- `10YX6`: 48 bars, volume 233, 128 transactions.

Verdict:

`YIELD_FUTURES = PARTIAL_TECHNICAL_PASS / 2YY_SYNCHRONOUS_LIQUIDITY_FAIL`

### Standard Treasury Futures

Most liquid observed contracts in the same test window:

- `ZTZ6` — 527 five-minute bars, volume 3,050,214, 174,869 transactions;
- `ZNZ6` — 528 five-minute bars, volume 6,765,907, 384,754 transactions.

Both had only one observed gap over 15 minutes in the bounded window, consistent with a
session break rather than sparse trading.

Verdict:

`ZT_ZN = STRONG_TECHNICAL_LIVE_PASS_AS_FUTURES_PRICE_PROXY`

This does not authorize a cash-yield label or exact basis-point inference. Standard Treasury
futures are physically delivered price contracts with deliverable-basket, CTD, conversion
factor, carry and roll mechanics.

### Rights gate

Massive's current individual Market Data Terms restrict market data to personal/non-business
use and, absent a separate agreement, default display use. Non-display use/derived application
use requires the appropriate permission/license.

P365 recurring server-side acquisition + durable Market Memory + automated MOVE reasoning must
therefore remain:

`CURRENT_INDIVIDUAL_RIGHTS_NOT_AUTHORIZED_FOR_P365_NON_DISPLAY_RUNTIME`

The existing key proves technical access only. CME's published non-display guidance classifies research and analysis as Category C-2 application use, so this is now an explicit entitlement blocker rather than an unknown legal state.

Normative detailed record:

`P365-MASSIVE-US-RATES-PROXY-QUALIFICATION-v0.1.md`

No production adapter, scheduler or Market Memory write is authorized by this qualification.


## 19. MACRO-RATES-001B rights + roll closure — 4 Oct 2026

The owner asked to continue in PR #166.

### Rights conclusion

Current public Massive individual Market Data Terms are incompatible with the proposed
production workflow because they restrict individual data to personal/non-business use, default
to display use, and prohibit non-display/derived use unless separately licensed.

CME's published Non-Display guidance defines non-viewable processing/analysis in software as
Non-Display Use and explicitly places research and analysis in Category C-2.

Therefore:

`CURRENT MASSIVE INDIVIDUAL ACCESS = NOT AUTHORIZED FOR P365 PRODUCTION NON-DISPLAY USE`

This is stronger than the previous `UNVERIFIED` status.

A future compliant path must be documented in writing through Massive/CME. Massive currently
advertises a CBOT Business futures plan with exchange assistance, but purchase alone is not
treated as proof of Category C-2, storage, or derived-output rights.

### Roll methodology

The canonical ZT/ZN proxy selection is now frozen:

1. point-in-time active `type=single` contracts only;
2. target-session selection uses only the most recent **completed prior CBOT session**;
3. liquidity measure = provider-reported prior-session volume;
4. selected ticker is fixed for the full target session;
5. incumbent remains selected unless a **later-expiry** contract has strictly greater prior-session volume;
6. ties retain incumbent;
7. roll can move forward only, never backward;
8. inactive incumbent must be replaced by the highest-volume eligible later contract;
9. no positive-volume candidate + no retainable incumbent => `UNAVAILABLE_CONTRACT_SELECTION`;
10. no cross-contract price comparison is allowed — differing native tickers produce
    `ROLL_BOUNDARY`.

No guessed percentage crossover threshold is used.

### Bar completion

Massive documents `window_start` as the beginning of the aggregation window and states that
no-trade intervals have no bar.

For 5m canonical data:

`observedAt = window_start + 5m`

and only completed bars are eligible.

### Canonical proxy identities

If rights are later approved:

- `rates.us_treasury_2y_note_futures_price.points`
- `rates.us_treasury_10y_note_futures_price.points`

with:

`RATES / PRICING / US / FUTURE / tenor=2Y|10Y`

and exact contract ticker retained as mandatory provider provenance.

### Existing research helper

`rates-historical-reconstruction.ts` remains research-only and unchanged. Its current
nearest-maturity-with-bars selection must not be reused silently as the future canonical
production roll policy.

Current final state:

`PROXY_TECHNICALLY_QUALIFIED / METHODOLOGY_FROZEN / RUNTIME_BLOCKED_BY_RIGHTS`


## 20. Owner FREE-ONLY + proxy-risk decision — 4 Oct 2026

Owner decision:

> Do not use paid data. If a proxy is considered, assess its risk before activation.

This overrides any earlier "possible paid entitlement" implementation path.

### Paid paths rejected for current MVP

Do not activate:

- Massive Business / CME paid Non-Display;
- Twelve Data paid fixed income;
- BrokerTec paid cash Treasury;
- any equivalent paid rates feed.

### Proxy risk conclusion

The earlier ZT+ZN preference was revised after tenor-fidelity review.

CME contract structure:

- ZT deliverable maturity: approximately 1y9m–2y;
- ZN deliverable maturity: approximately 6.5–8y;
- TN Ultra 10-Year: approximately 9y5m–10y.

Therefore ZN is not sufficiently faithful to the 10Y cash point for the intended P365 macro
label.

A bounded TN live check returned:

- TNZ6: 525 five-minute bars;
- volume: 2,029,436;
- transactions: 167,668.

So, if a free and legally compatible source later exists, the preferred proxy family is:

`ZT + TN`

not:

`ZT + ZN`.

Even ZT+TN remains subject to CTD/basis/repo, DV01 mismatch, roll, closed-market, stress
dislocation and causality risks. It may only serve as explicitly labeled synchronous
Treasury-futures **price** evidence.

It must never substitute for:

- DGS2/DGS10 cash/constant-maturity yield values;
- basis-point yield changes;
- 2s10s curve magnitude;
- DFII10 real yield;
- Fed policy probabilities.

Current runtime decision:

`FREE_ONLY / PROXY_RISK_REVIEWED / NO_RATES_PROXY_RUNTIME_APPROVED`
