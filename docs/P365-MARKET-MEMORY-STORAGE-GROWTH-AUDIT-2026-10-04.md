# P365 Market Memory Storage Growth Audit & Deferred Housekeeping Plan

**Audit date:** 4 Oct 2026  
**Status:** DEFERRED OPERATIONAL BACKLOG — AUDIT COMPLETE / NO HOUSEKEEPING IMPLEMENTED  
**Repository baseline:** `main@bc98af700397c4b3be96094d61be1580d68fff29`  
**Production boundary:** READ-ONLY audit only  
**Repository mutations during audit:** 0  
**Production data mutations during audit:** 0

## 1. Purpose

This document records the storage-growth audit requested by the owner and freezes the
housekeeping direction for later work.

It does **not** authorize deletion, compaction, retention, VACUUM/REINDEX operations,
schema changes, provider changes, new tables, or automatic cleanup.

The goal is to prevent storage pressure from being addressed later with an unsafe
"delete everything older than N days" rule that would violate P365's append-only history,
point-in-time reconstruction, historical baselines, MOVE calibration, REL evidence, or
Snapshot lineage.

## 2. Supabase Free storage boundary

The audit verified the current Supabase Free database-size boundary as **500 MB per project**.

This database-size limit must be distinguished from the underlying physical disk allocation.
For planning, P365 treats 500 MB database size as the relevant operational ceiling.

If the project remains on Free, storage growth must therefore be measured and governed
before the database approaches that ceiling.

## 3. Production snapshot — 4 Oct 2026

Final read-only measurement during the audit:

| Component | Measured size |
|---|---:|
| PostgreSQL database | **245 MB** |
| `public.market_memory` total | **~209 MB** |
| Market Memory heap | **~151 MB** |
| Market Memory indexes | **~57 MB** |
| `cron.job_run_details` | **~23.5 MB** |

Market Memory record counts at the final audit snapshot:

| record_type | rows |
|---|---:|
| EVIDENCE | 115,081 |
| OBSERVATION | 30,501 |
| EVENT_RESULT | 814 |
| EVENT | 471 |
| CONTEXT | 171 |
| SNAPSHOT | 110 |

Natural scheduler activity continued during the audit, so these counts are a measured
point-in-time snapshot rather than immutable totals.

## 4. Primary finding — historical Observation Evidence duplication

### 4.1 Historical duplicate footprint

For canonical Evidence where `kind = OBSERVATION`:

- total rows audited: **111,060**;
- semantic unique payloads, ignoring only fetch-time `capturedAt/retrievedAt`: **31,495**;
- historical excess semantic duplicates: **79,565**;
- duplicate share: **71.64%**;
- logical row footprint of the excess set: approximately **91.3 MB**.

The dominant source was FRED:

- FRED Observation Evidence: 75,393 rows;
- excess semantic duplicates: 72,628;
- duplicate share: 96.33%.

CoinGecko, Yahoo and the early SoSoValue activation also contained smaller legacy duplicate
footprints.

These rows are historical evidence of the old writer behavior. Their presence does not mean
the current writer is still duplicating unchanged facts.

### 4.2 Root cause and fix

The write path is:

`lib/application/historical-ingestion.ts`

`runHistoricalIngestion() -> executeProvider() -> canonicalize() ->
repositories.evidence.saveMany() / repositories.observations.saveMany()`

Persistence is implemented through Market Memory in:

- `lib/data/market-memory-store.ts`
- `lib/data/market-memory-record.ts`

The historical defect was documented and fixed in PR #110:

**FND — Stabilize observation Evidence Market Memory idempotency**

Before that fix:

- Observation-derived Evidence could retain the same canonical Evidence ID;
- `retrievedAt` changed on every refetch;
- Market Memory used Evidence `retrievedAt` as `effective_at`;
- therefore the unique `dedupe_key` changed even when the factual observation did not.

PR #110 changed Observation-derived Evidence to use
`metadata.observationEffectiveAt` as its semantic Market Memory effective time.

The unique Market Memory dedupe key then became stable across unchanged refetches.

### 4.3 Current steady-state result

The audit found **zero semantic duplicate excess rows since 1 Oct 2026** across active
Observation-derived Evidence lanes.

This is an important constraint for future work:

> "Write Observation Evidence only when the factual revision changes" is already the
> current effective behavior.

A new checkpoint must not re-implement this behavior unless a reproduced regression proves it
has broken.

