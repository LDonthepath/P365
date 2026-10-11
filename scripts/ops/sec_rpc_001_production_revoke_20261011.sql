-- SEC-RPC-001 / Issue #330
-- HISTORICAL SOURCE OF APPLIED PRODUCTION MIGRATION. DO NOT RE-RUN BLINDLY.
-- Supabase project: orwhuzexnuochctccqvl
-- Applied 2026-10-11 02:13:32 UTC via Supabase migration API.
-- Migration version: 20261011021332
-- Migration name: sec_rpc_001_revoke_legacy_rpc_execute_20261011
-- Exact source SQL as submitted to the Supabase migration action.
-- The migration runner manages its own transaction; this file is a review receipt.
-- Before state: anon/authenticated/service_role EXECUTE = true/true/true.
-- Confirmed after state: false/false/true for all three exact signatures.
-- For conditional rollback, see docs/P365-SEC-RPC-001-LEGACY-EXECUTE-AUDIT-2026-10-11.md.
DO $pre$
DECLARE matching integer;
BEGIN
 SELECT count(*) INTO matching FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
 AND p.oid IN (
 'public.append_market_memory(text,text,text,timestamp with time zone,timestamp with time zone,jsonb,text[],text[],text[],text,text)'::regprocedure,
 'public.calculate_oms_and_save(double precision,double precision,double precision,double precision,double precision)'::regprocedure,
 'public.process_market_snapshot(numeric,numeric,numeric,numeric)'::regprocedure)
 AND p.prosecdef=false AND p.proowner='postgres'::regrole
 AND has_function_privilege('anon',p.oid,'EXECUTE')
 AND has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND has_function_privilege('service_role',p.oid,'EXECUTE');
 IF matching <> 3 THEN
   RAISE EXCEPTION 'SEC-RPC-001 preflight privilege/identity drift, aborting';
 END IF;
END $pre$;
SET LOCAL lock_timeout = '3s';
REVOKE EXECUTE ON FUNCTION public.append_market_memory(
  text,text,text,timestamp with time zone,timestamp with time zone,jsonb,
  text[],text[],text[],text,text
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_oms_and_save(
  double precision,double precision,double precision,double precision,double precision
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_market_snapshot(
  numeric,numeric,numeric,numeric
) FROM PUBLIC, anon, authenticated;
DO $post$
DECLARE matching integer;
BEGIN
 SELECT count(*) INTO matching FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
 AND p.oid IN (
 'public.append_market_memory(text,text,text,timestamp with time zone,timestamp with time zone,jsonb,text[],text[],text[],text,text)'::regprocedure,
 'public.calculate_oms_and_save(double precision,double precision,double precision,double precision,double precision)'::regprocedure,
 'public.process_market_snapshot(numeric,numeric,numeric,numeric)'::regprocedure)
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND has_function_privilege('service_role',p.oid,'EXECUTE')
 AND has_function_privilege('postgres',p.oid,'EXECUTE');
 IF matching <> 3 THEN RAISE EXCEPTION 'SEC-RPC-001 postflight role rights invalid, aborting'; END IF;
END $post$;
