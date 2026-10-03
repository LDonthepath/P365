# P365 Continuous Market Move Detection Contract v0.1

**Checkpoint:** MOVE-001A / MOVE-001B / MOVE-001C
**Status:** MOVE-001A MERGED / PR #151 — MOVE-001B MERGED / PR #153 — MOVE-001C RUNTIME PROPOSED / OWNER MERGE PENDING
**Scope:** Continuous factual move detection for the MVP traded markets
**Primary MVP targets:** Bitcoin + Gold
**Supporting context:** Macro, DXY, ETH and other already-qualified evidence
**Implementation effect:** Documentation only. This checkpoint does not add runtime detection, persistence, scheduler changes, providers, UI, State/Regime/Risk/Intelligence, causal attribution, or trading logic.

## 1. Purpose

P365 must be able to notice an important market move before it knows why the move happened.

The existing event-response chain is valuable but cannot be the sole trigger for intraday analysis. A meaningful BTC or Gold move may begin without a qualifying scheduled economic Event. MOVE-001A therefore defines a first-class **move-driven analysis entry point** alongside the existing event-driven path.

The contract answers only:

> Has an MVP traded market moved enough, relative to an explicit point-in-time historical reference, to justify further evidence investigation?

It does not answer why the move happened.

## 2. Reproduced product gap — 2 Oct 2026

Production Market Memory already observed the BTC move that motivated this checkpoint.

| Observation | BTC spot | Factual comparison |
|---|---:|---:|
| `2026-10-02T02:30:20Z` / `09:30:20 WIB` | `84,912` | reference |
| `2026-10-02T03:30:30Z` / `10:30:30 WIB` | `85,239` | reference |
| `2026-10-02T04:30:30Z` / `11:30:30 WIB` | `86,752` | `+1.775%` versus ~60m earlier; `+2.167%` versus ~120m earlier |

The canonical ingestion path therefore captured the price facts. The failure was downstream: P365 had no continuous move detector that could promote the move into a market-analysis target when no qualifying scheduled Event acted as the parent trigger.

These values reproduce the product gap. They do **not** define permanent materiality thresholds and do not establish the cause of the move.

## 3. Trigger architecture

The approved product model has two independent trigger families:

```text
EVENT-DRIVEN
qualified Event
      |
      +--------------------+
                           v
                    analysis target
                           ^
      +--------------------+
      |
MOVE-DRIVEN
qualified material move
```

Neither trigger family replaces the other.

- Event-driven analysis remains appropriate for CPI, NFP, FOMC and other qualified catalysts.
- Move-driven analysis is required for unscheduled information, cross-asset repricing, flow/positioning changes, liquidation mechanics, changing expectations, or unexplained market moves.
- A move-driven target must not fabricate an Event identity merely to reuse event-specific code.

## 4. Canonical target markets

MOVE v0.1 is intentionally narrow.

First-class detection targets:

- `btc.spot.usd`
- `gold.futures.usd`

Supporting series such as ETH, DXY, rates, liquidity, flows and positioning may later participate in investigation, but MOVE-001A does not make them independent primary trigger targets.

Expanding first-class trigger targets requires a separate checkpoint.

## 5. Definitions

### Observed move

A deterministic percentage change between two compatible canonical observations of the same series.

### Candidate move

An observed move with valid point-in-time lineage that is eligible for historical materiality evaluation.

### Material move

A candidate move that crosses an explicitly versioned historical-materiality policy.

MOVE-001A intentionally freezes **no arbitrary fixed percentage threshold** such as `BTC >= 1%`.

Materiality must be calibrated from qualified historical move distributions and must remain explicit by series, horizon/alignment methodology, sample requirements and methodology version.

### Move-driven analysis target

A material move promoted for downstream evidence investigation. It is not an Event and must not be persisted or represented as a fabricated economic Event.

## 6. Point-in-time requirements

Every future detector evaluation must preserve what P365 could have known at the detector cutoff.

At minimum:

- current and comparison observations must be canonical and semantically compatible;
- both observations must satisfy their applicable quality / historical-fitness rules;
- `retrievedAt` must not exceed the detector `asOf` cutoff;
- later revisions must not leak backward;
- provider-specific convenience values must not replace canonical historical facts;
- direction and magnitude must be deterministic from the selected observations;
- exact Observation IDs, `observedAt`, `retrievedAt`, source and series identity must remain in lineage.

## 7. Horizon and alignment methodology

Continuous detection requires multiple intraday horizons so P365 can distinguish a fast impulse from a slower accumulation.