The legacy duplicates remain append-only historical rows. This audit does **not** authorize
their deletion.

## 5. Growth by lane

Fourteen-day history is distorted by legacy duplication and activation/backfill bursts, so
raw averages must not be interpreted as current steady state.

Observed 14-day logical row footprint:

| Lane | rows | logical bytes | interpretation |
|---|---:|---:|---|
| MARKET_FAST_CORE | 61,458 | ~70.6 MiB | genuine high-frequency growth |
| FRED | 65,399 | ~56.0 MiB | mostly legacy pre-fix duplication |
| EVENT | 2,858 | ~2.47 MiB | event-dependent |
| GOLD_COT | 1,484 | ~2.23 MiB | includes one-year backfill burst |
| OTHER | 173 | ~0.44 MiB | mixed |
| BTC ETF | 104 | ~0.13 MiB | activation + forward facts |
| STABLECOIN | 89 | ~0.11 MiB | initial backfill + forward facts |
| GDELT durable NEWS | 12 | ~0.02 MiB | newly activated |
| Binance spot-flow | 10 | ~0.02 MiB | newly activated |
| Asia FX | 6 | ~0.01 MiB | newly activated / weekend constrained |

### Backfill separation

The following must not be projected as steady daily growth:

- FRED pre-PR #110 duplicate Evidence;
- CFTC one-year backfill on 2 Oct;
- initial stablecoin backfill;
- initial ETF activation/recheck history.

A cleaner post-fix sample from 1–3 Oct showed Market Memory logical growth of roughly:

- 1 Oct: ~6.5 MB;
- 2 Oct: ~8.1 MB raw;
- 2 Oct after removing the CFTC backfill burst: ~6.1 MB;
- 3 Oct: ~4.4 MB.

## 6. Non-Market-Memory storage growth

`cron.job_run_details` is already material:

- approximately **23.5 MB**;
- approximately 34k rows at audit time;
- roughly 868–927 new rows/day in the sampled period;
- Supabase does not automatically retain only a bounded history for this table.

This data is operational scheduler history, not canonical market evidence.

It is therefore the clearest future candidate for a bounded retention policy, subject to an
owner decision about how much scheduler audit history should remain available.

## 7. Index audit

Largest Market Memory indexes at audit time:

| index | approximate size | observed idx_scan | audit conclusion |
|---|---:|---:|---|
| `uq_market_memory_dedupe_key` | ~31.7 MiB | ~301k | **KEEP** |
| `idx_market_memory_canonical` | ~9.3 MiB | used | keep |
| primary key | ~5.6 MiB | structural | keep |
| `idx_market_memory_effective_at` | ~2.8 MiB | heavily used | keep |
| `idx_market_memory_captured_at` | ~2.4 MiB | heavily used | keep |
| `idx_market_memory_payload_hash` | ~1.7 MiB | 0 observed | review candidate |
| `idx_market_memory_supersedes` | ~1.3 MiB | 0 observed | review candidate |
| `idx_market_memory_invalidates` | ~1.3 MiB | very low | review candidate |

The unique dedupe index is **not** a cleanup target merely because it is large. It is a core
correctness mechanism for factual idempotency.

Zero observed scans are also **not sufficient evidence to drop an index**. Any future index
checkpoint must audit query plans, application consumers and correction/supersession
governance first.

## 8. Why canonical "older than 10 days" cleanup is not authorized

P365 currently has several historical consumers with different temporal requirements.

### HIST historical distributions

Current HIST event-response methodology uses a 36-hour rolling historical distribution and
exact event-window horizons.

Exact timestamps matter. Blind 15m downsampling can destroy valid PRE/post pairs.

### MOVE continuous materiality

MOVE-001B/C uses:

- 15m / 30m / 60m / 120m horizons;
- roughly 5m source cadence;
- 36-hour rolling lookback;
- minimum 120 historical samples;
- point-in-time P97.5 materiality calibration.

Reducing old high-frequency history changes sample availability and can change detector
behavior.

### Event windows

Qualified event windows depend on precise PRE/T+5/T+15/T+30/T+60 timing.

Aggressive old-data downsampling can make historical event replay incomplete.

### MOVE-002C spot-flow

The replay contract expects completed 5m Binance spot-flow boundaries.

Removing or downsampling those windows changes COMPLETE coverage to PARTIAL/EMPTY.

### REL historical relationship evidence

