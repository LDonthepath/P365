-- SEC-RPC-001 (#330): Production READ-ONLY legacy RPC access inventory.
-- Execute separately or as a SELECT-only script. Never invoke the named RPCs.
-- No DDL/DML or role changes. Supabase project orwhuzexnuochctccqvl.
-- Actual REST exposed-schema/HTTP route visibility must be proven separately.

-- 1. Exact signature, owner, SECURITY INVOKER/DEFINER, individual ACLs and
--    EFFECTIVE EXECUTE privileges (PUBLIC grants included by PostgreSQL).
SELECT
  now() AS read_at,
  n.nspname AS schema_name,
  p.proname AS routine,
  p.oid::regprocedure::text AS signature,
  pg_get_function_result(p.oid) AS result_type,
  pg_get_userbyid(p.proowner) AS function_owner,
  CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security_mode,
  p.proconfig AS function_config,
  p.proacl::text AS acl,
  has_schema_privilege('anon', n.nspname, 'USAGE') AS anon_schema_usage,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  has_function_privilege('postgres', p.oid, 'EXECUTE') AS postgres_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'append_market_memory', 'calculate_oms_and_save', 'process_market_snapshot'
  )
ORDER BY p.proname, p.oid::regprocedure::text;

-- 2. Underlying canonical and legacy relations, role ACL and RLS.
SELECT
  n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
  c.relacl::text AS acl,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
  has_table_privilege('service_role', c.oid, 'SELECT') AS service_select,
  has_table_privilege('service_role', c.oid, 'INSERT') AS service_insert,
  (SELECT count(*) FROM pg_policies pol
    WHERE pol.schemaname = n.nspname AND pol.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('market_memory', 'market_snapshots')
  AND c.relkind IN ('r', 'p')
ORDER BY n.nspname, c.relname;

SELECT to_regclass('public.market_snapshots')::text AS legacy_snapshots,
       to_regclass('public.market_memory')::text AS canonical_memory;

-- 3. Other DB routine/trigger references. Text scan is not a dependency DAG.
SELECT n.nspname, p.proname, p.oid::regprocedure::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f'
  AND p.proname NOT IN (
    'append_market_memory', 'calculate_oms_and_save', 'process_market_snapshot'
  )
  AND (
    pg_get_functiondef(p.oid) ILIKE '%append_market_memory%'
    OR pg_get_functiondef(p.oid) ILIKE '%calculate_oms_and_save%'
    OR pg_get_functiondef(p.oid) ILIKE '%process_market_snapshot%'
  )
ORDER BY 1, 2;

SELECT n.nspname, c.relname, t.tgname, t.tgenabled, p.proname AS handler
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND p.proname IN (
  'append_market_memory', 'calculate_oms_and_save', 'process_market_snapshot'
)
ORDER BY 1, 2;

-- 4. Cron reference check (if current SQL role has cron.job SELECT).
SELECT jobid, jobname, active,
  command ILIKE '%append_market_memory%' AS references_append,
  command ILIKE '%calculate_oms_and_save%' AS references_oms,
  command ILIKE '%process_market_snapshot%' AS references_snapshot
FROM cron.job ORDER BY jobid;

-- 5. Note: no pgrst.* GUC rows does NOT prove whether public is an exposed schema.
SELECT name, setting, source FROM pg_settings
WHERE name LIKE '%pgrst%' OR name LIKE '%db_schemas%'
ORDER BY name;
