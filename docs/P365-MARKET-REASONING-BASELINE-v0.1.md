# P365 Market Reasoning — Baseline & Market Memory v0.1

## Purpose

P365 exists to explain the market, not merely to display it. To explain change, P365 needs a stable reference for comparison. This document defines the conceptual baseline and market-memory model before implementation.

## Core principle

> **P365 cannot reliably identify what changed without knowing what it is changing from.**

A current value is not intelligence by itself. Meaning comes from comparison against an appropriate baseline and the regime/context in which that comparison is made.

## Baseline is not simply “yesterday”

P365 should not use one universal baseline. Different questions require different reference points.

| Reasoning question | Primary baseline |
| --- | --- |
| Did the underlying metric change? | Previous valid observation |
| Was the release a surprise? | Consensus / expected value |
| Was the market already prepared? | Market-implied pricing before event |
| Did the policy outlook change? | Previous policy communication / previous SEP or equivalent |
| Did the regime change? | Previous confirmed state/regime |
| Is the current move unusual? | Historical distribution / normal range |
| Did the market response confirm the event? | Pre-event cross-asset state |
| Is positioning vulnerable? | Pre-event positioning baseline |

These baselines are complementary, not interchangeable.

## Baseline hierarchy

P365 should reason through four baseline classes:

```text
1. FACTUAL BASELINE
   What was true before?

2. EXPECTATION BASELINE
   What did participants expect?

3. PRICING BASELINE
   What was already embedded in market prices?

4. REGIME BASELINE
   Under what environment was the market operating?
```

A fifth reference, **historical baseline**, is used to determine whether a change is ordinary or unusual.

## Example: CPI

A CPI release should not be interpreted from the actual number alone.

```text
Previous CPI       = 2.9%
Consensus          = 3.0%
Actual             = 3.2%
Pre-event pricing  = already reflected ~3.15%

FACTUAL CHANGE
3.2% vs 2.9% → inflation increased

DATA SURPRISE
3.2% vs 3.0% → upside surprise

PRICING SURPRISE
3.2% vs ~3.15% → smaller incremental surprise

MARKET REPRICING
2Y / real yield / DXY / equities / crypto

REGIME TEST
Does this response fit or challenge the existing regime?
```

The same actual number can therefore produce different intelligence depending on expectation and pricing baselines.

## Market Memory

Market Memory is not a raw historical database. It is the set of **relevant prior states and references required to evaluate change**.

At minimum, a future Market Memory layer should preserve:

- previous canonical observations;
- previous event states;
- previous market/regime states;
- prior expectation references when available;
- pre-event market pricing snapshots when available;
- relevant cross-asset state before major events;
- positioning snapshots where available;
- timestamps and source/evidence lineage for every stored reference.

Market Memory must preserve provenance. A remembered value without timestamp, source, or quality is not a trustworthy baseline.

## Event snapshot model

For high-impact events, P365 should conceptually maintain a before/after structure:

```text
PRE-EVENT SNAPSHOT
        ↓
EVENT / RELEASE
        ↓
ACTUAL RESULT
        ↓
SURPRISE
        ↓
POST-EVENT MARKET RESPONSE
        ↓
TRANSMISSION TEST
```

This allows P365 to distinguish:

- event outcome;
- expectation surprise;
- market surprise;
- genuine repricing;
- delayed reaction;
- contradictory cross-asset response.

## Baseline selection rules

1. **Use the narrowest valid baseline that answers the question.**
2. **Never substitute a convenient baseline for the correct one.**
3. **Preserve baseline timestamp and source.**
4. **Do not compare observations with incompatible frequency, unit, or measurement period without explicit normalization.**
5. **A missing baseline is uncertainty, not permission to invent one.**
6. **A stale baseline must be marked stale rather than silently treated as current.**
7. **Different baselines may disagree; disagreement is evidence for conflict analysis.**
8. **Regime interpretation must use the regime baseline that existed before the event, not a state inferred after the reaction.**

## Change taxonomy

P365 should eventually distinguish at least these concepts:

```text
CHANGE
  ├── Absolute change
  ├── Expected surprise
  ├── Pricing surprise
  ├── Regime deviation
  └── Historical abnormality
```

These are different claims and must not collapse into one generic “delta”.

## From baseline to intelligence

The conceptual reasoning chain is:

```text
CURRENT FACT
    ↓
COMPARE WITH APPROPRIATE BASELINE
    ↓
IDENTIFY CHANGE TYPE
    ↓
ASSESS EXPECTATION / PRICING SURPRISE
    ↓
OBSERVE REPRICING
    ↓
TEST CROSS-ASSET TRANSMISSION
    ↓
COMPARE WITH PRE-EXISTING REGIME
    ↓
CONFIRM / CONTRADICT / REMAIN UNCERTAIN
    ↓
INTELLIGENCE
```

## What this document does not define yet

This is a conceptual contract, not an implementation specification for a scoring engine.

It does **not** yet define:

- exact surprise thresholds;
- weighting formulas;
- regime scoring;
- market-pricing probability formulas;
- cross-asset correlation thresholds;
- positioning scores;
- automated regime transitions;
- AI-generated conclusions.

Those rules require separate domain research and evidence requirements before implementation.

## Architectural consequence

Baseline and Market Memory should become first-class reasoning infrastructure, but they should sit **after canonical data/evidence and before higher-order intelligence**.

```text
Provider
  ↓
Ingestion
  ↓
Normalization
  ↓
Canonical Observation / Event / Evidence
  ↓
Context
  ↓
Baseline / Market Memory
  ↓
State / Repricing / Regime Analysis
  ↓
Intelligence
  ↓
Market Briefing
```

The Baseline/Memory layer must not become a second source of truth. Canonical observations/events remain authoritative; memory stores the references needed to compare them over time.
