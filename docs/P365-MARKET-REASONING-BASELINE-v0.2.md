# P365 Market Reasoning — Baseline Contract v0.2

## Purpose

P365 exists to explain the market, not merely to display it. Baseline is the comparison infrastructure that allows P365 to distinguish a current fact from a meaningful change.

This contract refines Baseline & Market Memory v0.1 into explicit baseline types, required inputs, current computability, and implementation readiness.

## Core rule

> **A baseline is a reference selected for a specific reasoning question, not a generic previous value.**

Canonical observations, events, and evidence remain the authoritative source of truth. Baseline references them; it does not replace or rewrite them.

## 1. Baseline classes

| Baseline | Question answered | Required reference | Current readiness |
| --- | --- | --- | --- |
| **Factual** | What was true before? | Previous valid canonical observation | **IMPLEMENTED / PARTIAL INTEGRATION** |
| **Expectation** | What was expected? | Consensus / explicit expectation observation | **PARTIAL** |
| **Pricing** | What was already priced? | Market-implied pricing captured before event | **NOT READY** |
| **Regime** | Under what environment did this occur? | Previous confirmed state/regime | **NOT READY** |
| **Historical** | Is this unusual? | Historical distribution / comparable range | **PARTIAL** |
| **Cross-asset** | Did the market response confirm the event? | Pre-event cross-asset snapshot | **PARTIAL** |
| **Positioning** | Was positioning vulnerable? | Pre-event positioning snapshot | **NOT READY** |

Readiness refers to P365's current ability to construct the baseline reliably, not to whether the concept is valid.

## 2. Factual Baseline

The factual baseline is the latest valid canonical observation that precedes the observation being evaluated, subject to semantic and temporal compatibility.

```text
Previous CPI = 2.9%
Current CPI  = 3.2%
Factual change = +0.3 percentage points
```

Required inputs:
- canonical observation ID;
- observation date/period;
- capture timestamp;
- unit;
- frequency;
- series identity;
- source/evidence lineage;
- previous valid compatible observation.

Selection rules:
1. Same canonical series or explicitly equivalent series.
2. Compatible unit and frequency.
3. Compatible measurement period.
4. Previous observation must be valid.
5. Stale data remains marked stale.
6. Missing previous observation is explicit and must not produce a fabricated delta.

For macro observations, `observationDate` is the primary measurement-time axis. `observedAt` is the P365 capture timestamp and is used only when measurement periods are identical.

The implementation returns:
- `VALID` for a FRESH selected baseline;
- `STALE` for a selected STALE baseline;
- `UNKNOWN` when required timestamp/quality information is invalid or insufficient;
- `INCOMPATIBLE` when supplied candidates exist but none is semantically compatible;
- `MISSING` when no usable earlier compatible observation is available.

`PARTIAL` or `UNKNOWN` observation quality is never silently promoted to `VALID`.

**Implementation status: selector implemented. System-wide use remains dependent on historical canonical Observation availability.**

## 3. Expectation Baseline

Expectation baseline represents what market participants or the relevant reference population expected before the event/release. It is not interchangeable with the previous observation.

```text
Previous = 2.9%
Consensus = 3.0%
Actual = 3.2%

Factual change = +0.3pp
Expected surprise = +0.2pp
```

Required inputs:
- expectation value;
- expectation timestamp or collection window;
- expectation source;
- series/event identity;
- unit/frequency;
- provenance and quality.

The source must identify whether the value is official consensus, survey median/mean, analyst estimate, market-implied expectation, or another explicitly defined expectation. P365 must not silently treat an arbitrary forecast as consensus.

**Current readiness: PARTIAL.** The conceptual contract is ready, but the current implementation does not yet provide a dedicated canonical expectation data model/provider for major macro releases. Expectation surprise should therefore not yet be computed automatically across the system.

## 4. Pricing Baseline

Pricing baseline represents the market-implied expectation embedded in tradable prices immediately before an event. This is different from survey consensus.

```text
Consensus          = 3.0%
Pre-event pricing  = ~3.15%
Actual             = 3.2%

Consensus surprise = +0.2pp
Pricing surprise   = +0.05pp
```

It answers: **How much of the outcome was already embedded in market prices?**

Required inputs may include OIS/SOFR/fed-funds futures pricing, Treasury yields, inflation swaps or equivalent market pricing, timestamped pre-event snapshots, event timestamp/window, and a deterministic methodology for extracting implied expectations.

**Current readiness: NOT READY.** P365 currently lacks the required market-pricing ingestion and deterministic extraction methodology. No proxy should be substituted merely to make pricing surprise computable.

## 5. Regime Baseline

Regime baseline is the last **confirmed** market/regime state that existed before the event or change being evaluated.

It answers: **What environment was the market operating under before this new information arrived?**

The same data can have different implications under different regimes. For example, strong NFP under cooling inflation/easing policy/expanding liquidity differs from strong NFP under sticky inflation/restrictive policy/rising real yields.

Required inputs:
- previous confirmed State/Regime object;
- state timestamp;
- evidence lineage;
- event/change timestamp;
- compatibility check ensuring the state predates the event.

**Current readiness: NOT READY.** P365 has State and Intelligence contracts, but not yet a domain-specific regime reasoning engine producing confirmed regime states. The system must not infer a regime baseline from post-event information.

## 6. Historical Baseline

