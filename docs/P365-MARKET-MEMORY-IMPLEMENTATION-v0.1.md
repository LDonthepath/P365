# P365 Market Memory — Implementation Contract v0.1

## Decision

Market Memory is an **append-only historical reasoning record**. It is not a cache and it is not a replacement for canonical Observation, Event, Evidence, or State objects.

## Why persistence is the next dependency

Factual Baseline needs a previous canonical Observation. A provider's `previousValue` is not sufficient because it is not independently addressable, traceable, or durable as a P365 Observation.

Therefore the system needs:

```text
LIVE PROVIDER DATA
      ↓
CANONICAL OBSERVATION
      ↓
APPEND TO MARKET MEMORY
      ↓
FUTURE CURRENT OBSERVATION
      ↓
SELECT PREVIOUS CANONICAL OBSERVATION
      ↓
FACTUAL BASELINE
```

## Record rules

Each memory record must preserve:

- immutable record ID;
- canonical object type;
- canonical object ID;
- effective timestamp/period;
- record/capture timestamp;
- source identity;
- optional payload hash for integrity checks.

The canonical object remains the Single Source of Truth. Market Memory stores its historical reference and persistence metadata rather than inventing a second interpretation of the object.

## Append-only invariant

Once a memory record is written:

- it must not be overwritten;
- it must not be silently deleted;
- a correction must create a new record or explicit superseding relationship;
- historical snapshots must not be rewritten using later information.

## Current implementation

`lib/domain/market-memory.ts` now defines the persistence contract and a deliberately named `NonDurableMarketMemoryStore` adapter for contract-level use.

The non-durable adapter is **not production persistence**. It exists so domain code can depend on an explicit interface without falsely claiming that application memory survives deployment/restarts.

## Production persistence requirement

P365 needs an external durable store before Market Memory becomes a production reasoning dependency. The storage technology is intentionally not hard-coded into the domain layer.

Candidate infrastructure can be selected later based on deployment, access control, backup, retention, and operational requirements. The domain contract must remain storage-provider agnostic.

## What is deliberately not implemented

- automatic persistence of every dashboard fetch;
- deduplication policy beyond canonical identity;
- retention/TTL policy;
- database schema tied to one vendor;
- retroactive mutation of history;
- regime inference;
- scoring;
- surprise calculation;
- AI-generated conclusions.

## Readiness

| Layer | Status |
| --- | --- |
| Canonical Observation | READY |
| Historical observations in provider response | READY for FRED retrieval window |
| Factual Baseline selector | READY |
| Market Memory domain contract | READY |
| Durable Market Memory adapter | **NOT YET DEPLOYED** |
| System-wide baseline persistence | BLOCKED on durable adapter |

## Next checkpoint

Choose and connect a durable storage adapter without coupling the reasoning domain to the storage vendor. Only after that should P365 wire historical Observation persistence into the live ingestion path.