MOVE-001A does not freeze numerical runtime horizons merely by convention. The next calibration checkpoint must audit the actual production observation cadence and historical-pair density before freezing the first supported horizon set.

The calibration must explicitly define:

- requested elapsed horizon(s);
- how the comparison observation is selected;
- any permitted timestamp tolerance;
- how missing observations are handled;
- whether a candidate is rejected when alignment cannot be proven;
- historical sample lookback;
- minimum sample size;
- transformation;
- percentile or other deterministic materiality rule;
- methodology ID/version.

No nearest-neighbor, interpolation, forward-fill, backward-fill or observation-count approximation may be introduced silently.

## 8. Historical materiality

MOVE detection should reuse the existing HIST principles where compatible:

- same-series factual history;
- no lookahead;
- immutable point-in-time lineage;
- explicit transformation;
- explicit sample-size requirement;
- deterministic distribution evidence;
- fail closed on incomplete or incompatible history.

Existing HIST-001A/B may be reused directly only when the calibrated MOVE alignment and history requirements satisfy their invariants. If continuous detection needs a different bounded alignment policy, that policy must be frozen explicitly rather than weakening HIST defaults.

The detector must not convert a percentile into words such as `extreme`, `normal`, `bullish` or `bearish` unless a later consumer contract explicitly owns that interpretation.

## 9. Direction versus magnitude

Materiality and direction are separate facts.

A detector may retain:

- signed percentage change;
- absolute percentage magnitude;
- direction: `UP`, `DOWN`, or deterministic flat/zero handling;
- historical distribution evidence;
- materiality-policy result.

A positive or negative move is not itself evidence of continuation, reversal, regime, or trade direction.

## 10. Separation from cause investigation

MOVE detection ends when it identifies a qualified material market move.

A later move-investigation checkpoint may examine point-in-time evidence around that move, including:

- rates / real yields / policy pricing;
- DXY / broad USD;
- liquidity / funding;
- BTC ETF flow and stablecoin liquidity;
- Gold positioning / flow;
- derivatives / liquidation evidence when separately qualified;
- scheduled Events;
- unscheduled news / policy communication when separately qualified;
- supporting cross-asset observations and historical relationships.

That investigation must distinguish:

- supporting evidence;
- contradicting evidence;
- unavailable / stale evidence;
- `UNEXPLAINED` when evidence is insufficient.

It must not infer causality merely from temporal proximity or correlation.

## 11. Failure semantics

A future runtime must fail explicitly rather than silently classify.

Required high-level states are:

- `QUALIFIED` — candidate has valid lineage and materiality can be evaluated;
- `INSUFFICIENT_DATA` — history/alignment/sample coverage is inadequate;
- `INCOMPATIBLE` — inputs do not share the required series/semantic methodology;
- `UNKNOWN` — repository or another dependency prevents a truthful evaluation.

The later runtime checkpoint may add a separate materiality result only after calibration is frozen.

## 12. Acceptance criteria for MOVE-001A

MOVE-001A passes when the product contract clearly establishes that:

1. scheduled Event identity is not required to initiate intraday market analysis;
2. BTC and Gold can become first-class analysis targets because of their own price movement;
3. materiality is historical-distribution-based and versioned, not a guessed fixed percent;
4. detection preserves point-in-time Observation lineage and no-lookahead semantics;
5. the 2 Oct 2026 BTC production case is recorded as a reproduced trigger gap rather than a causal conclusion;
6. detector output is separated from driver/causality investigation;
7. an unexplained move is an acceptable truthful outcome;
8. existing Event, HIST, Market Memory and canonical Observation contracts remain intact;
9. no State / Regime / Risk / Intelligence or trading semantics are activated.

## 13. Explicit non-goals

MOVE-001A does not authorize:

- runtime detector code;
- scheduler changes;
- new database tables or persistence families;
- new provider/API acquisition;
- hardcoded move thresholds;
- automatic news scraping;
- causal attribution;
- prediction;
- continuation/reversal labels;
- bullish/bearish labels;
- State / Regime / Risk / Intelligence activation;
- BUY / SELL / LONG / SHORT;
- position sizing or execution;
- UI changes.

## 14. Dependency sequence

After owner merge, the bounded next sequence is:

```text
MOVE-001A  continuous move-detection contract
    ↓
MOVE calibration  production cadence + historical materiality methodology
    ↓
MOVE runtime  continuous BTC/Gold detector
    ↓
move-driven evidence investigation contract/runtime
    ↓
Briefing integration
```

Each remains an isolated checkpoint and PR.

The Event pipeline remains active throughout; this sequence adds the missing market-driven trigger path rather than replacing existing event-response work.
## 15. MOVE-001B continuous-horizon and materiality calibration

