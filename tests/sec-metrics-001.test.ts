import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const source = (file: string) =>
  readFileSync(join(root, "scripts/ops", file), "utf8");
const patch = source("sec_metrics_001_revoke_operational_metrics.sql");
const rollback = source("sec_metrics_001_emergency_rollback.sql");
const inventory = source("sec_metrics_001_readonly_verify.sql");

test("SEC-METRICS-001: migration revokes only operational metrics table roles", () => {
  assert.match(patch, /REVOKE ALL PRIVILEGES ON TABLE public\.p365_operational_metrics\s+FROM PUBLIC, anon, authenticated;/i);
  assert.doesNotMatch(patch, /REVOKE\s+[\s\S]*?FROM\s+(?:service_role|postgres)\b/i);
  assert.doesNotMatch(patch, /\b(?:ALTER TABLE|DROP TABLE|DELETE FROM|TRUNCATE TABLE|UPDATE public\.|CREATE POLICY|ALTER POLICY|cron\.alter_job|cron\.schedule|ON FUNCTION)\b/i);
  assert.doesNotMatch(patch, /\b(?:market_memory|p365_fred_revision_gate)\b/i);
  assert.match(patch, /SET LOCAL lock_timeout\s*=\s*'3s'/i);
});

test("SEC-METRICS-001: preflight and postflight protect both role classes", () => {
  for (const role of ["anon", "authenticated", "service_role", "postgres"]) {
    assert.ok(patch.includes(role));
    assert.ok(rollback.includes(role));
  }
  for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
    assert.ok(patch.includes("'" + privilege + "'"));
    assert.ok(inventory.includes("'" + privilege + "'"));
  }
  for (const guard of ["relrowsecurity", "pg_policies", "attacl", "has_table_privilege", "p365-storage-daily"]) {
    assert.ok(patch.includes(guard), "missing invariant " + guard);
  }
  assert.match(patch, /username='postgres'/);
  assert.match(patch, /RAISE EXCEPTION 'SEC-METRICS-001:/);
  assert.match(patch, /DO \$postflight\$/);
});

test("SEC-METRICS-001: rollback is isolated and explicitly restores original seven grants", () => {
  assert.match(rollback, /EMERGENCY ROLLBACK/);
  assert.match(rollback, /GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON TABLE public\.p365_operational_metrics TO anon, authenticated;/i);
  assert.doesNotMatch(rollback, /\b(?:market_memory|ON FUNCTION|cron\.schedule|ALTER TABLE)\b/i);
  assert.match(rollback, /DO \$postflight\$/);
});

test("SEC-METRICS-001: verifier is SELECT-only and checks runtime scheduling", () => {
  const sql = inventory.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(sql, /\b(?:REVOKE|GRANT|ALTER|CREATE|DROP|PERFORM|TRUNCATE\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+public\.)\b/i);
  assert.match(sql, /has_table_privilege/);
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /column_acl_count/);
  assert.match(sql, /cron\.job/);
  assert.match(sql, /STORAGE_CAPACITY/);
});
