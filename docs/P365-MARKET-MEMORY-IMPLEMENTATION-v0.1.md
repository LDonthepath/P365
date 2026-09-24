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

Repeated ingestion of the same canonical fact does not create another Market Memory row for the same canonical identity/effective-time key.

## Live ingestion integration

Durable Market Memory writes are owned by the authenticated independent ingestion workers invoked by the production Supabase `pg_cron` schedules.

The dashboard render path may acquire/cache provider data for presentation and may query durable history for factual baselines, but it does **not** persist Observations, Events, Evidence, Context, or EconomicEventResult rows. A page visit therefore cannot become a second ingestion clock.

The independent workers persist:

- canonical Observations and their Evidence;
- canonical Events and their Evidence;
- EconomicEventResult snapshots where applicable;
- runtime Snapshots through the dedicated CAP-001 capture owner.

News remains represented through canonical Evidence rather than being stored as a second raw-news record.

Persistence failure is reported by the owning ingestion worker and must not be hidden as successful durable acquisition. Dashboard availability remains separate from write ownership.

## Server-only credentials

The adapter requires:

```text
SUPABASE_URL
P365_MEMORY_WRITE_KEY
```

`P365_MEMORY_WRITE_KEY` must contain a trusted server-side Supabase secret/service key. These variables must exist only in the trusted server/deployment environment. Never expose the write key through a `NEXT_PUBLIC_` variable or browser code.

Direct Supabase Market Memory requests on the canonical/EventResult adapters and the HistoricalObservation read used by the dashboard factual-baseline path are bounded by a 10-second `AbortSignal.timeout`. Timeout rejection is surfaced to the owning caller rather than allowing a render or ingestion worker to wait indefinitely.

## Append-only invariant

Once a memory record is written:

- it must not be overwritten;
- it must not be silently deleted;
- a correction must create a new record or explicit superseding relationship;
- historical records must not be rewritten using later information.

### Snapshot correction / supersession

Event-window Snapshot repair follows the same invariant. A defective immutable Snapshot is retained permanently. If deterministic as-of reconstruction later proves a strictly more complete/correct slot from facts that were available by the original target time, CAP may append a replacement Snapshot with:

- `correctionPolicy = append-only-snapshot-supersession-v1`;
- `supersedesSnapshotId = <prior active snapshot id>`;
- `correctionCandidateSnapshotId = <deterministic canonical reconstruction id>`;
- the same semantic `capturedAt`, Event identity, window role and target.

Readers must resolve the single active supersession tip for a logical slot. Forks, cycles, missing parents, or cross-scope/time supersession links fail closed. A correction is permitted only when quality/completeness is non-regressing and at least one governed completeness dimension strictly improves.

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
| Dashboard durable-write ownership | READ-ONLY — persistence owned by independent cron workers |
| Deployment secret configuration | **REQUIRED** |
| End-to-end production verification | **PENDING DEPLOYMENT** |

Production durable-write readiness is proven through authenticated ingestion/capture workers using server-only Supabase credentials. Dashboard rendering is not a persistence acceptance path.
