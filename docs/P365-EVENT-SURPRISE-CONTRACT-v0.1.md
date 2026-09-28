# P365 Event Surprise Contract v0.1

**Checkpoint:** SUR-001  
**Status:** MERGED — PR #76, merge `9613893e697552cdcaa7015a551ed0867e1f1ef1`  
**Scope:** Point-in-time factual scheduled-event surprise  
**Prerequisites:** FND-019 Event identity, durable EconomicEventResult history, EXP-001 Expectation Baseline

## Purpose

SUR-001 measures the factual difference between the qualified pre-release expectation that P365 knew before an event and the actual outcome that P365 knew by an explicit post-release `asOf` time.

It answers only:

> What was expected before release, what actual outcome was known by this point in time, and what is the raw numerical difference?

SUR-001 does not decide whether that difference is economically material and does not infer market direction, causality, or trading meaning.

## Input chain

```text
Qualified provider-independent Event identity
        ↓
Durable EconomicEventResult history
        ├──→ EXP-001 strict pre-release expectation
        └──→ latest actual known by explicit asOf
        ↓
SUR-001 factual event surprise
```

SUR-001 must reuse EXP-001 for expectation ownership. It must not select a separate forecast/consensus path or blend providers implicitly.

## Point-in-time ownership

The expectation side inherits EXP-001:

- same provider-independent `eventIdentityKey`;
- explicit `sourceId`;
- explicit expectation type when requested;
- the same caller-owned `asOf` knowledge state;
- strict pre-release cutoff;
- canonical `retrievedAt` availability semantics.

The actual side requires:

- matching `eventIdentityKey`;
- matching `sourceId`;
- a finite `actual`;
- `retrievedAt >= releaseAt`;
- `retrievedAt <= asOf`;
- latest qualifying actual by `retrievedAt`, then deterministic ID tie-break.

An actual value retrieved after the requested `asOf` cannot leak backward. An actual value present before the qualified release instant is not eligible.

## Semantic compatibility

A VALID numerical surprise requires:

- EXP-001 baseline status `VALID`;
- finite expected and actual values;
- identical non-empty unit;
- identical non-empty period.

Missing or incompatible unit/period fails closed to `PARTIAL`. Missing expectation or actual is `MISSING`. Repository failure is `UNKNOWN`.

No provider-specific fallback is allowed.

## Output

SUR-001 preserves:

- expectation EventResult ID;
- actual EventResult ID;
- expected value;
- expected type (`FORECAST`, `CONSENSUS`, or `OFFICIAL_PROJECTION`);
- actual value;
- unit and period;
- expectation and actual retrieval timestamps;
- Evidence IDs;
- explicit release and `asOf` timestamps.

For VALID inputs:

```text
absoluteSurprise = actual - expected
```

If `expected != 0`:

```text
percentSurprise = (actual - expected) / abs(expected) * 100
```

A zero expected value leaves `percentSurprise = null` rather than inventing an infinite/undefined percentage.

Mechanical relation is one of:

- `ABOVE_EXPECTATION`;
- `BELOW_EXPECTATION`;
- `INLINE`.

This relation is factual arithmetic only. It is not bullish/bearish, hawkish/dovish, good/bad, or a materiality threshold.

## Revision behavior

SUR-001 is explicitly as-of aware.

If a provider publishes a later actual revision, an assessment with a later `asOf` may select that later-known EventResult snapshot. Earlier assessments remain reproducible because their knowledge cutoff excludes the later revision.

SUR-001 does not rewrite historical EventResult rows.

## Determinism

The complete assessment receives a deterministic SHA-256 identity:

```text
event-surprise-v1-<hash>
```

Equivalent point-in-time inputs produce the same identity regardless of candidate input ordering.

## Causality boundary

Every assessment sets:

```text
causalAttribution = NOT_EVALUATED
```

SUR-001 does not:

- decide whether a surprise is material;
- infer why an outcome differed from expectation;
- claim that the surprise caused market repricing;
- define RPR-001 thresholds;
- define TRN-001 relationship rules;
- infer bullish/bearish, hawkish/dovish, risk-on/risk-off, State, Regime, Risk, or Intelligence;
- produce trading signals, sizing, or execution.

## Acceptance criteria

SUR-001 v0.1 passes when:

1. expectation selection reuses EXP-001;
2. Event identity and provider ownership remain explicit;
3. actual selection is bounded to `releaseAt <= retrievedAt <= asOf`;
4. post-`asOf` and pre-release actual values cannot leak into the assessment;
5. unit/period incompatibility fails closed;
6. missing/partial/repository-failure states remain explicit;
7. raw absolute and optional percent surprise are deterministic;
8. expectation type remains semantically distinct;
9. no materiality threshold or market interpretation is invented;
10. no persistence owner, provider expansion, State/Risk/Regime/Intelligence, or trading logic is activated;
11. build/lint pass before owner merge.
