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

The implementation follows this rule.

### 3. Compatibility is conservative

The implementation requires equality for:

- domain
- subject
- `seriesId`
- `unit`
- `frequency`

When a measurement date is present on either observation, both observations must contain valid `observationDate` metadata.

### 4. Historical FRED observations are now canonicalized

The FRED provider already requested eight observations per series but previously emitted only the latest one, leaving `previousValue` as provider metadata.

The provider now emits all valid observations returned by that request as separate canonical input records. Normalization therefore creates multiple canonical Observation objects with their own:

- observation ID
- measurement date
- value
- capture timestamp
- series identity
- unit/frequency
- Evidence linkage
- quality

`previousValue` remains metadata/provenance and is not used as a hidden baseline substitute.

### 5. Crypto observations have canonical series metadata

BTC/USD and ETH/USD observations emit:

- `seriesId = <SYMBOL>/USD:SPOT`
- `unit = USD`
- `frequency = REALTIME`

No directional interpretation is attached.

### 6. Baseline status semantics are explicit

The implementation distinguishes:

- `VALID` — selected baseline is FRESH.
- `STALE` — selected baseline exists but is stale.
- `MISSING` — no usable earlier compatible observation exists.
- `INCOMPATIBLE` — candidate observations exist but none is semantically compatible.
- `UNKNOWN` — required timestamp or quality information is invalid/insufficient.

`PARTIAL` and `UNKNOWN` quality are not silently promoted to `VALID`.

## Current architecture state

```text
FRED provider
    ↓
8 historical observations / series
    ↓
Canonical Observation
    ↓
Observation history available in current dashboard data
    ↓
Factual Baseline selector
    ↓
Factual change
```

This removes the previous immediate blocker: the selector no longer depends on a hidden provider `previousValue` to access the prior factual observation.

## Remaining dependency: durable Market Memory

The current dashboard pipeline can now construct a factual baseline from multiple canonical observations present in the same data capture.

What is **not** implemented yet is durable append-only Market Memory across independent dashboard requests/deployments. The Market Memory contract requires historical reasoning records to remain reconstructable without relying on the live provider response.

That persistence layer must be introduced deliberately rather than by writing arbitrary files to the application filesystem, because deployment/runtime storage may not be durable.

## Result

**Factual Baseline selector: READY at the canonical-data level.**

**Factual Baseline system-wide persistence: NOT READY.**

The correct next architectural dependency is durable append-only Market Memory storage. Do not use provider `previousValue` as a substitute and do not advance to higher-order baseline classes until historical reasoning storage has an explicit persistence contract.

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
