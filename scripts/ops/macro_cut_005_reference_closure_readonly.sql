-- MACRO-CUT-005 / follow-up to owner-merged #456. READ ONLY.
-- Purpose: make the 9 nonmacro source families exportable as exact physical IDs,
-- and quantify reference retention BEFORE any owner-authorized cleanup.
-- Database: production public.market_memory. Does not bypass append-only.
-- IMPORTANT: not a DELETE allow-list. UNLINKED_IN_KNOWN_PATHS is NOT proven safe
-- until payload-level/revision closure and verified offsite recovery are complete.
--
-- Snapshot and Context must be preserved. Effective source MUST use COALESCE
-- because the physical source_id column is NULL for the vast majority of rows.
--
-- 1) Recompute candidates vs direct references from all retained rows.
WITH candidate_sources(source) AS (VALUES
    ('alpha-vantage'),
    ('alpha-vantage-market'),
    ('binance-spot'),
    ('cftc-gold-cot'),
    ('coindesk'),
    ('coingecko-market'),
    ('defillama-stablecoins'),
    ('sosovalue-etf-flow'),
    ('yahoo-finance')
), candidate AS (
  SELECT m.id, m.record_type, m.canonical_id, m.captured_at,
         COALESCE(m.source_id,m.payload->>'sourceId') AS effective_source,
         m.supersedes_id,m.invalidates_id
    FROM public.market_memory AS m
   WHERE COALESCE(m.source_id,m.payload->>'sourceId') IN
         (SELECT source FROM candidate_sources)
), retained AS (
  SELECT m.* FROM public.market_memory AS m
   WHERE COALESCE(m.source_id,m.payload->>'sourceId','<unattributed>') NOT IN
         (SELECT source FROM candidate_sources)
), typed_refs AS (
  SELECT 'OBSERVATION'::text AS target_type, unnest(observation_ids) AS canonical_ref
    FROM retained WHERE cardinality(observation_ids)>0
  UNION ALL
  SELECT 'EVIDENCE', unnest(evidence_ids)
    FROM retained WHERE cardinality(evidence_ids)>0
  UNION ALL
  SELECT 'EVENT', unnest(event_ids)
    FROM retained WHERE cardinality(event_ids)>0
  UNION ALL
  SELECT 'OBSERVATION', value
    FROM retained r CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(r.payload->'observationIds')='array'
              THEN r.payload->'observationIds' ELSE '[]'::jsonb END) AS q(value)
  UNION ALL
  SELECT 'EVIDENCE', value
    FROM retained r CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(r.payload->'evidenceIds')='array'
              THEN r.payload->'evidenceIds' ELSE '[]'::jsonb END) AS q(value)
  UNION ALL
  SELECT 'EVENT', value
    FROM retained r CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(r.payload->'eventIds')='array'
              THEN r.payload->'eventIds' ELSE '[]'::jsonb END) AS q(value)
  UNION ALL
  SELECT 'OBSERVATION', r.payload->>'observationId'
    FROM retained r WHERE r.payload ? 'observationId'
  UNION ALL
  SELECT 'EVIDENCE', r.payload->>'evidenceId'
    FROM retained r WHERE r.payload ? 'evidenceId'
), linked_candidate_ids AS (
  SELECT DISTINCT c.id
    FROM candidate c JOIN typed_refs r
      ON r.target_type=c.record_type AND r.canonical_ref=c.canonical_id
  UNION
  SELECT DISTINCT c.id
    FROM candidate c JOIN retained r
      ON c.id=r.supersedes_id OR c.id=r.invalidates_id
)
SELECT now() AS inspected_utc, c.effective_source, c.record_type,
       count(*) AS candidate_rows,
       count(*) FILTER(WHERE l.id IS NOT NULL) AS archival_preserve_direct_refs,
       count(*) FILTER(WHERE l.id IS NULL) AS unlinked_in_known_paths_review,
       count(*) FILTER(WHERE c.supersedes_id IS NOT NULL
                            OR c.invalidates_id IS NOT NULL) AS candidate_revision_edges,
       min(c.captured_at) AS min_captured_at,
       max(c.captured_at) AS max_captured_at
  FROM candidate c LEFT JOIN linked_candidate_ids l ON l.id=c.id
 GROUP BY c.effective_source,c.record_type
 ORDER BY c.effective_source,c.record_type;

-- 2) Exact physical ID source manifest for an OFFLINE export by the operator.
-- The result is NOT an authorized deletion set. Export privately (not to git,
-- dashboard, issues or a public bucket) with identity/hash and row type intact.
SELECT m.id, m.record_type, m.canonical_id,
       COALESCE(m.source_id,m.payload->>'sourceId') AS effective_source,
       m.captured_at,m.dedupe_key,m.payload_hash,m.supersedes_id,m.invalidates_id
  FROM public.market_memory AS m
 WHERE COALESCE(m.source_id,m.payload->>'sourceId') IN (
    'alpha-vantage',
    'alpha-vantage-market',
    'binance-spot',
    'cftc-gold-cot',
    'coindesk',
    'coingecko-market',
    'defillama-stablecoins',
    'sosovalue-etf-flow',
    'yahoo-finance')
 ORDER BY effective_source,record_type,m.id;

-- 3) Fatal operator gates; require PASS before advancing to a SEPARATELY
-- reviewed physical purge transaction. PASS here does not itself prove closure.
SELECT CASE WHEN count(*)=1 AND bool_and(tgenabled='O')
            THEN 'PASS_APPEND_ONLY_ACTIVE' ELSE 'STOP_APPEND_ONLY_DRIFT' END AS trigger_gate
  FROM pg_trigger
 WHERE tgrelid='public.market_memory'::regclass
   AND tgname='market_memory_append_only' AND NOT tgisinternal;

SELECT CASE WHEN count(*)=7
                AND bool_and(CASE WHEN jobid=3 THEN NOT active ELSE active END)
            THEN 'PASS_RETAINED_CRON' ELSE 'STOP_RETAINED_CRON_DRIFT' END AS cron_gate
  FROM cron.job WHERE jobid IN (2,3,5,6,23,24,25);

SELECT CASE WHEN count(*)=0 THEN 'PASS_NO_RETIRED_JOBS'
            ELSE 'STOP_RETIRED_CRON_DRIFT' END AS retired_cron_gate
  FROM cron.job WHERE jobid IN (4,10,15,20);

-- Next destructive operation is INTENTIONALLY NOT INCLUDED.
-- Before authoring it: evidence of complete encrypted offsite pg_dump -Fc,
-- SHA-256 and isolated full restore; closed typed/payload/physical revision
-- reference graph; exact-ID archive+restore plan; storage/lock budget;
-- zero orphan diff; owner-authorized protected-prefix exclusion and post-checks.