MOVE-001B freezes the first production-supported continuous-move calibration without
activating the detector runtime.

### 15.1 Production cadence evidence

A read-only production Market Memory audit on 2 Oct 2026 covered the interval from
30 Sep through 2 Oct and found:

| Series | Observations | Median gap | P90 gap | Largest observed gap |
|---|---:|---:|---:|---:|
| BTC spot | 711 | 300s | 320s | 470s |
| Gold futures | 708 | 300s | 310s | 3709s |

The normal cadence is therefore close to five minutes, but observation-count offsets
must not be used as horizon identity because gaps and timestamp jitter exist.

### 15.2 Frozen continuous horizons

The first MOVE calibration supports:

- 15 minutes;
- 30 minutes;
- 60 minutes;
- 120 minutes.

These are elapsed-time horizons, independent from Event Window roles.

### 15.3 Pairing and alignment

For each end Observation and requested horizon, the start Observation is the same-series,
same-source candidate whose actual elapsed time is nearest the requested horizon while
remaining within an explicit **±60 second** tolerance.

If no candidate exists inside that tolerance, that endpoint/horizon is unavailable.
There is no interpolation, forward-fill, backward-fill, or observation-count fallback.

The production audit found the following pair coverage inside ±60 seconds:

| Series | 15m | 30m | 60m | 120m |
|---|---:|---:|---:|---:|
| BTC | 98.2% | 97.5% | 95.5% | 93.7% |
| Gold | 98.4% | 97.2% | 94.6% | 92.9% |

This is sufficient for the first detector policy while still failing closed on actual gaps.

### 15.4 Historical reference window

The first continuous materiality policy uses:

- transformation: `ABSOLUTE_PERCENT_CHANGE`;
- rolling historical lookback: **36 hours**;
- minimum eligible samples per series/horizon: **120**;
- materiality threshold: empirical **P97.5** of the eligible same-series,
  same-horizon historical magnitude distribution;
- methodology: `continuous-market-move-materiality-v1`;
- version: `v1`.

The historical window for a target must end strictly before the target start Observation.
The target move must never contribute to its own threshold distribution.

The minimum sample size is intentionally higher than HIST-001D's 30-sample context
minimum because a P97.5 tail threshold is not sufficiently stable with only 30 samples.

### 15.5 Threshold calibration evidence

At the 2 Oct 2026 13:00 UTC calibration cutoff, the 36-hour production sample produced:

| Series | Horizon | Samples | P97.5 magnitude |
|---|---:|---:|---:|
| BTC | 15m | 423 | 0.4143% |
| BTC | 30m | 420 | 0.7168% |
| BTC | 60m | 413 | 1.0966% |
| BTC | 120m | 412 | 1.3626% |
| Gold | 15m | 417 | 0.3256% |
| Gold | 30m | 414 | 0.4606% |
| Gold | 60m | 408 | 0.6567% |
| Gold | 120m | 408 | 0.8006% |

These percentages are **calibration evidence, not hardcoded production thresholds**.
MOVE-001C must calculate the P97.5 threshold from the eligible rolling distribution at
the applicable point-in-time cutoff.

### 15.6 Sensitivity / noise trade-off

Evaluating all four horizons together over the audited 36-hour window showed:

| Series | Any-horizon P90 endpoints | Any-horizon P95 endpoints | P97.5 endpoints | P99 endpoints |
|---|---:|---:|---:|---:|
| BTC | 105 / 430 | 54 / 430 | 23 / 430 | 9 / 430 |
| Gold | 109 / 419 | 54 / 419 | 24 / 419 | 8 / 419 |

Using a simple 20-minute separation only as a calibration diagnostic, P97.5 produced
about eight distinct clusters per market over 36 hours, while P99 produced only three.

P90/P95 were rejected for v1 because the union across four horizons was too broad for
a material-move trigger. P99 was rejected because it materially reduces sensitivity.
P97.5 is the first bounded compromise for the intraday objective.

Episode/de-duplication behavior is **not** frozen here; MOVE-001C owns runtime emission
semantics.

### 15.7 Reproduced 2 Oct BTC acceptance case

For the BTC Observation at 04:30:30 UTC / 11:30:30 WIB, using only historical samples
that ended before the applicable target start:

| Horizon | Target magnitude | Historical samples | P90 | P95 | Empirical percentile |
|---|---:|---:|---:|---:|---:|
| 15m | 1.4988% | 424 | 0.2383% | 0.2996% | 100.00 |
| 30m | 1.4691% | 422 | 0.3214% | 0.4203% | 100.00 |
| 60m | 1.7750% | 414 | 0.4964% | 0.6361% | 100.00 |
| 120m | 2.1669% | 415 | 0.8217% | 1.0037% | 100.00 |

