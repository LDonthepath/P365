# P365 Move-Centered Evidence Investigation Contract v0.1

**Checkpoint:** MOVE-002A + MOVE-002B  
**Status:** MOVE-002A MERGED / MOVE-002B READ-ONLY RUNTIME IMPLEMENTED  
**Trigger dependency:** MOVE-001C `ContinuousMoveAssessment.status = MATERIAL_MOVE`  
**Scope:** Evidence organization and coverage qualification for move-driven investigation  
**Primary MVP targets:** Bitcoin + Gold  
**Implementation effect:** MOVE-002A defines the contract; MOVE-002B adds a read-only repository-backed evidence bundle runtime. No provider activation, persistence, scheduler, UI, causal engine, State/Regime/Risk/Intelligence, prediction, or trading logic.

## 1. Purpose

MOVE-001C answers:

> Did BTC or Gold move materially relative to its own point-in-time history?

MOVE-002 answers the next product question:

> What qualified evidence was available around that move, what evidence was only background context, and what important evidence was missing?

MOVE-002A deliberately does **not** answer:

> What definitively caused the move?

The objective is to make causal investigation evidence-bounded before adding any explanatory language.

## 2. Investigation trigger

A move-centered investigation may start only from a MOVE-001C assessment with:

`status = MATERIAL_MOVE`

The detector assessment remains the trigger identity. P365 must not fabricate an economic Event to own a move-driven investigation.

The investigation window is deterministic:

- end = the MOVE target end Observation time;
- start = the earliest target-start Observation among the horizons classified `MATERIAL_MOVE`;
- all evidence is evaluated under the same point-in-time `asOf` cutoff carried by the MOVE assessment.

This union window preserves the full observed material move without selecting a preferred horizon by narrative judgment.

## 3. Evidence roles

MOVE evidence is divided by temporal role. These roles must not be silently mixed.

### 3.1 SYNCHRONOUS_MARKET evidence

Evidence that can be measured on an intraday cadence close enough to the MOVE window to describe the contemporaneous market fingerprint.

Current qualified durable MVP set:

- BTC spot;
- ETH spot;
- DXY;
- Gold futures;
- USDJPY;
- offshore USDCNH.

USDJPY/USDCNH were added later by ASIA-MACRO-001A/001B and remain factual FX transmission evidence only.

For cross-series synchronization, the first policy permits nearest-time alignment within **±120 seconds** around the MOVE start/end timestamps.

The ±120-second tolerance is production-derived, not arbitrary. A 1–3 Oct 2026 audit against BTC observation timestamps found:

| Supporting series | Median nearest error | P90 error | Within ±120s |
|---|---:|---:|---:|
| ETH spot | 0s | 20s | 576 / 576 |
| DXY | 88s | 108s | 500 / 524 |
| Gold futures | 85s | 101.2s | 507 / 530 |

No interpolation, forward-fill, backward-fill, or unbounded nearest-neighbor selection is allowed.

Synchronous evidence describes factual co-movement only. It is not causal attribution.

## 3.2 SLOW_BACKGROUND evidence

Evidence whose source cadence is materially slower than the intraday MOVE window.

Current qualified examples:

- USD stablecoin market cap — daily;
- US spot BTC ETF net flow — trading-day flow;
- CFTC Gold positioning — weekly.

These inputs may describe the environment entering a move, but they must be explicitly labeled `BACKGROUND_CONTEXT`.

They must **not** be presented as proof that they caused a move at a specific minute.

## 3.3 SCHEDULED_CATALYST evidence

Canonical economic Events may be attached when their qualified occurrence/release timing is relevant and knowable by the common `asOf`.

Rules:

- a future Event is not an explanation for an earlier move merely because it is economically important;
- scheduled time alone does not prove causal impact;
- date-only anchors cannot be treated as minute-precision catalysts;
- absence of a scheduled Event does not imply absence of an unscheduled catalyst.

Event-driven evidence remains a candidate evidence class inside MOVE investigation, not the root identity.

## 3.4 UNSCHEDULED_CATALYST evidence

Unscheduled policy communication, geopolitical developments, exchange/infrastructure developments, company/market announcements, or other news may explain moves that have no calendar Event parent.

Current P365 durable coverage is insufficient for this evidence role.

