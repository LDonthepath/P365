> **HISTORICAL CHECKPOINT — SUPERSEDED FOR CURRENT-STATE CLAIMS (18 Sep 2026)**
> This document is retained as an audit/design record. For current implementation status and remediation priority, use `docs/P365-CURRENT-STATE-v0.1.md`, `docs/P365-ROADMAP-v0.1.md`, and `docs/P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md`. Do not treat older “current”, “missing”, or “next step” statements below as repository truth.

# P365 Temporal & Provenance Contract v0.1

**Status:** Phase 1A design checkpoint  
**Scope:** Roadmap Phase 1 — Data Foundation  
**Purpose:** Establish temporal and provenance semantics before adding more market-data providers.

---

## 1. Principle

P365 must never use one timestamp field to represent multiple different temporal meanings.

At minimum, the system distinguishes:

1. **Observation time** — when the underlying market/economic value refers to.
2. **Release time** — when the source made a factual observation or event result publicly available.
3. **Retrieval time** — when P365 fetched the source response.
4. **Schedule time** — when an event is planned to occur.

These timestamps answer different questions and must not be silently substituted for one another.

---

## 2. Canonical temporal model

### Observation

A canonical `Observation` represents a value that refers to an underlying observation period/time.

Required semantic distinction:

```text
observation period/time
        ≠
release/publication time
        ≠
P365 retrieval time
```

For market data, the observation time may be an exact timestamp.

For macro data, the source may provide only an observation date such as `2026-09-01`. P365 must preserve that source date without inventing a more precise observation time.

### Event

An `Event` distinguishes:

- `scheduledAt` — planned event time;
- `occurredAt` — actual occurrence/result time when known;
- retrieval time — stored as provenance, not as event occurrence.

An event must not be marked as having occurred merely because P365 retrieved the calendar entry.

### Evidence

Evidence records when P365 captured/retrieved the evidence separately from the source's own publication or release time.

For news:

```text
publishedAt = source publication time
capturedAt  = P365 retrieval/capture time
```

For calendar entries:

```text
scheduledAt = source scheduled event time
capturedAt  = P365 retrieval/capture time
```

---

## 3. Provenance requirements

Every canonical Observation, Event, and Evidence record must be traceable to:

- `sourceId`
- source-native identifier where available
- source endpoint or URL where available
- source publication/release/schedule timestamp where available
- P365 retrieval/capture timestamp
- source-specific metadata required to reproduce the interpretation

P365 must not fabricate missing source timestamps.

If a source provides only a date, retain date precision. If it provides no release timestamp, represent release time as unknown rather than using retrieval time as a proxy.

---

## 4. Current repository audit

### FRED

Current FRED ingestion returns:

- observation date;
- value;
- previous value metadata;
- vintage date when supplied;
- P365 retrieval time during normalization.

The current canonical normalization still places the retrieval timestamp into `Observation.observedAt`, while the source observation date is retained in metadata. This is a **temporal semantic gap**.

The correct future model is to keep source observation date and P365 retrieval time separately rather than treating retrieval as observation time.

FRED also does not currently expose a canonical release timestamp in the P365 observation contract. `releaseDate` is currently represented as null metadata. This remains a Phase 1A/1D dependency.

### Crypto / CoinGecko

CoinGecko market observations already carry an observation timestamp from the provider path and are normalized into canonical observations. Their provider retrieval/provenance metadata is also preserved.

The remaining Phase 1A requirement is to make retrieval time and observation time explicit at the canonical contract level rather than relying only on provider-specific metadata.

### Economic calendar

Calendar normalization currently stores:

- source scheduled time as `Event.scheduledAt`;
- P365 capture time as `Evidence.capturedAt`.

This separation is directionally correct.

However, calendar awareness still does not provide actual, expected, previous, and release-time semantics required for surprise analysis. That gap belongs to the later expectation/event-completion work and is not solved by this document.

### News

News normalization currently maps source `publishedAt` into `Evidence.capturedAt`.

This is a semantic mismatch: source publication time and P365 capture time are different concepts.

The source publication timestamp must remain identifiable as publication time, while P365 retrieval time must be recorded separately.

---

## 5. Data quality rule

Freshness must be evaluated against the correct temporal reference.

P365 must not use retrieval time as the observation time, and must not evaluate low-frequency macro freshness simply by comparing an observation date to `Date.now()` without considering the source's cadence and release semantics.

Conceptually:

```text
freshness reference
        ↓
source-defined observation/release semantics
        ↓
source cadence / freshness policy
        ↓
DataQuality
```

The exact freshness algorithm is a separate implementation checkpoint. No arbitrary universal 15-minute rule should be applied across all domains.

---

## 6. Required Phase 1A changes

Before Phase 1 expands materially, the implementation should establish explicit canonical fields or an equivalent typed provenance structure for:

### Observation

- observation time/date or observation period
- retrieval time
- source identifier
- source-native identifier
- optional release/publication time
- quality reference semantics

### Event

- scheduled time
- actual occurrence time when known
- release/result time when applicable
- retrieval time
- source identifier
- source-native identifier

### Evidence

- source publication/release time when applicable
- P365 capture/retrieval time
- source identifier
- source-native identifier
- source URL/endpoint where applicable

---

## 7. Explicit non-goals

Phase 1A does **not** implement:

- Regime
- State
- Risk
- Intelligence
- sentiment
- capital flow
- trading signals
- prediction
- automatic surprise scoring
- arbitrary cross-domain thresholds
- new cross-asset providers

Those remain downstream of a valid Data Foundation.

---

## 8. Acceptance criteria

Phase 1A is considered implementation-ready when:

- no canonical timestamp is overloaded across observation/release/retrieval meanings;
- source dates are preserved at source precision;
- retrieval timestamps are explicit;
- publication/release timestamps are not fabricated;
- event schedule and event occurrence are distinct;
- freshness can be evaluated using source-appropriate temporal semantics;
- provenance can trace every canonical record back to its source observation/event/evidence;
- existing Macro and Crypto behavior remains functionally intact apart from semantic field corrections;
- no downstream intelligence logic is introduced.

---

## 9. Next implementation checkpoint

**Phase 1A-Implementation:** update the canonical temporal/provenance types and normalization paths, then audit FRED, CoinGecko, calendar, and news adapters against this contract.

Only after that checkpoint passes should P365 proceed to the next Phase 1 provider/data gap.
