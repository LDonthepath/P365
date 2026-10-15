#!/usr/bin/env bash
# DB-BACKUP-001 / #331 — locally verify encrypted archive integrity and pg_dump catalog.
# Does not connect to Supabase, Neon, or write to any database.
# Identity/private key must NEVER be placed in the public P365 repository.
set -Eeuo pipefail
umask 077
fail() { printf 'DB-BACKUP-001: %s\n' "$*" >&2; exit 1; }

[[ "${GITHUB_ACTIONS:-}" != "true" ]] || fail "refusing public-repository GitHub Actions environment"
[[ -n "${P365_BACKUP_ARCHIVE:-}" ]] || fail "set P365_BACKUP_ARCHIVE to an existing *.pgdump.age file"
[[ -n "${P365_AGE_IDENTITY_FILE:-}" ]] || fail "set P365_AGE_IDENTITY_FILE privately (do not share the private key)"
for cmd in age pg_restore sha256sum python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "required command unavailable: $cmd"
done

archive="$P365_BACKUP_ARCHIVE"
identity="$P365_AGE_IDENTITY_FILE"
[[ -f "$archive" && -s "$archive" ]] || fail "archive missing/empty"
[[ -f "$identity" && -r "$identity" ]] || fail "private age identity inaccessible"
[[ "$archive" == *.pgdump.age ]] || fail "unexpected archive extension"
archive_dir="$(cd -- "$(dirname -- "$archive")" && pwd -P)"
name="$(basename -- "$archive")"
[[ -f "$archive_dir/$name.sha256" ]] || fail "matching SHA256 manifest not found"
# File names are checked by sha256sum inside the archive folder; ciphertext
# checksum is a transport-integrity check, NOT authenticity of the creator.
(cd -- "$archive_dir" && sha256sum --check --status "$name.sha256") ||
  fail "encrypted artifact hash mismatch"

# This is a catalog/format check only: NOT a successful database restore.
# Never persist plaintext dump bytes. Dump objects' names/metadata go into a
# temporary owner-only listing, deleted on success or any failure.
listing="$(mktemp)"
cleanup() { rm -f -- "$listing"; }
trap cleanup EXIT
age --decrypt --identity "$identity" "$archive" | pg_restore --list > "$listing" ||
  fail "unable to decrypt and read PostgreSQL archive"
for table in market_memory p365_fred_revision_gate p365_fred_revision_heads; do
  grep -Eq " TABLE public ${table} " "$listing" ||
    fail "missing required public table in archive: $table"
  grep -Eq " TABLE DATA public ${table} " "$listing" ||
    fail "missing TABLE DATA entry in archive: $table"
done
printf 'DB-BACKUP-001: encrypted hash and 3 critical table+data catalog entries VERIFIED.\n'
printf 'Still required: approved off-site retention, full SQL restore, constraints/trigger/revisions and RPO/RTO proof.\n'
