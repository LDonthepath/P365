# P365 Move-Centered Evidence Investigation Contract v0.1

**Checkpoint:** MOVE-002A  
**Status:** MERGED / PR #155  
**Trigger dependency:** MOVE-001C `ContinuousMoveAssessment.status = MATERIAL_MOVE`  
**Scope:** Evidence organization and coverage qualification for move-driven investigation  
**Primary MVP targets:** Bitcoin + Gold  
**Implementation effect:** Contract / coverage audit only. No provider integration, persistence, scheduler, UI, causal engine, State/Regime/Risk/Intelligence, prediction, or trading logic.

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

Current qualified MVP set:

- BTC spot;
- ETH spot;
- DXY;
- Gold futures.

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
