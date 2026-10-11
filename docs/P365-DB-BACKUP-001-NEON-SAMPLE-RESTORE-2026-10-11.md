# DB-BACKUP-001 — Actual Neon PostgreSQL sample restore receipt

**Issue:** [#331](https://github.com/LDonthepath/P365/issues/331) · **PR:** [#357](https://github.com/LDonthepath/P365/pull/357) · **Execution:** 11 October 2026, approximately 02:54–03:00 UTC.  
**Status:** **LIVE-SOURCE SAMPLE COPY + SQL READBACK VERIFIED; WHOLE-DATABASE RECOVERY STILL UNVERIFIED.**  
**Supersedes a narrow condition in the [initial audit](P365-DB-BACKUP-001-MARKET-MEMORY-RECOVERY-2026-10-11.md):** An isolated Neon database now exists; the initial audit correctly reported that no restore environment was available at the time of that earlier inspection.

## Environment and safety boundaries

- Production source: Supabase project `orwhuzexnuochctccqvl`, PostgreSQL **17.6**. All reads used `SELECT` only. **No production DML, DDL, TRUNCATE, cron or restore.**
- Isolated target: Neon organization **LD (Free)**, project `p365-recovery` / `snowy-flower-79929352`, **Singapore** `aws-ap-southeast-1`, PostgreSQL **17.11**, storage limit reported by provider API **1,073,741,824 bytes/branch**.
- Neon default branch `main` / `br-floral-forest-b3fjicpk`: verified **zero user tables** after the sample drill. Preserved empty for a potential actual full restore.
- Created isolated **`drill-331-sample`** branch / `br-cold-hill-b3vq6nhq`, 0.25 CU maximum compute and its own `recovery_drill_331` schema. No apps, schedulers, Vercel aliases, provider workers, Data API or production credentials were attached to this branch.
- The drill schema includes **18-column** `market_memory_sample` (all source columns), PK and unique dedupe key, FKs/not-self checks for revision links, plus a separately defined BEFORE UPDATE/DELETE mutation-rejection trigger; it also has `fred_revision_gate` and `fred_revision_heads` tables. **These are purpose-built staging analogues, not a binary-identical restoration of the full Supabase schema/functions/RLS.** There are 8 enforced constraints and 1 enabled custom append-only trigger; PUBLIC role receives **zero schema USAGE/CREATE grants**.
- No connection strings, service keys or record payloads were written to GitHub, CI or the PR. Private record transfer was contained within the connected database tools, with only counts/checksums emitted for the operator review.

## Actual data movement

1. From a **single read-only Supabase SQL statement**, selected the latest **3 physical records per existing family**, across `OBSERVATION`, `EVIDENCE`, `EVENT`, `EVENT_RESULT`, `CONTEXT`, and `SNAPSHOT`: **18 rows total**, approximately **43,249 UTF-8 bytes** as serialized transport JSON.
2. Preserved original UUID `id`, record type, `canonical_id`, `source_id`, SQL `captured_at`, semantic `effective_at`, status, `supersedes_id`/`invalidates_id`, evidence/observation/event arrays, snapshot/baseline IDs, full JSONB payload, `created_at`, `dedupe_key`, `payload_hash`. Inserted these into the isolated Neon staging table. No provider re-fetch or reconstructed history was used.
3. Independently read target SQL rows and recomputed the same manifest expression as on source:
   `md5(string_agg(id::text || '|' || dedupe_key || '|' || md5(payload::text), '~' ORDER BY id::text))`.
4. Copied `public.p365_fred_revision_gate` **one** control row: `singleton=true`, `enforced=false`, `epoch=0`. Source `p365_fred_revision_heads` **0 rows**, target also **0**. Note that this is not proof of historical FRED revisions (native `supersedes_id` links are zero in the production table and the original source reader maintains separate revision semantics).

### Independent before/after comparisons

| Check | Supabase production source | Neon sample branch | Verdict |
|---|---|---|---|
| Sample physical rows | 18 | 18 | **PASS** |
| Rows per each of six families | 3 | 3 | **PASS** |
| Unique dedupe keys | 18 | 18 | **PASS** |
| MD5 deterministic manifest | `4ae05653b21de0ef79d472f54b220987` | `4ae05653b21de0ef79d472f54b220987` | **PASS** |
| FRED gate `enforced` / `epoch` | `false` / `0` | `false` / `0` | **PASS** |
| FRED head count | 0 | 0 | **PASS** |
| Historical as-of `2026-10-08 10:00 UTC` | 4 eligible | 4 eligible | **PASS** |
| Historical as-of `2026-10-09 10:00 UTC` | 10 eligible | 10 eligible | **PASS** |
| Historical as-of `2026-10-11 02:55 UTC` | 13 eligible | 13 eligible | **PASS** |
| Historical as-of `2026-10-11 03:00 UTC` | 18 eligible | 18 eligible | **PASS** |
| Main Neon branch unaffected | n/a | 0 user tables | **PASS** |

Historical as-of eligibility was evaluated on the **same fixed 18 UUIDs** in source and target, requiring `captured_at <= cutoff` AND `coalesce(payload.retrievedAt, captured_at) <= cutoff`. This is stronger than comparing only `effective_at`, which can predate retrieval by weeks. For types without a `retrievedAt` field, SQL `captured_at` is the available bound. The checks were comparison reads; they did not alter data.

Re-runnable [Neon sample verification SELECT script](../scripts/ops/db_backup_001_neon_sample_verify.sql) is committed; run it **only on `br-cold-hill-b3vq6nhq`**, not production or another schema. The initial source selection was a moment-in-time snapshot of the latest 3 rows per type, so rerunning it later will select different newly ingested records and produce a different manifest. That is expected.

## Critical limitations — reasons Issue #331 stays OPEN

**This is a partial SQL record-transfer drill, not an actual backup/restore of a complete database.** The following remain untested:

1. A real **single-consistent-snapshot** dump (`pg_dump`) of all 176k+ physical Market Memory rows, full PostgreSQL indexes/triggers/functions, FRED revision gate/heads and all dependent canonical structures, with point-in-time retention and original complete payloads.
2. Encrypted, independently stored, externally accessible backup artifacts, with file integrity hashes, dated retention and tested recovery-point coverage. **No backup file was created** through the connectors; there is no approved off-site location configured.
3. A full database restore into the *empty Neon main branch*, including extension/role/function compatibility. The sample schema is simplified and intentionally kept away from default/main.
4. End-to-end provider ingestion continuity, scheduler and secret recovery, PostgREST/RLS role semantics, and whole-history quality. Neither a correct manifest on 18 rows nor GitHub CI indicates those are proven.
5. Operational RPO and RTO under incident conditions; until an archive and actual restore are produced, both remain **UNKNOWN**.

**Why full transfer is not performed via connected SQL tools:** Supabase’s connected project capabilities expose SELECT queries and migrations but **do not expose a streaming `pg_dump`/archive destination** or operator database password. Moving 176k+ rows and hundreds of MB through per-query textual responses would be an unsafe, non-transactional substitute for a database backup and would not produce a consistent retained recovery artifact. Do not attempt to reconstruct one by paging and silently label it an export.

## Exact next operator action for full proof

With owner-approved encrypted off-site storage and **privately managed** Supabase read credentials, perform an authorized, consistent PostgreSQL snapshot export **on an operator-controlled workstation**, not via conversational SQL. Use a **direct/session-pooler connection** for `pg_dump`, and a **Neon direct/nonpooled connection** for `pg_restore`. The [initial runbook](P365-DB-BACKUP-001-MARKET-MEMORY-RECOVERY-2026-10-11.md#3-recovery-objectives-policy-and-export-procedure) outlines provider-safe dump format, exact table families, audit manifest, credential confidentiality and isolation/cutover gates. A `--data-only` selected-table dump from a **single `pg_dump` invocation** can give one data snapshot of Market Memory and the two FRED tables, but must be restored only after the *compatible dependency schema* is explicitly prepared and validated; table-filtered dumps **do not automatically include every required trigger function or Supabase service dependency**. Rehearse full schema and data, preferably with a transaction-consistent export strategy, before asserting disaster recoverability.

**Owner decision still required:** encrypted off-site archive destination/retention policy and a private execution environment authorized to access Supabase DB credentials. The already-created Neon target is ready for that separate, measured restore; do not upgrade to Pro solely to perform this sample test.

**Do not self-merge.** PR #357 documents qualification + rehearsal; **#331 must not close** before a real recoverable archive and whole-database restoration can be verified or the owner explicitly narrows its acceptance criteria in a separate decision.