MOVE-002A therefore freezes this family as:

`MISSING_HIGH_VALUE_EVIDENCE`

until a separately qualified source and point-in-time publication/retrieval policy exists.

## 3.5 CRYPTO_MARKET_STRUCTURE evidence

For BTC, high-value evidence includes:

- futures/perpetual open interest;
- funding rate;
- liquidation / forced-order activity;
- taker buy/sell activity;
- futures basis where qualified;
- later options evidence if a concrete downstream need requires it.

Current P365 does not have a qualified crypto-native derivatives runtime for these metrics.

This family is therefore:

`MISSING_HIGH_VALUE_EVIDENCE`

for MOVE-002A.

The owner has authorized **Binance as a provider candidate for evaluation** when existing providers cannot supply the required crypto market-structure evidence. Provider qualification remains a separate checkpoint; MOVE-002A does not authorize ingestion.

## 3.6 INTRADAY_RATES_PRICING evidence

For Macro-driven BTC/Gold investigation, high-value evidence includes intraday changes in rates / real yields / policy pricing.

Current durable FRED Treasury/rate evidence is daily or otherwise not an intraday market-price feed. The existing ZT reconstruction path is research/event-specific and explicitly is not a canonical US 2Y cash yield feed.

Therefore MOVE-002A classifies continuous intraday rates/pricing as:

`MISSING_HIGH_VALUE_EVIDENCE`

A later source-qualification checkpoint is required before P365 can use intraday rates as synchronous MOVE evidence.

## 4. Evidence states

Every evidence family must expose one of:

- `AVAILABLE_SYNCHRONOUS`;
- `AVAILABLE_BACKGROUND`;
- `AVAILABLE_CATALYST`;
- `MISSING_HIGH_VALUE_EVIDENCE`;
- `INSUFFICIENT_DATA`;
- `UNKNOWN`.

The state describes evidence availability and temporal fitness, not market meaning.

## 5. Driver hypotheses and causal boundary

MOVE investigation may eventually evaluate hypotheses such as:

- broad crypto co-movement;
- USD / rates repricing;
- scheduled macro catalyst;
- leverage expansion;
- short covering / liquidation;
- flow backdrop;
- unscheduled information shock.

However, a hypothesis may only receive supporting or contradicting evidence when a separate explicit methodology defines:

1. the evidence required;
2. point-in-time eligibility;
3. the expected relationship;
4. contradiction criteria;
5. missing-data behavior.

Until then:

`causalAttribution = NOT_EVALUATED`

P365 must prefer:

`UNEXPLAINED / EVIDENCE_INCOMPLETE`

over a plausible-sounding narrative that the evidence cannot establish.

## 6. Reproduced BTC case — 2 Oct 2026

The production MOVE case at approximately 04:30 UTC / 11:30 WIB is the acceptance case for this contract.

### 6.1 Synchronous market fingerprint

Using nearest observations inside ±120 seconds of the BTC timestamps:

| Series | ~60m move | ~120m move |
|---|---:|---:|
| BTC spot | +1.7750% | +2.1669% |
| ETH spot | +1.1012% | +1.2231% |
| DXY | -0.0186% | -0.1049% |
| Gold futures | +0.3328% | +0.7472% |

This supports a factual statement that BTC, ETH and Gold were higher while DXY was modestly lower over the same broad interval.

It does **not** establish which market led or caused another.

### 6.2 Scheduled catalyst coverage

Production Event history for 2 Oct 2026 shows the next major US labor releases at:

`2026-10-02T12:30:00Z / 19:30 WIB`

including Nonfarm Payrolls, Unemployment Rate and Average Hourly Earnings.

The reproduced BTC move ended around 04:30 UTC / 11:30 WIB, approximately eight hours earlier.

Therefore the move did not have a same-window qualified scheduled US macro release in current Event history.

This does not rule out anticipation, unscheduled information, or another catalyst.

### 6.3 Slow background evidence knowable at the move cutoff

At `2026-10-02T04:30:30Z`:

- USD stablecoin market cap had a 2 Oct effective observation retrieved at 01:17 UTC;
- the latest mature US spot BTC ETF flow available to P365 was dated 29 Sep and had been retrieved on 1 Oct.

These are valid point-in-time background facts, but their cadence does not make them minute-level trigger evidence.

