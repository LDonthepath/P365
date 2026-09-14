# P365 Intelligence Contract v0.1

## Purpose

The Intelligence layer is the first layer allowed to interpret canonical market information. This document defines the semantic contract for that interpretation without defining a market regime, liquidity model, capital-flow formula, sentiment model, or trading signal.

## Boundary

```text
Observation / Event / Evidence
            ↓
         Context
            ↓
       State / Risk
            ↓
      Intelligence
            ↓
        Briefing
```

Intelligence is an interpretation of evidence. It is not a replacement for the underlying Observation, Event, Context, State, or Risk objects.

## Required reasoning structure

Every Intelligence object follows the same reasoning sequence:

1. **WHAT** — the concise interpretation being asserted.
2. **WHY** — the evidence-based reason for the interpretation.
3. **CONFIRMS** — evidence references that support the interpretation.
4. **CONTRADICTS** — evidence references that weaken or oppose the interpretation.
5. **INVALIDATES** — conditions that would make the interpretation no longer valid.
6. **MONITOR** — conditions or evidence that should be watched next.
7. **CONFIDENCE** — `CONFIRMED`, `LEANING`, or `PENDING`.
8. **EVIDENCE** — canonical evidence IDs supporting traceability.

## Invariants

1. Intelligence must reference at least one evidence item.
2. WHAT cannot be empty.
3. WHY cannot be empty.
4. CONFIRMS and CONTRADICTS references must have valid IDs.
5. The same evidence reference cannot appear twice across CONFIRMS and CONTRADICTS.
6. INVALIDATES criteria cannot be empty strings.
7. MONITOR criteria cannot be empty strings.
8. The contract does not assign market meaning by itself.
9. The contract does not infer bullish/bearish, risk-on/risk-off, regime, liquidity, capital flow, or trading signals without separately defined domain rules.
10. Intelligence remains traceable to canonical evidence.

## Confidence semantics

Confidence describes the strength of the evidence behind an interpretation; it is not a probability forecast.

- `CONFIRMED`: the available evidence supports the interpretation without a known quality conflict under the rules that produced it.
- `LEANING`: evidence supports the interpretation, but the evidence set is mixed, incomplete, or contains meaningful contradiction.
- `PENDING`: evidence is insufficient, stale, unknown-quality, or otherwise not strong enough to support a reliable interpretation.

The Intelligence contract itself does not calculate market confidence from raw values. Domain-specific confidence rules must be defined before an intelligence engine is allowed to generate interpretations automatically.

## What this does NOT implement

This contract intentionally does not implement:

- Regime Engine
- LDS / liquidity scoring
- Capital Flow Engine
- Sentiment Engine
- Cluster Rotation
- Portfolio logic
- Trade entry/exit logic
- Price prediction

Those require explicit definitions, thresholds, evidence requirements, and validation before implementation.

## Implementation

`lib/domain/intelligence.ts` constructs the canonical Intelligence object.

`lib/domain/contracts.ts` validates the semantic contract before the object leaves the domain builder.

The current implementation is therefore a **contract and validation layer**, not an autonomous market-intelligence generator.
