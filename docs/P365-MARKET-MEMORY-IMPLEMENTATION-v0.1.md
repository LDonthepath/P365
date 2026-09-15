# P365 Market Memory — Implementation Contract v0.1

## Decision

Market Memory is an **append-only historical reasoning record**. It is not a cache and it is not a replacement for canonical Observation, Event, Evidence, or State objects.

## Reasoning dependency

Factual Baseline needs a previous canonical Observation. A provider's `previousValue` is not sufficient because it is not independently addressable, traceable, or durable as a P365 Observation.

Therefore:

```text
LIVE PROVIDER DATA
      ↓
CANONICAL OBSERVATION / EVENT / EVIDENCE
      ↓
APPEND TO MARKET MEMORY
      ↓
FUTURE CURRENT OBSERVATION
      ↓
SELECT PREVIOUS CANONICAL OBSERVATION
      ↓
FACTUAL BASELINE
```

## Storage implementation

Production persistence is backed by the P365 Supabase PostgreSQL project through `SupabaseMarketMemoryStore` in `lib/data/market-memory-store.ts`.

The domain layer exposes the `MarketMemoryStore` contract; the concrete adapter owns the Supabase transport details.

Database table:

- `public.market_memory`
- RLS enabled with no public read/write policy
- database trigger rejects UPDATE and DELETE
- insert trigger derives `dedupe_key` when omitted
- unique index prevents duplicate canonical records
- temporal, canonical, supersede, invalidate, and payload-hash indexes are present
- payload is stored as JSONB for provenance/reconstruction, not as a replacement for canonical objects

## Idempotency

Each canonical record is identified by:

```text
<record type>:<canonical object id>:<effective timestamp>
```

as its deterministic `dedupe_key`.

Repeated dashboard requests therefore do not create another Market Memory row for the same canonical fact at the same effective time.

## Live ingestion integration

`getDashboardData()` sends canonical dashboard records to Market Memory after normalization:

- Observations
- Events with a valid occurred/scheduled timestamp
- Evidence

News remains represented through canonical Evidence rather than being stored as a second raw-news record.

Persistence is isolated from provider normalization. A persistence failure is surfaced in `unavailableSources` while the dashboard can still return its canonical data; this preserves the rule that persistence failure must not erase or gate the observation/event itself.

## Server-only credentials

The adapter requires:

```text
SUPABASE_URL
P365_MEMORY_WRITE_KEY
```

`P365_MEMORY_WRITE_KEY` must contain a trusted server-side Supabase secret/service key. These variables must exist only in the trusted server/deployment environment. Never expose the write key through a `NEXT_PUBLIC_` variable or browser code.

## Append-only invariant

Once a memory record is written:

- it must not be overwritten;
- it must not be silently deleted;
- a correction must create a new record or explicit superseding relationship;
- historical records must not be rewritten using later information.

## Current database verification

The P365 Supabase project contains `public.market_memory`, RLS is enabled, and the append-only/dedupe triggers are installed. The database currently contains one pre-existing verification record; it is intentionally retained because Market Memory is append-only.

## What is deliberately not implemented

- retention/TTL policy;
- automatic interpretation of historical records;
- surprise calculation;
- AI-generated conclusions;
- retroactive mutation of history;
- trading logic.

## Readiness

| Layer | Status |
| --- | --- |
| Canonical Observation | READY |
| Historical observations in provider response | READY for FRED retrieval window |
| Factual Baseline selector | READY |
| Market Memory domain contract | READY |
| Durable Supabase schema | READY |
| Durable Supabase adapter | READY |
| Dashboard canonical-record persistence | WIRED |
| Deployment secret configuration | **REQUIRED** |
| End-to-end production verification | **PENDING DEPLOYMENT** |

The repository contains the integration, but production readiness is not claimed until the deployment environment supplies the server-only Supabase variables and a live dashboard request successfully writes and then reuses an idempotent Market Memory record.