### 6.4 Rates gap

At the same cutoff, latest knowable FRED rate observations included:

- DGS2 observed 30 Sep;
- DGS10 observed 30 Sep;
- DFII10 observed 30 Sep;
- T10YIE observed 1 Oct.

These are useful Macro context but cannot describe intraday rates repricing during the 04:30 UTC BTC move.

### 6.5 Crypto derivatives / unscheduled-news gap

Repository/code audit found no qualified BTC derivatives series for liquidation, taker flow, perpetual/futures open interest or funding-rate MOVE investigation.

The apparent `open interest` durable series currently present is CFTC Gold open interest, not BTC derivatives evidence.

Production durable Evidence also contained zero `kind=NEWS` rows between 02:00 and 05:00 UTC on 2 Oct.

Therefore P365 cannot truthfully distinguish, from current durable evidence alone, whether the BTC move was primarily:

- spot demand;
- broad crypto repricing;
- short covering;
- liquidation-driven;
- leveraged position expansion;
- unscheduled-news driven;
- or a combination.

The correct current output is:

`EVIDENCE_INCOMPLETE / CAUSAL_ATTRIBUTION_NOT_EVALUATED`

## 7. First implementation boundary after this contract

The future MOVE-002 runtime should first assemble an evidence bundle, not a prose explanation.

Minimum bundle:

```text
MOVE assessment
  |
  +-- synchronous market fingerprint
  |     BTC / ETH / DXY / Gold
  |
  +-- scheduled catalysts
  |
  +-- slow background
  |     stablecoin / BTC ETF flow / Gold positioning
  |
  +-- missing high-value evidence
        crypto derivatives
        intraday rates/pricing
        unscheduled catalysts/news
```

Only a later hypothesis-evaluation layer may populate supporting/contradicting driver evidence.

## 8. Provider dependency created by this audit

For BTC, the most immediate missing evidence class is crypto market structure.

The next isolated checkpoint should therefore be:

**CRYPTO-STRUCT-001A — Binance Derivatives Evidence Contract & Source Qualification**

CRYPTO-STRUCT-001A source qualification is now defined in `P365-BTC-DERIVATIVES-PROVIDER-QUALIFICATION-v0.1.md`. It compares cross-exchange providers before runtime selection: CryptoQuant is the current preferred market-wide candidate, Coinalyze is the free validation/fallback candidate, CoinGlass is the richest feature benchmark but carries cost/storage constraints, and Binance remains venue-native secondary evidence rather than the market-wide default.

That checkpoint may evaluate Binance only for the metrics required by MOVE investigation. It must separately qualify semantics, endpoint availability, history depth, rate limits, temporal meaning, licensing/usage boundary, and canonical series definitions before any ingestion code is added.

MOVE-002A itself adds no provider.

A separate later checkpoint must address intraday rates/pricing for BTC and Gold.

## 9. Acceptance criteria

MOVE-002A passes when:

1. MOVE-001C material assessments are first-class investigation triggers;
2. evidence roles are separated by temporal fitness;
3. synchronous cross-market context has an explicit production-derived alignment tolerance;
4. daily/weekly flows and positioning cannot masquerade as intraday causes;
5. scheduled Events are candidate catalysts rather than mandatory parents;
6. unscheduled catalyst coverage is explicitly missing;
7. crypto derivatives coverage is explicitly missing;
8. intraday rates/pricing coverage is explicitly missing;
9. the 2 Oct BTC case can produce a factual evidence fingerprint without a fabricated causal story;
10. Binance source qualification is justified by a concrete downstream evidence gap;
11. State / Regime / Risk / Intelligence and trading semantics remain inactive.

## 10. Explicit non-goals

MOVE-002A does not add:

- Binance or another provider runtime;
- any external API call;
- Supabase schema/write changes;
- scheduler/cron;
- MOVE investigation persistence;
- dashboard/UI;
- automatic news search;
- hypothesis scoring;
- causal attribution;
- confidence scoring;
- State / Regime / Risk / Intelligence;
- predictions;
- BUY / SELL / LONG / SHORT;
- position sizing or execution.

## 11. MOVE-002B Read-Only Evidence Bundle Runtime

MOVE-002B implements the first runtime boundary defined in section 7.