REL does **not** freeze all use to a 36-hour lookback. Callers may request broader historical
ranges, and exact timestamps are part of its factual pairing semantics.

### Snapshot lineage

Historical Snapshots and Evidence can preserve exact canonical IDs. Deleting referenced
records can break long-term lineage even if the current dashboard no longer queries the row.

Therefore:

> Age alone is not proof that a canonical Market Memory record is no longer useful.

No automatic canonical deletion by a simple rule such as `age > 10 days` is authorized.

## 9. Deferred housekeeping model

Future housekeeping should classify data into three storage classes.

### 9.1 Operational disposable

Examples:

- `cron.job_run_details`;
- transient request/history logs where no canonical evidence depends on them;
- bounded operational telemetry.

These may receive TTL/retention policies after the owner selects the required audit horizon.

### 9.2 Hot canonical history

High-frequency canonical Observations/Evidence required for:

- current runtime baselines;
- MOVE;
- event windows;
- near-term replay;
- exact point-in-time lineage.

These remain in the primary Market Memory store.

### 9.3 Cold canonical archive

If Free-plan capacity becomes insufficient, older canonical history may eventually move to a
separate immutable archival tier **only after** a formal methodology exists for:

- immutable identity preservation;
- point-in-time retrieval;
- correction/supersession lineage;
- Snapshot reference resolution;
- REL/HIST/MOVE access;
- rehydration/query semantics;
- provenance/auditability.

Cold archival is preferable to irreversible deletion when durable historical evidence still
has product value.

No cold archive provider or implementation is selected by this document.

## 10. Deferred work items

The following are recorded for later checkpoints and are **not part of current product work**.

### HOUSEKEEP-001 — Storage monitoring

**HOUSEKEEP-001A merged / HOUSEKEEP-001A.1 correction pending before production activation.**

Preferred first checkpoint.

Use the existing `public.p365_operational_metrics` table rather than create a new table,
if the existing contract remains suitable.

Candidate daily metrics:

- database bytes;
- Market Memory total bytes;
- Market Memory heap bytes;
- Market Memory index bytes;
- Market Memory row count;
- `cron.job_run_details` bytes;
- estimated remaining Free-plan headroom.

Daily cadence is sufficient. Five-minute storage telemetry is unnecessary.

HOUSEKEEP-001A now freezes the implementation-ready SQL contract in:

`docs/P365-HOUSEKEEP-001A-STORAGE-MONITORING.sql`

It reuses the existing RLS-enabled `public.p365_operational_metrics` table and proposes one
UTC-daily `STORAGE_CAPACITY` row at 00:15 UTC.

Post-merge activation proof on 5 Oct 2026 exposed one blocking schema-contract defect:
`p365_operational_metrics_metric_type_check` allowed only `CACHE_INVALIDATION` and
`PROVIDER_FETCH`. The first manual `STORAGE_CAPACITY` insert failed with PostgreSQL check-
constraint error `23514`. The just-created `p365-storage-daily` cron was immediately
unscheduled; no monitoring row was written and Market Memory was untouched.

HOUSEKEEP-001A.1 corrects this by broadening the existing check constraint to also allow
`STORAGE_CAPACITY`. It does not rename or remove either existing allowed value.

Frozen payload fields:

- database bytes;
- Market Memory total / heap / index bytes;
- Market Memory row count;
- Evidence row count;
- Observation row count;
- `cron.job_run_details` bytes;
- Free-plan database limit bytes;
- estimated remaining headroom bytes;
- database utilization percentage;
- exact measurement timestamp.

Idempotency is day-scoped: repeated execution for the same UTC day must not create another
logical capacity snapshot.

The monitoring job does **not** authorize deletion, retention, VACUUM, REINDEX, canonical
downsampling, or alert thresholds.

### HOUSEKEEP-002 — `cron.job_run_details` retention

Candidate initial policy for owner review:

**30 days**

Reason:

- scheduler history is operational, not canonical market history;
- current table is already ~23.5 MB;
- the table keeps growing continuously;
- 30 days preserves meaningful incident/debug history while preventing indefinite growth.

Alternative horizons that may be selected later: 7 or 14 days.

No retention action is authorized until the owner chooses the policy.

### HOUSEKEEP-003 — Index review

Review only.

Primary candidates:

- `idx_market_memory_payload_hash`;
- `idx_market_memory_supersedes`;
- `idx_market_memory_invalidates`.

Acceptance requires query-plan and consumer evidence.

