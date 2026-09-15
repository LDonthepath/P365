# P365 Market Memory Governance v0.1

## Decision

**Market Memory is append-only historical reasoning evidence. It must never overwrite the historical record.**

A later State or Intelligence assessment may supersede an earlier assessment, but it does not mutate the earlier record. The correction is represented as a new record linked to the prior one.

This gives P365 an auditable reasoning trail:

```text
Observation / Event
        ↓
Baseline / Snapshot
        ↓
State / Interpretation
        ↓
New Evidence
        ↓
Reassessment
        ↓
CONFIRMED / CONTRADICTED / INVALIDATED / SUPERSEDED
```

## Why append-only

If P365 overwrites a previous interpretation, the system loses the ability to answer:

- What did we believe at that time?
- What evidence supported it?
- What baseline was used?
- When did the interpretation change?
- Which new evidence caused the change?
- Was the original interpretation wrong, or was the market regime different?

Those questions are part of market intelligence quality. Therefore historical reasoning records are immutable.

## Current truth vs historical truth

P365 must distinguish two concepts:

### Historical truth

What the system recorded and believed **at that point in time**, based on the evidence available then.

Historical records must not be rewritten merely because later information makes them look wrong.

### Current assessment

The latest valid interpretation after incorporating newer evidence.

A current assessment may say that an earlier interpretation is no longer valid, but the earlier record remains intact.

## Invalidation model

Invalidation is represented by a new assessment, not by editing the old assessment.

Example:

```text
T0
Hypothesis A
"Liquidity tightening may be pressuring risk assets."
Status: LEANING
Evidence: TGA ↑, RRP ↓, BTC ↓

        ↓ new evidence

T1
Assessment B
"The previous liquidity-tightening hypothesis is no longer supported."
Status: INVALIDATED
Invalidates: hypothesis-A
Evidence: TGA stabilized, 2Y reversed, BTC recovered
```

The system therefore retains both:

```text
hypothesis-A → INVALIDATED BY → assessment-B
```

## Supersession vs invalidation

These must not be treated as identical.

**SUPERSEDED** means a newer assessment replaces the previous working assessment because the state evolved or the previous assessment was too narrow.

**INVALIDATED** means new evidence directly breaks a prior claim or its supporting premise.

Example:

```text
Old:
"Market is in early easing repricing."

New:
"Market remains easing-biased but growth deterioration is now dominating."

→ SUPERSEDED
```

versus:

```text
Old:
"CPI surprise is causing persistent hawkish repricing."

New evidence:
2Y fully reverses, real yields fall, policy pricing returns to prior level.

→ INVALIDATED
```

## What can change

A memory record itself is immutable.

A related **current-status view** may change as newer records arrive:

```text
ACTIVE
CONFIRMED
SUPERSEDED
INVALIDATED
CONTRADICTED
EXPIRED
```

These statuses describe the relationship between records. They do not rewrite the original record.

## Required lineage

Every reasoning-memory record should eventually carry, directly or indirectly:

- unique record ID;
- created timestamp;
- effective/observation timestamp where applicable;
- referenced Observation/Event IDs;
- Evidence IDs;
- baseline references used;
- prior record IDs when superseding or invalidating;
- status/relationship metadata;
- confidence;
- source quality information where relevant.

A memory item without lineage is not authoritative reasoning evidence.

## No second source of truth

Market Memory must never duplicate canonical facts as independently editable values.

Preferred model:

```text
Memory Record
   │
   ├── observationIds ──→ Canonical Observation
   ├── eventIds ────────→ Canonical Event
   ├── evidenceIds ─────→ Canonical Evidence
   └── baselineIds ─────→ Prior references
```

If a canonical observation is corrected by the source, P365 must preserve the appropriate source/version semantics at the canonical-data layer. Memory does not silently repair or rewrite itself.

## Snapshot rule

A Market Snapshot is also historical evidence. Once captured, its reference set and timestamp are immutable.

A new snapshot is created for a later state:

```text
Snapshot T0
     ↓
Event
     ↓
Snapshot T1
```

P365 compares snapshots; it does not mutate T0 to resemble T1.

## Reasoning audit trail

The eventual system should be able to reconstruct:

```text
WHAT WAS KNOWN?
      ↓
WHAT WAS EXPECTED?
      ↓
WHAT WAS PRICED?
      ↓
WHAT HAPPENED?
      ↓
WHAT REPRICED?
      ↓
WHAT DID WE CONCLUDE?
      ↓
WHAT CONFIRMED / CONTRADICTED IT?
      ↓
WHAT IS THE CURRENT ASSESSMENT?
```

This is the core purpose of Market Memory: **preserve the chain of reasoning through time.**

## Governance invariants

1. Historical memory records are append-only.
2. A new assessment must not silently overwrite an old assessment.
3. Invalidation must point to the record it invalidates.
4. Supersession must point to the record it supersedes.
5. Canonical Observation/Event/Evidence remain the factual source of truth.
6. Memory may reference canonical facts but must not become an independently editable duplicate.
7. Every stored reasoning reference must retain timestamp and lineage.
8. Missing historical references must remain explicitly missing.
9. A current view may select the latest valid assessment, but selection must remain reconstructable from the append-only history.
10. Memory governance must not introduce scoring or automated regime logic by itself.

## Implementation boundary

This document defines governance only.

It does not yet authorize implementation of:

- a database schema;
- persistence infrastructure;
- regime scoring;
- automated invalidation thresholds;
- AI-generated hypotheses;
- historical backtesting;
- portfolio or trading logic.

Those require separate contracts and verification checkpoints.