Application:

`lib/application/move-evidence-bundle.ts`

### 11.1 Trigger and identity

The runtime accepts only a MOVE-001C assessment with:

`status = MATERIAL_MOVE`

and:

`hasMaterialMove = true`

The MOVE assessment remains the root identity. No synthetic economic Event is created.

The investigation window is unchanged:

- end = MOVE target end Observation time;
- start = earliest target-start Observation among material horizons;
- knowledge cutoff = the exact MOVE assessment `asOf`.

The runtime returns `NOT_TRIGGERED` rather than constructing a bundle from a non-material MOVE.

### 11.2 Point-in-time synchronous market fingerprint

MOVE-002B reads only durable `HistoricalObservationRepository` history under:

`retrievedAt <= assessment.asOf`

Series:

- BTC spot;
- ETH spot;
- DXY;
- Gold futures;
- USDJPY;
- USDCNH.

Each material horizon retains its own synchronous fingerprint. Its start/end points are independently selected inside the frozen **±120 second** alignment tolerance.

The union investigation window is used for catalysts/background scope; it does not collapse 15m/30m/60m/120m fingerprints into one arbitrary return.

Rules:

- latest knowable revision per `observedAt`;
- FND-002Q historical-fitness eligibility;
- no interpolation;
- no forward-fill;
- no backward-fill;
- no later-known revision leakage;
- percentage change only when both selected values are finite and start value is non-zero.

Each series exposes its own state:

- `AVAILABLE_SYNCHRONOUS`;
- `INSUFFICIENT_DATA`;
- `UNKNOWN`.

The family additionally exposes `COMPLETE / PARTIAL / EMPTY` coverage.

### 11.3 Scheduled catalysts

MOVE-002B reads canonical Event history only inside the investigation window and only when:

`Event.retrievedAt <= assessment.asOf`

Zero events is a valid complete result; it means no scheduled catalyst is present in the bounded window under the current Event history.

A bounded 500-row hit fails closed as `UNKNOWN` rather than silently asserting complete coverage.

### 11.4 Slow background

For BTC:

- USD stablecoin liquidity read model;
- matured US spot BTC ETF daily net-flow read model.

For Gold:

- CFTC Gold positioning read model.

These remain `AVAILABLE_BACKGROUND` only. Their slow cadence cannot be promoted to synchronous cause evidence.

### 11.5 Current-only P0 evidence stays explicit

The following source paths are technically available but do not yet provide durable point-in-time MOVE replay:

- Coinalyze BTC derivatives;
- Binance BTC spot taker-flow;
- Binance Spot order-book snapshot;
- Hyperliquid/Binance-perp order-book snapshot;
- GDELT GAL rolling 15-minute current feed.

MOVE-002B therefore does **not** issue fresh provider calls to explain a historical MOVE.

For BTC market structure these are emitted as `INSUFFICIENT_DATA`, with component-specific reasons.

Unscheduled catalysts are also `INSUFFICIENT_DATA` until durable GDELT acquisition can reproduce the MOVE cutoff.

This distinction is deliberate:

`current technical availability != point-in-time historical evidence`

### 11.6 Intraday rates guardrail

MACRO-RATES-001A/001B froze owner policy:

`FREE_ONLY`

No paid rates path is allowed, and no free rates proxy runtime is approved.

MOVE-002B therefore emits:

- state: `MISSING_HIGH_VALUE_EVIDENCE`;
- policy: `FREE_ONLY_NO_APPROVED_RUNTIME`.

It does not call Massive, Twelve Data, BrokerTec, CME, or any rates proxy.

### 11.7 Completeness and causal boundary

The first runtime reports:

`evidenceCompleteness = EVIDENCE_INCOMPLETE`

while high-value unscheduled/market-structure/rates evidence remains non-replayable or missing.

It always retains:

`causalAttribution = NOT_EVALUATED`

MOVE-002B does not populate:

- driver hypotheses;
- supporting/contradicting judgements;
- causal scoring;
- confidence scores;
- prose explanation.

Those require a later methodology checkpoint.

### 11.8 Read-only boundary

MOVE-002B performs:

- no provider acquisition;
- no canonical write;
- no Market Memory write;
- no scheduler mutation;
- no Snapshot write;
- no UI mutation.

