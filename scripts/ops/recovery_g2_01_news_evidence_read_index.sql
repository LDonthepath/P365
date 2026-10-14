-- RECOVERY-G2-01 / issue #302: durable NEWS Evidence read latency.
--
-- OWNER REVIEW GATE: this file is an installation/verification recipe only.
-- Merging this file MUST NOT auto-execute production DDL.
-- Do NOT execute until owner approves the actual storage/WAL headroom,
-- operational window and rollback for the production Supabase project.
--
-- Evidence at 2026-10-13 (production logs / SQL EXPLAIN):
-- PostgREST GET /rest/v1/market_memory filters record_type=EVIDENCE,
-- payload->>sourceId=(coindesk-rss | alpha-vantage), payload->>kind=NEWS,
-- orders effective_at DESC,id DESC and requests limit=250,offset=0.
-- Both queries returned 57014/HTTP 500 during dashboard GETs. Query ID:
-- -1526030249716581395. The planner used idx_market_memory_record_type,
-- filtered JSON expressions and sorted, estimated cost ~28169.
-- The existing Observation indexes do not accelerate this Evidence query.
--
-- This additive B-tree index matches the CURRENT PostgREST predicate and
-- total order. All three equality columns precede the order columns.
-- It indexes all record types (rather than a partial EVIDENCE-only predicate)
-- because PostgREST parameterized queries may choose a generic plan that
-- cannot prove a partial-index predicate from bind parameters. Do not
-- substitute a partial index without real PostgREST plan verification.
-- No data updates, retention changes, API grants, RLS changes, RPCs, cron,
-- new provider/feature, response ordering or point-in-time changes.
--
-- BEFORE ACTIVATE (read-only, record in issue):
--   1. Check current DB/free-plan disk/WAL headroom; record existing
--      total relation/index bytes and capacity watch outcome.
--   2. Confirm the exact query and PostgREST credentials against logs.
--   3. Capture read-only EXPLAIN plan and fixed-cutoff historical results
--      for both sources, including zero rows, revision/tie/offset cases.
--   4. Verify that this index name does not exist or is not INVALID.
--   5. Acquire explicit production DDL approval from the owner.
--
-- INSTALL: execute ONLY the following statement as a standalone top-level
-- SQL statement (NOT inside BEGIN/COMMIT, a migration transaction or a
-- multi-statement runner). Concurrent creation limits write blocking but
-- still consumes storage, CPU and I/O. Stop on ERROR/INVALID.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_memory_evidence_source_kind_effective_v1
ON public.market_memory (
  record_type,
  ((payload ->> 'sourceId')),
  ((payload ->> 'kind')),
  effective_at DESC,
  id DESC
);

-- AFTER INSTALL (read-only SQL, separate execution):
-- SELECT i.relname, ix.indisready, ix.indisvalid,
--        pg_size_pretty(pg_relation_size(i.oid)) AS index_size
-- FROM pg_class i
-- JOIN pg_index ix ON ix.indexrelid=i.oid
-- WHERE i.oid='public.idx_market_memory_evidence_source_kind_effective_v1'::regclass;
--
-- EXPLAIN (FORMAT JSON, COSTS TRUE)
-- SELECT id,effective_at,payload FROM public.market_memory
-- WHERE record_type='EVIDENCE'
--   AND payload->>'sourceId'='coindesk-rss'
--   AND payload->>'kind'='NEWS'
-- ORDER BY effective_at DESC,id DESC LIMIT 250 OFFSET 0;
--
-- Repeat EXPLAIN for alpha-vantage; verify that PostgREST's actual
-- parameterized service-role query also selects the new index, not just a
-- hand-written literal SQL. EXPLAIN cost estimates are not timing evidence.
--
-- Confirm exact SQL row identity/order parity for fixed point-in-time
-- cutoffs: the repository still filters canonical retrievedAt after paging,
-- so do not add an ad-hoc effective_at cutoff, reduce page size, or assume
-- a new ordering. Run bounded comparable production GETs AFTER merge and
-- approved activation, and inspect PostgREST/PG 57014, server NEWS quality,
-- SSR and request latency. Do not close #302 on index creation alone.
--
-- ROLLBACK (separate owner-approved, standalone, non-transactional DDL):
-- DROP INDEX CONCURRENTLY IF EXISTS
--   public.idx_market_memory_evidence_source_kind_effective_v1;
-- Do not automatically execute rollback or delete canonical rows.
