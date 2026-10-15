# OPS-RET-001A — 5-minute raw history retention qualification

**Status:** READ-ONLY AUDIT / PROPOSED CONTRACT FOR OWNER REVIEW. **NOT A DELETE POLICY IN FORCE.**
**Owner issue:** [#350](https://github.com/LDonthepath/P365/issues/350).
**Git baseline:** `main@a4e4fca57ccd36ae5d45d75f32013f2bea4c26e7`, verified 11 October 2026.
**Live database:** P365 Supabase Free, project ref `orwhuzexnuochctccqvl`, PostgreSQL 17.6, `ACTIVE_HEALTHY`.
**Measurement cutoff:** 2026-10-11 00:46:12 UTC (07:46:12 WIB). All queries are read-only SELECT.
**Companion reproducible query:** `scripts/ops/ops_ret_001a_readonly_dryrun.sql`.

## 1. Owner direction and what the audit proves

Owner's product intent: five-minute market observations need not remain in hot history forever if they are only useful for current MOVE monitoring. This is a valid storage-policy direction, but **current implementation also consumes older five-minute history for calibration and replay**. Calendar-yesterday DELETE is incompatible with the current code, and even a rolling age cutoff cannot simply be applied to append-only Market Memory.

This checkpoint qualifies **HOT=72 hours as a conservative initial operational target** while retaining a separate **PROTECTED** tier for durable references and preserving historical as-of behavior until a separately approved archival/replay design exists. It **does not authorize deleting canonical Market Memory**, change cron/retention/schema, or claim physical space savings.

**Key distinction:** 72h is a proposed *working-set retention target*, **not** proof that all 72h-old rows are safe to delete. Current queries support historical point-in-time reconstruction at arbitrary old cutoffs. Removing the only source rows makes those queries silently incomplete unless a qualified archival/read model or revised product contract replaces them.

## 2. Verified consumer dependency matrix

| Family / component | Actual code / parameters | Effect of deleting yesterday |
|---|---|---|
| BTC and Gold COMEX MOVE calibration | `lib/application/continuous-move-calibration.ts`: lookback **36h**, minimum **120** samples, horizons **15/30/60/120m**, alignment tolerance **60s**. `lib/application/continuous-move-detector.ts` queries from targetEnd − 36h − 2×horizon − 2×alignmentTolerance; bounded at **500 rows**. | **BREAKS current calibration** at a latest 120m horizon if oldest required samples are removed. Maximum theoretical query extent ~**40h 2m** backward (before session/lag considerations). |
| Cross-asset MOVE relationships | `lib/application/material-move-cross-asset-calibration.ts` pairs historical samples from BTC/Gold with ETH, DXY and peers; history query bounded and point-in-time-qualified. | Historical aligned companion points can disappear and coverage/confirmation becomes insufficient. |
| Event-window magnitude history | `lib/application/intraday-historical-calibration.ts` needs **36h** and minimum **30** samples for BTC/DXY/Gold; `lib/application/event-window-historical-context.ts` anchors lookback **before** each event PRE observation. | **May break replay of an older event**, even if data newer than current wall clock is abundant, because the evaluation uses a historical as-of cutoff. |
| BTC spot-flow factual explanation | `lib/application/move-evidence-bundle.ts` retrieves Binance completed 5m flow Evidence for the investigation interval, with retrievedAt cutoff and **100-row** bound. | Current-window MOVE stays supported if data HOT; **past MOVE replay loses original flow facts**. |
| General historical relationships, baseline, snapshots | `lib/application/historical-baseline.ts`, `lib/application/historical-relationship.ts`, Snapshot and material-move read models query durable Observation/Evidence; `lib/data/market-memory-store.ts` materializes immutable Snapshot observation/evidence IDs. | Raw points may be required beyond 72h; a summary cannot pretend to be an exact original point. |
| GDELT / macro and non-5m evidence | Separate source-native policies; not part of this 5m scope. | Must not be deleted by a broad age predicate. |

**Product tradeoff for owner:** either (A) preserve old raw 5m facts in an independently verified archive or protected canonical tier and support replay, **or** (B) formally retire arbitrary historical 5m MOVE replay in a separate normative contract / UI change, accepting explicit `UNAVAILABLE` old evidence. Neither decision was approved solely by asking to remove "yesterday's history".

## 3. Read-only production candidate inventory — exact SQL execution

Classification limited to these *known* 5m lanes by payload source and series/subject:
- **BTC_ETH_5M:** CoinGecko `btc.spot.usd`, `eth.spot.usd`, paired OBSERVATION and EVIDENCE.
- **GOLD_DXY_FX_5M:** Yahoo `gold.futures.usd` (COMEX GC=F **NOT verified spot XAU/USD**), `dxy.index.usd`, `fx.usdjpy.jpy_per_usd`, `fx.usdcnh.cnh_per_usd`, paired OBSERVATION and EVIDENCE.
- **BINANCE_SPOT_FLOW_5M:** Binance completed BTCUSDT 5m taker flow, EVIDENCE only.

No unqualified `LIKE '%BTC%'`, `record_type` blanket purge or provider expansion. Other series are excluded.

**Timestamp safety:** `captured_at` (durable write time), `effective_at` (semantic time), and `payload.retrievedAt` (what P365 could know) are treated **independently**. A row must be old on **all three** to enter the conservative age cohort; NULL/unparseable retrievedAt is excluded from old-on-all-three. This is a *necessary* filter only.

**Direct reference inventory:** Snapshot `observation_ids` and `evidence_ids` (including baseline refs as populated in `market-memory-store.ts`); Context `payload.observationIds`; Event and EventResult `payload.evidenceId`. Direct references are independently checked by canonical ID. **Not exhaustive:** Observation `payload.evidenceId`, transitive dependencies, alternate nested canonical references, revisions/invalidation/supersession, historical point-in-time reader requirements, external API consumers and future code still need explicit qualification. Thus the dry-run output labels the remainder `needs_indirect_lineage_review`, **never** `safe_to_delete`.

### 3.1 Raw readback table

Time: **2026-10-11 00:46:12 UTC**, source: production Supabase `execute_sql` using exact submitted companion SQL.

| HOT age | Family / record | Captured older rows | Old on all three clocks | Directly referenced older | Remaining for *review* | Old JSONB payload bytes |
|---|---|---:|---:|---:|---:|---:|
| 48h | Binance flow EVIDENCE | 1,301 | 1,301 | 0 | 1,301 | 1,791,378 |
| 48h | BTC/ETH EVIDENCE | 10,090 | 10,088 | 168 | 9,920 | 6,179,658 |
| 48h | BTC/ETH OBSERVATION | 9,946 | 9,946 | 178 | 9,768 | 12,397,009 |
| 48h | Gold/DXY/FX EVIDENCE | 11,634 | 11,634 | 192 | 11,442 | 7,832,623 |
| 48h | Gold/DXY/FX OBSERVATION | 10,139 | 10,139 | 190 | 9,949 | 13,196,824 |
| **48h TOTAL** | | **43,110** | **43,108** | **728** | **42,380** | **41,397,492** |
| 72h | Binance flow EVIDENCE | 1,013 | 1,013 | 0 | 1,013 | 1,394,610 |
| 72h | BTC/ETH EVIDENCE | 9,514 | 9,512 | 148 | 9,364 | 5,805,620 |
| 72h | BTC/ETH OBSERVATION | 9,370 | 9,370 | 158 | 9,212 | 11,656,809 |
| 72h | Gold/DXY/FX EVIDENCE | 10,511 | 10,511 | 172 | 10,339 | 7,011,317 |
| 72h | Gold/DXY/FX OBSERVATION | 9,016 | 9,016 | 170 | 8,846 | 11,673,918 |
| **72h TOTAL** | | **39,424** | **39,422** | **648** | **38,774** | **37,542,274** |

**Interpretation:** `38,774` is a **screening cohort requiring further lineage/replay review**, **not** a cleanup count. `37,542,274` bytes is `SUM(pg_column_size(payload))` for old-on-all-three-clock records, **not** physical reclaimable database bytes. Any count/disk forecast ignoring heap, TOAST, indexes, rows shared by Snapshot/revisions, MVCC, VACUUM, WAL, page allocation and append-only invariants is unsupported.

### 3.2 Dated capacity reference, not savings

At 2026-10-11 00:09 UTC, the database was **322,628,755 bytes**, Market Memory **282,992,640 bytes** with **81,313,792 bytes of indexes**, cron history **27,017,216 bytes**. Actual Supabase organization plan **FREE** confirmed via management API; published Free 500 MB database limit and 1 GB disk are not a byte-precise project-specific quota response. Source [#333](https://github.com/LDonthepath/P365/issues/333)/[PR #347](https://github.com/LDonthepath/P365/pull/347). Scenario central ~19d from short observed period. The retention cohort is not a proven amount of restored capacity or a way to guarantee another month of ingest.

## 4. Proposed owner policy — to freeze only after decision

| Tier | Preliminary eligibility | Operational rule and proof |
|---|---|---|
| **HOT 72h** | 5m BTC/ETH, Gold/DXY/FX and Binance flow source-native raw records | Preserve full sampled Observation+Evidence while they support 36h calibrations and max 120m horizon. Keep source retrievedAt and physical write time distinct. Late arrivals, stale source windows, sessions and gaps are not silently filled. |
| **PROTECTED indefinitely until lineage-resolved** | Every referenced Snapshot/Baseline/Event/Context Observation/Evidence; versions, revisions, invalidations, supersession, exact historical as-of reconstruction; missing/unknown legacy clocks | Fail closed to PROTECTED if provenance/lineage cannot be decided. Immutable canonical IDs. No automatic deletion. |
| **ARCHIVAL CANDIDATE** | Older than HOT on all three clocks, unreferenced in **all** verified graphs, and no documented replay consumer remaining | Owner must choose a real retrievable archive (with schema/version/hash/clock fidelity, verified restoration and cost) **or** explicitly accept loss of fine-grained historical replay. New backend/provider/storage dependency requires separate approval. |
| **EXCLUDED** | Macro release history, slow fundamentals, snapshots, news/catalyst, unknown source, noncanonical cron logs | Governed independently; do not mix with this retention action. |

**48h alternative:** ~7h58m larger margin than the MOVE-001B theoretical 40h02 query reach; however 48h is less robust to clock/source lateness and cannot preserve historical arbitrary-as-of replay. **72h** is the recommended safer first boundary pending tests. Neither solves historical replay by itself.

## 5. Mandatory post-audit implementation gates — NOT authorized by this PR

1. Freeze explicit product decision regarding arbitrary historical MOVE/event replay, and data loss versus qualified archive. Record owner approval separately for any exception to append-only canonical governance. Historical revision and Snapshot links must remain resolvable.
2. Build a COMPLETE reference graph beyond four direct paths (Observation evidence links, Evidence content, correction/supersession, Snapshot baseline refs, cross-series, old vs recent pair dependencies). Prove protected records cannot be orphaned; unknown references must fail closed. Build deterministic selection with allowlisted `sourceId/seriesKey/kind`, bounded batch, strict old-on-all-clocks, legal/entitlement verification.
3. Establish restore and read contract: original source ID, observed/released/retrieved/captured timestamps, semantic identity, evidence hash, version, linkage; if archive is selected, **successfully restore and replay** an old event and MOVE before touching production. No fabricated point-in-time knowledge or silent fallback to summaries.
4. Run **staging** 48/72h experiments with as-of fixtures from today/yesterday/old event and 15/30/60/120m MOVE; compare factual results, 120-sample and 30-sample completeness, historical materiality thresholds, cross-asset coherence, Binance/GDELT context, Snapshot lookup and correction chains. Fail closed on any unapproved output drift.
5. Independently measure staging physical capacity before/after with `pg_database_size`, `pg_total_relation_size`, index/heap/TOAST/WAL/bloat and pg_stat activity. PostgreSQL `DELETE` does not guarantee disk byte reclamation; `VACUUM FULL`/REINDEX are locking/destructive maintenance requiring distinct impact approval. Project remains on Free, avoid risking transient disk overage.
6. Implement only under a separate issue/PR, with dry-run counts and untouched canonical backups, explicit owner approval for SQL/DML & cron activation, defensible finite batch and hard stop. Verify production next natural scheduled cycles and 3–7 day size/write changes. No self-merge or unsupervised execution.
7. If operator wants immediate relief, prioritize *new noncritical-write avoidance* under a separately verified producer-specific issue. Existing #235 cron retention already enabled; changing it again may create little physical headroom.

## 6. Exact reproduction & quality gate

`scripts/ops/ops_ret_001a_readonly_dryrun.sql` is deliberately composed of **SELECT-only SQL**. Supabase live connector executed its exact contents and returned the ten per-family/horizon rows above at 00:46:12 UTC without mutation. Re-executing will produce different counts as fresh ingestion continues. No public source/provider calls, cron invocations, database migrations or changes to application code. GitHub full-project G0 CI is required on the PR HEAD; report PASS/FAIL only when independently observed.

**Closure conditions for #350:** owner reviews and merges evidence/contract PR, proves actual merged SHA and CI, explicitly chooses future retention boundary and replay/archive policy with all exceptions and dependencies documented. **Audit completion does not equal permission to DELETE**. A separate implementation issue is required for physical retention and operational activation.

## 7. Current dependent work

- [#333](https://github.com/LDonthepath/P365/issues/333) and draft [PR #347](https://github.com/LDonthepath/P365/pull/347): measured Free capacity and quota readback still pending.
- [#348](https://github.com/LDonthepath/P365/issues/348) and [PR #349](https://github.com/LDonthepath/P365/pull/349): measured early-warning telemetry, **not** retention or capacity savings.
- [#228](https://github.com/LDonthepath/P365/issues/228): operational retention tracker; already active #235 cron history cleanup is distinct.
- [#283](https://github.com/LDonthepath/P365/issues/283): P365 Recovery roadmap.