The returned bundle explicitly records:

`writesPerformed = false`

The bundle ID is deterministic from the factual bundle content.

### 11.9 Regression coverage

`lib/application/move-evidence-bundle.test.ts` covers:

- material-horizon union window;
- deterministic bundle identity;
- ±120s synchronous alignment;
- rejection of later-known Observation revisions;
- scheduled Event `retrievedAt <= asOf` filtering;
- BTC stablecoin/ETF background composition;
- explicit current-only P0 gaps;
- free-only intraday-rates missing state;
- Gold target keeps CFTC-only slow background and does not inherit BTC market-structure components;
- non-material MOVE rejection;
- unchanged `causalAttribution = NOT_EVALUATED`.


## 12. MOVE-002B read-only production replay proof — 2 Oct 2026

Because Vercel preview builds reached the Hobby build-rate limit during this checkpoint, the
temporary preview diagnostic route was removed and no attempt was made to bypass the platform
limit.

A direct **read-only** production Market Memory audit instead verified the repository inputs
that MOVE-002B consumes. No rows were written or changed.

Replay knowledge cutoff:

`2026-10-02T04:45:00Z`

Target MOVE end:

`2026-10-02T04:30:30Z`

The 04:45 cutoff is deliberate: it preserves point-in-time knowledge while allowing the
existing Yahoo cadence to have retrieved the DXY/Gold end observations at approximately 04:42.

### 12.1 Per-horizon synchronous fingerprint

Nearest point-in-time eligible rows inside ±120 seconds reproduce:

| Series | 15m | 30m | 60m | 120m |
|---|---:|---:|---:|---:|
| BTC spot | +1.4988% | +1.4691% | +1.7750% | +2.1669% |
| ETH spot | +1.0956% | +0.9480% | +1.1012% | +1.2231% |
| DXY | -0.0177% | +0.0020% | -0.0186% | -0.1049% |
| Gold futures | +0.1162% | +0.2232% | +0.3328% | +0.7472% |

Alignment errors were:

- BTC: 0–10s;
- ETH: 0–10s;
- DXY: 82–89s for the sampled points;
- Gold: 80–89s for the sampled points.

All remain inside the frozen ±120s policy.

USDJPY and USDCNH have no point-in-time rows for this historical case because
ASIA-MACRO-001A/001B durable acquisition began later. MOVE-002B therefore reports those series
as `INSUFFICIENT_DATA`; it does not backfill or substitute later observations.

For the current six-series synchronous family, each reproduced horizon is therefore
`PARTIAL` rather than falsely `COMPLETE`.

### 12.2 Scheduled catalysts

Canonical Event history returned zero Events scheduled inside:

`02:30:20Z → 04:30:30Z`

under the same replay cutoff.

That reproduces MOVE-002A's finding that there was no same-window scheduled catalyst. It does
not rule out unscheduled information.

### 12.3 Slow background

Knowable by 04:45Z:

- USD stablecoin market cap:
  - observed 2 Oct 00:00Z;
  - retrieved 2 Oct 01:17Z;
  - value approximately USD 311.47bn;
- latest matured US spot BTC ETF flow:
  - provider trading date 29 Sep;
  - retrieved 1 Oct;
  - approximately +USD 66.19m.

These remain background only.

### 12.4 Explicit unresolved evidence

The replay does not manufacture evidence for:

- BTC derivatives historical MOVE window;
- Binance spot taker-flow historical MOVE window;
- spot/perp order-book historical geometry;
- GDELT historical unscheduled catalysts;
- intraday rates.

Rates remain:

`MISSING_HIGH_VALUE_EVIDENCE / FREE_ONLY_NO_APPROVED_RUNTIME`

The resulting product boundary remains:

`EVIDENCE_INCOMPLETE / CAUSAL_ATTRIBUTION_NOT_EVALUATED`

### 12.5 Verification boundary

The first runtime source file previously compiled successfully in a Vercel preview before the
account reached its build-rate limit. Later exact-head automatic previews were blocked by the
Vercel account rate limit rather than a reported TypeScript/Next.js compile error.

The checkpoint does not reinterpret a build-rate-limit status as a successful exact-head
deployment. The repository test and production replay remain the available verification
evidence until Vercel accepts another preview build.
