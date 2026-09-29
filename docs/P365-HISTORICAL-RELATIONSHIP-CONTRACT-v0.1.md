# P365 Historical Relationship Evidence Contract v0.1

**Checkpoint:** REL-001  
**Status:** ACTIVE — owner merge pending  
**Scope:** read-only, point-in-time historical relationship measurement

REL-001 measures reproducible historical association between two canonical Observation series. It does not infer causality, regime, expected direction, or trading meaning.

## Contract

Every measurement requires explicit series identities, optional provider qualification, transformation (LEVEL or CHANGE), observation start/end, point-in-time `asOf`, minimum sample size, methodology ID and methodology version.

Pairing is strict in v1: observations pair only when `observedAt` is identical. Repository reads are bounded by `retrievedAt <= asOf`, so later-known revisions cannot leak into an earlier reconstruction. When multiple revisions exist at one effective timestamp, the latest revision knowable by `asOf` is selected deterministically.

REL-001 reports Pearson correlation only when both series have non-zero variance and the transformed paired sample meets the caller-owned minimum sample size. Otherwise status is `INSUFFICIENT_DATA`. Sample size and exact Observation IDs remain in the evidence object.

`correlation` is association evidence only. Every output retains `causalAttribution = NOT_EVALUATED`.

## Non-goals

REL-001 does not:
- choose canonical correlation windows or thresholds;
- convert correlation into a TRN-001 SAME_DIRECTION/OPPOSITE_DIRECTION rule;
- compute causality, beta, lead/lag, regime, State, Risk, Intelligence, signals or execution;
- add providers, persistence owners, schedulers, database schema or UI;
- interpolate or forward-fill observations across mismatched timestamps.

Future checkpoints may add separately approved alignment/frequency methodology, historical event comparables, beta or lead/lag evidence without changing this v1 meaning.
