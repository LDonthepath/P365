-- SEC-001 — Harden public.rls_auto_enable() direct execution
--
-- Purpose:
--   Prevent anon/authenticated callers from invoking the SECURITY DEFINER
--   event-trigger helper directly through exposed RPC surfaces.
--
-- Boundary:
--   * Keep event trigger "ensure_rls" active.
--   * Keep function owner = postgres.
--   * Keep existing search_path = pg_catalog.
--   * Keep service_role direct EXECUTE grant.
--   * No RLS policy, table, provider, scheduler, or Market Memory changes.
--
-- Precondition verified on 5 Oct 2026:
--   proacl included PUBLIC, anon, authenticated, service_role, postgres EXECUTE.
--
-- Transactional rollback validation verified that after this revoke:
--   anon execute = false
--   authenticated execute = false
--   service_role execute = true
--   postgres execute = true
--   ensure_rls still enabled RLS on a newly created public probe table.

begin;

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

commit;
