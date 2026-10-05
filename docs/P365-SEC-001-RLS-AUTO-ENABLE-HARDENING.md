# SEC-001 — rls_auto_enable SECURITY DEFINER Execute Hardening

**Status:** IMPLEMENTATION PREPARED / PRODUCTION ACTIVATION PENDING OWNER MERGE  
**Date:** 5 Oct 2026

## 1. Purpose

Harden the existing Supabase event-trigger helper:

`public.rls_auto_enable()`

without changing its intended function:

> automatically enable row-level security on newly created tables in the `public` schema.

The function is:

- `SECURITY DEFINER`;
- owned by `postgres`;
- bound to event trigger `ensure_rls`;
- configured with `search_path = pg_catalog`.

## 2. Production finding

Supabase security advisor reported that the function was directly executable by application roles.

The production ACL was:

- PUBLIC: EXECUTE
- postgres: EXECUTE
- anon: EXECUTE
- authenticated: EXECUTE
- service_role: EXECUTE

Because PUBLIC had EXECUTE, removing only explicit `anon` and `authenticated` grants would
not have been sufficient.

This is unnecessary privilege: the event trigger needs the function internally, but browser/API
roles do not need to invoke the helper directly.

## 3. Correction

The frozen correction is:

```sql
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
```

Intended post-correction access:

- anon: no EXECUTE
- authenticated: no EXECUTE
- PUBLIC: no EXECUTE
- service_role: retains explicit EXECUTE
- postgres: remains owner / executable

No function body change is required.

## 4. Event-trigger preservation proof

Before production activation, the correction was validated inside one PostgreSQL transaction and
then rolled back.

Inside the rollback-only transaction:

1. EXECUTE was revoked from PUBLIC/anon/authenticated;
2. a temporary probe table was created in the `public` schema;
3. event trigger `ensure_rls` fired;
4. the probe table reported `relrowsecurity = true`;
5. privilege checks returned:
   - anon = false;
   - authenticated = false;
   - service_role = true;
   - postgres = true;
6. the transaction was rolled back.

Therefore the privilege hardening does not disable the existing RLS auto-enable behavior.

## 5. Repository contract

Activation SQL:

`docs/P365-SEC-001-RLS-AUTO-ENABLE-HARDENING.sql`

Production mutation remains blocked until owner merge.

## 6. Non-goals

SEC-001 does not:

- change RLS policies;
- disable `ensure_rls`;
- change the function body;
- change function ownership;
- change `search_path`;
- alter Market Memory;
- alter ingestion;
- alter cron;
- alter provider access;
- alter UI;
- activate State/Regime/Risk/Intelligence.

## 7. Post-merge acceptance

After owner merge:

1. execute the revoke in production;
2. verify anon/authenticated have no EXECUTE;
3. verify service_role/postgres remain executable;
4. verify `ensure_rls` remains active;
5. rerun Supabase security advisor;
6. verify the two `rls_auto_enable` executable warnings are cleared;
7. confirm no unrelated production/runtime regression.
