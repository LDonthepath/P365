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

Production persistence is now backed by the P365 Supabase PostgreSQL project through `SupabaseMarketMemoryStore` in `lib/domain/market-memory.ts`.

The domain layer remains storage-aware only through the `MarketMemoryStore` interface; the concrete adapter owns the Supabase transport details.

Database table:

- `public.market_memory`
- RLS enabled
- append-only trigger rejects UPDATE and DELETE
- `dedupe_key` has a unique index
- temporal, canonical, supersede, and invalidate indexes are present
- payload is stored as JSONB for provenance/reconstruction, not as a replacement for canonical objects

## Idempotency

Each canonical record is persisted with:

```text
<record type>:<canonical object id>:<effective timestamp>
```

as its deterministic `dedupe_key`.

Repeated dashboard requests therefore do not create another Market Memory row for the same canonical fact at the same effective time.

## Live ingestion integration

`getDashboardData()` now sends the canonical dashboard records to Market Memory after normalization:

- Observations
- Events
- Evidence

News remains represented through canonical Evidence rather than being stored as a second raw-news record.

Persistence happens after canonicalization and before the dashboard result is returned. A failed durable write is treated as an application error rather than silently pretending historical persistence succeeded.

## Server-only credentials

The adapter requires:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

These variables must exist only in the trusted server/deployment environment. The secret key must never be prefixed with `NEXT_PUBLIC_` or shipped to the browser. Supabase's current API-key guidance recommends publishable keys for browser code and secret keys for trusted backend code.

## Append-only invariant

Once a memory record is written:

- it must not be overwritten;
- it must not be silently deleted;
- a correction must create a new record or explicit superseding relationship;
- historical records must not be rewritten using later information.

## What is deliberately not implemented

- retention/TTL policy;
- automatic interpretation of historical records;
- surprise calculation;
- AI-generated conclusions;
- retroactive mutation of history;
- regime/trading logic.

## Readiness

| Layer | Status |
| --- | --- |
| Canonical Observation | READY |
| Historical observations in provider response | READY for FRED retrieval window |
| Factual Baseline selector | READY |
| Market Memory domain contract | READY |
| Durable Supabase schema | READY |
| Durable Supabase adapter | READY |
| Dashboard canonical-record persistence | READY |
| Deployment secret configuration | **REQUIRED** |
| End-to-end production verification | **PENDING DEPLOYMENT** |

The repository now contains the integration. Production readiness is only claimed after the deployment environment supplies the server-only Supabase variables and a live dashboard request successfully produces an idempotent Market Memory record.
