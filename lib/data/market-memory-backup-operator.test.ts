import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/** Only synthetic fake binaries. NO Supabase connection and NO real backup here. */
const script = join(process.cwd(), "scripts", "ops", "db_backup_001_export_encrypted.sh");
const syntheticUrl = "postgresql://postgres.orwhuzexnuochctccqvl:synthetic-pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
const recipient = `age1${"q".repeat(58)}`;

function setup() {
  const root = mkdtempSync(join(tmpdir(), "p365-backup-331-"));
  const bin = join(root, "bin");
  const backups = join(root, "backups");
  mkdirSync(bin);
  mkdirSync(backups);
  const mockDump = `#!/usr/bin/env bash
set -eu
if [[ "\${1:-}" == "--version" ]]; then
  echo 'pg_dump (PostgreSQL) 17.6'
  exit 0
fi
# URI must be in PGDATABASE env, never in the process argv.
[[ "\${PGDATABASE:-}" == *"orwhuzexnuochctccqvl"* ]]
[[ "$*" != *"synthetic-pass"* ]]
printf 'fixture-only-public-schema'
if [[ "\${P365_TEST_FAIL_DUMP:-}" == 'true' ]]; then exit 33; fi
`;
  const mockAge = `#!/usr/bin/env bash
set -eu
[[ "\${1:-}" == "--encrypt" ]]
# Echoing fake bytes is acceptable IN THIS TEST ONLY, NEVER in production.
# A real operator must install the audited age binary.
cat
`;
  const a = join(bin, "pg_dump");
  const b = join(bin, "age");
  writeFileSync(a, mockDump, { mode: 0o700 });
  writeFileSync(b, mockAge, { mode: 0o700 });
  chmodSync(a, 0o700);
  chmodSync(b, 0o700);
  return {
    root, backups,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      GITHUB_ACTIONS: "false",
      P365_SOURCE_DB_URL: syntheticUrl,
      P365_AGE_RECIPIENT: recipient,
      P365_BACKUP_DIR: backups,
    },
  };
}

test("DB-BACKUP-001 manual exporter passes bash syntax and never puts source URL in CLI argv", () => {
  execFileSync("bash", ["-n", script]);
  const source = readFileSync(script, "utf8");
  assert.match(source, /set -Eeuo pipefail/);
  assert.match(source, /PGDATABASE="\$P365_SOURCE_DB_URL" pg_dump/);
  assert.doesNotMatch(source, /--dbname=["']?\$P365_SOURCE_DB_URL/);
  assert.match(source, /--format=custom/);
  assert.match(source, /--schema=public/);
  assert.match(source, /age --encrypt --recipient/);
  assert.match(source, /GITHUB_ACTIONS/);
});

test("DB-BACKUP-001 mock streaming completes encrypted-named artifact and verifies SHA256", () => {
  const fixture = setup();
  try {
    const stdout = execFileSync("bash", [script], { env: fixture.env, encoding: "utf8" });
    assert.match(stdout, /encrypted export complete/);
    const outputs = readdirSync(fixture.backups);
    assert.equal(outputs.length, 2);
    const encryptedName = outputs.find((s) => s.endsWith(".pgdump.age"));
    assert.ok(encryptedName);
    assert.equal(readFileSync(join(fixture.backups, encryptedName), "utf8"),
      "fixture-only-public-schema");
    // The fake age binary only copies input; this test PROVES PIPELINE MECHANICS,
    // NOT cryptographic security or a real successful encrypted backup.
    assert.ok(existsSync(join(fixture.backups, encryptedName + ".sha256")));
    execFileSync("sha256sum", ["--check", encryptedName + ".sha256"], {
      cwd: fixture.backups, stdio: "ignore",
    });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("DB-BACKUP-001 source failure removes incomplete ciphertext and checksum", () => {
  const fixture = setup();
  try {
    assert.throws(() => execFileSync("bash", [script], {
      env: { ...fixture.env, P365_TEST_FAIL_DUMP: "true" }, stdio: "pipe",
    }));
    assert.deepEqual(readdirSync(fixture.backups), []);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("DB-BACKUP-001 refuses wrong Supabase project even with syntactically valid credentials", () => {
  const fixture = setup();
  try {
    const wrong = syntheticUrl.replaceAll("orwhuzexnuochctccqvl", "some-other-project");
    assert.throws(() => execFileSync("bash", [script], {
      env: { ...fixture.env, P365_SOURCE_DB_URL: wrong }, stdio: "pipe",
    }));
    assert.deepEqual(readdirSync(fixture.backups), []);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("DB-BACKUP-001 refuses GitHub Actions execution in public repository", () => {
  const fixture = setup();
  try {
    assert.throws(() => execFileSync("bash", [script], {
      env: { ...fixture.env, GITHUB_ACTIONS: "true" }, stdio: "pipe",
    }));
    assert.deepEqual(readdirSync(fixture.backups), []);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