The dedupe index is excluded from "drop because large" reasoning.

### HOUSEKEEP-004 — Canonical hot/cold policy

Only required if preserving full durable history on the Free database becomes unsustainable.

Must be designed before any canonical deletion or compaction.

### HOUSEKEEP-005 — Plan/limit decision

Before approaching the Free ceiling, the owner must choose between:

1. preserve full high-frequency durable history and increase database capacity; or
2. remain on constrained storage and approve a formal hot/cold archival methodology.

The project should not wait until it is near 500 MB to make this decision.

## 11. Planning runway

At the audit snapshot, the database was approximately 245 MB against a 500 MB Free database
boundary.

Because the system had just activated new lanes, the audit used scenarios rather than a
single deterministic forecast.

Indicative runway model:

| scenario | approximate physical growth | indicative runway from audit snapshot |
|---|---:|---:|
| low | ~8 MiB/day | ~32 days |
| medium | ~11.6 MiB/day | ~22 days |
| high / future-lane sensitivity | ~18.3 MiB/day | ~14 days |

These are planning estimates, not guaranteed forecasts.

The high case is a sensitivity scenario for additional derivatives/order-book persistence.
Raw order-book persistence could be materially larger depending on the future durable
contract.

This is why HOUSEKEEP-001 monitoring should precede irreversible storage policy decisions.

## 12. Owner decisions deferred

Later housekeeping work should resolve these decisions explicitly:

1. daily storage monitoring approval;
2. `cron.job_run_details` retention horizon;
3. whether canonical high-frequency history should be retained indefinitely or eventually
   archived to a cold immutable tier;
4. database-size threshold at which a plan/capacity decision is triggered;
5. whether zero/low-scan indexes should receive a dedicated query-plan audit.

## 13. Frozen guardrails

Until a later owner-approved checkpoint changes this document:

- no automatic deletion of canonical Market Memory based only on age;
- no cleanup of legacy duplicate Evidence by default;
- no rewriting canonical rows in place;
- no weakening append-only semantics;
- no dropping the unique dedupe index;
- no downsampling that changes HIST/MOVE/event-window/REL factual meaning;
- no new storage provider solely for housekeeping without source/infrastructure approval;
- no assumption that a record is unused merely because the current dashboard does not query it.

## 14. Current recommendation

Current 5 Oct 2026 read-only capacity measurement:

- database: **269,388,947 bytes** (~257 MiB);
- Market Memory total: **231,768,064 bytes** (~221 MiB);
- Market Memory heap: **168,534,016 bytes** (~161 MiB);
- Market Memory indexes: **62,783,488 bytes** (~59.9 MiB);
- `cron.job_run_details`: **25,116,672 bytes** (~24.0 MiB);
- Market Memory rows: **152,806**;
- Free-plan utilization: **51.38%**;
- estimated remaining database headroom: **254,899,053 bytes** (~243 MiB).

The last 24-hour sample contained 5,596 new Market Memory rows and roughly 5.4 MiB of raw
canonical payload before tuple/index overhead. Because order-book activation would add two new
steady-state snapshot lanes, HOUSEKEEP-001A monitoring should be merged and activated before
ORDER-BOOK-001C production sampling.

Updated implementation order:

1. **HOUSEKEEP-001A.1 metric-type correction — pending owner merge; monitoring activation rolled back until corrected**;
2. **HOUSEKEEP-002 operational cron-history retention**;
3. observe real growth with all active lanes;
4. **HOUSEKEEP-003 index review**;
5. decide capacity strategy before the Free ceiling becomes urgent;
6. design **HOUSEKEEP-004 hot/cold archival** only if required.

The main P365 product roadmap continues separately. Storage housekeeping is recorded here so
it can be resumed later without losing the audit evidence or applying unsafe age-based
cleanup.

## MACRO-CUT-004 — Integrated macro-only cleanup (15 October 2026; read-only classification, not data removal)

