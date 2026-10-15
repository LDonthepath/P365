#!/usr/bin/env bash
# DB-BACKUP-001 / #331 — manual, operator-owned, encrypted PostgreSQL export.
# Does not write to Supabase, Neon, GitHub, or any remote backup destination.
# One pg_dump invocation = one PostgreSQL consistent MVCC data snapshot.
# Exports the complete public schema (all tables, functions, triggers, indexes);
# other Supabase-managed schemas, cron, Vault secrets, Storage blobs, etc. excluded.
set -Eeuo pipefail
umask 077

fail() { printf 'DB-BACKUP-001: %s\n' "$*" >&2; exit 1; }
[[ "${GITHUB_ACTIONS:-}" != "true" ]] || fail "refusing public-repository GitHub Actions environment"
[[ -n "${P365_SOURCE_DB_URL:-}" ]] || fail "set P365_SOURCE_DB_URL privately on the operator workstation"
[[ -n "${P365_AGE_RECIPIENT:-}" ]] || fail "set P365_AGE_RECIPIENT (age public key), never the private identity"
[[ -n "${P365_BACKUP_DIR:-}" ]] || fail "set P365_BACKUP_DIR to an operator-owned directory outside the repository"
[[ "$P365_AGE_RECIPIENT" =~ ^age1[a-z0-9]{20,}$ ]] || fail "expected one valid-looking age public recipient"
for cmd in pg_dump age sha256sum python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "required command unavailable: $cmd"
done

# Verify the production project identity WITHOUT printing the secret connection URI.
# Supabase direct: db.<project-ref>.supabase.co; session pooler:
# postgres.<project-ref>@<region>.pooler.supabase.com:5432.
python3 - <<'PY'
import os, sys
from urllib.parse import urlsplit, unquote
uri = os.environ["P365_SOURCE_DB_URL"]
p = urlsplit(uri)
ref = "orwhuzexnuochctccqvl"
host, user = (p.hostname or "").lower(), unquote(p.username or "")
direct = host == f"db.{ref}.supabase.co"
pooled = host.endswith(".pooler.supabase.com") and user == f"postgres.{ref}"
if p.scheme not in ("postgres", "postgresql") or not p.password:
    sys.exit("DB-BACKUP-001: source URI must be a password-protected PostgreSQL connection URL")
if not (direct or pooled):
    sys.exit("DB-BACKUP-001: source identity mismatch; refusing to export a different project")
if pooled and p.port != 5432:
    sys.exit("DB-BACKUP-001: use session pooler :5432, NOT transaction pooler :6543")
if p.path != "/postgres":
    sys.exit("DB-BACKUP-001: unexpected source database (expected postgres)")
PY

mkdir -p -- "$P365_BACKUP_DIR"
chmod 700 -- "$P365_BACKUP_DIR"
# Avoid accidentally creating sensitive artifacts anywhere inside a Git repository.
P365_BACKUP_DIR="$P365_BACKUP_DIR" python3 - <<'PY'
from pathlib import Path
import os, sys
path = Path(os.environ["P365_BACKUP_DIR"]).resolve()
if any((part / ".git").exists() for part in (path, *path.parents)):
    sys.exit("DB-BACKUP-001: output directory is inside a Git checkout")
PY

# PostgreSQL 17 server: use an equal/newer pg_dump, never an older major client.
major="$(pg_dump --version | sed -En 's/.*PostgreSQL\) ([0-9]+).*/\1/p')"
[[ "$major" =~ ^[0-9]+$ ]] || fail "cannot identify pg_dump major version"
(( 10#$major == 17 )) || fail "pg_dump 17 required for source and Neon PostgreSQL 17"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="p365-public-${stamp}.pgdump.age"
target_dir="$(cd -- "$P365_BACKUP_DIR" && pwd -P)"
final="$target_dir/$name"
partial="$final.partial.$$"
checksum="$final.sha256"
[[ ! -e "$final" && ! -e "$checksum" && ! -e "$partial" ]] || fail "backup filename already exists"
cleanup() { rm -f -- "$partial"; }
trap cleanup EXIT
trap 'fail "backup interrupted; incomplete encrypted output deleted"' INT TERM
export PGCONNECT_TIMEOUT=20 PGSSLMODE=require
# PASSING CONNECTION URI THROUGH PGDATABASE ENVIRONMENT, NOT CLI ARGV.
# The age filter receives the raw pg_dump bytes via a pipe; no plaintext dump
# is ever written to the filesystem by this script. pipefail rejects either
# exporter or encryptor failure and removes the partial encrypted file.
PGDATABASE="$P365_SOURCE_DB_URL" pg_dump \
  --format=custom --compress=6 --no-owner --no-privileges \
  --schema=public \
  | age --encrypt --recipient "$P365_AGE_RECIPIENT" > "$partial"

[[ -s "$partial" ]] || fail "encrypted output empty"
mv -n -- "$partial" "$final"
[[ ! -e "$partial" ]] || fail "backup finalization collision; refusing existing destination"
[[ -s "$final" ]] || fail "encrypted output did not finalize"
(cd -- "$target_dir" && sha256sum "$name") > "$checksum"
[[ -s "$checksum" ]] || fail "checksum missing"
(cd -- "$target_dir" && sha256sum --check --status "$name.sha256") || fail "encrypted checksum verification failed"
trap - EXIT
printf 'DB-BACKUP-001: encrypted export complete; NOT YET an off-site backup or tested full restore.\n'
printf 'Artifact: %s\nChecksum: %s\n' "$final" "$checksum"
printf 'Next: move ciphertext + checksum to approved off-site storage, then decrypt/verify and restore into isolated Neon branch.\n'
