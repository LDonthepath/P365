-- SEC-METRICS-001 / #310 — PRODUCTION READ-ONLY INVENTORY AND POST-MERGE CHECK.
-- SELECT-only; safe before/after approval. No ALTER/GRANT/REVOKE/job invocation.
-- Expected BEFORE: anon/authenticated 7/7 true; service_role/postgres 7/7 true.
-- Expected AFTER:  anon/authenticated 0/7 true; service_role/postgres 7/7 true.
SELECT now() AS verified_at, roles.role_name, privilege_names.privilege,
       has_table_privilege(roles.role_name,
         'public.p365_operational_metrics',privilege_names.privilege) AS effective_granted,
       CASE WHEN roles.role_name IN ('anon','authenticated')
         THEN NOT has_table_privilege(roles.role_name,
           'public.p365_operational_metrics',privilege_names.privilege)
         ELSE has_table_privilege(roles.role_name,
           'public.p365_operational_metrics',privilege_names.privilege)
       END AS matches_hardened_target
FROM (VALUES ('anon'),('authenticated'),('service_role'),('postgres'))
  roles(role_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
   ('TRUNCATE'),('REFERENCES'),('TRIGGER')) privilege_names(privilege)
ORDER BY roles.role_name,privilege_names.privilege;

-- RLS/policies, grants and column ACL regression checks.
SELECT pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       c.relacl::text AS direct_acl,
       (SELECT count(*) FROM pg_policies p
        WHERE p.schemaname='public'
          AND p.tablename='p365_operational_metrics') AS policy_count,
       (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid=c.oid AND a.attnum>0
          AND NOT a.attisdropped AND a.attacl IS NOT NULL) AS column_acl_count
FROM pg_class c
WHERE c.oid='public.p365_operational_metrics'::regclass;

-- Storage cron identity; no cron.schedule, alter_job, or manual execution.
SELECT jobid,jobname,username,active,schedule
FROM cron.job
WHERE jobname='p365-storage-daily';

-- Use a natural subsequent scheduled run to prove actual persistence:
SELECT count(*) AS storage_snapshots,
       max(occurred_at) AS latest_storage_snapshot_utc
FROM public.p365_operational_metrics
WHERE metric_type='STORAGE_CAPACITY';
