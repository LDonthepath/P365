# P365 Market Snapshot Contract v0.1

## Purpose

A Market Snapshot is an immutable, time-indexed representation of the market state relevant to a defined reasoning scope at a specific capture time.

It exists to support comparison:

```text
PRE-EVENT SNAPSHOT
        ↓
EVENT / RELEASE
        ↓
POST-EVENT SNAPSHOT
        ↓
CHANGE / REPRICING / TRANSMISSION TEST
```

A Snapshot is a reasoning reference, not a replacement for canonical observations or events.

## Core principle

> **A snapshot records what was observable at time T; it must not rewrite history with knowledge acquired later.**

This prevents look-ahead bias and preserves the audit trail of market reasoning.

## What a Snapshot contains

A future implementation should represent at least:

- `id` — immutable snapshot identifier;
- `capturedAt` — P365 capture timestamp;
- `scope` — market scope covered by the snapshot;
- `observationRefs` — canonical Observation IDs represented in the snapshot;
- `eventRefs` — relevant Event IDs known at capture time;
- `stateRefs` — State IDs that existed at capture time, when available;
- `baselineRefs` — Baseline references used for comparison, when available;
- `quality` — snapshot completeness/data quality;
- `sourceHealthRefs` — provider-health references relevant to interpretation;
- optional `metadata` — deterministic capture information, never hidden interpretation.

The Snapshot should reference canonical objects rather than duplicate their authoritative content.

## Snapshot is not a valuation

A Snapshot must not contain conclusions such as:

- bullish / bearish;
- risk-on / risk-off;
- hawkish / dovish;
- liquidity positive / negative;
- capital inflow / outflow;
- trade setup;
- price prediction.

Those belong to higher-order State, Repricing, Regime, Intelligence, or Briefing layers after their rules are explicitly defined.

## Temporal rules

### 1. Capture-time truth

A Snapshot represents information available at `capturedAt`. Later information must never be inserted retroactively into an older Snapshot.

### 2. Observation date is not capture time

A canonical observation may describe an earlier measurement period. The Snapshot records the fact that the observation was known/available to P365 at capture time while preserving the original observation date in the canonical object.

### 3. Event ordering

For event analysis, P365 should be able to identify:

```text
T-1  PRE-EVENT SNAPSHOT
T0   EVENT / RELEASE
T+1  POST-EVENT SNAPSHOT
```

The exact windows must be defined separately by domain; v0.1 does not impose universal time windows.

### 4. No retroactive state rewriting

If a later assessment invalidates an earlier interpretation, the historical Snapshot remains unchanged. A later State/Intelligence record may explicitly reference and invalidate the earlier assessment.

## Snapshot dimensions

The conceptual snapshot should support these dimensions without requiring every dimension to be populated in every capture:

```text
MACRO
├── Monetary Policy
├── Liquidity
├── Inflation
├── Labor
├── Rates
├── USD
└── Growth

CROSS-ASSET
├── Rates
├── Real Yields
├── USD
├── Gold
├── Equities
└── Credit

CRYPTO
├── BTC
├── ETH
├── Market structure
├── Funding / OI when available
└── other canonical crypto observations
```

Missing dimensions remain missing. They must not be filled with inferred values.

## Snapshot quality

Snapshot quality should preserve whether the captured state is:

- complete;
- partial;
- stale;
- unknown.

Provider failure must remain distinguishable from a legitimately empty observation set.

A partial Snapshot can still be valid, but downstream reasoning must account for the missing evidence.

## Snapshot comparison

Two Snapshots can be compared only after checking compatibility:

1. same reasoning scope;
2. compatible observation definitions;
3. compatible units/frequencies where numerical comparison is used;
4. known capture timestamps;
5. sufficient data quality;
6. no hidden look-ahead information.

Comparison output is not itself Intelligence. It produces candidate changes for a later reasoning layer.

## Before / Event / After contract

For a high-impact event, the conceptual object relationship is:

```text
Snapshot A
  │
  ├── known expectations
  ├── pre-event pricing
  ├── pre-event cross-asset state
  └── pre-event regime/state references
          │
          ▼
       EVENT
          │
          ├── actual result
          └── event evidence
          │
          ▼
Snapshot B
  │
  ├── post-event pricing
  ├── cross-asset response
  └── updated canonical observations
```

This enables later reasoning to ask:

- Was there a surprise?
- Was the surprise already priced?
- Did repricing occur?
- Was transmission coherent?
- Did the response confirm or contradict the prior regime?

## Relationship to Market Memory

Market Memory stores references to historical Snapshots and other validated baselines. It does not mutate the Snapshot.

```text
Canonical Observation / Event
          ↓
      Snapshot
          ↓
    Market Memory
          ↓
   Future Comparison
```

Market Memory is therefore a temporal index of reasoning references, while the Snapshot is the immutable representation of one captured market state.

## Relationship to State and Intelligence

```text
Snapshot
   ↓
Comparison
   ↓
Candidate Change
   ↓
State / Repricing / Regime analysis
   ↓
Intelligence
   ↓
Market Briefing
```

A Snapshot does not decide what the market means.

## Invariants

1. Snapshot is immutable once created.
2. Snapshot is timestamped.
3. Snapshot references canonical evidence rather than becoming a second source of truth.
4. Later information cannot alter historical Snapshot content.
5. Missing data remains explicit.
6. Provider failures remain distinguishable from empty data.
7. Snapshot contains no hidden directional interpretation.
8. Snapshot comparison must respect temporal and semantic compatibility.
9. Historical Snapshots must remain available for audit and before/after analysis.
10. Snapshot design must remain market-agnostic even though the current implementation scope is Macro + Crypto.

## What v0.1 does not define

This contract does not define:

- exact snapshot frequency;
- storage technology;
- retention period;
- numerical scoring;
- surprise thresholds;
- repricing thresholds;
- cross-asset correlation thresholds;
- regime-transition rules;
- automatic snapshot generation triggers.

Those require separate domain research and implementation checkpoints.
