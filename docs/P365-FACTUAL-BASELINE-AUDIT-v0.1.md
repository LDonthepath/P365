# P365 Factual Baseline — Implementation Audit v0.1

## Purpose

Audit the deterministic Factual Baseline implementation against the canonical Observation data currently produced by P365.

## Scope audited

- `lib/domain/baseline.ts`
- `lib/domain/normalize.ts`
- `lib/data/fred.ts`
- `lib/data/crypto-market.ts`
- `lib/data/macro-registry.ts`
- `lib/data/dashboard-data.ts`

## Findings

### 1. FRED observations have the required measurement metadata

FRED normalization creates canonical Macro Observations with:

- `seriesId`
- `frequency`
- `unit`
- `observationDate`
- `observedAt` as P365 capture timestamp
- `source`
- `previousValue`
- `vintageDate`
- quality
- Evidence linkage

This matches the factual-baseline requirement for series identity, measurement period, unit, frequency, provenance, and quality.

### 2. `observedAt` is not the correct primary time axis for macro factual comparison

For FRED, `observationDate` represents the measurement period while `observedAt` represents when P365 captured the provider response. A factual baseline must compare measurement periods first. Capture time is used only as a tie-breaker when the measurement period is identical.

The implementation now follows this rule.

### 3. Compatibility must be conservative

The previous implementation treated missing metadata as compatible when only one side had a value. That could allow a baseline to pass without proving the same series, unit, or frequency.

The implementation now requires equality for:

- domain
- subject
- `seriesId`
- `unit`
- `frequency`

When a measurement date is present on either observation, both observations must contain valid `observationDate` metadata.

### 4. Crypto observations previously lacked canonical series/unit/frequency metadata

BTC/USD and ETH/USD observations had subject and quote information, but no explicit `seriesId`, `unit`, or `frequency` metadata. That made strict factual-baseline compatibility impossible.

The crypto market provider now emits:

- `seriesId = <SYMBOL>/USD:SPOT`
- `unit = USD`
- `frequency = REALTIME`

No directional interpretation is attached.

### 5. Baseline status semantics are now explicit

The implementation distinguishes:

- `VALID` — selected baseline is FRESH.
- `STALE` — selected baseline exists but is stale.
- `MISSING` — no usable earlier compatible observation exists, or no candidates were supplied despite compatibility being possible.
- `INCOMPATIBLE` — candidate observations exist but none is semantically compatible.
- `UNKNOWN` — required timestamp or quality information is invalid/insufficient.

`PARTIAL` and `UNKNOWN` quality are not silently promoted to `VALID`.

### 6. Current FRED provider does not yet expose historical canonical candidates

`fetchFredMacroObservations()` currently returns the latest valid observation for each registered series and carries the provider's previous value as metadata. Therefore the current dashboard response does **not** yet contain a second canonical Observation that the factual-baseline selector can use as the historical reference.

This is an integration/data-retention gap, not a reason to use `previousValue` as a hidden substitute. The factual baseline contract requires a canonical prior Observation reference.

The provider's `previousValue` remains provenance/context metadata and is not promoted into a synthetic baseline Observation.

## Result

**Factual Baseline implementation: contract-aligned at the selector level, not yet fully wired to historical canonical Observation storage.**

The selector is now conservative about semantic compatibility, measurement-period ordering, and data quality. The next implementation dependency is historical canonical Observation availability / Market Memory persistence before factual baseline can be used as a system-wide reasoning input.

## Explicit exclusions

This audit does not add:

- expectation surprise
- pricing surprise
- historical abnormality
- regime inference
- scoring or weighting
- bullish/bearish classification
- risk-on/risk-off inference
- AI conclusions
- proxy baselines

## Decision

Keep Factual Baseline as the first deterministic baseline capability. Do not advance to higher-order baseline classes or regime/intelligence automation until canonical historical observations can be selected without relying on hidden provider fields or convenient substitutes.