Historical baseline determines whether a current observation or change is ordinary, unusual, or extreme relative to a defined historical reference population. It is not simply an average of the past.

Required inputs:
- canonical series;
- defined historical window;
- compatible frequency/unit;
- comparable observations;
- statistical methodology;
- treatment of missing/stale/outlier observations.

Possible future references include mean/median, percentile, z-score, historical range, rolling distribution, or regime-conditional distribution. The methodology must be explicitly defined before implementation.

**Current readiness: PARTIAL.** Canonical historical observations exist for some macro series, but P365 does not yet have a locked statistical contract for historical abnormality. No z-score/percentile threshold should be added implicitly.

## 7. Cross-Asset Baseline

Cross-asset baseline is the pre-event state of relevant markets used to evaluate whether the subsequent response is coherent with the event.

```text
PRE-EVENT
2Y ↑/stable
DXY stable
Real yield stable
Nasdaq stable
BTC stable

EVENT
CPI HOT

POST-EVENT
2Y ↑
DXY ↑
Real yield ↑
Nasdaq ↓
BTC ↓
```

The baseline is not a bullish/bearish label. It is the observable state before the event.

Required inputs:
- event timestamp/window;
- relevant canonical market observations;
- synchronized capture timestamp;
- instrument identity;
- compatible frequency;
- snapshot provenance.

**Current readiness: PARTIAL.** P365 has the Market Snapshot contract and limited BTC/ETH market observations, but not the complete cross-asset observation universe needed for the intended transmission chain.

## 8. Positioning Baseline

Positioning baseline records the market's pre-event positioning state where reliable positioning data exists.

Examples include funding, open interest, futures positioning, options positioning, COT or equivalent institutional positioning, and other explicitly defined positioning measures.

Positioning is evidence, not an automatic directional conclusion.

**Current readiness: NOT READY.** The current P365 implementation does not yet provide a canonical positioning data layer.

## 9. Baseline selection contract

For every reasoning operation, P365 should record:

```text
QUESTION
  ↓
REQUIRED BASELINE TYPE
  ↓
SELECTED REFERENCE
  ↓
REFERENCE TIMESTAMP
  ↓
SOURCE / EVIDENCE
  ↓
QUALITY
  ↓
COMPATIBILITY CHECK
  ↓
BASELINE STATUS
```

Recommended status vocabulary:

```text
VALID
STALE
MISSING
INCOMPATIBLE
UNKNOWN
```

A baseline that fails compatibility must not silently fall back to another baseline class.

## 10. Change taxonomy

P365 should keep these claims separate:

```text
ABSOLUTE CHANGE
Actual vs factual baseline

EXPECTED SURPRISE
Actual vs expectation baseline

PRICING SURPRISE
Actual vs market-implied pricing baseline

REGIME DEVIATION
Current information/response vs previous confirmed regime

HISTORICAL ABNORMALITY
Current value/change vs historical baseline
```

These outputs must not collapse into one generic `delta`.

## 11. CPI reference model

```text
                 CPI EVENT
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
   PREVIOUS       CONSENSUS     PRICING
     2.9%           3.0%         ~3.15%
       │             │             │
       └─────────────┼─────────────┘
                     ↓
                  ACTUAL
                   3.2%
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
   +0.3pp          +0.2pp        +0.05pp
   factual         expected       pricing
   change          surprise       surprise
                     │
                     ↓
               MARKET RESPONSE
                     │
                     ↓
            CROSS-ASSET TEST
                     │
                     ↓
             REGIME BASELINE
                     │
                     ↓
                INTELLIGENCE
```

This illustrates why P365 cannot interpret an event from the actual value alone.

## 12. Implementation boundary

### Implementable now
1. Factual baseline selection.
2. Baseline provenance references.
3. Baseline timestamp/quality metadata.
4. Compatibility validation.
5. Explicit missing/stale/incompatible states.

### Requires additional data foundation
1. Expectation baseline.
2. Cross-asset baseline.
3. Historical baseline.
4. Historical canonical Observation availability for system-wide factual baseline selection.

### Requires new reasoning/market-pricing infrastructure
1. Pricing baseline.
2. Regime baseline.
3. Positioning baseline.

### Explicitly prohibited at this stage
- arbitrary surprise thresholds;
- hidden proxy baselines;
- automatic bullish/bearish labels;
- automatic risk-on/risk-off inference;
- automatic regime transitions;
- AI conclusions without evidence;
- replacing missing baselines with convenient substitutes.

## 13. Architectural consequence

```text
Provider
  ↓
Ingestion
  ↓
Canonical Observation / Event / Evidence
  ↓
Context
  ↓
Baseline Selection
  ↓
Market Snapshot / Market Memory
  ↓
Change / Surprise / Repricing / Regime Analysis
  ↓
Intelligence
  ↓
Market Briefing
```

Market Memory remains append-only. Market Snapshots remain immutable. Baseline selection references canonical history and does not rewrite it.

## Decision

**Factual Baseline selector is implemented and audited against the current Observation contracts. It is not yet a system-wide historical baseline engine because the current FRED provider exposes only the latest canonical observation per series and keeps the provider's previous value as metadata rather than as a second canonical Observation.**

The correct next dependency is historical canonical Observation availability / Market Memory persistence. Do not use `previousValue` as a hidden substitute and do not advance to higher-order reasoning until this dependency is resolved.