The reproduced move would therefore qualify comfortably under the P97.5 policy without
special-casing the 2 Oct observation.

### 15.8 MOVE-001B boundary

MOVE-001B adds only the versioned calibration policy and its production evidence.

It does not add:

- a scheduled detector;
- persistence of MOVE assessments;
- dashboard/UI output;
- alert/notification behavior;
- episode de-duplication;
- provider expansion;
- Binance or another derivatives provider;
- driver investigation;
- causal attribution;
- State / Regime / Risk / Intelligence;
- prediction or trading semantics.

After owner merge, the next checkpoint is **MOVE-001C — Read-Only Continuous Move
Detector Runtime**.


## 16. MOVE-001C read-only continuous detector runtime

MOVE-001C implements the first repository-backed runtime consumer of the frozen
MOVE-001B calibration.

### 16.1 Runtime input and ownership

The detector accepts:

- one explicit canonical target end Observation;
- its calibrated BTC or Gold series identity;
- one point-in-time `asOf` knowledge cutoff;
- the existing `HistoricalObservationRepository`.

It performs no provider fetch and no persistence.

The target end Observation must:

- match the calibrated domain / series / source;
- be finite numeric data;
- be knowable by `asOf`;
- satisfy canonical historical-fitness rules;
- be the latest knowable revision for its `observedAt`.

### 16.2 Target pairing

For each frozen 15m / 30m / 60m / 120m horizon, the detector selects the same-series,
same-source target start whose actual elapsed time is nearest the requested horizon
inside the frozen ±60 second tolerance.

No match inside tolerance produces `INSUFFICIENT_DATA` for that horizon.

No interpolation, forward-fill, backward-fill, or observation-count fallback is
permitted.

### 16.3 Rolling historical distribution

For each qualified target pair:

- the historical distribution ends strictly before the selected target start;
- the rolling lookback is 36 hours;
- historical pairs use the same horizon and ±60 second nearest-time policy;
- later-known revisions are excluded by `retrievedAt <= asOf`;
- FRESH / STALE historical fitness is preserved;
- a repository query reaching the 500-row bound fails closed with `UNKNOWN`;
- fewer than 120 eligible pairs produces `INSUFFICIENT_DATA`.

MOVE-001C does not weaken HIST-001B exact-horizon behavior. Continuous MOVE owns its
bounded tolerant-pairing methodology independently.

### 16.4 P97.5 runtime threshold

The P97.5 threshold is recalculated from the eligible rolling distribution at the
requested point-in-time cutoff. Calibration-table percentages are not hardcoded.

To preserve the MOVE-001B SQL calibration semantics, runtime P97.5 uses the same
linear interpolation as PostgreSQL `percentile_cont`:

`index = (percentile / 100) * (n - 1)`

with interpolation between the surrounding ordered sample values when the index is
fractional.

A horizon is `MATERIAL_MOVE` when:

`abs(percent_change) >= rolling_P97_5_threshold`

Otherwise it is `BELOW_MATERIALITY_THRESHOLD`.

The output also retains mechanical direction, signed change, magnitude, alignment
error, threshold, empirical mid-rank percentile, sample size, and exact target plus
historical Observation lineage.

### 16.5 Assessment semantics

Per-horizon outcomes are explicit:

- `MATERIAL_MOVE`;
- `BELOW_MATERIALITY_THRESHOLD`;
- `INSUFFICIENT_DATA`;
- `INCOMPATIBLE`;
- `UNKNOWN`.

The aggregate detector result becomes `MATERIAL_MOVE` when any qualified horizon is
material. A non-material aggregate fails closed to `INCOMPATIBLE`, `UNKNOWN`, or
`INSUFFICIENT_DATA` when an unresolved horizon prevents a truthful all-horizon
non-material conclusion.

Every output retains:

`causalAttribution = NOT_EVALUATED`.

### 16.6 Runtime boundary

MOVE-001C is a read-only evaluator only. It does not add:

- a cron/scheduler owner;
- persistence of MOVE assessments;
- automatic alerts;
- episode/de-duplication semantics;
- dashboard/UI wiring;
- provider expansion;
- Binance derivatives evidence;
- driver investigation;
- causal attribution;
- State / Regime / Risk / Intelligence;
- prediction or trading semantics.

After owner merge, MOVE-002 may consume a material MOVE assessment as an independent
evidence-investigation target.
