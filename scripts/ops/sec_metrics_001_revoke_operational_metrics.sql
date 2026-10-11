-- SEC-METRICS-001 / RECOVERY-G5-01 / Issue #310
-- OWNER-REVIEWED PRODUCTION MIGRATION CANDIDATE. NOT YET APPLIED.
-- Target: Supabase public.p365_operational_metrics ONLY.
-- Apply once, after owner authorization, using Supabase apply_migration.
-- Supabase migration executor owns the transaction. Fail closed on drift.
-- Do not modify routines, RLS, cron, canonical Market Memory, or service_role.

DO $preflight$
DECLARE
  p text;
  r text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid = 'public.p365_operational_metrics'::regclass
      AND c.relkind IN ('r', 'p')
      AND pg_get_userbyid(c.relowner) = 'postgres'
      AND c.relrowsecurity IS TRUE
      AND c.relforcerowsecurity IS FALSE
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001: table identity, ownership or RLS drift';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='p365_operational_metrics'
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001: unexpected policy; inspect before revoke';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.p365_operational_metrics'::regclass
      AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001: column ACL drift';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
    CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid='public.p365_operational_metrics'::regclass
      AND x.grantee=0
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001: unexpected PUBLIC grant; rollback would not restore it';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','postgres'] LOOP
    FOREACH p IN ARRAY ARRAY[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF NOT has_table_privilege(r,'public.p365_operational_metrics',p) THEN
        RAISE EXCEPTION 'SEC-METRICS-001: baseline privilege drift %.%',r,p;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname='p365-storage-daily' AND active IS TRUE
      AND username='postgres' AND schedule='15 0 * * *'
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001: storage cron identity drift';
  END IF;
END
$preflight$;

SET LOCAL lock_timeout = '3s';

-- RLS does NOT restrict TRUNCATE. Remove all 7 unnecessary table privileges.
-- No function EXECUTE or schema privileges are changed.
REVOKE ALL PRIVILEGES ON TABLE public.p365_operational_metrics
  FROM PUBLIC, anon, authenticated;

DO $postflight$
DECLARE
  p text;
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH p IN ARRAY ARRAY[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF has_table_privilege(r,'public.p365_operational_metrics',p) THEN
        RAISE EXCEPTION 'SEC-METRICS-001: public role still granted %.%',r,p;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['service_role','postgres'] LOOP
    FOREACH p IN ARRAY ARRAY[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] LOOP
      IF NOT has_table_privilege(r,'public.p365_operational_metrics',p) THEN
        RAISE EXCEPTION 'SEC-METRICS-001: authorized role lost %.%',r,p;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.p365_operational_metrics'::regclass
      AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SEC-METRICS-001: unexpected column grant';
  END IF;
END
$postflight$;
