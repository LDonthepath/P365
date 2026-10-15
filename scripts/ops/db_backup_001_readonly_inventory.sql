-- DB-BACKUP-001 / Issue #331 — SELECT-only Market Memory recovery inventory.
-- Read-only. Safe for production BEFORE export and for an isolated restored copy AFTER export.
-- Never run a TRUNCATE, DELETE, UPDATE, restore or cron endpoint for inventory.
-- Run every SELECT; retain only aggregates/schema metadata, never canonical JSON payloads.
-- IMPORTANT: independent invocations are NOT a single consistent pg_dump snapshot.
-- Do not equate this live count with a dump taken at a different instant.

SELECT now() AT TIME ZONE 'UTC' AS checked_at_utc,
       current_database() AS database_name,
       current_setting('server_version') AS postgres_version,
       pg_database_size(current_database()) AS database_bytes,
       pg_total_relation_size('public.market_memory'::regclass) AS market_memory_total_bytes;

SELECT record_type, count(*) AS physical_rows,
       min(captured_at) AS oldest_capture_utc,
       max(captured_at) AS newest_capture_utc
FROM public.market_memory
GROUP BY record_type
ORDER BY record_type;

SELECT c.relname, c.relrowsecurity AS rls_enabled,
       pg_total_relation_size(c.oid) AS total_bytes,
       c.relacl::text AS grants,
       has_table_privilege('service_role',c.oid,'SELECT') AS service_select,
       has_table_privilege('service_role',c.oid,'INSERT') AS service_insert,
       has_table_privilege('service_role',c.oid,'DELETE') AS service_delete,
       has_table_privilege('service_role',c.oid,'TRUNCATE') AS service_truncate,
       has_table_privilege('anon',c.oid,'TRUNCATE') AS anon_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
  AND c.relname IN ('market_memory','p365_fred_revision_gate','p365_fred_revision_heads')
ORDER BY c.relname;

SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE t.tgrelid='public.market_memory'::regclass AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT conname,contype,convalidated,pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint WHERE conrelid='public.market_memory'::regclass
ORDER BY conname;

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='market_memory' ORDER BY indexname;

SELECT count(*) AS physical_rows,
       count(DISTINCT dedupe_key) AS distinct_dedupe_keys,
       count(*) FILTER (WHERE dedupe_key IS NULL) AS missing_dedupe,
       count(*) FILTER (WHERE captured_at IS NULL) AS missing_capture,
       count(*) FILTER (WHERE payload IS NULL) AS missing_payload
FROM public.market_memory;

SELECT count(*) FILTER (WHERE m.supersedes_id IS NOT NULL) AS supersession_links,
       count(*) FILTER (WHERE m.invalidates_id IS NOT NULL) AS invalidation_links,
       count(*) FILTER (WHERE m.supersedes_id IS NOT NULL AND s.id IS NULL) AS dangling_supersession,
       count(*) FILTER (WHERE m.invalidates_id IS NOT NULL AND i.id IS NULL) AS dangling_invalidation
FROM public.market_memory m
LEFT JOIN public.market_memory s ON s.id=m.supersedes_id
LEFT JOIN public.market_memory i ON i.id=m.invalidates_id;

SELECT 'p365_fred_revision_gate' AS table_name, count(*) AS physical_rows FROM public.p365_fred_revision_gate
UNION ALL
SELECT 'p365_fred_revision_heads',count(*) FROM public.p365_fred_revision_heads;

SELECT extname, extversion FROM pg_extension ORDER BY extname;
