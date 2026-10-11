# DB-BACKUP-001 — Market Memory Backup/Restore Readiness (11 October 2026)

**Issue:** [#331](https://github.com/LDonthepath/P365/issues/331) · **Roadmap:** [#283](https://github.com/LDonthepath/P365/issues/283) · **Type:** operational audit + non-mutating recovery runbook + synthetic fixture drill.  
**Baseline:** `main@d12cd9e1f7d93761500a0508d5d2fbe5cf6abe15` (owner-merged PR #356) · **Production:** `p365-kappa.vercel.app` → READY deployment `dpl_8SjCf7pGDhFcs2QPbNeKdkBdNVZK` (matching SHA, verified 11 Oct UTC).  
**Database:** Supabase project `orwhuzexnuochctccqvl`, PostgreSQL 17.6.1; **actual organization plan Free** (`tier_free` read via Supabase organization API, not inferred from notes).  
**Lifecycle:** IN REVIEW only when CI succeeds; **RECOVERY READINESS NOT VERIFIED** until a durable off-site backup artifact **and** isolated physical/logical restore proof exist. No production DML/DDL/TRUNCATE/restore/cron call performed.

## 1. Operational verdict (do not confuse schema integrity with recoverability)

| Question | Measured answer | Status |
|---|---|---|
| Is the organization on a paid, managed-backup entitlement? | Organization `plan=free`, `tier=tier_free`. Supabase [backup documentation](https://supabase.com/docs/guides/platform/backups) guarantees daily managed backups for Pro/Team/Enterprise, not for Free, and recommends Free users export via CLI and keep off-site copies. | **NO guaranteed usable managed retention** |
| Does an actual current downloadable backup exist? | No backup listing/download API or user-authorized off-site archive was available through the connected project tools. A historical backup might exist internally, but its existence and operator access were not verified. | **UNVERIFIED** |
| Actual RPO and backup retention? | No timestamped, independently stored, checksum-verified artifact or verified restore. **RPO, retention, and RTO are UNKNOWN**. Do not report daily snapshots merely because the provider may run internal backups. | **UNVERIFIED / AT RISK** |
| Append-only enforcement? | Trigger `market_memory_append_only` blocks UPDATE/DELETE; enabled. INSERT dedupe and coordinated FRED writer guard also enabled. | **VERIFIED for row UPDATE/DELETE** |
| Is TRUNCATE blocked by append-only trigger? | **NO.** `service_role` has `TRUNCATE=true` and `DELETE=true` on `public.market_memory`. Row-level BEFORE UPDATE/DELETE triggers do not protect TRUNCATE. No TRUNCATE attempt was made. | **PRIVILEGE EXPOSURE**, no exploitation claim |
| Canonical restore identity? | PK `id`, UNIQUE `dedupe_key`, foreign keys on `supersedes_id` and `invalidates_id`, not-self checks; RLS ON / no policies; `service_role` table access. | **SCHEMA VERIFIED**, no actual restore |
| FRED revision support | `p365_fred_revision_gate` and `p365_fred_revision_heads` live in `public`, with revision-writer guard trigger on `market_memory`. They are part of the **same logical backup/restore boundary**. | **SCOPE VERIFIED**, coordinated restoration untested |
| Nonproduction restore substrate | Supabase branch list returned `[]`; no owner-approved scratch database or restored full backup artifact available. Creating a paid/cloud project or moving secrets is not pre-approved. | **ACTUAL RESTORE NOT EXECUTED** |

**Source-policy nuance:** A Supabase troubleshooting page notes that daily backups of Free projects *may* be accessible after upgrade; this is **not** proof that an accessible, current backup exists for P365, nor a contractually guaranteed Free recovery point. Do not assume PITR is enabled or has any retention.

## 2. Verified live SQL receipt — 11 October 2026 around 02:36–02:38 UTC

- `public.market_memory`: approximately **270 MB** (283,107,328 bytes including indexes/TOAST), `RLS=true`, `policies=0`.
- Full physical count **176,335** (observation time around 02:37 UTC; ingestion is ongoing): `EVIDENCE=131,407`, `OBSERVATION=43,278`, `EVENT_RESULT=825`, `EVENT=508`, `CONTEXT=171`, `SNAPSHOT=146`.
- Physical row and distinct dedupe counts **176,335 / 176,335**; missing `dedupe_key`, `captured_at`, `payload` **0 / 0 / 0**. Unique index `uq_market_memory_dedupe_key` and PK `market_memory_pkey` present.
- Native `supersedes_id` links **0**, `invalidates_id` links **0**, dangling refs **0 / 0**, with enforced FK and not-self checks. **IMPORTANT:** these zero link counts do not prove absence of logical revisions: application Observation revision identity and `p365_fred_revision_heads` do not necessarily populate generic Market Memory `supersedes_id`. Synthetic fixture tests exercising those links do not prove the production writer populates them.
- Enabled triggers: `market_memory_append_only` (BEFORE DELETE OR UPDATE); `market_memory_dedupe_key` (BEFORE INSERT); `p365_fred_revision_writer_guard` (BEFORE INSERT).
- `service_role` retains SELECT/INSERT/DELETE/TRUNCATE on `market_memory` and the two FRED revision tables. Anon TRUNCATE is false. A service-role write key is server-only in `lib/data/market-memory-store.ts`; **do not infer that every external holder is trustworthy**.
- `p365_fred_revision_gate` and `p365_fred_revision_heads` sizes: 24 KiB and 16 KiB respectively. Export their schema and data together with Market Memory.
- Production read-only audit: [`scripts/ops/db_backup_001_readonly_inventory.sql`](../scripts/ops/db_backup_001_readonly_inventory.sql). It prints only aggregates/definitions, never raw canonical payloads.

**Scope boundaries:** Existing issue [#310](https://github.com/LDonthepath/P365/issues/310) governs *operational-metrics* table grants; it does **not** authorize revoking `market_memory` privileges in #331. The memory TRUNCATE finding needs separately owner-approved least-privilege hardening if pursued. Issue [#315](https://github.com/LDonthepath/P365/issues/315) governs one-issue/one-PR lifecycle and is closed.

## 3. Recovery objectives, policy, and export procedure

**Current actual RPO:** UNKNOWN — no verified external backup. **Current actual RTO:** UNKNOWN — no database restore drill. **Current guaranteed retained restore points:** NONE VERIFIED.

**Proposal for owner approval, NOT operational yet:** aim for an export no less often than **daily UTC**, retain **7 daily + 4 weekly encrypted off-site artifacts**, perform a **monthly isolated restore drill**, and record an actual RPO from the last usable backup timestamp and last recovered canonical capture. This is a *target*, not a measured SLA, nor an assertion Supabase Free supports continuous PITR. Increase cadence only after storage, secrets and durable destination are qualified. Archive cost/retention and automation are not implemented in this issue.

**Operator prerequisites (explicit owner gate):** approved encrypted off-site destination outside Supabase Free, credential escrow for a least-privileged backup operator capable of a consistent SQL dump, isolated restore target under operator control, sufficient storage/CPU, and an incident change window. **Do not paste DB connection URLs/keys into GitHub, CI, issue comments, chat, or shared logs.** Restrict dump files to operator-only directories; never commit an export to this repository.

For a trusted workstation with Supabase CLI + Docker installed, use a **project connection string obtained privately** from `Supabase dashboard → Connect` (prefer session pooler/direct connection supported by your environment). Run in a private directory with mode `0700` and avoid shell tracing. Supabase's official [dump guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform) provides compatible commands:

```bash
# The operator must securely supply P365_SOURCE_DB_URL through their credential store.
# Do not use "set -x", echo the value, or place it in a repo / CI artifact.
umask 077
mkdir -p ./p365-private-backup
cd ./p365-private-backup
supabase db dump --db-url "$P365_SOURCE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$P365_SOURCE_DB_URL" -f schema.sql
supabase db dump --db-url "$P365_SOURCE_DB_URL" -f data.sql --use-copy --data-only
sha256sum roles.sql schema.sql data.sql > SHA256SUMS
sha256sum -c SHA256SUMS
```

**Important export caveats:**
- These are **three separate database connections/snapshots**, not an atomic, single-snapshot logical backup. Treat this as a **first manual recovery baseline**, not a proven transaction-consistent bundle while ingestion continues. A truly consistent export requires an operator-qualified snapshot strategy (e.g. a single `pg_dump` snapshot with an approved Supabase-compatible layout) or a controlled, authorized ingestion pause and checkpoint, neither of which has been executed. Do not infer row counts from a separate live SQL query match the dump.
- `supabase db dump` applies Supabase-specific filtering and does **not** include Supabase-managed schemas (`auth`, `storage`, extension-managed schema). Validate the dump contains `public.market_memory` plus both FRED revision tables, triggers, functions, constraints and indexes. **Cron schedules, Edge Functions, Storage object blobs, provider entitlements/keys, vault secrets, Vercel configuration and connection strings are NOT proven protected by this DB export**; inventory them separately under their respective governance without copying secrets into artifacts.
- A "backup" is not durable until files are **encrypted, uploaded to an approved off-site store**, hash-checked after download, given explicit access controls and retention, and demonstrated restorable. These steps are **NOT executed**.
- Supabase Free 500 MB database quota and Market Memory growth are separately governed by [#333](https://github.com/LDonthepath/P365/issues/333)/[#350](https://github.com/LDonthepath/P365/issues/350); backup does not authorize production retention deletion.

## 4. Isolated restore DRILL — operator procedure, NOT yet executed

**STOP if the destination points to `orwhuzexnuochctccqvl` (production)**, shares the production writable credentials, has live cron dispatch enabled, or lacks owner approval. The target must be an **empty, disposable, isolated PostgreSQL/Supabase-compatible environment**, with **no route to production ingestion/webhooks/providers**. Creating a new Supabase branch/project may carry costs and requires explicit owner budget/approval.

1. Record signed checkpoint information in a restricted manifest: source project ref, project/version, UTC export start/end, snapshot-consistency qualifier, files + SHA-256, encryption/off-site URI (without credentials), backup retention expiry, exported table lists, selected schema revision and restore operator. Capture reference totals from the **restored bundle itself**, not mutable live production counts.
2. Retrieve artifact to the isolated operator environment and run `sha256sum -c SHA256SUMS`. Confirm no credentials appear in SQL dump or logs; secrets and role passwords may need separate secure reconfiguration.
3. Validate destination identifier twice, verify it is empty, and **disable cron/webhooks/scheduled ingestion**. Never restore into the P365 production alias/database.
4. Use Supabase's [isolated self-hosted restore procedure](https://supabase.com/docs/guides/self-hosting/restore-from-platform) as a *starting example* (requires a compatible local operator-managed PostgreSQL instance, extensions, credentials and privileges). The official guide illustrates:

```bash
# Restore connection URL must refer to an isolated local nonproduction database.
# Commands below are an operator plan; not executed by ChatGPT.
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$P365_RESTORE_DB_URL"
```

5. Understand that the `session_replication_role=replica` data-import stage bypasses ordinary triggers and some referential checks **during import**. Once import completes, assert all required FKs/indexes/constraints valid, append-only and dedupe triggers enabled, and no missing/dangling references. **Do not consider import success alone proof of historical integrity.** Validate the FRED gate/heads schema and state together; do not manually fabricate historical revisions or auto-advance heads to "latest".
6. Execute the [read-only inventory SQL](../scripts/ops/db_backup_001_readonly_inventory.sql) **against that isolated restored database**. Preserve and compare row count per `record_type`, distinct `dedupe_key`, zero missing keys, FK orphan counts, trigger definitions/enabled flags, `payload_hash` and provenance fields when present, and FRED gate/heads row counts. Set of record IDs and dedupe keys should be identical to a manifest generated **inside the same consistent backup snapshot**, if available. A SQL payload checksum on a separate live query is not equivalent.
7. Run the project TypeScript synthetic replay fixture `lib/data/market-memory-recovery-drill.test.ts` with G0 as an **additional** invariant check. It verifies duplicate rejection, historical revisions and `captured_at/retrievedAt` eligibility — it does not test PostgreSQL restores or live FRED writes.
8. Verify operational isolation one more time. **Do not promote, merge a Supabase branch, or redirect Vercel alias** automatically. Record pass/fail evidence with timings, target ID, schemas restored, checksum, row equality, revision/gate checks, and missing dependency list. An actual SQL restoration that has not passed those checks is a FAIL, not READY.

## 5. Production disaster response / approval gates

1. **Contain, do not overwrite:** determine outage/corruption time. Authorized operator may temporarily stop ingestion and freeze downstream use, preserving logs and canonical evidence. Do not call `TRUNCATE`, `DELETE`, run an unbounded upsert, reset migration history, or retroactively shift `captured_at` to fill a gap.
2. **Choose a verified recovery point:** rank available encrypted artifacts by independent integrity/restore receipts, not by filename or claimed cadence. Compute realized RPO = incident/cutoff instant minus **last verified durable recovery checkpoint**. The first available backup may be far older than expected on Free; if there is none, declare **RECOVERY NOT GUARANTEED**.
3. **Restore/validate in isolation:** enforce immutable historical `id`/`dedupe_key`, original `captured_at` and semantic `effective_at`, original `retrievedAt`/publication timestamps, source provenance, `supersedes_id`/`invalidates_id`, and `p365_fred_revision_gate` + `heads` epoch/sequence consistency. A future-available fact must not appear at an earlier point-in-time. Recover record families `OBSERVATION`, `EVIDENCE`, `EVENT`, `EVENT_RESULT`, `CONTEXT`, `SNAPSHOT` (and any future families actually present).
4. **Account for RPO gap separately:** no automatic "replay latest" that silently creates fictitious past facts or swaps retrieved/effective/captured semantics. Backfill is separately authorized, provider-qualified, append-only and independently labeled. A backup restores what was **known as of its real physical capture**, not any logically earlier effective date with a later retrieval.
5. **Owner-controlled cutover:** only after explicit owner authorization and qualified backup validation should credentials, DNS/aliases, API bindings, scheduler and cron endpoints be re-pointed. Preserve a known-good rollback path and rollback decision threshold. A production restore/promotion is a separate high-impact change approval, *not* authorized by merging #331.
6. **Post-cutover proof:** compare service-role table permissions, audit logs, scheduler executions, canonical counts, FRED revision gate/heads, read-only dashboard runtime and error logs. If checks fail, halt writes and execute separately approved fallback; never destroy the last recovered artifact.

**Out of scope:** grant revocation; disabling the TRUNCATE privilege; automated backup scheduling; external storage provider or subscription; production export/copy of canonical payloads to this conversation; destructive restore; rewriting FRED pointers; truncation or retention cleanup; trading decisions.

## 6. Synthetic rehearsal executed through CI vs actual recovery proof

An isolated, fully synthetic **in-memory** export/restore test is committed at [`lib/data/market-memory-recovery-drill.test.ts`](../lib/data/market-memory-recovery-drill.test.ts). It uses P365's actual `marketMemoryDedupeKey` / `marketMemoryEffectiveAt` helpers with made-up FRED-like revisions and Event Evidence, and verifies:
- complete round-trip SHA-256 + physical row/identity/provenance;
- 2 historical revisions retained, with backward links; duplicate IDs/dedupe keys rejected;
- same-content Event Evidence retrieval-only change stays same identity; changed content creates new identity;
- `captured_at` **and** payload `retrievedAt` enforce historical point-in-time eligibility even if `effective_at` is old;
- tampered checksums and orphan/backwards links reject recovery.

**Do not promote a synthetic in-memory fixture to "real restore PASS".** It does not exercise actual `pg_dump`, PostgreSQL permissions, triggers, migrated schema, encrypted off-site storage, copy consistency, source/restore connection or cron isolation. An operator-controlled nonproduction SQL restore and dated immutable artifact remain **outstanding**.

## 7. Acceptance / gate ownership

- [x] Current main SHA + READY production alias, actual Free tier, key table and trigger/grant/read-model evidence read from live project.
- [x] Explicit backup scope, revision gate/head dependencies, point-in-time provenance, risks and owner-gated rollback/cutover documented.
- [x] Repeatable production SELECT-only inventory SQL committed; fixture-based nonproduction **logical replay** checks added; G0 results recorded in PR when ready.
- [ ] **Real, checksum-verified encrypted off-site backup with a dated retention policy exists**, from operator-controlled environment; actual RPO captured.
- [ ] **Actual isolated PostgreSQL/Supabase-compatible restore** of that artifact, with row-count/key/FRED revision checks, trigger/FK revalidation, restore timestamp and observed RTO. No isolated Supabase branch currently exists.
- [ ] Owner reviews PR, merges, then actual main/CI and read-only production evidence checked; roadmap #283 status updated and issue #331 closed **only if the necessary backup/restore checks are completed**, otherwise remains **BLOCKED / partially qualified**.

**Decision requested of owner after review:** approve a **secure backup destination and isolated restore environment** (with cost/credential handling) or explicitly accept the existing Free Plan recovery risk. Neither choice is silently made in this issue. Do not merge PR as evidence that unexecuted backup and restore steps happened.
