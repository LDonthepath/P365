-- MACRO-CUT-FINAL 2026-10-15 — SELECT ONLY post-merge/source-integrity verification.
-- Product snapshots in old asset-based contract were intentionally deleted.
-- This script never writes to Market Memory, cron or any production table.
SELECT now() AS checked_at, count(*) AS physical_rows,
       pg_size_pretty(pg_database_size(current_database())) AS database_size,
       pg_size_pretty(pg_total_relation_size('public.market_memory')) AS market_memory_size
FROM public.market_memory;

SELECT CASE WHEN count(*)=0 THEN 'PASS_NO_NONMACRO_HISTORY'
            ELSE 'STOP_NONMACRO_ROWS_PRESENT' END AS source_guard
FROM public.market_memory
WHERE COALESCE(source_id, payload->>'sourceId') IN (
 'alpha-vantage','alpha-vantage-market','binance-spot',
 'cftc-gold-cot','coindesk','coingecko-market','defillama-stablecoins',
 'sosovalue-etf-flow','yahoo-finance','SYSTEM');

SELECT CASE WHEN count(*) FILTER(WHERE record_type='SNAPSHOT')=0
                 AND count(*) FILTER(WHERE record_type='CONTEXT' AND payload->>'scope'='CRYPTO_MARKET')=0
                 AND count(*) FILTER(WHERE record_type='CONTEXT')=152
            THEN 'PASS_RETAINED_MACRO_CONTEXTS'
            ELSE 'STOP_CONTEXT_SNAPSHOT_DRIFT' END AS context_guard
FROM public.market_memory;

SELECT CASE WHEN count(*)=1 AND bool_and(NOT active)
           AND bool_and(md5(command)='a43bff4ef2df2e3d6c4f4f234e78b1ba')
            THEN 'PASS_SNAPSHOT_JOB_PAUSED'
            ELSE 'STOP_SNAPSHOT_JOB_REACTIVATED' END AS snapshot_cron_guard
FROM cron.job WHERE jobid=6;

SELECT CASE WHEN count(*)=6 AND bool_and(
             CASE WHEN jobid=3 THEN NOT active ELSE active END)
            THEN 'PASS_PROTECTED_MACRO_CRON' ELSE 'STOP_PROTECTED_CRON_DRIFT'
       END AS protected_cron_guard
FROM cron.job WHERE jobid IN (2,3,5,23,24,25);

SELECT CASE WHEN count(*)=0 THEN 'PASS_RETIRED_CRON_ABSENT'
            ELSE 'STOP_RETIRED_CRON_RETURNED' END AS retired_jobs_guard
FROM cron.job WHERE jobid IN (4,10,15,20);

SELECT CASE WHEN count(*)=0 THEN 'PASS_RETIRED_CRON_LOGS_ABSENT'
            ELSE 'STOP_RETIRED_LOGS_REMAIN' END AS retired_runlog_guard
FROM cron.job_run_details WHERE jobid IN (4,10,15,20);

SELECT CASE WHEN to_regclass('p365_ops.macro_cut_004_cron_rollback') IS NULL
              AND to_regclass('p365_ops.macro_cut_005_archive_seven_sources') IS NULL
            THEN 'PASS_NO_INTERNAL_CLEANUP_ARCHIVES'
            ELSE 'STOP_CLEANUP_ARCHIVE_PRESENT' END AS private_archive_guard;

SELECT CASE WHEN count(*)=3 AND bool_and(tgenabled='O')
            THEN 'PASS_CANONICAL_WRITE_TRIGGERS'
            ELSE 'STOP_CANONICAL_TRIGGER_DRIFT' END AS canonical_integrity_guard
FROM pg_trigger WHERE tgrelid='public.market_memory'::regclass
 AND tgname IN ('market_memory_append_only','market_memory_dedupe_key',
                'p365_fred_revision_writer_guard') AND NOT tgisinternal;

SELECT COALESCE(source_id,payload->>'sourceId','<unattributed>') AS effective_source,
 record_type,count(*) AS physical_rows
FROM public.market_memory GROUP BY 1,2 ORDER BY 1,2;