Owner scope is [Issue #455](https://github.com/LDonthepath/P365/issues/455): a single integrated PR must cover code, tests/legacy, cron, history, metadata/source ID and docs. The following SELECT-only Supabase measurement is **not** a retention decision or DELETE approval; it supersedes earlier row/size estimates solely for this measurement time.

| Measure | Observed at 15 Oct 14:10 UTC |
| --- | ---: |
| `public.market_memory` physical records | 188,816 |
| `pg_total_relation_size('public.market_memory')` | 302 MB |
| `pg_database_size(current_database())` | 340 MB |
| Sum `pg_column_size(payload)` | 137 MB |
| `source_id IS NULL` | 185,153 |
| `source_id IS NULL AND payload->>'sourceId' IS NULL` | 352 |
| Conflicting non-null source IDs in column vs payload | 0 |
| Protected sources (fred/gdelt/biquote/federal-reserve/forex-factory) | 85,395 rows, 46 MB payload |
| **Nonmacro CANDIDATE_REVIEW (not deletable yet)** | **103,067 rows, 91 MB payload** |
| Unattributed or SYSTEM | 354 rows, 511 kB payload |

Candidate sources: `alpha-vantage`, `alpha-vantage-market`, `binance-spot`, `cftc-gold-cot`, `coindesk`, `coingecko-market`, `defillama-stablecoins`, `sosovalue-etf-flow`, `yahoo-finance`. None is yet designated safe-to-delete. Explicitly protected history includes FRED 37 series, SEP, GDELT, Forex Factory/Federal Reserve calendars, Biquote/`EVENT_RESULT`, Snapshot job6, canonical evidence IDs, old vintage/revision identity and all linked physical version rows.

**Why blanket DELETE fails:** 181 SNAPSHOTs, 175 with column `observation_ids`, 181 with `evidence_ids`; reference-join identified **212 Yahoo / 190 CoinGecko distinct Observation IDs** plus corresponding Evidence IDs. There are 171 CONTEXT rows, 152 with nonempty JSON `observationIds`; these include **68 CoinGecko distinct referenced Observation IDs**, plus 331 FRED IDs. A nonmacro row count does **not** account for those links, vintage/supersession chains, or external references; there is no safe percentage or retention cutoff yet.

Repeat inventory and reference checks with `scripts/ops/macro_cut_004_inventory_readonly.sql`. A later operator must reconcile real-time drift, select explicit groups and exceptions, establish backup/restore and materialize an **exact-ID archive/rollback** outside the public repo before a controlled cleanup, plus check storage after physical vacuum policy is approved (DELETE alone will not necessarily reduce relation size).

**STOP status:** [DB backup #331](https://github.com/LDonthepath/P365/issues/331) OPEN, [PR #357](https://github.com/LDonthepath/P365/pull/357) still DRAFT; Neon sample restore is not a verified full database backup or full restore. This integrated PR contains **no production DML and no cron changes**. It cannot claim historical cleanup COMPLETE until full verified encrypted offsite `pg_dump -Fc`, isolated full restoration, group-specific literal owner `SETUJU HAPUS <kelompok>`, revision/reference closure, and execution/rollback evidence exist. `scripts/ops/macro_cut_004_execution_blocked.sql` intentionally fails closed.

## MACRO-CUT-004 — Operator-approved cron retirement completed (15 October 2026, ~14:46 UTC)

The owner explicitly approved production removal. The **four inactive nonmacro jobs #4 (CoinGecko context; legacy name p365-fred), #10 (DefiLlama), #15 (SoSoValue) and #20 (CFTC)** were unscheduled transactionally using supported `cron.unschedule`. Exact original commands, schedules, database, username and active=false were first copied into the **private** `p365_ops.macro_cut_004_cron_rollback` relation. The stored command bytes are NOT published, and anon/authenticated/service_role cannot read the schema/table. A live SELECT confirmed all four absent and private backups present.

Retained job state verified unchanged: active #2 GDELT, #5 Forex Factory/Federal Reserve, #6 Snapshot, #24 FRED, #23/#25 operations, plus **#3 Biquote preserved inactive**. `scripts/ops/macro_cut_004_inventory_readonly.sql` now verifies the *post-retirement* state; guarded manual restoration procedure is `scripts/ops/macro_cut_004_cron_rollback_operator.sql` (not automatically executed). If restored, job IDs may differ; source commands and inactive state are validated. This is the **only production mutation** in this checkpoint.

**Historical data deletion did NOT run.** `public.market_memory` has active `market_memory_append_only` DELETE/UPDATE prevention trigger; 181 Snapshots/171 Contexts include retained references into CoinGecko/Yahoo history. Verified full encrypted offsite archive + full isolated restore remain undocumented in #331/#357. The owner's authorization is acknowledged but does not itself remove these technical constraints. Do not bypass triggers or mass purge history without a safe reference/backup path. The remaining data cleanup stays **BLOCKED**, not completed.
