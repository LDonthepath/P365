# DB-BACKUP-001 — Safe operator export readiness (Supabase Free → isolated Neon)

**Issue:** [#331](https://github.com/LDonthepath/P365/issues/331) · **Review:** [Draft PR #357](https://github.com/LDonthepath/P365/pull/357) · 11 October 2026 UTC.  
**State:** **EXPORT TOOLS COMMITTED; NO REAL FULL EXPORT OR RECOVERABLE ARCHIVE EXECUTED.** This is an operator handoff, not an executed backup receipt.

## Critical decision: GitHub repository is PUBLIC

The [P365 repository](https://github.com/LDonthepath/P365) is verified **public**. Never commit a canonical Market Memory export, Postgres connection URI, private age identity, unencrypted `pg_dump` archive, or source rows to GitHub; never upload them as ordinary GitHub Actions artifacts. Public repo artifacts are not a confidentiality boundary. This PR deliberately adds **only code/runbooks/metadata**, not backup contents. Running an exporter in GitHub Actions is explicitly rejected by the script.

**The artifact store is not chosen yet.** The first manual export is written to an operator-only directory outside any Git checkout. Until a hash-verified encrypted copy is placed in an **owner-approved external archive location**, with confirmed retention and an actual restore, **P365 still has no demonstrated backup recovery point**.

## What is ready / what remains unknown

- Verified Supabase source `orwhuzexnuochctccqvl`: PostgreSQL 17.6; org Free; canonical `public.market_memory` ≈270 MiB including indexes. Current count changes continually; do not infer export integrity from a later production `SELECT count(*)`.
- Verified Neon recovery project `snowy-flower-79929352`, PG17.11, Free capacity 1 GiB per branch, source-independent. The `drill-331-sample` branch passed the [20-record real-data exercise](P365-DB-BACKUP-001-NEON-SAMPLE-RESTORE-2026-10-11.md). The Neon default `main` branch is still empty. **A full restore target must be a new, separately approved disposable branch**, with zero user tables and no schedulers/ingestion.
- Export format: **one invocation** `pg_dump --format=custom --schema=public` gives a single PostgreSQL MVCC-consistent snapshot of the **entire public schema**: table data, indexes, functions, triggers and constraints whose definitions are in `public`. This includes the required Market Memory and two FRED revision tables. It also includes OTHER public objects, which could contain sensitive data; **treat all contents as confidential**. This is broader than the three-table read-only inventory, but single-dump consistency and inclusion of dependent functions are important. Inspect the archive catalog before granting restore readiness.
- Outside `public`: Supabase-managed `auth`, `storage`, `cron`, secrets, vault, extension-managed objects, API configuration, Vercel settings, Storage API blobs and provider keys are **NOT included**. Consequently this is **not a complete clone of the whole Supabase platform**, and even public-schema import into standard Neon may have unresolved cross-schema role/extension dependencies.
- **RPO/RTO and off-site retention remain UNKNOWN**. Encryption alone does not create an off-site backup. 1 GiB Neon Free capacity may be exceeded after restore (heap/index growth); no claim of guaranteed fit.

## Operator-only procedure — executable after private credentials and archival decision

Prerequisites on a **trusted workstation**: `pg_dump` version **17**, `pg_restore` 17, `age` + `age-keygen`, `python3`, `sha256sum`, Bash. Get the **session-pooler :5432 or direct** Postgres connection URI from Supabase Dashboard → Project `orwhuzexnuochctccqvl` → **Connect**; supply it directly to your workstation privately. Do **not** paste connection strings/private identities into this chat, GitHub, issue comments, PR review, Actions secrets of the public repo, or Vercel public variables.

1. Generate encryption identity on a secure workstation or key manager; keep the **private age identity** secured offline with a separately controlled recovery copy. It is a **new archive encryption key**, not a Supabase/Neon provider key. Example, in a directory outside any Git checkout:

   ```bash
   umask 077
   mkdir -p "$HOME/.config/p365-backup"
   chmod 700 "$HOME/.config/p365-backup"
   age-keygen -o "$HOME/.config/p365-backup/recovery-age-identity.txt"
   export P365_AGE_RECIPIENT="$(age-keygen -y "$HOME/.config/p365-backup/recovery-age-identity.txt")"
   ```

2. Supply production connection URI locally *without echo or shell tracing*; `read -rs` prevents terminal echo but does not replace disk/host access controls:

   ```bash
   read -rs -p "Supabase production DB URI (hidden): " P365_SOURCE_DB_URL
   printf '\n'
   export P365_SOURCE_DB_URL
   export P365_BACKUP_DIR="$HOME/p365-private-archives"
   # From the P365 repository checkout (after PR merge, or checked-out PR branch):
   bash scripts/ops/db_backup_001_export_encrypted.sh
   unset P365_SOURCE_DB_URL
   ```

   The script refuses non-P365 project identity, Supabase transaction pooler :6543, non-PostgreSQL17 clients, GitHub Actions/public-repo execution, backup directories inside Git, and missing encryption key. Connection URI goes via `PGDATABASE` **environment**, not command-line arguments. `pg_dump` custom-format bytes stream directly through `age`; **no plaintext dump is materialized**. `set -o pipefail` plus EXIT cleanup prevent a failed exporter/encryptor from being labeled successful. Output: `*.pgdump.age` (ciphertext) and `*.pgdump.age.sha256` (encrypted-file checksum), stored with restrictive operator permissions.

3. Verify archive **on a separate trusted recovery machine if feasible**, and ensure both ciphertext and checksum survive transfer unchanged:

   ```bash
   export P365_BACKUP_ARCHIVE="$HOME/p365-private-archives/<actual-export-filename>.pgdump.age"
   export P365_AGE_IDENTITY_FILE="$HOME/.config/p365-backup/recovery-age-identity.txt"
   bash scripts/ops/db_backup_001_verify_encrypted.sh
   ```

   This checks the **ciphertext checksum**, decrypts via streaming, validates `pg_restore --list` readability and confirms three required table + table-data catalog entries; it does **not** execute SQL, create a plaintext dump on disk, prove a full restore or protect against malicious replacement of *both* ciphertext and unsigned checksum. Preserve the manifest with access controls or a separately signed/immutably stored receipt to establish provenance.

4. **Owner must approve off-site destination** and retention first. Transfer only encrypted `*.pgdump.age` + checksum and dated operator receipt to that private store, verify checksum **after retrieval**, enforce access rights and retention; record the last durably available recovery time. Never make GitHub (public repository) the sole copy. A recommended **proposed** policy is 7 daily + 4 weekly retained copies; no schedule/provider/storage has been enabled or purchased in this issue.
5. **Full Neon restore is a separate explicit operator checkpoint.** Create a disposable isolated Neon branch (not production, not the existing sample branch), using a **direct nonpooled Neon URL** stored privately; verify an empty destination, disable triggers/hooks/cron as appropriate, qualify extension and Supabase role/function differences, and perform a controlled `pg_restore` under transaction/error-stop. If incompatible source-specific functions/roles fail, declare **restore failed** until a reviewed compatibility procedure exists; do not silently drop security or canonical constraints to make it pass. The existing [main recovery runbook](P365-DB-BACKUP-001-MARKET-MEMORY-RECOVERY-2026-10-11.md) lists post-restore physical counts, dedupe, FRED revisions, timeline eligibility and owner-gated cutover checks.

## Evidence required to close #331

- One independently stored, retrievable, encrypted full public-schema dump with valid checksum **and** a controlled retention commitment.
- Proof from an **actual full database restore** of the artifact into isolated Neon: same record counts, dedupe keys and payload hashes, valid primary/unique/foreign key constraints, append-only triggers, FRED gate/heads, true historical revision pairs, and point-in-time retrieval/capture semantics. Verify the *whole source backup snapshot*, not separate mutable reads. If incompatible due to Supabase-specific role/extension dependencies, document the failure rather than claiming recovery.
- Observed start/end timings for restore, artifact creation/cutoff, latest durable recovery point and measured RPO/RTO, plus user-approved rollback/cutover governance and issue/roadmap follow-up.
- No need to change production service-role `TRUNCATE` privilege in this issue; that requires a separately approved grant-hardening checkpoint.

## Tool quality boundary

The PR additionally runs **synthetic local mocks** of `pg_dump` and `age` in a TypeScript unit test. A fake encryptor intentionally copies fake fixture bytes to validate pipe mechanics and cleanup. That test **does not exercise real encryption or PostgreSQL export**. The verified Neon sample test (20 genuine rows) independently proves selected-data copying, **not a full backup**. Only the actual operator-led stages above can provide the missing proof.

References: [PostgreSQL 17 pg_dump MVCC consistency](https://www.postgresql.org/docs/17/app-pgdump.html), [Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [age encryption](https://github.com/FiloSottile/age), [Neon Postgres connection modes](https://neon.com/docs/connect/connection-pooling).
