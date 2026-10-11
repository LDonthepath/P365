-- DB-BACKUP-001 / #331: SELECT-only Neon PostgreSQL sample restore verification.
-- Target: project snowy-flower-79929352, branch br-cold-hill-b3vq6nhq
-- NEVER treat the result as a whole-database restore or proof of an off-site backup.
-- Execute only on the explicitly identified Neon drill branch.
-- The expected manifest was calculated over exactly the 18 production-selected
-- rows in one Supabase SELECT snapshot, not over the full Market Memory dataset.
-- This script outputs only checksums, counts, and schema/role metadata.

SELECT current_database() AS database_name,
       current_setting('server_version') AS postgres_version,
       now() AT TIME ZONE 'UTC' AS checked_at_utc,
       (SELECT count(*) FROM pg_tables WHERE schemaname='recovery_drill_331') AS drill_tables;

SELECT count(*) AS restored_rows,
       count(DISTINCT dedupe_key) AS distinct_dedupe_keys,
       count(*) FILTER (WHERE payload IS NULL OR captured_at IS NULL OR dedupe_key IS NULL) AS missing_essentials,
       md5(string_agg(
          id::text || '|' || dedupe_key || '|' || md5(payload::text),
          '~' ORDER BY id::text
       )) AS restored_manifest,
       md5(string_agg(
          id::text || '|' || dedupe_key || '|' || md5(payload::text),
          '~' ORDER BY id::text
       )) = '4ae05653b21de0ef79d472f54b220987' AS matches_export_manifest
FROM recovery_drill_331.market_memory_sample;

SELECT record_type, count(*) AS restored_rows,
       min(captured_at) AS earliest_capture_utc,
       max(captured_at) AS latest_capture_utc
FROM recovery_drill_331.market_memory_sample
GROUP BY record_type ORDER BY record_type;

-- Event and Observation payloads have retrievedAt; for other families
-- use SQL captured_at as the availability bound, never effective_at.
SELECT cutoff::timestamptz AS cutoff_utc, count(m.id) AS eligible_rows
FROM (VALUES
 ('2026-10-08T10:00:00Z'),
 ('2026-10-09T10:00:00Z'),
 ('2026-10-11T02:55:00Z'),
 ('2026-10-11T03:00:00Z')
) AS cutoffs(cutoff)
LEFT JOIN recovery_drill_331.market_memory_sample m
 ON m.captured_at <= cutoffs.cutoff::timestamptz
 AND COALESCE(
    NULLIF(m.payload->>'retrievedAt','')::timestamptz,
    m.captured_at
 ) <= cutoffs.cutoff::timestamptz
GROUP BY cutoff ORDER BY cutoff;

SELECT singleton, enforced, epoch, updated_at
FROM recovery_drill_331.fred_revision_gate;

SELECT count(*) AS fred_revision_heads FROM recovery_drill_331.fred_revision_heads;

SELECT conname, contype, convalidated
FROM pg_constraint
WHERE conrelid='recovery_drill_331.market_memory_sample'::regclass
ORDER BY conname;

SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS trigger_def
FROM pg_trigger
WHERE tgrelid='recovery_drill_331.market_memory_sample'::regclass
 AND NOT tgisinternal;

SELECT n.nspname,
       (SELECT count(*) FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
        WHERE a.grantee=0 AND a.privilege_type IN ('USAGE','CREATE')) AS public_schema_grants
FROM pg_namespace n WHERE n.nspname='recovery_drill_331';
