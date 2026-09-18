# P365 Canonical Foundation Integrity Audit — F0

**Status:** Foundation audit checkpoint  
**Audited ref:** `main@85b82b2e1827e77ba36af571e2396d8fbadebb68`  
**Scope:** Provider → Ingestion → Normalization → Canonical Observation/Event/Evidence → Repository/Persistence → Application Query → Factual Baseline

## Verdict

**CHANGES REQUIRED**

The canonical foundation is directionally sound, but the active runtime still has structural gaps that prevent Phase 2 historical comparison from being considered reliable end-to-end.

## Classification

| Area | Classification | Finding |
|---|---|---|
| Provider result boundary | PASS | Provider status, retrieval timestamp, error classification and provider identity are explicit. |
| Provider → ingestion isolation | PASS | Provider calls are isolated in `lib/data/*` and orchestrated through the ingestion boundary. |
| Canonical Observation/Event/Evidence types | PASS / PARTIAL | Core temporal fields are explicit, but provenance remains partly metadata-shaped rather than uniformly typed. |
| FRED historical canonicalization | PASS | FRED now maps its recent valid retrieval window into separate canonical Observations rather than only exposing one current fact. |
| FRED `previousValue` | PARTIAL | It remains duplicated metadata even though the preceding period is now also a canonical Observation. It must not be used as an authoritative historical substitute. |
| Observation/retrieval separation | PASS | `observedAt` and `retrievedAt` are distinct canonical fields. FRED preserves its date-only observation period rather than substituting retrieval time. |
| Release semantics | PARTIAL | FRED correctly keeps release time unknown, but release semantics are not uniformly available across all factual families. |
| Evidence publication/retrieval separation | PASS | Evidence has distinct `publishedAt`/`releasedAt` and `retrievedAt`; news normalization no longer treats publication time as capture time. |
| Freshness | PARTIAL | Typed freshness families exist, but macro canonicalization uses per-series override while the generic FRED family is 5 days; release/cadence semantics remain incomplete for low-frequency macro data. |
| Canonical persistence | PARTIAL | Append-only Supabase persistence exists and is isolated from dashboard availability, but production durability currently depends on deployment secrets and dashboard-triggered ingestion. |
| Repository read contract | **HIGH / PARTIAL** | Canonical repositories expose only `findById`. There is no historical observation query by series/subject + effective time. |
| Historical continuity | **HIGH / PARTIAL** | FRED provides a small recent window and dashboard requests persist it, but there is no explicit history/backfill collector or guaranteed ingestion schedule independent of UI access. |
| Application query | **HIGH / PARTIAL** | `getDashboardData()` persists normalized records but never reads canonical history back before building baselines. |
| Factual baseline selector | PASS in isolation | `selectFactualBaseline` enforces series/source/unit/frequency/time compatibility and explicit missing/incompatible/stale states. |
| Dashboard factual baseline | **HIGH / PARTIAL** | Baselines are built only from observations in the current provider fetch. Durable Market Memory is not yet the historical input to baseline selection. |
| UI/domain boundary | PASS for audited path | Baseline construction remains in normalization/domain code rather than JSX. |
| Missing-data semantics | PASS / PARTIAL | Provider EMPTY/ERROR/UNAVAILABLE remain distinct; higher-order history queries do not exist yet, so historical missingness cannot be expressed through repository queries. |

## Highest-priority structural gap

The main foundation gap is no longer “FRED previous values are not canonical.” Current FRED ingestion already canonicalizes multiple recent periods.

The remaining problem is:

```text
Provider recent window
        ↓
Canonical observations
        ↓
Baseline built immediately from same request
        ↓
Persist to Market Memory
```

instead of the durable architecture required for historical reasoning:

```text
Provider / scheduled ingestion
        ↓
Canonical observations
        ↓
Append-only persistence
        ↓
Historical repository query
        ↓
Current + previous compatible canonical observations
        ↓
Baseline selection
```

Therefore the current factual baseline works while the provider supplies enough recent history, but it is not yet a repository-backed historical baseline.

## Required repair sequence

### F1 — Historical Observation Repository Contract

Add a narrow read contract for canonical Observation history. The query must be semantic and temporal, not provider-wire-shaped.

Minimum capability:

- select by canonical series/metric identity;
- return observations ordered by effective observation time;
- support a bounded history query;
- preserve canonical payload and quality/provenance;
- explicitly return no rows when history is unavailable.

Do not introduce baseline logic into the repository.

### F2 — Supabase + in-memory historical query adapters

Implement the same contract for durable and development repositories. Supabase queries must use `record_type=OBSERVATION`, canonical payload/effective time, deterministic ordering, and a bounded limit.

### F3 — Repository-backed factual baseline integration

The application layer should obtain the current normalized observation, query compatible canonical history, combine it without duplicating the current record, then call the existing domain baseline selector.

Persistence failure/history unavailability must remain explicit and must not fabricate a previous value.

### F4 — Historical continuity / ingestion policy

Define how canonical history accumulates independently of a user opening the dashboard. Specify cadence, backfill scope, idempotency, and operational ownership before claiming durable historical continuity.

### F5 — Temporal/provenance cleanup

After repository-backed history works, audit remaining metadata duplication such as `previousValue` and decide whether it remains provider provenance only or can be removed from downstream canonical metadata without breaking compatibility.

### F6 — Foundation verification

Verify:

- typecheck/build;
- baseline selection from repository history;
- missing-history behavior;
- stale/incompatible history behavior;
- idempotent persistence;
- no hidden fallback to `previousValue`;
- no provider-specific wire shape crossing into domain/application reasoning.

## Explicit non-goals

This audit does not authorize:

- State/Regime;
- Risk;
- Intelligence;
- Market Briefing;
- signals or recommendations;
- portfolio/execution logic;
- arbitrary scoring;
- new providers;
- broad folder restructuring.

## F0 exit decision

**F0 is complete as an audit checkpoint. The first implementation change should be F1: Historical Observation Repository Contract.**

This is the smallest structural change that unlocks a durable Baseline/Market Memory architecture without advancing prematurely into reasoning.
